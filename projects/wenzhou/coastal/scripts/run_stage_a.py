#!/usr/bin/env python3
"""Run parent-truth verification, GEBCO range extraction and bathymetry QA."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[4]
SCRIPT_ROOT = Path(__file__).resolve().parent
ACQUISITION_REPORT = REPO_ROOT / "projects/wenzhou/coastal/reports/GEBCO_2026_ACQUISITION.json"


def run(script_name: str) -> None:
    command = [sys.executable, str(SCRIPT_ROOT / script_name)]
    result = subprocess.run(command, cwd=REPO_ROOT, check=False)
    if result.returncode != 0:
        raise SystemExit(result.returncode)


def add_legacy_contract_keys() -> None:
    """Expose named grid and TID entries for the downstream builder contract."""
    report = json.loads(ACQUISITION_REPORT.read_text(encoding="utf-8"))
    outputs = report.get("outputs", [])
    if len(outputs) != 2:
        raise RuntimeError("GEBCO acquisition must contain exactly two outputs")
    by_role = {item.get("tags", {}).get("SOURCE_ROLE"): item for item in outputs}
    if set(by_role) != {"bathymetry", "type_identifier"}:
        raise RuntimeError(f"Unexpected GEBCO output roles: {sorted(by_role)}")
    report["grid"] = {
        "path": by_role["bathymetry"]["path"],
        "bytes": by_role["bathymetry"]["bytes"],
        "sha256": by_role["bathymetry"]["sha256"],
        "metadata": by_role["bathymetry"],
    }
    report["tid"] = {
        "path": by_role["type_identifier"]["path"],
        "bytes": by_role["type_identifier"]["bytes"],
        "sha256": by_role["type_identifier"]["sha256"],
        "metadata": by_role["type_identifier"],
    }
    ACQUISITION_REPORT.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def main() -> int:
    run("verify_parent_truth.py")
    run("download_gebco2026_ceda_subset.py")
    add_legacy_contract_keys()
    run("build_coastal_bathymetry.py")
    return 0


if __name__ == "__main__":
    sys.exit(main())
