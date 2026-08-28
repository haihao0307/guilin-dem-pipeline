"""Production contract validation for Yangshuo Lijiang candidate windows v3.0."""
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from yangshuo_candidates_v300_common import AREA, EXTENT, GRID, IDS, SCHEMA, SPACING, bounds_center, close, load, need, raster_bounds, same_numbers, sha, window_bounds


def _verified(status: dict[str, Any], filename: str) -> dict[str, Any]:
    for item in status.get("localVerifiedSources", []):
        if item.get("file") == filename:
            return item
    raise RuntimeError(f"Source missing from verification index: {filename}")


def validate_contract(root: Path, config_path: Path) -> dict[str, Any]:
    root, config_path = root.resolve(), config_path.resolve(); cfg = load(config_path)
    need(cfg.get("schemaVersion") == SCHEMA, "Unexpected candidate schema")
    need(cfg.get("status") == "candidate-evaluation-locked", "Candidate contract must remain locked")
    need(cfg.get("crs") == "EPSG:32649", "CRS must be EPSG:32649")

    contract, truth = cfg.get("windowContract", {}), cfg.get("truthSource", {})
    need(contract.get("grid") == GRID, "Candidate grid must be exactly 2048 x 2048")
    for key, value in (("sourcePixelSpacingMeters", SPACING), ("widthMeters", EXTENT), ("heightMeters", EXTENT),
                       ("areaSquareKilometers", AREA), ("minimumValidFractionForApproval", .995),
                       ("macroDeltaMeters", 0), ("microDeltaMeters", 0)):
        close(contract.get(key), value, key)
    for key in ("resamplingAllowed", "permanentDownsample", "interpolatedFakeDetail", "userAreaApproval", "visualAcceptance"):
        need(contract.get(key) is False, f"{key} must remain false")
    need(contract.get("webTerrainMode") == "tiled-lod", "webTerrainMode must be tiled-lod")

    need(truth.get("pixelSpacingMeters") == [SPACING, SPACING], "Truth spacing must be 12.5 m")
    grid, transform = truth.get("grid"), truth.get("transform")
    need(isinstance(grid, list) and len(grid) == 2, "Invalid truth grid")
    need(isinstance(transform, list) and len(transform) == 6, "Invalid truth transform")
    same_numbers(raster_bounds(transform, grid), truth.get("bounds", []), "truthSource.bounds")

    preflight_path = root / str(truth.get("preflightPath", "")); status_path = root / str(truth.get("verificationIndexPath", ""))
    preflight, status = load(preflight_path), load(status_path); raster = preflight.get("raster", {})
    try: item = _verified(status, str(truth.get("file")))
    except RuntimeError as exc: need(False, str(exc)); raise
    need(preflight.get("errors") == [], "Source preflight contains errors")
    need([raster.get("width"), raster.get("height")] == grid, "Preflight grid mismatch")
    need(raster.get("crs") == cfg.get("crs"), "Preflight CRS mismatch")
    same_numbers(raster.get("pixel_size", []), truth.get("pixelSpacingMeters", []), "preflight.pixel_size")
    same_numbers(raster.get("transform", []), transform, "preflight.transform")
    same_numbers(raster.get("bounds", []), truth.get("bounds", []), "preflight.bounds")
    need(item.get("sha256") == truth.get("expectedSha256"), "Verified source SHA256 mismatch")
    need(item.get("bytes") == truth.get("bytes"), "Verified source byte count mismatch")
    need(item.get("crs") == cfg.get("crs"), "Verified source CRS mismatch")
    close(item.get("pixelSpacingMeters"), SPACING, "verified pixel spacing")

    hydro = cfg.get("hydrology", {}); hydro_path = root / str(hydro.get("path", "")); blob = str(hydro.get("gitBlobSha", ""))
    need(hydro_path.is_file(), f"Versioned Lijiang geometry missing: {hydro_path}")
    need(len(blob) == 40 and all(char in "0123456789abcdef" for char in blob), "Invalid hydrology Git blob SHA")

    candidates = cfg.get("candidates"); need(isinstance(candidates, list) and len(candidates) == 4, "Exactly four candidate windows are required")
    need({str(item.get("id")) for item in candidates} == IDS, "Candidate IDs must be A, B, C and D")
    selection = cfg.get("candidateSelection", {})
    need(selection.get("candidateCount") == 4, "candidateSelection count mismatch")
    need(selection.get("primaryVisualCandidate") in IDS, "Invalid primary candidate")
    need(selection.get("engineeringCalibrationCandidate") in IDS, "Invalid calibration candidate")
    need(selection.get("approvalRequiredBeforeTerrainGeneration") is True, "Terrain generation must remain approval-gated")

    source_width, source_height = map(int, grid); seen, reports = set(), []
    for candidate in candidates:
        cid, window = str(candidate.get("id")), candidate.get("pixelWindow")
        need(isinstance(window, list) and len(window) == 4, f"{cid}: invalid pixelWindow")
        x, y, width, height = map(int, window)
        need([width, height] == GRID, f"{cid}: window must be exactly 2048 x 2048")
        need(x >= 0 and y >= 0, f"{cid}: negative source offset")
        need(x + width <= source_width, f"{cid}: window exceeds source width")
        need(y + height <= source_height, f"{cid}: window exceeds source height")
        need(tuple(window) not in seen, f"{cid}: duplicate candidate window"); seen.add(tuple(window))
        bounds = window_bounds(transform, window); same_numbers(bounds, candidate.get("alignedBounds", []), f"{cid}.alignedBounds")
        center = bounds_center(bounds); same_numbers(center, candidate.get("alignedCenterProjected", []), f"{cid}.alignedCenterProjected")
        width_m, height_m = bounds[2] - bounds[0], bounds[3] - bounds[1]
        close(width_m, EXTENT, f"{cid}.widthMeters"); close(height_m, EXTENT, f"{cid}.heightMeters")
        close(width_m * height_m / 1_000_000, AREA, f"{cid}.areaSquareKilometers")
        need(candidate.get("status") == "planned-native-window", f"{cid}: unexpected status")
        reports.append({"id": cid, "slug": candidate.get("slug"), "pixelWindow": window, "bounds": bounds,
                        "centerProjected": center, "grid": GRID, "spacingMeters": SPACING,
                        "widthMeters": width_m, "heightMeters": height_m, "areaSquareKilometers": AREA,
                        "fitsVerifiedSource": True, "resampled": False})

    return {"schemaVersion": "yangshuo-lijiang-candidates-v300-validation/v1", "generatedAtUtc": datetime.now(timezone.utc).isoformat(),
            "passed": True, "config": str(config_path.relative_to(root)), "configSha256": sha(config_path),
            "truthSource": {"id": truth.get("id"), "file": truth.get("file"), "sha256": truth.get("expectedSha256"),
                            "bytes": truth.get("bytes"), "crs": cfg.get("crs"), "grid": grid,
                            "spacingMeters": truth.get("pixelSpacingMeters"), "bounds": truth.get("bounds")},
            "hydrology": {"path": str(hydro_path.relative_to(root)), "gitBlobSha": blob, "sha256": sha(hydro_path)},
            "windowContract": contract, "candidates": reports,
            "gates": {"native2048Windows": True, "sourceHashVerified": True, "allWindowsFitSingleVerifiedSource": True,
                      "resamplingDisabled": True, "macroDeltaLockedAtZero": True, "microDeltaLockedAtZero": True,
                      "terrainGenerationBlockedPendingUserApproval": True, "visualAcceptance": False}}
