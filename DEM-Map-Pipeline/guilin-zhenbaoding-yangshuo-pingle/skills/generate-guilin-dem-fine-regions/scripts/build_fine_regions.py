from __future__ import annotations

import argparse
import hashlib
import json
import math
import sys
from datetime import datetime, timezone
from pathlib import Path

REGIONS = [
    {"id": "zhenbao-ding", "name": "真宝鼎", "longitude": 110.82528, "latitude": 26.13556},
    {"id": "yangtang-airfield", "name": "秧塘机场旧址", "longitude": 110.15569, "latitude": 25.21753},
    {"id": "yangshuo-county-seat", "name": "阳朔县城", "longitude": 110.4920133, "latitude": 24.7815129},
]
AREA_M2 = 200_000_000.0
SIDE_M = math.sqrt(AREA_M2)
TARGET_CRS = "EPSG:32649"
TARGET_RESOLUTION_M = 1.0


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(4 * 1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def plan() -> dict:
    from pyproj import Transformer

    transformer = Transformer.from_crs("EPSG:4326", TARGET_CRS, always_xy=True)
    regions = []
    for item in REGIONS:
        x, y = transformer.transform(item["longitude"], item["latitude"])
        half = SIDE_M / 2
        regions.append({
            **item,
            "areaSquareKilometers": AREA_M2 / 1_000_000.0,
            "sideMeters": SIDE_M,
            "targetCrs": TARGET_CRS,
            "targetResolutionMeters": TARGET_RESOLUTION_M,
            "centerProjected": [x, y],
            "boundsProjected": [x - half, y - half, x + half, y + half],
            "status": "awaiting_real_1m_source",
        })
    return {
        "schemaVersion": "guilin-fine-regions/v1",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "accuracyPolicy": "source_ground_resolution_must_be_lte_1m_no_upsampling_claim",
        "regions": regions,
    }


def build(source_path: Path, output_dir: Path, report: dict) -> None:
    import numpy as np
    import rasterio
    from rasterio.enums import Resampling
    from rasterio.shutil import copy as rio_copy
    from rasterio.transform import from_origin
    from rasterio.vrt import WarpedVRT
    from rasterio.warp import calculate_default_transform
    from rasterio.windows import Window

    with rasterio.open(source_path) as source:
        if source.crs is None:
            raise RuntimeError("Source DEM has no CRS")
        estimated, _, _ = calculate_default_transform(
            source.crs, TARGET_CRS, source.width, source.height, *source.bounds
        )
        estimated_resolution = max(abs(estimated.a), abs(estimated.e))
        report["source"] = {
            "file": source_path.name,
            "sha256": sha256(source_path),
            "crs": source.crs.to_string(),
            "estimatedGroundResolutionMeters": estimated_resolution,
            "nodata": source.nodata,
        }
        if estimated_resolution > TARGET_RESOLUTION_M * 1.001:
            raise RuntimeError(
                f"Source ground resolution {estimated_resolution:.3f} m is coarser than 1 m; "
                "upsampling cannot create real 1 m DEM accuracy"
            )
        output_dir.mkdir(parents=True, exist_ok=True)
        nodata = float(source.nodata) if source.nodata is not None else -32768.0
        for region in report["regions"]:
            left, bottom, right, top = region["boundsProjected"]
            width = height = int(math.ceil(SIDE_M / TARGET_RESOLUTION_M))
            transform = from_origin(left, top, TARGET_RESOLUTION_M, TARGET_RESOLUTION_M)
            temporary = output_dir / f"{region['id']}.working.tif"
            output = output_dir / f"{region['id']}-1m-cog.tif"
            profile = {
                "driver": "GTiff", "width": width, "height": height, "count": 1,
                "dtype": "float32", "crs": TARGET_CRS, "transform": transform,
                "nodata": nodata, "tiled": True, "blockxsize": 512, "blockysize": 512,
                "compress": "DEFLATE", "predictor": 3, "BIGTIFF": "IF_SAFER",
            }
            valid_count = 0
            with WarpedVRT(
                source, crs=TARGET_CRS, transform=transform, width=width, height=height,
                src_nodata=source.nodata, nodata=nodata, dtype="float32",
                resampling=Resampling.bilinear,
            ) as vrt, rasterio.open(temporary, "w", **profile) as destination:
                for row in range(0, height, 512):
                    for col in range(0, width, 512):
                        window = Window(col, row, min(512, width - col), min(512, height - row))
                        data = vrt.read(1, window=window, masked=True)
                        valid_count += int(np.count_nonzero(~np.ma.getmaskarray(data)))
                        destination.write(data.filled(nodata).astype("float32"), 1, window=window)
            coverage = valid_count / (width * height)
            if coverage < 0.9999:
                temporary.unlink(missing_ok=True)
                raise RuntimeError(f"{region['name']} source coverage is only {coverage:.6f}")
            rio_copy(temporary, output, driver="COG", compress="DEFLATE", predictor=3,
                     blocksize=512, overview_resampling="AVERAGE", BIGTIFF="IF_SAFER")
            temporary.unlink(missing_ok=True)
            region.update({
                "status": "complete_real_1m_source",
                "gridWidth": width, "gridHeight": height, "validFraction": coverage,
                "output": str(output), "outputSha256": sha256(output),
            })


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source")
    parser.add_argument("--output-dir")
    parser.add_argument("--report", required=True)
    parser.add_argument("--plan-only", action="store_true")
    args = parser.parse_args()
    try:
        report = plan()
        if not args.plan_only:
            if not args.source or not args.output_dir:
                raise RuntimeError("--source and --output-dir are required unless --plan-only is used")
            build(Path(args.source).resolve(), Path(args.output_dir).resolve(), report)
        report_path = Path(args.report).resolve()
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(report_path)
        return 0
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
