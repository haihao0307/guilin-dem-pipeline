#!/usr/bin/env python3
"""Build the Guilin DEM-M03 one-square-kilometre review sample.

The builder consumes the canonical uncompressed 12.5 m numeric tile and the
immutable OSM linear-hydrology render asset. It extracts an integer source
window, embeds the untouched truth samples in a standalone WebGL2 page, and
keeps every procedural surface result as a reversible runtime field.
"""

from __future__ import annotations

import argparse
import array
import base64
import hashlib
import json
import math
import os
import struct
import sys
from pathlib import Path
from typing import Any

EXPECTED_SOURCE_SHA = "9490b1bd34f67336352cf448729f763ae4e241637d821961efd0290e29d6c9d4"
EXPECTED_HYDROLOGY_SHA = "be3e8e67f625fa87c843e2d7ea423c48b98e750c6912cae8cf3863df6ae6d4df"
EXPECTED_TILE_ID = "native-r05-c01"
TARGET_CENTER_E = 415_018.03522667295
TARGET_CENTER_N = 2_789_215.965156763
GRID = 81
HALF = (GRID - 1) // 2
SPACING_M = 12.5
AREA_M = (GRID - 1) * SPACING_M
ALGORITHM_VERSION = "guilin-dem-m03-sample/v0.1.0"
PLACEMENT_SEED = 314159


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--tile", required=True, type=Path)
    parser.add_argument("--hydrology-manifest", required=True, type=Path)
    parser.add_argument("--hydrology-segments", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    return parser.parse_args()


def fail(message: str) -> None:
    raise RuntimeError(message)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def read_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        value = json.load(handle)
    if not isinstance(value, dict):
        fail(f"{path} must contain a JSON object")
    return value


def find_tile(manifest: dict[str, Any], tile_id: str) -> dict[str, Any]:
    for tile in manifest.get("tiles", []):
        if tile.get("id") == tile_id:
            return tile
    fail(f"canonical tile {tile_id} not found")


def read_int16_le(path: Path) -> array.array:
    values = array.array("h")
    with path.open("rb") as handle:
        values.fromfile(handle, os.path.getsize(path) // 2)
    if sys.byteorder != "little":
        values.byteswap()
    return values


def read_float32_le(path: Path) -> array.array:
    values = array.array("f")
    with path.open("rb") as handle:
        values.fromfile(handle, os.path.getsize(path) // 4)
    if sys.byteorder != "little":
        values.byteswap()
    return values


def point_segment_distance_sq(
    px: float, pz: float, ax: float, az: float, bx: float, bz: float
) -> tuple[float, float, float]:
    dx = bx - ax
    dz = bz - az
    denominator = dx * dx + dz * dz
    if denominator <= 1e-12:
        return (px - ax) ** 2 + (pz - az) ** 2, ax, az
    t = max(0.0, min(1.0, ((px - ax) * dx + (pz - az) * dz) / denominator))
    qx = ax + dx * t
    qz = az + dz * t
    return (px - qx) ** 2 + (pz - qz) ** 2, qx, qz


def choose_waterway_center(
    segment_values: array.array,
    world_center_e: float,
    world_center_n: float,
    target_e: float,
    target_n: float,
) -> tuple[float, float, dict[str, Any]]:
    target_x = target_e - world_center_e
    target_z = world_center_n - target_n
    best: tuple[float, float, float, int, float, int] | None = None
    fallback: tuple[float, float, float, int, float, int] | None = None
    for offset in range(0, len(segment_values), 8):
        ax = float(segment_values[offset])
        az = float(segment_values[offset + 2])
        bx = float(segment_values[offset + 3])
        bz = float(segment_values[offset + 5])
        class_index = int(round(float(segment_values[offset + 6])))
        source_width = float(segment_values[offset + 7])
        distance_sq, qx, qz = point_segment_distance_sq(target_x, target_z, ax, az, bx, bz)
        candidate = (distance_sq, qx, qz, class_index, source_width, offset // 8)
        if fallback is None or candidate[0] < fallback[0]:
            fallback = candidate
        if class_index <= 1 and (best is None or candidate[0] < best[0]):
            best = candidate
    selected = best or fallback
    if selected is None:
        fail("immutable hydrology segment asset is empty")
    _, local_x, local_z, class_index, source_width, segment_index = selected
    center_e = world_center_e + local_x
    center_n = world_center_n - local_z
    return center_e, center_n, {
        "selected_segment_index": segment_index,
        "class": class_index,
        "source_width_m": round(source_width, 3),
        "distance_from_requested_center_m": round(math.sqrt(selected[0]), 3),
    }


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
    u0 = 0.0
    u1 = 1.0
    for pi, qi in zip(p, q):
        if abs(pi) <= 1e-12:
            if qi < 0:
                return None
            continue
        ratio = qi / pi
        if pi < 0:
            if ratio > u1:
                return None
            u0 = max(u0, ratio)
        else:
            if ratio < u0:
                return None
            u1 = min(u1, ratio)
    if u0 > u1:
        return None
    return u0, u1


def clip_hydrology(
    values: array.array,
    world_center_e: float,
    world_center_n: float,
    sample_center_e: float,
    sample_center_n: float,
) -> list[list[float]]:
    sample_center_x = sample_center_e - world_center_e
    sample_center_z = world_center_n - sample_center_n
    minimum = -AREA_M / 2
    maximum = AREA_M / 2
    clipped: list[list[float]] = []
    for offset in range(0, len(values), 8):
        ax = float(values[offset]) - sample_center_x
        ay = float(values[offset + 1])
        az = float(values[offset + 2]) - sample_center_z
        bx = float(values[offset + 3]) - sample_center_x
        by = float(values[offset + 4])
        bz = float(values[offset + 5]) - sample_center_z
        class_index = int(round(float(values[offset + 6])))
        source_width = float(values[offset + 7])
        interval = liang_barsky(ax, az, bx, bz, minimum, maximum)
        if interval is None:
            continue
        u0, u1 = interval
        cx0 = ax + (bx - ax) * u0
        cz0 = az + (bz - az) * u0
        cy0 = ay + (by - ay) * u0
        cx1 = ax + (bx - ax) * u1
        cz1 = az + (bz - az) * u1
        cy1 = ay + (by - ay) * u1
        if math.hypot(cx1 - cx0, cz1 - cz0) < 0.05:
            continue
        clipped.append([
            round(cx0, 3), round(cy0, 3), round(cz0, 3),
            round(cx1, 3), round(cy1, 3), round(cz1, 3),
            class_index, round(source_width, 3),
        ])
    return clipped


def json_script(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")


def build_html(payload: dict[str, Any]) -> str:
    template_path = Path(__file__).with_name("viewer_template.html")
    template = template_path.read_text(encoding="utf-8")
    return template.replace("__PAYLOAD__", json_script(payload))


def main() -> int:
    args = parse_args()
    manifest = read_json(args.manifest)
    hydro_manifest = read_json(args.hydrology_manifest)
    if manifest.get("schema") != "guilin-canonical-native-dem/v1":
        fail("canonical manifest schema mismatch")
    if manifest.get("status") != "sole_authoritative":
        fail("canonical manifest is not sole_authoritative")
    source = manifest.get("source", {})
    if source.get("sha256") != EXPECTED_SOURCE_SHA:
        fail("canonical source SHA256 mismatch")
    if source.get("crs") != "EPSG:32649":
        fail("canonical source CRS mismatch")
    if source.get("resolution_m") != [SPACING_M, SPACING_M]:
        fail("canonical source spacing mismatch")
    if source.get("read_only") is not True:
        fail("canonical source is not marked read-only")
    tile = find_tile(manifest, EXPECTED_TILE_ID)
    tile_hash = sha256_file(args.tile)
    if tile_hash != tile.get("sha256"):
        fail(f"tile SHA256 mismatch: {tile_hash}")
    expected_bytes = int(tile.get("stored_bytes", 0))
    if args.tile.stat().st_size != expected_bytes:
        fail("tile byte length mismatch")
    if tile.get("compression") != "none" or tile.get("resampling") != "none":
        fail("tile compression or resampling contract mismatch")
    if hydro_manifest.get("schema") != "guilin-osm-linear-waterways-render-asset/v1":
        fail("hydrology manifest schema mismatch")
    if hydro_manifest.get("source", {}).get("sha256") != EXPECTED_HYDROLOGY_SHA:
        fail("hydrology source SHA256 mismatch")
    hydro_hash = sha256_file(args.hydrology_segments)
    if hydro_hash != hydro_manifest.get("segments", {}).get("sha256"):
        fail("hydrology segments SHA256 mismatch")
    if args.hydrology_segments.stat().st_size != hydro_manifest.get("segments", {}).get("bytes"):
        fail("hydrology segments byte length mismatch")

    aoi_bounds = manifest["aoi"]["native_sample_center_bounds_epsg32649"]
    world_center_e = (float(aoi_bounds[0]) + float(aoi_bounds[2])) * 0.5
    world_center_n = (float(aoi_bounds[1]) + float(aoi_bounds[3])) * 0.5
    hydro_values = read_float32_le(args.hydrology_segments)
    expected_float_count = int(hydro_manifest["segments"]["count"]) * 8
    if len(hydro_values) != expected_float_count:
        fail("hydrology segment float count mismatch")
    desired_e, desired_n, selected_waterway = choose_waterway_center(
        hydro_values, world_center_e, world_center_n, TARGET_CENTER_E, TARGET_CENTER_N
    )

    tile_bounds = tile["source_sample_center_bounds_epsg32649"]
    tile_west = float(tile_bounds[0])
    tile_north = float(tile_bounds[3])
    stored_width, stored_height = map(int, tile["stored_grid"])
    center_col = round((desired_e - tile_west) / SPACING_M)
    center_row = round((tile_north - desired_n) / SPACING_M)
    center_col = max(HALF, min(stored_width - 1 - HALF, center_col))
    center_row = max(HALF, min(stored_height - 1 - HALF, center_row))
    center_e = tile_west + center_col * SPACING_M
    center_n = tile_north - center_row * SPACING_M

    tile_values = read_int16_le(args.tile)
    if len(tile_values) != stored_width * stored_height:
        fail("tile sample count mismatch")
    heights: list[int] = []
    for row in range(center_row - HALF, center_row + HALF + 1):
        start = row * stored_width + (center_col - HALF)
        heights.extend(int(value) for value in tile_values[start : start + GRID])
    if len(heights) != GRID * GRID:
        fail("sample extraction size mismatch")
    if any(value == 0 for value in heights):
        fail("selected 1 km sample contains canonical NoData 0")

    clipped_segments = clip_hydrology(
        hydro_values, world_center_e, world_center_n, center_e, center_n
    )
    if not clipped_segments:
        fail("selected 1 km sample contains no immutable waterway segments")

    sample_bytes = b"".join(struct.pack("<h", value) for value in heights)
    sample_sha = hashlib.sha256(sample_bytes).hexdigest()
    sample_min = min(heights)
    sample_max = max(heights)
    payload = {
        "algorithm": ALGORITHM_VERSION,
        "placement_seed": PLACEMENT_SEED,
        "source": {
            "release": manifest["canonical_identity"]["release_tag"],
            "source_file": source["file"],
            "source_sha256": source["sha256"],
            "crs": source["crs"],
            "native_spacing_m": source["resolution_m"],
            "tile_id": tile["id"],
            "tile_file": tile["file"],
            "tile_sha256": tile_hash,
            "tile_compression": tile["compression"],
            "tile_resampling": tile["resampling"],
        },
        "sample": {
            "status": "experimental_visual_candidate",
            "grid": GRID,
            "spacing_m": SPACING_M,
            "area_m": [AREA_M, AREA_M],
            "area_km2": 1.0,
            "center_epsg32649": [round(center_e, 3), round(center_n, 3)],
            "bounds_epsg32649": [
                round(center_e - AREA_M / 2, 3),
                round(center_n - AREA_M / 2, 3),
                round(center_e + AREA_M / 2, 3),
                round(center_n + AREA_M / 2, 3),
            ],
            "source_window_in_tile": [center_col - HALF, center_row - HALF, GRID, GRID],
            "elevation_range_m": [sample_min, sample_max],
            "height_i16_le_sha256": sample_sha,
            "height_i16_le_base64": base64.b64encode(sample_bytes).decode("ascii"),
            "source_pixel_window_integer": True,
            "resampled": False,
            "synthetic_gap_fill": False,
            "truth_read_only": True,
            "vertical_scale": 1.0,
        },
        "hydrology": {
            "source_sha256": hydro_manifest["source"]["sha256"],
            "source_coordinates_mutated": False,
            "manual_centerline_added": False,
            "synthetic_gap_line_added": False,
            "selected_waterway": selected_waterway,
            "segment_count": len(clipped_segments),
            "segments": clipped_segments,
        },
        "procedural_layers": {
            "height_delta": "runtime-derived-reversible-field",
            "surface_material_fields": ["elevation", "slope", "wetness", "rock", "soil"],
            "paddy_fields": ["candidate", "parcel", "plane-fit", "bund", "irrigation"],
            "ecology_fields": ["forest-suitability"],
            "authoritative_land_use": False,
            "historical_land_use_claim": False,
            "vegetation_instances_included": False,
        },
        "acceptance": {"visualAcceptance": False, "productionReady": False},
    }

    args.output.mkdir(parents=True, exist_ok=True)
    html = build_html(payload)
    html_path = args.output / "index.html"
    html_path.write_text(html, encoding="utf-8", newline="\n")
    html_sha = sha256_file(html_path)
    manifest_out = {
        "schema": "guilin-dem-m03-sample-manifest/v1",
        "algorithm": ALGORITHM_VERSION,
        "status": "experimental_visual_candidate",
        "entry": "index.html",
        "entry_sha256": html_sha,
        "source": payload["source"],
        "sample": {key: value for key, value in payload["sample"].items() if key != "height_i16_le_base64"},
        "hydrology": {key: value for key, value in payload["hydrology"].items() if key != "segments"},
        "procedural_layers": payload["procedural_layers"],
        "acceptance": payload["acceptance"],
    }
    (args.output / "sample-manifest.json").write_text(
        json.dumps(manifest_out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    qa = {
        "schema": "guilin-dem-m03-sample-qa/v1",
        "passed": True,
        "checks": {
            "canonical_source_sha_verified": True,
            "canonical_tile_sha_verified": True,
            "canonical_hydrology_sha_verified": True,
            "source_pixel_window_integer": True,
            "source_spacing_m": SPACING_M,
            "sample_grid": [GRID, GRID],
            "sample_area_km2": 1.0,
            "nodata_count": 0,
            "resampled": False,
            "synthetic_gap_fill": False,
            "source_elevation_mutated": False,
            "vertical_scale": 1.0,
            "immutable_waterway_segment_count": len(clipped_segments),
            "webgl2_runtime_required": True,
            "external_runtime_dependency_count": 0,
            "visualAcceptance": False,
            "productionReady": False,
        },
        "files": {
            "index.html": {"bytes": html_path.stat().st_size, "sha256": html_sha},
            "sample-manifest.json": {},
        },
    }
    manifest_path = args.output / "sample-manifest.json"
    qa["files"]["sample-manifest.json"] = {
        "bytes": manifest_path.stat().st_size,
        "sha256": sha256_file(manifest_path),
    }
    (args.output / "qa-report.json").write_text(
        json.dumps(qa, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps({
        "output": str(args.output),
        "center_epsg32649": payload["sample"]["center_epsg32649"],
        "elevation_range_m": payload["sample"]["elevation_range_m"],
        "waterway_segments": len(clipped_segments),
        "index_html_sha256": html_sha,
    }, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"GUILIN_DEM_M03_SAMPLE_BUILD_FAILED: {exc}", file=sys.stderr)
        raise
