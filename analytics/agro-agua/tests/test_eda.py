"""AGUA-02: calendário, fórmulas, integridade e proteção contra vazamento temporal."""
import json
from pathlib import Path
import sys

import numpy as np
import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import eda as e
import pipeline as p


@pytest.fixture(scope="module")
def daily():
    return pd.read_csv(e.ROOT / "data/processed/daily.csv", parse_dates=["date"], index_col="date")


@pytest.fixture(scope="module")
def refs(daily):
    return e.reference_tables(daily, e.aggregate(daily, "MS"), e.aggregate(daily, "YS"))


def test_audit_offline_and_original_integrity(monkeypatch):
    import socket
    def forbidden(*args, **kwargs):
        raise AssertionError("A auditoria não pode acessar rede")
    monkeypatch.setattr(socket, "create_connection", forbidden)
    daily, audit = e.audit_inputs()
    assert len(daily) == 9497
    assert audit["inventory_files_verified"] == 78
    assert audit["station"]["valid_days"] == 184
    assert not audit["station"]["daily_comparison_performed"]
    assert audit["station"]["distance_from_nasa_point_km"] < 2


def test_target_excludes_present_and_requires_seven_real_days(daily):
    s = daily.PRECTOTCORR
    y = e.forward_rain(s)
    assert y.iloc[0] == pytest.approx(s.iloc[1:8].sum())
    assert y.loc["2000-02-24"] == pytest.approx(s.loc["2000-02-25":"2000-03-02"].sum())
    assert y.iloc[-7:].isna().all()
    changed = s.copy(); changed.iloc[0] += 100
    assert e.forward_rain(changed).iloc[0] == y.iloc[0]
    changed.iloc[3] = np.nan
    assert pd.isna(e.forward_rain(changed).iloc[0])


def test_reference_is_invariant_to_future(daily, refs):
    changed = daily.copy()
    changed.loc["2020-01-01":] *= 2  # Mutação apenas em memória, nunca uma base de entrega.
    new_refs = e.reference_tables(changed, e.aggregate(changed, "MS"), e.aggregate(changed, "YS"))
    for old, new in zip(refs, new_refs):
        pd.testing.assert_frame_equal(old, new)


@pytest.mark.parametrize("lag,expected_train", [(0, 7269), (2, 7267), (7, 7262)])
def test_purged_splits_and_feature_cutoff(daily, refs, lag, expected_train):
    design, features = e.prediction_design(daily, refs[1], lag)
    assert len(design.loc[design.eligible & design.block.eq("train")]) == expected_train
    for block, (a, b) in e.BLOCKS.items():
        eligible = design.loc[design.eligible & design.block.eq(block)]
        assert (eligible.target_start >= a).all()
        assert (eligible.target_end <= b).all()
        assert (eligible.feature_cutoff <= eligible.index).all()
        if block != "train":
            assert len(eligible) == 1089
    assert not design.loc["2019-12-25":"2019-12-31", "eligible"].any()
    assert not design.loc["2022-12-25":"2022-12-31", "eligible"].any()
    assert design.loc[:"2019-12-31", "climatology_next7_mm"].isna().all()
    assert "target_next7_mm" not in features
    assert "climatology_next7_mm" not in features
    assert design.loc["2020-01-01", "past_rain_7d_mm"] == pytest.approx(daily.PRECTOTCORR.loc[pd.Timestamp("2020-01-01") - pd.Timedelta(days=lag + 6):pd.Timestamp("2020-01-01") - pd.Timedelta(days=lag)].sum())


@pytest.mark.parametrize("lag", [0, 2, 7])
def test_future_meteorology_cannot_change_features_or_baseline(daily, refs, lag):
    origin = pd.Timestamp("2021-06-15")
    changed = daily.copy(); changed.loc[origin + pd.Timedelta(days=1):] *= 2
    old, columns = e.prediction_design(daily, refs[1], lag)
    new, _ = e.prediction_design(changed, refs[1], lag)
    pd.testing.assert_series_equal(old.loc[origin, columns], new.loc[origin, columns])
    assert old.loc[origin, "climatology_next7_mm"] == new.loc[origin, "climatology_next7_mm"]
    assert new.loc[origin, "target_next7_mm"] == pytest.approx(2 * old.loc[origin, "target_next7_mm"])


def test_climatology_handles_month_crossing_without_future_weather(daily, refs):
    idx = pd.DatetimeIndex(["2020-01-29", "2020-02-25", "2020-12-29"])
    result = e.climatology_baseline(idx, refs[1])
    for day in idx:
        days = pd.date_range(day + pd.Timedelta(days=1), periods=7)
        expected = sum(refs[1].loc[d.month, "PRECTOTCORR"] for d in days)
        assert result.loc[day] == pytest.approx(expected)


def test_anomalies_fit_only_training_month_and_ddof1(daily, refs):
    monthly = e.aggregate(daily, "MS")
    a = e.anomalies(monthly, refs[0])
    january = monthly.loc[(monthly.index <= e.REFERENCE_END) & (monthly.index.month == 1), "rain_total_mm"]
    assert refs[0].loc[1, "rain_std_mm"] == pytest.approx(january.std(ddof=1))
    value = monthly.loc["2020-01-01", "rain_total_mm"]
    assert a.loc["2020-01-01", "rain_anomaly_mm"] == pytest.approx(value - january.mean())
    assert a.loc["2020-01-01", "rain_anomaly_z"] == pytest.approx((value - january.mean()) / january.std(ddof=1))


def test_rolls_and_period_totals_do_not_treat_missing_as_zero(daily):
    changed = daily.copy(); changed.loc["2000-01-04", "PRECTOTCORR"] = np.nan
    monthly = e.aggregate(changed, "MS")
    assert pd.isna(monthly.iloc[0].rain_total_mm)
    assert pd.isna(changed.PRECTOTCORR.rolling(7, min_periods=7).sum().iloc[6])
    assert daily.PRECTOTCORR.rolling(30, min_periods=30).sum().iloc[:29].isna().all()


def test_real_spell_length_and_missing_censoring(daily):
    real = daily.PRECTOTCORR.loc["2022-06-10":"2022-07-29"]
    events = e.spell_events(real)
    event = events.loc[events.start.eq(pd.Timestamp("2022-06-11"))].iloc[0]
    assert event.days == 48
    assert event.end == pd.Timestamp("2022-07-28")
    assert not event.left_censored and not event.right_censored
    cropped = real.loc["2022-06-11":"2022-06-20"].copy()
    cropped.iloc[5] = np.nan
    parts = e.spell_events(cropped)
    assert parts.days.tolist() == [5, 4]
    assert parts.left_censored.all() and parts.right_censored.all()
    assert pd.isna(e.running_low(cropped).iloc[5])
    assert e.running_low(cropped).iloc[6] == 1


def test_threshold_equality_and_cross_year_run(daily):
    # Escolhe exemplos reais, altera apenas o limiar para testar igualdade.
    window = daily.PRECTOTCORR.iloc[:5]
    threshold = float(window.iloc[0])
    assert e.running_low(window, threshold).iloc[0] == 0
    all_events = e.spell_events(daily.PRECTOTCORR)
    crossed = all_events.loc[all_events.crosses_year]
    assert len(crossed) > 0
    for row in crossed.itertuples():
        assert row.days == (row.end - row.start).days + 1


def test_correlations_use_train_only(daily, refs):
    design, features = e.prediction_design(daily, refs[1])
    _, _, _, corr, lags = e.relationships(daily, design, features, refs[1])
    assert corr.n.unique().tolist() == [7269]
    assert set(corr.scope) == {"train_only_2000_2019"}
    assert lags.loc[lags.lag_days.eq(1), "n"].unique().tolist() == [7304]


def test_generated_outputs_integrity_and_calendar():
    out = e.ROOT / "outputs/agua02"
    inventory = json.loads((out / "inventory.json").read_text(encoding="utf-8"))
    for item in inventory:
        raw = (out / item["file"]).read_bytes()
        assert len(raw) == item["bytes"]
        assert p.sha(raw) == item["sha256"]
    assert len(pd.read_csv(out / "tables/monthly.csv")) == 312
    assert len(pd.read_csv(out / "tables/annual.csv")) == 26
    assert len(list((out / "figures").glob("*.png"))) == 8
    for lag in [0, 2, 7]:
        design = pd.read_csv(out / f"tables/prediction_design_lag{lag}.csv")
        assert len(design) == 9497
        assert design.target_next7_mm.iloc[-7:].isna().all()


def test_complete_reproduction_is_network_free_and_deterministic(tmp_path, monkeypatch):
    import socket
    def forbidden(*args, **kwargs):
        raise AssertionError("AGUA-02 não pode acessar a rede")
    monkeypatch.setattr(socket, "create_connection", forbidden)
    monkeypatch.setattr(socket.socket, "connect", forbidden)
    e.run(tmp_path / "eda")
    expected = json.loads((e.ROOT / "outputs/agua02/inventory.json").read_text(encoding="utf-8"))
    actual = json.loads((tmp_path / "eda/inventory.json").read_text(encoding="utf-8"))
    assert actual == expected


def test_output_cannot_overwrite_agua01():
    with pytest.raises(ValueError, match="preservar"):
        e.run(e.ROOT / "data")
