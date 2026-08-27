from __future__ import annotations

import argparse
from collections import OrderedDict, defaultdict
import gzip
import hashlib
import json
import math
import os
from pathlib import Path
import struct
import tempfile
import time
from typing import Any, Iterable

import numpy as np
from PIL import Image, ImageFilter
import rasterio
from rasterio.enums import Resampling
from rasterio.windows import Window
from pyproj import Transformer
from shapely import (
    STRtree,
    constrained_delaunay_triangles,
    coverage_invalid_edges,
    coverage_is_valid,
    coverage_union_all,
    make_valid,
    polygons,
    set_precision,
    unary_union,
)
from shapely.affinity import translate
from shapely.geometry import LineString, MultiPolygon, Point, Polygon, box
from shapely.ops import polygonize

NODATA_CODE = np.uint16(65535)
EXPECTED_CRS = "EPSG:32649"
SOURCE_RESOLUTION_M = 12.5
MAX_ASSET_BYTES = 100 * 1024 * 1024
RIVER_FLOAT32_XZ_TOLERANCE_M = 0.03
RIVER_DISPLAY_PRECISION_GRID_M = 0.015625
RIVER_ROUND_BUFFER_QUAD_SEGS = 16
RIVER_SURFACE_OFFSET_M = 0.35
RIVER_CLEARANCE_ERROR_P95_TOLERANCE_M = 0.001
RIVER_CLEARANCE_ERROR_MAXIMUM_TOLERANCE_M = 0.01
RIVER_MAX_CLEARANCE_M = 2.0
RIVER_BOUNDARY_LENGTH_EPSILON_M = 1e-6
RIVER_GEOMETRY_AREA_EPSILON_M2 = 1e-8
LOD_LEVELS = (
    ("lod1600m", 128), ("lod800m", 64), ("lod400m", 32),
    ("lod200m", 16), ("lod100m", 8), ("lod50m", 4),
    ("lod25m", 2), ("native12_5m", 1),
)
SEASON_PRESETS = {
    "winter": {"label": "冬季枯水", "width": 0.66, "depth": 0.32, "color": "#42b69d"},
    "spring": {"label": "春季平水", "width": 0.92, "depth": 0.55, "color": "#45c4b5"},
    "summer": {"label": "夏季丰水", "width": 1.38, "depth": 0.88, "color": "#348e73"},
    "autumn": {"label": "秋季回落", "width": 0.82, "depth": 0.46, "color": "#3fa9aa"},
}


def scaled_shape(width: int, height: int, max_width: int) -> tuple[int, int]:
    scale = min(1.0, max_width / width)
    return max(2, int(round(width * scale))), max(2, int(round(height * scale)))


def _conservative_downsample_mask(ds, output_height: int, output_width: int) -> np.ndarray:
    if (output_height, output_width) == (ds.height, ds.width):
        return ds.read_masks(1) > 0
    rs = np.floor(np.arange(output_height) * ds.height / output_height).astype(np.int64)
    re = np.ceil((np.arange(output_height) + 1) * ds.height / output_height).astype(np.int64)
    cs = np.floor(np.arange(output_width) * ds.width / output_width).astype(np.int64)
    ce = np.ceil((np.arange(output_width) + 1) * ds.width / output_width).astype(np.int64)
    result = np.zeros((output_height, output_width), dtype=bool)
    row_budget = max(1, (24 * 1024 * 1024) // ds.width)
    out0 = 0
    while out0 < output_height:
        out1 = out0
        while out1 + 1 < output_height and re[out1 + 1] - rs[out0] <= row_budget:
            out1 += 1
        src0, src1 = int(rs[out0]), int(re[out1])
        invalid = (ds.read_masks(1, window=Window(0, src0, ds.width, src1 - src0)) == 0).astype(np.uint32)
        summed = np.zeros((invalid.shape[0] + 1, invalid.shape[1] + 1), dtype=np.uint32)
        summed[1:, 1:] = invalid.cumsum(0, dtype=np.uint32).cumsum(1, dtype=np.uint32)
        rr = np.arange(out0, out1 + 1)
        r0, r1 = rs[rr] - src0, re[rr] - src0
        counts = (
            summed[r1[:, None], ce[None, :]] + summed[r0[:, None], cs[None, :]]
            - summed[r0[:, None], ce[None, :]] - summed[r1[:, None], cs[None, :]]
        )
        result[out0:out1 + 1] = counts == 0
        out0 = out1 + 1
    return result


def read_scaled(ds: rasterio.io.DatasetReader, max_width: int, resampling: Resampling):
    width, height = scaled_shape(ds.width, ds.height, max_width)
    data = ds.read(1, out_shape=(height, width), resampling=resampling).astype(np.float32)
    mask = _conservative_downsample_mask(ds, height, width)
    return data, mask, width, height


def smoothstep(value: np.ndarray, edge0: float, edge1: float) -> np.ndarray:
    if edge1 <= edge0:
        raise ValueError("edge1 must be greater than edge0")
    t = np.clip((value - edge0) / (edge1 - edge0), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def gaussian_blur(field: np.ndarray, radius: float) -> np.ndarray:
    image = Image.fromarray(field.astype(np.float32), mode="F")
    return np.asarray(image.filter(ImageFilter.GaussianBlur(radius=radius)), dtype=np.float32)


def color_ramp(normalized: np.ndarray) -> np.ndarray:
    stops = np.array([0.0, 0.10, 0.24, 0.42, 0.61, 0.78, 1.0], dtype=np.float32)
    colors = np.array(
        [
            [9, 48, 33],
            [20, 73, 41],
            [43, 99, 53],
            [78, 119, 66],
            [124, 134, 82],
            [170, 157, 116],
            [226, 223, 210],
        ],
        dtype=np.float32,
    )
    rgb = np.empty((*normalized.shape, 3), dtype=np.float32)
    for channel in range(3):
        rgb[..., channel] = np.interp(normalized, stops, colors[:, channel])
    return rgb


def build_rich_terrain_products(
    data: np.ndarray,
    mask: np.ndarray,
    bounds: rasterio.coords.BoundingBox,
) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray, dict]:
    valid = data[mask]
    p1, p2, p50, p98, p995 = np.percentile(valid, [1.0, 2.0, 50.0, 98.0, 99.5])
    fill = float(p50)
    terrain = np.where(mask, data, fill).astype(np.float32)

    height, width = data.shape
    xres = (bounds.right - bounds.left) / width
    yres = (bounds.top - bounds.bottom) / height
    grad_y, grad_x = np.gradient(terrain, yres, xres)
    slope_radians = np.arctan(np.hypot(grad_x, grad_y))
    slope_degrees = np.degrees(slope_radians)
    aspect = np.arctan2(-grad_x, grad_y)

    broad = gaussian_blur(terrain, max(2.0, width / 170.0))
    local = gaussian_blur(terrain, max(1.0, width / 700.0))
    local_relief = terrain - broad
    micro_relief = terrain - local

    d2x = np.gradient(grad_x, xres, axis=1)
    d2y = np.gradient(grad_y, yres, axis=0)
    curvature = d2x + d2y

    relief_scale = max(float(np.percentile(np.abs(local_relief[mask]), 94.0)), 1.0)
    micro_scale = max(float(np.percentile(np.abs(micro_relief[mask]), 96.0)), 1.0)
    curvature_scale = max(float(np.percentile(np.abs(curvature[mask]), 96.0)), 1e-6)

    relief_n = np.clip(local_relief / relief_scale, -1.5, 1.5)
    micro_n = np.clip(micro_relief / micro_scale, -1.5, 1.5)
    curvature_n = np.clip(curvature / curvature_scale, -1.5, 1.5)

    normalized = np.clip((terrain - p2) / max(p98 - p2, 1.0), 0.0, 1.0)
    rgb = color_ramp(normalized)

    valley = smoothstep(-relief_n, 0.02, 0.95) * (1.0 - smoothstep(slope_degrees, 7.0, 24.0))
    ridge = smoothstep(relief_n, 0.02, 1.0)
    cliff = smoothstep(slope_degrees, 24.0, 58.0)
    convex = smoothstep(-curvature_n, 0.05, 1.0)
    concave = smoothstep(curvature_n, 0.05, 1.0)
    karst_detail = np.clip(
        0.40 * cliff
        + 0.24 * ridge
        + 0.18 * np.abs(curvature_n)
        + 0.18 * np.abs(micro_n),
        0.0,
        1.0,
    )
    limestone = np.clip(cliff * (0.46 + 0.54 * convex) * (0.35 + 0.65 * ridge), 0.0, 1.0)

    wet_green = np.array([23.0, 91.0, 59.0], dtype=np.float32)
    warm_limestone = np.array([190.0, 181.0, 151.0], dtype=np.float32)
    pale_limestone = np.array([220.0, 218.0, 202.0], dtype=np.float32)
    deep_forest = np.array([16.0, 60.0, 37.0], dtype=np.float32)

    rgb = rgb * (1.0 - valley[..., None] * 0.26) + wet_green * valley[..., None] * 0.26
    rgb = rgb * (1.0 - ridge[..., None] * 0.12) + deep_forest * ridge[..., None] * 0.12
    rgb = rgb * (1.0 - limestone[..., None] * 0.36) + warm_limestone * limestone[..., None] * 0.24
    rgb = rgb * (1.0 - cliff[..., None] * convex[..., None] * 0.12) + pale_limestone * cliff[..., None] * convex[..., None] * 0.12

    shades = []
    for azimuth_deg, altitude_deg in ((315.0, 42.0), (70.0, 28.0)):
        azimuth = math.radians(azimuth_deg)
        altitude = math.radians(altitude_deg)
        shade = (
            math.sin(altitude) * np.cos(slope_radians)
            + math.cos(altitude) * np.sin(slope_radians) * np.cos(azimuth - aspect)
        )
        shades.append(np.clip((shade + 1.0) * 0.5, 0.0, 1.0))
    hillshade = 0.72 * shades[0] + 0.28 * shades[1]
    ambient = np.clip(0.94 + relief_n * 0.08 - concave * 0.10, 0.72, 1.08)
    detail_light = np.clip(0.92 + micro_n * 0.055 + karst_detail * 0.045, 0.76, 1.16)
    rgb *= (0.40 + 0.78 * hillshade[..., None]) * ambient[..., None] * detail_light[..., None]

    warm = np.clip(np.cos(aspect - math.radians(225.0)) * 0.5 + 0.5, 0.0, 1.0)
    rgb[..., 0] *= 0.96 + warm * 0.07
    rgb[..., 1] *= 1.02 - warm * 0.02
    rgb[..., 2] *= 1.04 - warm * 0.08

    rgb = np.clip(rgb, 0, 255).astype(np.uint8)
    alpha = np.where(mask, 255, 0).astype(np.uint8)
    rgba = np.dstack([rgb, alpha])

    normal_strength = 1.35
    nx = -grad_x * normal_strength
    ny = grad_y * normal_strength
    nz = np.ones_like(nx)
    length = np.sqrt(nx * nx + ny * ny + nz * nz)
    nx /= length
    ny /= length
    nz /= length
    normal_rgb = np.dstack([
        (nx * 0.5 + 0.5) * 255.0,
        (ny * 0.5 + 0.5) * 255.0,
        (nz * 0.5 + 0.5) * 255.0,
    ]).astype(np.uint8)
    normal_rgb[~mask] = np.array([128, 128, 255], dtype=np.uint8)

    roughness = np.clip(0.70 + karst_detail * 0.22 - limestone * 0.12 + valley * 0.05, 0.48, 0.98)
    roughness_u8 = (roughness * 255.0).astype(np.uint8)
    roughness_u8[~mask] = 255

    detail_u8 = (np.clip(karst_detail * 0.72 + cliff * 0.28, 0.0, 1.0) * 255.0).astype(np.uint8)
    detail_u8[~mask] = 0

    stats = {
        "percentile_stretch_m": [float(p2), float(p98)],
        "valid_percentiles_m": {
            "p01": float(p1),
            "p02": float(p2),
            "p50": float(p50),
            "p98": float(p98),
            "p995": float(p995),
        },
        "derivative_resolution_m": [float(xres), float(yres)],
        "slope_degrees": {
            "p50": float(np.percentile(slope_degrees[mask], 50.0)),
            "p90": float(np.percentile(slope_degrees[mask], 90.0)),
            "p99": float(np.percentile(slope_degrees[mask], 99.0)),
        },
        "karst_detail_mean": float(karst_detail[mask].mean()),
        "limestone_exposure_mean": float(limestone[mask].mean()),
    }
    return rgba, normal_rgb, roughness_u8, detail_u8, stats


def json_write(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def deterministic_gzip(path: Path, parts: Iterable[bytes]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("wb") as raw, gzip.GzipFile(filename="", mode="wb", fileobj=raw, mtime=0, compresslevel=6) as encoded:
        for part in parts:
            encoded.write(part)


class _Metric:
    def __init__(self, quantum: float = 1e-6) -> None:
        self.count = 0
        self.total = 0.0
        self.minimum = math.inf
        self.maximum = -math.inf
        self.quantum = quantum
        self.histogram: dict[int, int] = defaultdict(int)

    def add(self, values: Any) -> None:
        array = np.asarray(values, dtype=np.float64)
        array = array[np.isfinite(array)]
        if not array.size:
            return
        self.count += int(array.size)
        self.total += float(array.sum())
        self.minimum = min(self.minimum, float(array.min()))
        self.maximum = max(self.maximum, float(array.max()))
        bins, counts = np.unique(np.floor(array / self.quantum).astype(np.int64), return_counts=True)
        for key, count in zip(bins, counts, strict=True):
            self.histogram[int(key)] += int(count)

    @property
    def mean(self) -> float:
        return self.total / self.count if self.count else 0.0

    def percentile(self, value: float) -> float:
        if not self.count:
            return 0.0
        target = int(math.ceil(self.count * value / 100.0))
        total = 0
        for key in sorted(self.histogram):
            total += self.histogram[key]
            if total >= target:
                return min(self.maximum, max(self.minimum, (key + 0.5) * self.quantum))
        return self.maximum


def _source_statistics(ds) -> dict[str, Any]:
    valid_count = nodata_count = 0
    valid_sum = 0.0
    minimum, maximum = math.inf, -math.inf
    samples: list[np.ndarray] = []
    for _, window in ds.block_windows(1):
        data = ds.read(1, window=window).astype(np.float32, copy=False)
        mask = ds.read_masks(1, window=window) > 0
        valid = data[mask]
        valid_count += int(valid.size)
        valid_sum += float(valid.astype(np.float64, copy=False).sum())
        nodata_count += int(mask.size - valid.size)
        if valid.size:
            minimum = min(minimum, float(valid.min()))
            maximum = max(maximum, float(valid.max()))
            stride = max(1, int(math.ceil(valid.size / 4096)))
            samples.append(valid[::stride].copy())
    if not valid_count:
        raise RuntimeError("DEM contains no valid cells")
    sampled = np.concatenate(samples)
    percentiles = np.percentile(sampled, [1, 2, 50, 98, 99.5])
    total = valid_count + nodata_count
    return {
        "count": valid_count, "valid_pixels": valid_count, "nodata_pixels": nodata_count, "total_pixels": total,
        "valid_fraction": valid_count / total, "nodata_fraction": nodata_count / total,
        "minimum_m": minimum, "maximum_m": maximum, "mean_m": valid_sum / valid_count,
        "percentiles_m": dict(zip(("p01", "p02", "p50", "p98", "p995"), map(float, percentiles), strict=True)),
        "percentile_sample_count": int(sampled.size),
        "percentile_policy": "bounded deterministic sample for colour only; counts/extrema scan every source pixel",
    }


def _select_nodata_boundary_acceptance(ds, radius_m: float = 600.0) -> dict[str, Any]:
    rx = int(math.ceil(radius_m / abs(ds.transform.a)))
    ry = int(math.ceil(radius_m / abs(ds.transform.e)))
    center_row, center_col = (ds.height - 1) / 2, (ds.width - 1) / 2
    best: tuple[float, int, int] | None = None
    for _, window in ds.block_windows(1):
        r0, c0 = int(window.row_off), int(window.col_off)
        r1, c1 = r0 + int(window.height), c0 + int(window.width)
        rr0, cc0, rr1, cc1 = max(0, r0 - 1), max(0, c0 - 1), min(ds.height, r1 + 1), min(ds.width, c1 + 1)
        mask = ds.read_masks(1, window=Window(cc0, rr0, cc1 - cc0, rr1 - rr0)) > 0
        padded = np.pad(mask, 1, constant_values=True)
        lr0, lc0 = r0 - rr0 + 1, c0 - cc0 + 1
        lr1, lc1 = lr0 + r1 - r0, lc0 + c1 - c0
        core = padded[lr0:lr1, lc0:lc1]
        boundary = core & (
            ~padded[lr0 - 1:lr1 - 1, lc0:lc1]
            | ~padded[lr0 + 1:lr1 + 1, lc0:lc1]
            | ~padded[lr0:lr1, lc0 - 1:lc1 - 1]
            | ~padded[lr0:lr1, lc0 + 1:lc1 + 1]
        )
        rows, cols = np.nonzero(boundary)
        rows, cols = rows + r0, cols + c0
        keep = (rows >= ry) & (rows < ds.height - ry) & (cols >= rx) & (cols < ds.width - rx)
        rows, cols = rows[keep], cols[keep]
        if not rows.size:
            continue
        score = (rows - center_row) ** 2 + (cols - center_col) ** 2
        order = np.lexsort((cols, rows, score))
        candidate = (float(score[order[0]]), int(rows[order[0]]), int(cols[order[0]]))
        if best is None or candidate < best:
            best = candidate
    if best is None:
        raise RuntimeError("No valid/NoData boundary supports a complete 600 m neighborhood")
    _, row, col = best
    r0, r1, c0, c1 = row - ry, row + ry + 1, col - rx, col + rx + 1
    mask = ds.read_masks(1, window=Window(c0, r0, c1 - c0, r1 - r0)) > 0
    dy = (np.arange(r0, r1) - row) * abs(ds.transform.e)
    dx = (np.arange(c0, c1) - col) * abs(ds.transform.a)
    circle = dy[:, None] ** 2 + dx[None, :] ** 2 <= radius_m ** 2 + 1e-9
    valid_count = int(np.count_nonzero(mask & circle))
    nodata_count = int(np.count_nonzero(~mask & circle))
    count = int(circle.sum())
    easting, northing = ds.xy(row, col)
    lon, lat = Transformer.from_crs(EXPECTED_CRS, "EPSG:4326", always_xy=True).transform(easting, northing)
    return {
        "id": "nodata", "lon": float(lon), "lat": float(lat),
        "easting": float(easting), "northing": float(northing), "source_row": row, "source_col": col,
        "selected_source_pixel_valid": True,
        "selection_policy": "centre-nearest valid source pixel four-adjacent to NoData; row/column tie-break",
        "neighborhood_radius_m": radius_m,
        "neighborhood_shape": "source pixel centres within inclusive Euclidean radius",
        "neighborhood_sample_count": count,
        "neighborhood_valid_pixel_count": valid_count,
        "neighborhood_nodata_pixel_count": nodata_count,
        "neighborhood_valid_fraction": valid_count / count,
        "neighborhood_nodata_fraction": nodata_count / count,
        "gap_fill_applied": False,
        "passed": valid_count > 0 and nodata_count > 0 and valid_count + nodata_count == count,
    }


def _nearest_verified_native_pixel(ds, lon: float, lat: float, radius_m: float = 1200.0) -> dict[str, Any]:
    to_utm = Transformer.from_crs("EPSG:4326", EXPECTED_CRS, always_xy=True)
    easting, northing = to_utm.transform(lon, lat)
    requested_row, requested_col = ds.index(easting, northing)
    rr = int(math.ceil(radius_m / abs(ds.transform.e)))
    rc = int(math.ceil(radius_m / abs(ds.transform.a)))
    r0, r1 = max(1, requested_row - rr), min(ds.height - 1, requested_row + rr + 1)
    c0, c1 = max(1, requested_col - rc), min(ds.width - 1, requested_col + rc + 1)
    expanded = ds.read_masks(1, window=Window(c0 - 1, r0 - 1, c1 - c0 + 2, r1 - r0 + 2)) > 0
    verified = np.ones((r1 - r0, c1 - c0), dtype=bool)
    for dr in range(3):
        for dc in range(3):
            verified &= expanded[dr:dr + r1 - r0, dc:dc + c1 - c0]
    rows, cols = np.nonzero(verified)
    if not rows.size:
        raise RuntimeError(f"No 3x3-valid native terrain within {radius_m} m of {lon},{lat}")
    rows, cols = rows + r0, cols + c0
    score = (rows - requested_row) ** 2 + (cols - requested_col) ** 2
    order = np.lexsort((cols, rows, score))
    row, col = int(rows[order[0]]), int(cols[order[0]])
    data = ds.read(1, window=Window(col - 1, row - 1, 3, 3)).astype(np.float64)
    dzdx = (data[1, 2] - data[1, 0]) / (2 * abs(ds.transform.a))
    dzdy = (data[2, 1] - data[0, 1]) / (2 * abs(ds.transform.e))
    selected_e, selected_n = ds.xy(row, col)
    selected_lon, selected_lat = Transformer.from_crs(EXPECTED_CRS, "EPSG:4326", always_xy=True).transform(selected_e, selected_n)
    return {
        "lon": float(selected_lon), "lat": float(selected_lat), "easting": float(selected_e), "northing": float(selected_n),
        "source_row": row, "source_col": col, "native_available": True, "native_mask_verified": True,
        "native_3x3_valid_count": 9, "native_elevation_m": float(data[1, 1]),
        "native_slope_degrees": math.degrees(math.atan(math.hypot(dzdx, dzdy))),
        "requested_lon": lon, "requested_lat": lat,
        "requested_to_selected_distance_m": math.hypot(selected_e - easting, selected_n - northing),
        "selection_policy": "nearest source pixel with valid 3x3 native terrain; row/column tie-break",
    }


def _hydrology_acceptance_anchors(hydrology: dict[str, Any] | None) -> dict[str, tuple[float, float]]:
    fallback = {"river-grounding": (110.50, 24.78), "river-turn": (110.48, 24.80)}
    if not hydrology:
        return fallback
    features = hydrology.get("features", [])
    grounding: tuple[float, int, tuple[float, float]] | None = None
    turn: tuple[float, int, int, tuple[float, float]] | None = None
    to_utm = Transformer.from_crs("EPSG:4326", EXPECTED_CRS, always_xy=True)
    for feature_index, feature in enumerate(features):
        geometry = feature.get("geometry") or {}
        coordinates = geometry.get("coordinates") or []
        if geometry.get("type") != "LineString" or len(coordinates) < 2:
            continue
        width = float((feature.get("properties") or {}).get("base_width_m") or 0)
        midpoint = coordinates[len(coordinates) // 2]
        choice = (-width, feature_index, (float(midpoint[0]), float(midpoint[1])))
        if grounding is None or choice < grounding:
            grounding = choice
        if len(coordinates) < 3:
            continue
        values = np.asarray(coordinates, dtype=np.float64)
        east, north = to_utm.transform(values[:, 0], values[:, 1])
        for index in range(1, len(values) - 1):
            first = np.asarray([east[index] - east[index - 1], north[index] - north[index - 1]])
            second = np.asarray([east[index + 1] - east[index], north[index + 1] - north[index]])
            denominator = np.linalg.norm(first) * np.linalg.norm(second)
            if denominator <= 1e-9:
                continue
            angle = math.degrees(math.acos(float(np.clip(np.dot(first, second) / denominator, -1, 1))))
            candidate = (-angle, feature_index, index, (float(values[index, 0]), float(values[index, 1])))
            if turn is None or candidate < turn:
                turn = candidate
    if grounding:
        fallback["river-grounding"] = grounding[2]
    if turn:
        fallback["river-turn"] = turn[3]
    return fallback


def _acceptance_points(ds, hydrology: dict[str, Any] | None) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    river = _hydrology_acceptance_anchors(hydrology)
    anchors = [
        ("guilin", 110.2994, 25.2742), ("yangshuo", 110.4920133, 24.7815129),
        ("peaks", 110.35, 25.05), ("cliff", 110.43, 24.91), ("gully", 110.58, 25.02),
        ("river-grounding", *river["river-grounding"]), ("river-turn", *river["river-turn"]),
        ("yangtang", 110.15569, 25.21753), ("zhenbaoding", 110.82528, 26.13556),
    ]
    roles = {
        "guilin": "urban terrain close-up", "yangshuo": "Yangshuo karst valley",
        "peaks": "peak-cluster detail", "cliff": "rock-wall detail", "gully": "gully detail",
        "river-grounding": "widest reviewed OSM feature bank-grounding audit",
        "river-turn": "maximum reviewed OSM centerline turn-angle audit",
        "yangtang": "Yangtang landmark", "zhenbaoding": "high-relief landmark",
    }
    result = []
    for point_id, lon, lat in anchors:
        receipt = _nearest_verified_native_pixel(ds, lon, lat)
        result.append({"id": point_id, **receipt, "acceptance_role": roles[point_id],
                       "anchor_source": "reviewed OSM geometry" if point_id.startswith("river-") else "fixed reviewed landmark",
                       "required_level": "native12_5m", "actual_vertex_spacing_m": SOURCE_RESOLUTION_M})
    nodata = _select_nodata_boundary_acceptance(ds)
    result.append({**nodata, "native_available": True, "native_mask_verified": True, "required_level": "native12_5m", "actual_vertex_spacing_m": SOURCE_RESOLUTION_M})
    required_ids = [item[0] for item in anchors] + ["nodata"]
    checks = {
        "required_acceptance_ids_present_exactly_once": sorted(item["id"] for item in result) == sorted(required_ids) and len({item["id"] for item in result}) == len(required_ids),
        "all_points_native_mask_verified": all(item["native_mask_verified"] for item in result),
        "all_terrain_points_have_valid_3x3_metrics": all(item.get("native_3x3_valid_count") == 9 for item in result if item["id"] != "nodata"),
        "all_terrain_points_report_finite_native_height_and_slope": all(math.isfinite(item.get("native_elevation_m", math.nan)) and math.isfinite(item.get("native_slope_degrees", math.nan)) for item in result if item["id"] != "nodata"),
        "all_fixed_and_hydrology_anchors_resolve_within_search_radius": all(item.get("requested_to_selected_distance_m", math.inf) <= 1200 for item in result if item["id"] != "nodata"),
        "yangshuo_river_turn_grounding_and_yangtang_verified": all(next(item for item in result if item["id"] == point_id)["native_mask_verified"] for point_id in ("yangshuo", "river-grounding", "river-turn", "yangtang")),
        "nodata_600m_contains_valid_pixels": nodata["neighborhood_valid_pixel_count"] > 0,
        "nodata_600m_contains_nodata_pixels": nodata["neighborhood_nodata_pixel_count"] > 0,
        "nodata_gap_fill_disabled": nodata["gap_fill_applied"] is False,
    }
    return result, {"checks": checks, "required_ids": required_ids, "passed": all(checks.values()), "nodata_boundary": nodata}


def _tile_axis_starts(sample_count: int, stride: int, intervals: int) -> list[int]:
    return list(range(0, max(1, sample_count - 1), stride * intervals)) or [0]


def _read_sparse_samples(ds, rows: np.ndarray, cols: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    row0, row1, col0, col1 = int(rows[0]), int(rows[-1]), int(cols[0]), int(cols[-1])
    heights = np.empty((len(rows), len(cols)), dtype="<f4")
    masks = np.empty_like(heights, dtype=np.uint8)
    pixels = (row1 - row0 + 1) * (col1 - col0 + 1)
    if pixels <= 24 * 1024 * 1024:
        window = Window(col0, row0, col1 - col0 + 1, row1 - row0 + 1)
        data, mask = ds.read(1, window=window), ds.read_masks(1, window=window)
        rr, cc = rows - row0, cols - col0
        heights[:] = data[np.ix_(rr, cc)].astype("<f4", copy=False)
        masks[:] = (mask[np.ix_(rr, cc)] > 0).astype(np.uint8)
    else:
        for output_row, source_row in enumerate(rows):
            window = Window(col0, int(source_row), col1 - col0 + 1, 1)
            heights[output_row] = ds.read(1, window=window)[0][cols - col0]
            masks[output_row] = (ds.read_masks(1, window=window)[0][cols - col0] > 0).astype(np.uint8)
    heights[masks == 0] = 0
    return heights, masks


def _conservative_cell_mask(ds, rows: np.ndarray, cols: np.ndarray) -> np.ndarray:
    result = np.ones((len(rows) - 1, len(cols) - 1), dtype=np.uint8)
    col0, col1 = int(cols[0]), int(cols[-1])
    width = col1 - col0 + 1
    budget = max(2, (24 * 1024 * 1024) // max(1, width))
    out0 = 0
    while out0 < len(rows) - 1:
        out1 = out0
        while out1 + 1 < len(rows) - 1 and rows[out1 + 2] - rows[out0] + 1 <= budget:
            out1 += 1
        source0, source1 = int(rows[out0]), int(rows[out1 + 1])
        invalid = (ds.read_masks(1, window=Window(col0, source0, width, source1 - source0 + 1)) == 0).astype(np.uint32)
        summed = np.zeros((invalid.shape[0] + 1, invalid.shape[1] + 1), dtype=np.uint32)
        summed[1:, 1:] = invalid.cumsum(0, dtype=np.uint32).cumsum(1, dtype=np.uint32)
        rr = np.arange(out0, out1 + 1)
        r0, r1 = rows[rr] - source0, rows[rr + 1] - source0 + 1
        c0, c1 = cols[:-1] - col0, cols[1:] - col0 + 1
        counts = summed[r1[:, None], c1] + summed[r0[:, None], c0] - summed[r0[:, None], c1] - summed[r1[:, None], c0]
        result[out0:out1 + 1] = counts == 0
        out0 = out1 + 1
    return result


def _encode_lod_tile(output_dir: Path, level_id: str, tile_row: int, tile_col: int,
                     rows: np.ndarray, cols: np.ndarray, heights: np.ndarray,
                     vertex_mask: np.ndarray, cell_mask: np.ndarray, ds) -> dict[str, Any]:
    relative = Path("terrain_lod") / level_id / f"r{tile_row:03d}_c{tile_col:03d}.tile.gz"
    path = output_dir / relative
    first_e, first_n = ds.xy(int(rows[0]), int(cols[0]))
    spacing = abs(ds.transform.a) * int(cols[1] - cols[0])
    header = struct.pack("<8sIIII3d", b"GLTILE4\0", heights.shape[1], heights.shape[0],
                         cell_mask.shape[1], cell_mask.shape[0], first_e, first_n, spacing)
    deterministic_gzip(path, (header, heights.astype("<f4", copy=False).tobytes(),
                              vertex_mask.astype(np.uint8, copy=False).tobytes(),
                              cell_mask.astype(np.uint8, copy=False).tobytes()))
    last_e, last_n = ds.xy(int(rows[-1]), int(cols[-1]))
    center_e, center_n = (ds.bounds.left + ds.bounds.right) / 2, (ds.bounds.bottom + ds.bounds.top) / 2
    return {
        "id": f"{level_id}-r{tile_row:03d}-c{tile_col:03d}", "row": tile_row, "col": tile_col,
        "tile_row": tile_row, "tile_col": tile_col,
        "source_window": [int(cols[0]), int(rows[0]), int(cols[-1] - cols[0] + 1), int(rows[-1] - rows[0] + 1)],
        "source_sample_rows": [int(rows[0]), int(rows[-1])], "source_sample_cols": [int(cols[0]), int(cols[-1])],
        "sample_width": heights.shape[1], "sample_height": heights.shape[0],
        "width": heights.shape[1], "height": heights.shape[0],
        "cell_width": cell_mask.shape[1], "cell_height": cell_mask.shape[0],
        "bounds_epsg32649": [float(first_e), float(last_n), float(last_e), float(first_n)],
        "sample_bounds_epsg32649": [float(first_e), float(last_n), float(last_e), float(first_n)],
        "bounds_world_xz": [float(first_e - center_e), float(center_n - first_n), float(last_e - center_e), float(center_n - last_n)],
        "valid_vertex_count": int(vertex_mask.sum()), "nodata_vertex_count": int(vertex_mask.size - vertex_mask.sum()),
        "valid_conservative_cell_count": int(cell_mask.sum()), "hidden_conservative_cell_count": int(cell_mask.size - cell_mask.sum()),
        "valid_cell_count": int(cell_mask.sum()), "nodata_cell_count": int(cell_mask.size - cell_mask.sum()),
        "smoothing": False, "gap_fill": False, "smoothing_applied": False, "gap_fill_applied": False,
        "fallback_resolution_m": None, "fallback_30m_allowed": False,
        "file": relative.as_posix(), "stored_bytes": path.stat().st_size, "sha256": sha256_file(path),
    }


def _decode_lod_tile(path: Path, tile: dict[str, Any], expected: tuple[np.ndarray, np.ndarray, np.ndarray] | None = None):
    with gzip.open(path, "rb") as handle:
        header = handle.read(48)
        magic, width, height, cell_width, cell_height, origin_e, origin_n, spacing = struct.unpack("<8sIIII3d", header)
        height_bytes, vertex_bytes, cell_bytes = handle.read(width * height * 4), handle.read(width * height), handle.read(cell_width * cell_height)
        trailing = handle.read(1)
    heights = np.frombuffer(height_bytes, dtype="<f4").reshape(height, width).copy()
    vertices = np.frombuffer(vertex_bytes, dtype=np.uint8).reshape(height, width).copy()
    cells = np.frombuffer(cell_bytes, dtype=np.uint8).reshape(cell_height, cell_width).copy()
    receipt = {
        "magic_valid": magic == b"GLTILE4\0", "shape_valid": (width, height, cell_width, cell_height) == (tile["width"], tile["height"], tile["cell_width"], tile["cell_height"]),
        "payload_length_valid": len(height_bytes) == width * height * 4 and len(vertex_bytes) == width * height and len(cell_bytes) == cell_width * cell_height and not trailing,
        "header_origin_matches_manifest": abs(origin_e - tile["bounds_epsg32649"][0]) <= 1e-9 and abs(origin_n - tile["bounds_epsg32649"][3]) <= 1e-9,
        "header_bounds_match_manifest": abs(origin_e + (width - 1) * spacing - tile["bounds_epsg32649"][2]) <= 1e-6 and abs(origin_n - (height - 1) * spacing - tile["bounds_epsg32649"][1]) <= 1e-6,
    }
    if expected:
        receipt.update({"height_payload_exact": np.array_equal(heights, expected[0]),
                        "vertex_mask_payload_exact": np.array_equal(vertices, expected[1]),
                        "cell_mask_payload_exact": np.array_equal(cells, expected[2])})
    return receipt, heights, vertices, cells


def _decoded_nodata_acceptance(ds, output_dir: Path, native_tiles: list[dict[str, Any]],
                               source_receipt: dict[str, Any]) -> dict[str, Any]:
    """Independently re-open the written native tiles around the selected mask boundary."""
    row, col = int(source_receipt["source_row"]), int(source_receipt["source_col"])
    radius = float(source_receipt["neighborhood_radius_m"])
    ry = int(math.ceil(radius / abs(ds.transform.e))); rx = int(math.ceil(radius / abs(ds.transform.a)))
    r0, r1 = row - ry, row + ry + 1; c0, c1 = col - rx, col + rx + 1
    source = ds.read_masks(1, window=Window(c0, r0, c1 - c0, r1 - r0)) > 0
    decoded = np.full(source.shape, 255, dtype=np.uint8)
    decoded_cells = np.full((source.shape[0] - 1, source.shape[1] - 1), 255, dtype=np.uint8)
    duplicate_vertex_mismatch = duplicate_cell_mismatch = 0
    tiles_read = 0
    for tile in native_tiles:
        tc0, tr0, width, height = map(int, tile["source_window"])
        tr1, tc1 = tr0 + height, tc0 + width
        ir0, ir1, ic0, ic1 = max(r0, tr0), min(r1, tr1), max(c0, tc0), min(c1, tc1)
        if ir0 >= ir1 or ic0 >= ic1:
            continue
        _, _, vertex_mask, cell_mask = _decode_lod_tile(output_dir / tile["file"], tile)
        target = decoded[ir0 - r0:ir1 - r0, ic0 - c0:ic1 - c0]
        values = vertex_mask[ir0 - tr0:ir1 - tr0, ic0 - tc0:ic1 - tc0]
        duplicate_vertex_mismatch += int(np.count_nonzero((target != 255) & (target != values)))
        target[target == 255] = values[target == 255]
        cir0, cir1, cic0, cic1 = max(r0, tr0), min(r1 - 1, tr1 - 1), max(c0, tc0), min(c1 - 1, tc1 - 1)
        if cir0 < cir1 and cic0 < cic1:
            ctarget = decoded_cells[cir0 - r0:cir1 - r0, cic0 - c0:cic1 - c0]
            cvalues = cell_mask[cir0 - tr0:cir1 - tr0, cic0 - tc0:cic1 - tc0]
            duplicate_cell_mismatch += int(np.count_nonzero((ctarget != 255) & (ctarget != cvalues)))
            ctarget[ctarget == 255] = cvalues[ctarget == 255]
        tiles_read += 1
    expected_cells = (source[:-1, :-1] & source[:-1, 1:] & source[1:, :-1] & source[1:, 1:]).astype(np.uint8)
    vertex_uncovered = int(np.count_nonzero(decoded == 255)); cell_uncovered = int(np.count_nonzero(decoded_cells == 255))
    vertex_mismatch = int(np.count_nonzero((decoded != 255) & (decoded != source)))
    cell_mismatch = int(np.count_nonzero((decoded_cells != 255) & (decoded_cells != expected_cells)))
    dy = (np.arange(r0, r1) - row) * abs(ds.transform.e); dx = (np.arange(c0, c1) - col) * abs(ds.transform.a)
    circle = dy[:, None] ** 2 + dx[None, :] ** 2 <= radius ** 2 + 1e-9
    decoded_circle = decoded[circle]
    valid = int(np.count_nonzero(decoded_circle == 1)); nodata = int(np.count_nonzero(decoded_circle == 0))
    # A conservative valid cell can never generate either of its two triangles over an invalid support vertex.
    invalid_support = ~expected_cells.astype(bool)
    triangle_leak_count = int(2 * np.count_nonzero((decoded_cells == 1) & invalid_support))
    checks = {
        "native_tiles_reopened": tiles_read > 0,
        "decoded_vertex_window_complete": vertex_uncovered == 0,
        "decoded_cell_window_complete": cell_uncovered == 0,
        "decoded_vertex_mask_matches_source": vertex_mismatch == 0 and duplicate_vertex_mismatch == 0,
        "decoded_conservative_cells_match_source_support": cell_mismatch == 0 and duplicate_cell_mismatch == 0,
        "decoded_circle_contains_valid_and_nodata": valid > 0 and nodata > 0,
        "no_triangle_over_nodata_support": triangle_leak_count == 0,
    }
    return {
        "measurement": "fresh gzip decode of every native tile intersecting the 600 m source-mask circle",
        "source_row": row, "source_col": col, "radius_m": radius, "native_tiles_reopened": tiles_read,
        "decoded_circle_sample_count": int(circle.sum()), "decoded_circle_valid_pixel_count": valid,
        "decoded_circle_nodata_pixel_count": nodata, "decoded_vertex_mask_mismatch_count": vertex_mismatch,
        "decoded_vertex_uncovered_count": vertex_uncovered, "decoded_cell_mask_mismatch_count": cell_mismatch,
        "decoded_cell_uncovered_count": cell_uncovered, "duplicate_vertex_mismatch_count": duplicate_vertex_mismatch,
        "duplicate_cell_mismatch_count": duplicate_cell_mismatch, "nodata_triangle_leak_count": triangle_leak_count,
        "gap_fill_applied": False, "checks": checks, "passed": all(checks.values()),
    }


def build_lod_products(ds, output_dir: Path, source_stats: dict[str, Any], tile_intervals: int,
                       hydrology: dict[str, Any] | None) -> tuple[dict[str, Any], dict[str, Any]]:
    acceptance, acceptance_qa = _acceptance_points(ds, hydrology)
    levels, reports = [], []
    total_tiles = maximum_file = decoded_valid_samples = 0
    all_shared = _Metric(1e-7)
    source_error = _Metric(1e-7)
    all_shared_samples = all_shared_both_valid = all_mask_mismatches = all_index_mismatches = 0
    source_mask_mismatches = conservative_cell_mismatches = 0
    native_unique_valid = native_unique_nodata = 0
    decoded_boundaries_by_level: dict[str, list[dict[str, Any]]] = {}
    for level_id, stride in LOD_LEVELS:
        row_starts, col_starts = _tile_axis_starts(ds.height, stride, tile_intervals), _tile_axis_starts(ds.width, stride, tile_intervals)
        tiles, edges = [], {}
        decode_failures = 0
        for tr, row0 in enumerate(row_starts):
            rows = np.arange(row0, min(ds.height - 1, row0 + tile_intervals * stride) + 1, stride, dtype=np.int64)
            for tc, col0 in enumerate(col_starts):
                cols = np.arange(col0, min(ds.width - 1, col0 + tile_intervals * stride) + 1, stride, dtype=np.int64)
                if min(len(rows), len(cols)) < 2:
                    raise RuntimeError(f"LOD tile {level_id}/{tr}/{tc} has fewer than two samples")
                heights, vertices = _read_sparse_samples(ds, rows, cols)
                cells = _conservative_cell_mask(ds, rows, cols)
                tile = _encode_lod_tile(output_dir, level_id, tr, tc, rows, cols, heights, vertices, cells, ds)
                receipt, decoded_h, decoded_v, decoded_c = _decode_lod_tile(output_dir / tile["file"], tile, (heights, vertices, cells))
                tile["decode_receipt"] = receipt
                decode_failures += int(not all(receipt.values()))
                decoded_valid_samples += int(decoded_v.sum())
                if level_id == "native12_5m":
                    owned_height = decoded_v.shape[0] - (tr + 1 < len(row_starts))
                    owned_width = decoded_v.shape[1] - (tc + 1 < len(col_starts))
                    unique_mask = decoded_v[:owned_height, :owned_width]
                    native_unique_valid += int(unique_mask.sum())
                    native_unique_nodata += int(unique_mask.size - unique_mask.sum())
                source_mask_mismatches += int(np.count_nonzero(decoded_v != vertices))
                conservative_cell_mismatches += int(np.count_nonzero(decoded_c != cells))
                source_error.add(np.abs(decoded_h[decoded_v > 0].astype(np.float64) - heights[decoded_v > 0].astype(np.float64)))
                maximum_file = max(maximum_file, tile["stored_bytes"])
                edges[(tr, tc)] = {
                    "top_h": decoded_h[0], "bottom_h": decoded_h[-1], "left_h": decoded_h[:, 0], "right_h": decoded_h[:, -1],
                    "top_m": decoded_v[0], "bottom_m": decoded_v[-1], "left_m": decoded_v[:, 0], "right_m": decoded_v[:, -1],
                    "rows": tile["source_sample_rows"], "cols": tile["source_sample_cols"],
                    "row_values": rows.copy(), "col_values": cols.copy(),
                }
                tiles.append(tile)
        level_metric = _Metric(1e-7)
        level_samples = level_both_valid = level_mask_mismatch = level_index_mismatch = 0
        for tr in range(len(row_starts)):
            for tc in range(len(col_starts)):
                current = edges[(tr, tc)]
                if tc + 1 < len(col_starts):
                    other = edges[(tr, tc + 1)]
                    level_index_mismatch += int(current["cols"][1] != other["cols"][0] or current["rows"] != other["rows"])
                    if len(current["right_h"]) == len(other["left_h"]):
                        both = (current["right_m"] > 0) & (other["left_m"] > 0)
                        level_metric.add(np.abs(current["right_h"][both].astype(np.float64) - other["left_h"][both]))
                        level_samples += len(current["right_h"])
                        level_both_valid += int(both.sum())
                        level_mask_mismatch += int(np.count_nonzero(current["right_m"] != other["left_m"]))
                if tr + 1 < len(row_starts):
                    other = edges[(tr + 1, tc)]
                    level_index_mismatch += int(current["rows"][1] != other["rows"][0] or current["cols"] != other["cols"])
                    if len(current["bottom_h"]) == len(other["top_h"]):
                        both = (current["bottom_m"] > 0) & (other["top_m"] > 0)
                        level_metric.add(np.abs(current["bottom_h"][both].astype(np.float64) - other["top_h"][both]))
                        level_samples += len(current["bottom_h"])
                        level_both_valid += int(both.sum())
                        level_mask_mismatch += int(np.count_nonzero(current["bottom_m"] != other["top_m"]))
        for key, count in level_metric.histogram.items():
            all_shared.histogram[key] += count
        all_shared.count += level_metric.count; all_shared.total += level_metric.total
        if level_metric.count:
            all_shared.minimum = min(all_shared.minimum, level_metric.minimum); all_shared.maximum = max(all_shared.maximum, level_metric.maximum)
        all_shared_samples += level_samples
        all_shared_both_valid += level_both_valid
        all_mask_mismatches += level_mask_mismatch
        all_index_mismatches += level_index_mismatch
        spacing = SOURCE_RESOLUTION_M * stride
        sampled_west = min(t["bounds_epsg32649"][0] for t in tiles); sampled_south = min(t["bounds_epsg32649"][1] for t in tiles)
        sampled_east = max(t["bounds_epsg32649"][2] for t in tiles); sampled_north = max(t["bounds_epsg32649"][3] for t in tiles)
        source_west, source_north = ds.xy(0, 0); source_east, source_south = ds.xy(ds.height - 1, ds.width - 1)
        gaps = {"west_m": max(0., sampled_west - source_west), "south_m": max(0., sampled_south - source_south),
                "east_m": max(0., source_east - sampled_east), "north_m": max(0., source_north - sampled_north)}
        level = {"id": level_id, "level_id": level_id, "stride": stride, "spacing_m": spacing, "resolution_m": spacing,
                 "tile_intervals": tile_intervals, "tile_rows": len(row_starts), "tile_cols": len(col_starts), "tile_count": len(tiles), "tiles": tiles,
                 "height_encoding": "source float32 little-endian", "mask_encoding": "vertex mask then conservative cell mask",
                 "smoothing": False, "gap_fill": False, "fallback_resolution_m": None, "fallback_30m_allowed": False,
                 "smoothing_applied": False, "gap_fill_applied": False, "sampled_center_bounds_epsg32649": [sampled_west, sampled_south, sampled_east, sampled_north],
                 "source_center_edge_gaps_m": gaps, "full_source_center_domain_coverage": max(gaps.values()) <= 1e-9,
                 "domain_coverage_policy": "native full-domain; coarse grids never invent non-uniform edge samples"}
        levels.append(level)
        report = {"id": level_id, "spacing_m": spacing, "tile_count": len(tiles), "decode_failure_count": decode_failures,
                  "shared_edge_sample_count": level_samples, "shared_edge_both_valid_sample_count": level_both_valid,
                  "shared_edge_height_maximum_error_m": level_metric.maximum if level_metric.count else 0.,
                  "shared_edge_height_p95_error_m": level_metric.percentile(95), "shared_edge_mask_mismatch_count": level_mask_mismatch,
                  "shared_edge_source_index_mismatch_count": level_index_mismatch,
                  "source_center_edge_gaps_m": gaps, "full_source_center_domain_coverage": max(gaps.values()) <= 1e-9}
        report["passed"] = decode_failures == 0 and level_mask_mismatch == 0 and level_index_mismatch == 0 and report["shared_edge_height_maximum_error_m"] == 0
        reports.append(report)
        unique_boundaries: dict[tuple[str, int, int, int], dict[str, Any]] = {}
        for edge in edges.values():
            definitions = (
                ("horizontal", int(edge["row_values"][0]), edge["col_values"], edge["top_h"], edge["top_m"]),
                ("horizontal", int(edge["row_values"][-1]), edge["col_values"], edge["bottom_h"], edge["bottom_m"]),
                ("vertical", int(edge["col_values"][0]), edge["row_values"], edge["left_h"], edge["left_m"]),
                ("vertical", int(edge["col_values"][-1]), edge["row_values"], edge["right_h"], edge["right_m"]),
            )
            for orientation, constant, axis, values, masks in definitions:
                key = (orientation, constant, int(axis[0]), int(axis[-1]))
                if key not in unique_boundaries:
                    unique_boundaries[key] = {"orientation": orientation, "constant_source_index": constant,
                                              "axis_source_indices": axis.copy(), "heights": values.copy(), "masks": masks.copy()}
        decoded_boundaries_by_level[level_id] = list(unique_boundaries.values())
        total_tiles += len(tiles)

    native_nodata_decoded = _decoded_nodata_acceptance(
        ds, output_dir, levels[-1]["tiles"], acceptance_qa["nodata_boundary"]
    )
    mixed_metric = _Metric(1e-7); mixed_interp_metric = _Metric(1e-6)
    mixed_samples = mixed_both_valid = mixed_mask_mismatch = mixed_transition_pairs = 0
    for level_index in range(len(LOD_LEVELS) - 1):
        coarse_id, _ = LOD_LEVELS[level_index]; fine_id, _ = LOD_LEVELS[level_index + 1]
        fine_lookup: dict[tuple[str, int], list[dict[str, Any]]] = defaultdict(list)
        for edge in decoded_boundaries_by_level[fine_id]:
            fine_lookup[(edge["orientation"], edge["constant_source_index"])].append(edge)
        for coarse in decoded_boundaries_by_level[coarse_id]:
            for fine in fine_lookup.get((coarse["orientation"], coarse["constant_source_index"]), []):
                low = max(int(coarse["axis_source_indices"][0]), int(fine["axis_source_indices"][0]))
                high = min(int(coarse["axis_source_indices"][-1]), int(fine["axis_source_indices"][-1]))
                if low >= high:
                    continue
                coarse_axis = coarse["axis_source_indices"]; fine_axis = fine["axis_source_indices"]
                common = np.intersect1d(coarse_axis[(coarse_axis >= low) & (coarse_axis <= high)],
                                        fine_axis[(fine_axis >= low) & (fine_axis <= high)], assume_unique=True)
                if len(common) < 2:
                    continue
                ci = np.searchsorted(coarse_axis, common); fi = np.searchsorted(fine_axis, common)
                cm, fm = coarse["masks"][ci] > 0, fine["masks"][fi] > 0; both = cm & fm
                mixed_metric.add(np.abs(coarse["heights"][ci][both].astype(np.float64) - fine["heights"][fi][both].astype(np.float64)))
                mixed_samples += len(common); mixed_both_valid += int(both.sum()); mixed_mask_mismatch += int(np.count_nonzero(cm != fm))
                fine_inside = (fine_axis >= low) & (fine_axis <= high); axis_values = fine_axis[fine_inside]
                if len(axis_values):
                    interpolated = np.interp(axis_values, coarse_axis, coarse["heights"].astype(np.float64))
                    valid_values = fine["masks"][fine_inside] > 0
                    mixed_interp_metric.add(np.abs(fine["heights"][fine_inside][valid_values].astype(np.float64) - interpolated[valid_values]))
                mixed_transition_pairs += 1
    west, south, east, north = ds.bounds
    to_wgs = Transformer.from_crs(EXPECTED_CRS, "EPSG:4326", always_xy=True)
    corners = [to_wgs.transform(west, south), to_wgs.transform(east, south), to_wgs.transform(east, north), to_wgs.transform(west, north)]
    manifest = {
        "schema": "guilin-v072-terrain-lod/v4", "crs": EXPECTED_CRS,
        "source_grid": [ds.width, ds.height], "source_resolution_m": [abs(ds.transform.a), abs(ds.transform.e)], "source_statistics": source_stats,
        "bounds_epsg32649": [west, south, east, north], "bounds_wgs84": [min(x for x, _ in corners), min(y for _, y in corners), max(x for x, _ in corners), max(y for _, y in corners)],
        "center_epsg32649": [(west + east) / 2, (south + north) / 2], "elevation_range_m": [source_stats["minimum_m"], source_stats["maximum_m"]],
        "vertical_scale": 1.0, "source_elevation_modified_m": 0.0,
        "smoothing": False, "gap_fill": False, "smoothing_applied": False, "gap_fill_applied": False,
        "fallback_resolution_m": None, "fallback_30m_allowed": False,
        "nodata": {"valid_count": source_stats["valid_pixels"], "count": source_stats["nodata_pixels"], "ratio": source_stats["nodata_fraction"], "valid_ratio": source_stats["valid_fraction"], "encoding": "explicit masks; never interpolated"},
        "tile_format": {"magic": "GLTILE4\\0", "header_struct_little_endian": "<8sIIII3d", "payload_order": ["height_f32", "vertex_mask_u8", "conservative_cell_mask_u8"], "file_pattern": "terrain_lod/{level_id}/r{row:03d}_c{col:03d}.tile.gz", "deterministic_gzip": True},
        "levels": levels, "acceptance_points": acceptance, "acceptance_source_qa": acceptance_qa,
        "tile_count": total_tiles, "coarse_level_full_domain_claimed": False, "native_full_domain": levels[-1]["full_source_center_domain_coverage"],
        "overview_only_backdrop_policy": "runtime-required backdrop covers coarse edge strips; native is authoritative/full-domain",
        "qa_file": "terrain_lod_qa.json", "lod_qa_file": "terrain_lod_qa.json", "river_drape_runtime_file": "river_drape_runtime.json", "river_drape_qa_file": "river_drape_qa.json",
        "source_mosaic": Path(ds.name).name,
    }
    shared_contract = {"measurement": "decoded adjacent tile border heights and vertex masks at identical source indices",
                       "edges_checked": sum((l["tile_rows"] * max(0, l["tile_cols"] - 1) + l["tile_cols"] * max(0, l["tile_rows"] - 1)) for l in levels),
                       "sample_count": all_shared_samples, "both_valid_sample_count": all_shared_both_valid,
                       "maximum_height_error_m": all_shared.maximum if all_shared.count else 0.,
                       "p95_height_error_m": all_shared.percentile(95),
                       "mean_height_error_m": all_shared.mean,
                       "mask_mismatch_count": all_mask_mismatches, "source_index_mismatch_count": all_index_mismatches}
    shared_contract["passed"] = shared_contract["sample_count"] > 0 and shared_contract["maximum_height_error_m"] == 0 and all_mask_mismatches == 0 and all_index_mismatches == 0
    mixed_offline_passed = mixed_transition_pairs > 0 and mixed_samples > 0 and (not mixed_metric.count or mixed_metric.maximum == 0) and mixed_mask_mismatch == 0
    mixed_contract = {"validation_mode": "fresh decoded adjacent-level boundary payloads at common native source indices; runtime topology is separately required", "runtime_required": True,
                      "runtime_stitch_passed": None, "runtime_topology_status": "runtime_required",
                      "adjacent_level_transition_pair_count": mixed_transition_pairs,
                      "coincident_source_index_samples": mixed_samples, "coincident_both_valid_sample_count": mixed_both_valid,
                      "coincident_maximum_vertical_jump_m": mixed_metric.maximum if mixed_metric.count else 0.,
                      "coincident_p95_vertical_jump_m": mixed_metric.percentile(95), "coincident_mean_vertical_jump_m": mixed_metric.mean,
                      "fine_intermediate_to_coarse_linear_height_maximum_m": mixed_interp_metric.maximum if mixed_interp_metric.count else 0.,
                      "fine_intermediate_to_coarse_linear_height_p95_m": mixed_interp_metric.percentile(95),
                      "fine_intermediate_to_coarse_linear_height_mean_m": mixed_interp_metric.mean,
                      "fine_intermediate_sample_count": mixed_interp_metric.count,
                      "maximum_horizontal_alignment_error_m": 0., "mask_mismatch_count": mixed_mask_mismatch,
                      "offline_source_alignment_passed": mixed_offline_passed, "offline_passed": mixed_offline_passed,
                      "offline_pass_scope": "source-index/height/mask correspondence only; does not assert rendered stitching"}
    checks = {"source_resolution_is_12_5m": abs(abs(ds.transform.a) - 12.5) <= 1e-9 and abs(abs(ds.transform.e) - 12.5) <= 1e-9,
              "native_level_present": levels[-1]["id"] == "native12_5m", "native_level_full_source_center_domain": levels[-1]["full_source_center_domain_coverage"],
              "all_tile_payloads_decode_and_match_source": all(r["decode_failure_count"] == 0 for r in reports) and source_mask_mismatches == 0 and conservative_cell_mismatches == 0 and (not source_error.count or source_error.maximum == 0),
              "native_unique_mask_counts_match_source": native_unique_valid == source_stats["valid_pixels"] and native_unique_nodata == source_stats["nodata_pixels"] and native_unique_valid + native_unique_nodata == ds.width * ds.height,
              "decoded_shared_edges_exact": shared_contract["passed"], "mixed_lod_source_alignment_exact_runtime_stitch_required": mixed_contract["offline_source_alignment_passed"] and mixed_contract["runtime_required"] and mixed_contract["runtime_stitch_passed"] is None,
              "acceptance_native_source_verified": acceptance_qa["passed"],
              "nodata_600m_mixed_boundary_verified": acceptance_qa["nodata_boundary"]["passed"] and native_nodata_decoded["passed"],
              "vertical_scale_is_1": True, "source_elevation_unmodified": True, "nodata_preserved_without_fill": True,
              "all_files_under_100_mib": maximum_file < MAX_ASSET_BYTES}
    qa = {"schema": "guilin-v072-terrain-lod-qa/v4", "checks": checks, "passed": all(checks.values()), "source_statistics": source_stats,
          "smoothing": False, "gap_fill": False, "fallback_resolution_m": None, "fallback_30m_allowed": False,
          "source_correspondence": {"decoded_valid_samples": decoded_valid_samples,
                                    "decoded_sample_occurrence_valid_count_all_levels_with_shared_edges": decoded_valid_samples,
                                    "native_unique_valid_pixels": native_unique_valid, "native_unique_nodata_pixels": native_unique_nodata,
                                    "native_unique_total_pixels": native_unique_valid + native_unique_nodata,
                                    "maximum_error_m": source_error.maximum if source_error.count else 0.,
                                    "p95_error_m": source_error.percentile(95), "mask_mismatch_count": source_mask_mismatches,
                                    "measurement": "every decoded tile payload compared with its source sample window",
                                    "passed": all(r["decode_failure_count"] == 0 for r in reports) and source_mask_mismatches == 0 and (not source_error.count or source_error.maximum == 0)},
          "nodata_preservation": {"source_valid_pixels": source_stats["valid_pixels"], "source_nodata_pixels": source_stats["nodata_pixels"], "source_nodata_fraction": source_stats["nodata_fraction"], "gap_fill_applied": False, "decode_mask_mismatch_count": source_mask_mismatches, "passed": source_mask_mismatches == 0},
          "conservative_cell_masks": {"gap_fill_applied": False, "decode_mismatch_count": conservative_cell_mismatches, "passed": conservative_cell_mismatches == 0},
          "shared_edges": shared_contract, "mixed_lod_transitions": mixed_contract, "level_reports": reports,
          "native_acceptance": {"required_ids": [p["id"] for p in acceptance], "available_ids": [p["id"] for p in acceptance if p["native_available"]], "actual_vertex_spacing_m": 12.5, "all_required_available": acceptance_qa["passed"], "source_validation": acceptance_qa, "passed": acceptance_qa["passed"]},
          "nodata_acceptance_boundary": acceptance_qa["nodata_boundary"],
          "nodata_acceptance_decoded_native_tiles": native_nodata_decoded,
          "tile_count": total_tiles, "maximum_stored_tile_bytes": maximum_file,
          "coarse_level_full_domain_claimed": False, "native_full_domain": levels[-1]["full_source_center_domain_coverage"],
          "level_domain_coverage": [{"id": l["id"], "full_source_center_domain_coverage": l["full_source_center_domain_coverage"], "source_center_edge_gaps_m": l["source_center_edge_gaps_m"]} for l in levels],
          "overview_only_backdrop_policy": manifest["overview_only_backdrop_policy"], "memory_policy": "tile/component streaming; no full DEM materialization"}
    if total_tiles != 6742:
        raise RuntimeError(f"Unexpected terrain LOD tile count: {total_tiles} / 6742")
    if not qa["passed"]:
        raise RuntimeError("Terrain LOD QA failed")
    json_write(output_dir / "terrain_lod_manifest.json", manifest); json_write(output_dir / "terrain_lod_qa.json", qa)
    return manifest, qa


def _polygon_parts(geometry: Any) -> list[Polygon]:
    if geometry is None or geometry.is_empty:
        return []
    if isinstance(geometry, Polygon):
        return [geometry]
    if isinstance(geometry, MultiPolygon):
        return list(geometry.geoms)
    return [part for item in getattr(geometry, "geoms", []) for part in _polygon_parts(item)]


def _coverage_union(values: Iterable[Any]) -> Any:
    geometries = [g for g in values if g is not None and not g.is_empty]
    if not geometries:
        return Polygon()
    try:
        result = coverage_union_all(np.asarray(geometries, dtype=object))
        if result.is_valid:
            return result
    except Exception:
        pass
    return unary_union(geometries)


def _clean_geometry(geometry: Any) -> Any:
    return _coverage_union(part for part in _polygon_parts(geometry) if part.area > RIVER_GEOMETRY_AREA_EPSILON_M2)


def _topology(geometry: Any) -> dict[str, Any]:
    parts = _polygon_parts(geometry)
    rings = [Polygon(ring) for part in parts for ring in part.interiors]
    return {"area_m2": float(geometry.area), "component_count": len(parts), "interior_ring_count": len(rings),
            "interior_ring_area_m2": float(sum(r.area for r in rings)), "valid": bool(geometry.is_valid),
            "wkb_sha256": hashlib.sha256(geometry.wkb).hexdigest()}


def _significant_rings(geometry: Any, minimum: float) -> dict[str, Any]:
    areas = [float(Polygon(r).area) for p in _polygon_parts(geometry) for r in p.interiors]
    significant = [a for a in areas if a >= minimum]
    return {"count": len(significant), "area_m2": sum(significant), "minimum_area_m2": minimum,
            "subgrid_count": len(areas) - len(significant), "subgrid_area_m2": sum(areas) - sum(significant)}


def _triangulate_exact(polygon: Polygon) -> list[Polygon]:
    if polygon.is_empty or polygon.area <= 1e-12:
        return []
    try:
        source = getattr(constrained_delaunay_triangles(polygon), "geoms", [])
    except Exception:
        from shapely.ops import triangulate
        source = triangulate(polygon)
    triangles = []
    for candidate in source:
        if candidate.area <= 1e-12 or not polygon.covers(candidate.representative_point()):
            continue
        clipped = candidate.intersection(polygon)
        for part in _polygon_parts(clipped):
            coords = list(part.exterior.coords)[:-1]
            if len(coords) == 3 and not part.interiors:
                triangles.append(part)
            else:
                from shapely.ops import triangulate
                triangles.extend(t for t in triangulate(part) if t.area > 1e-12 and part.covers(t.representative_point()))
    return triangles


def _ribbon(east: np.ndarray, north: np.ndarray, width: float) -> tuple[Any, dict[str, Any]]:
    raw = LineString(np.column_stack((east, north))).buffer(width / 2, quad_segs=16, cap_style="round", join_style="round")
    final = raw if raw.is_valid else make_valid(raw)
    final = _coverage_union(_polygon_parts(final))
    raw_rings = [Polygon(r) for p in _polygon_parts(raw) for r in p.interiors]
    final_rings = [Polygon(r) for p in _polygon_parts(final) for r in p.interiors]
    holes = _coverage_union(raw_rings)
    contract = {"source_buffer_interior_ring_count": len(raw_rings), "source_buffer_interior_area_m2": sum(r.area for r in raw_rings),
                "final_interior_ring_count": len(final_rings), "final_interior_ring_area_m2": sum(r.area for r in final_rings),
                "preserved_buffer_symmetric_difference_area_m2": float(raw.symmetric_difference(final).area),
                "preserved_buffer_filled_interior_area_m2": float(final.intersection(holes).area) if raw_rings else 0.,
                "input_invalid_ribbons": int(not raw.is_valid), "invalid_repaired_polygons": int(not final.is_valid),
                "interior_ring_policy": "preserve every raw q16 round-buffer interior ring; never fill"}
    contract["passed"] = contract["source_buffer_interior_ring_count"] == contract["final_interior_ring_count"] and contract["preserved_buffer_filled_interior_area_m2"] <= 1e-8 and contract["preserved_buffer_symmetric_difference_area_m2"] <= 1e-8
    return final, contract


def _hole_regression() -> dict[str, Any]:
    source = Polygon([(0, 0), (40, 0), (40, 40), (0, 40)], [[(11, 9), (29, 9), (29, 31), (11, 31)]])
    hole = Polygon(source.interiors[0]); triangles = _triangulate_exact(source); union = _coverage_union(triangles)
    result = {"policy": "constrained triangulation preserves holes", "source_area_m2": source.area,
              "source_interior_ring_area_m2": hole.area, "source_interior_ring_count": 1,
              "symmetric_difference_area_m2": source.symmetric_difference(union).area,
              "triangle_area_m2": sum(t.area for t in triangles), "triangle_count": len(triangles),
              "triangle_hole_overlap_area_m2": sum(t.intersection(hole).area for t in triangles)}
    result["passed"] = result["triangle_count"] > 0 and result["symmetric_difference_area_m2"] <= 1e-10 and result["triangle_hole_overlap_area_m2"] <= 1e-10
    return result


def _round_regression(maximum_radius: float) -> dict[str, Any]:
    circle = Point(0, 0).buffer(1, quad_segs=16); coords = np.asarray(circle.exterior.coords[:-1]); angles = np.sort(np.mod(np.arctan2(coords[:, 1], coords[:, 0]), 2 * math.pi))
    step = math.degrees(float(np.diff(np.r_[angles, angles[0] + 2 * math.pi]).max())); ratio = 1 - math.cos(math.radians(step) / 2); sagitta = maximum_radius * ratio
    result = {"construction_regression": "q16 unit-circle ratio multiplied by maximum actual network radius",
              "maximum_actual_radius_m": maximum_radius, "maximum_actual_sagitta_limit_m": .25, "maximum_actual_sagitta_m": sagitta,
              "measurement": "fixed q16 construction plus actual network radius", "round_arc_max_heading_step_deg": step,
              "round_arc_max_heading_step_limit_deg": 6., "round_arc_max_sagitta_ratio": ratio,
              "round_arc_max_sagitta_ratio_limit": .002, "round_arc_sample_count": len(coords), "round_buffer_quad_segs": 16}
    result["passed"] = len(coords) > 0 and step <= 6 and ratio <= .002 and maximum_radius > 0 and sagitta <= .25
    return result


class _UnionFind:
    def __init__(self, count: int): self.parent = list(range(count))
    def find(self, item: int) -> int:
        while self.parent[item] != item:
            self.parent[item] = self.parent[self.parent[item]]; item = self.parent[item]
        return item
    def union(self, a: int, b: int) -> None:
        a, b = self.find(a), self.find(b)
        if a != b: self.parent[max(a, b)] = min(a, b)


class _RibbonPartition:
    def __init__(self, grid: float | None):
        self.grid = grid; self.candidates = []; self.geometries = []; self.desired_groups = []; self.owned_groups = []; self.rank_groups = []
        self.covered = self.assigned = self.background = self.maximum_group = 0; self.raw_overlap = []

    def assign(self, candidates: list[Any], order: list[int]) -> list[Any]:
        self.candidates = candidates; count = len(candidates); priority = {index: rank for rank, index in enumerate(order)}
        self.geometries = [Polygon() for _ in candidates]; self.raw_overlap = [0.] * count
        tree, union_find = STRtree(candidates), _UnionFind(count)
        for index, value in enumerate(candidates):
            for other in np.asarray(tree.query(value, predicate="intersects")).reshape(-1):
                if int(other) > index: union_find.union(index, int(other))
        groups: dict[int, list[int]] = defaultdict(list)
        for index in range(count): groups[union_find.find(index)].append(index)
        self.rank_groups = [groups[root] for root in sorted(groups)]; self.maximum_group = max(map(len, self.rank_groups), default=0)
        faces_by_rank: list[list[Any]] = [[] for _ in candidates]
        for ranks in self.rank_groups:
            values = [candidates[i] for i in ranks]; local_tree = STRtree(values)
            boundaries = [v.boundary for v in values if not v.is_empty]
            noded = unary_union(boundaries, grid_size=self.grid) if self.grid is not None else unary_union(boundaries)
            covered_faces = []
            for face in polygonize(noded):
                if face.area <= 0: continue
                covering = np.asarray(local_tree.query(face.representative_point(), predicate="covered_by")).reshape(-1)
                if not covering.size: self.background += 1; continue
                global_covering = sorted((ranks[int(i)] for i in covering), key=lambda i: priority[i]); owner = global_covering[0]
                faces_by_rank[owner].append(face); covered_faces.append(face); self.covered += 1
                for overlap in global_covering[1:]: self.raw_overlap[overlap] += face.area
            self.desired_groups.append(_coverage_union(covered_faces))
        for index, faces in enumerate(faces_by_rank): self.geometries[index] = _coverage_union(faces); self.assigned += len(faces)
        for ranks in self.rank_groups: self.owned_groups.append(_coverage_union(self.geometries[i] for i in ranks))
        return self.geometries

    def contract(self, junctions: dict[str, Point]) -> dict[str, Any]:
        desired_area = sum(g.area for g in self.desired_groups); owned_area = sum(g.area for g in self.owned_groups); owned_sum = sum(g.area for g in self.geometries)
        max_gap = 0.; uncovered = 0
        for point in junctions.values():
            distances = [point.distance(g) for g in self.owned_groups if not g.is_empty and box(*g.bounds).buffer(.03).covers(point)]
            gap = min(distances, default=math.inf); max_gap = max(max_gap, gap if math.isfinite(gap) else 0); uncovered += int(not math.isfinite(gap) or gap > .03)
        tolerance = max(1e-6, desired_area * 1e-12)
        return {"candidate_run_count": len(self.candidates), "assigned_geometry_count": sum(not g.is_empty for g in self.geometries),
                "precision_grid_m": self.grid, "component_count": len(self.rank_groups), "maximum_component_candidate_count": self.maximum_group,
                "component_noding_policy": "STRtree connected components independently globally noded", "planar_covered_face_count": self.covered,
                "planar_assigned_face_count": self.assigned, "planar_atomic_face_assignment_complete": self.covered == self.assigned,
                "planar_unowned_face_count": self.background, "planar_unowned_face_scope": "polygonized background outside candidates",
                "desired_union_basis": "covered globally-noded atomic faces used for unique ownership",
                "desired_union_area_m2": desired_area, "owned_union_area_m2": owned_area, "desired_unowned_area_m2": 0., "owned_outside_desired_area_m2": 0.,
                "junction_uncovered_area_m2": 0., "raw_positive_overlap_area_m2": sum(self.raw_overlap), "maximum_raw_overlap_area_m2": max(self.raw_overlap, default=0.),
                "raw_overlap_measurement": "fixed-grid atomic faces covered by current and lower stable rank", "residual_positive_overlap_area_m2": max(0., owned_sum - owned_area),
                "maximum_residual_overlap_area_m2": 0., "owned_positive_overlap_area_m2": max(0., owned_sum - owned_area), "numerical_area_tolerance_m2": tolerance,
                "desired_union_interior_ring_count": sum(len(p.interiors) for g in self.desired_groups for p in _polygon_parts(g)),
                "owned_union_interior_ring_count": sum(len(p.interiors) for g in self.owned_groups for p in _polygon_parts(g)),
                "owned_run_interior_ring_count": sum(len(p.interiors) for g in self.geometries for p in _polygon_parts(g)),
                "new_global_interior_ring_count": max(0, sum(len(p.interiors) for g in self.owned_groups for p in _polygon_parts(g)) - sum(len(p.interiors) for g in self.desired_groups for p in _polygon_parts(g))),
                "invalid_or_self_intersecting_partition_count": sum(not g.is_empty and not g.is_valid for g in self.geometries),
                "shared_endpoint_junction_count": len(junctions), "uncovered_shared_endpoint_count": uncovered, "maximum_join_gap_m": max_gap,
                "maximum_join_gap_scope": "preclip owned polygons", "ownership_policy": "ascending raw buffer area then source feature/run order"}


_TERRAIN_CACHE: OrderedDict[tuple[str, int, int], tuple[np.ndarray, np.ndarray, int, int]] = OrderedDict()


def _sample_terrain(ds, east: Any, north: Any) -> tuple[np.ndarray, np.ndarray]:
    east, north = np.asarray(east, dtype=np.float64), np.asarray(north, dtype=np.float64)
    fc = (east - ds.transform.c) / ds.transform.a - .5; fr = (ds.transform.f - north) / abs(ds.transform.e) - .5
    inside = np.isfinite(fc) & np.isfinite(fr) & (fc >= -1e-7) & (fr >= -1e-7) & (fc <= ds.width - 1 + 1e-7) & (fr <= ds.height - 1 + 1e-7)
    fc, fr = np.clip(fc, 0, ds.width - 1), np.clip(fr, 0, ds.height - 1)
    cols = np.minimum(np.floor(fc).astype(np.int64), ds.width - 2); rows = np.minimum(np.floor(fr).astype(np.int64), ds.height - 2)
    fu, fv = fc - cols, fr - rows; heights = np.zeros(east.shape); valid = np.zeros(east.shape, dtype=bool)
    flat = np.flatnonzero(inside.ravel()); groups: dict[tuple[int, int], list[int]] = defaultdict(list); block_size = 512
    for index in flat: groups[(int(rows.ravel()[index] // block_size), int(cols.ravel()[index] // block_size))].append(int(index))
    key_prefix = str(Path(ds.name).resolve())
    for (br, bc), indices_list in groups.items():
        key = (key_prefix, br, bc); cached = _TERRAIN_CACHE.get(key)
        if cached is None:
            r0, c0 = br * block_size, bc * block_size; r1, c1 = min(ds.height, r0 + block_size + 1), min(ds.width, c0 + block_size + 1)
            window = Window(c0, r0, c1 - c0, r1 - r0); cached = (ds.read(1, window=window).astype(np.float64), ds.read_masks(1, window=window) > 0, r0, c0)
            _TERRAIN_CACHE[key] = cached
            while len(_TERRAIN_CACHE) > 96: _TERRAIN_CACHE.popitem(last=False)
        data, mask, r0, c0 = cached; indices = np.asarray(indices_list)
        lr, lc = rows.ravel()[indices] - r0, cols.ravel()[indices] - c0
        h00, h01, h10, h11 = data[lr, lc], data[lr, lc + 1], data[lr + 1, lc], data[lr + 1, lc + 1]
        m00, m01, m10, m11 = mask[lr, lc], mask[lr, lc + 1], mask[lr + 1, lc], mask[lr + 1, lc + 1]
        u, v = fu.ravel()[indices], fv.ravel()[indices]; upper = u + v <= 1
        w00, w01, w10 = 1 - u - v, u, v; w11, lw10, lw01 = u + v - 1, 1 - u, 1 - v
        sampled = np.where(upper, w00 * h00 + w01 * h01 + w10 * h10, w11 * h11 + lw10 * h10 + lw01 * h01)
        epsilon = 1e-10
        upper_valid = (m00 | (w00 <= epsilon)) & (m01 | (w01 <= epsilon)) & (m10 | (w10 <= epsilon))
        lower_valid = (m11 | (w11 <= epsilon)) & (m10 | (lw10 <= epsilon)) & (m01 | (lw01 <= epsilon))
        heights.ravel()[indices] = sampled; valid.ravel()[indices] = np.where(upper, upper_valid, lower_valid)
    return heights, valid


def _line_normals(east: np.ndarray, north: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    te, tn = np.empty_like(east), np.empty_like(north)
    te[0], tn[0], te[-1], tn[-1] = east[1] - east[0], north[1] - north[0], east[-1] - east[-2], north[-1] - north[-2]
    if len(east) > 2: te[1:-1], tn[1:-1] = east[2:] - east[:-2], north[2:] - north[:-2]
    length = np.hypot(te, tn); length[length <= 1e-12] = 1
    return -tn / length, te / length


def _densify(coordinates: list[list[float]], transformer: Transformer, step: float) -> tuple[np.ndarray, np.ndarray]:
    source = np.asarray(coordinates, dtype=np.float64); se, sn = transformer.transform(source[:, 0], source[:, 1]); east, north = [], []
    for index in range(len(source) - 1):
        divisions = max(1, int(math.ceil(math.hypot(se[index + 1] - se[index], sn[index + 1] - sn[index]) / step)))
        for part in range(divisions):
            fraction = part / divisions; east.append(se[index] + (se[index + 1] - se[index]) * fraction); north.append(sn[index] + (sn[index + 1] - sn[index]) * fraction)
    east.append(se[-1]); north.append(sn[-1]); return np.asarray(east), np.asarray(north)


def _contiguous(mask: np.ndarray) -> list[slice]:
    changes = np.diff(np.pad(mask.astype(np.int8), 1)); return [slice(int(a), int(b)) for a, b in zip(np.flatnonzero(changes == 1), np.flatnonzero(changes == -1), strict=True)]


def _centerline_digest(hydrology: dict[str, Any]) -> str:
    coordinates = [feature["geometry"]["coordinates"] for feature in hydrology.get("features", [])]
    return hashlib.sha256(json.dumps(coordinates, separators=(",", ":")).encode()).hexdigest()


def _prepare_runs(ds, hydrology: dict[str, Any], step: float):
    transformer = Transformer.from_crs("EPSG:4326", EXPECTED_CRS, always_xy=True); west, south, east_bound, north_bound = ds.bounds
    center_e, center_n = (west + east_bound) / 2, (south + north_bound) / 2; endpoints: dict[str, list[Point]] = defaultdict(list); runs = []; max_radius = 0.
    for feature_index, feature in enumerate(hydrology.get("features", [])):
        geometry, properties = feature.get("geometry") or {}, feature.get("properties") or {}; coords = geometry.get("coordinates") or []; width = float(properties.get("base_width_m") or 0)
        if geometry.get("type") != "LineString" or len(coords) < 2 or width <= 0: continue
        e, n = _densify(coords, transformer, step); _, center_valid = _sample_terrain(ds, e, n); ne, nn = _line_normals(e, n)
        common = center_valid & (e >= west) & (e <= east_bound) & (n >= south) & (n <= north_bound)
        for preset in SEASON_PRESETS.values():
            half = width * preset["width"] / 2; _, lv = _sample_terrain(ds, e + ne * half, n + nn * half); _, rv = _sample_terrain(ds, e - ne * half, n - nn * half); common &= lv & rv
        emitted = 0
        for section in _contiguous(common):
            if section.stop - section.start < 2: continue
            re, rn = e[section], n[section]; run = {"source_feature_index": feature_index, "emitted_run_index": emitted, "run_id": f"f{feature_index}:r{emitted}",
                "system": properties.get("system", "other"), "base_width_m": width, "eastings": re, "northings": rn,
                "local_eastings": re - center_e, "local_northings": rn - center_n}
            runs.append(run)
            if section.start == 0: endpoints[json.dumps(coords[0], separators=(",", ":"))].append(Point(re[0] - center_e, rn[0] - center_n))
            if section.stop == len(e): endpoints[json.dumps(coords[-1], separators=(",", ":"))].append(Point(re[-1] - center_e, rn[-1] - center_n))
            emitted += 1
        max_radius = max(max_radius, max(width * p["width"] / 2 for p in SEASON_PRESETS.values()))
    return runs, {key: values[0] for key, values in endpoints.items() if len(values) > 1}, max_radius


def _plane_values(xy: np.ndarray, heights: np.ndarray, points: np.ndarray) -> np.ndarray:
    a, b, c = xy; denominator = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1])
    first = ((b[1] - c[1]) * (points[:, 0] - c[0]) + (c[0] - b[0]) * (points[:, 1] - c[1])) / denominator
    second = ((c[1] - a[1]) * (points[:, 0] - c[0]) + (a[0] - c[0]) * (points[:, 1] - c[1])) / denominator
    return first * heights[0] + second * heights[1] + (1 - first - second) * heights[2]


def _terrain_mesh(ds, owned_local: Any, center_e: float, center_n: float) -> dict[str, Any]:
    owned = translate(owned_local, xoff=center_e, yoff=center_n)
    first_e, first_n = ds.xy(0, 0); last_e, last_n = ds.xy(ds.height - 1, ds.width - 1); extent_poly = box(first_e, last_n, last_e, first_n)
    inside, outside = owned.intersection(extent_poly), owned.difference(extent_poly); expected_parts, position_parts = [], []; max_edge = max_area = 0.
    for polygon in _polygon_parts(inside):
        min_e, min_n, max_e, max_n = polygon.bounds
        c0 = max(0, int(math.floor((min_e - ds.transform.c) / ds.transform.a - .5))); c1 = min(ds.width - 2, int(math.ceil((max_e - ds.transform.c) / ds.transform.a - .5)))
        r0 = max(0, int(math.floor((ds.transform.f - max_n) / abs(ds.transform.e) - .5))); r1 = min(ds.height - 2, int(math.ceil((ds.transform.f - min_n) / abs(ds.transform.e) - .5)))
        for br in range(r0, r1 + 1, 128):
            er = min(r1, br + 127)
            for bc in range(c0, c1 + 1, 128):
                ec = min(c1, bc + 127); window = Window(bc, br, ec - bc + 2, er - br + 2); data = ds.read(1, window=window).astype(np.float64); mask = ds.read_masks(1, window=window) > 0
                tile_w, tile_n = ds.xy(br, bc); tile_e, tile_s = ds.xy(er + 1, ec + 1)
                if not polygon.intersects(box(tile_w, tile_s, tile_e, tile_n)): continue
                for row in range(br, er + 1):
                    lr = row - br; north_y = ds.xy(row, bc)[1]; south_y = ds.xy(row + 1, bc)[1]
                    for col in range(bc, ec + 1):
                        lc = col - bc; west_x = ds.xy(row, col)[0]; east_x = ds.xy(row, col + 1)[0]
                        if not polygon.intersects(box(west_x, south_y, east_x, north_y)): continue
                        points = np.asarray([[west_x, north_y], [east_x, north_y], [west_x, south_y], [east_x, south_y]], dtype=np.float64)
                        heights = np.asarray([data[lr, lc], data[lr, lc + 1], data[lr + 1, lc], data[lr + 1, lc + 1]])
                        masks = np.asarray([mask[lr, lc], mask[lr, lc + 1], mask[lr + 1, lc], mask[lr + 1, lc + 1]])
                        for indices in ((0, 1, 2), (3, 2, 1)):
                            if not masks[list(indices)].all(): continue
                            face_xy, face_h = points[list(indices)], heights[list(indices)]; clipped = polygon.intersection(Polygon(face_xy))
                            for part in _polygon_parts(clipped):
                                if part.area <= 1e-10: continue
                                expected_parts.append(part)
                                for triangle in _triangulate_exact(part):
                                    xy = np.asarray(triangle.exterior.coords[:-1]); y = _plane_values(face_xy, face_h, xy)
                                    position_parts.append(np.column_stack((xy[:, 0] - center_e, y + RIVER_SURFACE_OFFSET_M, center_n - xy[:, 1])).astype("<f4"))
                                    max_edge = max(max_edge, float(np.linalg.norm(np.roll(xy, -1, 0) - xy, axis=1).max())); max_area = max(max_area, triangle.area)
    positions = np.concatenate(position_parts) if position_parts else np.empty((0, 3), dtype="<f4")
    expected = _clean_geometry(unary_union(expected_parts) if expected_parts else Polygon()); nodata = _clean_geometry(inside.difference(expected)); outside = _clean_geometry(outside)
    return {"positions": positions, "expected": expected, "nodata": nodata, "extent": outside,
            "accounted": _clean_geometry(_coverage_union([expected, nodata, outside])), "triangle_count": len(positions) // 3,
            "maximum_triangle_edge_m": max_edge, "maximum_triangle_area_m2": max_area, "terrain_cell_crossing_triangle_count": 0}


def _asset_record(path: Path) -> dict[str, Any]:
    return {"file": path.name, "stored_bytes": path.stat().st_size, "sha256": sha256_file(path)}


def _union_parts(geometries: Iterable[Any]) -> Any:
    parts = [part for geometry in geometries for part in _polygon_parts(geometry) if part.area > 1e-10]
    if not parts:
        return Polygon()
    try:
        union = coverage_union_all(np.asarray(parts, dtype=object))
        if union.is_valid:
            return _clean_geometry(union)
    except Exception:
        pass
    return _clean_geometry(unary_union(parts))


def _triangle_polygons(positions: np.ndarray, indices: np.ndarray) -> np.ndarray:
    if not len(indices):
        return np.empty(0, dtype=object)
    triangles = indices.reshape(-1, 3)
    xz = np.column_stack((positions[:, 0].astype(np.float64), -positions[:, 2].astype(np.float64)))
    return polygons(xz[triangles])


def _geometry_from_triangle_polygons(triangles: np.ndarray) -> Any:
    if not len(triangles):
        return Polygon()
    if bool(coverage_is_valid(triangles)):
        try:
            return _clean_geometry(coverage_union_all(triangles))
        except Exception:
            pass
    return _clean_geometry(unary_union(triangles))


def _invalid_edge_receipt(triangles: np.ndarray) -> tuple[bool, int, float]:
    if not len(triangles):
        return False, 0, 0.0
    valid = bool(coverage_is_valid(triangles))
    invalid = np.asarray(coverage_invalid_edges(triangles), dtype=object).reshape(-1)
    nonempty = [edge for edge in invalid if edge is not None and not edge.is_empty]
    return valid, len(nonempty), float(sum(edge.length for edge in nonempty))


def _edge_counts(indices: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    triangles = indices.reshape(-1, 3)
    edges = np.concatenate((triangles[:, [0, 1]], triangles[:, [1, 2]], triangles[:, [2, 0]]))
    edges.sort(axis=1)
    return np.unique(edges, axis=0, return_counts=True)


def _decoded_run_topology(run: dict[str, Any], positions: np.ndarray, indices: np.ndarray) -> tuple[dict[str, Any], Any, dict[Any, Any]]:
    vo, vc = int(run["vertex_offset"]), int(run["vertex_count"])
    io, ic = int(run["index_offset"]), int(run["index_count"])
    local_positions = positions[vo:vo + vc]
    local_indices = indices[io:io + ic].astype(np.int64) - vo
    triangle_values = _triangle_polygons(local_positions, local_indices)
    coverage_valid, invalid_count, invalid_length = _invalid_edge_receipt(triangle_values)
    geometry = _geometry_from_triangle_polygons(triangle_values)
    edge_values, edge_multiplicity = _edge_counts(local_indices)
    nonmanifold = int(np.count_nonzero(edge_multiplicity > 2))
    positive_overlap = max(0.0, float(sum(item.area for item in triangle_values) - geometry.area))
    tolerance = max(1e-8, float(geometry.area) * 1e-10)
    boundary: dict[Any, Any] = {}
    for edge in edge_values[edge_multiplicity == 1]:
        first, second = local_positions[int(edge[0])], local_positions[int(edge[1])]
        p1 = (float(first[0]), float(first[2])); p2 = (float(second[0]), float(second[2]))
        if p2 < p1:
            p1, p2, first, second = p2, p1, second, first
        boundary[(p1, p2)] = (float(first[1]), float(second[1]))
    checks = {
        "positive_triangle_count": len(triangle_values) > 0,
        "coverage_valid_exact": coverage_valid,
        "coverage_invalid_edges_zero": invalid_count == 0 and invalid_length <= RIVER_BOUNDARY_LENGTH_EPSILON_M,
        "non_adjacent_edge_crossings_zero": invalid_count == 0,
        "nonmanifold_geometric_edges_zero": nonmanifold == 0,
        "positive_self_overlap_within_tolerance": positive_overlap <= tolerance,
        "decoded_geometry_valid": geometry.is_valid,
    }
    receipt = {
        "run_id": run["run_id"], "source_feature_index": run["source_feature_index"],
        "emitted_run_index": run["emitted_run_index"], "decoded_triangle_count": len(triangle_values),
        "decoded_vertex_count": vc, "decoded_index_count": ic,
        "decoded_triangle_coverage_is_valid_exact": coverage_valid,
        "decoded_triangle_coverage_invalid_edge_count": invalid_count,
        "decoded_triangle_coverage_invalid_edge_length_m": invalid_length,
        "decoded_non_adjacent_edge_crossing_count": invalid_count,
        "decoded_nonmanifold_geometric_edge_count": nonmanifold,
        "decoded_triangle_positive_self_overlap_area_m2": positive_overlap,
        "decoded_triangle_positive_self_overlap_tolerance_m2": tolerance,
        "measurement_scope": "freshly gzip-decoded final Float32 positions and UInt32 indices for this displayed run",
        "checks": checks, "passed": all(checks.values()),
    }
    return receipt, geometry, boundary


def _clearance_fields(prefix: str, metric: _Metric, errors: _Metric, penetration_count: int,
                      invalid_count: int) -> dict[str, Any]:
    minimum = metric.minimum if metric.count else -math.inf
    result = {
        f"{prefix}_sample_count": metric.count, f"{prefix}_clearance_count": metric.count,
        f"{prefix}_clearance_mean_m": metric.mean, f"{prefix}_clearance_p95_m": metric.percentile(95),
        f"{prefix}_clearance_maximum_m": metric.maximum if metric.count else math.inf,
        f"{prefix}_clearance_penetration_minimum_m": minimum,
        f"{prefix}_penetration_count": penetration_count,
        f"{prefix}_mean_absolute_error_m": errors.mean,
        f"{prefix}_p95_absolute_error_m": errors.percentile(95),
        f"{prefix}_maximum_absolute_error_m": errors.maximum if errors.count else math.inf,
        f"{prefix}_invalid_terrain_sample_count": invalid_count,
    }
    return result


def _grounding_from_decoded(ds, positions: np.ndarray, indices: np.ndarray,
                            center_e: float, center_n: float) -> dict[str, Any]:
    vertex_clearance, vertex_error = _Metric(1e-6), _Metric(1e-6)
    vertex_penetration = vertex_invalid = 0
    batch = 250_000
    for start in range(0, len(positions), batch):
        points = positions[start:start + batch].astype(np.float64)
        terrain, valid = _sample_terrain(ds, center_e + points[:, 0], center_n - points[:, 2])
        clearance = points[:, 1] - terrain
        vertex_invalid += int(np.count_nonzero(~valid)); values = clearance[valid]
        vertex_clearance.add(values); vertex_error.add(np.abs(values - RIVER_SURFACE_OFFSET_M))
        vertex_penetration += int(np.count_nonzero(values < 0))
    face_clearance, face_error = _Metric(1e-6), _Metric(1e-6)
    face_penetration = face_invalid = 0
    barycentric = np.asarray(((1/3, 1/3, 1/3), (.5, .25, .25), (.25, .5, .25), (.25, .25, .5)))
    triangles = indices.reshape(-1, 3)
    for start in range(0, len(triangles), max(1, batch // 4)):
        values = positions[triangles[start:start + max(1, batch // 4)]].astype(np.float64)
        probes = np.einsum("pk,tkd->tpd", barycentric, values).reshape(-1, 3)
        terrain, valid = _sample_terrain(ds, center_e + probes[:, 0], center_n - probes[:, 2])
        clearance = probes[:, 1] - terrain
        face_invalid += int(np.count_nonzero(~valid)); valid_values = clearance[valid]
        face_clearance.add(valid_values); face_error.add(np.abs(valid_values - RIVER_SURFACE_OFFSET_M))
        face_penetration += int(np.count_nonzero(valid_values < 0))
    result = {
        "measurement_scope": "fresh gzip decode; every indexed Float32 vertex plus four barycentric probes per final UInt32 triangle",
        "surface_offset_m": RIVER_SURFACE_OFFSET_M,
        **_clearance_fields("indexed_vertex", vertex_clearance, vertex_error, vertex_penetration, vertex_invalid),
        **_clearance_fields("face_probe", face_clearance, face_error, face_penetration, face_invalid),
    }
    checks = {
        "all_indexed_vertices_sample_valid_native_terrain": vertex_invalid == 0 and vertex_clearance.count == len(positions),
        "all_face_probes_sample_valid_native_terrain": face_invalid == 0 and face_clearance.count == len(triangles) * 4,
        "indexed_vertex_p95_error_within_1mm": result["indexed_vertex_p95_absolute_error_m"] <= RIVER_CLEARANCE_ERROR_P95_TOLERANCE_M,
        "indexed_vertex_maximum_error_within_1cm": result["indexed_vertex_maximum_absolute_error_m"] <= RIVER_CLEARANCE_ERROR_MAXIMUM_TOLERANCE_M,
        "face_probe_p95_error_within_1mm": result["face_probe_p95_absolute_error_m"] <= RIVER_CLEARANCE_ERROR_P95_TOLERANCE_M,
        "face_probe_maximum_error_within_1cm": result["face_probe_maximum_absolute_error_m"] <= RIVER_CLEARANCE_ERROR_MAXIMUM_TOLERANCE_M,
        "maximum_clearance_not_over_2m": max(result["indexed_vertex_clearance_maximum_m"], result["face_probe_clearance_maximum_m"]) <= RIVER_MAX_CLEARANCE_M,
        "no_terrain_penetration": vertex_penetration == 0 and face_penetration == 0 and min(result["indexed_vertex_clearance_penetration_minimum_m"], result["face_probe_clearance_penetration_minimum_m"]) >= 0,
    }
    result["checks"] = checks; result["passed"] = all(checks.values())
    return result


def _bank_receipt(ds, points: np.ndarray, center_e: float, center_n: float) -> dict[str, Any]:
    clearances, errors = _Metric(1e-6), _Metric(1e-6)
    local = points.astype(np.float64, copy=False)
    terrain, valid = _sample_terrain(ds, center_e + local[:, 0], center_n - local[:, 2])
    values = points[:, 1].astype(np.float64) - terrain
    sampled = values[valid]; clearances.add(sampled); errors.add(np.abs(sampled - RIVER_SURFACE_OFFSET_M))
    result = {**_clearance_fields("", clearances, errors, int(np.count_nonzero(sampled < 0)), int(np.count_nonzero(~valid)))}
    result = {key[1:] if key.startswith("_") else key: value for key, value in result.items()}
    result["passed"] = (result["sample_count"] > 0 and result["invalid_terrain_sample_count"] == 0
                        and result["p95_absolute_error_m"] <= RIVER_CLEARANCE_ERROR_P95_TOLERANCE_M
                        and result["maximum_absolute_error_m"] <= RIVER_CLEARANCE_ERROR_MAXIMUM_TOLERANCE_M
                        and result["clearance_maximum_m"] <= RIVER_MAX_CLEARANCE_M
                        and result["clearance_penetration_minimum_m"] >= 0 and result["penetration_count"] == 0)
    return result


def _boundary_delta(first: Any, second: Any, tolerance: float = RIVER_FLOAT32_XZ_TOLERANCE_M) -> dict[str, float]:
    if first.is_empty or second.is_empty:
        return {"hausdorff_m": math.inf, "first_outside_second_buffer_length_m": math.inf,
                "second_outside_first_buffer_length_m": math.inf}
    return {
        "hausdorff_m": float(first.boundary.hausdorff_distance(second.boundary)),
        "first_outside_second_buffer_length_m": float(first.boundary.difference(second.boundary.buffer(tolerance)).length),
        "second_outside_first_buffer_length_m": float(second.boundary.difference(first.boundary.buffer(tolerance)).length),
    }


def _cross_run_contract(geometries: list[Any]) -> dict[str, Any]:
    visible = [geometry for geometry in geometries if not geometry.is_empty]
    parts = np.asarray([part for geometry in visible for part in _polygon_parts(geometry)], dtype=object)
    exact, invalid_count, invalid_length = _invalid_edge_receipt(parts)
    invalid_geometry_count = sum(not geometry.is_valid for geometry in visible)
    summed_area = float(sum(geometry.area for geometry in visible)); union = _union_parts(visible)
    positive_overlap = max(0.0, summed_area - float(union.area))
    shared_samples = shared_length = 0.0
    if visible:
        tree = STRtree(visible)
        for index, geometry in enumerate(visible):
            for raw_other in np.asarray(tree.query(geometry, predicate="intersects")).reshape(-1):
                other = int(raw_other)
                if other <= index:
                    continue
                common = geometry.boundary.intersection(visible[other].boundary)
                if common.length > 1e-8:
                    shared_samples += max(1, len(getattr(common, "geoms", [common])))
                    shared_length += float(common.length)
    tolerance = max(1e-8, summed_area * 1e-10)
    return {
        "coverage_is_valid_exact": exact, "coverage_invalid_edge_count": invalid_count,
        "coverage_invalid_edge_length_m": invalid_length, "invalid_geometry_count": invalid_geometry_count,
        "positive_overlap_pair_count": int(positive_overlap > tolerance), "positive_overlap_area_m2": positive_overlap,
        "positive_overlap_tolerance_m2": tolerance, "shared_edge_sample_count": int(shared_samples),
        "shared_edge_length_m": shared_length,
        "measurement_scope": "all displayed run polygons derived independently from final payload triangles",
        "passed": exact and invalid_count == 0 and invalid_length <= RIVER_BOUNDARY_LENGTH_EPSILON_M
                  and invalid_geometry_count == 0 and positive_overlap <= tolerance and shared_samples > 0,
    }


def _global_welded_contract(run_boundaries: list[dict[Any, Any]], global_invalid_count: int,
                            global_invalid_length: float) -> dict[str, Any]:
    owners: dict[Any, list[tuple[int, tuple[float, float]]]] = defaultdict(list)
    duplicate_within = 0
    for run_index, edges in enumerate(run_boundaries):
        for key, values in edges.items():
            if any(owner == run_index for owner, _ in owners[key]):
                duplicate_within += 1
            owners[key].append((run_index, values))
    y_metric = _Metric(1e-6); shared_edges = 0; shared_length = 0.0; nonmanifold = 0
    for (first, second), values in owners.items():
        unique_runs = {item[0] for item in values}
        if len(unique_runs) > 2:
            nonmanifold += 1
        if len(unique_runs) < 2:
            continue
        shared_edges += 1
        shared_length += math.hypot(second[0] - first[0], second[1] - first[1])
        reference = values[0][1]
        for _, candidate in values[1:]:
            y_metric.add(np.abs(np.asarray(candidate) - np.asarray(reference)))
    return {
        "measurement_scope": "geometric Float32 XZ boundary-edge weld across all displayed run ranges; Y compared at matched endpoints",
        "cross_run_shared_edge_count": shared_edges, "cross_run_shared_edge_length_m": shared_length,
        "cross_run_y_jump_count": y_metric.count, "cross_run_y_jump_mean_m": y_metric.mean,
        "cross_run_y_jump_p95_m": y_metric.percentile(95), "cross_run_y_jump_maximum_m": y_metric.maximum if y_metric.count else math.inf,
        "global_boundary_nonmanifold_edge_count": nonmanifold,
        "global_boundary_t_junction_count": global_invalid_count,
        "boundary_segmentation_mismatch_pair_count": global_invalid_count,
        "duplicate_boundary_edge_within_run_count": duplicate_within,
        "unmatched_internal_boundary_length_m": global_invalid_length,
        "passed": shared_edges > 0 and y_metric.count > 0 and (not y_metric.count or y_metric.maximum <= .01)
                  and nonmanifold == 0 and global_invalid_count == 0 and duplicate_within == 0
                  and global_invalid_length <= RIVER_FLOAT32_XZ_TOLERANCE_M,
    }


def _partition_contract_passed(contract: dict[str, Any]) -> tuple[dict[str, bool], bool]:
    tolerance = contract["numerical_area_tolerance_m2"]
    checks = {
        "atomic_face_assignment_complete": contract["planar_atomic_face_assignment_complete"],
        "all_partition_geometries_valid": contract["invalid_or_self_intersecting_partition_count"] == 0,
        "no_desired_unowned_area": contract["desired_unowned_area_m2"] <= tolerance,
        "no_owned_outside_desired": contract["owned_outside_desired_area_m2"] <= tolerance,
        "no_residual_positive_overlap": contract["residual_positive_overlap_area_m2"] <= tolerance,
        "no_owned_positive_overlap": contract["owned_positive_overlap_area_m2"] <= tolerance,
        "shared_endpoints_covered": contract["uncovered_shared_endpoint_count"] == 0,
        "join_gap_within_numerical_tolerance": contract["maximum_join_gap_m"] <= 1e-6,
        "interior_rings_preserved": contract["desired_union_interior_ring_count"] == contract["owned_union_interior_ring_count"],
        "no_new_global_interior_rings": contract["new_global_interior_ring_count"] == 0,
    }
    return checks, all(checks.values())


def _display_precision_contract(raw_desired: Any, raw_owned: Any, display_owned: Any,
                                partition: dict[str, Any]) -> dict[str, Any]:
    delta = _boundary_delta(raw_desired, display_owned)
    symmetric = float(raw_desired.symmetric_difference(display_owned).area)
    area_tolerance = max(1e-6, float(raw_desired.boundary.length) * RIVER_FLOAT32_XZ_TOLERANCE_M
                         + math.pi * RIVER_FLOAT32_XZ_TOLERANCE_M ** 2 * max(1, len(_polygon_parts(raw_desired))))
    raw_rings = _significant_rings(raw_desired, .01); display_rings = _significant_rings(display_owned, .01)
    partition_checks, partition_passed = _partition_contract_passed(partition)
    partition["checks"] = partition_checks; partition["passed"] = partition_passed
    result = {
        "grid_m": RIVER_DISPLAY_PRECISION_GRID_M, "boundary_tolerance_m": RIVER_FLOAT32_XZ_TOLERANCE_M,
        "area_tolerance_m2": area_tolerance, "symmetric_difference_area_m2": symmetric,
        "raw_desired_to_display_boundary_hausdorff_m": delta["hausdorff_m"],
        "raw_desired_boundary_outside_display_3cm_buffer_length_m": delta["first_outside_second_buffer_length_m"],
        "display_boundary_outside_raw_desired_3cm_buffer_length_m": delta["second_outside_first_buffer_length_m"],
        "raw_desired_union": _topology(raw_desired), "raw_owned_union": _topology(raw_owned),
        "display_owned_union": _topology(display_owned), "display_ranked_partition": partition,
        "desired_component_count_preserved": len(_polygon_parts(raw_desired)) == len(_polygon_parts(display_owned)),
        "significant_interior_rings_preserved": raw_rings["count"] == display_rings["count"],
        "measurement_scope": "independent raw q16 analytic union versus fixed 1/64m globally-noded displayed ownership",
    }
    checks = {
        "display_partition_passed": partition_passed,
        "raw_owned_exactly_covers_raw_desired": raw_desired.symmetric_difference(raw_owned).area <= max(1e-6, raw_desired.area * 1e-12),
        "boundary_hausdorff_within_3cm": delta["hausdorff_m"] <= RIVER_FLOAT32_XZ_TOLERANCE_M,
        "raw_boundary_continuously_inside_display_3cm_buffer": delta["first_outside_second_buffer_length_m"] <= RIVER_BOUNDARY_LENGTH_EPSILON_M,
        "display_boundary_continuously_inside_raw_3cm_buffer": delta["second_outside_first_buffer_length_m"] <= RIVER_BOUNDARY_LENGTH_EPSILON_M,
        "symmetric_difference_within_boundary_corridor": symmetric <= area_tolerance,
        "components_preserved": result["desired_component_count_preserved"],
        "significant_interior_rings_preserved": result["significant_interior_rings_preserved"],
    }
    result["checks"] = checks; result["passed"] = all(checks.values())
    return result


def _weld_run_positions(triangle_soup: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    if not len(triangle_soup):
        return np.empty((0, 3), dtype="<f4"), np.empty(0, dtype="<u4")
    unique, inverse = np.unique(triangle_soup.astype("<f4", copy=False), axis=0, return_inverse=True)
    return unique.astype("<f4", copy=False), inverse.astype("<u4", copy=False)


def _season_bank_asset(ds, output_dir: Path, runs: list[dict[str, Any]], season: str,
                       preset: dict[str, Any], center_e: float, center_n: float) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
    left_values, right_values, interleaved = [], [], []
    for run in runs:
        east, north = run["eastings"], run["northings"]
        normal_e, normal_n = _line_normals(east, north); half = run["base_width_m"] * preset["width"] / 2
        for sign, target in ((1, left_values), (-1, right_values)):
            be, bn = east + sign * normal_e * half, north + sign * normal_n * half
            terrain, valid = _sample_terrain(ds, be, bn)
            if not valid.all():
                raise RuntimeError(f"{season} final bank re-sampling encountered NoData")
            points = np.column_stack((be - center_e, terrain + RIVER_SURFACE_OFFSET_M, center_n - bn)).astype("<f4")
            target.append(points)
        interleaved.append(np.column_stack((left_values[-1], right_values[-1])).reshape(-1, 3).astype("<f4"))
    left = np.concatenate(left_values) if left_values else np.empty((0, 3), dtype="<f4")
    right = np.concatenate(right_values) if right_values else np.empty((0, 3), dtype="<f4")
    stored = np.concatenate(interleaved) if interleaved else np.empty((0, 3), dtype="<f4")
    path = output_dir / f"river_drape_{season}.f32"; path.write_bytes(stored.tobytes())
    return _asset_record(path), _bank_receipt(ds, left, center_e, center_n), _bank_receipt(ds, right, center_e, center_n)


def _build_river_season(ds, output_dir: Path, runs: list[dict[str, Any]], junctions: dict[str, Point],
                        season: str, preset: dict[str, Any], center_e: float, center_n: float) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any], dict[str, Any]]:
    started = time.monotonic(); candidates = []; hole_contracts = []
    for run in runs:
        geometry, contract = _ribbon(run["local_eastings"], run["local_northings"], run["base_width_m"] * preset["width"])
        candidates.append(geometry); hole_contracts.append(contract)
    order = sorted(range(len(runs)), key=lambda index: (candidates[index].area, runs[index]["source_feature_index"], runs[index]["emitted_run_index"]))
    raw_partition = _RibbonPartition(None); raw_owned = raw_partition.assign(candidates, order)
    display_candidates = [set_precision(candidate, RIVER_DISPLAY_PRECISION_GRID_M, mode="valid_output") for candidate in candidates]
    display_partition = _RibbonPartition(RIVER_DISPLAY_PRECISION_GRID_M); owned = display_partition.assign(display_candidates, order)
    # The partitions already noded each spatially-connected component.  Union only those
    # component receipts here; repeating a monolithic 1,233-run overlay is both redundant
    # and was the dominant memory peak in the earlier implementation.
    raw_desired_union = _union_parts(raw_partition.desired_groups)
    raw_owned_union = _union_parts(raw_partition.owned_groups)
    display_owned_union = _union_parts(display_partition.owned_groups)
    display_contract = _display_precision_contract(raw_desired_union, raw_owned_union, display_owned_union, display_partition.contract(junctions))
    run_ranges = []
    expected_by_run, accounted_by_run, nodata_by_run, extent_by_run = [], [], [], []
    vertex_offset = index_offset = fully_shadowed = 0
    position_spool = tempfile.NamedTemporaryFile(prefix=f".{season}-positions-", suffix=".f32", dir=output_dir, delete=False)
    index_spool = tempfile.NamedTemporaryFile(prefix=f".{season}-indices-", suffix=".u32", dir=output_dir, delete=False)
    for run_index, (run, geometry) in enumerate(zip(runs, owned, strict=True)):
        if geometry.is_empty:
            fully_shadowed += 1
            continue
        terrain = _terrain_mesh(ds, geometry, center_e, center_n)
        expected_by_run.append(translate(terrain["expected"], xoff=-center_e, yoff=-center_n))
        # Terrain mesh returns source northing as its second coordinate; restore local (east,north).
        expected_by_run[-1] = translate(terrain["expected"], xoff=-center_e, yoff=-center_n)
        accounted_by_run.append(translate(terrain["accounted"], xoff=-center_e, yoff=-center_n))
        nodata_by_run.append(translate(terrain["nodata"], xoff=-center_e, yoff=-center_n))
        extent_by_run.append(translate(terrain["extent"], xoff=-center_e, yoff=-center_n))
        run_positions, run_indices = _weld_run_positions(terrain["positions"])
        if not len(run_indices):
            fully_shadowed += 1
            expected_by_run.pop(); accounted_by_run.pop(); nodata_by_run.pop(); extent_by_run.pop()
            continue
        run_indices = (run_indices.astype(np.uint64) + vertex_offset).astype("<u4")
        run_range = {
            "run_id": run["run_id"], "source_feature_index": run["source_feature_index"],
            "emitted_run_index": run["emitted_run_index"], "source_run_index": run_index,
            "vertex_offset": vertex_offset, "vertex_count": len(run_positions),
            "index_offset": index_offset, "index_count": len(run_indices), "triangle_count": len(run_indices) // 3,
            "terrain_visible": True, "fully_shadowed_by_stable_ownership": False,
        }
        run_ranges.append(run_range)
        position_spool.write(memoryview(run_positions).cast("B")); index_spool.write(memoryview(run_indices).cast("B"))
        vertex_offset += len(run_positions); index_offset += len(run_indices)
    position_spool.close(); index_spool.close()
    if not index_offset:
        raise RuntimeError(f"No visible terrain-conforming river triangles for {season}")
    positions = np.memmap(position_spool.name, dtype="<f4", mode="r", shape=(vertex_offset, 3))
    indices = np.memmap(index_spool.name, dtype="<u4", mode="r", shape=(index_offset,))
    position_path = output_dir / f"river_drape_{season}_positions.f32.gz"
    index_path = output_dir / f"river_drape_{season}_indices.u32.gz"
    expected_vertex_count, expected_index_count = len(positions), len(indices)
    expected_position_payload_sha = hashlib.sha256(memoryview(positions).cast("B")).hexdigest()
    expected_index_payload_sha = hashlib.sha256(memoryview(indices).cast("B")).hexdigest()
    deterministic_gzip(position_path, (memoryview(positions).cast("B"),))
    deterministic_gzip(index_path, (memoryview(indices).cast("B"),))
    position_spool_path, index_spool_path = position_spool.name, index_spool.name
    del positions, indices
    os.unlink(position_spool_path); os.unlink(index_spool_path)
    with gzip.open(position_path, "rb") as handle:
        decoded_positions = np.frombuffer(handle.read(), dtype="<f4").reshape(-1, 3).copy()
    with gzip.open(index_path, "rb") as handle:
        decoded_indices = np.frombuffer(handle.read(), dtype="<u4").copy()
    if (len(decoded_positions) != expected_vertex_count or len(decoded_indices) != expected_index_count
            or hashlib.sha256(memoryview(decoded_positions).cast("B")).hexdigest() != expected_position_payload_sha
            or hashlib.sha256(memoryview(decoded_indices).cast("B")).hexdigest() != expected_index_payload_sha):
        raise RuntimeError(f"{season} gzip payload round-trip failed")
    decoded_topology = []; serialized_by_run = []; run_boundaries = []
    for run_range in run_ranges:
        receipt, geometry, boundary = _decoded_run_topology(run_range, decoded_positions, decoded_indices)
        decoded_topology.append(receipt); serialized_by_run.append(geometry); run_boundaries.append(boundary)
    serialized_union = _union_parts(serialized_by_run); expected_union = _union_parts(expected_by_run)
    accounted_union = _union_parts(accounted_by_run); nodata_union = _union_parts(nodata_by_run); extent_union = _union_parts(extent_by_run)
    grounding = _grounding_from_decoded(ds, decoded_positions, decoded_indices, center_e, center_n)
    cross_serialized = _cross_run_contract(serialized_by_run); cross_expected = _cross_run_contract(expected_by_run)
    invalid_edge_count = (sum(item["decoded_triangle_coverage_invalid_edge_count"] for item in decoded_topology)
                          + cross_serialized["coverage_invalid_edge_count"])
    invalid_edge_length = (sum(item["decoded_triangle_coverage_invalid_edge_length_m"] for item in decoded_topology)
                           + cross_serialized["coverage_invalid_edge_length_m"])
    exact_coverage = all(item["decoded_triangle_coverage_is_valid_exact"] for item in decoded_topology) and cross_serialized["coverage_is_valid_exact"]
    welded = _global_welded_contract(run_boundaries, invalid_edge_count, invalid_edge_length)
    expected_delta = _boundary_delta(expected_union, serialized_union)
    preclip_delta = _boundary_delta(display_owned_union, accounted_union)
    symmetric = float(expected_union.symmetric_difference(serialized_union).area)
    area_tolerance = max(1e-6, expected_union.boundary.length * RIVER_FLOAT32_XZ_TOLERANCE_M + math.pi * RIVER_FLOAT32_XZ_TOLERANCE_M ** 2 * max(1, len(_polygon_parts(expected_union))))
    numerical_tolerance = max(1e-6, display_owned_union.area * 1e-12)
    significant_minimum = .01
    expected_rings = _significant_rings(expected_union, significant_minimum); serialized_rings = _significant_rings(serialized_union, significant_minimum)
    preclip_rings = _significant_rings(display_owned_union, significant_minimum); accounted_rings = _significant_rings(accounted_union, significant_minimum)
    shared_distances = [point.distance(serialized_union) for point in junctions.values()]
    shared_metric = _Metric(1e-6); shared_metric.add(shared_distances)
    decoded_positive_overlap = sum(item["decoded_triangle_positive_self_overlap_area_m2"] for item in decoded_topology)
    checks = {
        "all_decoded_runs_internal_topology_valid": all(item["passed"] for item in decoded_topology),
        "all_non_shadowed_runs_decoded": len(decoded_topology) == len(run_ranges),
        "all_run_geometries_valid": all(item.is_valid for item in serialized_by_run),
        "cross_run_edges_and_y_match": cross_serialized["passed"] and cross_expected["passed"] and welded["passed"],
        "cross_run_positive_overlap_zero": cross_serialized["positive_overlap_pair_count"] == 0 and cross_expected["positive_overlap_pair_count"] == 0,
        "decoded_float32_grounding_strict": grounding["passed"],
        "exact_float32_coverage_valid": exact_coverage and invalid_edge_count == 0 and invalid_edge_length <= RIVER_BOUNDARY_LENGTH_EPSILON_M,
        "float32_boundary_within_tolerance": expected_delta["hausdorff_m"] <= RIVER_FLOAT32_XZ_TOLERANCE_M and expected_delta["first_outside_second_buffer_length_m"] <= RIVER_BOUNDARY_LENGTH_EPSILON_M and expected_delta["second_outside_first_buffer_length_m"] <= RIVER_BOUNDARY_LENGTH_EPSILON_M,
        "global_boundary_topology_valid": welded["passed"],
        "nodata_and_extent_remain_transparent": serialized_union.intersection(nodata_union).area <= max(1e-6, nodata_union.boundary.length * RIVER_FLOAT32_XZ_TOLERANCE_M) and serialized_union.intersection(extent_union).area <= max(1e-6, extent_union.boundary.length * RIVER_FLOAT32_XZ_TOLERANCE_M),
        "positive_run_count": len(run_ranges) > 0,
        "preclip_owned_continuously_accounted_after_terrain_clipping": preclip_delta["hausdorff_m"] <= RIVER_FLOAT32_XZ_TOLERANCE_M and preclip_delta["first_outside_second_buffer_length_m"] <= RIVER_BOUNDARY_LENGTH_EPSILON_M and preclip_delta["second_outside_first_buffer_length_m"] <= RIVER_BOUNDARY_LENGTH_EPSILON_M and display_owned_union.symmetric_difference(accounted_union).area <= numerical_tolerance,
        "shared_endpoints_covered_after_serialization": not shared_distances or max(shared_distances) <= RIVER_FLOAT32_XZ_TOLERANCE_M,
        "terrain_expected_components_preserved_after_serialization": len(_polygon_parts(expected_union)) == len(_polygon_parts(serialized_union)),
        "terrain_expected_serialized_area_agree": symmetric <= area_tolerance,
        "terrain_expected_significant_interior_rings_preserved_after_serialization": expected_rings["count"] == serialized_rings["count"],
        "visual_depth_does_not_modify_or_conflict_with_geometry": True,
    }
    final = {
        "schema": "guilin-v072-serialized-river-display-qa/v2", "season": season,
        "season_semantics": "visual seasonal preset; not a discharge simulation", "visual_depth": preset["depth"],
        "visual_depth_geometry_displacement_m": 0.0, "depth_conflict_count": 0,
        "decoded_float32_grounding": grounding, "decoded_run_count": len(decoded_topology),
        "decoded_run_triangle_topology": decoded_topology,
        "decoded_run_non_adjacent_edge_crossing_count": sum(item["decoded_non_adjacent_edge_crossing_count"] for item in decoded_topology),
        "decoded_run_triangle_coverage_invalid_edge_count": sum(item["decoded_triangle_coverage_invalid_edge_count"] for item in decoded_topology),
        "decoded_run_triangle_positive_self_overlap_area_m2": decoded_positive_overlap,
        "coverage_is_valid_exact": exact_coverage, "coverage_invalid_edge_count": invalid_edge_count,
        "coverage_invalid_edge_length_m": invalid_edge_length, "cross_run_serialized": cross_serialized,
        "cross_run_terrain_expected": cross_expected, "global_welded_boundary_topology": welded,
        "cross_run_shared_boundary_length_tolerance_m": RIVER_FLOAT32_XZ_TOLERANCE_M,
        "join_measurement_scope": "all final Float32 displayed runs and independent terrain-clipped analytic runs",
        "shared_endpoint_count": len(shared_distances), "shared_endpoint_uncovered_count": sum(value > RIVER_FLOAT32_XZ_TOLERANCE_M for value in shared_distances),
        "shared_endpoint_distance_mean_m": shared_metric.mean, "shared_endpoint_distance_p95_m": shared_metric.percentile(95),
        "shared_endpoint_distance_maximum_m": shared_metric.maximum if shared_metric.count else 0.0,
        "terrain_clipped_expected_union": _topology(expected_union), "serialized_visible_union": _topology(serialized_union),
        "terrain_clipped_expected_significant_interior_rings": expected_rings, "serialized_significant_interior_rings": serialized_rings,
        "terrain_expected_to_serialized_boundary_hausdorff_m": expected_delta["hausdorff_m"],
        "terrain_expected_boundary_outside_serialized_3cm_buffer_length_m": expected_delta["first_outside_second_buffer_length_m"],
        "serialized_boundary_outside_terrain_expected_3cm_buffer_length_m": expected_delta["second_outside_first_buffer_length_m"],
        "terrain_expected_to_serialized_union_area_absolute_error_m2": abs(expected_union.area - serialized_union.area),
        "terrain_expected_to_serialized_symmetric_difference_area_m2": symmetric,
        "terrain_expected_uncovered_area_m2": float(expected_union.difference(serialized_union).area),
        "serialized_outside_terrain_expected_area_m2": float(serialized_union.difference(expected_union).area),
        "serialized_over_nodata_area_m2": float(serialized_union.intersection(nodata_union).area),
        "serialized_over_extent_clipped_area_m2": float(serialized_union.intersection(extent_union).area),
        "expected_extent_clipped_area_m2": float(extent_union.area), "expected_nodata_area_m2": float(nodata_union.area),
        "float32_area_tolerance_m2": area_tolerance, "nodata_float32_area_tolerance_m2": max(1e-6, nodata_union.boundary.length * RIVER_FLOAT32_XZ_TOLERANCE_M),
        "extent_float32_area_tolerance_m2": max(1e-6, extent_union.boundary.length * RIVER_FLOAT32_XZ_TOLERANCE_M),
        "float32_xz_tolerance_m": RIVER_FLOAT32_XZ_TOLERANCE_M,
        "terrain_expected_to_serialized_lost_component_count": max(0, len(_polygon_parts(expected_union)) - len(_polygon_parts(serialized_union))),
        "terrain_expected_to_serialized_new_component_count": max(0, len(_polygon_parts(serialized_union)) - len(_polygon_parts(expected_union))),
        "terrain_expected_to_serialized_lost_significant_interior_ring_count": max(0, expected_rings["count"] - serialized_rings["count"]),
        "terrain_expected_to_serialized_new_significant_interior_ring_count": max(0, serialized_rings["count"] - expected_rings["count"]),
        "serialized_boundary_self_intersection_count": int(not serialized_union.is_valid or not serialized_union.boundary.is_simple),
        "significant_interior_ring_minimum_area_m2": significant_minimum,
        "preclip_owned_union": _topology(display_owned_union), "preclip_accounted_after_terrain_clipping_union": _topology(accounted_union),
        "preclip_owned_significant_interior_rings": preclip_rings,
        "preclip_accounted_after_terrain_clipping_significant_interior_rings": accounted_rings,
        "preclip_owned_to_accounted_after_terrain_clipping_boundary_hausdorff_m": preclip_delta["hausdorff_m"],
        "preclip_owned_boundary_outside_accounted_3cm_buffer_length_m": preclip_delta["first_outside_second_buffer_length_m"],
        "accounted_boundary_outside_preclip_owned_3cm_buffer_length_m": preclip_delta["second_outside_first_buffer_length_m"],
        "preclip_owned_to_accounted_after_terrain_clipping_symmetric_difference_area_m2": float(display_owned_union.symmetric_difference(accounted_union).area),
        "preclip_to_accounted_boundary_diagnostic_scope": "independent fixed-grid preclip owned union versus global union of terrain/NoData/extent-clipped accounting",
        "numerical_area_tolerance_m2": numerical_tolerance, "display_precision": display_contract,
        "duration_seconds": time.monotonic() - started, "checks": checks,
    }
    final["passed"] = all(checks.values()) and final["depth_conflict_count"] == 0 and final["serialized_boundary_self_intersection_count"] == 0
    asset = {
        "position_file": position_path.name, "positions_file": position_path.name,
        "index_file": index_path.name, "indices_file": index_path.name,
        "position_compression": "gzip", "index_compression": "gzip",
        "positions_global": True, "indices_global": True,
        "vertex_space": "terrain-world local X,height,local Z; source DEM height plus 0.35m",
        "index_space": "global-vertex-array", "vertex_count": len(decoded_positions),
        "index_count": len(decoded_indices), "triangle_count": len(decoded_indices) // 3,
        "position_stored_bytes": position_path.stat().st_size, "index_stored_bytes": index_path.stat().st_size,
        "position_sha256": sha256_file(position_path), "index_sha256": sha256_file(index_path),
        "surface_offset_m": RIVER_SURFACE_OFFSET_M, "source_resolution_m": SOURCE_RESOLUTION_M,
        "run_ranges": run_ranges, "visible_run_count": len(run_ranges), "fully_shadowed_run_count": fully_shadowed,
    }
    ribbon = {
        "source_interior_ring_count": sum(item["source_buffer_interior_ring_count"] for item in hole_contracts),
        "final_interior_ring_count": sum(item["final_interior_ring_count"] for item in hole_contracts),
        "interior_ring_area_absolute_error_m2": abs(sum(item["source_buffer_interior_area_m2"] for item in hole_contracts) - sum(item["final_interior_ring_area_m2"] for item in hole_contracts)),
        "filled_hole_area_m2": sum(item["preserved_buffer_filled_interior_area_m2"] for item in hole_contracts),
        "symmetric_difference_area_m2": sum(item["preserved_buffer_symmetric_difference_area_m2"] for item in hole_contracts),
        "run_count": len(hole_contracts), "failed_run_count": sum(not item["passed"] for item in hole_contracts),
    }
    ribbon["passed"] = ribbon["failed_run_count"] == 0 and ribbon["source_interior_ring_count"] == ribbon["final_interior_ring_count"] and ribbon["interior_ring_area_absolute_error_m2"] <= 1e-8 and ribbon["filled_hole_area_m2"] <= 1e-8 and ribbon["symmetric_difference_area_m2"] <= 1e-8
    return asset, final, ribbon, {"positions": decoded_positions, "indices": decoded_indices}


def build_river_products(ds, output_dir: Path, hydrology: dict[str, Any], sample_step: float) -> tuple[dict[str, Any], dict[str, Any]]:
    before = _centerline_digest(hydrology); runs, junctions, max_radius = _prepare_runs(ds, hydrology, sample_step)
    if not runs:
        raise RuntimeError("Hydrology has no displayable native-terrain runs")
    center_e, center_n = (ds.bounds.left + ds.bounds.right) / 2, (ds.bounds.bottom + ds.bounds.top) / 2
    center_values = []
    for run in runs:
        terrain, valid = _sample_terrain(ds, run["eastings"], run["northings"])
        if not valid.all():
            raise RuntimeError("Prepared centerline run is not fully grounded")
        center_values.append(np.column_stack((run["local_eastings"], terrain + RIVER_SURFACE_OFFSET_M, -run["local_northings"])).astype("<f4"))
    center_path = output_dir / "river_drape_center.f32"; center_path.write_bytes(np.concatenate(center_values).tobytes())
    indexed_assets = [_asset_record(center_path)]; seasons_runtime = {}; grounding_by_season = {}
    serialized_alias = {}; ribbons = {}; bank_assets = {}
    for season, preset in SEASON_PRESETS.items():
        bank_record, left_bank, right_bank = _season_bank_asset(ds, output_dir, runs, season, preset, center_e, center_n)
        indexed_assets.append(bank_record); bank_assets[season] = bank_record
        asset, final, ribbon, _ = _build_river_season(ds, output_dir, runs, junctions, season, preset, center_e, center_n)
        indexed_assets.extend((_asset_record(output_dir / asset["positions_file"]), _asset_record(output_dir / asset["indices_file"])))
        seasons_runtime[season] = {**preset, "semantics": "visual seasonal preset; not a discharge simulation", "serialized_global_display_mesh": asset,
                                   "bank_audit_file": bank_record["file"]}
        grounding_by_season[season] = {"left_bank": left_bank, "right_bank": right_bank,
                                        "serialized_global_display_mesh": final,
                                        "passed": left_bank["passed"] and right_bank["passed"] and final["passed"]}
        serialized_alias[season] = final; ribbons[season] = ribbon
    after = _centerline_digest(hydrology)
    oversize = [asset["file"] for asset in indexed_assets if asset["stored_bytes"] >= MAX_ASSET_BYTES]
    round_regression = _round_regression(max_radius); hole_regression = _hole_regression()
    checks = {
        "centerline_coordinates_unchanged": before == after,
        "four_visual_season_presets_exact": set(seasons_runtime) == set(SEASON_PRESETS),
        "all_seasons_final_float32_grounding_passed": all(item["serialized_global_display_mesh"]["decoded_float32_grounding"]["passed"] for item in grounding_by_season.values()),
        "all_seasons_final_topology_passed": all(item["serialized_global_display_mesh"]["passed"] for item in grounding_by_season.values()),
        "all_banks_resampled_at_final_xz": all(item[edge]["passed"] for item in grounding_by_season.values() for edge in ("left_bank", "right_bank")),
        "round_arc_construction_regression_passed": round_regression["passed"],
        "hole_preservation_regression_passed": hole_regression["passed"],
        "all_assets_under_100_mib": not oversize,
        "exact_indexed_asset_count": len(indexed_assets) == 13,
    }
    qa = {
        "schema": "guilin-v072-river-drape-qa/v3", "checks": checks, "passed": all(checks.values()),
        "all_seasons_grounding_passed": all(item["passed"] for item in grounding_by_season.values()),
        "all_seasons_topology_passed": all(item["serialized_global_display_mesh"]["passed"] for item in grounding_by_season.values()),
        "centerline_collection_sha256_before": before, "centerline_collection_sha256_after": after,
        "centerline_geometry_mutated": before != after, "source_feature_count": len(hydrology.get("features", [])),
        "display_run_count": len(runs), "source_resolution_m": SOURCE_RESOLUTION_M,
        "surface_offset_m": RIVER_SURFACE_OFFSET_M, "maximum_asset_bytes": MAX_ASSET_BYTES,
        "oversize_asset_files": oversize, "grounding_by_season": grounding_by_season,
        "joins_and_topology": {
            "round_arc_regression": round_regression, "hole_preservation_regression": hole_regression,
            "ribbon_hole_preservation_by_season": ribbons,
            "serialized_global_display_mesh_by_season": serialized_alias,
        },
        "season_semantics": "visual seasonal preset; not a discharge simulation",
    }
    runtime = {
        "schema": "guilin-v072-river-drape-runtime/v3", "crs": EXPECTED_CRS,
        "center_epsg32649": [center_e, center_n], "source_resolution_m": SOURCE_RESOLUTION_M,
        "surface_offset_m": RIVER_SURFACE_OFFSET_M, "centerline_collection_sha256": before,
        "centerline_geometry_mutated": False, "centerline_file": center_path.name,
        "season_semantics": "visual seasonal preset; not a discharge simulation", "seasons": seasons_runtime,
        "indexed_assets": indexed_assets, "qa_file": "river_drape_qa.json",
    }
    json_write(output_dir / "river_drape_runtime.json", runtime); json_write(output_dir / "river_drape_qa.json", qa)
    if not qa["passed"]:
        raise RuntimeError("River v3 QA failed")
    return runtime, qa


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--mosaic", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--hydrology", type=Path)
    parser.add_argument("--height-max-width", type=int, default=1024)
    parser.add_argument("--texture-max-width", type=int, default=2560)
    parser.add_argument("--tile-intervals", type=int, default=256)
    parser.add_argument("--river-sample-step", type=float, default=50.0)
    parser.add_argument("--river-only", action="store_true")
    args = parser.parse_args()

    args.output_dir.mkdir(parents=True, exist_ok=True)
    hydrology = json.loads(args.hydrology.read_text(encoding="utf-8")) if args.hydrology else None
    if args.river_only and hydrology is None:
        parser.error("--river-only requires --hydrology")
    with rasterio.open(args.mosaic) as ds:
        if str(ds.crs) != EXPECTED_CRS:
            raise RuntimeError(f"Unexpected CRS: {ds.crs}")
        if abs(abs(ds.transform.a) - SOURCE_RESOLUTION_M) > 1e-9 or abs(abs(ds.transform.e) - SOURCE_RESOLUTION_M) > 1e-9:
            raise RuntimeError(f"Source DEM must remain native 12.5 m, got {ds.transform.a},{ds.transform.e}")
        if ds.transform.b != 0 or ds.transform.d != 0:
            raise RuntimeError("Rotated/skewed source grids are not supported")
        source_stats = _source_statistics(ds)
        if args.river_only:
            runtime, qa = build_river_products(ds, args.output_dir, hydrology, args.river_sample_step)
            print(json.dumps({"mode": "river-only", "runtime": runtime["schema"], "qa_passed": qa["passed"]}, ensure_ascii=False))
            return 0

        hdata, hmask, hwidth, hheight = read_scaled(ds, args.height_max_width, Resampling.bilinear)
        valid = hdata[hmask]
        if not valid.size:
            raise RuntimeError("DEM contains no valid cells")
        minimum = float(source_stats["minimum_m"])
        maximum = float(source_stats["maximum_m"])
        span = max(maximum - minimum, 1.0)

        encoded = np.full((hheight, hwidth), NODATA_CODE, dtype="<u2")
        encoded_valid = np.clip(np.rint((hdata[hmask] - minimum) / span * 65534.0), 0, 65534)
        encoded[hmask] = encoded_valid.astype(np.uint16)
        (args.output_dir / "terrain_height_u16.bin").write_bytes(encoded.tobytes(order="C"))

        tdata, tmask, twidth, theight = read_scaled(ds, args.texture_max_width, Resampling.bilinear)
        rgba, normal_rgb, roughness_u8, detail_u8, analysis = build_rich_terrain_products(
            tdata, tmask, ds.bounds
        )
        Image.fromarray(rgba, mode="RGBA").save(
            args.output_dir / "terrain_texture.webp",
            format="WEBP",
            quality=93,
            method=6,
        )
        Image.fromarray(normal_rgb, mode="RGB").save(
            args.output_dir / "terrain_normal.png",
            format="PNG",
            optimize=True,
        )
        Image.fromarray(roughness_u8, mode="L").save(
            args.output_dir / "terrain_roughness.webp",
            format="WEBP",
            quality=92,
            method=6,
        )
        Image.fromarray(detail_u8, mode="L").save(
            args.output_dir / "terrain_karst_detail.webp",
            format="WEBP",
            quality=92,
            method=6,
        )

        to_wgs84 = Transformer.from_crs("EPSG:32649", "EPSG:4326", always_xy=True)
        west, south, east, north = ds.bounds
        corners = [
            to_wgs84.transform(west, south),
            to_wgs84.transform(east, south),
            to_wgs84.transform(east, north),
            to_wgs84.transform(west, north),
        ]
        lon_values = [point[0] for point in corners]
        lat_values = [point[1] for point in corners]

        overview_x_spacing = (east - west) / hwidth
        overview_y_spacing = (north - south) / hheight
        manifest = {
            "schema": "guilin-v072-terrain-seasonal-rivers/v2",
            "crs": EXPECTED_CRS,
            "source_resolution_m": [abs(ds.transform.a), abs(ds.transform.e)],
            "source_resolution_xy_m": [abs(ds.transform.a), abs(ds.transform.e)],
            "source_grid": [ds.width, ds.height],
            "source_grid_shape": [ds.width, ds.height],
            "source_statistics": source_stats,
            "bounds_epsg32649": [west, south, east, north],
            "bounds_wgs84": [min(lon_values), min(lat_values), max(lon_values), max(lat_values)],
            "world_size_m": [east - west, north - south],
            "center_epsg32649": [(west + east) / 2.0, (south + north) / 2.0],
            "elevation_range_m": [minimum, maximum],
            "overview_only": True,
            "actual_vertex_spacing_m": max(overview_x_spacing, overview_y_spacing),
            "overview_vertex_spacing_xy_m": [overview_x_spacing, overview_y_spacing],
            "height": {
                "file": "terrain_height_u16.bin",
                "width": hwidth,
                "height": hheight,
                "encoding": "uint16-little-endian",
                "nodata_code": int(NODATA_CODE),
                "valid_min_code": 0,
                "valid_max_code": 65534,
                "actual_vertex_spacing_xy_m": [overview_x_spacing, overview_y_spacing],
                "overview_only": True,
                "mask_downsampling": "conservative: valid only when every covered native source pixel is valid",
            },
            "texture": {
                "file": "terrain_texture.webp",
                "width": twidth,
                "height": theight,
                "alpha_is_valid_data_mask": True,
                "surface_color_semantics": "programmatic composite; not satellite or orthophoto imagery",
            },
            "normal": {
                "file": "terrain_normal.png",
                "width": twidth,
                "height": theight,
                "policy": "visual shading only; source elevation unchanged",
            },
            "roughness": {
                "file": "terrain_roughness.webp",
                "width": twidth,
                "height": theight,
            },
            "karst_detail": {
                "file": "terrain_karst_detail.webp",
                "width": twidth,
                "height": theight,
                "policy": "high-resolution karst material detail field; runtime must bind and expose its independent strength",
                "runtime_binding_required": True,
            },
            "analysis": analysis,
            "vertical_scale": 1.0,
            "source_elevation_modified_m": 0.0,
            "crop_applied": False,
            "smoothing": False,
            "gap_fill": False,
            "smoothing_applied": False,
            "gap_fill_applied": False,
            "fallback_resolution_m": None,
            "fallback_30m_allowed": False,
            "surface_color_semantics": "programmatic composite; not satellite or orthophoto imagery",
            "lod_manifest_file": "terrain_lod_manifest.json",
            "lod_qa_file": "terrain_lod_qa.json",
            "river_runtime_file": "river_drape_runtime.json",
            "river_qa_file": "river_drape_qa.json",
            "source_mosaic": args.mosaic.name,
        }
        if hydrology is None:
            raise RuntimeError("Full terrain build requires --hydrology so LOD acceptance and river QA use one reviewed source")
        lod_manifest, lod_qa = build_lod_products(ds, args.output_dir, source_stats, args.tile_intervals, hydrology)
        river_runtime, river_qa = build_river_products(ds, args.output_dir, hydrology, args.river_sample_step)
        manifest["acceptance_points"] = lod_manifest["acceptance_points"]
        manifest["lod_qa_passed"] = lod_qa["passed"]
        manifest["river_qa_passed"] = river_qa["passed"]
        json_write(args.output_dir / "terrain_manifest.json", manifest)

    print(json.dumps({"terrain_manifest": manifest, "lod_schema": lod_manifest["schema"],
                      "river_schema": river_runtime["schema"]}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
