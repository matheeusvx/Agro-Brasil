"""Validação offline da entrega, sem fit/predict/load/reabertura do teste.

Usa o ambiente científico requirements-ml.txt. Validação estrutural/visual de PDF
é separada no ambiente requirements-report.txt e documentada em verificacao-final.md.
"""
import hashlib
import json
from pathlib import Path
import sys
import tempfile

import pytest
import consolidate
import hydrology
import ml

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "outputs/entrega"
EXCLUDED = ["test_scaler_fit_and_early_stopping", "test_reproduce_training_and_selection_offline"]


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def preservation():
    snapshot = json.loads((OUT / "preservacao-inicial.json").read_text(encoding="utf-8"))["files"]
    for name, expected in snapshot.items():
        if sha(ROOT / name) != expected:
            raise ValueError(f"Arquivo preservado divergiu: {name}")
    print(f"Preservação confirmada: {len(snapshot)} arquivos.")
    return len(snapshot)


def inventory():
    """Manifesto da entrega; não inclui a si próprio nem os checks regeneráveis."""
    ignored = {"inventory.json", "checks.json", "test-results.xml"}
    paths = [p for p in OUT.rglob("*") if p.is_file() and p.name not in ignored and p.suffix != ".zip"]
    paths += [ROOT / n for n in ["academic_pdf.py", "hydrology.py", "verify_delivery.py", "README.md",
              "docs/matriz-conformidade.md", "docs/auditoria-final.md", "docs/verificacao-final.md",
              "tests/conftest.py", "tests/test_hydrology.py", "requirements-report.txt", ".gitignore", ".gitattributes"]]
    rows = [{"file": p.relative_to(ROOT).as_posix(), "bytes": p.stat().st_size, "sha256": sha(p)} for p in sorted(paths)]
    (OUT / "inventory.json").write_text(json.dumps(rows, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")


def verify_inventory():
    items = json.loads((OUT / "inventory.json").read_text(encoding="utf-8"))
    for r in items:
        p = (ROOT / r["file"]).resolve()
        if not p.is_relative_to(ROOT) or p.stat().st_size != r["bytes"] or sha(p) != r["sha256"]:
            raise ValueError(f"Integridade da entrega: {r['file']}")
    return len(items)


def main():
    count = preservation()
    ml.verify()
    consolidate.verify_inventory(consolidate.OUT)
    hydrology.run()
    verified = verify_inventory()
    args = [str(ROOT / "tests"), "-q", "-p", "no:cacheprovider", "--frozen-only", f"--junitxml={OUT / 'test-results.xml'}"]
    temp_root = ROOT / ".tmp-tests"
    temp_root.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="entrega-", dir=temp_root) as temporary:
        if not Path(temporary).resolve().is_relative_to(temp_root.resolve()):
            raise ValueError("Diretório temporário fora do módulo")
        result = pytest.main([*args, f"--basetemp={temporary}"])
    preservation()
    if result:
        raise SystemExit(result)
    (OUT / "checks.json").write_text(json.dumps({"status": "passed", "preserved_files": count,
        "delivery_files_verified": verified, "excluded_fitting_tests": EXCLUDED,
        "fit_predict_joblib_load_blocked": True, "network_blocked_in_tests": True,
        "new_training": False, "new_inference": False, "test_reopened": False,
        "scientific_scope": "retrospectivo; aderência hídrica parcial, ver matriz"}, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")


if __name__ == "__main__":
    if sys.argv[1:] == ["--inventory"]:
        inventory()
    elif sys.argv[1:]:
        raise SystemExit("Uso: verify_delivery.py [--inventory]")
    else:
        main()
