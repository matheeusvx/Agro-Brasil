"""Testes offline baseados em respostas reais; corrupções só em memória/tmp_path."""
import copy
import json
from pathlib import Path
import sys
from unittest.mock import Mock

import pandas as pd
import pytest
import requests

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import pipeline as p


@pytest.fixture
def config():
    c = json.loads((p.ROOT / "config.json").read_text(encoding="utf-8"))
    c["end"] = "2000-12-31"
    return c


@pytest.fixture
def real():
    path = next((p.ROOT / "data/raw").glob("power_20000101_20001231_*.json"))
    return p.strict_json(path.read_bytes())


def test_real_leap_year_and_units(real, config):
    p.validate_response(real, config, pd.Timestamp(config["start"]), pd.Timestamp(config["end"]))
    clean, q = p.prepare([real], config)
    assert len(clean) == 366
    assert pd.Timestamp("2000-02-29") in clean.index
    assert q["duplicate_dates"] == 0
    assert q["variables"]["ALLSKY_SFC_SW_DWN"]["units"] == "MJ/m^2/day"
    assert clean.notna().all().all()


@pytest.mark.parametrize("mutation, message", [
    (lambda r: r["parameters"]["T2M"].update(units="K"), "Unidade"),
    (lambda r: r["header"].update(time_standard="UTC"), "Padrão"),
    (lambda r: r["geometry"].update(coordinates=[0, 0, 0]), "Coordenadas"),
    (lambda r: r["header"].update(end="20010101"), "Período"),
])
def test_contract_rejects_mismatch(real, config, mutation, message):
    mutation(real)
    with pytest.raises(ValueError, match=message):
        p.validate_response(real, config, pd.Timestamp(config["start"]), pd.Timestamp(config["end"]))


def test_missing_invalid_and_temperature_order_are_audited(real, config):
    v = real["properties"]["parameter"]
    v["PRECTOTCORR"]["20000101"] = -999
    v["RH2M"]["20000102"] = 101
    v["WS10M"]["20000103"] = "invalid"
    v["ALLSKY_SFC_SW_DWN"]["20000104"] = float("inf")
    v["T2M_MIN"]["20000105"] = 50
    for values in v.values():
        del values["20000229"]
    del v["RH2M"]["20000301"]
    clean, q = p.prepare([real], config)
    assert clean.loc["2000-02-29"].isna().all()
    assert pd.isna(clean.loc["2000-03-01", "RH2M"])
    assert q["missing_dates"] == [{"start": "2000-02-29", "end": "2000-02-29", "days": 1}]
    assert q["variables"]["RH2M"]["missing"] == 3
    assert {i["reason"] for i in q["issues"]} == {"source_fill_value", "outside_screening_range", "non_numeric_or_null", "non_finite", "temperature_order"}
    assert len(q["issues"]) == 7
    assert pd.isna(p.rain_summary(clean.PRECTOTCORR, "YS").iloc[0].total_mm)
    assert pd.isna(p.rain_summary(clean.PRECTOTCORR, "YS").iloc[0].wet_days_ge_1mm)


def test_duplicate_dates_fail(real, config):
    with pytest.raises(ValueError, match="duplicadas"):
        p.prepare([real, copy.deepcopy(real)], config)


def test_duplicate_json_keys_fail():
    with pytest.raises(ValueError, match="duplicada"):
        p.strict_json('{"date": 1, "date": 2}')


def test_complete_rain_aggregation(real, config):
    clean, _ = p.prepare([real], config)
    annual = p.rain_summary(clean.PRECTOTCORR, "YS").iloc[0]
    assert annual.complete
    assert annual.total_mm == pytest.approx(clean.PRECTOTCORR.sum())
    assert annual.wet_days_ge_1mm == (clean.PRECTOTCORR >= 1).sum()
    assert p.rain_summary(clean.PRECTOTCORR, "MS").total_mm.sum() == pytest.approx(annual.total_mm)


def test_contiguous_missing_periods():
    assert p.periods(pd.to_datetime(["2000-01-01", "2000-01-02", "2000-01-04"])) == [
        {"start": "2000-01-01", "end": "2000-01-02", "days": 2},
        {"start": "2000-01-04", "end": "2000-01-04", "days": 1}]


def test_cache_reuse_and_tamper_detection(tmp_path, real, config):
    session = Mock(headers={})
    response = Mock(status_code=200, content=json.dumps(real).encode(), url=p.API, headers={})
    session.get.return_value = response
    params = p.parameters(config, pd.Timestamp(config["start"]), pd.Timestamp(config["end"]))
    collector = p.Collector(tmp_path, session=session, sleep=lambda _: None)
    collector.fetch(params)
    collector.fetch(params)
    session.get.assert_called_once_with(p.API, params=params, timeout=(15, 120))
    offline = p.Collector(tmp_path, offline=True, session=session)
    assert offline.fetch(params) == real
    next(tmp_path.glob("power_*.json")).write_bytes(b"corrupted")
    with pytest.raises(ValueError):
        offline.fetch(params)


def test_bounded_retry_and_no_retry_permanent_error(tmp_path, config):
    params = p.parameters(config, pd.Timestamp(config["start"]), pd.Timestamp(config["end"]))
    session = Mock(headers={})
    session.get.side_effect = requests.Timeout("timeout")
    with pytest.raises(RuntimeError, match="3 tentativas"):
        p.Collector(tmp_path, session=session, sleep=lambda _: None).fetch(params)
    assert session.get.call_count == 3
    session.get.reset_mock(side_effect=True)
    session.get.return_value = Mock(status_code=422, text="invalid request")
    with pytest.raises(ValueError, match="422"):
        p.Collector(tmp_path, session=session, sleep=lambda _: None).fetch(params)
    assert session.get.call_count == 1
    with pytest.raises(FileNotFoundError):
        p.Collector(tmp_path, offline=True).fetch(params)


def test_full_real_delivery_integrity():
    root = p.ROOT / "data"
    inventory = json.loads((root / "inventory.json").read_text(encoding="utf-8"))
    for item in inventory:
        data = (root / item["file"]).read_bytes()
        assert len(data) == item["bytes"]
        assert p.sha(data) == item["sha256"]
    daily = pd.read_csv(root / "processed/daily.csv", parse_dates=["date"])
    assert len(daily) == 9497
    assert not daily.date.duplicated().any()
    assert daily.date.tolist() == list(pd.date_range("2000-01-01", "2025-12-31"))
    assert daily.drop(columns="date").notna().all().all()
    assert len(pd.read_csv(root / "processed/precipitation_monthly.csv")) == 312
    config = p.strict_json((p.ROOT / "config.json").read_bytes())
    responses = [p.strict_json(path.read_bytes()) for path in (root / "raw").glob("power_*.json") if not path.name.endswith(".meta.json")]
    expected, _ = p.prepare(responses, config)
    actual = daily.set_index("date")
    pd.testing.assert_frame_equal(actual, expected, check_freq=False, atol=1e-10, rtol=0)


def test_real_spaguas_sample_preserves_blanks():
    from sample_spaguas import parse_txt
    s = parse_txt((p.ROOT / "data/comparison/spaguas_E3-097_2000_daily.txt").read_text(encoding="utf-8-sig"))
    assert len(s) == 366
    assert s.count() == 184
    assert s.loc["2000-03-30"] == 70.1
    assert pd.isna(s.loc["2000-01-01"])
    assert s.loc["2000-07-01"] == 0


def test_preflight_rejects_all_missing(real):
    real["properties"]["parameter"]["RH2M"] = {k: -999 for k in real["properties"]["parameter"]["RH2M"]}
    with pytest.raises(ValueError, match="inteiramente ausente"):
        p.coverage(real)


@pytest.mark.parametrize("status", [429, 500, 503])
def test_transient_http_retries_then_recovers(tmp_path, real, config, status):
    params = p.parameters(config, pd.Timestamp(config["start"]), pd.Timestamp(config["end"]))
    failed = requests.Response(); failed.status_code = status
    success = requests.Response(); success.status_code = 200
    success._content = json.dumps(real).encode(); success.url = p.API
    session = Mock(headers={})
    session.get.side_effect = [failed, success]
    assert p.Collector(tmp_path, session=session, sleep=lambda _: None).fetch(params) == real
    assert session.get.call_count == 2
