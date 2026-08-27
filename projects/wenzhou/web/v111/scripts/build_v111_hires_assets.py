#!/usr/bin/env python3
"""Build Wenzhou v1.1.1 high-resolution truthful 3D runtime assets.

The builder keeps the archived 12.5 m COG immutable, clips every visible vector to
that truth AOI, drapes river samples against the source COG, writes lossless
height/mask/PNG assets, and creates native 12.5 m detail tiles for named cameras.
"""

from __future__ import annotations

import hashlib
import json
import math
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator, Sequence

import numpy as np
import rasterio
from PIL import Image
from rasterio.enums import Resampling
from rasterio.windows import Window, from_bounds
from rasterio.warp import transform_bounds

ROOT = Path(__file__).resolve().parents[5]
LAND = ROOT / "projects/wenzhou/archive/truth/WENZHOU_QINGJIANG_22000KM2_12_5M_COG.tif"
MARINE = ROOT / "projects/wenzhou/archive/truth/evidence/WENZHOU_QINGJIANG_marine_mask_COG.tif"
BATHY = ROOT / "projects/wenzhou/coastal/data/derived/WENZHOU_COASTAL_BATHY_100M_EPSG32651_COG.tif"
COAST = ROOT / "projects/wenzhou/coastal/data/hydrology/osm/WENZHOU_COASTLINE_EPSG32651.geojson"
RIVERS = ROOT / "projects/wenzhou/coastal/data/hydrology/osm/WENZHOU_RIVER_CENTERLINES_EPSG32651.geojson"

OUT = ROOT / "web/wenzhou-v111/assets/hires"
REPORT = ROOT / "projects/wenzhou/reports/WENZHOU_V111_HIRES_ASSET_BUILD.json"

EXPECTED = {
    LAND: (54_638_031, "8a1bc6ee17dd731007804a0281f9e083e01f5745468f90cf2c11c108ec0b1c6e"),
    BATHY: (17_637_178, "591e92eef61699088a87e32bfd83417498f89cfe3a6a84f4ce6a2e2ac3b689fc"),
    COAST: (7_243_887, "5cfeb0465df59590c78c6b163f60ae8764731e1ea65e3adcbc5052813b299181"),
    RIVERS: (12_649_515, "585220c369ed8ec6b588f1913489870c585cc98ddd7c5357beaff9ddaae7a9d9"),
}

GLOBAL_GRID = 1025
GLOBAL_TEXTURE = 4096
BATHY_GRID = 1025
DETAIL_GRID = 1025
DETAIL_SPACING_M = 12.5
RIVER_SAMPLE_STEP_M = 25.0
COAST_SAMPLE_STEP_M = 25.0

ANCHORS_LOCAL = {
    "wenzhou": (-43249.24, 29795.56),
    "xianxi": (-3215.36, -15850.63),
    "haimen": (34754.08, -44757.83),
    "yandang": (-4869.71, -10574.45),
    "oujiang": (8000.0, 31500.0),
    "yueqing": (8500.0, -21000.0),
    "kanmen": (18000.0, 20700.0),
}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(8 * 1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def require_file(path: Path) -> dict[str, Any]:
    if not path.is_file():
        raise FileNotFoundError(path)
    expected_bytes, expected_sha = EXPECTED.get(path, (None, None))
    size = path.stat().st_size
    digest = sha256_file(path)
    if expected_bytes is not None and size != expected_bytes:
        raise RuntimeError(f"unexpected byte count for {path}: {size}")
    if expected_sha is not None and digest != expected_sha:
        raise RuntimeError(f"unexpected SHA-256 for {path}: {digest}")
    return {
        "path": str(path.relative_to(ROOT)).replace("\\", "/"),
        "bytes": size,
        "sha256": digest,
    }


def file_record(path: Path, role: str) -> dict[str, Any]:
    return {
        "path": str(path.relative_to(ROOT)).replace("\\", "/"),
        "asset": str(path.relative_to(OUT)).replace("\\", "/"),
        "role": role,
        "bytes": path.stat().st_size,
        "sha256": sha256_file(path),
    }


def masked_to_float(array: np.ma.MaskedArray) -> np.ndarray:
    result = np.asarray(array, dtype=np.float32)
    mask = np.ma.getmaskarray(array)
    if mask.any():
        result = result.copy()
        result[mask] = np.nan
    return result


def write_binary(path: Path, array: np.ndarray) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(array.tobytes(order="C"))


def save_png(path: Path, array: np.ndarray, mode: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(array, mode=mode).save(path, format="PNG", compress_level=1, optimize=False)


def hillshade(elevation: np.ndarray, pixel_x: float, pixel_y: float) -> tuple[np.ndarray, np.ndarray]:
    filled = np.nan_to_num(elevation, nan=0.0)
    dzdy, dzdx = np.gradient(filled, pixel_y, pixel_x)
    slope = np.arctan(np.hypot(dzdx, dzdy))
    aspect = np.arctan2(-dzdx, dzdy)
    azimuth = math.radians(315.0)
    altitude = math.radians(42.0)
    shade = (
        np.sin(altitude) * np.cos(slope)
        + np.cos(altitude) * np.sin(slope) * np.cos(azimuth - aspect)
    )
    return np.clip((shade + 0.20) / 1.20, 0.0, 1.0), np.clip(np.tan(slope), 0.0, 3.0)


def mix(a: np.ndarray, b: np.ndarray, t: np.ndarray) -> np.ndarray:
    return a * (1.0 - t[..., None]) + b * t[..., None]


def build_lossless_satellite_color(
    elevation: np.ndarray,
    marine: np.ndarray,
    pixel_x: float,
    pixel_y: float,
) -> np.ndarray:
    elevation = np.nan_to_num(elevation, nan=0.0)
    marine_mask = np.nan_to_num(marine, nan=0.0) > 0.5
    shade, slope = hillshade(elevation, pixel_x, pixel_y)
    height = np.clip(elevation, 0.0, 1400.0) / 1400.0

    low = np.array([0.28, 0.36, 0.22], dtype=np.float32)
    mid = np.array([0.20, 0.31, 0.18], dtype=np.float32)
    high = np.array([0.43, 0.43, 0.38], dtype=np.float32)
    rock = np.array([0.52, 0.51, 0.47], dtype=np.float32)
    sediment = np.array([0.47, 0.43, 0.31], dtype=np.float32)

    land = mix(
        np.broadcast_to(low, (*height.shape, 3)),
        np.broadcast_to(mid, (*height.shape, 3)),
        np.clip(height / 0.45, 0.0, 1.0),
    )
    land = mix(
        land,
        np.broadcast_to(high, (*height.shape, 3)),
        np.clip((height - 0.34) / 0.52, 0.0, 1.0),
    )
    rock_weight = np.clip((slope - 0.34) / 0.82, 0.0, 1.0) * np.clip(height + 0.12, 0.0, 1.0)
    land = mix(land, np.broadcast_to(rock, (*height.shape, 3)), rock_weight * 0.70)
    sediment_weight = np.clip((0.08 - height) / 0.08, 0.0, 1.0) * np.clip((0.16 - slope) / 0.16, 0.0, 1.0)
    land = mix(land, np.broadcast_to(sediment, (*height.shape, 3)), sediment_weight * 0.24)
    land *= 0.72 + shade[..., None] * 0.42

    shallow = np.array([0.12, 0.31, 0.36], dtype=np.float32)
    deep = np.array([0.055, 0.16, 0.24], dtype=np.float32)
    sea = np.broadcast_to(shallow, (*height.shape, 3)).copy()
    sea = mix(sea, np.broadcast_to(deep, (*height.shape, 3)), np.full(height.shape, 0.50, dtype=np.float32))
    color = np.where(marine_mask[..., None], sea, land)
    return np.uint8(np.rint(np.clip(np.power(color, 0.93), 0.0, 1.0) * 255.0))


def geometry_parts(geometry: dict[str, Any]) -> Iterator[list[list[float]]]:
    if not geometry:
        return
    kind = geometry.get("type")
    coordinates = geometry.get("coordinates")
    if kind == "LineString" and isinstance(coordinates, list):
        yield coordinates
    elif kind == "MultiLineString" and isinstance(coordinates, list):
        for part in coordinates:
            if isinstance(part, list):
                yield part


def clean_points(points: Sequence[Sequence[float]]) -> list[list[float]]:
    output: list[list[float]] = []
    for point in points:
        if len(point) < 2:
            continue
        x, y = float(point[0]), float(point[1])
        if not (math.isfinite(x) and math.isfinite(y)):
            continue
        if not output or math.hypot(output[-1][0] - x, output[-1][1] - y) > 1e-6:
            output.append([x, y])
    return output


def clip_segment(
    start: Sequence[float],
    end: Sequence[float],
    bounds: Sequence[float],
) -> tuple[list[float], list[float]] | None:
    xmin, ymin, xmax, ymax = bounds
    x0, y0 = float(start[0]), float(start[1])
    x1, y1 = float(end[0]), float(end[1])
    dx, dy = x1 - x0, y1 - y0
    t0, t1 = 0.0, 1.0
    for p, q in ((-dx, x0 - xmin), (dx, xmax - x0), (-dy, y0 - ymin), (dy, ymax - y0)):
        if abs(p) < 1e-12:
            if q < 0:
                return None
            continue
        ratio = q / p
        if p < 0:
            if ratio > t1:
                return None
            t0 = max(t0, ratio)
        else:
            if ratio < t0:
                return None
            t1 = min(t1, ratio)
    return [x0 + t0 * dx, y0 + t0 * dy], [x0 + t1 * dx, y0 + t1 * dy]


def clip_polyline(points: Sequence[Sequence[float]], bounds: Sequence[float]) -> list[list[list[float]]]:
    clean = clean_points(points)
    runs: list[list[list[float]]] = []
    current: list[list[float]] = []
    for index in range(1, len(clean)):
        clipped = clip_segment(clean[index - 1], clean[index], bounds)
        if clipped is None:
            if len(current) >= 2:
                runs.append(current)
            current = []
            continue
        first, second = clipped
        if not current or math.hypot(current[-1][0] - first[0], current[-1][1] - first[1]) > 1e-5:
            if len(current) >= 2:
                runs.append(current)
            current = [first]
        if math.hypot(current[-1][0] - second[0], current[-1][1] - second[1]) > 1e-6:
            current.append(second)
    if len(current) >= 2:
        runs.append(current)
    return runs


def densify(points: Sequence[Sequence[float]], maximum_step: float) -> list[list[float]]:
    clean = clean_points(points)
    if len(clean) < 2:
        return clean
    output = [clean[0]]
    for index in range(1, len(clean)):
        start, end = clean[index - 1], clean[index]
        length = math.hypot(end[0] - start[0], end[1] - start[1])
        steps = max(1, int(math.ceil(length / maximum_step)))
        for step in range(1, steps + 1):
            t = step / steps
            output.append([
                start[0] + (end[0] - start[0]) * t,
                start[1] + (end[1] - start[1]) * t,
            ])
    return output


def combined_name(properties: dict[str, Any]) -> str:
    for key in ("name", "name:zh", "name_zh", "local_name", "alt_name"):
        value = properties.get(key)
        if value:
            return str(value)
    return ""


def width_meters(properties: dict[str, Any], kind: str) -> float:
    raw = properties.get("width")
    if raw is not None:
        token = "".join(ch if ch.isdigit() or ch in ".-" else " " for ch in str(raw)).split()
        if token:
            try:
                value = float(token[0])
                if value > 0:
                    return float(np.clip(value, 2.0, 800.0))
            except ValueError:
                pass
    return {"river": 34.0, "stream": 6.0, "canal": 8.0, "tidal_channel": 16.0}.get(kind, 5.0)


def line_length(points: Sequence[Sequence[float]]) -> float:
    return sum(
        math.hypot(points[index][0] - points[index - 1][0], points[index][1] - points[index - 1][1])
        for index in range(1, len(points))
    )


def sample_source_arrays(
    points: Sequence[Sequence[float]],
    transform: rasterio.Affine,
    land: np.ndarray,
    marine: np.ndarray,
) -> tuple[np.ndarray, np.ndarray]:
    xs = np.asarray([point[0] for point in points], dtype=np.float64)
    ys = np.asarray([point[1] for point in points], dtype=np.float64)
    columns = np.floor((xs - transform.c) / transform.a).astype(np.int64)
    rows = np.floor((transform.f - ys) / abs(transform.e)).astype(np.int64)
    columns = np.clip(columns, 0, land.shape[1] - 1)
    rows = np.clip(rows, 0, land.shape[0] - 1)
    return land[rows, columns], marine[rows, columns]


def build_coastline(
    source: dict[str, Any],
    bounds: Sequence[float],
    origin: Sequence[float],
) -> dict[str, Any]:
    parts: list[dict[str, Any]] = []
    source_parts = 0
    source_vertices = 0
    sample_count = 0
    for feature_index, feature in enumerate(source.get("features", [])):
        properties = feature.get("properties") or {}
        for part_index, raw in enumerate(geometry_parts(feature.get("geometry") or {})):
            source_parts += 1
            source_vertices += len(raw)
            for run_index, run in enumerate(clip_polyline(raw, bounds)):
                dense = densify(run, COAST_SAMPLE_STEP_M)
                if len(dense) < 2:
                    continue
                sample_count += len(dense)
                parts.append({
                    "id": properties.get("partId") or properties.get("osmId") or f"coast-{feature_index}-{part_index}-{run_index}",
                    "coords": [
                        [round(point[0] - origin[0], 2), 0.35, round(origin[1] - point[1], 2)]
                        for point in dense
                    ],
                })
    return {
        "schema": "wenzhou_coastline_draped@1.1.1",
        "crs": "EPSG:32651-local-centered",
        "sourceSha256": EXPECTED[COAST][1],
        "truthAoiClipped": True,
        "maximumSampleSpacingMeters": COAST_SAMPLE_STEP_M,
        "sourcePartCount": source_parts,
        "sourceVertexCount": source_vertices,
        "partCount": len(parts),
        "sampleCount": sample_count,
        "parts": parts,
    }


def build_rivers(
    source: dict[str, Any],
    bounds: Sequence[float],
    origin: Sequence[float],
    transform: rasterio.Affine,
    land: np.ndarray,
    marine: np.ndarray,
) -> dict[str, Any]:
    parts: list[dict[str, Any]] = []
    source_parts = 0
    source_vertices = 0
    sample_count = 0
    max_spacing = 0.0
    type_counts: dict[str, int] = {}
    for feature_index, feature in enumerate(source.get("features", [])):
        properties = feature.get("properties") or {}
        kind = str(properties.get("waterway") or properties.get("type") or "stream").lower()
        if kind not in {"river", "stream", "canal", "tidal_channel"}:
            continue
        name = combined_name(properties)
        for part_index, raw in enumerate(geometry_parts(feature.get("geometry") or {})):
            source_parts += 1
            source_vertices += len(raw)
            for run_index, run in enumerate(clip_polyline(raw, bounds)):
                dense = densify(run, RIVER_SAMPLE_STEP_M)
                if len(dense) < 2:
                    continue
                elevations, marine_values = sample_source_arrays(dense, transform, land, marine)
                coords: list[list[float]] = []
                for point, elevation, marine_value in zip(dense, elevations, marine_values, strict=True):
                    if int(elevation) == -32768:
                        continue
                    water_height = 0.35 if int(marine_value) > 0 else max(float(elevation) + 0.35, 0.35)
                    coords.append([
                        round(point[0] - origin[0], 2),
                        round(water_height, 2),
                        round(origin[1] - point[1], 2),
                    ])
                if len(coords) < 2:
                    continue
                for index in range(1, len(coords)):
                    max_spacing = max(max_spacing, math.hypot(coords[index][0] - coords[index - 1][0], coords[index][2] - coords[index - 1][2]))
                sample_count += len(coords)
                type_counts[kind] = type_counts.get(kind, 0) + 1
                parts.append({
                    "id": properties.get("partId") or properties.get("osmId") or f"water-{feature_index}-{part_index}-{run_index}",
                    "sourceOsmId": properties.get("osmId"),
                    "name": name,
                    "type": kind,
                    "widthMeters": round(width_meters(properties, kind), 2),
                    "sourceRunLengthMeters": round(line_length(run), 2),
                    "coords": coords,
                })
    return {
        "schema": "wenzhou_rivers_source_draped@1.1.1",
        "crs": "EPSG:32651-local-centered",
        "sourceSha256": EXPECTED[RIVERS][1],
        "sourceCoordinateSha256": "df6fe335d7cb8d69aa1971b897cc8fedfeeaf44bee95ffaab9ac472b01a175f4",
        "truthAoiClipped": True,
        "sourceDemDraped": True,
        "requestedMaximumSampleSpacingMeters": RIVER_SAMPLE_STEP_M,
        "actualMaximumSampleSpacingMeters": round(max_spacing, 3),
        "sourcePartCount": source_parts,
        "sourceVertexCount": source_vertices,
        "partCount": len(parts),
        "sampleCount": sample_count,
        "typeCounts": type_counts,
        "estuaryConnectivityStatus": "pending",
        "parts": parts,
    }


def build_detail_tiles(
    land_source: rasterio.DatasetReader,
    marine_source: rasterio.DatasetReader,
    origin: Sequence[float],
) -> dict[str, Any]:
    output: dict[str, Any] = {}
    half = DETAIL_GRID // 2
    inverse = ~land_source.transform
    for tile_id, (local_x, local_z) in ANCHORS_LOCAL.items():
        projected_x = origin[0] + local_x
        projected_y = origin[1] - local_z
        column_float, row_float = inverse * (projected_x, projected_y)
        center_column = int(round(column_float))
        center_row = int(round(row_float))
        window = Window(center_column - half, center_row - half, DETAIL_GRID, DETAIL_GRID)
        height = land_source.read(
            1,
            window=window,
            boundless=True,
            fill_value=-32768,
            out_dtype="int16",
        ).astype("<i2")
        marine = marine_source.read(
            1,
            window=window,
            boundless=True,
            fill_value=0,
            out_dtype="uint8",
        ).astype("u1")
        tile_transform = land_source.window_transform(window)
        left = tile_transform.c
        top = tile_transform.f
        right = left + DETAIL_GRID * tile_transform.a
        bottom = top + DETAIL_GRID * tile_transform.e
        tile_dir = OUT / "details" / tile_id
        height_path = tile_dir / "height_1025_i16.bin"
        marine_path = tile_dir / "marine_1025_u8.bin"
        write_binary(height_path, height)
        write_binary(marine_path, marine)
        valid = height[height != -32768]
        output[tile_id] = {
            "grid": [DETAIL_GRID, DETAIL_GRID],
            "spacingMeters": [DETAIL_SPACING_M, DETAIL_SPACING_M],
            "projectedBounds": [left, bottom, right, top],
            "localBounds": [left - origin[0], origin[1] - top, right - origin[0], origin[1] - bottom],
            "minimumElevationMeters": int(valid.min()) if valid.size else 0,
            "maximumElevationMeters": int(valid.max()) if valid.size else 0,
            "heightAsset": str(height_path.relative_to(OUT)).replace("\\", "/"),
            "marineAsset": str(marine_path.relative_to(OUT)).replace("\\", "/"),
            "heightSha256": sha256_file(height_path),
            "marineSha256": sha256_file(marine_path),
            "sourceSpacingMeters": 12.5,
            "losslessSourceInt16": True,
        }
    return output


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    inputs = [require_file(path) for path in (LAND, MARINE, BATHY, COAST, RIVERS)]

    with rasterio.open(LAND) as land_source, rasterio.open(MARINE) as marine_source:
        land_bounds = [land_source.bounds.left, land_source.bounds.bottom, land_source.bounds.right, land_source.bounds.top]
        origin = [(land_source.bounds.left + land_source.bounds.right) / 2.0, (land_source.bounds.bottom + land_source.bounds.top) / 2.0]
        width_m = land_source.bounds.right - land_source.bounds.left
        height_m = land_source.bounds.top - land_source.bounds.bottom
        wgs84_bounds = list(transform_bounds(land_source.crs, "EPSG:4326", *land_source.bounds, densify_pts=21))

        global_height_float = masked_to_float(land_source.read(
            1,
            out_shape=(GLOBAL_GRID, GLOBAL_GRID),
            resampling=Resampling.bilinear,
            masked=True,
        ))
        global_height = np.rint(np.nan_to_num(global_height_float, nan=-32768.0)).astype("<i2")
        global_marine = marine_source.read(
            1,
            out_shape=(GLOBAL_GRID, GLOBAL_GRID),
            resampling=Resampling.nearest,
            masked=False,
            out_dtype="uint8",
        ).astype("u1")
        texture_height = masked_to_float(land_source.read(
            1,
            out_shape=(GLOBAL_TEXTURE, GLOBAL_TEXTURE),
            resampling=Resampling.bilinear,
            masked=True,
        ))
        texture_marine = marine_source.read(
            1,
            out_shape=(GLOBAL_TEXTURE, GLOBAL_TEXTURE),
            resampling=Resampling.nearest,
            masked=False,
            out_dtype="uint8",
        ).astype("u1")

        height_path = OUT / "terrain_height_1025_i16.bin"
        marine_path = OUT / "terrain_marine_1025_u8.bin"
        write_binary(height_path, global_height)
        write_binary(marine_path, global_marine)

        texture = build_lossless_satellite_color(
            texture_height,
            texture_marine,
            width_m / GLOBAL_TEXTURE,
            height_m / GLOBAL_TEXTURE,
        )
        texture_path = OUT / "offline_satellite_color_4096_lossless.png"
        marine_image_path = OUT / "marine_mask_4096_lossless.png"
        save_png(texture_path, texture, "RGB")
        save_png(marine_image_path, np.uint8(texture_marine > 0) * 255, "L")

        detail_tiles = build_detail_tiles(land_source, marine_source, origin)
        source_land = land_source.read(1, masked=False)
        source_marine = marine_source.read(1, masked=False)
        land_transform = land_source.transform

    with rasterio.open(BATHY) as bathy_source:
        window = from_bounds(*land_bounds, transform=bathy_source.transform)
        bathy_float = masked_to_float(bathy_source.read(
            1,
            window=window,
            out_shape=(BATHY_GRID, BATHY_GRID),
            boundless=True,
            fill_value=bathy_source.nodata,
            resampling=Resampling.bilinear,
            masked=True,
        ))
    valid_bathy = (global_marine > 0) & np.isfinite(bathy_float)
    bathy_clipped = np.full((BATHY_GRID, BATHY_GRID), -32768, dtype="<i2")
    bathy_clipped[valid_bathy] = np.rint(np.clip(np.minimum(bathy_float[valid_bathy], -0.15), -32767, -0.15)).astype("<i2")
    bathy_path = OUT / "bathymetry_height_1025_i16.bin"
    write_binary(bathy_path, bathy_clipped)

    coast_source = json.loads(COAST.read_text(encoding="utf-8"))
    river_source = json.loads(RIVERS.read_text(encoding="utf-8"))
    coast = build_coastline(coast_source, land_bounds, origin)
    rivers = build_rivers(river_source, land_bounds, origin, land_transform, source_land, source_marine)
    coast_path = OUT / "coastline_truth_aoi_draped.json"
    rivers_path = OUT / "rivers_truth_aoi_draped.json"
    coast_path.write_text(json.dumps(coast, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    rivers_path.write_text(json.dumps(rivers, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")

    valid_global = global_height[global_height != -32768]
    valid_bathy_values = bathy_clipped[bathy_clipped != -32768]
    assets = [
        file_record(height_path, "terrain_height_i16_lossless_overview"),
        file_record(marine_path, "terrain_marine_u8_lossless_overview"),
        file_record(texture_path, "offline_satellite_color_png_lossless"),
        file_record(marine_image_path, "marine_mask_png_lossless"),
        file_record(bathy_path, "bathymetry_height_i16_truth_aoi"),
        file_record(coast_path, "coastline_truth_aoi_clipped_draped"),
        file_record(rivers_path, "rivers_truth_aoi_clipped_source_draped"),
    ]
    for tile_id, tile in detail_tiles.items():
        assets.append(file_record(OUT / tile["heightAsset"], f"detail_height_i16_{tile_id}"))
        assets.append(file_record(OUT / tile["marineAsset"], f"detail_marine_u8_{tile_id}"))

    manifest = {
        "schema": "wenzhou_v111_hires_assets@1.1.1",
        "generatedAtUtc": now_iso(),
        "terrainRuntimeId": "wenzhou-epsg32651-v111-hires",
        "crs": "EPSG:32651",
        "worldOriginProjected": origin,
        "visibleDomain": "truth-aoi-only",
        "truth": {
            "path": str(LAND.relative_to(ROOT)).replace("\\", "/"),
            "sha256": EXPECTED[LAND][1],
            "grid": [11866, 11866],
            "spacingMeters": [12.5, 12.5],
            "bounds": land_bounds,
            "transform": list(land_transform)[:6],
            "wgs84Bounds": wgs84_bounds,
            "verticalScale": 1.0,
        },
        "terrainOverview": {
            "grid": [GLOBAL_GRID, GLOBAL_GRID],
            "spacingMeters": [width_m / (GLOBAL_GRID - 1), height_m / (GLOBAL_GRID - 1)],
            "widthMeters": width_m,
            "heightMeters": height_m,
            "minimumElevationMeters": int(valid_global.min()),
            "maximumElevationMeters": int(valid_global.max()),
            "encoding": "int16-source-height-meters",
            "heightAsset": str(height_path.relative_to(OUT)).replace("\\", "/"),
            "marineAsset": str(marine_path.relative_to(OUT)).replace("\\", "/"),
            "triangleCount": (GLOBAL_GRID - 1) * (GLOBAL_GRID - 1) * 2,
        },
        "offlineSatelliteColor": {
            "label": "satellite-color material",
            "originalSatelliteImageClaim": False,
            "losslessPng": True,
            "size": [GLOBAL_TEXTURE, GLOBAL_TEXTURE],
            "asset": str(texture_path.relative_to(OUT)).replace("\\", "/"),
        },
        "bathymetryOverview": {
            "sourceSha256": EXPECTED[BATHY][1],
            "grid": [BATHY_GRID, BATHY_GRID],
            "spacingMeters": [width_m / (BATHY_GRID - 1), height_m / (BATHY_GRID - 1)],
            "bounds": land_bounds,
            "minimumMeters": int(valid_bathy_values.min()) if valid_bathy_values.size else 0,
            "maximumMeters": int(valid_bathy_values.max()) if valid_bathy_values.size else 0,
            "validCellCount": int(valid_bathy.sum()),
            "asset": str(bathy_path.relative_to(OUT)).replace("\\", "/"),
            "landCellsEncodedAsNoData": True,
        },
        "hydrology": {
            "coastlineAsset": str(coast_path.relative_to(OUT)).replace("\\", "/"),
            "riverAsset": str(rivers_path.relative_to(OUT)).replace("\\", "/"),
            "truthAoiClipped": True,
            "sourceDemDraped": True,
            "riverSampleSpacingMaximumMeters": rivers["actualMaximumSampleSpacingMeters"],
            "coastSampleSpacingMaximumMeters": COAST_SAMPLE_STEP_M,
            "riverPartCount": rivers["partCount"],
            "riverSampleCount": rivers["sampleCount"],
            "coastlinePartCount": coast["partCount"],
            "coastlineSampleCount": coast["sampleCount"],
            "estuaryConnectivityStatus": "pending",
            "attribution": "© OpenStreetMap contributors",
            "license": "ODbL 1.0",
        },
        "detailTiles": detail_tiles,
        "assets": assets,
    }
    manifest_path = OUT / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    assets.append(file_record(manifest_path, "hires_manifest"))

    report = {
        "schema": "wenzhou_v111_hires_asset_build@1.1.1",
        "generatedAtUtc": now_iso(),
        "passed": True,
        "inputs": inputs,
        "outputs": assets,
        "terrainOverview": manifest["terrainOverview"],
        "bathymetryOverview": manifest["bathymetryOverview"],
        "hydrology": manifest["hydrology"],
        "detailTiles": detail_tiles,
        "truthInvariants": {
            "landSha256Unchanged": True,
            "landPixelsModified": 0,
            "bathySha256Unchanged": True,
            "osmCenterlineSourceSha256Unchanged": True,
        },
        "fixes": {
            "floatingOuterRing": "all coastline and waterway runs clipped to truth AOI before local conversion",
            "floatingRivers": "all retained samples densified to <=25 m and draped from source 12.5 m COG",
            "oceanNoise": "land cells removed from bathymetry and lossless marine mask retained",
            "lossyTexture": "replaced WebP/JPEG offline material with 4096 PNG lossless",
        },
    }
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
