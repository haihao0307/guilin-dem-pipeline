from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
import rasterio
from rasterio.windows import Window

EXPECTED_SOURCE_SHA256 = "9490b1bd34f67336352cf448729f763ae4e241637d821961efd0290e29d6c9d4"
EXPECTED_AOI_SHA256 = "36b750be56ae0dea906996258068eaf9aaa71e01667eb328b9ce6bd1b48cbe80"
TILE_SIZE = 2_048
TILE_STRIDE = 2_047
TILE_BYTES = 8_388_608


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while chunk := handle.read(8 * 1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def load_tile(path: Path) -> np.ndarray:
    if path.stat().st_size != TILE_BYTES:
        raise RuntimeError(f"Tile byte count mismatch for {path.name}: {path.stat().st_size}")
    return np.fromfile(path, dtype="<i2").reshape((TILE_SIZE, TILE_SIZE))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--mosaic", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()

    manifest_path = args.output_dir / "native_lod_manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if manifest.get("schema") != "guilin-v077-native-lod-manifest/v1":
        raise RuntimeError("Manifest schema mismatch")
    if manifest["source"]["sha256"] != EXPECTED_SOURCE_SHA256:
        raise RuntimeError("Source SHA contract mismatch")
    if manifest["aoi"]["geometry_sha256"] != EXPECTED_AOI_SHA256:
        raise RuntimeError("AOI hash contract mismatch")
    if manifest["tile_matrix"]["stored_grid"] != [TILE_SIZE, TILE_SIZE]:
        raise RuntimeError("Stored tile grid mismatch")
    if manifest["tile_matrix"]["stride_samples"] != [TILE_STRIDE, TILE_STRIDE]:
        raise RuntimeError("Tile stride mismatch")
    if manifest["tile_matrix"]["resampling"] != "none":
        raise RuntimeError("Resampling is forbidden in native tile foundation")
    rules = manifest["rules"]
    if rules["gap_fill_applied"] or rules["fallback_30m_used"] or rules["source_resampling"]:
        raise RuntimeError("Forbidden fallback, gap fill, or resampling detected")
    if rules["source_elevation_modified_m"] != 0 or rules["vertical_scale"] != 1:
        raise RuntimeError("Elevation identity or vertical scale contract mismatch")

    tile_arrays: dict[tuple[int, int], np.ndarray] = {}
    tile_records: dict[tuple[int, int], dict] = {}
    with rasterio.open(args.mosaic) as source:
        if sha256_file(args.mosaic) != EXPECTED_SOURCE_SHA256:
            raise RuntimeError("Local source TIFF SHA mismatch")
        for record in manifest["tiles"]:
            key = tuple(record["matrix_index"])
            tile_path = args.output_dir / record["file"]
            if sha256_file(tile_path) != record["sha256"]:
                raise RuntimeError(f"Tile SHA mismatch: {record['id']}")
            tile = load_tile(tile_path)
            col_off, row_off, width, height = record["source_window"]
            native = source.read(1, window=Window(col_off, row_off, width, height))
            if not np.array_equal(tile[:height, :width], native):
                mismatch = int(np.count_nonzero(tile[:height, :width] != native))
                raise RuntimeError(f"Native sample mismatch in {record['id']}: {mismatch}")
            if np.any(tile[height:, :]) or np.any(tile[:height, width:]):
                raise RuntimeError(f"Edge padding is not pure NoData 0 in {record['id']}")
            if record["stored_bytes"] != TILE_BYTES:
                raise RuntimeError(f"Manifest tile byte count mismatch in {record['id']}")
            if record["resampling"] != "none" or record["source_elevation_modified_m"] != 0:
                raise RuntimeError(f"Tile provenance mismatch in {record['id']}")
            tile_arrays[key] = tile
            tile_records[key] = record

    horizontal_seams = 0
    vertical_seams = 0
    for (row, col), tile in sorted(tile_arrays.items()):
        right_key = (row, col + 1)
        if right_key in tile_arrays:
            left_record = tile_records[(row, col)]
            right_record = tile_records[right_key]
            overlap = min(left_record["valid_grid"][1], right_record["valid_grid"][1])
            if left_record["valid_grid"][0] != TILE_SIZE:
                raise RuntimeError(f"Unexpected non-full interior tile width at {row},{col}")
            if not np.array_equal(tile[:overlap, TILE_STRIDE], tile_arrays[right_key][:overlap, 0]):
                raise RuntimeError(f"Horizontal shared-edge seam mismatch at {row},{col}")
            horizontal_seams += 1
        lower_key = (row + 1, col)
        if lower_key in tile_arrays:
            upper_record = tile_records[(row, col)]
            lower_record = tile_records[lower_key]
            overlap = min(upper_record["valid_grid"][0], lower_record["valid_grid"][0])
            if upper_record["valid_grid"][1] != TILE_SIZE:
                raise RuntimeError(f"Unexpected non-full interior tile height at {row},{col}")
            if not np.array_equal(tile[TILE_STRIDE, :overlap], tile_arrays[lower_key][0, :overlap]):
                raise RuntimeError(f"Vertical shared-edge seam mismatch at {row},{col}")
            vertical_seams += 1

    built_ids = {record["id"] for record in manifest["tiles"]}
    if not set(manifest["anchor_tile_map"].values()).issubset(built_ids):
        raise RuntimeError("One or more requested anchor tiles were not built")

    receipt = {
        "schema": "guilin-v077-native-lod-validation/v1",
        "status": "passed",
        "source_sha256": EXPECTED_SOURCE_SHA256,
        "aoi_geometry_sha256": EXPECTED_AOI_SHA256,
        "tile_count": len(tile_arrays),
        "tile_ids": sorted(built_ids),
        "horizontal_shared_edges_checked": horizontal_seams,
        "vertical_shared_edges_checked": vertical_seams,
        "native_sample_identity": True,
        "padding_is_nodata_zero": True,
        "resampling": "none",
        "gap_fill_applied": False,
        "fallback_30m_used": False,
        "source_elevation_modified_m": 0.0,
        "vertical_scale": 1.0,
    }
    receipt_path = args.output_dir / "native_lod_validation.json"
    receipt_path.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(receipt, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
