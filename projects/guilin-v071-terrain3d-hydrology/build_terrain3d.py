from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image
import rasterio
from rasterio.enums import Resampling
from pyproj import Transformer

NODATA_CODE = np.uint16(65535)


def scaled_shape(width: int, height: int, max_width: int) -> tuple[int, int]:
    scale = min(1.0, max_width / width)
    return max(2, int(round(width * scale))), max(2, int(round(height * scale)))


def read_scaled(ds: rasterio.io.DatasetReader, max_width: int, resampling: Resampling):
    width, height = scaled_shape(ds.width, ds.height, max_width)
    data = ds.read(1, out_shape=(height, width), resampling=resampling).astype(np.float32)
    mask = ds.read_masks(1, out_shape=(height, width), resampling=Resampling.nearest) > 0
    return data, mask, width, height


def terrain_rgba(data: np.ndarray, mask: np.ndarray, p2: float, p98: float) -> np.ndarray:
    normalized = np.clip((data - p2) / max(p98 - p2, 1.0), 0.0, 1.0)
    stops = np.array([0.0, 0.15, 0.36, 0.58, 0.78, 1.0], dtype=np.float32)
    colors = np.array(
        [
            [15, 45, 30],
            [31, 78, 46],
            [68, 105, 61],
            [120, 132, 78],
            [166, 153, 111],
            [224, 222, 207],
        ],
        dtype=np.float32,
    )
    rgb = np.empty((*data.shape, 3), dtype=np.float32)
    for channel in range(3):
        rgb[..., channel] = np.interp(normalized, stops, colors[:, channel])

    fill = float(np.median(data[mask]))
    terrain = np.where(mask, data, fill)
    gy, gx = np.gradient(terrain)
    slope = np.arctan(np.hypot(gx, gy))
    aspect = np.arctan2(-gx, gy)
    azimuth = math.radians(315.0)
    altitude = math.radians(42.0)
    hillshade = (
        math.sin(altitude) * np.cos(slope)
        + math.cos(altitude) * np.sin(slope) * np.cos(azimuth - aspect)
    )
    hillshade = np.clip((hillshade + 1.0) * 0.5, 0.0, 1.0)
    rgb *= 0.44 + 0.76 * hillshade[..., None]
    rgb = np.clip(rgb, 0, 255).astype(np.uint8)
    alpha = np.where(mask, 255, 0).astype(np.uint8)
    return np.dstack([rgb, alpha])


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--mosaic", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--height-max-width", type=int, default=768)
    parser.add_argument("--texture-max-width", type=int, default=2048)
    args = parser.parse_args()

    args.output_dir.mkdir(parents=True, exist_ok=True)
    with rasterio.open(args.mosaic) as ds:
        if str(ds.crs) != "EPSG:32649":
            raise RuntimeError(f"Unexpected CRS: {ds.crs}")

        hdata, hmask, hwidth, hheight = read_scaled(ds, args.height_max_width, Resampling.bilinear)
        valid = hdata[hmask]
        if not valid.size:
            raise RuntimeError("DEM contains no valid cells")
        minimum = float(valid.min())
        maximum = float(valid.max())
        span = max(maximum - minimum, 1.0)

        encoded = np.full((hheight, hwidth), NODATA_CODE, dtype="<u2")
        encoded_valid = np.clip(np.rint((hdata[hmask] - minimum) / span * 65534.0), 0, 65534)
        encoded[hmask] = encoded_valid.astype(np.uint16)
        (args.output_dir / "terrain_height_u16.bin").write_bytes(encoded.tobytes(order="C"))

        tdata, tmask, twidth, theight = read_scaled(ds, args.texture_max_width, Resampling.bilinear)
        tvalid = tdata[tmask]
        p2, p98 = np.percentile(tvalid, [2.0, 98.0])
        rgba = terrain_rgba(tdata, tmask, float(p2), float(p98))
        Image.fromarray(rgba, mode="RGBA").save(
            args.output_dir / "terrain_texture.webp",
            format="WEBP",
            quality=91,
            method=6,
        )

        to_wgs84 = Transformer.from_crs("EPSG:32649", "EPSG:4326", always_xy=True)
        west, south, east, north = ds.bounds
        corners = [
            to_wgs84.transform(west, south),
            to_wgs84.transform(east, south),
            to_wgs84.transform(east, north),
            to_wgs84.transform(west, north),
        ]
        lon_values = [point[0] for point in corners]
        lat_values = [point[1] for point in corners]

        manifest = {
            "schema": "guilin-v071-terrain3d/v1",
            "crs": "EPSG:32649",
            "source_resolution_m": [abs(ds.transform.a), abs(ds.transform.e)],
            "source_grid": [ds.width, ds.height],
            "bounds_epsg32649": [west, south, east, north],
            "bounds_wgs84": [min(lon_values), min(lat_values), max(lon_values), max(lat_values)],
            "world_size_m": [east - west, north - south],
            "center_epsg32649": [(west + east) / 2.0, (south + north) / 2.0],
            "elevation_range_m": [minimum, maximum],
            "height": {
                "file": "terrain_height_u16.bin",
                "width": hwidth,
                "height": hheight,
                "encoding": "uint16-little-endian",
                "nodata_code": int(NODATA_CODE),
                "valid_min_code": 0,
                "valid_max_code": 65534,
            },
            "texture": {
                "file": "terrain_texture.webp",
                "width": twidth,
                "height": theight,
                "percentile_stretch_m": [float(p2), float(p98)],
                "alpha_is_valid_data_mask": True,
            },
            "vertical_scale": 1.0,
            "crop_applied": False,
            "gap_fill_applied": False,
            "source_mosaic": args.mosaic.name,
        }
        (args.output_dir / "terrain_manifest.json").write_text(
            json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )

    print(json.dumps(manifest, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
