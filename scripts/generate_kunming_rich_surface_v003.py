#!/usr/bin/env python3
"""Generate deterministic, rich satellite-style display color from RG16 DEM height.

This script creates browser-only visualization assets. It never edits or replaces the
uncompressed authoritative float32 DEM.
"""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def decode_rg16(path: Path) -> tuple[Image.Image, np.ndarray]:
    image = Image.open(path).convert("RGB")
    rgb = np.asarray(image)
    height = ((rgb[:, :, 0].astype(np.uint16) << 8) | rgb[:, :, 1].astype(np.uint16)).astype(np.float32) / 65535.0
    return image, height


def generate(height_path: Path, surface_path: Path, fallback_path: Path, report_path: Path) -> None:
    source_image, height = decode_rg16(height_path)
    gy, gx = np.gradient(height)
    slope = np.sqrt(gx * gx + gy * gy)
    slope = np.clip(slope / (np.percentile(slope, 99.0) + 1e-6), 0.0, 1.0)

    blurred = np.asarray(
        Image.fromarray(np.uint8(height * 255.0)).filter(ImageFilter.GaussianBlur(radius=18)),
        dtype=np.float32,
    ) / 255.0
    relief = height - blurred
    relief = np.clip(
        (relief - np.percentile(relief, 2.0)) /
        (np.percentile(relief, 98.0) - np.percentile(relief, 2.0) + 1e-6),
        0.0,
        1.0,
    )

    azimuth = np.deg2rad(315.0)
    altitude = np.deg2rad(45.0)
    ddy, ddx = np.gradient(height * 3.0)
    slope_angle = np.pi / 2.0 - np.arctan(np.sqrt(ddx * ddx + ddy * ddy))
    aspect = np.arctan2(-ddx, ddy)
    hillshade = (
        np.sin(altitude) * np.sin(slope_angle) +
        np.cos(altitude) * np.cos(slope_angle) * np.cos(azimuth - aspect)
    )
    hillshade = (hillshade - hillshade.min()) / (hillshade.max() - hillshade.min() + 1e-6)

    stops = np.array([0.0, 0.14, 0.28, 0.45, 0.62, 0.78, 0.90, 1.0], dtype=np.float32)
    colors = np.array([
        [70, 96, 54], [111, 135, 70], [150, 162, 82], [170, 155, 97],
        [151, 118, 77], [133, 104, 83], [188, 180, 170], [238, 238, 236],
    ], dtype=np.float32) / 255.0

    output = np.zeros(height.shape + (3,), dtype=np.float32)
    for index in range(len(stops) - 1):
        mask = (height >= stops[index]) & (height <= stops[index + 1] if index == len(stops) - 2 else height < stops[index + 1])
        t = (height[mask] - stops[index]) / (stops[index + 1] - stops[index] + 1e-6)
        output[mask] = colors[index] * (1.0 - t[:, None]) + colors[index + 1] * t[:, None]

    valley = (1.0 - height) * 0.55 + (1.0 - slope) * 0.45
    output[:, :, 1] += 0.14 * valley
    output[:, :, 0] -= 0.04 * valley

    rock = np.clip(slope * 0.85 + np.maximum(height - 0.45, 0.0) * 1.2, 0.0, 1.0)
    output[:, :, 0] += 0.09 * rock
    output[:, :, 1] -= 0.08 * rock
    output[:, :, 2] -= 0.02 * rock

    output += (relief[:, :, None] - 0.5) * np.array([0.09, 0.07, 0.05], dtype=np.float32)
    output *= (0.72 + 0.45 * hillshade)[:, :, None]
    ridge = np.clip(relief * 1.4 + height * 0.4 - 0.75, 0.0, 1.0)
    output += ridge[:, :, None] * 0.12
    output = np.clip(output, 0.0, 1.0)

    surface_path.parent.mkdir(parents=True, exist_ok=True)
    surface = Image.fromarray(np.uint8(output * 255.0), "RGB")
    surface.save(surface_path, optimize=False)
    surface.save(fallback_path, optimize=False)

    report = {
        "status": "complete",
        "input": {"file": str(height_path), "sha256": sha256(height_path), "size": list(source_image.size)},
        "surface": {"file": str(surface_path), "sha256": sha256(surface_path), "bytes": surface_path.stat().st_size},
        "fallback": {"file": str(fallback_path), "sha256": sha256(fallback_path), "bytes": fallback_path.stat().st_size},
        "deterministic": True,
        "randomSeed": None,
        "authoritativeDemModified": False,
    }
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--height", type=Path, required=True)
    parser.add_argument("--surface", type=Path, required=True)
    parser.add_argument("--fallback", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    args = parser.parse_args()
    generate(args.height, args.surface, args.fallback, args.report)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
