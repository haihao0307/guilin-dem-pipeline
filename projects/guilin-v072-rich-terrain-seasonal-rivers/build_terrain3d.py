from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter
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


def smoothstep(value: np.ndarray, edge0: float, edge1: float) -> np.ndarray:
    if edge1 <= edge0:
        raise ValueError("edge1 must be greater than edge0")
    t = np.clip((value - edge0) / (edge1 - edge0), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def gaussian_blur(field: np.ndarray, radius: float) -> np.ndarray:
    image = Image.fromarray(field.astype(np.float32), mode="F")
    return np.asarray(image.filter(ImageFilter.GaussianBlur(radius=radius)), dtype=np.float32)


def color_ramp(normalized: np.ndarray) -> np.ndarray:
    stops = np.array([0.0, 0.10, 0.24, 0.42, 0.61, 0.78, 1.0], dtype=np.float32)
    colors = np.array(
        [
            [9, 48, 33],
            [20, 73, 41],
            [43, 99, 53],
            [78, 119, 66],
            [124, 134, 82],
            [170, 157, 116],
            [226, 223, 210],
        ],
        dtype=np.float32,
    )
    rgb = np.empty((*normalized.shape, 3), dtype=np.float32)
    for channel in range(3):
        rgb[..., channel] = np.interp(normalized, stops, colors[:, channel])
    return rgb


def build_rich_terrain_products(
    data: np.ndarray,
    mask: np.ndarray,
    bounds: rasterio.coords.BoundingBox,
) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray, dict]:
    valid = data[mask]
    p1, p2, p50, p98, p995 = np.percentile(valid, [1.0, 2.0, 50.0, 98.0, 99.5])
    fill = float(p50)
    terrain = np.where(mask, data, fill).astype(np.float32)

    height, width = data.shape
    xres = (bounds.right - bounds.left) / width
    yres = (bounds.top - bounds.bottom) / height
    grad_y, grad_x = np.gradient(terrain, yres, xres)
    slope_radians = np.arctan(np.hypot(grad_x, grad_y))
    slope_degrees = np.degrees(slope_radians)
    aspect = np.arctan2(-grad_x, grad_y)

    broad = gaussian_blur(terrain, max(2.0, width / 170.0))
    local = gaussian_blur(terrain, max(1.0, width / 700.0))
    local_relief = terrain - broad
    micro_relief = terrain - local

    d2x = np.gradient(grad_x, xres, axis=1)
    d2y = np.gradient(grad_y, yres, axis=0)
    curvature = d2x + d2y

    relief_scale = max(float(np.percentile(np.abs(local_relief[mask]), 94.0)), 1.0)
    micro_scale = max(float(np.percentile(np.abs(micro_relief[mask]), 96.0)), 1.0)
    curvature_scale = max(float(np.percentile(np.abs(curvature[mask]), 96.0)), 1e-6)

    relief_n = np.clip(local_relief / relief_scale, -1.5, 1.5)
    micro_n = np.clip(micro_relief / micro_scale, -1.5, 1.5)
    curvature_n = np.clip(curvature / curvature_scale, -1.5, 1.5)

    normalized = np.clip((terrain - p2) / max(p98 - p2, 1.0), 0.0, 1.0)
    rgb = color_ramp(normalized)

    valley = smoothstep(-relief_n, 0.02, 0.95) * (1.0 - smoothstep(slope_degrees, 7.0, 24.0))
    ridge = smoothstep(relief_n, 0.02, 1.0)
    cliff = smoothstep(slope_degrees, 24.0, 58.0)
    convex = smoothstep(-curvature_n, 0.05, 1.0)
    concave = smoothstep(curvature_n, 0.05, 1.0)
    karst_detail = np.clip(
        0.40 * cliff
        + 0.24 * ridge
        + 0.18 * np.abs(curvature_n)
        + 0.18 * np.abs(micro_n),
        0.0,
        1.0,
    )
    limestone = np.clip(cliff * (0.46 + 0.54 * convex) * (0.35 + 0.65 * ridge), 0.0, 1.0)

    wet_green = np.array([23.0, 91.0, 59.0], dtype=np.float32)
    warm_limestone = np.array([190.0, 181.0, 151.0], dtype=np.float32)
    pale_limestone = np.array([220.0, 218.0, 202.0], dtype=np.float32)
    deep_forest = np.array([16.0, 60.0, 37.0], dtype=np.float32)

    rgb = rgb * (1.0 - valley[..., None] * 0.26) + wet_green * valley[..., None] * 0.26
    rgb = rgb * (1.0 - ridge[..., None] * 0.12) + deep_forest * ridge[..., None] * 0.12
    rgb = rgb * (1.0 - limestone[..., None] * 0.36) + warm_limestone * limestone[..., None] * 0.24
    rgb = rgb * (1.0 - cliff[..., None] * convex[..., None] * 0.12) + pale_limestone * cliff[..., None] * convex[..., None] * 0.12

    shades = []
    for azimuth_deg, altitude_deg in ((315.0, 42.0), (70.0, 28.0)):
        azimuth = math.radians(azimuth_deg)
        altitude = math.radians(altitude_deg)
        shade = (
            math.sin(altitude) * np.cos(slope_radians)
            + math.cos(altitude) * np.sin(slope_radians) * np.cos(azimuth - aspect)
        )
        shades.append(np.clip((shade + 1.0) * 0.5, 0.0, 1.0))
    hillshade = 0.72 * shades[0] + 0.28 * shades[1]
    ambient = np.clip(0.94 + relief_n * 0.08 - concave * 0.10, 0.72, 1.08)
    detail_light = np.clip(0.92 + micro_n * 0.055 + karst_detail * 0.045, 0.76, 1.16)
    rgb *= (0.40 + 0.78 * hillshade[..., None]) * ambient[..., None] * detail_light[..., None]

    warm = np.clip(np.cos(aspect - math.radians(225.0)) * 0.5 + 0.5, 0.0, 1.0)
    rgb[..., 0] *= 0.96 + warm * 0.07
    rgb[..., 1] *= 1.02 - warm * 0.02
    rgb[..., 2] *= 1.04 - warm * 0.08

    rgb = np.clip(rgb, 0, 255).astype(np.uint8)
    alpha = np.where(mask, 255, 0).astype(np.uint8)
    rgba = np.dstack([rgb, alpha])

    normal_strength = 1.35
    nx = -grad_x * normal_strength
    ny = grad_y * normal_strength
    nz = np.ones_like(nx)
    length = np.sqrt(nx * nx + ny * ny + nz * nz)
    nx /= length
    ny /= length
    nz /= length
    normal_rgb = np.dstack([
        (nx * 0.5 + 0.5) * 255.0,
        (ny * 0.5 + 0.5) * 255.0,
        (nz * 0.5 + 0.5) * 255.0,
    ]).astype(np.uint8)
    normal_rgb[~mask] = np.array([128, 128, 255], dtype=np.uint8)

    roughness = np.clip(0.70 + karst_detail * 0.22 - limestone * 0.12 + valley * 0.05, 0.48, 0.98)
    roughness_u8 = (roughness * 255.0).astype(np.uint8)
    roughness_u8[~mask] = 255

    detail_u8 = (np.clip(karst_detail * 0.72 + cliff * 0.28, 0.0, 1.0) * 255.0).astype(np.uint8)
    detail_u8[~mask] = 0

    stats = {
        "percentile_stretch_m": [float(p2), float(p98)],
        "valid_percentiles_m": {
            "p01": float(p1),
            "p02": float(p2),
            "p50": float(p50),
            "p98": float(p98),
            "p995": float(p995),
        },
        "derivative_resolution_m": [float(xres), float(yres)],
        "slope_degrees": {
            "p50": float(np.percentile(slope_degrees[mask], 50.0)),
            "p90": float(np.percentile(slope_degrees[mask], 90.0)),
            "p99": float(np.percentile(slope_degrees[mask], 99.0)),
        },
        "karst_detail_mean": float(karst_detail[mask].mean()),
        "limestone_exposure_mean": float(limestone[mask].mean()),
    }
    return rgba, normal_rgb, roughness_u8, detail_u8, stats


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--mosaic", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--height-max-width", type=int, default=1024)
    parser.add_argument("--texture-max-width", type=int, default=2560)
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
        rgba, normal_rgb, roughness_u8, detail_u8, analysis = build_rich_terrain_products(
            tdata, tmask, ds.bounds
        )
        Image.fromarray(rgba, mode="RGBA").save(
            args.output_dir / "terrain_texture.webp",
            format="WEBP",
            quality=93,
            method=6,
        )
        Image.fromarray(normal_rgb, mode="RGB").save(
            args.output_dir / "terrain_normal.png",
            format="PNG",
            optimize=True,
        )
        Image.fromarray(roughness_u8, mode="L").save(
            args.output_dir / "terrain_roughness.webp",
            format="WEBP",
            quality=92,
            method=6,
        )
        Image.fromarray(detail_u8, mode="L").save(
            args.output_dir / "terrain_karst_detail.webp",
            format="WEBP",
            quality=92,
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
            "schema": "guilin-v072-terrain-seasonal-rivers/v1",
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
                "alpha_is_valid_data_mask": True,
            },
            "normal": {
                "file": "terrain_normal.png",
                "width": twidth,
                "height": theight,
                "policy": "visual shading only; source elevation unchanged",
            },
            "roughness": {
                "file": "terrain_roughness.webp",
                "width": twidth,
                "height": theight,
            },
            "karst_detail": {
                "file": "terrain_karst_detail.webp",
                "width": twidth,
                "height": theight,
                "policy": "diagnostic and shading field only",
            },
            "analysis": analysis,
            "vertical_scale": 1.0,
            "source_elevation_modified_m": 0.0,
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
