"""Modo final explicitamente congelado; preserva os testes históricos."""
from unittest.mock import patch
import socket

import pytest

FITTING_TESTS = {"test_scaler_fit_and_early_stopping", "test_reproduce_training_and_selection_offline"}


def pytest_addoption(parser):
    parser.addoption("--frozen-only", action="store_true", help="Desmarca fitting e bloqueia fit/predict/load/rede")


def pytest_collection_modifyitems(config, items):
    if config.getoption("--frozen-only"):
        omitted = [t for t in items if t.name in FITTING_TESTS]
        items[:] = [t for t in items if t.name not in FITTING_TESTS]
        config.hook.pytest_deselected(items=omitted)


@pytest.fixture(autouse=True)
def frozen_guards(request):
    if not request.config.getoption("--frozen-only"):
        yield
        return
    import joblib
    from sklearn.linear_model import Ridge
    from sklearn.ensemble import HistGradientBoostingRegressor
    from contextlib import ExitStack
    def forbidden(*args, **kwargs):
        raise AssertionError("Entrega congelada proíbe fit/predict/load/rede")
    with ExitStack() as stack:
        for target, method in [(Ridge,"fit"), (Ridge,"predict"), (HistGradientBoostingRegressor,"fit"),
                               (HistGradientBoostingRegressor,"predict"), (joblib,"load"), (socket.socket,"connect")]:
            stack.enter_context(patch.object(target, method, forbidden))
        yield
