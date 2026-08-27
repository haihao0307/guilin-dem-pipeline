#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Build Kunming V006 browser-only Yunnan plateau surface and narrow OSM water mask.

The authoritative float32 DEM is never opened or modified. Inputs are regenerable
browser caches already published with V005: RG16 height, previous display surface,
and the OSM water mask. Outputs are deterministic display assets.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter
from scipy.ndimage import distance_transform_edt, gaussian_filter, sobel
from skimage.morphology import skeletonize


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def decode_rg16(path: Path) -> tuple[Image.Image, np.ndarray]:
    image = Image.open(path).convert("RGB")
    rgb = np.asarray(image)
    height = (
        (rgb[:, :, 0].astype(np.uint16) << 8)
        | rgb[:, :, 1].astype(np.uint16)
    ).astype(np.float32) / 65535.0
    return image, height


def signed_normalize(values: np.ndarray, percentile: float) -> np.ndarray:
    scale = float(np.percentile(np.abs(values), percentile)) + 1e-8
    return np.clip(values / scale, -1.0, 1.0)


def mix(output: np.ndarray, target: np.ndarray, mask: np.ndarray, strength: float) -> np.ndarray:
    alpha = np.clip(mask * strength, 0.0, 1.0)[:, :, None]
    return output * (1.0 - alpha) + target * alpha


def build_surface(height_path: Path, surface_2048_path: Path, surface_4096_path: Path, fallback_path: Path) -> dict:
    source_image, height = decode_rg16(height_path)
    height_rows, height_cols = height.shape

    gradient_x = sobel(height, axis=1, mode="reflect") / 8.0
    gradient_y = sobel(height, axis=0, mode="reflect") / 8.0
    slope_raw = np.hypot(gradient_x, gradient_y)
    slope = np.clip(slope_raw / (np.percentile(slope_raw, 99.4) + 1e-8), 0.0, 1.0)

    blur_2 = gaussian_filter(height, 1.5, mode="reflect")
    blur_8 = gaussian_filter(height, 8.0, mode="reflect")
    blur_28 = gaussian_filter(height, 28.0, mode="reflect")
    blur_90 = gaussian_filter(height, 90.0, mode="reflect")

    fine = signed_normalize(height - blur_2, 99.2)
    medium = signed_normalize(height - blur_8, 99.0)
    local = signed_normalize(height - blur_28, 99.0)
    broad = signed_normalize(height - blur_90, 99.0)
    curvature = signed_normalize(
        gaussian_filter(height, 1.2, mode="reflect")
        - gaussian_filter(height, 4.5, mode="reflect"),
        99.0,
    )

    valley = np.clip(-local * 0.65 - curvature * 0.35, 0.0, 1.0)
    ridge = np.clip(local * 0.65 + curvature * 0.35, 0.0, 1.0)
    gradient_length = np.hypot(gradient_x, gradient_y) + 1e-7
    northness = np.clip(0.5 - 0.5 * gradient_y / gradient_length, 0.0, 1.0)
    southness = 1.0 - northness
    flat = 1.0 - slope

    moisture = np.clip(
        0.42 * (1.0 - height)
        + 0.33 * valley
        + 0.18 * northness
        + 0.12 * flat
        - 0.18 * slope,
        0.0,
        1.0,
    )
    rock = np.clip(
        0.68 * slope
        + 0.26 * ridge
        + 0.34 * np.maximum(height - 0.56, 0.0) * 2.2,
        0.0,
        1.0,
    )
    red_soil = np.clip(
        0.42 * slope
        + 0.30 * southness
        + 0.28 * np.maximum(height - 0.28, 0.0) * (1.0 - np.maximum(height - 0.82, 0.0) * 4.0)
        + 0.18 * ridge
        - 0.22 * moisture,
        0.0,
        1.0,
    )
    dry_grass = np.clip(
        0.65 * (1.0 - moisture)
        + 0.18 * flat
        + 0.22 * (1.0 - rock)
        - 0.18 * np.abs(height - 0.46) * 2.0,
        0.0,
        1.0,
    )
    forest = np.clip(
        0.72 * moisture
        + 0.18 * northness
        + 0.16 * valley
        - 0.24 * rock,
        0.0,
        1.0,
    )

    stops = np.array([0.0, 0.13, 0.28, 0.45, 0.62, 0.78, 0.91, 1.0], dtype=np.float32)
    colors = np.array(
        [
            [38, 61, 35],
            [61, 82, 42],
            [92, 103, 52],
            [124, 113, 62],
            [128, 82, 52],
            [92, 76, 64],
            [142, 135, 122],
            [184, 181, 170],
        ],
        dtype=np.float32,
    ) / 255.0

    surface = np.empty((height_rows, height_cols, 3), dtype=np.float32)
    for index in range(len(stops) - 1):
        if index == len(stops) - 2:
            mask = (height >= stops[index]) & (height <= stops[index + 1])
        else:
            mask = (height >= stops[index]) & (height < stops[index + 1])
        blend = (height[mask] - stops[index]) / (stops[index + 1] - stops[index] + 1e-8)
        surface[mask] = colors[index] * (1.0 - blend[:, None]) + colors[index + 1] * blend[:, None]

    forest_color = np.array([35, 63, 34], dtype=np.float32) / 255.0
    wet_color = np.array([54, 86, 46], dtype=np.float32) / 255.0
    grass_color = np.array([118, 114, 61], dtype=np.float32) / 255.0
    red_color = np.array([119, 67, 43], dtype=np.float32) / 255.0
    rock_color = np.array([67, 61, 57], dtype=np.float32) / 255.0
    pale_color = np.array([145, 139, 127], dtype=np.float32) / 255.0

    surface = mix(surface, forest_color, forest, 0.52)
    surface = mix(surface, wet_color, valley * moisture, 0.30)
    surface = mix(surface, grass_color, dry_grass * (1.0 - rock), 0.32)
    surface = mix(surface, red_color, red_soil, 0.34)
    surface = mix(surface, rock_color, rock, 0.55)
    surface = mix(surface, pale_color, rock * np.clip((height - 0.76) * 4.0, 0.0, 1.0), 0.30)

    vertical = 5.0
    normal_x = -gradient_x * vertical
    normal_y = np.ones_like(height)
    normal_z = gradient_y * vertical
    normal_length = np.sqrt(normal_x * normal_x + normal_y * normal_y + normal_z * normal_z) + 1e-8
    normal_x /= normal_length
    normal_y /= normal_length
    normal_z /= normal_length

    lights = [(-0.55, 0.76, -0.34), (0.25, 0.88, 0.40), (-0.10, 0.96, 0.10)]
    hillshades: list[np.ndarray] = []
    for light_x, light_y, light_z in lights:
        light_length = (light_x * light_x + light_y * light_y + light_z * light_z) ** 0.5
        hillshades.append(
            np.clip(
                normal_x * (light_x / light_length)
                + normal_y * (light_y / light_length)
                + normal_z * (light_z / light_length),
                0.0,
                1.0,
            )
        )

    shade = 0.74 + 0.22 * hillshades[0] + 0.08 * hillshades[1] + 0.05 * hillshades[2]
    shade *= 1.0 - 0.12 * np.clip(-curvature, 0.0, 1.0) * slope
    shade *= 1.0 + 0.06 * np.clip(curvature, 0.0, 1.0) * slope
    texture = 0.045 * fine + 0.035 * medium + 0.025 * broad + 0.035 * curvature * rock
    surface *= np.clip(shade + texture, 0.52, 1.25)[:, :, None]

    random = np.random.default_rng(20260827).normal(0.0, 1.0, height.shape).astype(np.float32)
    random = gaussian_filter(random, 0.65, mode="reflect")
    random /= float(np.std(random)) + 1e-8
    micro = np.clip(random, -2.0, 2.0) * 0.010 * (0.35 + 0.65 * np.clip(rock + dry_grass * 0.4, 0.0, 1.0))
    surface *= 1.0 + micro[:, :, None]

    luminance = surface[:, :, 0] * 0.299 + surface[:, :, 1] * 0.587 + surface[:, :, 2] * 0.114
    surface = luminance[:, :, None] + (surface - luminance[:, :, None]) * 1.12
    surface = (surface - 0.5) * 1.06 + 0.5
    surface = np.clip(surface, 0.0, 1.0)

    image_2048 = Image.fromarray(np.uint8(surface * 255.0), "RGB")
    image_2048 = image_2048.filter(ImageFilter.UnsharpMask(radius=0.85, percent=70, threshold=2))
    image_2048.save(surface_2048_path, compress_level=2)

    image_4096 = image_2048.resize((4096, 5628), Image.Resampling.LANCZOS)
    image_4096 = image_4096.filter(ImageFilter.UnsharpMask(radius=1.0, percent=80, threshold=2))
    image_4096.save(surface_4096_path, compress_level=2)
    image_2048.save(fallback_path, quality=94, subsampling=0)

    return {
        "inputSize": list(source_image.size),
        "surface2048": {"file": str(surface_2048_path), "size": list(image_2048.size), "sha256": sha256(surface_2048_path), "bytes": surface_2048_path.stat().st_size},
        "surface4096": {"file": str(surface_4096_path), "size": list(image_4096.size), "sha256": sha256(surface_4096_path), "bytes": surface_4096_path.stat().st_size},
        "fallback": {"file": str(fallback_path), "size": list(image_2048.size), "sha256": sha256(fallback_path), "bytes": fallback_path.stat().st_size},
        "palette": ["deep valley forest", "wet valley green", "plateau olive", "dry grass ochre", "Yunnan red soil", "weathered dark rock", "pale rock"],
        "drivers": ["elevation", "slope", "aspect", "curvature", "local relief", "multi-light hillshade", "fixed-seed microdetail"],
    }


def build_narrow_water_mask(source_mask_path: Path, target_mask_path: Path, debug_path: Path) -> dict:
    source = np.asarray(Image.open(source_mask_path).convert("RGB"))
    main_source = source[:, :, 0] >= 250
    minor_source = source[:, :, 1] >= 250
    main_skeleton = skeletonize(main_source)
    minor_skeleton = skeletonize(minor_source)

    main_distance = distance_transform_edt(~main_skeleton)
    minor_distance = distance_transform_edt(~minor_skeleton)
    main_field = np.clip(1.0 - main_distance / 8.0, 0.0, 1.0)
    minor_field = np.clip(1.0 - minor_distance / 5.0, 0.0, 1.0)

    target = np.stack(
        [
            np.uint8(main_field * 255.0),
            np.uint8(minor_field * 255.0),
            source[:, :, 2],
        ],
        axis=-1,
    )
    target_image = Image.fromarray(target, "RGB")
    target_image.save(target_mask_path, compress_level=2)
    target_image.resize((1024, 1407), Image.Resampling.LANCZOS).save(debug_path, quality=92)

    return {
        "file": str(target_mask_path),
        "size": list(target_image.size),
        "sha256": sha256(target_mask_path),
        "bytes": target_mask_path.stat().st_size,
        "sourceMainPlateauPixels": int(main_source.sum()),
        "mainSkeletonPixels": int(main_skeleton.sum()),
        "sourceMinorPlateauPixels": int(minor_source.sum()),
        "minorSkeletonPixels": int(minor_skeleton.sum()),
        "method": "skeletonized OSM distance fields, no hand drawing",
    }


def update_manifest(manifest_path: Path, surface_report: dict, mask_report: dict) -> None:
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    surface = manifest["browserAssets"]["surface"]
    surface.update(
        {
            "desktopFile": "assets/surface_yunnan_v006.png",
            "desktopSize": surface_report["surface4096"]["size"],
            "desktopSha256": surface_report["surface4096"]["sha256"],
            "compatibilityFile": "assets/surface_yunnan_v006_2048.png",
            "compatibilitySize": surface_report["surface2048"]["size"],
            "compatibilitySha256": surface_report["surface2048"]["sha256"],
            "role": "deterministic fine-detail Yunnan plateau satellite-style display cache",
        }
    )
    manifest["browserAssets"]["water"]["mask"].update(
        {
            "file": "assets/osm_water_mask_v006.png",
            "size": mask_report["size"],
            "sha256": mask_report["sha256"],
            "channels": {
                "R": "narrow main waterway distance from skeletonized OSM centerline",
                "G": "narrow minor drainage distance from skeletonized OSM centerline",
                "B": "accepted OSM water area mask",
            },
        }
    )
    manifest["browserAssets"]["fallback"].update(
        {
            "file": "assets/fallback_yunnan_static_v006.jpg",
            "size": surface_report["fallback"]["size"],
            "sha256": surface_report["fallback"]["sha256"],
        }
    )
    manifest["v006SurfaceKnowledge"] = {
        "referenceDirection": "rich dark-rock and olive-green terrain language from supplied references, adapted to the Kunming Yunnan plateau",
        "palette": surface_report["palette"],
        "drivers": surface_report["drivers"],
        "randomSeed": 20260827,
        "regenerable": True,
    }
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--site", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    args = parser.parse_args()

    assets = args.site / "assets"
    surface_report = build_surface(
        assets / "height_rg16.png",
        assets / "surface_yunnan_v006_2048.png",
        assets / "surface_yunnan_v006.png",
        assets / "fallback_yunnan_static_v006.jpg",
    )
    mask_report = build_narrow_water_mask(
        assets / "osm_water_mask_v004.png",
        assets / "osm_water_mask_v006.png",
        assets / "water_mask_v006_debug.jpg",
    )
    update_manifest(args.site / "manifest.json", surface_report, mask_report)

    report = {
        "status": "complete",
        "authoritativeDemModified": False,
        "waterAnimation": False,
        "surface": surface_report,
        "waterMask": mask_report,
    }
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
