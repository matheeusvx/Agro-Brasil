"""AGUA-01: aquisição auditável NASA POWER; sem imputação ou ML."""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
import logging
from pathlib import Path
import platform
import sys
import time
from importlib.metadata import version

import numpy as np
import pandas as pd
import requests

ROOT = Path(__file__).resolve().parent
API = "https://power.larc.nasa.gov/api/temporal/daily/point"
# Faixas de triagem amplas, não limites climatológicos calibrados para Mogi.
RULES = {
    "PRECTOTCORR": ("mm/day", 0, 1000),
    "T2M": ("C", -50, 60),
    "T2M_MAX": ("C", -50, 60),
    "T2M_MIN": ("C", -50, 60),
    "RH2M": ("%", 0, 100),
    "WS10M": ("m/s", 0, 100),
    "ALLSKY_SFC_SW_DWN": ("MJ/m^2/day", 0, 60),
}
LOG = logging.getLogger("agro_agua")


def write_json(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2, allow_nan=False) + "\n", encoding="utf-8")


def sha(data):
    return hashlib.sha256(data).hexdigest()


def strict_json(raw):
    def pairs(items):
        result = {}
        for key, value in items:
            if key in result:
                raise ValueError(f"Chave JSON duplicada: {key}")
            result[key] = value
        return result
    return json.loads(raw, object_pairs_hook=pairs)


class Collector:
    """Cache persistente por URL/parâmetros; integridade verificada antes de reuso."""
    def __init__(self, directory, offline=False, session=None, sleep=time.sleep):
        self.directory = Path(directory)
        self.directory.mkdir(parents=True, exist_ok=True)
        self.offline = offline
        self.session = session or requests.Session()
        self.session.headers.update({"User-Agent": "AgroBrasil-AGUA01/1.0 (research; cached sequential requests)"})
        self.sleep = sleep
        self.entries = []

    def fetch(self, params):
        key = sha(json.dumps({"url": API, "params": params}, sort_keys=True).encode())[:20]
        path = self.directory / f"power_{params['start']}_{params['end']}_{key}.json"
        meta_path = path.with_suffix(".meta.json")
        if path.exists() and meta_path.exists():
            raw = path.read_bytes()
            meta = strict_json(meta_path.read_bytes())
            if sha(raw) != meta["sha256"] or meta["params"] != params or meta["endpoint"] != API:
                raise ValueError(f"Cache inconsistente: {path}")
            LOG.info("Cache verificado: %s", path.name)
        else:
            if self.offline:
                raise FileNotFoundError(f"Resposta não disponível offline: {path.name}")
            for attempt in range(1, 4):
                try:
                    response = self.session.get(API, params=params, timeout=(15, 120))
                    if response.status_code == 429 or 500 <= response.status_code < 600:
                        response.raise_for_status()
                    # Erros permanentes não devem ser repetidos.
                    if response.status_code >= 400:
                        raise ValueError(f"NASA HTTP {response.status_code}: {response.text[:500]}")
                    response.raise_for_status()
                    raw = response.content
                    strict_json(raw)
                    meta = {"endpoint": API, "params": params, "url": response.url,
                            "retrieved_at_utc": datetime.now(timezone.utc).isoformat(),
                            "status": response.status_code, "sha256": sha(raw),
                            "bytes": len(raw), "headers": dict(response.headers)}
                    path.write_bytes(raw)  # Bytes originais; nenhuma reserialização.
                    write_json(meta_path, meta)
                    LOG.info("Coletado: %s (%d bytes)", path.name, len(raw))
                    self.sleep(1)
                    break
                except (requests.RequestException, json.JSONDecodeError) as exc:
                    if attempt == 3:
                        raise RuntimeError(f"Falha após 3 tentativas: {params}") from exc
                    LOG.warning("Tentativa %d falhou: %s", attempt, exc)
                    self.sleep(min(2 ** attempt, 30))
        data = strict_json(raw)
        self.entries.append({"file": path.name, **meta})
        return data


def parameters(config, start, end):
    return {"parameters": ",".join(config["parameters"]), "community": config["community"],
            "latitude": config["latitude"], "longitude": config["longitude"],
            "start": start.strftime("%Y%m%d"), "end": end.strftime("%Y%m%d"),
            "format": "JSON", "time-standard": config["time_standard"]}


def validate_response(data, config, start, end):
    """Valida contrato, não exige ausência de lacunas (estas são relatadas)."""
    header = data["header"]
    if header["time_standard"] != config["time_standard"]:
        raise ValueError("Padrão de tempo divergente")
    coords = data["geometry"]["coordinates"]
    if not (abs(coords[0] - config["longitude"]) < .001 and abs(coords[1] - config["latitude"]) < .001):
        raise ValueError("Coordenadas divergentes")
    if str(header["start"]) != start.strftime("%Y%m%d") or str(header["end"]) != end.strftime("%Y%m%d"):
        raise ValueError("Período do cabeçalho divergente")
    if not isinstance(header["fill_value"], (int, float)):
        raise ValueError("Código de ausentes inválido")
    values = data["properties"]["parameter"]
    for name in config["parameters"]:
        if name not in RULES:
            raise ValueError(f"Parâmetro sem regra: {name}")
        if data["parameters"][name]["units"] != RULES[name][0]:
            raise ValueError(f"Unidade inesperada de {name}: {data['parameters'][name]}")
        if not values[name]:
            raise ValueError(f"Parâmetro sem cobertura: {name}")
        for day in values[name]:
            dt = pd.to_datetime(day, format="%Y%m%d", errors="raise")
            if not start <= dt <= end:
                raise ValueError(f"Data fora do período: {day}")


def periods(dates):
    dates = sorted(set(pd.Timestamp(x) for x in dates))
    result = []
    for day in dates:
        if result and day == result[-1][1] + pd.Timedelta(days=1):
            result[-1][1] = day
            result[-1][2] += 1
        else:
            result.append([day, day, 1])
    return [{"start": a.strftime("%Y-%m-%d"), "end": b.strftime("%Y-%m-%d"), "days": n} for a, b, n in result]


def coverage(data):
    result = {}
    for name, values in data["properties"]["parameter"].items():
        valid = [day for day, value in values.items() if isinstance(value, (int, float))
                 and np.isfinite(value) and value != data["header"]["fill_value"]]
        if not valid:
            raise ValueError(f"Parâmetro inteiramente ausente na pré-coleta: {name}")
        result[name] = {"returned_days": len(values), "non_fill_days": len(valid),
                        "first_valid": min(valid), "last_valid": max(valid)}
    return result


def prepare(responses, config):
    frames, issues = [], []
    raw_counts = {p: 0 for p in config["parameters"]}
    for data in responses:
        values = data["properties"]["parameter"]
        frame = pd.DataFrame(values)
        frame.index = pd.to_datetime(frame.index, format="%Y%m%d")
        for p in config["parameters"]:
            raw_counts[p] += len(values[p])
            original = frame[p]
            numeric = pd.to_numeric(original, errors="coerce")
            masks = {
                "source_fill_value": numeric.eq(data["header"]["fill_value"]),
                "non_numeric_or_null": numeric.isna() & original.index.isin(pd.to_datetime(list(values[p]), format="%Y%m%d")),
                "non_finite": numeric.notna() & ~np.isfinite(numeric),
            }
            numeric = numeric.mask(masks["source_fill_value"] | masks["non_finite"])
            _, lower, upper = RULES[p]
            masks["outside_screening_range"] = numeric.notna() & ~numeric.between(lower, upper)
            for reason, mask in masks.items():
                for day in frame.index[mask]:
                    issues.append({"date": day.strftime("%Y-%m-%d"), "variable": p, "reason": reason,
                                   "original_value": str(original.loc[day])})
            frame[p] = numeric.mask(masks["outside_screening_range"])
        frames.append(frame)
    combined = pd.concat(frames).sort_index()
    duplicates = combined.index[combined.index.duplicated(keep=False)]
    if len(duplicates):
        raise ValueError(f"Datas duplicadas entre respostas: {periods(duplicates)}")
    expected = pd.date_range(config["start"], config["end"], freq="D", name="date")
    missing_dates = expected.difference(combined.index)
    if len(combined.index.difference(expected)):
        raise ValueError("Datas fora da configuração")
    clean = combined.reindex(expected)
    inconsistent = ((clean.T2M_MIN > clean.T2M) | (clean.T2M > clean.T2M_MAX) | (clean.T2M_MIN > clean.T2M_MAX))
    for day in clean.index[inconsistent]:
        for p in ("T2M_MIN", "T2M", "T2M_MAX"):
            issues.append({"date": day.strftime("%Y-%m-%d"), "variable": p,
                           "reason": "temperature_order", "original_value": str(clean.loc[day, p])})
            clean.loc[day, p] = np.nan
    quality = {"expected_records": len(expected), "source_records": len(combined),
               "processed_records": len(clean), "duplicate_dates": len(duplicates),
               "missing_dates": periods(missing_dates), "raw_values_by_variable": raw_counts,
               "available_start": None, "available_end": None, "variables": {}, "issues": issues}
    quality["source_messages"] = [message for response in responses for message in response.get("messages", [])]
    usable = clean.dropna(how="all")
    if not usable.empty:
        quality.update(available_start=usable.index.min().strftime("%Y-%m-%d"), available_end=usable.index.max().strftime("%Y-%m-%d"))
    for p in config["parameters"]:
        s = clean[p]
        stats = {k: (float(v) if pd.notna(v) else None) for k, v in s.describe().items()}
        quality["variables"][p] = {"units": RULES[p][0], "valid": int(s.count()),
            "missing": int(s.isna().sum()), "completeness_pct": round(100 * s.count() / len(s), 5),
            "missing_periods": periods(s.index[s.isna()]), "screening_range": list(RULES[p][1:]),
            "available_start": s.first_valid_index().strftime("%Y-%m-%d") if s.count() else None,
            "available_end": s.last_valid_index().strftime("%Y-%m-%d") if s.count() else None,
            "statistics": stats}
    return clean, quality


def longest_run(mask):
    longest = run = 0
    for value in mask:
        run = run + 1 if value else 0
        longest = max(longest, run)
    return longest


def rain_summary(series, freq):
    rows = []
    for label, s in series.resample(freq):
        end = label + (pd.offsets.YearEnd(0) if freq == "YS" else pd.offsets.MonthEnd(0))
        expected = len(pd.date_range(label, end))
        complete = len(s) == expected and s.notna().all()
        rows.append({"period": label.strftime("%Y-%m-%d"), "expected_days": expected,
            "valid_days": int(s.count()), "complete": bool(complete),
            "observed_sum_mm": float(s.sum(min_count=1)) if s.count() else None,
            "total_mm": float(s.sum()) if complete else None,
            "max_daily_mm": float(s.max()) if s.count() else None,
            "wet_days_ge_1mm": int((s >= 1).sum()) if complete else None,
            "longest_dry_run_lt_1mm": longest_run(s < 1) if complete else None})
    return pd.DataFrame(rows).round({"observed_sum_mm": 4, "total_mm": 4, "max_daily_mm": 4})


def make_plots(clean, annual, monthly, directory):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    directory.mkdir(parents=True, exist_ok=True)
    plt.rcParams.update({"figure.dpi": 140, "axes.spines.top": False, "axes.spines.right": False})
    fig, ax = plt.subplots(figsize=(11, 4))
    ax.bar(pd.to_datetime(annual.period).dt.year, annual.total_mm, color="#16756b")
    ax.set(xlabel="Ano (LST)", ylabel="Precipitação (mm)", title="NASA POWER • Mogi das Cruzes • acumulados anuais completos")
    fig.tight_layout(); fig.savefig(directory / "precipitacao_anual.png"); plt.close(fig)
    m = monthly.copy(); m["month"] = pd.to_datetime(m.period).dt.month
    fig, ax = plt.subplots(figsize=(10, 4))
    grouped = m.groupby("month").total_mm
    mean, std = grouped.mean(), grouped.std()
    ax.bar(mean.index, mean, yerr=std, capsize=3, color="#287fb0")
    ax.set(xticks=range(1, 13), xlabel="Mês", ylabel="Precipitação (mm)", title="Ciclo mensal 2000–2025 • média ± desvio padrão entre anos")
    fig.tight_layout(); fig.savefig(directory / "ciclo_mensal.png"); plt.close(fig)
    fig, axes = plt.subplots(4, 2, figsize=(12, 10))
    for ax, p in zip(axes.flat, clean.columns):
        ax.plot(clean.index, clean[p], linewidth=.35, color="#16756b")
        ax.set(title=p, ylabel=RULES[p][0])
    axes.flat[-1].axis("off")
    fig.suptitle("NASA POWER • séries diárias sem imputação • Mogi das Cruzes (LST)")
    fig.tight_layout(); fig.savefig(directory / "series_diarias.png"); plt.close(fig)
    fig, ax = plt.subplots(figsize=(10, 4))
    ax.hist(clean.PRECTOTCORR.dropna(), bins=60, color="#287fb0")
    ax.set(yscale="log", xlabel="Precipitação diária (mm/day)", ylabel="Número de dias (escala log)", title="Distribuição da precipitação • inclui dias sem chuva")
    fig.tight_layout(); fig.savefig(directory / "distribuicao_chuva.png"); plt.close(fig)


def report(quality, config, output):
    text = ["# AGUA-01 — qualidade NASA POWER", "", f"Extração: {quality['retrieved_at_utc']}",
        f"Ponto: {config['location']}; lat {config['latitude']}, lon {config['longitude']}; AG / diário / LST.",
        f"Solicitado: {config['start']} a {config['end']}. Disponível: {quality['available_start']} a {quality['available_end']}.",
        f"Registros da fonte: {quality['source_records']}; esperados: {quality['expected_records']}; tratados: {quality['processed_records']}.",
        f"Duplicações: {quality['duplicate_dates']}; períodos sem data: {len(quality['missing_dates'])}; ocorrências de qualidade: {len(quality['issues'])}.", "",
        "| Variável | Unidade | Válidos | Ausentes | Completude % | Mínimo | Máximo | Média | Desvio padrão |",
        "|---|---|---:|---:|---:|---:|---:|---:|---:|"]
    for p, q in quality["variables"].items():
        s = q["statistics"]
        stats = [f"{s[k]:.4f}" if s.get(k) is not None else "—" for k in ["min", "max", "mean", "std"]]
        text.append(f"| {p} | {q['units']} | {q['valid']} | {q['missing']} | {q['completeness_pct']} | " + " | ".join(stats) + " |")
    text.extend(["", f"Mensagens da API: {quality['source_messages'] or 'nenhuma'}.", "", "## Tratamento e lacunas", "",
        "Códigos fill_value do cabeçalho, valores não numéricos/não finitos, valores fora das faixas de triagem e temperatura fora de ordem são convertidos em ausentes, com valor original registrado em issues.csv. Nenhuma interpolação ou preenchimento. Datas ausentes são inseridas apenas como linhas vazias no calendário esperado.",
        "quality.json contém os períodos contíguos afetados por variável, contagens, faixas de triagem e estatísticas (incluindo quartis). As faixas são verificações amplas de plausibilidade física, não garantia de precisão local. Extremos válidos são preservados.",
        "Totais anuais/mensais oficiais neste incremento só são calculados com todos os dias válidos; observed_sum_mm identifica a soma parcial. Dia chuvoso: ≥1 mm; seco: <1 mm. Sequências secas são restritas ao período de agregação.", "",
        "## Limitações", "",
        "Dados em grade de reanálise/satélite, não observações de estação ou propriedade. Meteorologia MERRA-2 tem resolução nativa aproximada de 0,5° × 0,625°; fluxos solares dependem da fonte, com CERES SYN1deg em 1° × 1°. A geometria devolvida identifica o ponto solicitado, não os centros de todas as células. Não interpretar a grade regional 0,5° da API como resolução física de todos os produtos.",
        "A radiação troca de SRB (até 2000) para CERES (desde 2001); mudanças de produto e revisões podem afetar homogeneidade. Completude não mede exatidão. LST é horário solar por faixa de longitude, diferente de America/Sao_Paulo e de UTC; não comparar acumulados diários diretamente com estações sem alinhar as janelas.",
        "PRECTOTCORR é precipitação corrigida derivada da fonte; extremos convectivos e relevo local podem ser suavizados. WS10M refere-se a 10 m; T2M e RH2M a 2 m. Não inferir irrigação, vazão ou nível de reservatório a partir desta base.",
        "Metadados originais, versões, fontes, URLs, horários e SHA-256 estão em raw/ e provenance.json. Ver docs/fontes-comparacao.md para INMET/SP Águas e próximos passos."])
    (output / "quality.md").write_text("\n".join(text) + "\n", encoding="utf-8")


def run(config_path, output, offline=False, preflight_only=False):
    config = strict_json(config_path.read_bytes())
    if config["community"] != "AG" or config["time_standard"] != "LST" or set(config["parameters"]) != set(RULES):
        raise ValueError("Configuração AGUA-01 incompatível")
    start, end = pd.Timestamp(config["start"]), pd.Timestamp(config["end"])
    if start > end or not (-90 <= config["latitude"] <= 90 and -180 <= config["longitude"] <= 180):
        raise ValueError("Período/coordenadas inválidos")
    collector = Collector(output / "raw", offline)
    ranges = [(max(start, pd.Timestamp(year, 1, 1)), min(end, pd.Timestamp(year, 12, 31))) for year in range(start.year, end.year + 1)]
    # Primeiro e último ano verificam cobertura nas extremidades sem downloads redundantes.
    order = list(dict.fromkeys([0, len(ranges) - 1] + list(range(len(ranges)))))
    responses = {}
    for i in order:
        a, b = ranges[i]
        response = collector.fetch(parameters(config, a, b))
        validate_response(response, config, a, b)
        responses[i] = response
        if len(responses) == min(2, len(ranges)):
            check = {"config": config, "verified_years": [ranges[x][0].year for x in responses],
                     "parameters": response["parameters"], "headers": [r["header"] for r in responses.values()],
                     "coverage": {str(ranges[x][0].year): coverage(r) for x, r in responses.items()},
                     "geometry": response["geometry"], "status": "contract_verified"}
            write_json(output / "preflight.json", check)
            LOG.info("Pré-coleta validada: parâmetros, unidades, coordenadas e anos extremos")
            if preflight_only:
                return
    clean, quality = prepare(list(responses.values()), config)
    output.mkdir(parents=True, exist_ok=True)
    processed, reports = output / "processed", output / "reports"
    processed.mkdir(exist_ok=True); reports.mkdir(exist_ok=True)
    clean.to_csv(processed / "daily.csv", index_label="date", date_format="%Y-%m-%d", na_rep="", float_format="%.4f")
    annual = rain_summary(clean.PRECTOTCORR, "YS")
    monthly = rain_summary(clean.PRECTOTCORR, "MS")
    annual.to_csv(processed / "precipitation_annual.csv", index=False)
    monthly.to_csv(processed / "precipitation_monthly.csv", index=False)
    pd.DataFrame(quality["issues"], columns=["date", "variable", "reason", "original_value"]).to_csv(reports / "issues.csv", index=False)
    quality["retrieved_at_utc"] = max(e["retrieved_at_utc"] for e in collector.entries)
    write_json(reports / "quality.json", quality)
    report(quality, config, reports)
    make_plots(clean, annual, monthly, reports / "figures")
    provenance = {"config": config, "python": platform.python_version(),
        "dependencies": {p: version(p) for p in ["requests", "pandas", "numpy", "matplotlib"]},
        "responses": collector.entries,
        "source_metadata": [{k: r[k] for k in ["header", "parameters", "geometry", "messages"] if k in r} for r in responses.values()],
        "code_sha256": sha(Path(__file__).read_bytes()), "config_sha256": sha(config_path.read_bytes())}
    write_json(output / "provenance.json", provenance)
    files = [{"file": p.relative_to(output).as_posix(), "bytes": p.stat().st_size, "sha256": sha(p.read_bytes())}
             for p in sorted(output.rglob("*")) if p.is_file() and p.name != "inventory.json"]
    write_json(output / "inventory.json", files)
    LOG.info("Concluído: %d registros; %d ocorrências de qualidade", len(clean), len(quality["issues"]))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", type=Path, default=ROOT / "config.json")
    parser.add_argument("--output", type=Path, default=ROOT / "data")
    parser.add_argument("--offline", action="store_true", help="Exige respostas locais íntegras; nenhuma rede")
    parser.add_argument("--preflight-only", action="store_true")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    try:
        run(args.config, args.output, args.offline, args.preflight_only)
    except Exception:
        LOG.exception("Pipeline interrompido; não declarar esta execução concluída")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
