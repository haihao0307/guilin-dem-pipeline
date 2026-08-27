#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import math
import shutil
from pathlib import Path

import numpy as np
import rasterio
from PIL import Image
from rasterio.enums import Resampling

EXPECTED_SHA256 = "9f672e16714d98b7bc7f002826cdf788379bcb54db84227a21f53539b083f3a2"
SOURCE_BASELINE_SHA256 = "af95c47f55ab8ff25d33ddc96d07c6d85fc1fcd4c2a2de9e2bef51a015860c50"
EXPECTED_GRID = (5892, 8095)
EXPECTED_BOUNDS = (243875.0, 2719987.5, 317525.0, 2821175.0)
EXPECTED_RES = (12.5, 12.5)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def close_tuple(actual, expected, tolerance=1e-9):
    return len(actual) == len(expected) and all(abs(float(a) - float(e)) <= tolerance for a, e in zip(actual, expected))


def sun(azimuth_deg: float, altitude_deg: float) -> np.ndarray:
    az = math.radians(azimuth_deg)
    alt = math.radians(altitude_deg)
    return np.array([
        math.sin(az) * math.cos(alt),
        math.sin(alt),
        math.cos(az) * math.cos(alt),
    ], dtype=np.float32)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--template", required=True, type=Path)
    args = parser.parse_args()

    if sha256(args.input) != EXPECTED_SHA256:
        raise SystemExit("Authoritative TIFF SHA-256 mismatch")

    output = args.output
    assets = output / "assets"
    if output.exists():
        shutil.rmtree(output)
    assets.mkdir(parents=True)

    with rasterio.open(args.input) as dataset:
        if str(dataset.crs) != "EPSG:32648":
            raise SystemExit(f"Unexpected CRS: {dataset.crs}")
        if (dataset.width, dataset.height) != EXPECTED_GRID:
            raise SystemExit(f"Unexpected grid: {dataset.width} x {dataset.height}")
        if dataset.dtypes != ("float32",):
            raise SystemExit(f"Unexpected dtype: {dataset.dtypes}")
        if not close_tuple(dataset.res, EXPECTED_RES):
            raise SystemExit(f"Unexpected resolution: {dataset.res}")
        if not close_tuple(dataset.bounds, EXPECTED_BOUNDS):
            raise SystemExit(f"Unexpected bounds: {dataset.bounds}")
        if dataset.profile.get("compress") not in (None, "none", "NONE"):
            raise SystemExit(f"Authoritative TIFF is compressed: {dataset.profile.get('compress')}")
        if dataset.overviews(1):
            raise SystemExit(f"Authoritative TIFF has overviews: {dataset.overviews(1)}")

        texture_width = 2048
        texture_height = round(texture_width * dataset.height / dataset.width)
        elevation = dataset.read(
            1,
            out_shape=(texture_height, texture_width),
            resampling=Resampling.bilinear,
        ).astype(np.float32)
        if not np.isfinite(elevation).all():
            raise SystemExit("Unexpected invalid pixels in the clean crop")
        bounds = tuple(float(value) for value in dataset.bounds)

    z_min = float(elevation.min())
    z_max = float(elevation.max())
    z_mean = float(elevation.mean())
    z_std = float(elevation.std())
    span = z_max - z_min
    normalized = np.clip((elevation - z_min) / span, 0.0, 1.0)

    encoded = np.round(normalized * 65535.0).astype(np.uint16)
    height_rgb = np.zeros((texture_height, texture_width, 3), dtype=np.uint8)
    height_rgb[..., 0] = (encoded >> 8).astype(np.uint8)
    height_rgb[..., 1] = (encoded & 255).astype(np.uint8)
    height_path = assets / "height_rg16.png"
    Image.fromarray(height_rgb, mode="RGB").save(height_path, compress_level=6)

    width_m = bounds[2] - bounds[0]
    height_m = bounds[3] - bounds[1]
    dx = width_m / max(1, texture_width - 1)
    dy = height_m / max(1, texture_height - 1)
    dz_dy, dz_dx = np.gradient(elevation, dy, dx)
    normals = np.dstack((-dz_dx, np.ones_like(elevation), dz_dy))
    normals /= np.linalg.norm(normals, axis=2, keepdims=True) + 1e-9
    main_light = np.clip((normals * sun(315, 42)).sum(axis=2), 0, 1)
    fill = sum(np.clip((normals * sun(az, 35)).sum(axis=2), 0, 1) for az in (45, 135, 225, 315)) / 4.0
    shade = np.clip(0.52 + 0.34 * main_light + 0.22 * fill, 0, 1.1)

    stops = np.array([
        [0.00, 0.27, 0.39, 0.24],
        [0.25, 0.42, 0.50, 0.30],
        [0.50, 0.58, 0.53, 0.36],
        [0.72, 0.63, 0.54, 0.42],
        [0.88, 0.66, 0.62, 0.58],
        [1.00, 0.86, 0.86, 0.84],
    ], dtype=np.float32)
    color = np.zeros((texture_height, texture_width, 3), dtype=np.float32)
    for index in range(len(stops) - 1):
        start, end = stops[index], stops[index + 1]
        mask = (normalized >= start[0]) & (normalized <= end[0] if index == len(stops) - 2 else normalized < end[0])
        t = ((normalized[mask] - start[0]) / (end[0] - start[0]))[:, None]
        color[mask] = start[1:] + (end[1:] - start[1:]) * t
    color = np.clip(np.power(color * shade[..., None], 0.92), 0, 1)
    surface_path = assets / "surface.png"
    Image.fromarray(np.round(color * 255).astype(np.uint8), mode="RGB").save(surface_path, compress_level=3)

    grayscale = np.clip((0.16 + 0.84 * shade) * (0.80 + 0.20 * normalized), 0, 1)
    fallback_path = assets / "fallback.png"
    Image.fromarray(np.round(np.repeat(grayscale[..., None], 3, axis=2) * 255).astype(np.uint8), mode="RGB").save(fallback_path, compress_level=3)

    for template_file in args.template.iterdir():
        if template_file.is_file():
            shutil.copy2(template_file, output / template_file.name)

    mesh_columns = 768
    mesh_rows = round(mesh_columns * texture_height / texture_width)
    manifest = {
        "schemaVersion": "kunming_dem_3d_viewer@1.0.0",
        "title": "昆明 DEM 纯净基线三维查看器",
        "status": "viewer_ready",
        "authoritativeMaster": {
            "file": args.input.name,
            "sha256": EXPECTED_SHA256,
            "sourceBaselineSha256": SOURCE_BASELINE_SHA256,
            "dtype": "float32",
            "compression": "NONE",
            "internalOverviews": [],
            "crs": "EPSG:32648",
            "pixelSpacingMeters": [12.5, 12.5],
            "grid": [5892, 8095],
            "bounds": list(bounds),
            "widthMeters": width_m,
            "heightMeters": height_m,
            "areaKm2": width_m * height_m / 1_000_000,
            "elevationMeters": {"min": z_min, "max": z_max, "mean": z_mean, "std": z_std},
        },
        "browserAssets": {
            "height": {"file": "assets/height_rg16.png", "width": texture_width, "height": texture_height, "encoding": "RG16 normalized PNG", "lossless": True, "sha256": sha256(height_path)},
            "surface": {"file": "assets/surface.png", "width": texture_width, "height": texture_height, "lossless": True, "sha256": sha256(surface_path)},
            "fallback": {"file": "assets/fallback.png", "width": texture_width, "height": texture_height, "lossless": True, "sha256": sha256(fallback_path)},
            "mesh": {"columns": mesh_columns, "rows": mesh_rows, "naturalVerticalScale": 1.0},
        },
        "rules": [
            "Authoritative DEM remains uncompressed and unchanged.",
            "Browser PNG assets are visualization assets only.",
            "No vertical exaggeration.",
            "No contours.",
            "No synthetic water, rock, debris, erosion, or land-cover overlay.",
        ],
    }
    (output / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    qa = {
        "status": "complete",
        "sourceTiffSha256": EXPECTED_SHA256,
        "grid": [5892, 8095],
        "pixelSpacingMeters": [12.5, 12.5],
        "viewerTexture": [texture_width, texture_height],
        "viewerMesh": [mesh_columns, mesh_rows],
        "naturalVerticalScale": 1.0,
        "noContours": True,
        "noSyntheticLayers": True,
    }
    (output / "QA.json").write_text(json.dumps(qa, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(qa, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
