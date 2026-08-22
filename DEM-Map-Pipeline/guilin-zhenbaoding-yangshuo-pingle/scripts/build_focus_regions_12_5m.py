"""Package four truthful 200 km² focus DEMs from the verified 12.5 m pixels.

The source mosaic may contain NoData gaps.  This script preserves those gaps in
the mask and never interpolates or labels the result as native 1 m data.
"""
from __future__ import annotations

import argparse
import json
import math
import shutil
from pathlib import Path

import numpy as np
from PIL import Image, TiffImagePlugin

Image.MAX_IMAGE_PIXELS = None
RESOLUTION = 12.5
NODATA = -32768.0
SIDE = math.sqrt(200_000_000.0)

REGIONS = [
    ("zhenbao-ding", "真寶鼎", 110.82528, 26.13556, "#f2bd65"),
    ("yangtang-airfield", "秧塘機場", 110.15569, 25.21753, "#7bb7ff"),
    ("yangshuo-county-seat", "陽朔縣", 110.4920133, 24.7815129, "#73d7b0"),
    ("guilin-old-city", "桂林古城", 110.2994, 25.2742, "#e989b7"),
]


def utm49(lon: float, lat: float) -> tuple[float, float]:
    a, ecc_sq, k0 = 6378137.0, 0.00669437999014, 0.9996
    ecc_prime_sq = ecc_sq / (1.0 - ecc_sq)
    lat_r, lon_r = math.radians(lat), math.radians(lon)
    lon0 = math.radians(111.0)
    sin_lat, cos_lat, tan_lat = math.sin(lat_r), math.cos(lat_r), math.tan(lat_r)
    n = a / math.sqrt(1.0 - ecc_sq * sin_lat * sin_lat)
    t = tan_lat * tan_lat
    c = ecc_prime_sq * cos_lat * cos_lat
    aa = cos_lat * (lon_r - lon0)
    m = a * ((1 - ecc_sq / 4 - 3 * ecc_sq**2 / 64 - 5 * ecc_sq**3 / 256) * lat_r
        - (3 * ecc_sq / 8 + 3 * ecc_sq**2 / 32 + 45 * ecc_sq**3 / 1024) * math.sin(2 * lat_r)
        + (15 * ecc_sq**2 / 256 + 45 * ecc_sq**3 / 1024) * math.sin(4 * lat_r)
        - (35 * ecc_sq**3 / 3072) * math.sin(6 * lat_r))
    x = k0 * n * (aa + (1 - t + c) * aa**3 / 6 + (5 - 18 * t + t**2 + 72 * c - 58 * ecc_prime_sq) * aa**5 / 120) + 500000.0
    y = k0 * (m + n * tan_lat * (aa**2 / 2 + (5 - t + 9 * c + 4 * c**2) * aa**4 / 24 + (61 - 58 * t + t**2 + 600 * c - 330 * ecc_prime_sq) * aa**6 / 720))
    return x, y


def read_json(path: Path, default=None):
    if not path.exists():
        return {} if default is None else default
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def georef(path: Path) -> tuple[int, int, float, float, float]:
    image = Image.open(path)
    scale = image.tag_v2.get(33550)
    tie = image.tag_v2.get(33922)
    if not scale or not tie:
        raise RuntimeError(f"missing georeferencing tags: {path}")
    return image.width, image.height, float(scale[0]), float(tie[3]), float(tie[4])


def write_geotiff(path: Path, data: np.ndarray, template: Image.Image, x0: float, y_top: float) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tags = TiffImagePlugin.ImageFileDirectory_v2()
    for tag in (34735, 34737):
        if tag in template.tag_v2:
            tags[tag] = template.tag_v2[tag]
    tags[33550] = (RESOLUTION, RESOLUTION, 0.0)
    tags[33922] = (0.0, 0.0, 0.0, float(x0), float(y_top), 0.0)
    tags[42113] = str(int(NODATA))
    Image.fromarray(data.astype(np.float32), mode="F").save(path, format="TIFF", compression="tiff_deflate", tiffinfo=tags)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    root = args.root.resolve()
    work = root / "data" / "work"
    base_path = work / "mosaic_raw_float32.tif"
    values_path = work / "mosaic_all_10_float32.dat"
    counts_path = work / "mosaic_all_10_source_count_uint8.dat"
    if not base_path.exists() or not values_path.exists() or not counts_path.exists():
        raise RuntimeError("verified 12.5 m mosaic and source-count memmaps are required")
    width, height, resolution, x0, y_top = georef(base_path)
    if abs(resolution - RESOLUTION) > 0.01:
        raise RuntimeError(f"unexpected mosaic resolution: {resolution}")
    values = np.memmap(values_path, mode="r", dtype="<f4", shape=(height, width))
    counts = np.memmap(counts_path, mode="r", dtype="u1", shape=(height, width))
    site_assets = root / "site" / "public" / "terrain" / "assets" / "fine-regions"
    web_assets = root / "web" / "assets" / "fine-regions"
    output_dir = root / "outputs" / "fine_regions_12_5m"
    records = []
    for region_id, name, lon, lat, color in REGIONS:
        cx, cy = utm49(lon, lat)
        bounds = [cx - SIDE / 2, cy - SIDE / 2, cx + SIDE / 2, cy + SIDE / 2]
        pixel_width = int(math.ceil(SIDE / resolution))
        pixel_height = pixel_width
        col0 = int(round((bounds[0] - x0) / resolution))
        row0 = int(round((y_top - bounds[3]) / resolution))
        col1, row1 = col0 + pixel_width, row0 + pixel_height
        src_c0, src_r0 = max(0, col0), max(0, row0)
        src_c1, src_r1 = min(width, col1), min(height, row1)
        crop = np.full((pixel_height, pixel_width), NODATA, dtype=np.float32)
        mask = np.zeros((pixel_height, pixel_width), dtype=np.uint8)
        if src_c1 > src_c0 and src_r1 > src_r0:
            dst_c0, dst_r0 = src_c0 - col0, src_r0 - row0
            chunk = np.asarray(values[src_r0:src_r1, src_c0:src_c1], dtype=np.float32)
            valid = (np.asarray(counts[src_r0:src_r1, src_c0:src_c1]) > 0) & np.isfinite(chunk) & (chunk != NODATA)
            crop[dst_r0:dst_r0 + chunk.shape[0], dst_c0:dst_c0 + chunk.shape[1]][valid] = chunk[valid]
            mask[dst_r0:dst_r0 + chunk.shape[0], dst_c0:dst_c0 + chunk.shape[1]][valid] = 1
        valid_values = crop[mask > 0]
        if valid_values.size == 0:
            raise RuntimeError(f"no valid pixels in focus region {region_id}")
        minimum, maximum = float(valid_values.min()), float(valid_values.max())
        value_range = max(maximum - minimum, 1e-6)
        encoded = np.zeros(crop.shape, dtype=np.uint16)
        encoded[mask > 0] = np.clip(np.rint((crop[mask > 0] - minimum) / value_range * 65535.0), 0, 65535).astype(np.uint16)
        rel_dir = Path("assets") / "fine-regions" / region_id
        for target_root in (site_assets, web_assets):
            target = target_root / region_id
            target.mkdir(parents=True, exist_ok=True)
            encoded.tofile(target / "height_u16.bin")
            mask.tofile(target / "mask_u8.bin")
        tif_path = output_dir / f"{region_id}_12_5m.tif"
        geotiff_crop = crop.copy()
        write_geotiff(tif_path, geotiff_crop, Image.open(base_path), x0 + col0 * resolution, y_top - row0 * resolution)
        actual_bounds = [x0 + col0 * resolution, y_top - row1 * resolution, x0 + col1 * resolution, y_top - row0 * resolution]
        actual_area = pixel_width * pixel_height * resolution * resolution / 1_000_000.0
        valid_fraction = float(mask.mean())
        manifest = {
            "schemaVersion": "guilin-focus-dem/v1",
            "id": region_id,
            "name": name,
            "crs": "EPSG:32649",
            "sourceResolutionMeters": RESOLUTION,
            "accuracyPolicy": "12.5m verified source pixels; no upsampling and not a native 1m survey",
            "requestedAreaSquareKilometers": 200.0,
            "actualAreaSquareKilometers": actual_area,
            "bounds": actual_bounds,
            "widthMeters": pixel_width * resolution,
            "heightMeters": pixel_height * resolution,
            "gridWidth": pixel_width,
            "gridHeight": pixel_height,
            "resolution": [RESOLUTION, RESOLUTION],
            "minimumElevation": minimum,
            "maximumElevation": maximum,
            "verticalScale": 1.0,
            "heightBinary": "height_u16.bin",
            "maskBinary": "mask_u8.bin",
            "validFraction": valid_fraction,
            "status": "ready_12_5m" if valid_fraction >= 0.995 else "incomplete_12_5m",
            "centerProjected": [cx, cy],
            "landmarks": [{"id": region_id, "name": name, "longitude": lon, "latitude": lat, "color": color, "gridU": 0.5, "gridV": 0.5, "elevationMeters": float(crop[pixel_height // 2, pixel_width // 2] if mask[pixel_height // 2, pixel_width // 2] else minimum)}],
            "waterwayPolicy": "focus remaps the filtered global water-surface polygons; reservoirs and dams excluded",
        }
        write_json(site_assets / region_id / "terrain-manifest.json", manifest)
        write_json(web_assets / region_id / "terrain-manifest.json", manifest)
        records.append({**manifest, "assetManifest": str(rel_dir / "terrain-manifest.json").replace("\\", "/"), "demPath": str(tif_path.relative_to(root)).replace("\\", "/"), "pixelOrigin": [col0, row0]})
        print(region_id, f"{pixel_width}x{pixel_height}", f"valid={valid_fraction:.6f}", flush=True)
    write_json(root / "metadata" / "fine_regions_12_5m.json", {
        "schemaVersion": "guilin-focus-dem-index/v1",
        "generatedAt": "2026-08-22T00:00:00+00:00",
        "sourceResolutionMeters": RESOLUTION,
        "accuracyPolicy": "All four focus packages use verified 12.5m source pixels. No 1m claim or interpolation is made.",
        "requestedAreaSquareKilometers": 200.0,
        "regions": records,
    })
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
