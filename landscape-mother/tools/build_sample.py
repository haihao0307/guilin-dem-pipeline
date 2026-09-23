#!/usr/bin/env python3
"""Build a tiny image-free Landscape Mother sample from locked numeric truth.

The script validates the canonical parent assets, extracts the exact 81 x 81
integer source window, clips immutable hydrology records without changing their
planimetry, and emits only compact numeric assets plus a receipt.
"""
from __future__ import annotations

import argparse
import array
import hashlib
import json
import math
import struct
import sys
from pathlib import Path
from typing import Any


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--contract", required=True, type=Path)
    parser.add_argument("--dem-manifest", required=True, type=Path)
    parser.add_argument("--parent-tile", required=True, type=Path)
    parser.add_argument("--hydrology-manifest", required=True, type=Path)
    parser.add_argument("--hydrology-segments", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    return parser.parse_args()


def read_json(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise RuntimeError(f"{path} must contain a JSON object")
    return value


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def read_i16_le(path: Path) -> array.array:
    values = array.array("h")
    with path.open("rb") as handle:
        values.fromfile(handle, path.stat().st_size // 2)
    if sys.byteorder != "little":
        values.byteswap()
    return values


def read_f32_le(path: Path) -> array.array:
    values = array.array("f")
    with path.open("rb") as handle:
        values.fromfile(handle, path.stat().st_size // 4)
    if sys.byteorder != "little":
        values.byteswap()
    return values


def pack_i16_le(values: list[int]) -> bytes:
    return b"".join(struct.pack("<h", value) for value in values)


def pack_f32_le(values: list[float]) -> bytes:
    return b"".join(struct.pack("<f", value) for value in values)


def liang_barsky(
    x0: float,
    z0: float,
    x1: float,
    z1: float,
    minimum: float,
    maximum: float,
) -> tuple[float, float] | None:
    dx = x1 - x0
    dz = z1 - z0
    p = (-dx, dx, -dz, dz)
    q = (x0 - minimum, maximum - x0, z0 - minimum, maximum - z0)
    t0 = 0.0
    t1 = 1.0
    for pi, qi in zip(p, q):
        if abs(pi) <= 1e-12:
            if qi < 0:
                return None
            continue
        ratio = qi / pi
        if pi < 0:
            t0 = max(t0, ratio)
        else:
            t1 = min(t1, ratio)
        if t0 > t1:
            return None
    return t0, t1


def lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def main() -> int:
    args = parse_args()
    contract = read_json(args.contract)
    dem_manifest = read_json(args.dem_manifest)
    hydrology_manifest = read_json(args.hydrology_manifest)

    if contract.get("schema") != "landscape-mother-kernel/v1":
        raise RuntimeError("Landscape Mother contract schema mismatch")
    source = contract["source"]
    sample = contract["sample"]
    rules = contract["rules"]
    if rules["truthOverwrite"] is not False or rules["sourceResampling"] is not False or rules["syntheticGapFill"] is not False:
        raise RuntimeError("truth protection flags changed")
    if rules["verticalScale"] != 1.0:
        raise RuntimeError("vertical scale must remain 1.0")
    if any(rules[key] != 0 for key in (
        "materialTextureCount",
        "terrainImageTextureCount",
        "imageFileCount",
        "screenshotArtifactCount",
        "plantLayerCount",
        "vegetationInstanceCount",
    )):
        raise RuntimeError("forbidden image, texture, screenshot or plant count is non-zero")

    if dem_manifest.get("schema") != "guilin-canonical-native-dem/v1":
        raise RuntimeError("canonical DEM manifest schema mismatch")
    if dem_manifest.get("status") != "sole_authoritative":
        raise RuntimeError("canonical DEM is not sole_authoritative")
    dem_source = dem_manifest["source"]
    if dem_source["sha256"] != source["sourceTiffSha256"]:
        raise RuntimeError("source TIFF SHA256 mismatch")
    if dem_source["resolution_m"] != [12.5, 12.5] or dem_source["read_only"] is not True:
        raise RuntimeError("canonical DEM resolution or read-only contract mismatch")

    tile_meta = next(
        (tile for tile in dem_manifest["tiles"] if tile["id"] == source["parentTileId"]),
        None,
    )
    if tile_meta is None:
        raise RuntimeError("parent tile not found")
    if tile_meta["file"] != source["parentTileFile"]:
        raise RuntimeError("parent tile filename mismatch")
    if tile_meta["sha256"] != source["parentTileSha256"]:
        raise RuntimeError("parent tile manifest SHA256 mismatch")
    if tile_meta["stored_bytes"] != source["parentTileBytes"]:
        raise RuntimeError("parent tile manifest byte count mismatch")
    if tile_meta["resampling"] != "none" or tile_meta["source_elevation_modified_m"] != 0.0:
        raise RuntimeError("parent tile has resampling or source elevation modification")
    if args.parent_tile.stat().st_size != source["parentTileBytes"]:
        raise RuntimeError("parent tile byte count mismatch")
    parent_sha = sha256_file(args.parent_tile)
    if parent_sha != source["parentTileSha256"]:
        raise RuntimeError("parent tile SHA256 mismatch")

    window_x, window_y, width, height = map(int, sample["parentTileWindow"])
    if [width, height] != sample["truthGrid"]:
        raise RuntimeError("truth grid and parent tile window mismatch")
    stored_width, stored_height = map(int, tile_meta["stored_grid"])
    if window_x < 0 or window_y < 0 or window_x + width > stored_width or window_y + height > stored_height:
        raise RuntimeError("sample window is outside parent tile")

    parent_values = read_i16_le(args.parent_tile)
    if len(parent_values) != stored_width * stored_height:
        raise RuntimeError("parent tile sample count mismatch")
    heights: list[int] = []
    for row in range(window_y, window_y + height):
        start = row * stored_width + window_x
        heights.extend(int(value) for value in parent_values[start : start + width])
    if len(heights) != width * height:
        raise RuntimeError("sample extraction size mismatch")
    if any(value == dem_source["nodata"] for value in heights):
        raise RuntimeError("sample contains canonical NoData")
    sample_height_bytes = pack_i16_le(heights)

    if hydrology_manifest.get("schema") != "guilin-osm-linear-waterways-render-asset/v1":
        raise RuntimeError("hydrology manifest schema mismatch")
    hydro_source = hydrology_manifest["source"]
    if hydro_source["centerline_coordinates_mutated"] is not False:
        raise RuntimeError("hydrology centerline coordinates were mutated")
    if hydro_source["manual_centerline_added"] is not False:
        raise RuntimeError("manual hydrology centerline exists")
    if hydro_source["synthetic_gap_line_added"] is not False:
        raise RuntimeError("synthetic hydrology gap line exists")
    segment_meta = hydrology_manifest["segments"]
    if args.hydrology_segments.stat().st_size != segment_meta["bytes"]:
        raise RuntimeError("hydrology segment byte count mismatch")
    hydro_sha = sha256_file(args.hydrology_segments)
    if hydro_sha != segment_meta["sha256"]:
        raise RuntimeError("hydrology segment SHA256 mismatch")

    layout: list[str] = segment_meta["layout"]
    required_fields = {
        "start_x",
        "start_elevation",
        "start_z",
        "end_x",
        "end_elevation",
        "end_z",
        "class",
        "mainstem_code",
        "source_width_m",
        "start_flow_progress",
        "end_flow_progress",
        "start_flow_distance_m",
        "end_flow_distance_m",
    }
    if not required_fields.issubset(layout):
        missing = sorted(required_fields.difference(layout))
        raise RuntimeError(f"hydrology layout missing fields: {missing}")
    index = {name: layout.index(name) for name in layout}
    stride = len(layout)
    source_values = read_f32_le(args.hydrology_segments)
    if len(source_values) != segment_meta["count"] * stride:
        raise RuntimeError("hydrology float count mismatch")

    aoi_bounds = dem_manifest["aoi"]["native_sample_center_bounds_epsg32649"]
    full_center_e = (float(aoi_bounds[0]) + float(aoi_bounds[2])) * 0.5
    full_center_n = (float(aoi_bounds[1]) + float(aoi_bounds[3])) * 0.5
    sample_center_e, sample_center_n = map(float, sample["center"])
    half = float(sample["sideM"]) * 0.5

    clipped_records: list[float] = []
    class_counts: dict[str, int] = {"river": 0, "stream": 0, "canal": 0}
    for offset in range(0, len(source_values), stride):
        record = [float(value) for value in source_values[offset : offset + stride]]
        x0 = record[index["start_x"]] + full_center_e - sample_center_e
        z0 = record[index["start_z"]] + sample_center_n - full_center_n
        x1 = record[index["end_x"]] + full_center_e - sample_center_e
        z1 = record[index["end_z"]] + sample_center_n - full_center_n
        interval = liang_barsky(x0, z0, x1, z1, -half, half)
        if interval is None:
            continue
        t0, t1 = interval
        if math.hypot(lerp(x0, x1, t1) - lerp(x0, x1, t0), lerp(z0, z1, t1) - lerp(z0, z1, t0)) < 0.01:
            continue

        output = list(record)
        output[index["start_x"]] = lerp(x0, x1, t0)
        output[index["start_z"]] = lerp(z0, z1, t0)
        output[index["end_x"]] = lerp(x0, x1, t1)
        output[index["end_z"]] = lerp(z0, z1, t1)
        for start_name, end_name in (
            ("start_elevation", "end_elevation"),
            ("start_flow_progress", "end_flow_progress"),
            ("start_flow_distance_m", "end_flow_distance_m"),
        ):
            start_value = record[index[start_name]]
            end_value = record[index[end_name]]
            output[index[start_name]] = lerp(start_value, end_value, t0)
            output[index[end_name]] = lerp(start_value, end_value, t1)
        clipped_records.extend(output)
        class_value = int(round(output[index["class"]]))
        class_name = ("river", "stream", "canal")[max(0, min(2, class_value))]
        class_counts[class_name] += 1

    if not clipped_records:
        raise RuntimeError("sample contains no immutable hydrology segments")
    sample_water_bytes = pack_f32_le(clipped_records)

    args.output.mkdir(parents=True, exist_ok=True)
    height_path = args.output / "sample-height.i16.bin"
    water_path = args.output / "sample-water.f32.bin"
    manifest_path = args.output / "sample-manifest.json"
    height_path.write_bytes(sample_height_bytes)
    water_path.write_bytes(sample_water_bytes)

    sample_manifest = {
        "schema": "landscape-mother-sample-data/v1",
        "sampleId": contract["id"],
        "crs": sample["crs"],
        "center": sample["center"],
        "bounds": sample["bounds"],
        "sideM": sample["sideM"],
        "truth": {
            "file": height_path.name,
            "dtype": "int16-little-endian",
            "grid": sample["truthGrid"],
            "spacingM": sample["truthSpacingM"],
            "bytes": len(sample_height_bytes),
            "sha256": sha256_bytes(sample_height_bytes),
            "elevationRangeM": [min(heights), max(heights)],
            "sourcePixelWindowInteger": True,
            "sourceNodeModified": False,
        },
        "hydrology": {
            "file": water_path.name,
            "dtype": "float32-little-endian",
            "layout": layout,
            "stride": stride,
            "recordCount": len(clipped_records) // stride,
            "classCounts": class_counts,
            "bytes": len(sample_water_bytes),
            "sha256": sha256_bytes(sample_water_bytes),
            "planimetryChanged": False,
            "manualWaterway": False,
            "syntheticWaterway": False,
        },
        "receipt": {
            "sourceTiffSha256": source["sourceTiffSha256"],
            "parentTileId": source["parentTileId"],
            "parentTileSha256": parent_sha,
            "hydrologySourceSha256": hydro_source["sha256"],
            "hydrologySegmentsSha256": hydro_sha,
            "truthOverwrite": False,
            "sourceResampling": False,
            "syntheticGapFill": False,
            "verticalScale": 1.0,
            "materialTextureCount": 0,
            "imageFileCount": 0,
            "plantLayerCount": 0,
        },
    }
    manifest_path.write_text(json.dumps(sample_manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(json.dumps({
        "sample": contract["id"],
        "truthGrid": sample["truthGrid"],
        "elevationRangeM": sample_manifest["truth"]["elevationRangeM"],
        "hydrologyRecordCount": sample_manifest["hydrology"]["recordCount"],
        "publicDataBytes": height_path.stat().st_size + water_path.stat().st_size + manifest_path.stat().st_size,
        "imageFileCount": 0,
        "materialTextureCount": 0,
    }, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"LANDSCAPE_MOTHER_SAMPLE_BUILD_FAILED: {exc}", file=sys.stderr)
        raise
