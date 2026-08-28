"""Manifest builders for Yangshuo Lijiang candidate products v3.0."""
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from yangshuo_candidates_v300_common import sha
from yangshuo_candidates_v300_raster import asset


def build_manifest(
    source: Path,
    config: dict[str, Any],
    config_path: Path,
    hydro_path: Path,
    candidate: dict[str, Any],
    window: list[int],
    bounds: list[float],
    valid_fraction: float,
    values: Any,
    status: str,
    paths: dict[str, Path],
    previews: dict[str, Any],
    scales: dict[str, Any],
) -> dict[str, Any]:
    return {
        "schemaVersion": "yangshuo-lijiang-candidate-v300/v1",
        "generatedAtUtc": datetime.now(timezone.utc).isoformat(),
        "id": str(candidate["id"]),
        "slug": str(candidate["slug"]),
        "name": candidate.get("name"),
        "status": status,
        "source": {
            "file": source.name,
            "sha256": sha(source),
            "bytes": source.stat().st_size,
            "crs": config["crs"],
            "pixelSpacingMeters": config["windowContract"]["sourcePixelSpacingMeters"],
            "pixelWindow": window,
            "resampled": False,
        },
        "grid": [2048, 2048],
        "bounds": bounds,
        "widthMeters": 25600,
        "heightMeters": 25600,
        "areaSquareKilometers": 655.36,
        "validFraction": valid_fraction,
        "elevationMeters": {
            "minimum": float(values.min()),
            "maximum": float(values.max()),
            "mean": float(values.mean()),
        },
        "lineage": {
            "config": str(config_path),
            "configSha256": sha(config_path),
            "hydrology": str(hydro_path),
            "hydrologySha256": sha(hydro_path),
            "hydrologyGitBlobSha": config["hydrology"]["gitBlobSha"],
        },
        "assets": {
            "truthSlice": asset(paths["truth"]),
            "height": asset(paths["height"], "little-endian-float32"),
            "validMask": asset(paths["mask"], "uint8"),
            "previews": previews,
        },
        "previewScales": scales,
        "locks": {
            "resamplingAllowed": False,
            "macroDeltaMeters": 0,
            "microDeltaMeters": 0,
            "userAreaApproval": False,
            "visualAcceptance": False,
        },
    }
