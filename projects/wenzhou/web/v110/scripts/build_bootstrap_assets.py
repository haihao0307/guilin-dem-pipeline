#!/usr/bin/env python3
"""Build the first truthful Wenzhou v1.1 GPU runtime assets.

This builder reads only the archived authoritative land COG, archived marine mask,
verified GEBCO 2026 bathymetry COG and projected OSM coastline/waterway files.
It does not invent terrain and it never modifies the truth rasters.
"""

from __future__ import annotations

import hashlib
import json
import math
import struct
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable, Iterator, Sequence

import numpy as np
import rasterio
from PIL import Image
from rasterio.enums import Resampling
from rasterio.warp import transform_bounds

ROOT = Path(__file__).resolve().parents[5]
LAND = ROOT / "projects/wenzhou/archive/truth/WENZHOU_QINGJIANG_22000KM2_12_5M_COG.tif"
MARINE = ROOT / "projects/wenzhou/archive/truth/evidence/WENZHOU_QINGJIANG_marine_mask_COG.tif"
BATHY = ROOT / "projects/wenzhou/coastal/data/derived/WENZHOU_COASTAL_BATHY_100M_EPSG32651_COG.tif"
COAST = ROOT / "projects/wenzhou/coastal/data/hydrology/osm/WENZHOU_COASTLINE_EPSG32651.geojson"
RIVERS = ROOT / "projects/wenzhou/coastal/data/hydrology/osm/WENZHOU_RIVER_CENTERLINES_EPSG32651.geojson"

OUT = ROOT / "web/wenzhou-v110/assets/bootstrap"
REPORT = ROOT / "projects/wenzhou/reports/WENZHOU_V110_BOOTSTRAP_ASSET_BUILD.json"

EXPECTED = {
    LAND: {
        "bytes": 54_638_031,
        "sha256": "8a1bc6ee17dd731007804a0281f9e083e01f5745468f90cf2c11c108ec0b1c6e",
    },
    BATHY: {
        "bytes": 17_637_178,
        "sha256": "591e92eef61699088a87e32bfd83417498f89cfe3a6a84f4ce6a2e2ac3b689fc",
    },
    COAST: {
        "sha256": "5cfeb0465df59590c78c6b163f60ae8764731e1ea65e3adcbc5052813b299181",
    },
    RIVERS: {
        "sha256": "585220c369ed8ec6b588f1913489870c585cc98ddd7c5357beaff9ddaae7a9d9",
    },
}

LAND_GRID = 513
LAND_TEXTURE = 2048
BATHY_GRID = 257
COAST_SIMPLIFY_M = 180.0
RIVER_SIMPLIFY_M = 45.0
MAX_RIVER_PARTS = 2600


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(8 * 1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def file_record(path: Path, role: str) -> dict[str, Any]:
    return {
        "path": str(path.relative_to(ROOT)).replace("\\", "/"),
        "role": role,
        "bytes": path.stat().st_size,
        "sha256": sha256_file(path),
    }


def require_file(path: Path) -> dict[str, Any]:
    if not path.is_file():
        raise FileNotFoundError(path)
    expected = EXPECTED.get(path, {})
    size = path.stat().st_size
    if "bytes" in expected and size != expected["bytes"]:
        raise RuntimeError(f"Unexpected byte count for {path}: {size}")
    digest = sha256_file(path)
    if "sha256" in expected and digest != expected["sha256"]:
        raise RuntimeError(f"Unexpected SHA-256 for {path}: {digest}")
    return {"path": str(path.relative_to(ROOT)), "bytes": size, "sha256": digest}


def read_resampled(path: Path, height: int, width: int, resampling: Resampling) -> np.ndarray:
    with rasterio.open(path) as src:
        array = src.read(
            1,
            out_shape=(height, width),
            resampling=resampling,
            masked=True,
        )
        result = np.asarray(array.filled(np.nan), dtype=np.float32)
        nodata = src.nodata
        if nodata is not None:
            result[np.isclose(result, nodata)] = np.nan
        return result


def quantize_u16(array: np.ndarray, minimum: float, maximum: float) -> np.ndarray:
    if maximum <= minimum:
        raise ValueError("Invalid quantization range")
    finite = np.nan_to_num(array, nan=minimum, posinf=maximum, neginf=minimum)
    normalized = np.clip((finite - minimum) / (maximum - minimum), 0.0, 1.0)
    return np.rint(normalized * 65535.0).astype("<u2")


def write_binary(path: Path, array: np.ndarray) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(array.tobytes(order="C"))


def normalized_noise(height: int, width: int, seed: int = 510) -> np.ndarray:
    rng = np.random.default_rng(seed)
    coarse = rng.random((33, 33), dtype=np.float32)
    image = Image.fromarray(np.uint8(np.clip(coarse, 0, 1) * 255), mode="L")
    resized = image.resize((width, height), Image.Resampling.BICUBIC)
    return np.asarray(resized, dtype=np.float32) / 255.0


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
    shade = np.clip((shade + 0.25) / 1.25, 0.0, 1.0)
    return shade.astype(np.float32), np.clip(np.tan(slope), 0, 3).astype(np.float32)


def mix(a: np.ndarray, b: np.ndarray, t: np.ndarray) -> np.ndarray:
    return a * (1.0 - t[..., None]) + b * t[..., None]


def build_satellite_color(
    elevation: np.ndarray,
    marine: np.ndarray,
    pixel_x: float,
    pixel_y: float,
) -> np.ndarray:
    elevation = np.nan_to_num(elevation, nan=0.0)
    marine_mask = np.nan_to_num(marine, nan=0.0) > 0.5
    shade, slope = hillshade(elevation, pixel_x, pixel_y)
    noise = normalized_noise(elevation.shape[0], elevation.shape[1])

    land_e = np.clip(elevation, 0, 1400)
    e = land_e / 1400.0
    low = np.array([0.27, 0.36, 0.20], dtype=np.float32)
    mid = np.array([0.20, 0.31, 0.18], dtype=np.float32)
    high = np.array([0.42, 0.43, 0.38], dtype=np.float32)
    rock = np.array([0.53, 0.53, 0.49], dtype=np.float32)
    sediment = np.array([0.47, 0.43, 0.31], dtype=np.float32)

    land = mix(np.broadcast_to(low, (*e.shape, 3)), np.broadcast_to(mid, (*e.shape, 3)), np.clip(e / 0.45, 0, 1))
    land = mix(land, np.broadcast_to(high, (*e.shape, 3)), np.clip((e - 0.35) / 0.5, 0, 1))
    rock_weight = np.clip((slope - 0.32) / 0.9, 0, 1) * np.clip((e + 0.12), 0, 1)
    land = mix(land, np.broadcast_to(rock, (*e.shape, 3)), rock_weight * 0.72)
    sediment_weight = np.clip((0.08 - e) / 0.08, 0, 1) * np.clip((0.18 - slope) / 0.18, 0, 1)
    land = mix(land, np.broadcast_to(sediment, (*e.shape, 3)), sediment_weight * 0.28)
    land *= (0.68 + shade[..., None] * 0.48)
    land *= (0.94 + (noise[..., None] - 0.5) * 0.09)

    rows = np.linspace(0, 1, elevation.shape[0], dtype=np.float32)[:, None]
    cols = np.linspace(0, 1, elevation.shape[1], dtype=np.float32)[None, :]
    sea_variation = 0.04 * np.sin(cols * math.pi * 5.0) + 0.025 * np.cos(rows * math.pi * 4.0)
    sea_depth_hint = np.clip(0.55 + sea_variation, 0, 1)
    shallow = np.array([0.16, 0.35, 0.38], dtype=np.float32)
    deep = np.array([0.08, 0.21, 0.30], dtype=np.float32)
    sea = mix(
        np.broadcast_to(shallow, (*e.shape, 3)),
        np.broadcast_to(deep, (*e.shape, 3)),
        sea_depth_hint,
    )
    sea *= (0.96 + (noise[..., None] - 0.5) * 0.035)

    color = np.where(marine_mask[..., None], sea, land)
    color = np.clip(np.power(color, 0.92), 0, 1)
    return np.uint8(np.rint(color * 255.0))


def image_save(path: Path, array: np.ndarray, mode: str, fmt: str, **kwargs: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(array, mode=mode).save(path, format=fmt, **kwargs)


def point_segment_distance(point: Sequence[float], start: Sequence[float], end: Sequence[float]) -> float:
    px, py = point
    x1, y1 = start
    x2, y2 = end
    dx = x2 - x1
    dy = y2 - y1
    if dx == 0 and dy == 0:
        return math.hypot(px - x1, py - y1)
    t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)
    t = max(0.0, min(1.0, t))
    return math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))


def simplify_rdp(points: Sequence[Sequence[float]], tolerance: float) -> list[list[float]]:
    clean = [[float(p[0]), float(p[1])] for p in points if len(p) >= 2]
    if len(clean) <= 2:
        return clean
    first = clean[0]
    last = clean[-1]
    max_distance = -1.0
    index = -1
    for i in range(1, len(clean) - 1):
        distance = point_segment_distance(clean[i], first, last)
        if distance > max_distance:
            max_distance = distance
            index = i
    if max_distance > tolerance and index > 0:
        left = simplify_rdp(clean[: index + 1], tolerance)
        right = simplify_rdp(clean[index:], tolerance)
        return left[:-1] + right
    return [first, last]


def iter_parts(geometry: dict[str, Any]) -> Iterator[list[list[float]]]:
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


def line_length(points: Sequence[Sequence[float]]) -> float:
    return sum(
        math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1])
        for i in range(1, len(points))
    )


def load_geojson(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def combined_name(properties: dict[str, Any]) -> str:
    for key in ("name", "name:zh", "name_zh", "local_name", "alt_name"):
        value = properties.get(key)
        if value:
            return str(value)
    return ""


def waterway_width(properties: dict[str, Any], kind: str) -> float:
    raw = properties.get("width")
    if raw is not None:
        digits = "".join(ch if (ch.isdigit() or ch in ".-") else " " for ch in str(raw)).split()
        if digits:
            try:
                value = float(digits[0])
                if value > 0:
                    return max(2.0, min(800.0, value))
            except ValueError:
                pass
    return {
        "river": 34.0,
        "stream": 6.0,
        "canal": 8.0,
        "tidal_channel": 16.0,
    }.get(kind, 5.0)


def compact_coastline(path: Path, center_x: float, center_y: float) -> dict[str, Any]:
    source = load_geojson(path)
    parts: list[dict[str, Any]] = []
    source_part_count = 0
    source_vertex_count = 0
    for feature_index, feature in enumerate(source.get("features", [])):
        props = feature.get("properties") or {}
        for part_index, raw in enumerate(iter_parts(feature.get("geometry") or {})):
            source_part_count += 1
            source_vertex_count += len(raw)
            simplified = simplify_rdp(raw, COAST_SIMPLIFY_M)
            if len(simplified) < 2:
                continue
            coords = [
                [round(p[0] - center_x, 1), round(center_y - p[1], 1)]
                for p in simplified
            ]
            parts.append({
                "id": props.get("partId") or props.get("osmId") or f"coast-{feature_index}-{part_index}",
                "coords": coords,
            })
    return {
        "schema": "wenzhou_coastline_compact@1.0.0",
        "crs": "EPSG:32651-local-centered",
        "sourceSha256": EXPECTED[path]["sha256"],
        "sourcePartCount": source_part_count,
        "sourceVertexCount": source_vertex_count,
        "simplifyToleranceMeters": COAST_SIMPLIFY_M,
        "partCount": len(parts),
        "parts": parts,
    }


def compact_rivers(path: Path, center_x: float, center_y: float) -> dict[str, Any]:
    source = load_geojson(path)
    candidates: list[dict[str, Any]] = []
    source_part_count = 0
    source_vertex_count = 0
    for feature_index, feature in enumerate(source.get("features", [])):
        props = feature.get("properties") or {}
        kind = str(props.get("waterway") or props.get("type") or "stream").lower()
        if kind not in {"river", "stream", "canal", "tidal_channel"}:
            continue
        name = combined_name(props)
        for part_index, raw in enumerate(iter_parts(feature.get("geometry") or {})):
            source_part_count += 1
            source_vertex_count += len(raw)
            if len(raw) < 2:
                continue
            length = line_length(raw)
            keep = bool(name) or kind in {"river", "tidal_channel"}
            if kind == "stream" and length >= 1200:
                keep = True
            if kind == "canal" and length >= 900:
                keep = True
            if not keep:
                continue
            simplified = simplify_rdp(raw, RIVER_SIMPLIFY_M)
            if len(simplified) < 2:
                continue
            score = length + (120_000 if name else 0) + (70_000 if kind == "river" else 0)
            candidates.append({
                "id": props.get("partId") or props.get("osmId") or f"water-{feature_index}-{part_index}",
                "name": name,
                "type": kind,
                "widthMeters": round(waterway_width(props, kind), 2),
                "lengthMeters": round(length, 2),
                "score": score,
                "coords": [
                    [round(p[0] - center_x, 1), round(center_y - p[1], 1)]
                    for p in simplified
                ],
            })
    candidates.sort(key=lambda item: item["score"], reverse=True)
    selected = candidates[:MAX_RIVER_PARTS]
    for item in selected:
        item.pop("score", None)
    type_counts: dict[str, int] = {}
    for item in selected:
        type_counts[item["type"]] = type_counts.get(item["type"], 0) + 1
    return {
        "schema": "wenzhou_rivers_compact@1.0.0",
        "crs": "EPSG:32651-local-centered",
        "sourceSha256": EXPECTED[path]["sha256"],
        "sourceCoordinateSha256": "df6fe335d7cb8d69aa1971b897cc8fedfeeaf44bee95ffaab9ac472b01a175f4",
        "sourcePartCount": source_part_count,
        "sourceVertexCount": source_vertex_count,
        "sourceTotalLengthMeters": 9_093_110.239461595,
        "simplifyToleranceMeters": RIVER_SIMPLIFY_M,
        "selectionPolicy": "all named, all rivers/tidal channels, streams >=1200m, canals >=900m, capped by score",
        "partCount": len(selected),
        "typeCounts": type_counts,
        "estuaryConnectivityStatus": "pending",
        "parts": selected,
    }


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    inputs = [require_file(path) for path in (LAND, MARINE, BATHY, COAST, RIVERS)]

    with rasterio.open(LAND) as src:
        land_bounds = [src.bounds.left, src.bounds.bottom, src.bounds.right, src.bounds.top]
        land_transform = list(src.transform)[:6]
        center_x = (src.bounds.left + src.bounds.right) / 2.0
        center_y = (src.bounds.bottom + src.bounds.top) / 2.0
        wgs84_bounds = list(transform_bounds(src.crs, "EPSG:4326", *src.bounds, densify_pts=21))
        width_m = src.bounds.right - src.bounds.left
        height_m = src.bounds.top - src.bounds.bottom
        overview = src.read(
            1,
            out_shape=(LAND_GRID, LAND_GRID),
            resampling=Resampling.bilinear,
            masked=True,
        ).filled(np.nan).astype(np.float32)
        texture_elevation = src.read(
            1,
            out_shape=(LAND_TEXTURE, LAND_TEXTURE),
            resampling=Resampling.bilinear,
            masked=True,
        ).filled(np.nan).astype(np.float32)

    with rasterio.open(MARINE) as src:
        texture_marine = src.read(
            1,
            out_shape=(LAND_TEXTURE, LAND_TEXTURE),
            resampling=Resampling.nearest,
            masked=True,
        ).filled(0).astype(np.uint8)
        overview_marine = src.read(
            1,
            out_shape=(LAND_GRID, LAND_GRID),
            resampling=Resampling.nearest,
            masked=True,
        ).filled(0).astype(np.uint8)

    finite = overview[np.isfinite(overview)]
    elevation_min = float(np.min(finite))
    elevation_max = float(np.max(finite))
    height_u16 = quantize_u16(overview, elevation_min, elevation_max)
    height_path = OUT / "terrain_height_513_u16.bin"
    write_binary(height_path, height_u16)

    marine_path = OUT / "terrain_marine_513_u8.bin"
    write_binary(marine_path, overview_marine.astype("u1"))

    pixel_x = width_m / LAND_TEXTURE
    pixel_y = height_m / LAND_TEXTURE
    satellite = build_satellite_color(texture_elevation, texture_marine, pixel_x, pixel_y)
    satellite_path = OUT / "offline_satellite_color_2048.webp"
    image_save(satellite_path, satellite, "RGB", "WEBP", quality=91, method=6)

    marine_image_path = OUT / "marine_mask_2048.png"
    image_save(marine_image_path, np.uint8(texture_marine > 0) * 255, "L", "PNG", optimize=True)

    with rasterio.open(BATHY) as src:
        bathy_bounds = [src.bounds.left, src.bounds.bottom, src.bounds.right, src.bounds.top]
        bathy = src.read(
            1,
            out_shape=(BATHY_GRID, BATHY_GRID),
            resampling=Resampling.bilinear,
            masked=True,
        ).filled(np.nan).astype(np.float32)
        bathy_nodata = src.nodata
    bathy_finite = bathy[np.isfinite(bathy)]
    bathy_min = float(np.min(bathy_finite))
    bathy_max = float(np.max(bathy_finite))
    bathy_i16 = np.rint(np.clip(np.nan_to_num(bathy, nan=-32768), -32768, 32767)).astype("<i2")
    bathy_path = OUT / "bathymetry_height_257_i16.bin"
    write_binary(bathy_path, bathy_i16)

    coast = compact_coastline(COAST, center_x, center_y)
    coast_path = OUT / "coastline_compact.json"
    coast_path.write_text(json.dumps(coast, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")

    rivers = compact_rivers(RIVERS, center_x, center_y)
    rivers_path = OUT / "rivers_compact.json"
    rivers_path.write_text(json.dumps(rivers, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")

    assets = [
        file_record(height_path, "terrain_height_u16"),
        file_record(marine_path, "terrain_marine_u8"),
        file_record(satellite_path, "offline_satellite_color_webp"),
        file_record(marine_image_path, "marine_mask_png"),
        file_record(bathy_path, "bathymetry_height_i16"),
        file_record(coast_path, "compact_projected_coastline"),
        file_record(rivers_path, "compact_projected_rivers"),
    ]

    manifest = {
        "schema": "wenzhou_v110_bootstrap_assets@1.0.0",
        "generatedAtUtc": utc_now(),
        "terrainRuntimeId": "wenzhou-epsg32651-v110",
        "crs": "EPSG:32651",
        "worldOriginProjected": [center_x, center_y],
        "truth": {
            "path": str(LAND.relative_to(ROOT)).replace("\\", "/"),
            "sha256": EXPECTED[LAND]["sha256"],
            "grid": [11866, 11866],
            "spacingMeters": [12.5, 12.5],
            "bounds": land_bounds,
            "transform": land_transform,
            "wgs84Bounds": wgs84_bounds,
            "verticalScale": 1.0,
        },
        "terrainOverview": {
            "grid": [LAND_GRID, LAND_GRID],
            "widthMeters": width_m,
            "heightMeters": height_m,
            "minimumElevationMeters": elevation_min,
            "maximumElevationMeters": elevation_max,
            "quantization": "uint16-linear",
            "heightAsset": str(height_path.relative_to(ROOT)).replace("\\", "/"),
            "marineAsset": str(marine_path.relative_to(ROOT)).replace("\\", "/"),
            "triangleCount": (LAND_GRID - 1) * (LAND_GRID - 1) * 2,
        },
        "offlineSatelliteColor": {
            "label": "satellite-color material",
            "originalSatelliteImageClaim": False,
            "size": [LAND_TEXTURE, LAND_TEXTURE],
            "asset": str(satellite_path.relative_to(ROOT)).replace("\\", "/"),
        },
        "bathymetryOverview": {
            "sourceSha256": EXPECTED[BATHY]["sha256"],
            "grid": [BATHY_GRID, BATHY_GRID],
            "bounds": bathy_bounds,
            "minimumMeters": bathy_min,
            "maximumMeters": bathy_max,
            "asset": str(bathy_path.relative_to(ROOT)).replace("\\", "/"),
        },
        "hydrology": {
            "coastlineAsset": str(coast_path.relative_to(ROOT)).replace("\\", "/"),
            "riverAsset": str(rivers_path.relative_to(ROOT)).replace("\\", "/"),
            "estuaryConnectivityStatus": "pending",
            "attribution": "© OpenStreetMap contributors",
            "license": "ODbL 1.0",
        },
        "assets": assets,
    }
    manifest_path = OUT / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    assets.append(file_record(manifest_path, "bootstrap_manifest"))

    report = {
        "schema": "wenzhou_v110_bootstrap_asset_build@1.0.0",
        "generatedAtUtc": utc_now(),
        "passed": True,
        "inputs": inputs,
        "outputs": assets,
        "terrain": manifest["terrainOverview"],
        "bathymetry": manifest["bathymetryOverview"],
        "hydrology": {
            "coastlinePartCount": coast["partCount"],
            "riverPartCount": rivers["partCount"],
            "riverTypeCounts": rivers["typeCounts"],
            "estuaryConnectivityStatus": "pending",
        },
        "truthInvariants": {
            "landSha256Unchanged": True,
            "landPixelsModified": 0,
            "bathySha256Unchanged": True,
            "osmCenterlineSourceSha256Unchanged": True,
        },
        "limitations": [
            "This build creates the truthful overview asset set and compact water vectors.",
            "The interactive WebGL2 runtime and 12.5 m near-field tile pyramid remain separate follow-up stages.",
            "The offline satellite-color material is derived and must not be described as original satellite imagery.",
            "Estuary connectivity remains pending according to HYDROLOGY_TOPOLOGY_QA.json.",
        ],
    }
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
