"""Consulta oficial de chuva diária E3-097/2000; amostra separada, sem harmonização."""
import argparse
from datetime import datetime, timezone
from html.parser import HTMLParser
import html
import re
import requests
import time
import pandas as pd

from pipeline import ROOT, sha, write_json, strict_json, periods


def parse_txt(text):
    if "ALTURAS DIÁRIAS DE CHUVA (MM)" not in text or "ANO REFERENCIA: 2000" not in text:
        raise ValueError("Contrato TXT SP Águas inesperado")
    values = {}
    for line in text.splitlines():
        cells = [x.strip() for x in line.split("|")]
        if len(cells) != 15 or not cells[1].isdigit():
            continue
        day = int(cells[1])
        for month, value in enumerate(cells[2:14], 1):
            try:
                date = pd.Timestamp(2000, month, day)
            except ValueError:
                if value:
                    raise ValueError("Valor em data impossível no TXT")
                continue
            if date in values:
                raise ValueError("Data duplicada no TXT")
            if value and not re.fullmatch(r"\d+(?:,\d+)?", value):
                raise ValueError(f"Flag não reconhecida no TXT: {value}")
            values[date] = float(value.replace(",", ".")) if value else float("nan")
    s = pd.Series(values, name="precipitation_mm").sort_index()
    if len(s) != 366:
        raise ValueError("Calendário anual incompleto no TXT")
    s.index.name = "date"
    return s


class Inputs(HTMLParser):
    def __init__(self):
        super().__init__()
        self.values = {}

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "input" and attrs.get("type") == "hidden" and attrs.get("name"):
            self.values[attrs["name"]] = attrs.get("value", "")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--offline", action="store_true")
    args = parser.parse_args()
    root = ROOT / "data/comparison"
    url = "https://ph.spaguas.sp.gov.br/Pluviometricos/Posto"
    station = "da39c05f-4d45-4aa5-8cb6-a383682e207f"
    path = root / "spaguas_E3-097_2000_daily.html"
    meta_path = path.with_suffix(".meta.json")
    if path.exists() and meta_path.exists():
        if sha(path.read_bytes()) != strict_json(meta_path.read_bytes())["sha256"]:
            raise ValueError("Amostra SP Águas corrompida")
    elif args.offline:
        raise FileNotFoundError(path)
    else:
        session = requests.Session()
        # GET novo é necessário para obter cookie/token CSRF pareados; não são persistidos em metadados.
        page = session.get(url, params={"idPosto": station}, timeout=(15, 60))
        page.raise_for_status()
        inputs = Inputs(); inputs.feed(page.text)
        payload = {**inputs.values, "Id": station, "TipoConsulta": "ChuvasDiarias", "AnoInicial": "2000", "AnoFinal": "2000", "PaginaAtual": "1"}
        response = session.post(url, data=payload, timeout=(15, 60))
        response.raise_for_status()
        path.write_bytes(response.content)
        write_json(meta_path, {"url": url, "method": "POST read-only report", "station": "E3-097",
            "year": 2000, "frequency": "daily", "retrieved_at_utc": datetime.now(timezone.utc).isoformat(),
            "sha256": sha(response.content), "bytes": len(response.content), "status": response.status_code,
            "note": "Relatório original; não integrado nem harmonizado com NASA. Janelas de acumulação e flags exigem verificação."})
    text = path.read_text(encoding="utf-8")
    match = re.search(r"downloadTXT\('([^']+)'\)", text)
    if not match:
        raise ValueError("Relatório não oferece arquivo TXT")
    download = html.unescape(match.group(1))
    txt = root / "spaguas_E3-097_2000_daily.txt"
    txt_meta = txt.with_suffix(".txt.meta.json")
    if txt.exists() and txt_meta.exists():
        if sha(txt.read_bytes()) != strict_json(txt_meta.read_bytes())["sha256"]:
            raise ValueError("TXT SP Águas corrompido")
    elif args.offline:
        raise FileNotFoundError(txt)
    else:
        for attempt in range(3):
            try:
                response = requests.get(download, timeout=(15, 60))
                response.raise_for_status()
                break
            except requests.RequestException:
                if attempt == 2:
                    raise
                time.sleep(2 ** (attempt + 1))
        txt.write_bytes(response.content)
        write_json(txt_meta, {"url": download, "retrieved_at_utc": datetime.now(timezone.utc).isoformat(),
            "sha256": sha(response.content), "bytes": len(response.content), "status": response.status_code,
            "note": "Amostra original separada; não usada para validar numericamente NASA sem harmonização."})
    print(f"Amostra oficial TXT preservada: {txt.name} ({txt.stat().st_size} bytes)")
    series = parse_txt(txt.read_text(encoding="utf-8-sig"))
    series.to_csv(root / "spaguas_E3-097_2000_daily.csv", na_rep="", date_format="%Y-%m-%d")
    write_json(root / "spaguas_sample_quality.json", {"station": "E3-097 — Estaleiro DAEE", "units": "mm",
        "latitude": -23 - 31 / 60, "longitude": -46 - 12 / 60,
        "expected_days": len(series), "valid_days": int(series.count()), "missing_days": int(series.isna().sum()),
        "missing_periods": periods(series.index[series.isna()]),
        "available_start": series.first_valid_index().strftime("%Y-%m-%d") if series.count() else None,
        "available_end": series.last_valid_index().strftime("%Y-%m-%d") if series.count() else None,
        "minimum_mm": float(series.min()), "maximum_mm": float(series.max()),
        "note": "Campos vazios preservados como ausentes. Sem validação numérica NASA: janela de leitura do pluviômetro não confirmada."})
    print(f"Amostra: {series.count()} dias válidos / {len(series)} dias; sem imputação ou comparação direta NASA.")


if __name__ == "__main__":
    main()
