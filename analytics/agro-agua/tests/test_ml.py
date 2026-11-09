"""Testes AGUA-03: dados reais, vazamento, fitting local, guarda da abertura única."""
from pathlib import Path
import sys
import numpy as np
import pandas as pd
import pytest
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import ml


@pytest.fixture(scope="module")
def daily():
    return pd.read_csv(ml.ROOT / "data/processed/daily.csv", parse_dates=["date"], index_col="date")


def test_partition_and_target(daily):
    d, cols = ml.build_design(daily)
    assert d.block.value_counts().to_dict() == {"train": 7269, "validation": 1089, "test": 1089}
    assert len(cols) == 34
    assert "target_next7_mm" not in cols and "climatology_next7_mm" not in cols
    assert d.loc["2020-01-01", "target_next7_mm"] == pytest.approx(daily.PRECTOTCORR.loc["2020-01-02":"2020-01-08"].sum())
    assert d.loc["2020-01-01", "past_rain_14d_mm"] == pytest.approx(daily.PRECTOTCORR.loc["2019-12-19":"2020-01-01"].sum())
    for end, a, b in ml.FOLDS:
        fit, val = ml.fold_masks(d.loc[d.block.ne("test")], end, a, b)
        sub = d.loc[d.block.ne("test")]
        assert sub.loc[fit].target_end.max() <= pd.Timestamp(end)
        assert sub.loc[val].target_start.min() > pd.Timestamp(end)
        assert sub.loc[val].target_end.max() <= pd.Timestamp(b)


def test_future_does_not_change_features_or_climate(daily):
    origin = pd.Timestamp("2021-05-15")
    changed = daily.copy(); changed.loc[origin + pd.Timedelta(days=1):] *= 2
    before, cols = ml.build_design(daily); after, _ = ml.build_design(changed)
    pd.testing.assert_series_equal(before.loc[origin, cols], after.loc[origin, cols])
    idx = pd.DatetimeIndex([origin])
    pd.testing.assert_series_equal(ml.baseline(daily, idx), ml.baseline(changed, idx))


def test_scaler_fit_and_early_stopping(daily):
    d, cols = ml.build_design(daily)
    fit = d.loc[d.block.eq("train")]
    model = ml.make_model(ml.CANDIDATES["ridge_1"])
    model.fit(fit[cols], fit.target_next7_mm)
    np.testing.assert_allclose(model[0].mean_, fit[cols].mean(), atol=1e-10)
    assert model[0].n_samples_seen_ == 7269
    assert ml.make_model(ml.CANDIDATES["hgb_7"]).early_stopping is False


def test_metrics_sign_and_zero_denominator(daily):
    y = daily.PRECTOTCORR.iloc[:7].to_numpy()
    result = ml.scores(y, y+1, y+2)
    assert result["mae_mm"] == pytest.approx(1)
    assert result["bias_mm"] == pytest.approx(1)
    assert result["gain_mae_pct"] == pytest.approx(50)
    assert ml.scores(y, y, y)["gain_mae_pct"] is None
    with pytest.raises(ValueError):
        ml.scores([np.nan], [0], [0])


def test_test_can_only_be_opened_once(tmp_path):
    ml.reserve_test(tmp_path, "test-hash")
    with pytest.raises(FileExistsError):
        ml.reserve_test(tmp_path, "test-hash")


def test_verify_saved_delivery_without_predict(monkeypatch):
    if not (ml.OUT / "inventory.json").exists():
        return  # Pré-congelamento: ainda não há entrega; testes finais executam esta verificação.
    def forbidden(*args, **kwargs):
        raise AssertionError("verify não pode ajustar/prever/reabrir o teste")
    import socket
    monkeypatch.setattr(socket.socket, "connect", forbidden)
    monkeypatch.setattr(ml, "predict", forbidden)
    monkeypatch.setattr(ml, "reserve_test", forbidden)
    ml.verify()
    with pytest.raises(FileExistsError):
        ml.evaluate()


def test_reproduce_training_and_selection_offline(tmp_path, monkeypatch):
    import json
    import socket
    def forbidden(*args, **kwargs):
        raise AssertionError("Treino não pode usar rede ou abrir teste")
    monkeypatch.setattr(socket.socket, "connect", forbidden)
    monkeypatch.setattr(ml, "reserve_test", forbidden)
    out = tmp_path / "development"
    with ml.threadpool_limits(limits=1):
        ml.train(out)
    expected = json.loads((ml.OUT / "frozen.json").read_text(encoding="utf-8"))
    actual = json.loads((out / "frozen.json").read_text(encoding="utf-8"))
    assert actual["selected_model"] == expected["selected_model"]
    assert actual["configs"] == expected["configs"]
    assert actual["models_sha256"] == expected["models_sha256"]
    assert not (out / "test-opened.json").exists()
    for name in ["cv_metrics.csv", "development_metrics.csv", "development_predictions.csv"]:
        pd.testing.assert_frame_equal(pd.read_csv(out / name), pd.read_csv(ml.OUT / name), atol=1e-10, rtol=1e-10)
