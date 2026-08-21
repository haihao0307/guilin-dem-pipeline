#!/usr/bin/env python3
"""Compile a restored DEM/heightfield into a manifest-led Three.js height package."""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path
import re
import shutil
import sys
from typing import Any

import numpy as np


RAW_DTYPES = {
    "uint8": np.dtype("u1"),
    "uint16": np.dtype("<u2"),
    "int16": np.dtype("<i2"),
    "float32": np.dtype("<f4"),
}


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_json(path: Path | None) -> dict[str, Any]:
    if path is None:
        return {}
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError("Context JSON must contain an object.")
    return value


def context_raster(context: dict[str, Any]) -> dict[str, Any]:
    raster = context.get("raster")
    return raster if isinstance(raster, dict) else context


def context_value(context: dict[str, Any], *keys: str) -> Any:
    raster = context_raster(context)
    for key in keys:
        if key in raster and raster[key] is not None:
            return raster[key]
        if key in context and context[key] is not None:
            return context[key]
    return None


def load_heightfield(path: Path, width: int | None, height: int | None, dtype_name: str | None, band: int, context: dict[str, Any]) -> np.ndarray:
    extension = path.suffix.lower()
    if extension in {".raw", ".r16", ".r32", ".graw"}:
        if dtype_name is None:
            dtype_name = "uint16" if extension == ".r16" else "float32" if extension in {".r32", ".graw"} else None
        if dtype_name not in RAW_DTYPES:
            raise ValueError("Headerless RAW requires --input-dtype uint8|uint16|int16|float32.")
        width = width or context_value(context, "width")
        height = height or context_value(context, "height")
        dtype = RAW_DTYPES[dtype_name]
        samples = np.fromfile(path, dtype=dtype)
        if not width and not height:
            side = math.isqrt(samples.size)
            if side * side == samples.size:
                width = height = side
        if width and not height and samples.size % int(width) == 0:
            height = samples.size // int(width)
        if height and not width and samples.size % int(height) == 0:
            width = samples.size // int(height)
        if not width or not height or int(width) * int(height) != samples.size:
            raise ValueError(f"RAW dimensions do not match {samples.size} samples; pass --input-width and --input-height.")
        return samples.reshape((int(height), int(width))).astype(np.float32)

    try:
        from PIL import Image
    except Exception as exc:
        raise ValueError("Pillow is required for TIFF/PNG input; use RAW/R32 or install Pillow.") from exc
    try:
        with Image.open(path) as image:
            array = np.asarray(image)
    except Exception as exc:
        raise ValueError(f"Could not read {path.name} with Pillow; convert to Float32 TIFF/R32 or install GDAL/Rasterio: {exc}") from exc
    if array.ndim == 3:
        if band < 1 or band > array.shape[2]:
            raise ValueError(f"--band must be 1..{array.shape[2]} for this input.")
        array = array[:, :, band - 1]
    if array.ndim != 2:
        raise ValueError(f"Expected one height band, got array shape {array.shape}.")
    return array.astype(np.float32)


def resize_heightfield(values: np.ndarray, max_dimension: int | None) -> tuple[np.ndarray, dict[str, Any]]:
    original_height, original_width = values.shape
    if not max_dimension or max(original_width, original_height) <= max_dimension:
        return values, {"resampled": False, "source_width": original_width, "source_height": original_height}
    scale = max_dimension / max(original_width, original_height)
    target_width = max(2, int(round(original_width * scale)))
    target_height = max(2, int(round(original_height * scale)))
    try:
        from PIL import Image
    except Exception as exc:
        raise ValueError("Pillow is required for --max-dimension resampling.") from exc
    image = Image.fromarray(values, mode="F")
    resized = np.asarray(image.resize((target_width, target_height), resample=Image.Resampling.BILINEAR), dtype=np.float32)
    return resized, {
        "resampled": True,
        "source_width": original_width,
        "source_height": original_height,
        "method": "bilinear",
        "target_width": target_width,
        "target_height": target_height,
    }


def parse_layer(text: str) -> tuple[str, Path]:
    if "=" not in text:
        raise argparse.ArgumentTypeError("Expected --layer NAME=PATH")
    name, path_text = text.split("=", 1)
    name = name.strip()
    if not re.fullmatch(r"[a-z][a-z0-9-]{0,63}", name):
        raise argparse.ArgumentTypeError("Layer name must match [a-z][a-z0-9-]{0,63}.")
    return name, Path(path_text.strip())


def normalized_context(context: dict[str, Any]) -> dict[str, Any]:
    raster = context_raster(context)
    allowed = {
        "crs": raster.get("crs"),
        "epsg": raster.get("epsg"),
        "transform": raster.get("transform"),
        "bounds": raster.get("bounds"),
        "pixel_size": raster.get("pixel_size"),
        "nodata": raster.get("nodata"),
    }
    return {key: value for key, value in allowed.items() if value is not None}


def ensure_empty_target(out_dir: Path, force: bool) -> None:
    managed = [out_dir / "terrain-manifest.json", out_dir / "height.u16.bin", out_dir / "height.f32.bin"]
    existing = [path for path in managed if path.exists()]
    if existing and not force:
        raise FileExistsError(f"Managed output already exists: {existing[0]}. Use a new version directory or --force.")
    out_dir.mkdir(parents=True, exist_ok=True)


def write_layers(out_dir: Path, layers: list[tuple[str, Path]] | None, force: bool) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    if not layers:
        return records
    layer_dir = out_dir / "layers"
    layer_dir.mkdir(parents=True, exist_ok=True)
    for name, source in layers:
        source = source.expanduser().resolve()
        if not source.is_file():
            raise FileNotFoundError(f"Layer not found: {source}")
        target = layer_dir / f"{name}{source.suffix.lower()}"
        if target.exists() and not force:
            raise FileExistsError(f"Layer output exists: {target}")
        shutil.copy2(source, target)
        records.append({
            "name": name,
            "url": f"layers/{target.name}",
            "extension": target.suffix.lower(),
            "size_bytes": target.stat().st_size,
            "sha256": sha256_file(target),
            "interpretation": "linear-data" if name not in {"color", "albedo", "satellite"} else "color",
        })
    return records


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path)
    parser.add_argument("--out-dir", type=Path, required=True)
    parser.add_argument("--context", type=Path, help="dem_preflight/context JSON")
    parser.add_argument("--value-mode", choices=("normalized", "elevation"), required=True)
    parser.add_argument("--z-floor", type=float, help="Elevation represented by normalized 0")
    parser.add_argument("--z-ceiling", type=float, help="Elevation represented by normalized 1")
    parser.add_argument("--input-width", type=int)
    parser.add_argument("--input-height", type=int)
    parser.add_argument("--input-dtype", choices=sorted(RAW_DTYPES))
    parser.add_argument("--band", type=int, default=1)
    parser.add_argument("--max-dimension", type=int, help="Downsample longest side for a single-grid web tier")
    parser.add_argument("--encoding", choices=("uint16", "float32"), default="uint16")
    parser.add_argument("--quant-min", type=float, help="Shared Uint16 world/variant minimum elevation")
    parser.add_argument("--quant-max", type=float, help="Shared Uint16 world/variant maximum elevation")
    parser.add_argument("--allow-clipping", action="store_true")
    parser.add_argument("--world-width-m", type=float, required=True)
    parser.add_argument("--world-depth-m", type=float, required=True)
    parser.add_argument("--height-origin-m", type=float, help="Local Y=0 elevation; defaults to quant min or actual min")
    parser.add_argument("--title", default="Three.js terrain")
    parser.add_argument("--city-id")
    parser.add_argument("--asset-version")
    parser.add_argument("--vertical-unit", default="metre")
    parser.add_argument("--layer", action="append", type=parse_layer, metavar="NAME=PATH")
    parser.add_argument("--force", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    input_path = args.input.expanduser().resolve()
    out_dir = args.out_dir.expanduser().resolve()
    if not input_path.is_file():
        raise FileNotFoundError(f"Input not found: {input_path}")
    if args.world_width_m <= 0 or args.world_depth_m <= 0:
        raise ValueError("World width/depth must be positive metres.")
    if args.max_dimension is not None and args.max_dimension < 2:
        raise ValueError("--max-dimension must be at least 2.")
    context = load_json(args.context.expanduser().resolve() if args.context else None)
    ensure_empty_target(out_dir, args.force)

    values = load_heightfield(input_path, args.input_width, args.input_height, args.input_dtype, args.band, context)
    if args.value_mode == "normalized":
        if args.z_floor is None or args.z_ceiling is None or not args.z_ceiling > args.z_floor:
            raise ValueError("Normalized input requires --z-floor and --z-ceiling with ceiling > floor.")
        values = args.z_floor + values * (args.z_ceiling - args.z_floor)
    finite = np.isfinite(values)
    if not finite.all():
        raise ValueError(f"Input contains {int((~finite).sum())} non-finite/NoData samples. Fill for Gaea/web and package a validity mask separately.")

    values, resample = resize_heightfield(values, args.max_dimension)
    actual_min = float(values.min())
    actual_max = float(values.max())
    height, width = values.shape
    clipping_low = clipping_high = 0

    if args.encoding == "uint16":
        if (args.quant_min is None) != (args.quant_max is None):
            raise ValueError("Pass both --quant-min and --quant-max, or neither for a derived single-grid range.")
        quant_min = actual_min if args.quant_min is None else args.quant_min
        quant_max = actual_max if args.quant_max is None else args.quant_max
        if not quant_max > quant_min:
            raise ValueError("Quantization maximum must be greater than minimum.")
        clipping_low = int((values < quant_min).sum())
        clipping_high = int((values > quant_max).sum())
        if (clipping_low or clipping_high) and not args.allow_clipping:
            raise ValueError(f"Quantization would clip {clipping_low} low and {clipping_high} high samples; fix the shared range or pass --allow-clipping deliberately.")
        encoded = np.rint((np.clip(values, quant_min, quant_max) - quant_min) / (quant_max - quant_min) * 65535.0).astype("<u2")
        height_path = out_dir / "height.u16.bin"
        decode = {
            "encoding": "uint16-le",
            "byte_order": "little",
            "quant_min_m": quant_min,
            "quant_max_m": quant_max,
            "formula": "elevation_m = quant_min_m + sample_u16 / 65535 * (quant_max_m - quant_min_m)",
            "range_source": "explicit" if args.quant_min is not None else "derived-single-grid",
        }
        default_origin = quant_min
    else:
        encoded = values.astype("<f4")
        height_path = out_dir / "height.f32.bin"
        decode = {
            "encoding": "float32-le",
            "byte_order": "little",
            "formula": "elevation_m = sample_f32",
        }
        default_origin = actual_min

    encoded.tofile(height_path)
    layers = write_layers(out_dir, args.layer, args.force)
    source_hash = sha256_file(input_path)
    asset_version = args.asset_version or source_hash[:12]
    height_origin = args.height_origin_m if args.height_origin_m is not None else default_origin
    context_public = normalized_context(context)
    triangles = max(0, (width - 1) * (height - 1) * 2)
    manifest = {
        "schema": "three-terrain/v1",
        "asset_version": asset_version,
        "generated_utc": datetime.now(timezone.utc).isoformat(),
        "title": args.title,
        "city_id": args.city_id,
        "grid": {
            "width": width,
            "height": height,
            "row_order": "north-to-south",
            "column_order": "west-to-east",
            "source_context": context_public,
            "resampling": resample,
        },
        "local_frame": {
            "axis": {"x": "east", "y": "up", "z": "south"},
            "origin_horizontal": "footprint-center",
            "height_origin_m": height_origin,
            "world_width_m": args.world_width_m,
            "world_depth_m": args.world_depth_m,
            "metres_per_segment_x": args.world_width_m / max(1, width - 1),
            "metres_per_segment_z": args.world_depth_m / max(1, height - 1),
        },
        "height": {
            "url": height_path.name,
            "sample_count": int(encoded.size),
            "size_bytes": height_path.stat().st_size,
            "sha256": sha256_file(height_path),
            "actual_min_m": actual_min,
            "actual_max_m": actual_max,
            "vertical_unit": args.vertical_unit,
            "clipped_low_samples": clipping_low,
            "clipped_high_samples": clipping_high,
            **decode,
        },
        "geometry_budget": {
            "vertices_if_full_grid": int(width * height),
            "triangles_if_full_grid": int(triangles),
            "warning": "Use tiled LOD instead of one mesh when this exceeds the tested device budget.",
        },
        "layers": layers,
        "provenance": {
            "source_filename": input_path.name,
            "source_sha256": source_hash,
            "value_mode": args.value_mode,
            "context_filename": args.context.name if args.context else None,
        },
    }
    manifest_path = out_dir / "terrain-manifest.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    report = {
        "status": "pass",
        "manifest": str(manifest_path),
        "height": str(height_path),
        "grid": [width, height],
        "actual_elevation_m": [actual_min, actual_max],
        "vertices": int(width * height),
        "triangles": int(triangles),
        "warnings": [
            "Quantization range was derived from this grid; pass an explicit shared range for tiles or variants."
        ] if args.encoding == "uint16" and args.quant_min is None else [],
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print(json.dumps({"status": "error", "error": str(exc)}, ensure_ascii=False, indent=2))
        raise SystemExit(2)
