"""Qualidade de fontes reais: flags, lacunas, identidade e integridade do cache."""
import copy
import json
from pathlib import Path
import sys

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import hydrology as h


@pytest.fixture
def real_payload():
    return json.loads((h.OUT / "raw/alto-tiete-684-atual.json").read_bytes())


def inspect(payload):
    return h.inspect_series(payload, 684, "2026-11-01", "2026-11-16", 16)


def test_unknown_false_flag_prevents_incorporation_even_when_complete(real_payload):
    q = inspect(real_payload)
    assert q["records"] == 16 and q["coverage_fraction"] == 1
    assert q["isValid_counts"] == {"False": 16}
    assert not q["incorporated_in_analysis"]
    assert q["quality_flag_semantics"] == "nao_confirmada"


def test_missing_date_is_not_zero_or_full_coverage(real_payload):
    real_payload["data"].pop(5)
    q = inspect(real_payload)
    assert q["coverage_fraction"] == 15/16
    assert q["records"] == 15


def test_duplicate_date_does_not_inflate_coverage(real_payload):
    real_payload["data"][5] = copy.deepcopy(real_payload["data"][4])
    q = inspect(real_payload)
    assert q["duplicate_dates"] == 1
    assert q["coverage_fraction"] == 15/16


def test_invalid_value_and_identity_are_reported(real_payload):
    real_payload["data"][0]["value"] = None
    real_payload["data"][1]["idElemento"] = 64
    q = inspect(real_payload)
    assert q["bad_values"] == 1 and q["bad_identity"] == 1
    assert not q["incorporated_in_analysis"]


def test_offline_cache_detects_tampering(tmp_path):
    name = "alto-tiete-684-atual.json"
    meta = json.loads((h.OUT / "raw" / (name+".meta.json")).read_bytes())
    (tmp_path/"raw").mkdir()
    (tmp_path/"raw"/name).write_bytes((h.OUT/"raw"/name).read_bytes()+b" ")
    (tmp_path/"raw"/(name+".meta.json")).write_text(json.dumps(meta), encoding="utf-8")
    with pytest.raises(ValueError, match="corrompido"):
        h.fetch(name, meta["url"], False, tmp_path)


def test_acquisition_failure_does_not_become_success():
    with pytest.raises(ValueError):
        inspect({"succeeded":False, "data":[]})
