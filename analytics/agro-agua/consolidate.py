"""AGUA-04: consolidação local, somente leitura dos experimentos anteriores."""
from __future__ import annotations
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import numpy as np
import pandas as pd
import eda
import pipeline as src

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "outputs/agua04"
LIMITATIONS = ["Produto meteorológico regional em grade; não mede umidade do solo, água de propriedade ou reservatórios.",
    "LST difere de UTC/fuso civil; sem validação externa com janela alinhada.",
    "NASA tem latência e revisões; observação final histórica não comprova disponibilidade na data original.",
    "Níveis estatísticos exploratórios, sem validação de danos, decisões de manejo ou risco agrícola."]


def verify_inventory(directory):
    items = src.strict_json((directory / "inventory.json").read_bytes())
    for item in items:
        path = (directory / item["file"]).resolve()
        if not path.is_relative_to(directory.resolve()):
            raise ValueError("Caminho inválido")
        blob = path.read_bytes()
        if len(blob) != item["bytes"] or src.sha(blob) != item["sha256"]:
            raise ValueError(f"Integridade: {path}")
    return len(items)


def thresholds(daily):
    """Nenhum valor posterior a 2019 participa das referências."""
    train = daily.loc["2000-01-01":"2019-12-31"]
    series = {"rain_7d": train.PRECTOTCORR.rolling(7, min_periods=7).sum(),
              "rain_30d": train.PRECTOTCORR.rolling(30, min_periods=30).sum(),
              "low_run": eda.running_low(train.PRECTOTCORR)}
    rows = []
    for name, s in series.items():
        for month, values in s.groupby(s.index.month):
            values = values.dropna()
            row = {"indicator": name, "calendar_month": month, "n": len(values),
                "unit": "days" if name == "low_run" else "mm", "reference_start": "2000-01-01", "reference_end": "2019-12-31"}
            row.update({f"q{int(q*100)}": float(values.quantile(q, interpolation="linear")) for q in [.1, .25, .75, .9]})
            rows.append(row)
    monthly = eda.aggregate(train, "MS")
    monthly_ref, _, _ = eda.reference_tables(train, monthly, eda.aggregate(train, "YS"))
    for month, values in monthly.rain_total_mm.groupby(monthly.index.month):
        row = {"indicator": "monthly_rain", "calendar_month": month, "n": int(values.count()), "unit": "mm",
               "reference_start": "2000-01-01", "reference_end": "2019-12-31"}
        row.update({f"q{int(q*100)}": float(values.quantile(q, interpolation="linear")) for q in [.1, .25, .75, .9]})
        rows.append(row)
    return pd.DataFrame(rows), monthly_ref


def classify(value, bounds, streak=False):
    if value is None or not np.isfinite(value):
        return "indisponivel"
    if streak:
        if value == 0:
            return "sem_sequencia"
        if value > bounds["q90"]:
            return "duracao_acima_q90"
        if value > bounds["q75"]:
            return "duracao_acima_q75"
        return "duracao_ate_q75"
    if value < bounds["q10"]:
        return "abaixo_q10"
    if value < bounds["q25"]:
        return "entre_q10_q25"
    if value <= bounds["q75"]:
        return "entre_q25_q75"
    if value <= bounds["q90"]:
        return "entre_q75_q90"
    return "acima_q90"


def validate_contract(contract):
    if contract["schema_version"] != "agua04-1.0":
        raise ValueError("Versão inválida")
    identifiers = []
    for r in contract["indicators"]:
        for field in ["id", "name", "description", "value", "unit", "municipality", "reference_coordinates", "observed_period", "source", "source_updated_at_utc", "quality", "limitations", "classification", "nature", "operational_availability", "informative_level"]:
            if field not in r:
                raise ValueError(f"Campo obrigatório: {field}")
        identifiers.append(r["id"])
        if r["classification"] not in ["historico", "informativo", "experimental"]:
            raise ValueError("Classificação inválida")
        if r["nature"] not in ["historical_observation", "climate_anomaly", "historical_reference", "experimental_estimate"]:
            raise ValueError("Natureza inválida")
        if r["unit"] not in ["mm", "days", "%", "1"]:
            raise ValueError("Unidade inválida")
        coords = r["reference_coordinates"]
        if not (-90 <= coords["latitude"] <= 90 and -180 <= coords["longitude"] <= 180):
            raise ValueError("Coordenadas inválidas")
        if pd.Timestamp(r["source_updated_at_utc"]).tzinfo is None:
            raise ValueError("Atualização exige timezone")
        if r["value"] is not None and (not isinstance(r["value"], (int, float)) or not np.isfinite(r["value"])):
            raise ValueError("Valor deve ser finito ou null")
        if r["value"] is None and r["quality"]["status"] != "indisponivel":
            raise ValueError("Ausente exige status indisponível")
        period = r["observed_period"]
        if pd.Timestamp(period["start"]) > pd.Timestamp(period["end"]) or period["time_standard"] != "LST":
            raise ValueError("Período inválido")
        if r["operational_availability"] != "retrospectivo_sem_servico" or r["decision_authorized"] is not False:
            raise ValueError("Contrato não autoriza operação/decisão")
        if r["classification"] == "experimental" and (r["informative_level"] is not None or "target_period" not in r):
            raise ValueError("Estimativa experimental exige alvo e não recebe nível estatístico histórico")
        if r["classification"] == "experimental":
            origin = pd.Timestamp(r["origin_date"])
            if pd.Timestamp(period["end"]) > origin or pd.Timestamp(r["target_period"]["start"]) != origin + pd.Timedelta(days=1) or pd.Timestamp(r["target_period"]["end"]) != origin + pd.Timedelta(days=7):
                raise ValueError("Origem, histórico e horizonte incompatíveis")
    if len(identifiers) != len(set(identifiers)):
        raise ValueError("IDs duplicados")


def run(output=OUT):
    output = Path(output)
    if any(output.resolve().is_relative_to((ROOT / p).resolve()) for p in ["data", "outputs/agua02", "outputs/agua03"]):
        raise ValueError("Preservar entregas anteriores")
    daily, audit = eda.audit_inputs()
    previous = {stage: verify_inventory(ROOT / "outputs" / stage) for stage in ["agua02", "agua03"]}
    bounds, ref = thresholds(daily)
    monthly = eda.aggregate(daily, "MS")
    anomalies = eda.anomalies(monthly, ref)
    values = pd.DataFrame(index=daily.index)
    values.index.name = "date"
    values["rain_7d_mm"] = daily.PRECTOTCORR.rolling(7, min_periods=7).sum()
    values["rain_30d_mm"] = daily.PRECTOTCORR.rolling(30, min_periods=30).sum()
    values["low_run_days"] = eda.running_low(daily.PRECTOTCORR)
    for indicator, col in [("rain_7d", "rain_7d_mm"), ("rain_30d", "rain_30d_mm"), ("low_run", "low_run_days")]:
        by_month = bounds.loc[bounds.indicator.eq(indicator)].set_index("calendar_month")
        values[indicator + "_level"] = [classify(value, by_month.loc[day.month], indicator == "low_run") for day, value in values[col].items()]
    archived = pd.read_csv(ROOT / "outputs/agua03/test_predictions.csv", parse_dates=["date"])
    frozen = src.strict_json((ROOT / "outputs/agua03/frozen.json").read_bytes())
    metrics = pd.read_csv(ROOT / "outputs/agua03/metrics.csv")
    recorded = metrics.loc[metrics.block.eq("test") & metrics.group.eq("all") & metrics.method.eq("ridge")].iloc[0]
    high = metrics.loc[metrics.block.eq("test") & metrics.group.eq("high_gt_train_q90") & metrics.method.eq("ridge")].iloc[0]
    if not np.isclose(recorded.mae_mm, 14.244646938105, atol=.00001) or not np.isclose(recorded.gain_mae_pct, 9.883573, atol=.00001):
        raise ValueError("Métricas arquivadas divergentes")
    provenance = src.strict_json((ROOT / "data/provenance.json").read_bytes())
    source_updated = max(r["retrieved_at_utc"] for r in provenance["responses"])
    items = []
    def item(id, name, description, value, unit, start, end, nature, level=None, **extra):
        r = {"id": id, "name": name, "description": description, "value": float(value) if pd.notna(value) else None, "unit": unit,
            "municipality": {"name": "Mogi das Cruzes", "state": "SP", "ibge_code": "3530607"},
            "reference_coordinates": {"latitude": -23.52, "longitude": -46.19, "role": "sede_municipal_referencia"},
            "observed_period": {"start": start, "end": end, "time_standard": "LST"},
            "source": {"name": "NASA POWER", "community": "AG", "frequency": "daily", "url": "https://power.larc.nasa.gov/docs/services/api/temporal/daily/", "daily_sha256": audit["input_hashes"]["data/processed/daily.csv"]},
            "source_updated_at_utc": source_updated, "quality": {"status": "completo_no_periodo", "dataset_completeness_pct": 100, "external_validation": "nao_realizada", "imputation": False},
            "limitations": LIMITATIONS, "classification": {"historical_observation": "historico", "climate_anomaly": "informativo", "historical_reference": "informativo", "experimental_estimate": "experimental"}[nature],
            "nature": nature, "operational_availability": "retrospectivo_sem_servico", "decision_authorized": False, "informative_level": level, **extra}
        items.append(r)
    last = values.iloc[-1]; end = str(values.index[-1].date())
    for width in [7, 30]:
        b = bounds.loc[bounds.indicator.eq(f"rain_{width}d") & bounds.calendar_month.eq(12)].iloc[0]
        item(f"rain_{width}d", f"Precipitação acumulada de {width} dias", "Soma retrospectiva incluindo o último dia LST; não é previsão.", last[f"rain_{width}d_mm"], "mm",
            str((values.index[-1]-pd.Timedelta(days=width-1)).date()), end, "historical_observation", last[f"rain_{width}d_level"], reference_period={"start": "2000-01-01", "end": "2019-12-31"}, threshold_reference=f"thresholds.csv:rain_{width}d:12")
    item("low_run", "Dias consecutivos de baixa precipitação", "Número de dias P<1 mm/dia terminando no último dia, sem antecipar o fim do evento.", last.low_run_days, "days", "2000-01-01", end,
        "historical_observation", last.low_run_level, threshold_reference="thresholds.csv:low_run:12", reference_period={"start": "2000-01-01", "end": "2019-12-31"})
    month = anomalies.iloc[-1]
    b = bounds.loc[bounds.indicator.eq("monthly_rain") & bounds.calendar_month.eq(12)].iloc[0]
    item("monthly_rain", "Precipitação do mês encerrado", "Total de dezembro/2025, todos os dias presentes.", month.rain_total_mm, "mm", "2025-12-01", end, "historical_observation", classify(month.rain_total_mm, b), threshold_reference="thresholds.csv:monthly_rain:12")
    for suffix, col, unit in [("absolute", "rain_anomaly_mm", "mm"), ("relative", "rain_anomaly_percent", "%"), ("standardized", "rain_anomaly_z", "1")]:
        item("monthly_anomaly_"+suffix, "Anomalia mensal de precipitação", "Comparação descritiva de dezembro/2025 com dezembro/2000-2019; não é SPI ou alerta oficial.", month[col], unit,
            "2025-12-01", end, "climate_anomaly", reference_period={"start": "2000-01-01", "end": "2019-12-31"}, related_level_indicator="monthly_rain")
    item("monthly_seasonal_reference", "Média histórica de dezembro", "Média dos 20 totais completos de dezembro no treino; não é normal oficial de 30 anos.", ref.loc[12, "rain_mean_mm"], "mm", "2000-01-01", "2019-12-31", "historical_reference", sample_years=20)
    row = archived.iloc[-1]; origin = row.date
    item("ridge_archived_next7", "Estimativa experimental Ridge arquivada", "Estimativa já calculada no AGUA-03, reapresentada sem nova inferência; alvo de sete dias após a origem.", row.ridge, "mm", "2000-01-01", str(origin.date()), "experimental_estimate",
        origin_date=str(origin.date()), target_period={"start": str((origin+pd.Timedelta(days=1)).date()), "end": str((origin+pd.Timedelta(days=7)).date()), "time_standard": "LST"},
        archived_prediction_file="outputs/agua03/test_predictions.csv", model_frozen_at_utc=frozen["frozen_at_utc"],
        model_evaluation={"mae_mm": float(recorded.mae_mm), "r2": float(recorded.r2), "gain_mae_pct": float(recorded.gain_mae_pct), "high_rain_gain_mae_pct": float(high.gain_mae_pct), "individual_prediction_interval": None})
    contract = {"schema_version": "agua04-1.0", "purpose": "snapshot_academico_retrospectivo_sem_endpoint", "data_as_of": "2025-12-31", "generated_at_utc": datetime.now(timezone.utc).isoformat(), "indicators": items}
    validate_contract(contract)
    output.mkdir(parents=True, exist_ok=True)
    bounds.to_csv(output / "thresholds.csv", index=False, float_format="%.10f")
    values.to_csv(output / "historical_indicators.csv", date_format="%Y-%m-%d", float_format="%.8f", na_rep="")
    anomalies.to_csv(output / "monthly_indicators.csv", date_format="%Y-%m-%d", float_format="%.8f", na_rep="")
    ref.to_csv(output / "training_monthly_reference.csv", float_format="%.10f")
    src.write_json(output / "integration-example.json", contract)
    src.write_json(output / "audit.json", {"previous_verified_files": {"agua01": audit["inventory_files_verified"], **previous}, "no_fit": True, "no_predict": True, "no_test_opening": True,
        "reference_period": ["2000-01-01", "2019-12-31"], "source_updated_at_utc": source_updated, "inputs": audit["input_hashes"],
        "code_sha256": src.sha(Path(__file__).read_bytes()), "previous_inventory_sha256": {s: src.sha((ROOT / "outputs" / s / "inventory.json").read_bytes()) for s in previous}})
    inventory(output)
    print(f"AGUA-04: {len(values)} dias, {len(bounds)} referências mensais, {len(items)} itens de contrato; sem fit/predict.")


def inventory(out=OUT):
    out = Path(out)
    src.write_json(out / "inventory.json", [{"file": p.relative_to(out).as_posix(), "bytes": p.stat().st_size, "sha256": src.sha(p.read_bytes())}
        for p in sorted(out.rglob("*")) if p.is_file() and p.name != "inventory.json"])


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=OUT)
    parser.add_argument("--inventory-only", action="store_true")
    args = parser.parse_args()
    inventory(args.output) if args.inventory_only else run(args.output)
