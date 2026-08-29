from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path

import numpy as np

GRID = 2048
AOI_SHA = "36b750be56ae0dea906996258068eaf9aaa71e01667eb328b9ce6bd1b48cbe80"
RAW_SHA = "9490b1bd34f67336352cf448729f763ae4e241637d821961efd0290e29d6c9d4"
HEIGHT_BYTES = GRID * GRID * 2


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(8 * 1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("data_dir", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    root = args.data_dir
    terrain_path = root / "terrain_2048_u16.bin"
    terrain_manifest_path = root / "terrain_2048_manifest.json"
    water_path = root / "hydrology_ribbons.f32.bin"
    water_manifest_path = root / "hydrology_sample_manifest.json"
    receipt_path = root / "build_receipt.json"
    for path in (terrain_path, terrain_manifest_path, water_path, water_manifest_path, receipt_path):
        if not path.is_file() or path.stat().st_size <= 0:
            raise SystemExit(f"Missing build output: {path}")

    terrain_manifest = json.loads(terrain_manifest_path.read_text(encoding="utf-8"))
    water_manifest = json.loads(water_manifest_path.read_text(encoding="utf-8"))
    receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
    terrain = np.fromfile(terrain_path, dtype="<u2")
    water = np.fromfile(water_path, dtype="<f4")

    checks = {
        "terrain_schema": terrain_manifest.get("schema") == "guilin-v075-accepted-aoi-terrain-grid/v2",
        "terrain_grid_2048_square": terrain_manifest.get("output_grid") == [GRID, GRID] and terrain.size == GRID * GRID,
        "terrain_bytes_exact": terrain_path.stat().st_size == HEIGHT_BYTES,
        "terrain_sha_matches": terrain_manifest.get("sha256") == sha256(terrain_path),
        "terrain_source_12_5m": terrain_manifest.get("source_resolution_m") == [12.5, 12.5],
        "terrain_source_sha_locked": terrain_manifest.get("source_sha256") == RAW_SHA,
        "terrain_aoi_locked": terrain_manifest.get("aoi_geometry_sha256") == AOI_SHA,
        "terrain_has_valid_data": int(np.count_nonzero(terrain != 65535)) > GRID * GRID // 4,
        "terrain_preserves_nodata": int(np.count_nonzero(terrain == 65535)) == int(terrain_manifest.get("nodata_sample_count", -1)),
        "terrain_no_gap_fill": terrain_manifest.get("gap_fill_applied") is False,
        "terrain_no_30m": terrain_manifest.get("fallback_30m_used") is False,
        "terrain_vertical_scale_1": terrain_manifest.get("vertical_scale") == 1.0,
        "water_schema": water_manifest.get("schema") == "guilin-v075-hydrology-sampled-ribbons/v1",
        "water_aoi_locked": water_manifest.get("aoi_geometry_sha256") == AOI_SHA,
        "water_centerline_immutable": water_manifest.get("centerline_coordinates_mutated") is False,
        "water_nodata_breaks_recorded": int(water_manifest.get("nodata_break_count", -1)) >= 0,
        "water_segments_positive": int(water_manifest.get("emitted_segment_count", 0)) > 0,
        "water_vertex_count_exact": water.size % 4 == 0 and water.size // 4 == int(water_manifest.get("vertex_count", -1)),
        "water_bytes_exact": water_path.stat().st_size == int(water_manifest.get("stored_bytes", -1)),
        "water_asset_under_guard": water_path.stat().st_size < int(water_manifest.get("maximum_asset_bytes", 0)),
        "water_sha_matches": water_manifest.get("sha256") == sha256(water_path),
        "water_values_finite": bool(np.isfinite(water).all()),
        "water_classes_valid": set(np.unique(water.reshape(-1, 4)[:, 3]).tolist()).issubset({0.0, 1.0, 2.0}),
        "water_no_gap_fill": water_manifest.get("gap_fill_applied") is False,
        "water_no_30m": water_manifest.get("fallback_30m_used") is False,
        "receipt_matches": receipt.get("terrain", {}).get("sha256") == terrain_manifest.get("sha256") and receipt.get("hydrology", {}).get("sha256") == water_manifest.get("sha256"),
    }
    failed = [name for name, passed in checks.items() if not passed]
    payload = {
        "schema": "guilin-v075-2048-hydrology-static-qa/v1",
        "passed": not failed,
        "failed": failed,
        "checks": checks,
        "terrain_grid": terrain_manifest.get("output_grid"),
        "terrain_valid_samples": int(np.count_nonzero(terrain != 65535)),
        "terrain_nodata_samples": int(np.count_nonzero(terrain == 65535)),
        "water_vertex_count": int(water.size // 4),
        "water_segment_count": int(water_manifest.get("emitted_segment_count", 0)),
        "source_resolution_m": 12.5,
        "fallback_30m_used": False,
        "gap_fill_applied": False,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    if failed:
        raise SystemExit(f"Static QA failed: {failed}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
