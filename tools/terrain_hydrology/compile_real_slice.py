#!/usr/bin/env python3
"""Compile an exact, grid-aligned real DEM slice for the terrain/hydrology workbench.

The script never resamples source elevations. It validates the expected source
SHA256, reads an integer pixel window, writes a float32 display stream plus a
validity mask, and records all lineage in a manifest. The source DEM remains
read-only.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

try:
    from osgeo import gdal, osr
except ImportError as exc:  # pragma: no cover - environment dependent
    raise SystemExit("GDAL Python bindings are required: from osgeo import gdal, osr") from exc

try:
    import numpy as np
except ImportError as exc:  # pragma: no cover - environment dependent
    raise SystemExit("NumPy is required for exact raster window export") from exc


def sha256_file(path: Path, chunk_size: int = 8 * 1024 * 1024) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        while chunk := stream.read(chunk_size):
            digest.update(chunk)
    return digest.hexdigest()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--region", choices=("guilin", "wenzhou", "kunming"), required=True)
    parser.add_argument("--source-id", required=True)
    parser.add_argument("--expected-sha256", required=True)
    parser.add_argument("--expected-crs", required=True, help="Example: EPSG:32651")
    parser.add_argument("--center-x", type=float)
    parser.add_argument("--center-y", type=float)
    parser.add_argument("--width-m", type=float, default=10_000.0)
    parser.add_argument("--height-m", type=float, default=10_000.0)
    parser.add_argument("--expected-spacing-m", type=float, default=12.5)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--overwrite", action="store_true")
    return parser.parse_args()


def dataset_epsg(dataset: gdal.Dataset) -> str:
    reference = osr.SpatialReference()
    reference.ImportFromWkt(dataset.GetProjectionRef())
    reference.AutoIdentifyEPSG()
    code = reference.GetAuthorityCode(None) or reference.GetAuthorityCode("PROJCS")
    return f"EPSG:{code}" if code else "unknown"


def main() -> int:
    args = parse_args()
    source = args.source.resolve()
    if not source.is_file():
        raise SystemExit(f"Source DEM does not exist: {source}")
    expected_sha = args.expected_sha256.lower()
    actual_sha = sha256_file(source)
    if actual_sha != expected_sha:
        raise SystemExit(f"Source SHA256 mismatch: expected {expected_sha}, got {actual_sha}")

    gdal.UseExceptions()
    dataset = gdal.Open(str(source), gdal.GA_ReadOnly)
    if dataset is None:
        raise SystemExit(f"GDAL could not open: {source}")
    if dataset.RasterCount < 1:
        raise SystemExit("Source DEM has no raster band")

    gt = dataset.GetGeoTransform(can_return_null=True)
    if gt is None:
        raise SystemExit("Source DEM has no geotransform")
    if abs(gt[2]) > 1e-9 or abs(gt[4]) > 1e-9:
        raise SystemExit("Rotated geotransforms are not accepted by this exact-window compiler")
    pixel_x = float(gt[1])
    pixel_y = abs(float(gt[5]))
    if pixel_x <= 0 or gt[5] >= 0:
        raise SystemExit("Expected north-up DEM with positive X and negative Y pixel size")
    if not math.isclose(pixel_x, args.expected_spacing_m, abs_tol=1e-6) or not math.isclose(pixel_y, args.expected_spacing_m, abs_tol=1e-6):
        raise SystemExit(f"Pixel spacing mismatch: {(pixel_x, pixel_y)}")

    crs = dataset_epsg(dataset)
    if crs != args.expected_crs:
        raise SystemExit(f"CRS mismatch: expected {args.expected_crs}, got {crs}")

    raster_width = dataset.RasterXSize
    raster_height = dataset.RasterYSize
    source_min_x = gt[0]
    source_max_y = gt[3]
    source_max_x = source_min_x + raster_width * pixel_x
    source_min_y = source_max_y - raster_height * pixel_y
    center_x = args.center_x if args.center_x is not None else (source_min_x + source_max_x) / 2
    center_y = args.center_y if args.center_y is not None else (source_min_y + source_max_y) / 2

    columns = round(args.width_m / pixel_x)
    rows = round(args.height_m / pixel_y)
    if not math.isclose(columns * pixel_x, args.width_m, abs_tol=1e-6):
        raise SystemExit("Requested width is not an integer number of source pixels")
    if not math.isclose(rows * pixel_y, args.height_m, abs_tol=1e-6):
        raise SystemExit("Requested height is not an integer number of source pixels")

    desired_min_x = center_x - args.width_m / 2
    desired_max_y = center_y + args.height_m / 2
    x_offset = round((desired_min_x - source_min_x) / pixel_x)
    y_offset = round((source_max_y - desired_max_y) / pixel_y)
    if x_offset < 0 or y_offset < 0 or x_offset + columns > raster_width or y_offset + rows > raster_height:
        raise SystemExit("Requested slice lies outside the source raster")

    min_x = source_min_x + x_offset * pixel_x
    max_y = source_max_y - y_offset * pixel_y
    max_x = min_x + columns * pixel_x
    min_y = max_y - rows * pixel_y

    output_dir = args.output_dir.resolve()
    if output_dir.exists() and any(output_dir.iterdir()) and not args.overwrite:
        raise SystemExit(f"Output directory is not empty: {output_dir}. Use --overwrite after review.")
    output_dir.mkdir(parents=True, exist_ok=True)

    band = dataset.GetRasterBand(1)
    nodata = band.GetNoDataValue()
    array = band.ReadAsArray(x_offset, y_offset, columns, rows)
    if array is None:
        raise SystemExit("GDAL failed to read the source window")
    heights = np.asarray(array, dtype="<f4")
    valid = np.isfinite(heights)
    if nodata is not None:
        valid &= heights != np.float32(nodata)
    if not valid.any():
        raise SystemExit("The requested slice contains no valid elevation samples")

    display_heights = heights.copy()
    display_heights[~valid] = np.nan
    height_path = output_dir / "height_f32.bin"
    mask_path = output_dir / "valid_u8.bin"
    display_heights.tofile(height_path)
    valid.astype(np.uint8).tofile(mask_path)

    cog_path = output_dir / "truth-slice.tif"
    translate_options: dict[str, Any] = {
        "srcWin": [x_offset, y_offset, columns, rows],
        "outputType": band.DataType,
    }
    if gdal.GetDriverByName("COG"):
        translate_options.update({"format": "COG", "creationOptions": ["COMPRESS=DEFLATE", "BLOCKSIZE=512", "OVERVIEWS=IGNORE_EXISTING"]})
    else:
        translate_options.update({"format": "GTiff", "creationOptions": ["TILED=YES", "COMPRESS=DEFLATE", "BLOCKXSIZE=512", "BLOCKYSIZE=512"]})
    gdal.Translate(str(cog_path), dataset, options=gdal.TranslateOptions(**translate_options))

    valid_values = display_heights[valid]
    manifest = {
        "schemaVersion": "terrain-hydrology-real-slice@1.0.0",
        "generatedAtUtc": datetime.now(timezone.utc).isoformat(),
        "region": args.region,
        "source": {
            "id": args.source_id,
            "file": source.name,
            "sha256": actual_sha,
            "bytes": source.stat().st_size,
            "crs": crs,
            "grid": [raster_width, raster_height],
            "bounds": [source_min_x, source_min_y, source_max_x, source_max_y],
            "spacingMeters": [pixel_x, pixel_y],
            "readOnly": True,
        },
        "slice": {
            "pixelWindow": [x_offset, y_offset, columns, rows],
            "grid": [columns, rows],
            "bounds": [min_x, min_y, max_x, max_y],
            "centerProjected": [(min_x + max_x) / 2, (min_y + max_y) / 2],
            "widthMeters": columns * pixel_x,
            "heightMeters": rows * pixel_y,
            "areaKm2": columns * pixel_x * rows * pixel_y / 1_000_000,
            "resampled": False,
            "validFraction": float(valid.mean()),
            "nodata": nodata,
            "minimumElevationMeters": float(valid_values.min()),
            "maximumElevationMeters": float(valid_values.max()),
            "meanElevationMeters": float(valid_values.mean()),
        },
        "runtimeAssets": {
            "height": {
                "path": height_path.name,
                "sampleType": "float32",
                "byteOrder": "little-endian",
                "sha256": sha256_file(height_path),
                "bytes": height_path.stat().st_size,
            },
            "validMask": {
                "path": mask_path.name,
                "sampleType": "uint8",
                "sha256": sha256_file(mask_path),
                "bytes": mask_path.stat().st_size,
            },
            "truthSlice": {
                "path": cog_path.name,
                "sha256": sha256_file(cog_path),
                "bytes": cog_path.stat().st_size,
            },
        },
        "policy": {
            "truthOverwrite": False,
            "syntheticGapFill": False,
            "resampling": False,
            "vegetationIncluded": False,
            "allowedProductionLayers": ["terrain", "terrace", "hydrology"],
        },
    }
    manifest_path = output_dir / "slice-manifest.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"passed": True, "manifest": str(manifest_path), "slice": manifest["slice"], "runtimeAssets": manifest["runtimeAssets"]}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
