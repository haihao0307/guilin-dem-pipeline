#!/usr/bin/env python3
"""Create the uncompressed authoritative Kunming reset crop.

The script fails closed unless the input file, spatial contract and pixel grid
match the approved baseline. The cropped master is written as uncompressed
float32 GeoTIFF with no internal overviews and no resampling.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
import rasterio
from rasterio.windows import Window

EXPECTED_SHA256 = "af95c47f55ab8ff25d33ddc96d07c6d85fc1fcd4c2a2de9e2bef51a015860c50"
EXPECTED_CRS = "EPSG:32648"
EXPECTED_RES = 12.5
EXPECTED_WIDTH = 10840
EXPECTED_HEIGHT = 18680
EXPECTED_BOUNDS = (209000.0, 2651625.0, 344500.0, 2885125.0)
WINDOW = Window(col_off=2790, row_off=5116, width=5892, height=8095)
OUTPUT_BOUNDS = (243875.0, 2719987.5, 317525.0, 2821175.0)


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def array_sha256(array: np.ndarray) -> str:
    contiguous = np.ascontiguousarray(array)
    return hashlib.sha256(contiguous.tobytes(order="C")).hexdigest()


def bounds_tuple(dataset: rasterio.io.DatasetReader) -> tuple[float, float, float, float]:
    return tuple(float(value) for value in dataset.bounds)


def close_tuple(actual: tuple[float, ...], expected: tuple[float, ...], tolerance: float = 1e-9) -> bool:
    return len(actual) == len(expected) and all(abs(a - e) <= tolerance for a, e in zip(actual, expected))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("input_cog", type=Path)
    parser.add_argument("output_tif", type=Path)
    parser.add_argument(
        "--report",
        type=Path,
        default=Path("KUNMING_BASELINE_RESET_CROP_UNCOMPRESSED_QA.json"),
    )
    args = parser.parse_args()

    source_file_sha = file_sha256(args.input_cog)
    if source_file_sha != EXPECTED_SHA256:
        raise SystemExit(f"Source SHA-256 mismatch: {source_file_sha}")

    with rasterio.open(args.input_cog) as source:
        if str(source.crs) != EXPECTED_CRS:
            raise SystemExit(f"Unexpected CRS: {source.crs}")
        if source.width != EXPECTED_WIDTH or source.height != EXPECTED_HEIGHT:
            raise SystemExit(f"Unexpected source grid: {source.width} x {source.height}")
        if not close_tuple((float(source.res[0]), abs(float(source.res[1]))), (EXPECTED_RES, EXPECTED_RES)):
            raise SystemExit(f"Unexpected resolution: {source.res}")
        if not close_tuple(bounds_tuple(source), EXPECTED_BOUNDS):
            raise SystemExit(f"Unexpected source bounds: {source.bounds}")
        if source.count != 1 or source.dtypes[0] != "float32":
            raise SystemExit(f"Unexpected source band contract: count={source.count}, dtype={source.dtypes}")

        data = source.read(1, window=WINDOW)
        source_pixel_sha = array_sha256(data)
        transform = source.window_transform(WINDOW)
        profile = source.profile.copy()

    for key in (
        "compress",
        "predictor",
        "zlevel",
        "jpeg_quality",
        "webp_level",
        "photometric",
    ):
        profile.pop(key, None)

    profile.update(
        driver="GTiff",
        dtype="float32",
        count=1,
        width=int(WINDOW.width),
        height=int(WINDOW.height),
        transform=transform,
        tiled=True,
        blockxsize=512,
        blockysize=512,
        compress="NONE",
        interleave="band",
        BIGTIFF="IF_SAFER",
    )

    args.output_tif.parent.mkdir(parents=True, exist_ok=True)
    with rasterio.open(args.output_tif, "w", **profile) as destination:
        destination.write(data, 1)
        destination.update_tags(
            AUTHORITATIVE_SOURCE_SHA256=EXPECTED_SHA256,
            PIXEL_DATA_SHA256=source_pixel_sha,
            STORAGE_COMPRESSION="NONE",
            RESAMPLING="NONE",
            INTERNAL_OVERVIEWS="NONE",
        )

    with rasterio.open(args.output_tif) as result:
        result_profile = result.profile.copy()
        result_compression = result_profile.get("compress")
        if result_compression not in (None, "none", "NONE"):
            raise SystemExit(f"Output is compressed: {result_compression}")
        if result.overviews(1):
            raise SystemExit(f"Output contains internal overviews: {result.overviews(1)}")
        if result.width != int(WINDOW.width) or result.height != int(WINDOW.height):
            raise SystemExit(f"Unexpected output grid: {result.width} x {result.height}")
        if str(result.crs) != EXPECTED_CRS:
            raise SystemExit(f"Unexpected output CRS: {result.crs}")
        if result.dtypes[0] != "float32":
            raise SystemExit(f"Unexpected output dtype: {result.dtypes[0]}")
        if not close_tuple((float(result.res[0]), abs(float(result.res[1]))), (EXPECTED_RES, EXPECTED_RES)):
            raise SystemExit(f"Unexpected output resolution: {result.res}")
        if not close_tuple(bounds_tuple(result), OUTPUT_BOUNDS):
            raise SystemExit(f"Unexpected output bounds: {result.bounds}")
        output_data = result.read(1)

    output_pixel_sha = array_sha256(output_data)
    if output_pixel_sha != source_pixel_sha or not np.array_equal(output_data, data, equal_nan=True):
        raise SystemExit("Output pixel values differ from the authoritative source window")

    nodata = profile.get("nodata", -32768.0)
    valid = np.isfinite(data) & (data != nodata)
    report = {
        "status": "complete",
        "source_file": str(args.input_cog),
        "source_file_sha256": source_file_sha,
        "source_pixel_window_sha256": source_pixel_sha,
        "output_file": str(args.output_tif),
        "output_file_sha256": file_sha256(args.output_tif),
        "output_pixel_sha256": output_pixel_sha,
        "pixel_values_identical_to_source_window": True,
        "storage_compression": "NONE",
        "internal_overviews": [],
        "resampling": "NONE",
        "dtype": "float32",
        "crs": EXPECTED_CRS,
        "pixel_spacing_m": EXPECTED_RES,
        "window_col_row_width_height": [2790, 5116, 5892, 8095],
        "bounds_epsg32648": list(OUTPUT_BOUNDS),
        "grid_width": 5892,
        "grid_height": 8095,
        "width_m": 73650.0,
        "height_m": 101187.5,
        "area_km2": 7452.459375,
        "valid_fraction": float(valid.mean()),
        "elevation_min_m": float(data[valid].min()),
        "elevation_max_m": float(data[valid].max()),
        "elevation_mean_m": float(data[valid].mean()),
    }
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
