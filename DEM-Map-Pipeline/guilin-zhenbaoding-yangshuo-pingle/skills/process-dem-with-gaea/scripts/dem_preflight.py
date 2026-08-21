#!/usr/bin/env python3
"""Inspect DEM/heightfield metadata with GDAL, Rasterio, Pillow, or RAW inference."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import shutil
import struct
import subprocess
import sys
from typing import Any


SUPPORTED_GAEA_EXTENSIONS = {
    ".exr", ".tif", ".tiff", ".png", ".jpg", ".jpeg", ".webp",
    ".svg", ".psd", ".hdr", ".pfm", ".r32", ".r16", ".raw",
    ".bmp", ".graw",
}


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def is_power_of_two(value: int | None) -> bool | None:
    if not value or value < 1:
        return None
    return (value & (value - 1)) == 0


def to_builtin(value: Any) -> Any:
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="replace").rstrip("\x00")
    if isinstance(value, (list, tuple)):
        return [to_builtin(item) for item in value]
    try:
        return float(value) if hasattr(value, "numerator") else value
    except Exception:
        return str(value)


def base_report(path: Path) -> dict[str, Any]:
    return {
        "schema_version": 1,
        "input": {
            "path": str(path.resolve()),
            "extension": path.suffix.lower(),
            "size_bytes": path.stat().st_size,
        },
        "backend": None,
        "raster": {
            "width": None,
            "height": None,
            "bands": None,
            "dtype": None,
            "bits_per_sample": None,
            "nodata": None,
            "crs": None,
            "epsg": None,
            "transform": None,
            "bounds": None,
            "pixel_size": None,
            "rotated_or_skewed": None,
            "north_up": None,
        },
        "warnings": [],
        "errors": [],
        "recommendations": [],
    }


def inspect_gdal(path: Path) -> dict[str, Any] | None:
    executable = shutil.which("gdalinfo")
    if not executable:
        return None
    result = subprocess.run(
        [executable, "-json", str(path)],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=False,
    )
    if result.returncode != 0:
        return None
    data = json.loads(result.stdout)
    size = data.get("size") or [None, None]
    bands = data.get("bands") or []
    first_band = bands[0] if bands else {}
    transform = data.get("geoTransform")
    bounds = None
    corners = data.get("cornerCoordinates") or {}
    if corners.get("lowerLeft") and corners.get("upperRight"):
        bounds = [
            corners["lowerLeft"][0], corners["lowerLeft"][1],
            corners["upperRight"][0], corners["upperRight"][1],
        ]
    coordinate_system = data.get("coordinateSystem") or {}
    wkt = coordinate_system.get("wkt")
    epsg = None
    identifier = coordinate_system.get("id") or {}
    if str(identifier.get("authority", "")).upper() == "EPSG":
        epsg = identifier.get("code")
    rotated = None
    north_up = None
    pixel_size = None
    if transform and len(transform) == 6:
        rotated = not (math.isclose(transform[2], 0.0) and math.isclose(transform[4], 0.0))
        north_up = not rotated and transform[1] > 0 and transform[5] < 0
        pixel_size = [transform[1], abs(transform[5])]
    return {
        "backend": "gdalinfo",
        "width": size[0],
        "height": size[1],
        "bands": len(bands),
        "dtype": first_band.get("type"),
        "bits_per_sample": None,
        "nodata": first_band.get("noDataValue"),
        "crs": wkt,
        "epsg": epsg,
        "transform": transform,
        "bounds": bounds,
        "pixel_size": pixel_size,
        "rotated_or_skewed": rotated,
        "north_up": north_up,
        "band_minimum": first_band.get("minimum"),
        "band_maximum": first_band.get("maximum"),
    }


def inspect_rasterio(path: Path) -> dict[str, Any] | None:
    try:
        import rasterio  # type: ignore
    except Exception:
        return None
    try:
        with rasterio.open(path) as dataset:
            transform = list(dataset.transform)[:6]
            rotated = not (math.isclose(transform[1], 0.0) and math.isclose(transform[3], 0.0))
            epsg = dataset.crs.to_epsg() if dataset.crs else None
            return {
                "backend": "rasterio",
                "width": dataset.width,
                "height": dataset.height,
                "bands": dataset.count,
                "dtype": dataset.dtypes[0] if dataset.count else None,
                "bits_per_sample": None,
                "nodata": dataset.nodata,
                "crs": dataset.crs.to_wkt() if dataset.crs else None,
                "epsg": epsg,
                "transform": transform,
                "bounds": list(dataset.bounds),
                "pixel_size": [abs(dataset.res[0]), abs(dataset.res[1])],
                "rotated_or_skewed": rotated,
                "north_up": not rotated and transform[0] > 0 and transform[4] < 0,
            }
    except Exception:
        return None


def parse_geokeys(raw: Any) -> dict[int, Any]:
    values = list(raw or [])
    if len(values) < 4:
        return {}
    count = int(values[3])
    keys: dict[int, Any] = {}
    for index in range(count):
        start = 4 + index * 4
        if start + 3 >= len(values):
            break
        key_id, location, item_count, offset = [int(v) for v in values[start:start + 4]]
        if location == 0 and item_count == 1:
            keys[key_id] = offset
    return keys


def world_file_transform(path: Path) -> list[float] | None:
    candidates = [
        path.with_suffix(".tfw"), path.with_suffix(".TFW"),
        path.with_suffix(path.suffix + "w"), path.with_suffix(path.suffix.upper() + "W"),
        path.with_suffix(".wld"), path.with_suffix(".WLD"),
    ]
    for candidate in candidates:
        if not candidate.exists():
            continue
        try:
            values = [float(line.strip()) for line in candidate.read_text(encoding="utf-8-sig").splitlines() if line.strip()]
            if len(values) != 6:
                continue
            a, d, b, e, c, f = values
            return [c - a / 2 - b / 2, a, b, f - d / 2 - e / 2, d, e]
        except Exception:
            continue
    return None


def inspect_pillow(path: Path) -> dict[str, Any] | None:
    try:
        from PIL import Image
    except Exception:
        return None
    try:
        with Image.open(path) as image:
            tags = getattr(image, "tag_v2", {})
            bits = to_builtin(tags.get(258)) if tags else None
            if isinstance(bits, list) and len(set(bits)) == 1:
                bits = bits[0]
            samples = tags.get(277) if tags else None
            bands = int(samples) if samples else len(image.getbands())
            nodata = to_builtin(tags.get(42113)) if tags else None
            geokeys = parse_geokeys(tags.get(34735) if tags else None)
            epsg = geokeys.get(3072) or geokeys.get(2048)
            crs = f"EPSG:{epsg}" if epsg and epsg not in (0, 32767) else None
            transform = None
            pixel_scale = to_builtin(tags.get(33550)) if tags else None
            tiepoint = to_builtin(tags.get(33922)) if tags else None
            if isinstance(pixel_scale, list) and len(pixel_scale) >= 2 and isinstance(tiepoint, list) and len(tiepoint) >= 6:
                sx, sy = float(pixel_scale[0]), float(pixel_scale[1])
                i, j, _, x, y, _ = [float(value) for value in tiepoint[:6]]
                transform = [x - i * sx, sx, 0.0, y + j * sy, 0.0, -sy]
            if transform is None:
                transform = world_file_transform(path)
            rotated = None
            north_up = None
            bounds = None
            pixel_size = None
            if transform:
                rotated = not (math.isclose(transform[2], 0.0) and math.isclose(transform[4], 0.0))
                north_up = not rotated and transform[1] > 0 and transform[5] < 0
                pixel_size = [abs(transform[1]), abs(transform[5])]
                if not rotated:
                    left = transform[0]
                    top = transform[3]
                    right = left + image.width * transform[1]
                    bottom = top + image.height * transform[5]
                    bounds = [min(left, right), min(bottom, top), max(left, right), max(bottom, top)]
            mode_to_dtype = {
                "1": "1-bit", "L": "uint8", "P": "uint8", "I;16": "uint16",
                "I;16L": "uint16", "I;16B": "uint16", "I": "int32", "F": "float32",
                "RGB": "uint8", "RGBA": "uint8",
            }
            return {
                "backend": "pillow",
                "width": image.width,
                "height": image.height,
                "bands": bands,
                "dtype": mode_to_dtype.get(image.mode, image.mode),
                "bits_per_sample": bits,
                "nodata": nodata,
                "crs": crs,
                "epsg": epsg if epsg not in (0, 32767) else None,
                "transform": transform,
                "bounds": bounds,
                "pixel_size": pixel_size,
                "rotated_or_skewed": rotated,
                "north_up": north_up,
                "pillow_mode": image.mode,
                "geo_model_type": geokeys.get(1024),
                "raster_type": geokeys.get(1025),
            }
    except Exception:
        return None


RAW_DTYPES = {
    "uint16": (2, "H"),
    "int16": (2, "h"),
    "float32": (4, "f"),
    "uint8": (1, "B"),
}


def inspect_raw(path: Path, width: int | None, height: int | None, dtype: str | None, endianness: str) -> dict[str, Any] | None:
    extension = path.suffix.lower()
    if extension not in {".raw", ".r16", ".r32", ".graw"}:
        return None
    if dtype is None:
        dtype = "uint16" if extension == ".r16" else "float32" if extension in {".r32", ".graw"} else None
    if dtype not in RAW_DTYPES:
        return {"backend": "raw", "error": "RAW input requires --dtype uint16|int16|float32|uint8."}
    bytes_per_value, _ = RAW_DTYPES[dtype]
    value_count, remainder = divmod(path.stat().st_size, bytes_per_value)
    if remainder:
        return {"backend": "raw", "error": f"File size is not divisible by {bytes_per_value} bytes for {dtype}."}
    if width and not height and value_count % width == 0:
        height = value_count // width
    if height and not width and value_count % height == 0:
        width = value_count // height
    if not width and not height:
        side = math.isqrt(value_count)
        if side * side == value_count:
            width = height = side
    if not width or not height:
        return {"backend": "raw", "error": "Cannot infer RAW dimensions; pass --width and --height."}
    if width * height != value_count:
        return {"backend": "raw", "error": f"Dimensions {width}x{height} do not match {value_count} values."}
    return {
        "backend": "raw",
        "width": width,
        "height": height,
        "bands": 1,
        "dtype": dtype,
        "bits_per_sample": bytes_per_value * 8,
        "nodata": None,
        "crs": None,
        "epsg": None,
        "transform": world_file_transform(path),
        "bounds": None,
        "pixel_size": None,
        "rotated_or_skewed": None,
        "north_up": None,
        "endianness": endianness,
    }


def crs_is_geographic(crs: Any, epsg: Any) -> bool:
    if epsg in {4326, 4269, 4258, 4490}:
        return True
    text = str(crs or "").upper()
    return "GEOGCRS" in text or "GEOGRAPHICCRS" in text or "GEOGCS" in text


def finalize(report: dict[str, Any]) -> None:
    raster = report["raster"]
    warnings = report["warnings"]
    errors = report["errors"]
    recommendations = report["recommendations"]
    width, height = raster.get("width"), raster.get("height")
    raster["is_square"] = bool(width and height and width == height)
    raster["width_is_power_of_two"] = is_power_of_two(width)
    raster["height_is_power_of_two"] = is_power_of_two(height)

    extension = report["input"]["extension"]
    report["gaea_import_extension_supported"] = extension in SUPPORTED_GAEA_EXTENSIONS
    if not report["gaea_import_extension_supported"]:
        warnings.append(f"{extension or 'No extension'} is not in the documented Gaea import-format set.")
    if width and height and width != height:
        warnings.append("Raster is not square; choose a documented crop, pad, or square tiling plan before Gaea.")
    if raster.get("bands") and raster["bands"] != 1:
        warnings.append("Raster has multiple bands; select the elevation band explicitly before Gaea.")
    if raster.get("nodata") is not None:
        warnings.append("NoData is present; save a validity mask and define a fill/reapply policy outside Gaea.")
    if raster.get("rotated_or_skewed"):
        warnings.append("Raster transform is rotated/skewed; warp to an intentional north-up working grid.")
    if not raster.get("crs"):
        warnings.append("No authoritative CRS was detected by the available backend.")
    elif crs_is_geographic(raster.get("crs"), raster.get("epsg")):
        warnings.append("CRS appears geographic (degrees); reproject to a suitable projected metric CRS before setting Gaea scale.")
    dtype_text = str(raster.get("dtype") or "").lower()
    bits = raster.get("bits_per_sample")
    bits_values = bits if isinstance(bits, list) else [bits]
    if extension in {".jpg", ".jpeg"}:
        warnings.append("JPEG is lossy and unsuitable for precision displacement.")
    if "uint8" in dtype_text or any(value == 8 for value in bits_values):
        warnings.append("8-bit elevation is quantized; use 32-bit source data or treat Heal as artistic reconstruction only.")
    if extension in {".raw", ".r16", ".r32", ".graw"}:
        warnings.append("Headerless RAW carries no reliable CRS, transform, NoData, or vertical metadata; keep a sidecar context manifest.")

    recommendations.extend([
        "Preserve the source unchanged and record a source hash plus geospatial/vertical metadata.",
        "Use a lossless 32-bit TIFF, EXR, or R32 path for the main heightfield.",
        "Record one elevation mapping for the entire world; never normalize each tile independently.",
        "Inspect the Gaea output before restoring CRS, transform, NoData, and vertical metadata.",
    ])
    report["status"] = "error" if errors else "warning" if warnings else "pass"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path)
    parser.add_argument("--width", type=int, help="Width for headerless RAW input")
    parser.add_argument("--height", type=int, help="Height for headerless RAW input")
    parser.add_argument("--dtype", choices=sorted(RAW_DTYPES), help="Sample type for headerless RAW input")
    parser.add_argument("--endianness", choices=("little", "big"), default="little")
    parser.add_argument("--hash", action="store_true", help="Calculate SHA-256 (can be slow on large DEMs)")
    parser.add_argument("--report", type=Path, help="Write the JSON report to this path")
    parser.add_argument("--pretty", action="store_true")
    parser.add_argument("--strict", action="store_true", help="Return exit code 1 when warnings exist")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    path = args.input.expanduser().resolve()
    if not path.is_file():
        print(json.dumps({"status": "error", "errors": [f"Input file not found: {path}"]}, ensure_ascii=False, indent=2))
        return 2
    report = base_report(path)
    if args.hash:
        report["input"]["sha256"] = sha256_file(path)

    metadata = inspect_gdal(path) or inspect_rasterio(path) or inspect_pillow(path)
    if metadata is None:
        metadata = inspect_raw(path, args.width, args.height, args.dtype, args.endianness)
    if metadata is None:
        report["errors"].append("No available backend could inspect this file. Install GDAL/Rasterio or convert to GeoTIFF/RAW.")
    elif metadata.get("error"):
        report["backend"] = metadata.get("backend")
        report["errors"].append(metadata["error"])
    else:
        report["backend"] = metadata.pop("backend")
        report["raster"].update(metadata)
    finalize(report)

    output = json.dumps(report, ensure_ascii=False, indent=2 if args.pretty else None)
    print(output)
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(output + "\n", encoding="utf-8")
    if report["errors"]:
        return 2
    if args.strict and report["warnings"]:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
