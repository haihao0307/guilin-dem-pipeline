from __future__ import annotations

"""Dependency-light DEM mosaic for environments without rasterio/GDAL.

This is deliberately a transparent fallback: it maps the original 12.5 m
source pixels onto the already-resolved EPSG:32649 grid, averages only true
overlaps, and leaves all uncovered pixels as NoData.  It never upscales,
interpolates, or claims COG/GIS-grade output.
"""

import argparse
import hashlib
import json
import math
import os
import shutil
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image, TiffImagePlugin


Image.MAX_IMAGE_PIXELS = None

NODATA = -32768.0
RESOLUTION = 12.5


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def source_paths(root: Path) -> list[Path]:
    paths: list[Path] = []
    manifest = read_json(root / "metadata" / "existing_five_resolved.json")
    for record in manifest.get("files", []):
        candidate = Path(str(record.get("resolvedPath", "")))
        if candidate.is_file():
            paths.append(candidate.resolve())
    for candidate in sorted((root / "data" / "raw" / "dem").glob("*.tif")):
        if candidate.is_file():
            paths.append(candidate.resolve())
    unique: list[Path] = []
    seen: set[Path] = set()
    for path in paths:
        if path not in seen:
            seen.add(path)
            unique.append(path)
    return unique


def georef(path: Path) -> tuple[int, int, float, float, float]:
    image = Image.open(path)
    scale = image.tag_v2.get(33550)
    tie = image.tag_v2.get(33922)
    if not scale or not tie or len(scale) < 2 or len(tie) < 6:
        raise RuntimeError(f"missing GeoTIFF georeferencing tags: {path}")
    sx, sy = float(scale[0]), float(scale[1])
    x0, y_top = float(tie[3]), float(tie[4])
    if abs(sx - RESOLUTION) > 0.01 or abs(sy - RESOLUTION) > 0.01:
        raise RuntimeError(f"unexpected source spacing in {path.name}: {sx}, {sy}")
    return image.width, image.height, sx, x0, y_top


def write_geotiff(path: Path, data: np.ndarray, template: Image.Image, x0: float, y_top: float) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image = Image.fromarray(data, mode="F")
    tags = TiffImagePlugin.ImageFileDirectory_v2()
    for tag in (33550, 33922, 34735, 34737, 42113):
        if tag in template.tag_v2:
            tags[tag] = template.tag_v2[tag]
    tags[33550] = (RESOLUTION, RESOLUTION, 0.0)
    tags[33922] = (0.0, 0.0, 0.0, float(x0), float(y_top), 0.0)
    tags[42113] = str(int(NODATA))
    image.save(path, format="TIFF", compression="tiff_deflate", tiffinfo=tags)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()
    root = args.root.resolve()
    work = root / "data" / "work"
    reports = root / "reports"
    base_path = work / "mosaic_raw_float32.tif"
    mask_path = work / "fill_class_uint8.tif"
    if not base_path.is_file() or not mask_path.is_file():
        raise RuntimeError("resolved target grid is missing: run the normal preflight first")

    base = Image.open(base_path)
    width, height = base.size
    scale = base.tag_v2.get(33550)
    tie = base.tag_v2.get(33922)
    if not scale or not tie:
        raise RuntimeError("target grid has no GeoTIFF georeferencing tags")
    resolution = float(scale[0])
    x0, y_top = float(tie[3]), float(tie[4])
    if abs(resolution - RESOLUTION) > 0.01:
        raise RuntimeError(f"unexpected target spacing: {resolution}")

    inside = np.asarray(Image.open(mask_path).convert("L"), dtype=np.uint8) != 255
    if inside.shape != (height, width):
        raise RuntimeError("target inside-mask dimensions do not match target grid")

    mosaic_path = work / "mosaic_all_10_float32.dat"
    count_path = work / "mosaic_all_10_source_count_uint8.dat"
    if args.force or not mosaic_path.exists() or mosaic_path.stat().st_size != width * height * 4:
        if mosaic_path.exists():
            mosaic_path.unlink()
        mosaic = np.memmap(mosaic_path, mode="w+", dtype="<f4", shape=(height, width))
        mosaic[:] = NODATA
        mosaic.flush()
    else:
        mosaic = np.memmap(mosaic_path, mode="r+", dtype="<f4", shape=(height, width))
    if args.force or not count_path.exists() or count_path.stat().st_size != width * height:
        if count_path.exists():
            count_path.unlink()
        counts = np.memmap(count_path, mode="w+", dtype="u1", shape=(height, width))
        counts[:] = 0
        counts.flush()
    else:
        counts = np.memmap(count_path, mode="r+", dtype="u1", shape=(height, width))

    records: list[dict[str, Any]] = []
    paths = source_paths(root)
    if len(paths) != 10:
        raise RuntimeError(f"expected 10 verified source rasters, found {len(paths)}")

    for index, path in enumerate(paths, start=1):
        image = Image.open(path)
        source = np.asarray(image, dtype=np.int32)
        sw, sh, _, sx0, sy_top = georef(path)
        col0 = int(round((sx0 - x0) / resolution))
        row0 = int(round((y_top - sy_top) / resolution))
        src_r0 = max(0, -row0)
        src_c0 = max(0, -col0)
        src_r1 = min(sh, height - row0)
        src_c1 = min(sw, width - col0)
        written = 0
        if src_r1 > src_r0 and src_c1 > src_c0:
            dst_r0, dst_c0 = max(0, row0), max(0, col0)
            dst_r1, dst_c1 = dst_r0 + (src_r1 - src_r0), dst_c0 + (src_c1 - src_c0)
            values = source[src_r0:src_r1, src_c0:src_c1]
            valid = values != 0
            valid &= inside[dst_r0:dst_r1, dst_c0:dst_c1]
            if np.any(valid):
                dst_values = mosaic[dst_r0:dst_r1, dst_c0:dst_c1]
                dst_counts = counts[dst_r0:dst_r1, dst_c0:dst_c1]
                old = dst_counts[valid].astype(np.float32)
                incoming = values[valid].astype(np.float32)
                current = dst_values[valid]
                first = old == 0
                current[first] = incoming[first]
                if np.any(~first):
                    current[~first] = (current[~first] * old[~first] + incoming[~first]) / (old[~first] + 1.0)
                dst_values[valid] = current
                dst_counts[valid] = np.minimum(old + 1.0, 255).astype(np.uint8)
                written = int(valid.sum())
        records.append(
            {
                "file": path.name,
                "bytes": path.stat().st_size,
                "sha256": sha256(path),
                "width": sw,
                "height": sh,
                "topLeft": [sx0, sy_top],
                "targetOffsetPixels": [col0, row0],
                "validPixelsWritten": written,
            }
        )
        print(f"[{index}/{len(paths)}] {path.name}: wrote {written:,} pixels", flush=True)

    mosaic.flush()
    counts.flush()
    valid = (counts > 0) & inside
    inside_pixels = int(inside.sum())
    valid_pixels = int(valid.sum())
    total_pixels = int(width * height)
    gap_pixels = inside_pixels - valid_pixels
    valid_fraction = valid_pixels / inside_pixels if inside_pixels else 0.0
    bounds = [x0, y_top - height * resolution, x0 + width * resolution, y_top]

    mosaic_out = root / "outputs" / "DEM_Zhenbaoding15km_to_Yangshuo_Pingle_12_5m_incomplete_preview.tif"
    count_out = root / "outputs" / "DEM_Zhenbaoding15km_to_Yangshuo_Pingle_source_count_12_5m_incomplete_preview.tif"
    template = Image.open(base_path)
    # Pillow's TIFF writer reads the memmap scanlines directly; no upsample/fill is performed.
    write_geotiff(mosaic_out, mosaic, template, x0, y_top)
    write_geotiff(count_out, counts.astype(np.float32), template, x0, y_top)

    qa = {
        "schemaVersion": "guilin-pillow-mosaic-qa/v1",
        "status": "incomplete_real_pixel_mosaic" if gap_pixels else "complete_real_pixel_mosaic",
        "method": "Pillow+NumPy direct georeferenced pixel placement; overlap mean; no interpolation",
        "sourceCount": len(records),
        "sources": records,
        "grid": {
            "width": width,
            "height": height,
            "resolutionMeters": resolution,
            "crs": "EPSG:32649",
            "bounds": bounds,
        },
        "coverage": {
            "insidePixels": inside_pixels,
            "validPixels": valid_pixels,
            "gapPixels": gap_pixels,
            "totalGridPixels": total_pixels,
            "validFractionInsideTarget": valid_fraction,
            "gapAreaSquareKilometers": gap_pixels * resolution * resolution / 1_000_000.0,
        },
        "outputs": {
            "dem": str(mosaic_out.relative_to(root)).replace("\\", "/"),
            "sourceCount": str(count_out.relative_to(root)).replace("\\", "/"),
            "workingFloat32": str(mosaic_path.relative_to(root)).replace("\\", "/"),
            "workingSourceCount": str(count_path.relative_to(root)).replace("\\", "/"),
        },
        "releasePolicy": "即使覆盖率高于 99.5%，只要仍有超过 10 平方公里的大缺口，就不替换正式 COG，也不声称完整12.5米覆盖。",
    }
    write_json(reports / "QA_12_5M_PILLOW_MOSAIC.json", qa)
    print(json.dumps({"status": qa["status"], "validFractionInsideTarget": valid_fraction, "gapAreaSquareKilometers": qa["coverage"]["gapAreaSquareKilometers"], "dem": str(mosaic_out)}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
