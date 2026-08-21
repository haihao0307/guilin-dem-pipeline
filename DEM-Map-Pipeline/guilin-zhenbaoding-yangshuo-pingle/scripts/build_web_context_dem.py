from __future__ import annotations

import argparse
import math
import sys
from pathlib import Path

import numpy as np
import rasterio
from rasterio.enums import Resampling
from rasterio.shutil import copy as rio_copy
from rasterio.transform import from_origin
from rasterio.warp import reproject, transform_bounds

from common import read_json, sha256_file, utc_now, write_json


class PipelineError(RuntimeError):
    pass


def run(config_path: Path, root: Path) -> int:
    config = read_json(config_path)
    context = config.get("webContext", {})
    bounds = context.get("boundsWgs84")
    if not isinstance(bounds, list) or len(bounds) != 4:
        raise PipelineError("webContext.boundsWgs84 is required")
    target_crs = config.get("processing", {}).get("outputCrs", "EPSG:32649")
    resolution = float(context.get("outputPixelSpacingMeters", 30.0))
    nodata = float(config.get("processing", {}).get("nodata", -32768.0))
    projected = transform_bounds("EPSG:4326", target_crs, *map(float, bounds), densify_pts=41)
    left = math.floor(projected[0] / resolution) * resolution
    bottom = math.floor(projected[1] / resolution) * resolution
    right = math.ceil(projected[2] / resolution) * resolution
    top = math.ceil(projected[3] / resolution) * resolution
    width = int(round((right - left) / resolution))
    height = int(round((top - bottom) / resolution))
    dst_transform = from_origin(left, top, resolution, resolution)
    destination = np.full((height, width), nodata, dtype=np.float32)

    sources = sorted((root / "data" / "raw" / "dem").glob("MAPZEN_*_dem.tif"))
    if not sources:
        raise PipelineError("No downloaded Mapzen DEM tiles were found")
    for index, source_path in enumerate(sources):
        with rasterio.open(source_path) as source:
            reproject(
                source=rasterio.band(source, 1),
                destination=destination,
                src_transform=source.transform,
                src_crs=source.crs,
                src_nodata=source.nodata,
                dst_transform=dst_transform,
                dst_crs=target_crs,
                dst_nodata=nodata,
                resampling=Resampling.bilinear,
                init_dest_nodata=index == 0,
            )

    valid = np.isfinite(destination) & (destination != nodata)
    valid_fraction = float(valid.mean())
    minimum = float(context.get("minimumValidFraction", 0.9999))
    if valid_fraction < minimum:
        raise PipelineError(f"Real DEM coverage {valid_fraction:.6f} is below {minimum:.6f}")

    output = root / context["output"]
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_suffix(".working.tif")
    profile = {
        "driver": "GTiff", "width": width, "height": height, "count": 1,
        "dtype": "float32", "crs": target_crs, "transform": dst_transform,
        "nodata": nodata, "tiled": True, "blockxsize": 512, "blockysize": 512,
        "compress": "DEFLATE", "predictor": 3, "BIGTIFF": "IF_SAFER",
    }
    with rasterio.open(temporary, "w", **profile) as dataset:
        dataset.write(destination, 1)
        dataset.update_tags(
            SOURCE_PROVIDER="AWS Open Data Terrain Tiles",
            SOURCE_FORMAT="Mapzen Skadi SRTM HGT",
            COVERAGE_POLICY="DOWNLOADED_SOURCE_ONLY_NO_EXTRAPOLATION",
        )
    rio_copy(temporary, output, driver="COG", compress="DEFLATE", predictor=3,
             blocksize=512, overview_resampling="AVERAGE", BIGTIFF="IF_SAFER")
    temporary.unlink(missing_ok=True)
    report = {
        "generatedAt": utc_now(), "status": "complete", "output": str(output),
        "sha256": sha256_file(output), "sourceTileCount": len(sources),
        "sourceTiles": [path.name for path in sources], "boundsWgs84Requested": bounds,
        "boundsProjected": [left, bottom, right, top], "crs": target_crs,
        "resolutionMeters": resolution, "width": width, "height": height,
        "validFraction": valid_fraction, "visualFillApplied": False,
    }
    write_json(root / "reports" / "WEB_CONTEXT_QA.json", report)
    print(f"真实网页环境 DEM：{output}，覆盖率 {valid_fraction:.6f}，源片 {len(sources)} 张")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", required=True)
    parser.add_argument("--root", required=True)
    args = parser.parse_args()
    try:
        return run(Path(args.config).resolve(), Path(args.root).resolve())
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
