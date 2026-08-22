#!/usr/bin/env python3
"""Deterministic terrain-field compiler for the Guilin DEM ecology v0.4 contract.

The compiler keeps the source truth elevation immutable and derives reversible
hydrology, erosion, karst, landform, and hard-exclusion fields. It uses the
Python standard library for core algorithms. pyproj is only used when WGS84
waterway GeoJSON must be projected into the grid CRS.
"""
from __future__ import annotations

import argparse
import array
import hashlib
import heapq
import json
import math
import sys
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Iterable, Mapping, Sequence

SCHEMA_VERSION = "dem_terrain_fields@0.4.0"
SQRT2 = math.sqrt(2.0)
D8: tuple[tuple[int, int, float], ...] = (
    (-1, -1, SQRT2),
    (0, -1, 1.0),
    (1, -1, SQRT2),
    (-1, 0, 1.0),
    (1, 0, 1.0),
    (-1, 1, SQRT2),
    (0, 1, 1.0),
    (1, 1, SQRT2),
)
LANDFORM_NAMES = {
    0: "permanent_water",
    1: "active_bank",
    2: "floodplain",
    3: "alluvial_terrace",
    4: "footslope",
    5: "mid_slope",
    6: "ridge_or_peak",
    7: "karst_cliff",
    8: "high_plateau_or_shoulder",
}


@dataclass(frozen=True)
class GridSpec:
    width: int
    height: int
    cell_size_m: float
    min_elevation_m: float
    max_elevation_m: float
    crs: str = "EPSG:32649"
    bounds_projected: tuple[float, float, float, float] | None = None
    origin_col: int = 0
    origin_row: int = 0

    @property
    def size(self) -> int:
        return self.width * self.height


@dataclass(frozen=True)
class CompilerConfig:
    bank_width_m: float = 18.0
    floodplain_distance_m: float = 180.0
    terrace_distance_m: float = 520.0
    erosion_accumulation_threshold: float = 24.0
    erosion_min_slope_deg: float = 1.25
    erosion_max_depth_m: float = 9.0
    rock_slope_deg: float = 21.0
    rock_core_slope_deg: float = 34.0
    rock_relief_m: float = 14.0
    rock_core_relief_m: float = 24.0
    seed: int = 1944


class TerrainFieldError(ValueError):
    """Raised when the input contract is invalid."""


def canonical_json_bytes(value: Any) -> bytes:
    return json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        allow_nan=False,
    ).encode("utf-8")


def canonical_sha256(value: Any) -> str:
    return hashlib.sha256(canonical_json_bytes(value)).hexdigest()


def truth_digest(elevations_m: Sequence[float]) -> str:
    payload = array.array("d", (float(value) for value in elevations_m))
    if sys.byteorder != "little":
        payload.byteswap()
    return hashlib.sha256(payload.tobytes()).hexdigest()


def _validate_inputs(
    elevations_m: Sequence[float], water_mask: Sequence[int | bool], spec: GridSpec
) -> None:
    if spec.width < 2 or spec.height < 2:
        raise TerrainFieldError("grid width and height must both be at least 2")
    if spec.cell_size_m <= 0:
        raise TerrainFieldError("cell_size_m must be positive")
    if len(elevations_m) != spec.size:
        raise TerrainFieldError(
            f"elevation length {len(elevations_m)} does not match grid size {spec.size}"
        )
    if len(water_mask) != spec.size:
        raise TerrainFieldError(
            f"water-mask length {len(water_mask)} does not match grid size {spec.size}"
        )
    for index, value in enumerate(elevations_m):
        if not math.isfinite(float(value)):
            raise TerrainFieldError(f"non-finite elevation at index {index}")


def _xy(index: int, width: int) -> tuple[int, int]:
    return index % width, index // width


def _index(x: int, y: int, width: int) -> int:
    return y * width + x


def _neighbors(index: int, spec: GridSpec) -> Iterable[tuple[int, float, int]]:
    x, y = _xy(index, spec.width)
    for direction, (dx, dy, distance_cells) in enumerate(D8):
        nx = x + dx
        ny = y + dy
        if 0 <= nx < spec.width and 0 <= ny < spec.height:
            yield _index(nx, ny, spec.width), distance_cells * spec.cell_size_m, direction


def _stable_noise01(global_x: int, global_y: int, seed: int) -> float:
    digest = hashlib.blake2b(
        f"{seed}:{global_x}:{global_y}".encode("ascii"), digest_size=8
    ).digest()
    return int.from_bytes(digest, "little") / float(2**64 - 1)


def compute_slope_curvature_relief(
    elevations_m: Sequence[float], spec: GridSpec
) -> tuple[list[float], list[float], list[float]]:
    slopes: list[float] = [0.0] * spec.size
    curvature: list[float] = [0.0] * spec.size
    relief: list[float] = [0.0] * spec.size
    for idx, elevation in enumerate(elevations_m):
        neighbour_values: list[float] = []
        max_gradient = 0.0
        for neighbour, distance_m, _ in _neighbors(idx, spec):
            other = float(elevations_m[neighbour])
            neighbour_values.append(other)
            max_gradient = max(max_gradient, abs(other - float(elevation)) / distance_m)
        slopes[idx] = math.degrees(math.atan(max_gradient))
        if neighbour_values:
            mean_neighbour = sum(neighbour_values) / len(neighbour_values)
            curvature[idx] = float(elevation) - mean_neighbour
            relief[idx] = max(neighbour_values + [float(elevation)]) - min(
                neighbour_values + [float(elevation)]
            )
    return slopes, curvature, relief


def compute_flow_direction(
    elevations_m: Sequence[float], water_mask: Sequence[int | bool], spec: GridSpec
) -> tuple[list[int], list[int]]:
    downstream: list[int] = [-1] * spec.size
    direction_code: list[int] = [-1] * spec.size
    for idx, elevation in enumerate(elevations_m):
        if bool(water_mask[idx]):
            continue
        best: tuple[float, int, int] | None = None
        for neighbour, distance_m, direction in _neighbors(idx, spec):
            drop = float(elevation) - float(elevations_m[neighbour])
            if drop <= 0:
                continue
            gradient = drop / distance_m
            candidate = (gradient, -direction, neighbour)
            if best is None or candidate > best:
                best = candidate
        if best is not None:
            downstream[idx] = best[2]
            direction_code[idx] = -best[1]
    return downstream, direction_code


def compute_flow_accumulation(
    elevations_m: Sequence[float], downstream: Sequence[int]
) -> list[float]:
    accumulation = [1.0] * len(elevations_m)
    order = sorted(range(len(elevations_m)), key=lambda i: (-float(elevations_m[i]), i))
    for idx in order:
        target = int(downstream[idx])
        if target >= 0:
            accumulation[target] += accumulation[idx]
    return accumulation


def compute_drains_to_water(
    downstream: Sequence[int], water_mask: Sequence[int | bool]
) -> list[bool]:
    state = [0] * len(downstream)
    result = [False] * len(downstream)
    for start in range(len(downstream)):
        if state[start] == 2:
            continue
        path: list[int] = []
        seen: set[int] = set()
        current = start
        terminal = False
        while current >= 0:
            if bool(water_mask[current]):
                terminal = True
                break
            if state[current] == 2:
                terminal = result[current]
                break
            if current in seen:
                terminal = False
                break
            seen.add(current)
            path.append(current)
            state[current] = 1
            current = int(downstream[current])
        for node in reversed(path):
            result[node] = terminal
            state[node] = 2
        if bool(water_mask[start]):
            result[start] = True
            state[start] = 2
    return result


def compute_distance_to_water(
    water_mask: Sequence[int | bool], spec: GridSpec
) -> list[float]:
    distances = [math.inf] * spec.size
    queue: list[tuple[float, int]] = []
    for idx, is_water in enumerate(water_mask):
        if bool(is_water):
            distances[idx] = 0.0
            heapq.heappush(queue, (0.0, idx))
    if not queue:
        return distances
    while queue:
        distance, idx = heapq.heappop(queue)
        if distance != distances[idx]:
            continue
        for neighbour, step_m, _ in _neighbors(idx, spec):
            candidate = distance + step_m
            if candidate + 1e-12 < distances[neighbour]:
                distances[neighbour] = candidate
                heapq.heappush(queue, (candidate, neighbour))
    return distances


def classify_landforms(
    elevations_m: Sequence[float],
    slopes_deg: Sequence[float],
    relief_m: Sequence[float],
    distance_to_water_m: Sequence[float],
    water_mask: Sequence[int | bool],
    active_bank_mask: Sequence[int],
    rock_core_mask: Sequence[int],
    spec: GridSpec,
    config: CompilerConfig,
) -> list[int]:
    minimum = min(float(v) for v in elevations_m)
    maximum = max(float(v) for v in elevations_m)
    span = max(maximum - minimum, 1e-9)
    classes: list[int] = [5] * spec.size
    for idx, elevation in enumerate(elevations_m):
        slope = float(slopes_deg[idx])
        relative = (float(elevation) - minimum) / span
        distance = float(distance_to_water_m[idx])
        if bool(water_mask[idx]):
            classes[idx] = 0
        elif bool(active_bank_mask[idx]):
            classes[idx] = 1
        elif bool(rock_core_mask[idx]) or slope >= 44.0:
            classes[idx] = 7
        elif slope <= 3.5 and distance <= config.floodplain_distance_m:
            classes[idx] = 2
        elif slope <= 8.0 and distance <= config.terrace_distance_m:
            classes[idx] = 3
        elif slope <= 5.0 and relative >= 0.58:
            classes[idx] = 8
        elif relative >= 0.76 and (slope <= 28.0 or relief_m[idx] <= 12.0):
            classes[idx] = 6
        elif slope <= 15.0 and relative <= 0.48:
            classes[idx] = 4
        else:
            classes[idx] = 5
    return classes


def compile_terrain_fields(
    elevations_m: Sequence[float],
    water_mask: Sequence[int | bool],
    spec: GridSpec,
    config: CompilerConfig | None = None,
) -> dict[str, Any]:
    """Compile deterministic v0.4 terrain fields without mutating truth elevation."""
    config = config or CompilerConfig()
    _validate_inputs(elevations_m, water_mask, spec)
    truth = tuple(float(value) for value in elevations_m)
    truth_before = truth_digest(truth)
    water = [1 if bool(value) else 0 for value in water_mask]

    slopes, curvature, relief = compute_slope_curvature_relief(truth, spec)
    downstream, flow_direction = compute_flow_direction(truth, water, spec)
    accumulation = compute_flow_accumulation(truth, downstream)
    drains_to_water = compute_drains_to_water(downstream, water)
    distance_to_water = compute_distance_to_water(water, spec)

    active_bank = [
        1 if not water[idx] and distance_to_water[idx] <= config.bank_width_m else 0
        for idx in range(spec.size)
    ]
    minimum = min(truth)
    maximum = max(truth)
    span = max(maximum - minimum, 1e-9)
    rock_mask: list[int] = [0] * spec.size
    rock_core: list[int] = [0] * spec.size
    for idx, elevation in enumerate(truth):
        x, y = _xy(idx, spec.width)
        global_x = spec.origin_col + x
        global_y = spec.origin_row + y
        noise = _stable_noise01(global_x, global_y, config.seed)
        relative = (elevation - minimum) / span
        convexity = max(0.0, curvature[idx])
        exposed = (
            slopes[idx] >= config.rock_slope_deg
            and relief[idx] >= config.rock_relief_m
            and relative >= 0.14
            and (convexity >= 0.25 or noise >= 0.28)
        )
        core = (
            slopes[idx] >= config.rock_core_slope_deg
            and relief[idx] >= config.rock_core_relief_m
            and relative >= 0.18
            and (convexity >= 0.7 or noise >= 0.52)
        )
        rock_mask[idx] = int(exposed or core)
        rock_core[idx] = int(core)

    erosion_channel: list[int] = [0] * spec.size
    erosion_depth: list[float] = [0.0] * spec.size
    for idx in range(spec.size):
        if water[idx] or rock_core[idx] or not drains_to_water[idx]:
            continue
        qualifies = (
            accumulation[idx] >= config.erosion_accumulation_threshold
            and slopes[idx] >= config.erosion_min_slope_deg
        )
        if not qualifies:
            continue
        erosion_channel[idx] = 1
        accumulation_factor = min(
            1.0,
            math.log1p(accumulation[idx])
            / math.log1p(max(config.erosion_accumulation_threshold * 32.0, 2.0)),
        )
        slope_factor = min(1.0, slopes[idx] / 32.0)
        erosion_depth[idx] = round(
            config.erosion_max_depth_m * accumulation_factor * (0.35 + 0.65 * slope_factor),
            6,
        )

    landforms = classify_landforms(
        truth,
        slopes,
        relief,
        distance_to_water,
        water,
        active_bank,
        rock_core,
        spec,
        config,
    )
    hard_exclusion = [
        1 if water[idx] or rock_core[idx] else 0 for idx in range(spec.size)
    ]

    truth_after = truth_digest(truth)
    if truth_before != truth_after:
        raise AssertionError("truth elevation changed during field compilation")

    fields: dict[str, Any] = {
        "permanent_water_mask": water,
        "active_bank_mask": active_bank,
        "distance_to_water_m": [
            None if math.isinf(value) else round(value, 6) for value in distance_to_water
        ],
        "flow_direction_d8": flow_direction,
        "flow_downstream_index": downstream,
        "flow_accumulation": [round(value, 6) for value in accumulation],
        "drains_to_permanent_water": [int(value) for value in drains_to_water],
        "slope_deg": [round(value, 6) for value in slopes],
        "curvature_m": [round(value, 6) for value in curvature],
        "local_relief_m": [round(value, 6) for value in relief],
        "erosion_channel_mask": erosion_channel,
        "erosion_depth_m": erosion_depth,
        "karst_rock_mask": rock_mask,
        "karst_rock_core_mask": rock_core,
        "landform_class": landforms,
        "hard_exclusion_mask": hard_exclusion,
    }
    field_checksums = {
        name: canonical_sha256(values) for name, values in sorted(fields.items())
    }
    manifest = {
        "schema": SCHEMA_VERSION,
        "grid": asdict(spec),
        "compiler_config": asdict(config),
        "truth": {
            "immutable": True,
            "sha256_before": truth_before,
            "sha256_after": truth_after,
        },
        "field_checksums": field_checksums,
        "statistics": {
            "water_cells": sum(water),
            "active_bank_cells": sum(active_bank),
            "erosion_channel_cells": sum(erosion_channel),
            "rock_cells": sum(rock_mask),
            "rock_core_cells": sum(rock_core),
            "hard_exclusion_cells": sum(hard_exclusion),
            "max_flow_accumulation": max(accumulation),
            "max_erosion_depth_m": max(erosion_depth),
        },
        "landform_classes": {str(key): value for key, value in LANDFORM_NAMES.items()},
    }
    release = {"manifest": manifest, "fields": fields}
    manifest["release_sha256"] = canonical_sha256(release)
    return release


def read_u16_height_grid(
    path: Path, spec: GridSpec, byte_order: str = "little"
) -> list[float]:
    payload = path.read_bytes()
    expected = spec.size * 2
    if len(payload) != expected:
        raise TerrainFieldError(
            f"height-grid byte length {len(payload)} does not match expected {expected}"
        )
    values = array.array("H")
    values.frombytes(payload)
    native_little = sys.byteorder == "little"
    if (byte_order == "little") != native_little:
        values.byteswap()
    scale = (spec.max_elevation_m - spec.min_elevation_m) / 65535.0
    return [spec.min_elevation_m + int(value) * scale for value in values]


def read_water_mask(path: Path, spec: GridSpec) -> list[int]:
    if path.suffix.lower() == ".json":
        value = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(value, Mapping):
            value = value.get("mask", value.get("permanent_water_mask"))
        if not isinstance(value, list):
            raise TerrainFieldError("water-mask JSON must contain a list")
        mask = [1 if bool(item) else 0 for item in value]
    else:
        payload = path.read_bytes()
        mask = [1 if byte else 0 for byte in payload]
    if len(mask) != spec.size:
        raise TerrainFieldError("water-mask size does not match grid")
    return mask


def _iter_geojson_lines(geometry: Mapping[str, Any]) -> Iterable[list[list[float]]]:
    geometry_type = geometry.get("type")
    coordinates = geometry.get("coordinates")
    if geometry_type == "LineString" and isinstance(coordinates, list):
        yield coordinates
    elif geometry_type == "MultiLineString" and isinstance(coordinates, list):
        for line in coordinates:
            if isinstance(line, list):
                yield line
    elif geometry_type == "GeometryCollection":
        for child in geometry.get("geometries", []):
            if isinstance(child, Mapping):
                yield from _iter_geojson_lines(child)


def _bresenham(x0: int, y0: int, x1: int, y1: int) -> Iterable[tuple[int, int]]:
    dx = abs(x1 - x0)
    sx = 1 if x0 < x1 else -1
    dy = -abs(y1 - y0)
    sy = 1 if y0 < y1 else -1
    error = dx + dy
    while True:
        yield x0, y0
        if x0 == x1 and y0 == y1:
            return
        twice = 2 * error
        if twice >= dy:
            error += dy
            x0 += sx
        if twice <= dx:
            error += dx
            y0 += sy


def rasterize_waterways_geojson(path: Path, spec: GridSpec) -> list[int]:
    if spec.bounds_projected is None:
        raise TerrainFieldError("bounds_projected is required for GeoJSON rasterization")
    document = json.loads(path.read_text(encoding="utf-8"))
    features = document.get("features", []) if document.get("type") == "FeatureCollection" else []
    xmin, ymin, xmax, ymax = spec.bounds_projected
    if not (xmax > xmin and ymax > ymin):
        raise TerrainFieldError("invalid projected bounds")

    transformer = None

    def project(point: Sequence[float]) -> tuple[float, float]:
        nonlocal transformer
        x = float(point[0])
        y = float(point[1])
        if abs(x) <= 180.0 and abs(y) <= 90.0 and spec.crs.upper() != "EPSG:4326":
            if transformer is None:
                try:
                    from pyproj import Transformer  # type: ignore
                except ImportError as exc:
                    raise TerrainFieldError(
                        "pyproj is required to project WGS84 waterways"
                    ) from exc
                transformer = Transformer.from_crs("EPSG:4326", spec.crs, always_xy=True)
            x, y = transformer.transform(x, y)
        return x, y

    def pixel(point: Sequence[float]) -> tuple[int, int]:
        x, y = project(point)
        col = round((x - xmin) / (xmax - xmin) * (spec.width - 1))
        row = round((ymax - y) / (ymax - ymin) * (spec.height - 1))
        return int(col), int(row)

    mask = [0] * spec.size
    for feature in features:
        geometry = feature.get("geometry") if isinstance(feature, Mapping) else None
        if not isinstance(geometry, Mapping):
            continue
        for line in _iter_geojson_lines(geometry):
            if len(line) < 2:
                continue
            for first, second in zip(line, line[1:]):
                x0, y0 = pixel(first)
                x1, y1 = pixel(second)
                for x, y in _bresenham(x0, y0, x1, y1):
                    if 0 <= x < spec.width and 0 <= y < spec.height:
                        mask[_index(x, y, spec.width)] = 1
    return mask


def _parse_bounds(value: str | None) -> tuple[float, float, float, float] | None:
    if value is None:
        return None
    parts = [float(part.strip()) for part in value.split(",")]
    if len(parts) != 4:
        raise TerrainFieldError("bounds must be xmin,ymin,xmax,ymax")
    return parts[0], parts[1], parts[2], parts[3]


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--height-grid", required=True, type=Path)
    water = parser.add_mutually_exclusive_group(required=True)
    water.add_argument("--water-mask", type=Path)
    water.add_argument("--waterways-geojson", type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--width", required=True, type=int)
    parser.add_argument("--height", required=True, type=int)
    parser.add_argument("--cell-size-m", required=True, type=float)
    parser.add_argument("--min-elevation-m", required=True, type=float)
    parser.add_argument("--max-elevation-m", required=True, type=float)
    parser.add_argument("--crs", default="EPSG:32649")
    parser.add_argument("--bounds", help="xmin,ymin,xmax,ymax in projected CRS")
    parser.add_argument("--origin-col", type=int, default=0)
    parser.add_argument("--origin-row", type=int, default=0)
    parser.add_argument("--seed", type=int, default=1944)
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    spec = GridSpec(
        width=args.width,
        height=args.height,
        cell_size_m=args.cell_size_m,
        min_elevation_m=args.min_elevation_m,
        max_elevation_m=args.max_elevation_m,
        crs=args.crs,
        bounds_projected=_parse_bounds(args.bounds),
        origin_col=args.origin_col,
        origin_row=args.origin_row,
    )
    elevations = read_u16_height_grid(args.height_grid, spec)
    if args.water_mask:
        water_mask = read_water_mask(args.water_mask, spec)
    else:
        water_mask = rasterize_waterways_geojson(args.waterways_geojson, spec)
    release = compile_terrain_fields(
        elevations, water_mask, spec, CompilerConfig(seed=args.seed)
    )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(release, ensure_ascii=False, sort_keys=True, indent=2) + "\n",
        encoding="utf-8",
    )
    print(
        json.dumps(
            {
                "output": str(args.output),
                "release_sha256": release["manifest"]["release_sha256"],
                "statistics": release["manifest"]["statistics"],
            },
            ensure_ascii=False,
            sort_keys=True,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
