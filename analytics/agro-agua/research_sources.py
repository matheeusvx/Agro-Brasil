"""Coleta opcional de catálogos oficiais, separada da base NASA (sem mescla)."""
from datetime import datetime, timezone
import argparse
import html
import json
import math
from pathlib import Path
import re
import time

import pandas as pd
import requests

from pipeline import ROOT, sha, strict_json, write_json

URLS = {
    "inmet_catalog.json": "https://apitempo.inmet.gov.br/estacoes/T",
    "spaguas_pluviometricos.html": "https://ph.spaguas.sp.gov.br/Pluviometricos",
    "spaguas_estaleiro.html": "https://ph.spaguas.sp.gov.br/Pluviometricos/Posto?idPosto=da39c05f-4d45-4aa5-8cb6-a383682e207f",
}


def distance(lat, lon, target_lat=-23.52, target_lon=-46.19):
    a, b = math.radians(lat), math.radians(target_lat)
    dlat, dlon = a-b, math.radians(lon-target_lon)
    h = math.sin(dlat/2)**2 + math.cos(a)*math.cos(b)*math.sin(dlon/2)**2
    return 6371.0088 * 2 * math.asin(min(1, math.sqrt(h)))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--offline", action="store_true")
    args = parser.parse_args()
    root = ROOT / "data/comparison"
    root.mkdir(parents=True, exist_ok=True)
    for name, url in URLS.items():
        path, meta_path = root / name, root / (name + ".meta.json")
        if path.exists() and meta_path.exists():
            meta = strict_json(meta_path.read_bytes())
            if meta["url"] != url or sha(path.read_bytes()) != meta["sha256"]:
                raise ValueError(f"Cache inválido: {name}")
            continue
        if args.offline:
            raise FileNotFoundError(name)
        for attempt in range(3):
            try:
                r = requests.get(url, timeout=(15, 60))
                r.raise_for_status()
                break
            except requests.RequestException:
                if attempt == 2:
                    raise
                time.sleep(2 ** (attempt + 1))
        path.write_bytes(r.content)
        write_json(meta_path, {"url": url, "retrieved_at_utc": datetime.now(timezone.utc).isoformat(),
            "sha256": sha(r.content), "bytes": len(r.content), "status": r.status_code})
    stations = strict_json((root / "inmet_catalog.json").read_bytes())
    rows = []
    for s in stations:
        if s.get("SG_ESTADO") == "SP" and s.get("VL_LATITUDE") and s.get("VL_LONGITUDE"):
            rows.append({**s, "distance_km_from_nasa_point": round(distance(float(s["VL_LATITUDE"]), float(s["VL_LONGITUDE"])), 3)})
    pd.DataFrame(rows).sort_values("distance_km_from_nasa_point").head(10).to_csv(root / "inmet_nearest_stations.csv", index=False)
    text = (root / "spaguas_pluviometricos.html").read_text(encoding="utf-8")
    cards = re.split(r'<div class="c-cards--item js-card', text)[1:]
    local = []
    for card in cards:
        if not re.search(r'nomeMunicipio">\s*MO[ GJ]*I DAS CRUZES', card):
            continue
        fields = {}
        for field in ["nomePosto", "nomeUgrhi", "prefixoPosto", "nomeMunicipio", "latitude", "longitude"]:
            match = re.search(r'class="[^"]*\b' + field + r'"[^>]*>(.*?)<', card, re.S)
            fields[field] = html.unescape(match.group(1)).strip() if match else None
        local.append(fields)
    if not local:
        raise ValueError("Não foi possível identificar postos locais no catálogo SP Águas")
    write_json(root / "spaguas_mogi_stations.json", local)
    print(f"Catálogo INMET: {len(stations)} estações; SP Águas: {len(local)} postos em Mogi. Sem séries misturadas.")


if __name__ == "__main__":
    main()
