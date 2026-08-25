#!/usr/bin/env python3
"""Create the authoritative Kunming reset crop from the original COG.

The script fails closed unless the input SHA-256 matches the approved baseline.
"""
from __future__ import annotations
import argparse, hashlib, json
from pathlib import Path
import numpy as np
import rasterio
from rasterio.enums import Resampling
from rasterio.windows import Window

EXPECTED_SHA256 = "af95c47f55ab8ff25d33ddc96d07c6d85fc1fcd4c2a2de9e2bef51a015860c50"
WINDOW = Window(col_off=2790, row_off=5116, width=5892, height=8095)
EXPECTED_CRS = "EPSG:32648"
EXPECTED_RES = 12.5


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("input_cog", type=Path)
    ap.add_argument("output_cog", type=Path)
    ap.add_argument("--report", type=Path, default=Path("KUNMING_BASELINE_RESET_CROP_QA.json"))
    args = ap.parse_args()

    actual = sha256(args.input_cog)
    if actual != EXPECTED_SHA256:
        raise SystemExit(f"Source SHA-256 mismatch: {actual}")

    with rasterio.open(args.input_cog) as src:
        if str(src.crs) != EXPECTED_CRS:
            raise SystemExit(f"Unexpected CRS: {src.crs}")
        if abs(src.res[0] - EXPECTED_RES) > 1e-9 or abs(abs(src.res[1]) - EXPECTED_RES) > 1e-9:
            raise SystemExit(f"Unexpected resolution: {src.res}")
        data = src.read(1, window=WINDOW)
        transform = src.window_transform(WINDOW)
        profile = src.profile.copy()
        profile.update(
            driver="GTiff", width=int(WINDOW.width), height=int(WINDOW.height),
            transform=transform, tiled=True, blockxsize=512, blockysize=512,
            compress="DEFLATE", predictor=3, BIGTIFF="IF_SAFER"
        )
        args.output_cog.parent.mkdir(parents=True, exist_ok=True)
        with rasterio.open(args.output_cog, "w", **profile) as dst:
            dst.write(data, 1)
            factors = [2, 4, 8, 16, 32, 64]
            dst.build_overviews(factors, Resampling.average)
            dst.update_tags(ns="rio_overview", resampling="average")

    valid = np.isfinite(data) & (data != profile.get("nodata", -32768.0))
    report = {
        "status": "complete",
        "source_file": str(args.input_cog),
        "source_sha256": actual,
        "output_file": str(args.output_cog),
        "output_sha256": sha256(args.output_cog),
        "crs": EXPECTED_CRS,
        "pixel_spacing_m": EXPECTED_RES,
        "window_col_row_width_height": [2790, 5116, 5892, 8095],
        "bounds_epsg32648": [243875.0, 2719987.5, 317525.0, 2821175.0],
        "grid_width": 5892,
        "grid_height": 8095,
        "width_m": 73650.0,
        "height_m": 101187.5,
        "area_km2": 7452.459375,
        "valid_fraction": float(valid.mean()),
        "elevation_min_m": float(data[valid].min()),
        "elevation_max_m": float(data[valid].max()),
        "elevation_mean_m": float(data[valid].mean())
    }
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
