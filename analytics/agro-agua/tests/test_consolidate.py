"""AGUA-04: referências exclusivas do treino e síntese sem novos modelos."""
import copy
import json
from pathlib import Path
import sys
import numpy as np
import pandas as pd
import pytest
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import consolidate as c


@pytest.fixture(scope="module")
def daily():
    return pd.read_csv(c.ROOT / "data/processed/daily.csv", index_col="date", parse_dates=["date"])


def test_reference_ignores_future(daily):
    bounds, ref = c.thresholds(daily)
    changed = daily.copy(); changed.loc["2020-01-01":] *= 2
    bounds2, ref2 = c.thresholds(changed)
    pd.testing.assert_frame_equal(bounds, bounds2)
    pd.testing.assert_frame_equal(ref, ref2)
    assert len(bounds) == 48
    assert bounds.groupby("indicator").n.sum().to_dict() == {"rain_7d": 7299, "rain_30d": 7276, "low_run": 7305, "monthly_rain": 240}


def test_training_quantiles_match_formula(daily):
    bounds, _ = c.thresholds(daily)
    r30 = daily.loc[:"2019-12-31", "PRECTOTCORR"].rolling(30, min_periods=30).sum()
    b = bounds.loc[bounds.indicator.eq("rain_30d") & bounds.calendar_month.eq(12)].iloc[0]
    assert b.q10 == pytest.approx(r30.loc[r30.index.month == 12].quantile(.1))
    assert b.q10 == pytest.approx(111.42)


def test_level_boundaries_ties_and_missing():
    b = {"q10": 10, "q25": 25, "q75": 75, "q90": 90}
    assert [c.classify(v, b) for v in [9, 10, 25, 75, 90, 91]] == ["abaixo_q10", "entre_q10_q25", "entre_q25_q75", "entre_q25_q75", "entre_q75_q90", "acima_q90"]
    assert c.classify(None, b) == c.classify(np.nan, b) == "indisponivel"
    assert c.classify(0, dict.fromkeys(b, 0)) == "entre_q25_q75"
    assert c.classify(0, b, True) == "sem_sequencia"
    assert c.classify(90, b, True) == "duracao_acima_q75"
    assert c.classify(91, b, True) == "duracao_acima_q90"


def test_contract_real_archived_values():
    contract = json.loads((c.OUT / "integration-example.json").read_text(encoding="utf-8"))
    c.validate_contract(contract)
    items = {r["id"]: r for r in contract["indicators"]}
    assert items["rain_7d"]["value"] == pytest.approx(24.22)
    assert items["rain_30d"]["value"] == pytest.approx(86.5)
    assert items["low_run"]["value"] == 0
    row = pd.read_csv(c.ROOT / "outputs/agua03/test_predictions.csv").iloc[-1]
    estimate = items["ridge_archived_next7"]
    assert estimate["value"] == row.ridge
    assert estimate["classification"] == "experimental"
    assert estimate["informative_level"] is None
    assert estimate["target_period"]["start"] == "2025-12-25"
    assert all(not r["decision_authorized"] for r in items.values())


@pytest.mark.parametrize("mutation", ["infinite", "missing", "operational", "forecast_level", "bad_horizon"])
def test_contract_rejects_inconsistent_claims(mutation):
    contract = json.loads((c.OUT / "integration-example.json").read_text(encoding="utf-8"))
    if mutation == "infinite": contract["indicators"][0]["value"] = float("inf")
    if mutation == "missing": del contract["indicators"][0]["limitations"]
    if mutation == "operational": contract["indicators"][0]["decision_authorized"] = True
    if mutation == "forecast_level": contract["indicators"][-1]["informative_level"] = "acima_q90"
    if mutation == "bad_horizon": contract["indicators"][-1]["target_period"]["end"] = "2026-01-01"
    with pytest.raises(ValueError): c.validate_contract(contract)


def test_consolidation_offline_without_fit_predict_or_test_opening(tmp_path, monkeypatch):
    import socket
    import ml
    import joblib
    from sklearn.linear_model import Ridge
    from sklearn.ensemble import HistGradientBoostingRegressor
    def forbidden(*args, **kwargs):
        raise AssertionError("AGUA-04 não pode treinar, prever, carregar modelo, abrir teste ou usar rede")
    for obj, name in [(socket.socket,"connect"), (Ridge,"fit"), (HistGradientBoostingRegressor,"fit"), (joblib,"load"), (ml,"train"), (ml,"evaluate"), (ml,"predict")]:
        monkeypatch.setattr(obj, name, forbidden)
    prior = {p: c.src.sha(p.read_bytes()) for d in [c.ROOT / "data", c.ROOT / "outputs/agua02", c.ROOT / "outputs/agua03"] for p in d.rglob("*") if p.is_file()}
    c.run(tmp_path / "out")
    for name in ["thresholds.csv", "historical_indicators.csv", "monthly_indicators.csv", "training_monthly_reference.csv"]:
        assert (tmp_path / "out" / name).read_bytes() == (c.OUT / name).read_bytes()
    assert all(c.src.sha(p.read_bytes()) == digest for p, digest in prior.items())


def test_output_preservation():
    for directory in ["data", "outputs/agua02", "outputs/agua03"]:
        with pytest.raises(ValueError): c.run(c.ROOT / directory)


def test_delivery_manifest_and_pdf_exists():
    assert c.verify_inventory(c.OUT) >= 8
    assert (c.OUT / "output/pdf/sintese-executiva.pdf").read_bytes().startswith(b"%PDF")
    assert (c.OUT / "output/pdf/sintese-executiva.png").is_file()
