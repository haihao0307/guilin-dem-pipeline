#!/usr/bin/env python3
"""Audit the fixed Guilin v0.7 Release mosaic against four native 2048 Yangshuo windows."""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


class AuditError(RuntimeError):
    pass


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AuditError(message)


def load_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise AuditError(f"Cannot read valid JSON: {path}: {exc}") from exc


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def close(actual: float, expected: float, label: str, tolerance: float = 1e-6) -> None:
    require(math.isclose(float(actual), float(expected), rel_tol=0.0, abs_tol=tolerance),
            f"{label}: expected {expected}, got {actual}")


def dataset_epsg(dataset: Any, osr: Any) -> str:
    reference = osr.SpatialReference()
    reference.ImportFromWkt(dataset.GetProjectionRef())
    reference.AutoIdentifyEPSG()
    code = reference.GetAuthorityCode(None) or reference.GetAuthorityCode("PROJCS")
    return f"EPSG:{code}" if code else "unknown"


def raster_bounds(transform: tuple[float, ...], width: int, height: int) -> list[float]:
    x0, dx, rx, y0, ry, dy = map(float, transform)
    require(abs(rx) < 1e-9 and abs(ry) < 1e-9, "Rotated Release mosaic is prohibited")
    require(dx > 0 and dy < 0, "Release mosaic must be north-up")
    return [x0, y0 + height * dy, x0 + width * dx, y0]


def integer(value: float, label: str) -> int:
    rounded = int(round(value))
    require(abs(value - rounded) <= 1e-6, f"{label} is not aligned to the Release mosaic grid: {value}")
    return rounded


def audit(root: Path, source: Path, audit_config_path: Path, report_path: Path) -> dict[str, Any]:
    audit_config = load_json(audit_config_path)
    candidate_config_path = root / audit_config["candidateConfigPath"]
    candidate_config = load_json(candidate_config_path)

    require(audit_config.get("schemaVersion") == "guilin-yangshuo-release-mosaic-audit/v3.0.0",
            "Unexpected Release-audit schema")
    require(audit_config.get("status") == "audit-only-unapproved",
            "Release source must remain audit-only")
    release = audit_config["releaseAsset"]
    policy = audit_config["policy"]
    require(release.get("approvedForExtraction") is False, "Release source approval must remain false")
    require(policy.get("switchTruthSourceOnAuditPass") is False, "Automatic truth-source switching is prohibited")
    require(policy.get("generateTerrain") is False, "Terrain generation is prohibited during source audit")
    require(policy.get("generateCandidatePreviews") is False, "Candidate preview generation is prohibited during source audit")
    require(policy.get("resample") is False and policy.get("interpolateNoData") is False,
            "Resampling and NoData interpolation are prohibited")
    close(policy.get("macroDeltaMeters"), 0.0, "macroDeltaMeters")
    close(policy.get("microDeltaMeters"), 0.0, "microDeltaMeters")
    require(policy.get("userAreaApproval") is False and policy.get("visualAcceptance") is False,
            "User and visual approvals must remain false")

    require(source.is_file(), f"Release TIFF is missing: {source}")
    require(source.name == release["name"], f"Release asset filename mismatch: {source.name}")
    require(source.stat().st_size == int(release["bytes"]), "Release asset byte count mismatch")
    source_sha = sha256(source)
    require(source_sha == release["expectedSha256"], "Release asset SHA256 mismatch")

    try:
        import numpy as np
        from osgeo import gdal, osr
    except ImportError as exc:
        raise AuditError(f"NumPy and GDAL Python bindings are required: {exc}") from exc

    gdal.UseExceptions()
    dataset = gdal.Open(str(source), gdal.GA_ReadOnly)
    require(dataset is not None and dataset.RasterCount >= 1, "GDAL could not open a valid Release mosaic")
    band = dataset.GetRasterBand(1)
    transform = tuple(dataset.GetGeoTransform(can_return_null=True) or ())
    require(len(transform) == 6, "Release mosaic geotransform is missing")

    expected_raster = audit_config["expectedRaster"]
    epsg = dataset_epsg(dataset, osr)
    require(epsg == expected_raster["crs"], f"Release mosaic CRS mismatch: {epsg}")
    close(abs(transform[1]), float(expected_raster["pixelSpacingMeters"][0]), "pixel width")
    close(abs(transform[5]), float(expected_raster["pixelSpacingMeters"][1]), "pixel height")
    require(abs(transform[2]) < 1e-9 and abs(transform[4]) < 1e-9, "Release mosaic rotation is prohibited")
    require(transform[1] > 0 and transform[5] < 0, "Release mosaic must be north-up")

    width, height = int(dataset.RasterXSize), int(dataset.RasterYSize)
    source_bounds = raster_bounds(transform, width, height)
    nodata = band.GetNoDataValue()
    required_grid = list(map(int, expected_raster["requiredWindowGrid"]))
    minimum_valid = float(expected_raster["minimumCandidateValidFraction"])

    candidates: list[dict[str, Any]] = []
    all_passed = True
    for candidate in candidate_config["candidates"]:
        candidate_id = str(candidate["id"])
        original_bounds = list(map(float, candidate["alignedBounds"]))
        desired_center = list(map(float, candidate["alignedCenterProjected"]))
        window_width, window_height = required_grid

        # Snap only the window origin to the nearest Release-mosaic pixel. This preserves
        # the native 12.5 m samples and moves the requested center by at most half a pixel
        # per axis. No raster values are resampled or interpolated.
        col = int(round((desired_center[0] - transform[0]) / transform[1] - window_width / 2))
        row = int(round((transform[3] - desired_center[1]) / abs(transform[5]) - window_height / 2))
        min_x = transform[0] + col * transform[1]
        max_y = transform[3] + row * transform[5]
        max_x = min_x + window_width * transform[1]
        min_y = max_y + window_height * transform[5]
        bounds = [float(min_x), float(min_y), float(max_x), float(max_y)]
        release_center = [(min_x + max_x) / 2, (min_y + max_y) / 2]
        shift_x = release_center[0] - desired_center[0]
        shift_y = release_center[1] - desired_center[1]
        shift_distance = math.hypot(shift_x, shift_y)
        maximum_shift = float(expected_raster["maximumCenterShiftMeters"])

        require(shift_distance <= maximum_shift + 1e-6,
                f"{candidate_id}: nearest native grid center shift {shift_distance} m exceeds {maximum_shift} m")
        require(col >= 0 and row >= 0 and col + window_width <= width and row + window_height <= height,
                f"{candidate_id}: candidate exceeds Release mosaic bounds")

        array = band.ReadAsArray(col, row, window_width, window_height)
        require(array is not None and list(array.shape) == [window_height, window_width],
                f"{candidate_id}: GDAL failed to read the exact window")
        values_array = np.asarray(array)
        valid = np.isfinite(values_array)
        if nodata is not None:
            valid &= values_array != nodata
        mask_band = band.GetMaskBand()
        if mask_band is not None:
            mask = mask_band.ReadAsArray(col, row, window_width, window_height)
            if mask is not None:
                valid &= np.asarray(mask) != 0

        valid_fraction = float(valid.mean())
        passed = valid_fraction >= minimum_valid
        all_passed &= passed
        valid_values = values_array[valid]
        candidates.append({
            "id": candidate_id,
            "slug": candidate["slug"],
            "originalAlignedBounds": original_bounds,
            "desiredCenterProjected": desired_center,
            "releaseAlignedBounds": bounds,
            "releaseAlignedCenterProjected": release_center,
            "centerShiftMeters": {
                "x": float(shift_x),
                "y": float(shift_y),
                "distance": float(shift_distance),
                "maximumAllowed": maximum_shift,
            },
            "releasePixelWindow": [col, row, window_width, window_height],
            "grid": required_grid,
            "validFraction": valid_fraction,
            "minimumValidFraction": minimum_valid,
            "elevationMeters": {
                "minimum": float(valid_values.min()) if valid_values.size else None,
                "maximum": float(valid_values.max()) if valid_values.size else None,
                "mean": float(valid_values.mean()) if valid_values.size else None,
            },
            "passed": passed,
            "resampled": False,
        })

    report = {
        "schemaVersion": "guilin-yangshuo-release-mosaic-audit-report/v3.0.0",
        "generatedAtUtc": datetime.now(timezone.utc).isoformat(),
        "passed": all_passed,
        "status": "audit-pass-unapproved" if all_passed else "audit-failed",
        "releaseAsset": {
            "tag": release["tag"],
            "releaseId": release["releaseId"],
            "assetId": release["assetId"],
            "name": release["name"],
            "bytes": source.stat().st_size,
            "sha256": source_sha,
        },
        "raster": {
            "crs": epsg,
            "grid": [width, height],
            "transform": list(map(float, transform)),
            "bounds": source_bounds,
            "pixelSpacingMeters": [abs(float(transform[1])), abs(float(transform[5]))],
            "nodata": nodata,
        },
        "candidateConfig": {
            "path": str(candidate_config_path.relative_to(root)),
            "sha256": sha256(candidate_config_path),
            "windowGrid": required_grid,
        },
        "candidates": candidates,
        "locks": {
            "approvedForExtraction": False,
            "switchTruthSource": False,
            "generateTerrain": False,
            "generateCandidatePreviews": False,
            "resample": False,
            "interpolateNoData": False,
            "macroDeltaMeters": 0.0,
            "microDeltaMeters": 0.0,
            "userAreaApproval": False,
            "visualAcceptance": False,
        },
    }
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return report


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path.cwd())
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--audit-config", type=Path,
                        default=Path("projects/guilin/config/yangshuo_lijiang_release_audit_v300.json"))
    parser.add_argument("--report", type=Path,
                        default=Path("reports/YANGSHUO_LIJIANG_RELEASE_MOSAIC_AUDIT_V300.json"))
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    root = args.root.resolve()
    audit_config_path = args.audit_config if args.audit_config.is_absolute() else root / args.audit_config
    report_path = args.report if args.report.is_absolute() else root / args.report
    try:
        report = audit(root, args.source.resolve(), audit_config_path.resolve(), report_path.resolve())
    except AuditError as exc:
        failure = {
            "schemaVersion": "guilin-yangshuo-release-mosaic-audit-report/v3.0.0",
            "generatedAtUtc": datetime.now(timezone.utc).isoformat(),
            "passed": False,
            "status": "audit-failed",
            "error": str(exc),
            "locks": {
                "approvedForExtraction": False,
                "switchTruthSource": False,
                "generateTerrain": False,
                "generateCandidatePreviews": False,
                "resample": False,
                "interpolateNoData": False,
                "macroDeltaMeters": 0.0,
                "microDeltaMeters": 0.0,
                "userAreaApproval": False,
                "visualAcceptance": False,
            },
        }
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(json.dumps(failure, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(json.dumps(failure, ensure_ascii=False, indent=2), file=sys.stderr)
        return 1
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["passed"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
