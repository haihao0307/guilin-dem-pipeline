#!/usr/bin/env python3
"""Verify the immutable Wenzhou land DEM and supporting masks before coastal work."""

from __future__ import annotations

import hashlib
import json
import math
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[4]
CONFIG_PATH = REPO_ROOT / "projects/wenzhou/coastal/config/coastal_domain_v100.json"
REPORT_PATH = REPO_ROOT / "projects/wenzhou/coastal/reports/PARENT_TRUTH_PREFLIGHT.json"

SUPPORTING_FILES = {
    "marineMask": {
        "path": "projects/wenzhou/archive/truth/evidence/WENZHOU_QINGJIANG_marine_mask_COG.tif",
        "bytes": 941115,
        "sha256": "153e81de252fb6eb08fc9782b0e06dcf94af4ebc40f50034e332c3d1b5286200",
    },
    "sourceCount": {
        "path": "projects/wenzhou/archive/truth/evidence/WENZHOU_QINGJIANG_source_count_COG.tif",
        "bytes": 905758,
        "sha256": "cec4cdd613747bd4386db4b98fd184a948a9e0ca2b508c2e3c0a48533bb5f508",
    },
    "sourceNodataMask": {
        "path": "projects/wenzhou/archive/truth/evidence/WENZHOU_QINGJIANG_source_nodata_mask_COG.tif",
        "bytes": 257604,
        "sha256": "20bbcf7115a1532fcdc0f2bd3d24ef76a7acde26fa171fac63958fbef0260784",
    },
}


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(8 * 1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def looks_like_lfs_pointer(path: Path) -> bool:
    with path.open("rb") as handle:
        return handle.read(128).startswith(b"version https://git-lfs.github.com/spec/v1")


def close_float(actual: float, expected: float, tolerance: float = 1e-6) -> bool:
    return math.isclose(actual, expected, rel_tol=0.0, abs_tol=tolerance)


def verify_binary(label: str, spec: dict[str, Any]) -> dict[str, Any]:
    path = REPO_ROOT / spec["path"]
    result: dict[str, Any] = {
        "label": label,
        "path": spec["path"],
        "exists": path.is_file(),
        "expectedBytes": spec["bytes"],
        "expectedSha256": spec["sha256"],
    }
    if not path.is_file():
        result["passed"] = False
        result["error"] = "file_missing"
        return result
    result["lfsPointerOnly"] = looks_like_lfs_pointer(path)
    result["observedBytes"] = path.stat().st_size
    result["observedSha256"] = sha256_file(path)
    result["passed"] = (
        not result["lfsPointerOnly"]
        and result["observedBytes"] == spec["bytes"]
        and result["observedSha256"] == spec["sha256"]
    )
    if not result["passed"]:
        result["error"] = "identity_gate_failed"
    return result


def verify_truth_raster(path: Path, truth: dict[str, Any]) -> dict[str, Any]:
    try:
        import rasterio
    except ImportError as exc:
        return {
            "passed": False,
            "error": "rasterio_missing",
            "detail": str(exc),
        }

    expected_bounds = truth["bounds"]
    expected_res = truth["pixelSpacingMeters"]
    expected_grid = truth["grid"]
    with rasterio.open(path) as dataset:
        observed = {
            "driver": dataset.driver,
            "crs": dataset.crs.to_string() if dataset.crs else None,
            "width": dataset.width,
            "height": dataset.height,
            "count": dataset.count,
            "dtype": list(dataset.dtypes),
            "nodata": dataset.nodata,
            "resolution": [abs(dataset.res[0]), abs(dataset.res[1])],
            "bounds": [dataset.bounds.left, dataset.bounds.bottom, dataset.bounds.right, dataset.bounds.top],
            "blockShapes": [list(shape) for shape in dataset.block_shapes],
            "overviews": dataset.overviews(1),
            "imageStructure": dataset.tags(ns="IMAGE_STRUCTURE"),
        }

    checks = {
        "driver": observed["driver"] == "GTiff",
        "crs": observed["crs"] == truth["crs"],
        "grid": [observed["width"], observed["height"]] == expected_grid,
        "bandCount": observed["count"] == 1,
        "dtype": observed["dtype"] == ["int16"],
        "resolution": all(close_float(a, b) for a, b in zip(observed["resolution"], expected_res)),
        "bounds": all(close_float(a, b) for a, b in zip(observed["bounds"], expected_bounds)),
        "cogLayout": observed["imageStructure"].get("LAYOUT") == "COG",
        "losslessCompression": observed["imageStructure"].get("COMPRESSION") == "DEFLATE",
        "overviews": observed["overviews"] == [2, 4, 8, 16, 32, 64],
    }
    return {
        "passed": all(checks.values()),
        "checks": checks,
        "observed": observed,
    }


def main() -> int:
    config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    truth = config["truthDem"]
    truth_spec = {
        "path": truth["path"],
        "bytes": truth["bytes"],
        "sha256": truth["lfsOid"].removeprefix("sha256:"),
    }

    binaries = [verify_binary("truthDem", truth_spec)]
    binaries.extend(verify_binary(label, spec) for label, spec in SUPPORTING_FILES.items())

    truth_path = REPO_ROOT / truth["path"]
    raster_check = (
        verify_truth_raster(truth_path, truth)
        if truth_path.is_file() and not looks_like_lfs_pointer(truth_path)
        else {"passed": False, "error": "truth_raster_unavailable"}
    )

    passed = all(item["passed"] for item in binaries) and raster_check["passed"]
    report = {
        "schema": "wenzhou_parent_truth_preflight@1.0.0",
        "generatedAtUtc": datetime.now(timezone.utc).isoformat(),
        "project": config["project"],
        "parentArchive": config["parentArchive"],
        "passed": passed,
        "binaryChecks": binaries,
        "rasterCheck": raster_check,
        "nextStageAllowed": passed,
    }
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if passed else 2


if __name__ == "__main__":
    sys.exit(main())
