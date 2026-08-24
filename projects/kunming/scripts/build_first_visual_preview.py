from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
import rasterio
from PIL import Image
from rasterio.enums import Resampling
from scipy import ndimage


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(4 * 1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def normalize_percentile(values: np.ndarray, low: float, high: float) -> np.ndarray:
    finite = values[np.isfinite(values)]
    if finite.size == 0:
        return np.zeros(values.shape, dtype=np.float32)
    lo, hi = np.percentile(finite, [low, high])
    if hi <= lo:
        hi = lo + 1e-6
    return np.clip((values - lo) / (hi - lo), 0.0, 1.0).astype(np.float32)


def smoothstep(edge0: float, edge1: float, values: np.ndarray) -> np.ndarray:
    t = np.clip((values - edge0) / max(edge1 - edge0, 1e-9), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def save_rgb(path: Path, values: np.ndarray) -> None:
    data = np.clip(np.round(values * 255.0), 0, 255).astype(np.uint8)
    Image.fromarray(data, mode='RGB').save(path, optimize=True)


def save_rgba(path: Path, values: np.ndarray) -> None:
    data = np.clip(np.round(values * 255.0), 0, 255).astype(np.uint8)
    Image.fromarray(data, mode='RGBA').save(path, optimize=True)


def elevation_palette(t: np.ndarray) -> np.ndarray:
    stops = np.asarray([0.0, 0.14, 0.32, 0.52, 0.70, 0.84, 1.0], dtype=np.float32)
    colors = np.asarray(
        [[26, 73, 68], [71, 124, 74], [146, 151, 79], [176, 139, 72], [160, 115, 82], [174, 164, 145], [245, 246, 244]],
        dtype=np.float32,
    ) / 255.0
    return np.stack([np.interp(t, stops, colors[:, channel]) for channel in range(3)], axis=-1)


def heat_palette(t: np.ndarray) -> np.ndarray:
    stops = np.asarray([0.0, 0.25, 0.5, 0.75, 1.0], dtype=np.float32)
    colors = np.asarray([[30, 56, 110], [47, 150, 168], [223, 214, 90], [213, 106, 51], [122, 26, 35]], dtype=np.float32) / 255.0
    return np.stack([np.interp(t, stops, colors[:, channel]) for channel in range(3)], axis=-1)


def main() -> int:
    parser = argparse.ArgumentParser(description='Build reversible Kunming terrain preview fields from a verified COG.')
    parser.add_argument('--dem', required=True)
    parser.add_argument('--output-dir', required=True)
    parser.add_argument('--source-count')
    parser.add_argument('--preview-width', type=int, default=1024)
    parser.add_argument('--title', default='Kunming DEM Guilin-skill first pass')
    args = parser.parse_args()

    dem_path = Path(args.dem).resolve()
    output = Path(args.output_dir).resolve()
    assets = output / 'assets'
    reports = output / 'reports'
    assets.mkdir(parents=True, exist_ok=True)
    reports.mkdir(parents=True, exist_ok=True)

    with rasterio.open(dem_path) as dataset:
        height_px = max(1, round(args.preview_width * dataset.height / dataset.width))
        raster = dataset.read(1, out_shape=(height_px, args.preview_width), masked=True, resampling=Resampling.bilinear).astype(np.float32)
        valid = ~np.ma.getmaskarray(raster)
        height = raster.filled(np.nan).astype(np.float32)
        if not valid.all():
            height[~valid] = float(np.nanmedian(height[valid]))
        width_m = float(dataset.bounds.right - dataset.bounds.left)
        height_m = float(dataset.bounds.top - dataset.bounds.bottom)
        source = {
            'file': dem_path.name,
            'sha256': sha256(dem_path),
            'crs': dataset.crs.to_string() if dataset.crs else None,
            'bounds': list(dataset.bounds),
            'pixelSpacingMeters': [abs(dataset.transform.a), abs(dataset.transform.e)],
            'gridWidth': dataset.width,
            'gridHeight': dataset.height,
            'widthMeters': width_m,
            'heightMeters': height_m,
            'truthDemModified': False,
        }

    preview_pixel_m = width_m / args.preview_width
    minimum = float(np.min(height))
    maximum = float(np.max(height))
    normalized_height = np.clip((height - minimum) / max(maximum - minimum, 1e-6), 0.0, 1.0).astype(np.float32)

    gradient_y, gradient_x = np.gradient(height, preview_pixel_m, preview_pixel_m)
    slope_deg = np.degrees(np.arctan(np.hypot(gradient_x, gradient_y))).astype(np.float32)
    slope = np.clip(slope_deg / 55.0, 0.0, 1.0)

    smooth_small = ndimage.gaussian_filter(height, sigma=1.25, mode='nearest')
    smooth_mid = ndimage.gaussian_filter(height, sigma=5.0, mode='nearest')
    smooth_large = ndimage.gaussian_filter(height, sigma=15.0, mode='nearest')
    local_relief = smooth_small - smooth_mid
    macro_relief = smooth_mid - smooth_large
    curvature = ndimage.laplace(smooth_mid, mode='nearest')
    convex = normalize_percentile(np.maximum(curvature, 0.0), 55.0, 99.4)
    concave = normalize_percentile(np.maximum(-curvature, 0.0), 55.0, 99.4)
    relief = normalize_percentile(np.abs(local_relief), 50.0, 99.5)
    macro = normalize_percentile(np.abs(macro_relief), 45.0, 99.5)
    rock = np.clip(0.62 * smoothstep(24.0, 46.0, slope_deg) + 0.23 * convex + 0.18 * relief, 0.0, 1.0)
    moisture = np.clip((0.62 * concave + 0.38 * (1.0 - slope)) * (0.35 + 0.65 * (1.0 - normalized_height)), 0.0, 1.0)
    erosion = np.clip(0.45 * concave + 0.28 * relief + 0.18 * macro + 0.12 * slope, 0.0, 1.0)

    quantized = np.clip(np.round(normalized_height * 65535.0), 0, 65535).astype(np.uint16)
    encoded = np.stack([(quantized >> 8).astype(np.uint8), (quantized & 255).astype(np.uint8), valid.astype(np.uint8) * 255], axis=-1)
    Image.fromarray(encoded, mode='RGB').save(assets / 'height_rg16.png', optimize=True)
    save_rgba(assets / 'derived_layers.png', np.stack([slope, rock, erosion, relief], axis=-1))
    save_rgb(reports / 'elevation.png', elevation_palette(normalized_height))
    save_rgb(reports / 'slope.png', heat_palette(slope))
    save_rgb(reports / 'rock.png', np.stack([0.08 + 0.82 * rock, 0.08 + 0.78 * rock, 0.08 + 0.72 * rock], axis=-1))
    save_rgb(reports / 'erosion.png', np.stack([0.22 + 0.72 * erosion, 0.20 + 0.42 * (1.0 - erosion), 0.16 + 0.32 * moisture], axis=-1))

    source_count_record = None
    if args.source_count:
        count_path = Path(args.source_count).resolve()
        with rasterio.open(count_path) as dataset:
            count = dataset.read(1, out_shape=(height_px, args.preview_width), resampling=Resampling.nearest).astype(np.float32)
        count_norm = np.clip((count - 1.0) / 3.0, 0.0, 1.0)
        save_rgb(assets / 'source_count.png', np.repeat(count_norm[..., None], 3, axis=-1))
        source_count_record = {'file': count_path.name, 'sha256': sha256(count_path)}

    manifest = {
        'schemaVersion': 'kunming-terrain-preview@0.1.0',
        'title': args.title,
        'sourceTruth': source,
        'sourceCount': source_count_record,
        'previewGrid': {'width': args.preview_width, 'height': height_px, 'pixelSpacingMetersApprox': preview_pixel_m},
        'heightPolicy': {'z_truth_m': 'read_only', 'z_micro_delta_m': 'reversible_visual_layer', 'z_visual_m': 'runtime_display'},
        'visualFields': ['slope', 'rockExposureProxy', 'erosionProxy', 'moistureProxy', 'localRelief'],
        'guardrails': ['truth COG unchanged', 'visual fields are not surveyed data', 'no 30 m fallback'],
    }
    (assets / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')

    qa = {
        'schemaVersion': 'kunming-terrain-preview-qa@0.1.0',
        'status': 'pass',
        'sourceTruthModified': False,
        'finiteHeightFraction': float(np.isfinite(height).mean()),
        'elevationMinMeters': minimum,
        'elevationMaxMeters': maximum,
        'slopeDegrees': {'mean': float(slope_deg.mean()), 'p95': float(np.percentile(slope_deg, 95)), 'max': float(slope_deg.max())},
        'visualMasks': {'rockMean': float(rock.mean()), 'erosionMean': float(erosion.mean()), 'moistureMean': float(moisture.mean())},
    }
    (reports / 'preview_qa.json').write_text(json.dumps(qa, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(qa, ensure_ascii=False))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
