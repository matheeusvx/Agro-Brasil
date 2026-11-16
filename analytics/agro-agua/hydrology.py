"""Aquisição auditável complementar; não integra fontes sem qualidade confirmada.

Padrão offline. --online obtém somente arquivos ausentes, sem substituir bytes.
O recorte é fixo para a entrega de 16/11/2026, não um serviço de atualização.
"""
from __future__ import annotations
import argparse
from collections import Counter
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "outputs/entrega/hidrologia"
BASE = "https://mananciais.sabesp.com.br/"
PARAMETERS = {684: "%", 691: "m³/s", 690: "m³/s", 1: "mm"}
PERIODS = {"historico": ("2025-01-01", "2025-12-31", 365),
           "atual": ("2026-11-01", "2026-11-16", 16)}


def sha(blob):
    return hashlib.sha256(blob).hexdigest()


def write(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def fetch(name, url, online, out=OUT):
    raw = out / "raw" / name
    meta = out / "raw" / (name + ".meta.json")
    if meta.exists():
        record = json.loads(meta.read_text(encoding="utf-8"))
        if record["url"] != url:
            raise ValueError("URL divergente do cache")
        if record.get("sha256") and (not raw.exists() or sha(raw.read_bytes()) != record["sha256"]):
            raise ValueError(f"Cache corrompido: {name}")
        return record
    if raw.exists():
        raise ValueError(f"Resposta sem metadados: {name}")
    if not online:
        raise FileNotFoundError(f"Cache ausente: {name}; aquisição explícita requer --online")
    raw.parent.mkdir(parents=True, exist_ok=True)
    record = {"url": url, "retrieved_at_utc": datetime.now(timezone.utc).isoformat(),
              "timeout_seconds": [10, 30], "tls_verification": True}
    try:
        response = requests.get(url, timeout=(10, 30))
        raw.write_bytes(response.content)
        record.update(status=response.status_code, bytes=len(response.content),
                      sha256=sha(response.content), content_type=response.headers.get("Content-Type"))
    except requests.RequestException as exc:
        record.update(error_type=type(exc).__name__, error=str(exc))
    write(meta, record)
    return record


def inspect_series(payload, parameter, start, end, expected):
    """Critérios independem do desempenho ML; flags desconhecidas impedem uso."""
    if payload.get("succeeded") is not True or not isinstance(payload.get("data"), list):
        raise ValueError("Resposta não confirma sucesso e lista de registros")
    rows = payload["data"]
    dates, bad_values, bad_identity, flags = [], 0, 0, Counter()
    for r in rows:
        date = datetime.fromisoformat(r["date"]).date().isoformat()
        dates.append(date)
        value = r.get("value")
        bad_values += int(isinstance(value, bool) or not isinstance(value, (float, int)) or not math.isfinite(value))
        bad_identity += int(r.get("idElemento") != 65 or r.get("idParametro") != parameter)
        flags[str(r.get("isValid"))] += 1
    bounded = all(start <= d <= end for d in dates)
    coverage = len(set(d for d in dates if start <= d <= end)) / expected
    # Mesmo True não substitui confirmação de janela, unidade e semântica de validação.
    return {"parameter_id": parameter, "unit": PARAMETERS[parameter], "element_id": 65,
            "system": "Alto Tietê", "start": start, "end": end, "expected_days": expected,
            "records": len(rows), "unique_dates": len(set(dates)), "coverage_fraction": coverage,
            "duplicate_dates": len(dates)-len(set(dates)), "bad_values": bad_values,
            "bad_identity": bad_identity, "dates_in_period": bounded, "isValid_counts": dict(flags),
            "quality_flag_semantics": "nao_confirmada", "daily_window": "nao_confirmada",
            "incorporated_in_analysis": False,
            "decision": "quarentena: confirmar flag isValid e janela antes de uso analítico"}


def run(online=False, out=OUT):
    out = Path(out)
    if out.resolve() != OUT.resolve():
        raise ValueError("Esta entrega usa somente o diretório complementar fixado")
    urls = {
        "sabesp-base.html": BASE + "base-dados",
        "sabesp-cliente.js": BASE + "assets/index-D9VAUj9x.js",
        "sabesp-parametros.json": BASE + "api/v4/parametros",
        "sabesp-sistemas.json": BASE + "api/v4/sistemas",
        "sabesp-ultima-data.json": BASE + "api/v4/dados/ultima-data",
        "sabesp-glossario.html": BASE + "glossario",
        "spaguas-reservatorios.html": "https://salasituacaosp.spaguas.sp.gov.br/sssp/reservatorios",
        "spaguas-vazoes.html": "https://salasituacaosp.spaguas.sp.gov.br/sssp/vazoes-comparativo",
        "spaguas-ssd.html": "https://cth.daee.sp.gov.br/ssdsp/Mananciais",
        "spaguas-fluviometricos.html": "https://ph.spaguas.sp.gov.br/Fluviometricos",
    }
    for label, (start, end, _) in PERIODS.items():
        for parameter in PARAMETERS:
            urls[f"alto-tiete-{parameter}-{label}.json"] = (
                BASE + f"api/v4/elementos/65/dados/{parameter}/diario/{start}/{end}")
    records = {name: fetch(name, url, online, out) for name, url in urls.items()}
    units = json.loads((out / "raw/sabesp-parametros.json").read_bytes())["data"]
    for pid, unit in PARAMETERS.items():
        if next(p["symbol"] for p in units if p["id"] == pid) != unit:
            raise ValueError("Unidade oficial divergente")
    quality = []
    for label, (start, end, expected) in PERIODS.items():
        for parameter in PARAMETERS:
            name = f"alto-tiete-{parameter}-{label}.json"
            if records[name].get("status") != 200:
                raise ValueError(f"Aquisição incompleta: {name}")
            item = inspect_series(json.loads((out / "raw" / name).read_bytes()), parameter, start, end, expected)
            item.update(period_label=label, raw_file="raw/"+name, raw_sha256=records[name]["sha256"])
            quality.append(item)
    write(out / "quality.json", {"series": quality, "incorporated_in_analysis": False,
          "reason": "Flags isValid=false sem semântica confirmada; janela diária sem timezone. Não inferir que false comprova erro físico nem ignorar a flag.",
          "integration": "Sem junção com NASA LST, sem correlação entre fontes, sem modelos ou alertas de reservatórios.",
          "availability_evidence": records})
    print(f"{len(quality)} séries auditadas; 0 incorporadas; {sum(q['records'] for q in quality)} registros em quarentena.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--online", action="store_true")
    run(parser.parse_args().online)
