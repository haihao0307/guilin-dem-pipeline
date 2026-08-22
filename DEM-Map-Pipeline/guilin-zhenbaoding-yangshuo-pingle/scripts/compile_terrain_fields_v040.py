#!/usr/bin/env python3
"""Deterministic v0.4.0 terrain-field compiler for the Guilin DEM pipeline.

The compiler keeps the source height grid immutable and derives hydrology,
erosion, karst, landform and exclusion fields in a separate release directory.
It uses projected world coordinates for all procedural phases so neighbouring
tiles produce identical values at shared coordinates.
"""
from __future__ import annotations

import argparse
import hashlib
import heapq
import json
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterator, Mapping, Sequence

import numpy as np

FIELD_VERSION = "0.4.0"
LAND_ = {
    "water": 0,
    "active_bank": 1,
    "valley_floor": 2,
    "alluvial_terrace": 3,
    "footslope": 4,
    "mid_slope": 5,
    "upper_slope": 6,
    "ridge_peak": 7,
    "karst_cliff": 8,
    "erosion_channel": 9,
}
EXCLUSION_BITS = {
    "permanent_water": 1,
    "active_bank": 2,
    "karst_rock_core": 4,
    "erosion_core": 8,
    "ridge_peak": 16,
    "nodata": 32,
}
D8 = (
    (-1, -1, math.sqrt(2.0)),
    (-1, 0, 1.0),
    (-1, 1, math.sqrt(2.0)),
    (0, -1, 1.0),
    (0, 1, 1.0),
    (1, -1, math.sqrt(2.0)),
    (1, 0, 1.0),
    (1, 1, math.sqrt(2.0)),
)


@dataclass(frozen=True)
class GridSpec:
    width: int
    height: int
    bounds: tuple[float, float, float, float]
    crs: str
    nodata: float | None = None

    @property
    def dx(self) -> float:
        return (self.bounds[2] - self.bounds[0]) / max(self.width - 1, 1)

    @property
    def dy(self) -> float:
        return (self.bounds[3] - self.bounds[1]) / max(self.height - 1, 1)

    def world_mesh(self) -> tuple[np.ndarray, np.ndarray]:
        xs = np.linspace(self.bounds[0], self.bounds[2], self.width, dtype=np.float64)
        ys = np.linspace(self.bounds[3], self.bounds[1], self.height, dtype=np.float64)
        return np.meshgrid(xs, ys)


@dataclass
class TerrainFields:
    z_truth_m: np.ndarray
    slope_rad: np.ndarray
    aspect_rad: np.ndarray
    curvature: np.ndarray
    relative_elevation_m: np.ndarray
    permanent_water_mask: np.ndarray
    active_bank_mask: np.ndarray
    distance_to_water_m: np.ndarray
    flow_to_index: np.ndarray
    flow_direction_xy: np.ndarray
    flow_accumulation: np.ndarray
    reaches_permanent_water: np.ndarray
    erosion_channel_mask: np.ndarray
    erosion_core_mask: np.ndarray
    erosion_depth_m: np.ndarray
    karst_rock_mask: np.ndarray
    karst_rock_core_mask: np.ndarray
    landform_class: np.ndarray
    hard_exclusion_mask: np.ndarray

    def arrays(self) -> dict[str, np.ndarray]:
        return {
            "z_truth_m": self.z_truth_m,
            "slope_rad": self.slope_rad,
            "aspect_rad": self.aspect_rad,
            "curvature": self.curvature,
            "relative_elevation_m": self.relative_elevation_m,
            "permanent_water_mask": self.permanent_water_mask,
            "active_bank_mask": self.active_bank_mask,
            "distance_to_water_m": self.distance_to_water_m,
            "flow_to_index": self.flow_to_index,
            "flow_direction_xy": self.flow_direction_xy,
            "flow_accumulation": self.flow_accumulation,
            "reaches_permanent_water": self.reaches_permanent_water,
            "erosion_channel_mask": self.erosion_channel_mask,
            "erosion_core_mask": self.erosion_core_mask,
            "erosion_depth_m": self.erosion_depth_m,
            "karst_rock_mask": self.karst_rock_mask,
            "karst_rock_core_mask": self.karst_rock_core_mask,
            "landform_class": self.landform_class,
            "hard_exclusion_mask": self.hard_exclusion_mask,
        }


def _sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def array_sha256(array: np.ndarray) -> str:
    contiguous = np.ascontiguousarray(array)
    header = json.dumps(
        {"dtype": contiguous.dtype.str, "shape": list(contiguous.shape)},
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return _sha256_bytes(header + b"\0" + contiguous.tobytes(order="C"))


def file_sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def load_release_manifest(path: Path) -> Mapping[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def load_u16_height_grid(path: Path, release: Mapping[str, Any]) -> tuple[np.ndarray, GridSpec]:
    terrain = release["terrain"]
    aoi = release["aoi"]
    grid = int(terrain["grid"])
    raw = np.fromfile(path, dtype="<u2")
    expected = grid * grid
    if raw.size != expected:
        raise ValueError(f"height grid has {raw.size} samples, expected {expected}")
    z_min = float(terrain["minElevationM"])
    z_max = float(terrain["maxElevationM"])
    z = z_min + raw.reshape((grid, grid)).astype(np.float64) * ((z_max - z_min) / 65535.0)
    bounds = tuple(float(v) for v in aoi["boundsProjected"])
    spec = GridSpec(width=grid, height=grid, bounds=bounds, crs=str(aoi["crs"]))
    return z, spec


def load_float_grid(path: Path, spec: GridSpec | None = None) -> tuple[np.ndarray, GridSpec]:
    if path.suffix.lower() == ".npy":
        z = np.asarray(np.load(path), dtype=np.float64)
    elif path.suffix.lower() == ".npz":
        with np.load(path) as data:
            key = "z_truth_m" if "z_truth_m" in data else data.files[0]
            z = np.asarray(data[key], dtype=np.float64)
    else:
        raise ValueError("float grid input must be .npy or .npz")
    if z.ndim != 2:
        raise ValueError("height grid must be two-dimensional")
    if spec is None:
        spec = GridSpec(z.shape[1], z.shape[0], (0.0, 0.0, z.shape[1] - 1.0, z.shape[0] - 1.0), "LOCAL")
    return z, spec


def _iter_geojson_lines(geometry: Mapping[str, Any]) -> Iterator[list[tuple[float, float]]]:
    kind = geometry.get("type")
    coordinates = geometry.get("coordinates")
    if kind == "LineString":
        yield [(float(x), float(y)) for x, y, *_ in coordinates]
    elif kind == "MultiLineString":
        for line in coordinates:
            yield [(float(x), float(y)) for x, y, *_ in line]
    elif kind == "Polygon":
        for ring in coordinates:
            yield [(float(x), float(y)) for x, y, *_ in ring]
    elif kind == "MultiPolygon":
        for polygon in coordinates:
            for ring in polygon:
                yield [(float(x), float(y)) for x, y, *_ in ring]
    elif kind == "GeometryCollection":
        for member in geometry.get("geometries", []):
            yield from _iter_geojson_lines(member)


def _looks_wgs84(points: Sequence[tuple[float, float]]) -> bool:
    return bool(points) and all(-180.0 <= x <= 180.0 and -90.0 <= y <= 90.0 for x, y in points[:8])


def _transform_line(points: Sequence[tuple[float, float]], target_crs: str) -> list[tuple[float, float]]:
    if not _looks_wgs84(points) or target_crs.upper() in {"EPSG:4326", "WGS84"}:
        return list(points)
    try:
        from pyproj import Transformer
    except ImportError as exc:
        raise RuntimeError("pyproj is required to transform WGS84 waterways") from exc
    transformer = Transformer.from_crs("EPSG:4326", target_crs, always_xy=True)
    return [tuple(map(float, transformer.transform(x, y))) for x, y in points]


def rasterize_waterways(
    geojson_path: Path,
    spec: GridSpec,
    *,
    channel_half_width_m: float = 11.0,
) -> np.ndarray:
    payload = json.loads(geojson_path.read_text(encoding="utf-8"))
    if payload.get("type") == "FeatureCollection":
        geometries = [f.get("geometry") for f in payload.get("features", []) if f.get("geometry")]
    elif payload.get("type") == "Feature":
        geometries = [payload.get("geometry")]
    else:
        geometries = [payload]
    mask = np.zeros((spec.height, spec.width), dtype=bool)
    radius = max(1, int(math.ceil(channel_half_width_m / max(min(spec.dx, spec.dy), 1e-9))))
    xmin, ymin, xmax, ymax = spec.bounds

    def to_rc(x: float, y: float) -> tuple[float, float]:
        col = (x - xmin) / max(xmax - xmin, 1e-9) * (spec.width - 1)
        row = (ymax - y) / max(ymax - ymin, 1e-9) * (spec.height - 1)
        return row, col

    for geometry in geometries:
        if not geometry:
            continue
        for source_line in _iter_geojson_lines(geometry):
            line = _transform_line(source_line, spec.crs)
            if len(line) < 2:
                continue
            for a, b in zip(line[:-1], line[1:]):
                r0, c0 = to_rc(*a)
                r1, c1 = to_rc(*b)
                steps = int(max(abs(r1 - r0), abs(c1 - c0), 1.0)) + 1
                rows = np.rint(np.linspace(r0, r1, steps)).astype(int)
                cols = np.rint(np.linspace(c0, c1, steps)).astype(int)
                for row, col in zip(rows, cols):
                    if row < -radius or col < -radius or row >= spec.height + radius or col >= spec.width + radius:
                        continue
                    rlo, rhi = max(0, row - radius), min(spec.height, row + radius + 1)
                    clo, chi = max(0, col - radius), min(spec.width, col + radius + 1)
                    rr, cc = np.ogrid[rlo:rhi, clo:chi]
                    disk = (rr - row) ** 2 + (cc - col) ** 2 <= radius * radius
                    mask[rlo:rhi, clo:chi] |= disk
    return mask


def distance_to_mask(mask: np.ndarray, dx: float, dy: float) -> np.ndarray:
    """Calculate distance to True cells with an 8-neighbour Dijkstra pass."""
    h, w = mask.shape
    distance = np.full((h, w), np.inf, dtype=np.float64)
    queue: list[tuple[float, int, int]] = []
    rows, cols = np.nonzero(mask)
    for r, c in zip(rows.tolist(), cols.tolist()):
        distance[r, c] = 0.0
        heapq.heappush(queue, (0.0, r, c))
    if not queue:
        return distance
    neighbour_steps = (
        (-1, 0, dy),
        (1, 0, dy),
        (0, -1, dx),
        (0, 1, dx),
        (-1, -1, math.hypot(dx, dy)),
        (-1, 1, math.hypot(dx, dy)),
        (1, -1, math.hypot(dx, dy)),
        (1, 1, math.hypot(dx, dy)),
    )
    while queue:
        dist, r, c = heapq.heappop(queue)
        if dist != distance[r, c]:
            continue
        for dr, dc, step in neighbour_steps:
            nr, nc = r + dr, c + dc
            if 0 <= nr < h and 0 <= nc < w:
                candidate = dist + step
                if candidate < distance[nr, nc]:
                    distance[nr, nc] = candidate
                    heapq.heappush(queue, (candidate, nr, nc))
    return distance


def _smooth_box(array: np.ndarray, radius: int) -> np.ndarray:
    if radius <= 0:
        return array.astype(np.float64, copy=True)
    padded = np.pad(array, radius, mode="edge")
    integral = np.pad(padded, ((1, 0), (1, 0)), mode="constant").cumsum(0).cumsum(1)
    size = 2 * radius + 1
    summed = integral[size:, size:] - integral[:-size, size:] - integral[size:, :-size] + integral[:-size, :-size]
    return summed / float(size * size)


def terrain_derivatives(z: np.ndarray, spec: GridSpec) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    dz_dy, dz_dx = np.gradient(z, spec.dy, spec.dx)
    slope = np.arctan(np.hypot(dz_dx, dz_dy))
    aspect = np.arctan2(-dz_dx, dz_dy)
    d2x = np.gradient(np.gradient(z, spec.dx, axis=1), spec.dx, axis=1)
    d2y = np.gradient(np.gradient(z, spec.dy, axis=0), spec.dy, axis=0)
    curvature = d2x + d2y
    broad = _smooth_box(z, max(2, int(round(90.0 / max(spec.dx, spec.dy)))))
    relative = z - broad
    return slope, aspect, curvature, relative


def flow_d8(z: np.ndarray, spec: GridSpec, valid: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    h, w = z.shape
    flow_to = np.full(h * w, -1, dtype=np.int64)
    direction = np.zeros((h, w, 2), dtype=np.float32)
    for r in range(h):
        for c in range(w):
            if not valid[r, c]:
                continue
            best_score = 0.0
            best: tuple[int, int] | None = None
            for dr, dc, _unit in D8:
                nr, nc = r + dr, c + dc
                if not (0 <= nr < h and 0 <= nc < w and valid[nr, nc]):
                    continue
                horizontal = math.hypot(dc * spec.dx, dr * spec.dy)
                drop = z[r, c] - z[nr, nc]
                score = drop / max(horizontal, 1e-9)
                if score > best_score + 1e-15:
                    best_score = score
                    best = (nr, nc)
            if best is not None:
                nr, nc = best
                flow_to[r * w + c] = nr * w + nc
                length = math.hypot((nc - c) * spec.dx, (r - nr) * spec.dy)
                direction[r, c, 0] = float((nc - c) * spec.dx / max(length, 1e-9))
                direction[r, c, 1] = float((r - nr) * spec.dy / max(length, 1e-9))
    accumulation = np.where(valid, 1.0, 0.0).reshape(-1)
    order = np.argsort(z.reshape(-1))[::-1]
    for index in order.tolist():
        target = int(flow_to[index])
        if target >= 0:
            accumulation[target] += accumulation[index]
    return flow_to.reshape((h, w)), direction, accumulation.reshape((h, w))


def downstream_reaches_water(flow_to: np.ndarray, z: np.ndarray, water: np.ndarray) -> np.ndarray:
    flat_flow = flow_to.reshape(-1)
    result = water.reshape(-1).copy()
    order = np.argsort(z.reshape(-1))
    for index in order.tolist():
        target = int(flat_flow[index])
        if target >= 0:
            result[index] = result[index] or result[target]
    return result.reshape(z.shape)


def _hash_noise(x: np.ndarray, y: np.ndarray, scale_m: float, seed: float) -> np.ndarray:
    px = np.floor(x / scale_m)
    py = np.floor(y / scale_m)
    value = np.sin(px * 127.1 + py * 311.7 + seed * 74.7) * 43758.5453123
    return value - np.floor(value)


def world_fbm(spec: GridSpec) -> np.ndarray:
    x, y = spec.world_mesh()
    return (
        0.50 * _hash_noise(x, y, 210.0, 1.0)
        + 0.30 * _hash_noise(x, y, 92.0, 2.0)
        + 0.20 * _hash_noise(x, y, 41.0, 3.0)
    )


def _normalise_finite(values: np.ndarray) -> np.ndarray:
    finite = np.isfinite(values)
    if not np.any(finite):
        return np.zeros_like(values, dtype=np.float64)
    lo = float(np.nanpercentile(values[finite], 5.0))
    hi = float(np.nanpercentile(values[finite], 95.0))
    if hi <= lo:
        return np.zeros_like(values, dtype=np.float64)
    return np.clip((values - lo) / (hi - lo), 0.0, 1.0)


def compile_fields(
    z_truth_m: np.ndarray,
    spec: GridSpec,
    permanent_water_mask: np.ndarray,
    *,
    active_bank_width_m: float = 24.0,
) -> TerrainFields:
    z = np.asarray(z_truth_m, dtype=np.float64)
    if z.shape != (spec.height, spec.width):
        raise ValueError("height array shape does not match GridSpec")
    water = np.asarray(permanent_water_mask, dtype=bool)
    if water.shape != z.shape:
        raise ValueError("water mask shape does not match height grid")
    truth_hash_before = array_sha256(z)
    valid = np.isfinite(z)
    safe_z = np.where(valid, z, np.nanmedian(z[valid]))
    slope, aspect, curvature, relative = terrain_derivatives(safe_z, spec)
    distance = distance_to_mask(water, spec.dx, spec.dy)
    active_bank = (~water) & (distance <= active_bank_width_m)
    flow_to, flow_direction, accumulation = flow_d8(safe_z, spec, valid)
    reaches = downstream_reaches_water(flow_to, safe_z, water)

    accumulation_norm = np.log1p(accumulation) / max(float(np.log1p(np.nanmax(accumulation))), 1e-9)
    slope_norm = np.clip(slope / math.radians(34.0), 0.0, 1.0)
    erosion_score = accumulation_norm * (0.35 + 0.65 * slope_norm)
    eligible = valid & ~water
    channel_threshold = max(float(np.nanpercentile(erosion_score[eligible], 86.0)), 0.24)
    erosion_channel = eligible & reaches & (erosion_score >= channel_threshold)
    erosion_core = erosion_channel & (erosion_score >= max(channel_threshold * 1.22, 0.38))
    erosion_depth = np.where(erosion_channel, np.clip((erosion_score - channel_threshold) * 22.0, 0.0, 8.5), 0.0)

    noise = world_fbm(spec)
    slope_rock = np.clip((slope - math.radians(19.0)) / math.radians(24.0), 0.0, 1.0)
    convexity = _normalise_finite(np.maximum(-curvature, 0.0))
    rel_norm = _normalise_finite(relative)
    x, y = spec.world_mesh()
    strata = 0.5 + 0.5 * np.sin((x * 0.0075 + y * 0.0023) + noise * 4.0)
    rock_score = 0.49 * slope_rock + 0.19 * convexity + 0.16 * rel_norm + 0.10 * noise + 0.06 * strata
    rock = eligible & (rock_score >= 0.54)
    rock_core = eligible & (rock_score >= 0.68)

    broad = _smooth_box(safe_z, max(3, int(round(160.0 / max(spec.dx, spec.dy)))))
    local_rel = safe_z - broad
    ridge = valid & (local_rel >= np.nanpercentile(local_rel[valid], 84.0)) & (relative > 2.0)
    valley = valid & (local_rel <= np.nanpercentile(local_rel[valid], 34.0))
    landform = np.full(z.shape, LAND_["mid_slope"], dtype=np.uint8)
    landform[valley & (slope < math.radians(4.0))] = LAND_["valley_floor"]
    landform[valley & (slope >= math.radians(4.0)) & (slope < math.radians(10.0))] = LAND_["alluvial_terrace"]
    landform[(~valley) & (slope < math.radians(12.0)) & (local_rel < 5.0)] = LAND_["footslope"]
    landform[slope >= math.radians(25.0)] = LAND_["upper_slope"]
    landform[ridge] = LAND_["ridge_peak"]
    landform[rock_core] = LAND_["karst_cliff"]
    landform[erosion_channel] = LAND_["erosion_channel"]
    landform[active_bank] = LAND_["active_bank"]
    landform[water] = LAND_["water"]

    exclusion = np.zeros(z.shape, dtype=np.uint16)
    exclusion[water] |= EXCLUSION_BITS["permanent_water"]
    exclusion[active_bank] |= EXCLUSION_BITS["active_bank"]
    exclusion[rock_core] |= EXCLUSION_BITS["karst_rock_core"]
    exclusion[erosion_core] |= EXCLUSION_BITS["erosion_core"]
    exclusion[ridge] |= EXCLUSION_BITS["ridge_peak"]
    exclusion[~valid] |= EXCLUSION_BITS["nodata"]

    if array_sha256(z) != truth_hash_before:
        raise AssertionError("z_truth_m changed during compilation")
    return TerrainFields(
        z_truth_m=z.copy(),
        slope_rad=slope.astype(np.float32),
        aspect_rad=aspect.astype(np.float32),
        curvature=curvature.astype(np.float32),
        relative_elevation_m=relative.astype(np.float32),
        permanent_water_mask=water.astype(np.uint8),
        active_bank_mask=active_bank.astype(np.uint8),
        distance_to_water_m=distance.astype(np.float32),
        flow_to_index=flow_to.astype(np.int32),
        flow_direction_xy=flow_direction,
        flow_accumulation=accumulation.astype(np.float32),
        reaches_permanent_water=reaches.astype(np.uint8),
        erosion_channel_mask=erosion_channel.astype(np.uint8),
        erosion_core_mask=erosion_core.astype(np.uint8),
        erosion_depth_m=erosion_depth.astype(np.float32),
        karst_rock_mask=rock.astype(np.uint8),
        karst_rock_core_mask=rock_core.astype(np.uint8),
        landform_class=landform,
        hard_exclusion_mask=exclusion,
    )


def write_release(fields: TerrainFields, spec: GridSpec, output_dir: Path, source: Mapping[str, Any]) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    arrays_meta: dict[str, Any] = {}
    for name, array in fields.arrays().items():
        path = output_dir / f"{name}.npy"
        np.save(path, np.ascontiguousarray(array), allow_pickle=False)
        arrays_meta[name] = {
            "path": path.name,
            "dtype": array.dtype.str,
            "shape": list(array.shape),
            "sha256": file_sha256(path),
            "semantic_sha256": array_sha256(array),
        }
    manifest = {
        "schema": "dem_terrain_fields@1.0",
        "version": FIELD_VERSION,
        "crs": spec.crs,
        "boundsProjected": list(spec.bounds),
        "grid": {"width": spec.width, "height": spec.height, "dxM": spec.dx, "dyM": spec.dy},
        "source": dict(source),
        "truthPolicy": {
            "zTruthReadOnly": True,
            "erosionStoredSeparately": "erosion_depth_m",
            "visualHeightFormula": "z_truth_m - erosion_depth_m + approved_micro_delta_m",
        },
        "landformClasses": LAND_,
        "hardExclusionBits": EXCLUSION_BITS,
        "fields": arrays_meta,
        "validation": {
            "waterCells": int(np.count_nonzero(fields.permanent_water_mask)),
            "activeBankCells": int(np.count_nonzero(fields.active_bank_mask)),
            "erosionChannelCells": int(np.count_nonzero(fields.erosion_channel_mask)),
            "karstRockCells": int(np.count_nonzero(fields.karst_rock_mask)),
            "karstRockCoreCells": int(np.count_nonzero(fields.karst_rock_core_mask)),
            "truthSemanticSha256": array_sha256(fields.z_truth_m),
            "waterHardExclusionMissing": int(np.count_nonzero((fields.permanent_water_mask > 0) & ((fields.hard_exclusion_mask & EXCLUSION_BITS["permanent_water"]) == 0))),
        },
    }
    manifest_path = output_dir / "terrain-fields-manifest.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return manifest_path


def _parse_bounds(text: str) -> tuple[float, float, float, float]:
    values = tuple(float(v.strip()) for v in text.split(","))
    if len(values) != 4:
        raise argparse.ArgumentTypeError("bounds must be xmin,ymin,xmax,ymax")
    return values  # type: ignore[return-value]


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--height-grid", type=Path, required=True)
    parser.add_argument("--release-manifest", type=Path)
    parser.add_argument("--waterways", type=Path)
    parser.add_argument("--water-mask", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--bounds", type=_parse_bounds)
    parser.add_argument("--crs", default="LOCAL")
    parser.add_argument("--channel-half-width-m", type=float, default=11.0)
    parser.add_argument("--active-bank-width-m", type=float, default=24.0)
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    if args.release_manifest:
        release = load_release_manifest(args.release_manifest)
        if args.height_grid.suffix.lower() == ".u16":
            z, spec = load_u16_height_grid(args.height_grid, release)
        else:
            aoi = release["aoi"]
            grid = int(release["terrain"]["grid"])
            spec = GridSpec(grid, grid, tuple(aoi["boundsProjected"]), aoi["crs"])
            z, spec = load_float_grid(args.height_grid, spec)
        source = {
            "heightGrid": str(args.height_grid),
            "heightGridSha256": file_sha256(args.height_grid),
            "releaseManifest": str(args.release_manifest),
            "releaseManifestSha256": file_sha256(args.release_manifest),
        }
    else:
        z, inferred = load_float_grid(args.height_grid)
        bounds = args.bounds or inferred.bounds
        spec = GridSpec(z.shape[1], z.shape[0], bounds, args.crs)
        source = {"heightGrid": str(args.height_grid), "heightGridSha256": file_sha256(args.height_grid)}

    if args.water_mask:
        water = np.asarray(np.load(args.water_mask), dtype=bool)
        source["waterMask"] = str(args.water_mask)
        source["waterMaskSha256"] = file_sha256(args.water_mask)
    elif args.waterways:
        water = rasterize_waterways(args.waterways, spec, channel_half_width_m=args.channel_half_width_m)
        source["waterways"] = str(args.waterways)
        source["waterwaysSha256"] = file_sha256(args.waterways)
    else:
        raise SystemExit("provide --water-mask or --waterways")

    fields = compile_fields(z, spec, water, active_bank_width_m=args.active_bank_width_m)
    manifest = write_release(fields, spec, args.output, source)
    print(json.dumps({"status": "ok", "manifest": str(manifest), "truthSha256": array_sha256(fields.z_truth_m)}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
