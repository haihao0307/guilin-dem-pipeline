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
NODATA_POLICY = "source GDAL mask; conservative overview samples and cells remain transparent on any NoData contribution; no smoothing; no gap fill"
RIVER_FLOAT32_XZ_TOLERANCE_M = 0.03
RIVER_DISPLAY_PRECISION_GRID_M = 0.015625
RIVER_ROUND_BUFFER_QUAD_SEGS = 16
RIVER_SURFACE_OFFSET_M = 0.35
RIVER_CLEARANCE_ERROR_P95_TOLERANCE_M = 0.001
RIVER_CLEARANCE_ERROR_MAXIMUM_TOLERANCE_M = 0.01
RIVER_MAX_CLEARANCE_M = 2.0
RIVER_BOUNDARY_LENGTH_EPSILON_M = 1e-6
RIVER_GEOMETRY_AREA_EPSILON_M2 = 1e-8
RIVER_GROUNDING_VISUAL_BANK_DELTA_MINIMUM_M = 2.0
RIVER_GROUNDING_VISUAL_CROSS_SLOPE_MINIMUM = 0.02
RIVER_GROUNDING_VISUAL_CROSS_SLOPE_MAXIMUM = 0.10
RIVER_GROUNDING_VISUAL_CROSS_SLOPE_TARGET = 0.06
RIVER_GROUNDING_REPRESENTATIVE_SYSTEMS = ("li", "xiang")
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


def _overview_sample_geometry(bounds: rasterio.coords.BoundingBox, width: int, height: int) -> dict[str, Any]:
    """Return the actual output-pixel-centre domain used by rasterio ``out_shape``."""
    if width < 2 or height < 2:
        raise ValueError("overview grid must have at least two samples per axis")
    spacing_x = (bounds.right - bounds.left) / width
    spacing_y = (bounds.top - bounds.bottom) / height
    first_e = bounds.left + spacing_x / 2.0
    last_e = bounds.right - spacing_x / 2.0
    first_n = bounds.top - spacing_y / 2.0
    last_n = bounds.bottom + spacing_y / 2.0
    center_e = (bounds.left + bounds.right) / 2.0
    center_n = (bounds.bottom + bounds.top) / 2.0
    return {
        "actual_vertex_spacing_m": max(spacing_x, spacing_y),
        "actual_vertex_spacing_xy_m": [spacing_x, spacing_y],
        "sample_center_bounds_epsg32649": [first_e, last_n, last_e, first_n],
        "bounds_world_xz": [first_e - center_e, center_n - first_n, last_e - center_e, center_n - last_n],
    }


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


def _json_default(value: Any) -> Any:
    """Convert NumPy scalar results without weakening JSON type checking."""
    if isinstance(value, np.generic):
        return value.item()
    raise TypeError(f"Object of type {type(value).__name__} is not JSON serializable")


def json_write(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True, default=_json_default) + "\n",
        encoding="utf-8",
    )


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
    block_candidates: list[tuple[float, int, int]] = []
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
        block_candidates.append((float(score[order[0]]), int(rows[order[0]]), int(cols[order[0]])))
    if not block_candidates:
        raise RuntimeError("No valid/NoData boundary supports a complete 600 m neighborhood")
    # A merely adjacent pixel can sit beside a one-pixel speck and make a useless visual
    # acceptance ROI.  Evaluate one stable candidate from every source block and prefer
    # the boundary with the largest minority class in the full source-mask circle.
    # Distance to the mosaic centre, row and column are deterministic tie-breakers.
    ranked: list[tuple[int, float, int, int, int, int, int]] = []
    for distance_score, candidate_row, candidate_col in block_candidates:
        cr0, cr1 = candidate_row - ry, candidate_row + ry + 1
        cc0, cc1 = candidate_col - rx, candidate_col + rx + 1
        candidate_mask = ds.read_masks(1, window=Window(cc0, cr0, cc1 - cc0, cr1 - cr0)) > 0
        candidate_dy = (np.arange(cr0, cr1) - candidate_row) * abs(ds.transform.e)
        candidate_dx = (np.arange(cc0, cc1) - candidate_col) * abs(ds.transform.a)
        candidate_circle = candidate_dy[:, None] ** 2 + candidate_dx[None, :] ** 2 <= radius_m ** 2 + 1e-9
        candidate_valid = int(np.count_nonzero(candidate_mask & candidate_circle))
        candidate_nodata = int(np.count_nonzero(~candidate_mask & candidate_circle))
        ranked.append((-min(candidate_valid, candidate_nodata), distance_score, candidate_row, candidate_col,
                       candidate_valid, candidate_nodata, int(candidate_circle.sum())))
    _, _, row, col, precomputed_valid, precomputed_nodata, precomputed_count = min(ranked)
    r0, r1, c0, c1 = row - ry, row + ry + 1, col - rx, col + rx + 1
    mask = ds.read_masks(1, window=Window(c0, r0, c1 - c0, r1 - r0)) > 0
    dy = (np.arange(r0, r1) - row) * abs(ds.transform.e)
    dx = (np.arange(c0, c1) - col) * abs(ds.transform.a)
    circle = dy[:, None] ** 2 + dx[None, :] ** 2 <= radius_m ** 2 + 1e-9
    valid_count = int(np.count_nonzero(mask & circle))
    nodata_count = int(np.count_nonzero(~mask & circle))
    count = int(circle.sum())
    if (valid_count, nodata_count, count) != (precomputed_valid, precomputed_nodata, precomputed_count):
        raise RuntimeError("NoData acceptance selection was not deterministic on source mask re-read")
    easting, northing = ds.xy(row, col)
    lon, lat = Transformer.from_crs(EXPECTED_CRS, "EPSG:4326", always_xy=True).transform(easting, northing)
    return {
        "id": "nodata", "lon": float(lon), "lat": float(lat),
        "easting": float(easting), "northing": float(northing), "source_row": row, "source_col": col,
        "selected_source_pixel_valid": True,
        "selection_policy": "one centre-nearest valid/NoData boundary candidate per source block; maximize 600m minority-class count, then mosaic-centre distance/row/column",
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


def _native_mask_3x3_count(ds, easting: float, northing: float) -> tuple[int, int, int]:
    row, col = ds.index(easting, northing)
    if row < 1 or col < 1 or row >= ds.height - 1 or col >= ds.width - 1:
        return 0, int(row), int(col)
    mask = ds.read_masks(1, window=Window(col - 1, row - 1, 3, 3)) > 0
    return int(mask.sum()), int(row), int(col)


def _hydrology_acceptance_anchors(ds, hydrology: dict[str, Any] | None) -> dict[str, Any]:
    if not hydrology:
        raise RuntimeError("Reviewed hydrology is required for deterministic river acceptance anchors")
    features = hydrology.get("features", [])
    turn: tuple[float, int, int, tuple[float, float]] | None = None
    to_utm = Transformer.from_crs("EPSG:4326", EXPECTED_CRS, always_xy=True)
    center_e = (ds.bounds.left + ds.bounds.right) / 2.0
    center_n = (ds.bounds.bottom + ds.bounds.top) / 2.0
    summer = SEASON_PRESETS["summer"]
    reviewed_interior_native_candidate_count = 0
    constraint_matching_candidates: list[tuple[Any, ...]] = []
    for feature_index, feature in enumerate(features):
        geometry = feature.get("geometry") or {}
        coordinates = geometry.get("coordinates") or []
        if geometry.get("type") != "LineString" or len(coordinates) < 2:
            continue
        properties = feature.get("properties") or {}
        base_width = float(properties.get("base_width_m") or 0)
        values = np.asarray(coordinates, dtype=np.float64)
        east, north = to_utm.transform(values[:, 0], values[:, 1])
        east, north = np.asarray(east, dtype=np.float64), np.asarray(north, dtype=np.float64)
        if len(values) >= 3:
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
        system_normalized = str(properties.get("system") or "").strip().lower()
        source_name = properties.get("name")
        if (base_width <= 0 or system_normalized not in RIVER_GROUNDING_REPRESENTATIVE_SYSTEMS or
                not isinstance(source_name, str) or not source_name.strip()):
            continue
        tangent_e, tangent_n = np.empty_like(east), np.empty_like(north)
        tangent_e[0], tangent_n[0] = east[1] - east[0], north[1] - north[0]
        tangent_e[-1], tangent_n[-1] = east[-1] - east[-2], north[-1] - north[-2]
        if len(east) > 2:
            tangent_e[1:-1], tangent_n[1:-1] = east[2:] - east[:-2], north[2:] - north[:-2]
        tangent_length = np.hypot(tangent_e, tangent_n)
        tangent_valid = tangent_length > 1e-9
        normal_e, normal_n = np.zeros_like(east), np.zeros_like(north)
        normal_e[tangent_valid] = -tangent_n[tangent_valid] / tangent_length[tangent_valid]
        normal_n[tangent_valid] = tangent_e[tangent_valid] / tangent_length[tangent_valid]
        final_width = base_width * summer["width"]
        half_width = final_width / 2.0
        left_e, left_n = east + normal_e * half_width, north + normal_n * half_width
        right_e, right_n = east - normal_e * half_width, north - normal_n * half_width
        center_height, center_valid = _sample_terrain(ds, east, north)
        left_height, left_valid = _sample_terrain(ds, left_e, left_n)
        right_height, right_valid = _sample_terrain(ds, right_e, right_n)
        visible = tangent_valid & center_valid & left_valid & right_valid
        for vertex_index in range(1, len(values) - 1):
            if not visible[vertex_index]:
                continue
            reviewed_interior_native_candidate_count += 1
            bank_delta = abs(float(left_height[vertex_index] - right_height[vertex_index]))
            cross_slope = bank_delta / final_width
            if (bank_delta < RIVER_GROUNDING_VISUAL_BANK_DELTA_MINIMUM_M or
                    not RIVER_GROUNDING_VISUAL_CROSS_SLOPE_MINIMUM <= cross_slope <= RIVER_GROUNDING_VISUAL_CROSS_SLOPE_MAXIMUM):
                continue
            item = (
                final_width, -abs(cross_slope - RIVER_GROUNDING_VISUAL_CROSS_SLOPE_TARGET),
                cross_slope, bank_delta, -feature_index, -int(vertex_index),
                feature_index, int(vertex_index), float(values[vertex_index, 0]), float(values[vertex_index, 1]),
                base_width, final_width, float(east[vertex_index]), float(north[vertex_index]),
                float(left_e[vertex_index]), float(left_n[vertex_index]),
                float(right_e[vertex_index]), float(right_n[vertex_index]),
                float(center_height[vertex_index]), float(left_height[vertex_index]), float(right_height[vertex_index]),
                properties.get("osm_type"), properties.get("osm_id"), source_name, system_normalized,
            )
            constraint_matching_candidates.append(item)
    selected: tuple[Any, ...] | None = None
    selection_scan_rank = 0
    selected_mask_counts: tuple[int, int, int] | None = None
    for rank, item in enumerate(sorted(constraint_matching_candidates, reverse=True), start=1):
        center_count, _, _ = _native_mask_3x3_count(ds, item[12], item[13])
        left_count, _, _ = _native_mask_3x3_count(ds, item[14], item[15])
        right_count, _, _ = _native_mask_3x3_count(ds, item[16], item[17])
        if center_count == left_count == right_count == 9:
            selected, selection_scan_rank = item, rank
            selected_mask_counts = (center_count, left_count, right_count)
            break
    if selected is None or selected_mask_counts is None:
        raise RuntimeError("No representative Li/Xiang interior centerline candidate satisfies the stable summer cross-slope contract")
    (ranked_final_width, _, cross_slope, bank_delta, _, _, feature_index, vertex_index, lon, lat, base_width, final_width,
     east, north, left_e, left_n, right_e, right_n, center_height, left_height, right_height,
     osm_type, osm_id, name, system) = selected
    if ranked_final_width != final_width:
        raise RuntimeError("River-grounding candidate rank payload is inconsistent")
    center_count, left_count, right_count = selected_mask_counts
    _, source_row, source_col = _native_mask_3x3_count(ds, east, north)
    left_distance = math.hypot(left_e - east, left_n - north)
    right_distance = math.hypot(right_e - east, right_n - north)
    bank_distance = math.hypot(left_e - right_e, left_n - right_n)
    grounding_checks = {
        "reviewed_osm_original_vertex_preserved": [lon, lat] == list(features[feature_index]["geometry"]["coordinates"][vertex_index]),
        "representative_system_is_li_or_xiang": system in RIVER_GROUNDING_REPRESENTATIVE_SYSTEMS,
        "representative_source_name_present": isinstance(name, str) and bool(name.strip()),
        "non_endpoint_original_vertex": 0 < vertex_index < len(features[feature_index]["geometry"]["coordinates"]) - 1,
        "summer_final_width_used": abs(final_width - base_width * summer["width"]) <= 1e-9,
        "center_and_banks_native_3x3_valid": center_count == left_count == right_count == 9,
        "left_and_right_final_xz_distinct": bank_distance > 0 and left_distance > 0 and right_distance > 0,
        "bank_offsets_match_final_half_width": abs(left_distance - final_width / 2) <= 1e-6 and abs(right_distance - final_width / 2) <= 1e-6 and abs(bank_distance - final_width) <= 1e-6,
        "left_and_right_terrain_y_independently_sampled": bank_delta > 1e-9 and left_height != right_height,
        "bank_delta_visually_readable": bank_delta >= RIVER_GROUNDING_VISUAL_BANK_DELTA_MINIMUM_M,
        "cross_slope_in_representative_visual_range": RIVER_GROUNDING_VISUAL_CROSS_SLOPE_MINIMUM <= cross_slope <= RIVER_GROUNDING_VISUAL_CROSS_SLOPE_MAXIMUM,
        "deterministic_width_first_stable_candidate_selected": selection_scan_rank >= 1,
    }
    grounding = {
        "lon": lon, "lat": lat, "easting": east, "northing": north,
        "source_row": source_row, "source_col": source_col,
        "native_available": True, "native_mask_verified": True, "native_3x3_valid_count": center_count,
        "native_elevation_m": center_height, "native_slope_degrees": math.degrees(math.atan(cross_slope)),
        "requested_lon": lon, "requested_lat": lat, "requested_to_selected_distance_m": 0.0,
        "centerline_coordinate_mutated": False,
        "original_centerline_lonlat": [lon, lat],
        "center_epsg32649": [east, north], "left_bank_epsg32649": [left_e, left_n], "right_bank_epsg32649": [right_e, right_n],
        "center_xz_m": [east - center_e, center_n - north],
        "left_bank_xz_m": [left_e - center_e, center_n - left_n],
        "right_bank_xz_m": [right_e - center_e, center_n - right_n],
        "center_terrain_height_m": center_height, "left_bank_terrain_height_m": left_height,
        "right_bank_terrain_height_m": right_height,
        "left_minus_right_terrain_y_m": left_height - right_height,
        "bank_delta_y_m": bank_delta, "cross_slope": cross_slope,
        "cross_slope_degrees": math.degrees(math.atan(cross_slope)),
        "season": "summer", "width": summer["width"], "base_width_m": base_width, "final_width_m": final_width,
        "center_native_3x3_valid_count": center_count, "left_bank_native_3x3_valid_count": left_count,
        "right_bank_native_3x3_valid_count": right