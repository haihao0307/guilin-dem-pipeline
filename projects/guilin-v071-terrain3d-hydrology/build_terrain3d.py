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
from scipy.ndimage import gaussian_filter

NODATA_CODE = np.uint16(65535)


def scaled_shape(width: int, height: int, max_width: int) -> tuple[int, int]:
    scale = min(1.0, max_width / width)
    return max(2, int(round(width * scale))), max(2, int(round(height * scale)))


def read_scaled(ds: rasterio.io.DatasetReader, max_width: int, resampling: Resampling):
    width, height = scaled_shape(ds.width, ds.height, max_width)
    data = ds.read(1, out_shape=(height, width), resampling=resampling).astype(np.float32)
    mask = ds.read_masks(1, out_shape=(height, width), resampling=Resampling.nearest) > 0
    return data, mask, width, height


def smoothstep(edge0: float, edge1: float, values: np.ndarray) -> np.ndarray:
    t = np.clip((values - edge0) / max(edge1 - edge0, 1e-6), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def weighted_gaussian(data: np.ndarray, mask: np.ndarray, sigma: float) -> np.ndarray:
    weights = gaussian_filter(mask.astype(np.float32), sigma=sigma, mode="nearest")
    numerator = gaussian_filter(np.where(mask, data, 0.0).astype(np.float32), sigma=sigma, mode="nearest")
    return numerator / np.maximum(weights, 1e-5)


def robust_scale(values: np.ndarray, mask: np.ndarray, percentile: float = 97.0) -> float:
    valid = np.abs(values[mask])
    if not valid.size:
        return 1.0
    scale = float(np.percentile(valid, percentile))
    return max(scale, 1e-6)


def palette(normalized: np.ndarray) -> np.ndarray:
    stops = np.array([0.0, 0.11, 0.28, 0.50, 0.68, 0.84, 1.0], dtype=np.float32)
    colors = np.array(
        [
            [17, 55, 35],
            [25, 81, 44],
            [51, 105, 53],
            [87, 126, 67],
            [132, 139, 87],
            [177, 169, 124],
            [222, 220, 203],
        ],
        dtype=np.float32,
    )
    rgb = np.empty((*normalized.shape, 3), dtype=np.float32)
    for channel in range(3):
        rgb[..., channel] = np.interp(normalized, stops, colors[:, channel])
    return rgb


def hillshade(slope: np.ndarray, aspect: np.ndarray, azimuth_deg: float, altitude_deg: float) -> np.ndarray:
    azimuth = math.radians(azimuth_deg)
    altitude = math.radians(altitude_deg)
    shade = (
        math.sin(altitude) * np.cos(slope)
        + math.cos(altitude) * np.sin(slope) * np.cos(azimuth - aspect)
    )
    return np.clip((shade + 1.0) * 0.5, 0.0, 1.0)


def mix_color(rgb: np.ndarray, target: tuple[float, float, float], amount: np.ndarray) -> np.ndarray:
    amount3 = np.clip(amount, 0.0, 1.0)[..., None]
    return rgb * (1.0 - amount3) + np.asarray(target, dtype=np.float32) * amount3


def terrain_products(
    data: np.ndarray,
    mask: np.ndarray,
    p2: float,
    p98: float,
    pixel_size_x: float,
    pixel_size_y: float,
) -> tuple[np.ndarray, np.ndarray, dict]:
    valid = data[mask]
    fill = float(np.median(valid))
    broad_fill = weighted_gaussian(data, mask, 18.0)
    terrain = np.where(mask, data, np.where(np.isfinite(broad_fill), broad_fill, fill)).astype(np.float32)

    gy, gx = np.gradient(terrain, pixel_size_y, pixel_size_x)
    slope = np.arctan(np.hypot(gx, gy))
    slope_deg = np.degrees(slope)
    aspect = np.arctan2(-gx, gy)

    shade_nw = hillshade(slope, aspect, 315.0, 43.0)
    shade_ne = hillshade(slope, aspect, 45.0, 37.0)
    shade_sw = hillshade(slope, aspect, 225.0, 31.0)
    multidirectional = np.clip(0.54 * shade_nw + 0.28 * shade_ne + 0.18 * shade_sw, 0.0, 1.0)

    smooth_small = weighted_gaussian(data, mask, 1.35)
    smooth_medium = weighted_gaussian(data, mask, 6.5)
    smooth_large = weighted_gaussian(data, mask, 23.0)
    tpi_small = terrain - smooth_small
    tpi_medium = terrain - smooth_medium
    tpi_large = terrain - smooth_large

    d2y = np.gradient(np.gradient(smooth_small, pixel_size_y, axis=0), pixel_size_y, axis=0)
    d2x = np.gradient(np.gradient(smooth_small, pixel_size_x, axis=1), pixel_size_x, axis=1)
    curvature = d2x + d2y

    height_normalized = np.clip((terrain - p2) / max(p98 - p2, 1.0), 0.0, 1.0)
    rgb = palette(height_normalized)

    small_scale = robust_scale(tpi_small, mask)
    medium_scale = robust_scale(tpi_medium, mask)
    large_scale = robust_scale(tpi_large, mask)
    curvature_scale = robust_scale(curvature, mask)

    convex = smoothstep(0.0, medium_scale, tpi_medium)
    concave = smoothstep(0.0, medium_scale, -tpi_medium)
    ridge = smoothstep(0.0, large_scale, tpi_large)
    local_relief = smoothstep(0.0, medium_scale, np.abs(tpi_medium))
    steep = smoothstep(15.0, 48.0, slope_deg)
    very_steep = smoothstep(31.0, 61.0, slope_deg)
    curvature_positive = smoothstep(0.0, curvature_scale, curvature)

    karst = np.clip(
        steep
        * (0.34 + 0.66 * local_relief)
        * (0.56 + 0.44 * np.maximum(convex, ridge)),
        0.0,
        1.0,
    )
    rock = np.clip(
        0.78 * very_steep * (0.42 + 0.58 * np.maximum(convex, curvature_positive))
        + 0.24 * karst,
        0.0,
        1.0,
    )
    valley = np.clip(concave * (1.0 - 0.55 * steep), 0.0, 1.0)
    gentle_low = np.clip((1.0 - steep) * (1.0 - height_normalized) * 0.82, 0.0, 1.0)

    rgb = mix_color(rgb, (20, 88, 49), gentle_low * 0.28)
    rgb = mix_color(rgb, (18, 68, 43), valley * 0.30)
    rgb = mix_color(rgb, (196, 187, 153), rock * 0.68)
    rgb = mix_color(rgb, (214, 210, 187), karst * ridge * 0.18)

    local_detail = np.tanh(tpi_small / small_scale)
    shade_factor = 0.62 + 0.62 * multidirectional
    ambient_occlusion = 1.0 - 0.19 * valley - 0.08 * local_relief
    ridge_light = 1.0 + 0.09 * ridge + 0.05 * convex
    detail_contrast = 1.0 + 0.12 * local_detail
    rgb *= (shade_factor * ambient_occlusion * ridge_light * detail_contrast)[..., None]

    luminance = np.sum(rgb * np.array([0.2126, 0.7152, 0.0722], dtype=np.float32), axis=2)
    rgb = luminance[..., None] + (rgb - luminance[..., None]) * 1.18
    rgb = np.clip(rgb, 0, 255)

    alpha = np.where(mask, 255, 0).astype(np.uint8)
    rgba = np.dstack([rgb.astype(np.uint8), alpha])

    detail_height = tpi_small + 0.36 * tpi_medium + curvature * (curvature_scale * 0.35)
    detail_values = detail_height[mask]
    detail_lo, detail_hi = np.percentile(detail_values, [1.5, 98.5])
    if detail_hi <= detail_lo:
        detail_hi = detail_lo + 1.0
    detail_normalized = np.clip((detail_height - detail_lo) / (detail_hi - detail_lo), 0.0, 1.0)
    detail_normalized = np.clip(0.5 + (detail_normalized - 0.5) * 1.28, 0.0, 1.0)
    detail_map = np.where(mask, np.rint(detail_normalized * 255.0), 128).astype(np.uint8)

    stats = {
        "style_version": "xiaogui-karst-rich-v1",
        "color_saturation_boost": 1.18,
        "karst_default_strength": 0.72,
        "karst_candidate_fraction": float(np.mean(karst[mask] > 0.50)),
        "rock_candidate_fraction": float(np.mean(rock[mask] > 0.50)),
        "slope_degrees_p95": float(np.percentile(slope_deg[mask], 95.0)),
        "detail_percentiles": [float(detail_lo), float(detail_hi)],
        "pixel_size_m": [float(pixel_size_x), float(pixel_size_y)],
    }
    return rgba, detail_map, stats


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--mosaic", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--height-max-width", type=int, default=1024)
    parser.add_argument("--texture-max-width", type=int, default=4096)
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
        pixel_size_x = (ds.bounds.right - ds.bounds.left) / twidth
        pixel_size_y = (ds.bounds.top - ds.bounds.bottom) / theight
        rgba, detail_map, style_stats = terrain_products(
            tdata,
            tmask,
            float(p2),
            float(p98),
            float(pixel_size_x),
            float(pixel_size_y),
        )
        Image.fromarray(rgba, mode="RGBA").save(
            args.output_dir / "terrain_texture.webp",
            format="WEBP",
            quality=94,
            method=6,
        )
        Image.fromarray(detail_map, mode="L").save(
            args.output_dir / "terrain_detail.webp",
            format="WEBP",
            quality=95,
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
            "schema": "guilin-v072-terrain3d/v1",
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
            "detail": {
                "file": "terrain_detail.webp",
                "width": twidth,
                "height": theight,
                "encoding": "grayscale derived from multi-scale local relief and curvature",
                "source_elevation_changed": False,
            },
            "terrain_style": style_stats,
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
