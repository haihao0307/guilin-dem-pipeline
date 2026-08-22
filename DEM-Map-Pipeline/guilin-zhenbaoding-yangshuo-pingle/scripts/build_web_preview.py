from __future__ import annotations

import argparse
from array import array
import json
import math
import shutil
import sys
from pathlib import Path
from typing import Any

try:
    import numpy as np
    import rasterio
    from rasterio.enums import Resampling
    from rasterio.warp import transform, transform_bounds
except ModuleNotFoundError:  # Metadata-only rebuilds can run with the standard library.
    np = None
    rasterio = None
    Resampling = None

    def _utm49(lon: float, lat: float) -> tuple[float, float]:
        a, ecc_sq, k0 = 6378137.0, 0.00669437999014, 0.9996
        ecc_prime_sq = ecc_sq / (1.0 - ecc_sq)
        lat_r, lon_r = math.radians(lat), math.radians(lon)
        lon0 = math.radians(111.0)
        sin_lat, cos_lat, tan_lat = math.sin(lat_r), math.cos(lat_r), math.tan(lat_r)
        n = a / math.sqrt(1.0 - ecc_sq * sin_lat * sin_lat)
        t = tan_lat * tan_lat
        c = ecc_prime_sq * cos_lat * cos_lat
        aa = cos_lat * (lon_r - lon0)
        m = a * ((1 - ecc_sq / 4 - 3 * ecc_sq**2 / 64 - 5 * ecc_sq**3 / 256) * lat_r
            - (3 * ecc_sq / 8 + 3 * ecc_sq**2 / 32 + 45 * ecc_sq**3 / 1024) * math.sin(2 * lat_r)
            + (15 * ecc_sq**2 / 256 + 45 * ecc_sq**3 / 1024) * math.sin(4 * lat_r)
            - (35 * ecc_sq**3 / 3072) * math.sin(6 * lat_r))
        x = k0 * n * (aa + (1 - t + c) * aa**3 / 6 + (5 - 18 * t + t**2 + 72 * c - 58 * ecc_prime_sq) * aa**5 / 120) + 500000.0
        y = k0 * (m + n * tan_lat * (aa**2 / 2 + (5 - t + 9 * c + 4 * c**2) * aa**4 / 24 + (61 - 58 * t + t**2 + 600 * c - 330 * ecc_prime_sq) * aa**6 / 720))
        return x, y

    def transform(_src: str, _dst: str, xs: list[float], ys: list[float]) -> tuple[list[float], list[float]]:
        projected = [_utm49(float(x), float(y)) for x, y in zip(xs, ys)]
        return [point[0] for point in projected], [point[1] for point in projected]

    def transform_bounds(_src: str, _dst: str, left: float, bottom: float, right: float, top: float, densify_pts: int = 21) -> list[float]:
        corners = [_utm49(left, bottom), _utm49(left, top), _utm49(right, bottom), _utm49(right, top)]
        return [min(x for x, _ in corners), min(y for _, y in corners), max(x for x, _ in corners), max(y for _, y in corners)]

from common import read_json, sha256_file, utc_now, write_json


class PipelineError(RuntimeError):
    pass


def json_if_exists(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    try:
        return read_json(path)
    except Exception:
        return default


LANDMARKS = [
    {
        "id": "zhenbao-ding",
        "name": "真寶鼎",
        "longitude": 110.82528,
        "latitude": 26.13556,
        "color": "#f2bd65",
    },
    {
        "id": "yangshuo-county-seat",
        "name": "陽朔縣",
        "longitude": 110.4920133,
        "latitude": 24.7815129,
        "color": "#73d7b0",
    },
    {
        "id": "yangtang-airfield",
        "name": "秧塘機場",
        "longitude": 110.15569,
        "latitude": 25.21753,
        "color": "#7bb7ff",
    },
    {
        "id": "guilin-old-city",
        "name": "桂林古城",
        "longitude": 110.2994,
        "latitude": 25.2742,
        "color": "#e989b7",
    },
]


def downsample_height(dem_path: Path, assets: Path, max_side: int = 2048) -> dict[str, Any]:
    if rasterio is None or np is None:
        raise PipelineError("rasterio and numpy are required to rebuild a DEM raster; use --from-manifest for metadata-only regeneration")
    with rasterio.open(dem_path) as dataset:
        scale = max(dataset.width / max_side, dataset.height / max_side, 1.0)
        width = max(2, int(round(dataset.width / scale)))
        height = max(2, int(round(dataset.height / scale)))
        data = dataset.read(1, out_shape=(height, width), masked=True, resampling=Resampling.bilinear)
        source_mask = (~np.ma.getmaskarray(data)).astype(np.uint8)
        values = np.asarray(data.filled(np.nan), dtype=np.float32)
        valid = values[np.isfinite(values) & (source_mask == 1)]
        if valid.size == 0:
            raise PipelineError("DEM preview grid contains no valid pixels")
        source_valid_fraction = float(source_mask.mean())
        if source_valid_fraction < 0.9999:
            raise PipelineError(
                f"Web context DEM has incomplete real coverage ({source_valid_fraction:.6f}); "
                "visual extrapolation is disabled"
            )
        filled = values
        mask = source_mask
        minimum = float(np.nanmin(valid))
        maximum = float(np.nanmax(valid))
        value_range = max(maximum - minimum, 1e-6)
        normalized = np.clip((filled - minimum) / value_range, 0.0, 1.0)
        quantized = np.round(normalized * 65535.0).astype("<u2")
        height_path = assets / "height_u16.bin"
        mask_path = assets / "mask_u8.bin"
        height_path.write_bytes(quantized.tobytes(order="C"))
        mask_path.write_bytes(mask.tobytes(order="C"))
        # A compact source-faithful 2D preview; it uses the same downloaded values.
        palette = np.stack(
            (
                np.clip(18 + normalized * 205, 0, 255),
                np.clip(55 + normalized * 175, 0, 255),
                np.clip(42 + normalized * 105, 0, 255),
            ),
            axis=0,
        ).astype(np.uint8)
        with rasterio.open(
            assets / "DEM_PREVIEW.png", "w", driver="PNG", width=width, height=height,
            count=3, dtype="uint8"
        ) as preview:
            preview.write(palette)
        bounds = list(dataset.bounds)
        wgs84_bounds = list(transform_bounds(dataset.crs, "EPSG:4326", *dataset.bounds, densify_pts=21)) if dataset.crs else None
        resolution = [abs(dataset.transform.a), abs(dataset.transform.e)]
        width_m = float(bounds[2] - bounds[0])
        height_m = float(bounds[3] - bounds[1])
        landmarks = []
        if dataset.crs:
            xs, ys = transform(
                "EPSG:4326",
                dataset.crs,
                [item["longitude"] for item in LANDMARKS],
                [item["latitude"] for item in LANDMARKS],
            )
            for item, x, y in zip(LANDMARKS, xs, ys):
                u = float(np.clip((x - bounds[0]) / width_m, 0.0, 1.0))
                v = float(np.clip((bounds[3] - y) / height_m, 0.0, 1.0))
                col = int(round(u * (width - 1)))
                row = int(round(v * (height - 1)))
                landmarks.append(
                    {
                        **item,
                        "projectedX": float(x),
                        "projectedY": float(y),
                        "gridU": u,
                        "gridV": v,
                        "elevationMeters": float(filled[row, col]),
                    }
                )
        height_sha256 = sha256_file(height_path)
        mask_sha256 = sha256_file(mask_path)
        return {
            "schemaVersion": "terrain-manifest/v1",
            "assetVersion": f"guilin-{height_sha256[:12]}",
            "ready": True,
            "gridWidth": width,
            "gridHeight": height,
            "minimumElevation": minimum,
            "maximumElevation": maximum,
            "bounds": bounds,
            "wgs84Bounds": wgs84_bounds,
            "crs": dataset.crs.to_string() if dataset.crs else None,
            "resolution": resolution,
            "widthMeters": width_m,
            "heightMeters": height_m,
            "axisConvention": {"x": "east", "y": "up", "z": "south"},
            "rowOrder": "north-to-south",
            "columnOrder": "west-to-east",
            "heightEncoding": {
                "sampleType": "uint16",
                "byteOrder": "little-endian",
                "quantizationMinimumMeters": minimum,
                "quantizationMaximumMeters": maximum,
                "decodeFormula": "min_m + sample_u16 / 65535 * (max_m - min_m)",
            },
            "heightBinary": "assets/height_u16.bin",
            "heightByteLength": height_path.stat().st_size,
            "heightSha256": height_sha256,
            "maskBinary": "assets/mask_u8.bin",
            "maskByteLength": mask_path.stat().st_size,
            "maskSha256": mask_sha256,
            "noDataPolicy": "网页只显示已下载的真实DEM像元；禁止插值外推补边",
            "validFraction": float(mask.mean()),
            "sourceValidFraction": source_valid_fraction,
            "visualFillApplied": False,
            "visualFillMethod": None,
            "sourceCoverageType": "downloaded",
            "landmarks": landmarks,
        }


def attach_lijiang(terrain: dict[str, Any], geojson_path: Path) -> None:
    if not geojson_path.exists() or not terrain.get("ready"):
        terrain["rivers"] = []
        return
    payload = read_json(geojson_path)
    bounds = terrain["bounds"]
    width_m = terrain["widthMeters"]
    height_m = terrain["heightMeters"]
    lines = []
    for feature in payload.get("features", []):
        coordinates = feature.get("geometry", {}).get("coordinates", [])
        if len(coordinates) < 2:
            continue
        longitudes = [float(point[0]) for point in coordinates]
        latitudes = [float(point[1]) for point in coordinates]
        xs, ys = transform("EPSG:4326", terrain["crs"], longitudes, latitudes)
        points = []
        for longitude, latitude, x, y in zip(longitudes, latitudes, xs, ys):
            u = (x - bounds[0]) / width_m
            v = (bounds[3] - y) / height_m
            if -0.01 <= u <= 1.01 and -0.01 <= v <= 1.01:
                points.append({"u": float(u), "v": float(v), "longitude": longitude, "latitude": latitude})
        if len(points) >= 2:
            lines.append(points)
    terrain["rivers"] = lines
    terrain["riverSource"] = payload.get("properties", {}).get("source", "OpenStreetMap contributors")
    terrain["riverLicense"] = payload.get("properties", {}).get("license", "ODbL 1.0")


def _clip_segment(a: tuple[float, float], b: tuple[float, float]) -> list[tuple[float, float]]:
    """Clip one UV segment to the complete terrain rectangle."""
    x0, y0 = a
    x1, y1 = b
    dx, dy = x1 - x0, y1 - y0
    t0, t1 = 0.0, 1.0
    for p, q in ((-dx, x0), (dx, 1.0 - x0), (-dy, y0), (dy, 1.0 - y0)):
        if abs(p) < 1e-12:
            if q < 0:
                return []
            continue
        t = q / p
        if p < 0:
            if t > t1:
                return []
            t0 = max(t0, t)
        else:
            if t < t0:
                return []
            t1 = min(t1, t)
    return [(x0 + t0 * dx, y0 + t0 * dy), (x0 + t1 * dx, y0 + t1 * dy)]


def _clip_polyline(points: list[tuple[float, float]]) -> list[tuple[float, float]]:
    clipped: list[tuple[float, float]] = []
    for start, end in zip(points, points[1:]):
        segment = _clip_segment(start, end)
        if not segment:
            continue
        if not clipped or math.hypot(clipped[-1][0] - segment[0][0], clipped[-1][1] - segment[0][1]) > 1e-9:
            clipped.append(segment[0])
        clipped.append(segment[1])
    return clipped


def _clip_polyline_parts(points: list[tuple[float, float]]) -> list[list[tuple[float, float]]]:
    """Clip a line into contiguous in-bounds parts.

    A single OSM way can leave and re-enter the DEM rectangle.  Treating all
    clipped pieces as one ring bridges the out-of-bounds gap and creates the
    large triangular ``water wings`` seen in the browser.  Keeping the parts
    separate lets each surface terminate exactly at the rectangle edge.
    """
    parts: list[list[tuple[float, float]]] = []
    current: list[tuple[float, float]] = []
    for start, end in zip(points, points[1:]):
        segment = _clip_segment(start, end)
        if not segment:
            if len(current) >= 2:
                parts.append(current)
            current = []
            continue
        a, b = segment
        if not current:
            current = [a, b]
        elif math.hypot(current[-1][0] - a[0], current[-1][1] - a[1]) <= 1e-9:
            if math.hypot(current[-1][0] - b[0], current[-1][1] - b[1]) > 1e-9:
                current.append(b)
        else:
            if len(current) >= 2:
                parts.append(current)
            current = [a, b]
    if len(current) >= 2:
        parts.append(current)
    return parts


def _clip_polygon(points: list[tuple[float, float]]) -> list[tuple[float, float]]:
    """Sutherland-Hodgman clip so surface water reaches the map edge exactly."""
    output = points[:]
    for axis, limit, keep_greater in ((0, 0.0, True), (0, 1.0, False), (1, 0.0, True), (1, 1.0, False)):
        if not output:
            break
        clipped: list[tuple[float, float]] = []
        for current, previous in zip(output, output[-1:] + output[:-1]):
            current_inside = current[axis] >= limit if keep_greater else current[axis] <= limit
            previous_inside = previous[axis] >= limit if keep_greater else previous[axis] <= limit
            if current_inside != previous_inside:
                delta = current[axis] - previous[axis]
                ratio = (limit - previous[axis]) / delta if abs(delta) > 1e-12 else 0.0
                clipped.append((previous[0] + ratio * (current[0] - previous[0]), previous[1] + ratio * (current[1] - previous[1])))
            if current_inside:
                clipped.append(current)
        output = clipped
    return output


def _compact_ring(points: list[tuple[float, float]], max_points: int = 64) -> list[tuple[float, float]]:
    if len(points) <= max_points:
        return points
    step = max(1, math.ceil((len(points) - 1) / (max_points - 1)))
    result = points[::step]
    if result[-1] != points[-1]:
        result.append(points[-1])
    return result


def _triangulate(points: list[tuple[float, float]]) -> list[tuple[float, float, float, float, float, float]]:
    """Small deterministic ear-clipping triangulator for clipped OSM water polygons."""
    if len(points) < 3:
        return []
    ring = points[:]
    area = sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(ring, ring[1:] + ring[:1]))
    if abs(area) < 1e-12:
        return []
    if area < 0:
        ring.reverse()
    # Large OSM banks are already dense; a deterministic centroid fan keeps the
    # metadata build bounded while retaining the mapped surface silhouette.
    if len(ring) > 80:
        center = (sum(p[0] for p in ring) / len(ring), sum(p[1] for p in ring) / len(ring))
        return [(*center, *a, *b) for a, b in zip(ring, ring[1:] + ring[:1])]
    indices = list(range(len(ring)))
    triangles: list[tuple[float, float, float, float, float, float]] = []

    def cross(a: tuple[float, float], b: tuple[float, float], c: tuple[float, float]) -> float:
        return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])

    def inside(p: tuple[float, float], a: tuple[float, float], b: tuple[float, float], c: tuple[float, float]) -> bool:
        return cross(a, b, p) >= -1e-10 and cross(b, c, p) >= -1e-10 and cross(c, a, p) >= -1e-10

    guard = 0
    while len(indices) > 2 and guard < len(ring) * len(ring):
        guard += 1
        ear_found = False
        for position, curr in enumerate(indices):
            prev = indices[position - 1]
            nxt = indices[(position + 1) % len(indices)]
            a, b, c = ring[prev], ring[curr], ring[nxt]
            if cross(a, b, c) <= 1e-10:
                continue
            if any(inside(ring[index], a, b, c) for index in indices if index not in (prev, curr, nxt)):
                continue
            triangles.append((a[0], a[1], b[0], b[1], c[0], c[1]))
            indices.pop(position)
            ear_found = True
            break
        if not ear_found:
            # A malformed OSM ring is still rendered as a conservative fan rather than dropped.
            center = (sum(p[0] for p in ring) / len(ring), sum(p[1] for p in ring) / len(ring))
            return [(*center, *a, *b) for a, b in zip(ring, ring[1:] + ring[:1])]
    return triangles


def _parse_width(tags: dict[str, Any], default: float) -> float:
    for key in ("width", "width:minimum", "waterway:width"):
        value = tags.get(key)
        if value is None:
            continue
        try:
            numeric = float(str(value).replace("m", "").strip())
            if math.isfinite(numeric) and numeric > 0:
                return numeric
        except ValueError:
            continue
    return default


def _load_height_samples(terrain: dict[str, Any], assets: Path | None) -> array | None:
    if not assets:
        return None
    path = assets / "height_u16.bin"
    if not path.exists():
        return None
    samples = array("H")
    samples.frombytes(path.read_bytes())
    return samples


def _sample_elevation(terrain: dict[str, Any], samples: array | None, point: tuple[float, float]) -> float:
    if not samples:
        return 0.0
    u, v = point
    col = max(0, min(int(round(u * (terrain["gridWidth"] - 1))), terrain["gridWidth"] - 1))
    row = max(0, min(int(round(v * (terrain["gridHeight"] - 1))), terrain["gridHeight"] - 1))
    normalized = samples[row * terrain["gridWidth"] + col] / 65535.0
    return terrain["minimumElevation"] + normalized * (terrain["maximumElevation"] - terrain["minimumElevation"])


def _is_reservoir_feature(feature: dict[str, Any]) -> bool:
    """Exclude modern reservoir/dam features from the 1942-style water layer."""
    tags = feature.get("properties") or {}
    waterway = str(tags.get("waterway") or "").lower()
    natural = str(tags.get("natural") or "").lower()
    water = str(tags.get("water") or "").lower()
    landuse = str(tags.get("landuse") or "").lower()
    return (
        waterway in {"dam", "reservoir"}
        or water in {"reservoir", "dam"}
        or natural == "reservoir"
        or landuse == "reservoir"
        or bool(tags.get("reservoir_type"))
    )


def attach_waterways(
    terrain: dict[str, Any],
    geojson_path: Path,
    assets: Path | None = None,
    extra_geojson_path: Path | None = None,
) -> None:
    """Project OSM water surfaces and clipped/tapered centerlines onto the DEM.

    Polygon water bodies retain their mapped surface. Centerline-only waterways receive
    a width-aware surface strip that is 1x at the upstream end and 3x at the downstream
    end. Clipping inserts exact edge intersections, so no channel stops inside the map.
    """
    if not geojson_path.exists() or not terrain.get("ready"):
        terrain["waterways"] = []
        terrain["waterwayPolygons"] = []
        terrain["waterwayTriangles"] = []
        terrain["waterwayCount"] = 0
        return
    payload = read_json(geojson_path)
    features = [(feature, False) for feature in payload.get("features", [])]
    # The dedicated Lijiang extract contains long river ways that are not always
    # present in the broad Overpass export. Merge it before projection so the
    # river reaches the actual AOI boundary instead of stopping at a tile seam.
    if extra_geojson_path and extra_geojson_path.exists():
        extra = read_json(extra_geojson_path)
        features.extend((feature, True) for feature in extra.get("features", []))
    bounds = terrain["bounds"]
    width_m = terrain["widthMeters"]
    height_m = terrain["heightMeters"]
    lines = []
    polygons = []
    triangles: list[dict[str, Any]] = []
    samples = _load_height_samples(terrain, assets)
    seen_features: set[str] = set()
    excluded_count = 0
    def water_network(tags: dict[str, Any], is_extra_lijiang: bool = False) -> str:
        explicit = str(tags.get("_network") or "").lower()
        name = str(tags.get("name") or "")
        if is_extra_lijiang or explicit == "lijiang" or any(token in name for token in ("漓江", "漓江", "Lijiang")):
            return "lijiang"
        if explicit == "xiangjiang" or any(token in name for token in ("湘江", "湘江", "Xiangjiang")):
            return "xiangjiang"
        return "other"

    for feature, is_extra_lijiang in features:
        if _is_reservoir_feature(feature):
            excluded_count += 1
            continue
        geometry = feature.get("geometry") or {}
        dedupe_key = json.dumps(geometry, sort_keys=True, separators=(",", ":"))
        if dedupe_key in seen_features:
            continue
        seen_features.add(dedupe_key)
        tags = dict(feature.get("properties") or {})
        network = water_network(tags, is_extra_lijiang)
        geometry_type = geometry.get("type")
        raw = geometry.get("coordinates") or []
        if geometry_type == "Polygon":
            rings = raw[:1]
        elif geometry_type == "MultiPolygon":
            rings = [ring for polygon in raw for ring in polygon[:1]]
        else:
            rings = []
        for ring in rings:
            if len(ring) < 3:
                continue
            longitudes = [float(point[0]) for point in ring]
            latitudes = [float(point[1]) for point in ring]
            xs, ys = transform("EPSG:4326", terrain["crs"], longitudes, latitudes)
            uv = [((x - bounds[0]) / width_m, (bounds[3] - y) / height_m) for x, y in zip(xs, ys)]
            clipped = _compact_ring(_clip_polygon(uv))
            if len(clipped) >= 3:
                polygons.append({"points": [round(float(value), 6) for point in clipped for value in point], "kind": tags.get("natural") or tags.get("water") or "water-surface", "network": network})
        if geometry_type != "LineString":
            continue
        if len(raw) < 2:
            continue
        longitudes = [float(point[0]) for point in raw]
        latitudes = [float(point[1]) for point in raw]
        xs, ys = transform("EPSG:4326", terrain["crs"], longitudes, latitudes)
        uv_all = [((x - bounds[0]) / width_m, (bounds[3] - y) / height_m) for x, y in zip(xs, ys)]
        # OSM river ways are commonly downstream-directed. When a way is reversed,
        # the coarser terrain endpoint is used as a deterministic upstream hint.
        if _sample_elevation(terrain, samples, uv_all[0]) < _sample_elevation(terrain, samples, uv_all[-1]):
            uv_all.reverse()
        clipped_parts = _clip_polyline_parts(uv_all)
        if not clipped_parts:
            continue
        # The standalone Lijiang extract has no waterway tag; treat it as a
        # river so it gets the same continuous 1x upstream / 3x downstream
        # surface treatment as the primary river ways.
        name = str(tags.get("name") or "")
        named_river = any(token in name for token in ("漓江", "\u6f13\u6c5f", "湘江", "\u6e58\u6c5f", "太平河", "\u592a\u5e73\u6cb3"))
        kind = str(tags.get("waterway") or ("river" if named_river else "unknown"))
        default_width = {"river": 36.0, "stream": 8.0, "canal": 10.0, "ditch": 3.0, "drain": 3.0, "riverbank": 45.0}.get(kind, 5.0)
        end_width = _parse_width(tags, default_width)
        start_width = max(0.75, end_width / 3.0)
        for clipped in clipped_parts:
            left: list[tuple[float, float]] = []
            right: list[tuple[float, float]] = []
            for index, point in enumerate(clipped):
                previous = clipped[max(0, index - 1)]
                following = clipped[min(len(clipped) - 1, index + 1)]
                dx, dy = following[0] - previous[0], following[1] - previous[1]
                length = math.hypot(dx, dy) or 1.0
                normal = (-dy / length, dx / length)
                width = start_width + (end_width - start_width) * index / max(1, len(clipped) - 1)
                # U/V are normalized, so use projected metres for the physical width.
                nu, nv = normal[0] * width / width_m, normal[1] * width / height_m
                left.append((point[0] + nu, point[1] + nv))
                right.append((point[0] - nu, point[1] - nv))
            surface = _compact_ring(_clip_polygon(left + list(reversed(right))))
            if len(surface) >= 3:
                polygons.append({"points": [round(float(value), 6) for point in surface for value in point], "kind": kind, "network": network, "widthStartMeters": round(start_width, 2), "widthEndMeters": round(end_width, 2), "flow": "upstream-to-downstream"})
            lines.append({"points": [round(float(value), 6) for point in clipped for value in point], "kind": kind, "network": network, "widthStartMeters": round(start_width, 2), "widthEndMeters": round(end_width, 2), "flow": "upstream-to-downstream"})
    terrain["waterways"] = lines
    terrain["waterwayPolygons"] = polygons
    terrain["waterwayTriangles"] = triangles
    terrain["waterwayCount"] = len(lines)
    terrain["waterwaySource"] = "OpenStreetMap contributors + dedicated Lijiang extract"
    terrain["waterwayLicense"] = payload.get("properties", {}).get("license", "ODbL 1.0")
    terrain["waterwayLabelPolicy"] = "只绘制水面，不显示水系名称"
    terrain["waterwayRepresentation"] = "mapped-water-surface-polygons-with-tapered-centerline-fallback"
    terrain["waterwayEdgePolicy"] = "split-then-clip-each-contiguous-part-at-terrain-boundary"
    terrain["waterSurfacePolicy"] = "sampled-to-DEM-ground-plus-0.6m-render-epsilon"
    terrain["waterwayCenterlinePolicy"] = "faint-network-centerlines-rendered-over-clipped-water-surfaces; no labels"
    terrain["waterwayControlPolicy"] = "browser-only visual width, visibility, and color controls; source geometry remains unchanged"
    terrain["waterwayNetworks"] = {
        "lijiang": "continuous-extract-plus-OSM-ways",
        "xiangjiang": "OSM-named-and-unnamed-river-ways",
        "taiping": "OSM-named-and-unnamed-river-ways",
        "edgeClipping": "exact-rectangle-intersections-no-out-of-bounds-bridges",
    }
    terrain["waterwayExcludedReservoirFeatures"] = excluded_count


def attach_ecology(terrain: dict[str, Any], package_dir: Path, assets: Path) -> None:
    """Package the existing ecology proof assets for the Yangtang focus view."""
    runtime = package_dir / "runtime-assets"
    required = [runtime / name for name in (
        "field0-elevation-slope-forest-water.png",
        "field1-paddy-bund-rows-rock.png",
        "field2-wet-terrace-erosion-landuse.png",
        "trees.bin",
        "shrubs.bin",
        "rice.bin",
    )]
    if not all(path.exists() for path in required):
        terrain["ecology"] = {"ready": False, "sourceStatus": "package-missing"}
        return
    target = assets / "ecology" / "v0.3.1"
    target.mkdir(parents=True, exist_ok=True)
    for source in required:
        shutil.copy2(source, target / source.name)
    release = json_if_exists(package_dir / "ecology-release-manifest.json", {})
    aoi = release.get("aoi", {})
    terrain["ecology"] = {
        "ready": True,
        "version": "0.3.1",
        "aoiAreaSquareKilometers": float(aoi.get("areaKm2", 10.0)),
        "sideMeters": float(aoi.get("sideMeters", 3162.2776601683795)),
        "centerProjected": aoi.get("centerProjected", [415018.03522667295, 2789215.965156763]),
        "crs": aoi.get("crs", "EPSG:32649"),
        "sourceStatus": release.get("terrain", {}).get("sourceStatus", "visual-ecology-package"),
        "nativeSurveyClaim": bool(release.get("terrain", {}).get("nativeSurveyClaim", False)),
        "assetBase": "assets/ecology/v0.3.1",
        "fieldTextures": [
            "field0-elevation-slope-forest-water.png",
            "field1-paddy-bund-rows-rock.png",
            "field2-wet-terrace-erosion-landuse.png",
        ],
        "treeBinary": "trees.bin",
        "shrubBinary": "shrubs.bin",
        "riceBinary": "rice.bin",
        "recordLayout": release.get("recordLayout", {
            "tree": {"stride": 12}, "shrub": {"stride": 10}, "rice": {"stride": 10}
        }),
        "renderPolicy": "近景聚焦至 200 平方公里时显示生态实例；现有生态样本覆盖仍为 10 平方公里，不扩展为全图测绘植被数据",
        "detailPolicy": "树冠、灌丛与稻田行纹使用共享地面采样贴地渲染；仅作视觉示意",
        "gaeaRecipe": "nested-Voronoi-landuse + slope/curvature masks + erosion-streamline cues",
    }


def refresh_landmarks_from_manifest(terrain: dict[str, Any]) -> None:
    if not terrain.get("ready") or not terrain.get("crs"):
        return
    height_path = Path(__file__).resolve().parents[1] / "site" / "public" / "terrain" / terrain["heightBinary"]
    samples = None
    if height_path.exists():
        import array
        samples = array.array("H")
        samples.frombytes(height_path.read_bytes())
    bounds = terrain["bounds"]
    width_m, height_m = terrain["widthMeters"], terrain["heightMeters"]
    xs, ys = transform("EPSG:4326", terrain["crs"], [item["longitude"] for item in LANDMARKS], [item["latitude"] for item in LANDMARKS])
    landmarks = []
    for item, x, y in zip(LANDMARKS, xs, ys):
        u = float(np.clip((x - bounds[0]) / width_m, 0.0, 1.0)) if np is not None else max(0.0, min(1.0, (x - bounds[0]) / width_m))
        v = float(np.clip((bounds[3] - y) / height_m, 0.0, 1.0)) if np is not None else max(0.0, min(1.0, (bounds[3] - y) / height_m))
        col = int(round(u * (terrain["gridWidth"] - 1)))
        row = int(round(v * (terrain["gridHeight"] - 1)))
        elevation = terrain["minimumElevation"]
        if samples is not None:
            elevation += samples[row * terrain["gridWidth"] + col] / 65535.0 * (terrain["maximumElevation"] - terrain["minimumElevation"])
        landmarks.append({**item, "projectedX": float(x), "projectedY": float(y), "gridU": u, "gridV": v, "elevationMeters": float(elevation)})
    terrain["landmarks"] = landmarks


def build_minimal_html(meta: dict[str, Any]) -> str:
    template = r'''<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <title>桂林真实 DEM</title>
  <style>
    *{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#020504;font-family:Inter,"PingFang SC","Microsoft YaHei",system-ui,sans-serif}body{touch-action:none}
    .stage,#gl{position:absolute;inset:0;width:100%;height:100%;display:block}.stage{overflow:hidden;background:#020504}.labels{position:absolute;inset:0;z-index:2;pointer-events:none;overflow:hidden}
    .label{position:absolute;display:flex;align-items:center;gap:8px;transform:translate(-13px,-50%);filter:drop-shadow(0 6px 9px rgba(0,0,0,.85));will-change:left,top;pointer-events:auto;cursor:pointer}.label.flip{flex-direction:row-reverse;transform:translate(calc(-100% + 13px),-50%)}
    .ring{width:25px;height:25px;border:3px solid var(--marker);border-radius:50%;background:rgba(2,5,4,.28);box-shadow:0 0 0 5px color-mix(in srgb,var(--marker) 22%,transparent),inset 0 0 9px color-mix(in srgb,var(--marker) 45%,transparent);position:relative;animation:marker-spin 2.8s linear infinite}@keyframes marker-spin{to{transform:rotate(360deg)}}.ring:after{content:"";position:absolute;left:50%;top:22px;width:2px;height:32px;background:linear-gradient(var(--marker),transparent);transform:translateX(-50%)}
    .label-copy{padding:7px 11px;border:1px solid color-mix(in srgb,var(--marker) 55%,transparent);border-radius:14px;background:rgba(2,8,6,.80);backdrop-filter:blur(10px);white-space:nowrap}.name{display:block;color:#fff;font-size:13px;font-weight:750}.coords{display:block;margin-top:2px;color:#b6c7bf;font-size:10px;font-weight:500;letter-spacing:.01em}
    .reset{position:absolute;z-index:3;left:14px;top:14px;width:42px;height:42px;border:1px solid rgba(255,255,255,.18);border-radius:50%;background:rgba(3,10,7,.66);color:#fff;font-size:22px;cursor:pointer;backdrop-filter:blur(10px)}.reset:hover{border-color:#e7b760}.loading{position:absolute;inset:0;display:grid;place-items:center;color:transparent}
    .control-panel{position:absolute;z-index:4;right:16px;top:16px;width:min(318px,calc(100% - 32px));max-height:calc(100% - 32px);overflow:auto;padding:14px 15px;border:1px solid rgba(188,221,202,.22);border-radius:16px;background:rgba(4,12,9,.82);backdrop-filter:blur(16px);box-shadow:0 14px 40px rgba(0,0,0,.28);color:#eef5f0}.control-panel h2{margin:0 0 7px;font-size:14px}.control-panel p{margin:0;color:#aabdb2;font-size:11px;line-height:1.5}.focus-status{margin:9px 0;padding:8px 9px;border-radius:10px;background:rgba(231,183,96,.12);color:#f3d59a;font-size:12px;line-height:1.45}.panel-button{width:100%;margin:7px 0 10px;padding:8px 9px;border:1px solid rgba(255,255,255,.18);border-radius:9px;background:rgba(255,255,255,.06);color:#eef5f0;cursor:pointer;font:inherit;font-size:12px}.panel-button:hover{border-color:#e7b760}.gaea-title{margin:10px 0 6px;color:#f0c879;font-size:12px}.gaea-group{margin:10px 0 4px;padding-top:8px;border-top:1px solid rgba(255,255,255,.09);color:#f0c879;font-size:10px;letter-spacing:.08em;text-transform:uppercase}.gaea-row{display:grid;grid-template-columns:58px 1fr 30px;gap:7px;align-items:center;margin:6px 0;color:#b6c7bf;font-size:11px}.gaea-row input{width:100%;accent-color:#e7b760}.gaea-row output{text-align:right;color:#eef5f0;font-variant-numeric:tabular-nums}.water-checks{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin:6px 0}.water-check{display:flex;align-items:center;gap:4px;color:#b6c7bf;font-size:10px}.water-check input{accent-color:#6cc9e8}.water-note{margin-top:6px!important;font-size:10px!important}
  </style>
</head>
<body>
  <main class="stage">
    <canvas id="gl" aria-label="桂林真实一比一垂直比例三维 DEM，可拖动旋转并用滚轮连续缩放"></canvas>
    <div id="labels" class="labels" aria-label="地形地标"></div>
    <button id="reset" class="reset" type="button" aria-label="重置視角" title="重置視角">↺</button>
    <aside class="control-panel" aria-label="Gaea 視覺調整與水系精細區域"><h2>精細區域 · 200 平方公里</h2><p>長按地標 0.5 秒載入該地 12.5 米 DEM；焦點頁使用 2,400 × 2,400 顯示網格（僅瀏覽器重採樣，不改變來源像元）。</p><div id="focusStatus" class="focus-status">全域總覽 · 約 30 米網頁高度網格</div><button id="overview" class="panel-button" type="button" hidden>返回全域總覽</button><div class="gaea-title">Gaea 視覺調整（僅顯示效果）</div><div class="gaea-group">Hydraulic / Surface</div><label class="gaea-row"><span>水蝕</span><input data-gaea="erosion" type="range" min="0" max="1" step="0.01" value="0.25"><output>25</output></label><label class="gaea-row"><span>沉積</span><input data-gaea="deposition" type="range" min="0" max="1" step="0.01" value="0.25"><output>25</output></label><label class="gaea-row"><span>表面細節</span><input data-gaea="surface" type="range" min="0" max="1" step="0.01" value="0.30"><output>30</output></label><label class="gaea-row"><span>崩積</span><input data-gaea="talus" type="range" min="0" max="1" step="0.01" value="0.18"><output>18</output></label><div class="gaea-group">Karst / Material</div><label class="gaea-row"><span>喀斯特</span><input data-gaea="karst" type="range" min="0" max="1" step="0.01" value="0.25"><output>25</output></label><label class="gaea-row"><span>裸岩</span><input data-gaea="rock" type="range" min="0" max="1" step="0.01" value="0.22"><output>22</output></label><label class="gaea-row"><span>植被</span><input data-gaea="vegetation" type="range" min="0" max="1" step="0.01" value="0.45"><output>45</output></label><label class="gaea-row"><span>水面質感</span><input data-gaea="water" type="range" min="0" max="1" step="0.01" value="0.70"><output>70</output></label><div class="gaea-group">水系網絡（可獨立調整）</div><div class="water-checks"><label class="water-check"><input type="checkbox" data-water-network="lijiang" checked>漓江</label><label class="water-check"><input type="checkbox" data-water-network="xiangjiang" checked>湘江</label><label class="water-check"><input type="checkbox" data-water-network="other" checked>其他</label></div><label class="gaea-row"><span>漓江寬度</span><input data-water-width="lijiang" type="range" min="0.25" max="3" step="0.01" value="1"><output>1.00×</output></label><label class="gaea-row"><span>湘江寬度</span><input data-water-width="xiangjiang" type="range" min="0.25" max="3" step="0.01" value="1"><output>1.00×</output></label><label class="gaea-row"><span>其他寬度</span><input data-water-width="other" type="range" min="0.25" max="3" step="0.01" value="1"><output>1.00×</output></label><label class="gaea-row"><span>水色深淺</span><input data-water-color type="range" min="0" max="1" step="0.01" value="0.70"><output>70</output></label><p class="water-note">中心線以淡色顯示；可隱藏網絡或調整寬度、水色。只調整瀏覽器中的 Gaea 風格顯示，不改寫原始 DEM，也不代表測繪精度。</p></aside>
    <div id="loading" class="loading" aria-live="polite">加载中</div>
  </main>
<script>
const META=__META_JSON__,canvas=document.querySelector('#gl'),labelLayer=document.querySelector('#labels'),focusStatus=document.querySelector('#focusStatus'),overviewButton=document.querySelector('#overview');let renderer=null;
function mul(a,b){const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)o[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];return o}
function perspective(fov,aspect,near,far){const f=1/Math.tan(fov/2),nf=1/(near-far);return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)*nf,-1,0,0,2*far*near*nf,0])}
function lookAt(e,c,u){let zx=e[0]-c[0],zy=e[1]-c[1],zz=e[2]-c[2],zl=Math.hypot(zx,zy,zz)||1;zx/=zl;zy/=zl;zz/=zl;let xx=u[1]*zz-u[2]*zy,xy=u[2]*zx-u[0]*zz,xz=u[0]*zy-u[1]*zx,xl=Math.hypot(xx,xy,xz)||1;xx/=xl;xy/=xl;xz/=xl;const yx=zy*xz-zz*xy,yy=zz*xx-zx*xz,yz=zx*xy-zy*xx;return new Float32Array([xx,yx,zx,0,xy,yy,zy,0,xz,yz,zz,0,-(xx*e[0]+xy*e[1]+xz*e[2]),-(yx*e[0]+yy*e[1]+yz*e[2]),-(zx*e[0]+zy*e[1]+zz*e[2]),1])}
function remapWaterPolygons(source,focus){const gb=source.bounds,fb=focus.bounds,out=[];for(const poly of source.waterwayPolygons||[]){const flat=poly.points||[],p=[];for(let i=0;i+1<flat.length;i+=2){const x=gb[0]+Number(flat[i])*source.widthMeters,y=gb[3]-Number(flat[i+1])*source.heightMeters;p.push((x-fb[0])/focus.widthMeters,(fb[3]-y)/focus.heightMeters)}if(p.length<6)continue;let minU=1,maxU=0,minV=1,maxV=0;for(let i=0;i<p.length;i+=2){minU=Math.min(minU,p[i]);maxU=Math.max(maxU,p[i]);minV=Math.min(minV,p[i+1]);maxV=Math.max(maxV,p[i+1])}if(maxU>=-0.08&&minU<=1.08&&maxV>=-0.08&&minV<=1.08)out.push({...poly,points:p.map(v=>Number(v.toFixed(6)))});}return out}
function remapWaterways(source,focus){const gb=source.bounds,fb=focus.bounds,out=[];for(const line of source.waterways||[]){const flat=line.points||[],p=[];for(let i=0;i+1<flat.length;i+=2){const x=gb[0]+Number(flat[i])*source.widthMeters,y=gb[3]-Number(flat[i+1])*source.heightMeters;p.push((x-fb[0])/focus.widthMeters,(fb[3]-y)/focus.heightMeters)}if(p.length<4)continue;let inside=false;for(let i=0;i<p.length;i+=2)inside=inside||(p[i]>=-.08&&p[i]<=1.08&&p[i+1]>=-.08&&p[i+1]<=1.08);if(inside)out.push({...line,points:p.map(v=>Number(v.toFixed(6)))});}return out}
function resampleDisplayGrid(source,mask,width,height,target=2400){if(width>=target&&height>=target)return{height:source,mask,width,height};const outH=new Uint16Array(target*target),outM=new Uint8Array(target*target);for(let r=0;r<target;r++){const sy=(r/(target-1))*(height-1),r0=Math.floor(sy),r1=Math.min(height-1,r0+1),fy=sy-r0;for(let c=0;c<target;c++){const sx=(c/(target-1))*(width-1),c0=Math.floor(sx),c1=Math.min(width-1,c0+1),fx=sx-c0,i=r*target+c,a=r0*width+c0,b=r0*width+c1,d=r1*width+c0,e=r1*width+c1;outH[i]=Math.round((source[a]*(1-fx)+source[b]*fx)*(1-fy)+(source[d]*(1-fx)+source[e]*fx)*fy);outM[i]=mask[a]&&mask[b]&&mask[d]&&mask[e]?1:0}}return{height:outH,mask:outM,width:target,height:target}}
function triangulateWater(flat){const points=[];for(let i=0;i+1<flat.length;i+=2){const p=[Number(flat[i]),Number(flat[i+1])];if(!Number.isFinite(p[0])||!Number.isFinite(p[1]))continue;if(points.length&&Math.hypot(p[0]-points[points.length-1][0],p[1]-points[points.length-1][1])<1e-8)continue;points.push(p)}if(points.length>2&&Math.hypot(points[0][0]-points[points.length-1][0],points[0][1]-points[points.length-1][1])<1e-8)points.pop();if(points.length<3)return[];let area=0;for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];area+=a[0]*b[1]-b[0]*a[1]}if(Math.abs(area)<1e-10)return[];const indices=points.map((_,i)=>i);if(area<0)indices.reverse();const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);const inside=(p,a,b,c)=>cross(a,b,p)>=-1e-10&&cross(b,c,p)>=-1e-10&&cross(c,a,p)>=-1e-10;const out=[];let guard=0;while(indices.length>2&&guard++<points.length*points.length){let found=false;for(let pos=0;pos<indices.length;pos++){const ia=indices[(pos+indices.length-1)%indices.length],ib=indices[pos],ic=indices[(pos+1)%indices.length],a=points[ia],b=points[ib],c=points[ic];if(cross(a,b,c)<=1e-10)continue;let blocked=false;for(const index of indices){if(index===ia||index===ib||index===ic)continue;if(inside(points[index],a,b,c)){blocked=true;break}}if(blocked)continue;out.push([a,b,c]);indices.splice(pos,1);found=true;break}if(!found)return[]}return out}
class TerrainRenderer{
 constructor(canvas,meta,height,mask){this.canvas=canvas;this.globalMeta=meta;this.meta=meta;this.height=height;this.mask=mask;this.yaw=.72;this.pitch=.62;this.distance=2.7;this.target=[0,.05,0];this.exaggeration=1;this.drag=false;this.ecology=null;this.gaea={erosion:.25,deposition:.25,surface:.30,talus:.18,karst:.25,rock:.22,vegetation:.45,water:.70};this.water={visible:{lijiang:true,xiangjiang:true,other:true},width:{lijiang:1,xiangjiang:1,other:1},color:.70,centerlineOpacity:.28};this.focused=false;this.init();this.initLabels();this.bind();this.resize();this.loadEcology();requestAnimationFrame(()=>this.draw())}
 reset(){this.yaw=.72;this.pitch=.62;this.distance=this.focused?1.25:2.7;this.target=[0,.05,0]}
 shader(type,src){const g=this.gl,s=g.createShader(type);g.shaderSource(s,src);g.compileShader(s);if(!g.getShaderParameter(s,g.COMPILE_STATUS))throw new Error(g.getShaderInfoLog(s));return s}
 program(vs,fs){const g=this.gl,p=g.createProgram();g.attachShader(p,this.shader(g.VERTEX_SHADER,vs));g.attachShader(p,this.shader(g.FRAGMENT_SHADER,fs));g.linkProgram(p);if(!g.getProgramParameter(p,g.LINK_STATUS))throw new Error(g.getProgramInfoLog(p));return p}
 sample(u,v){const w=this.meta.gridWidth,h=this.meta.gridHeight,c=Math.max(0,Math.min(w-1,Math.round(u*(w-1)))),r=Math.max(0,Math.min(h-1,Math.round(v*(h-1))));return this.height[r*w+c]/65535}
 point(u,v,lift=0){const n=this.sample(u,v);return[(u-.5)*2*this.meta.widthMeters/this.maxDim,n*(this.meta.maximumElevation-this.meta.minimumElevation)/this.maxDim*2+lift,(v-.5)*2*this.meta.heightMeters/this.maxDim]}
 waterPoint(u,v){const epsilon=(2*0.6)/this.maxDim;return this.point(u,v,epsilon)}
 init(){const g=this.gl=this.canvas.getContext('webgl2',{antialias:true});if(!g)throw new Error('WebGL2 unavailable');
  const tvs=`#version 300 es\nin vec3 p;in float h;uniform mat4 vp;uniform float ex;out float vh;out vec3 wp;void main(){vec3 q=vec3(p.x,p.y*ex,p.z);wp=q;vh=h;gl_Position=vp*vec4(q,1.);}`;
  const tfs=`#version 300 es\nprecision highp float;in float vh;in vec3 wp;uniform vec4 fx;uniform vec4 fx2;out vec4 o;vec3 pal(float t){vec3 a=mix(vec3(.025,.10,.075),vec3(.16,.36,.16),smoothstep(0.,.38,t));vec3 b=mix(vec3(.16,.36,.16),vec3(.58,.47,.23),smoothstep(.32,.72,t));vec3 c=mix(b,vec3(.88,.86,.74),smoothstep(.68,1.,t));return mix(a,c,smoothstep(.28,.8,t));}void main(){vec3 n=normalize(cross(dFdx(wp),dFdy(wp)));if(!gl_FrontFacing)n=-n;vec3 l=normalize(vec3(-.4,.85,.25));float d=.25+.75*max(dot(n,l),0.);float slope=1.-clamp(n.y,0.,1.);float karst=smoothstep(.32,.88,slope)*fx.z;float rock=smoothstep(.45,.95,slope)*fx2.z;float soil=sin(wp.x*18.+wp.z*13.)*.5+.5;vec3 col=pal(vh);col=mix(col,col*vec3(.78,1.04,.82),fx.x*.34);col=mix(col,col+vec3(.10,.055,-.025),fx.y*.22);col=mix(col,col*vec3(.84,.88,1.12),karst*.30);col=mix(col,vec3(.60,.62,.57),rock*(.28+.10*soil));col=mix(col,col+vec3(.025,.09,.018),fx.w*.18);col=mix(col,col*vec3(.86,.92,.88),fx2.y*.10);col*=d+pow(slope,2.)*(.10+fx2.x*.12);o=vec4(col,1.);}`;
  this.programTerrain=this.program(tvs,tfs);this.fx=this.gl.getUniformLocation(this.programTerrain,'fx');this.fx2=this.gl.getUniformLocation(this.programTerrain,'fx2');this.ex=this.gl.getUniformLocation(this.programTerrain,'ex');const w=this.meta.gridWidth,H=this.meta.gridHeight;this.maxDim=Math.max(this.meta.widthMeters,this.meta.heightMeters);const verts=new Float32Array(w*H*4);let k=0;for(let r=0;r<H;r++)for(let c=0;c<w;c++){const i=r*w+c,n=this.height[i]/65535,valid=this.mask[i]>0;verts[k++]=(c/(w-1)-.5)*2*this.meta.widthMeters/this.maxDim;verts[k++]=valid?n*(this.meta.maximumElevation-this.meta.minimumElevation)/this.maxDim*2:0;verts[k++]=(r/(H-1)-.5)*2*this.meta.heightMeters/this.maxDim;verts[k++]=n}
  const step=innerWidth<700?4:innerWidth<1100?2:1,qr=Math.ceil((H-1)/step),qc=Math.ceil((w-1)/step),idx=new Uint32Array(qr*qc*6);let q=0;for(let r=0;r<H-1;r+=step){const r1=Math.min(r+step,H-1);for(let c=0;c<w-1;c+=step){const c1=Math.min(c+step,w-1),a=r*w+c,b=r*w+c1,d=r1*w+c,e=r1*w+c1;idx[q++]=a;idx[q++]=d;idx[q++]=b;idx[q++]=b;idx[q++]=d;idx[q++]=e}}this.count=q;
  const vao=g.createVertexArray();g.bindVertexArray(vao);const vb=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,vb);g.bufferData(g.ARRAY_BUFFER,verts,g.STATIC_DRAW);const pl=g.getAttribLocation(this.programTerrain,'p'),hl=g.getAttribLocation(this.programTerrain,'h');g.enableVertexAttribArray(pl);g.vertexAttribPointer(pl,3,g.FLOAT,false,16,0);g.enableVertexAttribArray(hl);g.vertexAttribPointer(hl,1,g.FLOAT,false,16,12);const ib=g.createBuffer();g.bindBuffer(g.ELEMENT_ARRAY_BUFFER,ib);g.bufferData(g.ELEMENT_ARRAY_BUFFER,idx,g.STATIC_DRAW);this.vao=vao;this.vp=g.getUniformLocation(this.programTerrain,'vp');
   const wvs=`#version 300 es\nin vec3 p;uniform mat4 vp;void main(){gl_Position=vp*vec4(p,1.);}`,wfs=`#version 300 es\nprecision highp float;uniform vec4 waterFx;out vec4 o;void main(){vec2 q=gl_FragCoord.xy*.014;float ripple=.5+.5*sin(q.x+q.y);vec3 base=mix(vec3(.02,.12,.18),vec3(.08,.52,.70),waterFx.x);base=mix(base,vec3(.16,.35,.36),waterFx.y*.35);base+=ripple*.018*waterFx.z;o=vec4(base,.72+.22*waterFx.w);}`;this.programWater=this.program(wvs,wfs);this.waterFx=g.getUniformLocation(this.programWater,'waterFx');this.waterVp=g.getUniformLocation(this.programWater,'vp');const lvs=`#version 300 es\nin vec3 p;uniform mat4 vp;void main(){gl_Position=vp*vec4(p,1.);}`,lfs=`#version 300 es\nprecision highp float;uniform vec3 lineColor;uniform float opacity;out vec4 o;void main(){o=vec4(lineColor,opacity);}`;this.programWaterLine=this.program(lvs,lfs);this.lineVp=g.getUniformLocation(this.programWaterLine,'vp');this.lineColor=g.getUniformLocation(this.programWaterLine,'lineColor');this.lineOpacity=g.getUniformLocation(this.programWaterLine,'opacity');this.rebuildWater();g.enable(g.DEPTH_TEST);g.enable(g.BLEND);g.blendFunc(g.SRC_ALPHA,g.ONE_MINUS_SRC_ALPHA)}
 rebuildWater(){const g=this.gl,water=[];for(const poly of this.meta.waterwayPolygons||[]){const network=poly.network||'other';if(!this.water.visible[network])continue;const flat=poly.points||[];let cx=0,cy=0,n=0;for(let i=0;i+1<flat.length;i+=2){cx+=Number(flat[i]);cy+=Number(flat[i+1]);n++}if(!n)continue;cx/=n;cy/=n;const scale=this.water.width[network]||1,scaled=[];for(let i=0;i+1<flat.length;i+=2)scaled.push(cx+(Number(flat[i])-cx)*scale,cy+(Number(flat[i+1])-cy)*scale);for(const tri of triangulateWater(scaled)){for(const point of tri)water.push(...this.waterPoint(point[0],point[1]))}}this.waterCount=water.length/3;this.waterVao=g.createVertexArray();g.bindVertexArray(this.waterVao);const wb=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,wb);g.bufferData(g.ARRAY_BUFFER,new Float32Array(water),g.STATIC_DRAW);const wp=g.getAttribLocation(this.programWater,'p');g.enableVertexAttribArray(wp);g.vertexAttribPointer(wp,3,g.FLOAT,false,12,0);const lines={lijiang:[],xiangjiang:[],other:[]};for(const line of this.meta.waterways||[]){const network=line.network||'other';if(this.water.visible[network]){const pts=line.points||[];for(let i=0;i+1<pts.length;i+=2)lines[network].push(...this.waterPoint(Number(pts[i]),Number(pts[i+1])));lines[network].push(NaN,NaN,NaN)}}this.waterLineVao={};this.waterLineCount={};for(const network of Object.keys(lines)){const data=lines[network].filter(Number.isFinite);this.waterLineCount[network]=data.length/3;const vao=g.createVertexArray();g.bindVertexArray(vao);const b=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,b);g.bufferData(g.ARRAY_BUFFER,new Float32Array(data),g.STATIC_DRAW);const lp=g.getAttribLocation(this.programWaterLine,'p');g.enableVertexAttribArray(lp);g.vertexAttribPointer(lp,3,g.FLOAT,false,12,0);this.waterLineVao[network]=vao}}
 initLabels(){labelLayer.replaceChildren();this.labels=(this.meta.landmarks||[]).map(item=>{const el=document.createElement('div');el.className='label';el.style.setProperty('--marker',item.color||'#f2bd65');const lon=Number(item.longitude),lat=Number(item.latitude);el.innerHTML=`<span class="ring"></span><span class="label-copy"><span class="name">${item.name}</span><span class="coords">${lon.toFixed(4)}° E · ${lat.toFixed(4)}° N</span></span>`;labelLayer.appendChild(el);let hold=null;const cancel=()=>{if(hold){clearTimeout(hold);hold=null}};el.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();cancel();hold=setTimeout(()=>{hold=null;this.focusRegion(item);navigator.vibrate?.(24)},500)});['pointerup','pointercancel','pointerleave'].forEach(type=>el.addEventListener(type,cancel));return{item,el}})}
 async focusRegion(item){const region=(this.globalMeta.fineRegions||[]).find(entry=>entry.id===item.id);if(!region?.assetManifest)return;focusStatus.textContent=`正在載入 ${region.name} · 200 平方公里 · 12.5 米 DEM`;try{const manifest=await fetch(`${region.assetManifest}?v=${encodeURIComponent(this.globalMeta.generatedAt||'')}`).then(r=>{if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.json()});const [hb,mb]=await Promise.all([fetch(`${region.assetManifest.replace(/terrain-manifest\.json$/,'')}${manifest.heightBinary}`).then(r=>r.arrayBuffer()),fetch(`${region.assetManifest.replace(/terrain-manifest\.json$/,'')}${manifest.maskBinary}`).then(r=>r.arrayBuffer())]);const sourceHeight=new Uint16Array(hb),sourceMask=new Uint8Array(mb),display=resampleDisplayGrid(sourceHeight,sourceMask,manifest.gridWidth,manifest.gridHeight,2400);const focusMeta={...manifest,gridWidth:display.width,gridHeight:display.height,displayGridPolicy:'12.5m source pixels; 2,400×2,400 browser display grid via bilinear resampling only',waterwayPolygons:remapWaterPolygons(this.globalMeta,manifest),waterways:remapWaterways(this.globalMeta,manifest),landmarks:manifest.landmarks,ecology:this.globalMeta.ecology?{...this.globalMeta.ecology,centerProjected:region.centerProjected,sideMeters:Math.sqrt(200000000),renderPolicy:'200 平方公里視圖中的生態示意；沿用既有 10 平方公里樣本，不宣稱全域植被測繪'}:undefined};this.meta=focusMeta;this.height=display.height;this.mask=display.mask;this.focused=true;this.init();this.initLabels();this.loadEcology();this.reset();this.distance=1.25;overviewButton.hidden=false;focusStatus.textContent=`${region.name} · 200 平方公里 · 12.5 米源像元 · 2,400×2,400 顯示網格`;navigator.vibrate?.(24)}catch(error){console.error(error);focusStatus.textContent=`${region.name} 載入失敗，請重試`}}
 async loadOverview(){this.meta=this.globalMeta;const [hb,mb]=await Promise.all([fetch(this.meta.heightBinary).then(r=>r.arrayBuffer()),fetch(this.meta.maskBinary).then(r=>r.arrayBuffer())]);this.height=new Uint16Array(hb);this.mask=new Uint8Array(mb);this.focused=false;this.init();this.initLabels();this.loadEcology();this.reset();overviewButton.hidden=true;focusStatus.textContent='全域總覽 · 約 30 米網頁高度網格'}
 projectLabel(item,vp,lift){const x=(item.gridU-.5)*2*this.meta.widthMeters/this.maxDim,z=(item.gridV-.5)*2*this.meta.heightMeters/this.maxDim,n=(item.elevationMeters-this.meta.minimumElevation)/(this.meta.maximumElevation-this.meta.minimumElevation),y=n*(this.meta.maximumElevation-this.meta.minimumElevation)/this.maxDim*2+lift,cx=vp[0]*x+vp[4]*y+vp[8]*z+vp[12],cy=vp[1]*x+vp[5]*y+vp[9]*z+vp[13],cw=vp[3]*x+vp[7]*y+vp[11]*z+vp[15];return{nx:cx/cw,ny:cy/cw,visible:cw>0&&cx/cw>-1.08&&cx/cw<1.08&&cy/cw>-1.08&&cy/cw<1.08}}
 updateLabels(vp){for(const {item,el} of this.labels){const p=this.projectLabel(item,vp,12/this.maxDim);el.hidden=!p.visible;if(p.visible){el.classList.toggle('flip',p.nx>.42);el.style.left=`${(p.nx*.5+.5)*this.canvas.clientWidth}px`;el.style.top=`${(-p.ny*.5+.5)*this.canvas.clientHeight}px`}}}
 async loadEcology(){const e=this.meta.ecology;if(!e?.ready)return;try{const base=e.assetBase;const [tb,sb,rb]=await Promise.all([fetch(`${base}/${e.treeBinary}`).then(r=>r.arrayBuffer()),fetch(`${base}/${e.shrubBinary}`).then(r=>r.arrayBuffer()),fetch(`${base}/${e.riceBinary}`).then(r=>r.arrayBuffer())]);const points=[];const add=(bytes,stride,kind,tree)=>{const dv=new DataView(bytes),count=Math.floor(bytes.byteLength/stride),center=e.centerProjected,side=e.sideMeters,groundLift=2/this.maxDim;for(let i=0;i<count;i++){const o=i*stride,qx=dv.getUint16(o,true),qz=dv.getUint16(o+2,true),localX=qx/65535*side-side/2,localZ=qz/65535*side-side/2,px=center[0]+localX,py=center[1]-localZ,u=(px-this.meta.bounds[0])/this.meta.widthMeters,v=(this.meta.bounds[3]-py)/this.meta.heightMeters;if(u<0||u>1||v<0||v>1)continue;const ground=this.sample(u,v)*(this.meta.maximumElevation-this.meta.minimumElevation)/this.maxDim*2+groundLift,size=tree?(.9+dv.getUint8(o+6)/255*2.3):(.55+dv.getUint8(o+6)/255*1.3);points.push((u-.5)*2*this.meta.widthMeters/this.maxDim,ground,(v-.5)*2*this.meta.heightMeters/this.maxDim,size,kind)}};add(tb,e.recordLayout.tree.stride,0,true);add(sb,e.recordLayout.shrub.stride,1,false);add(rb,e.recordLayout.rice.stride,2,false);const g=this.gl,vs=`#version 300 es\nin vec3 p;in float size;in float kind;uniform mat4 vp;uniform float zoom;out float vk;void main(){gl_Position=vp*vec4(p,1.);gl_PointSize=mix(1.2,7.5,zoom)*size;vk=kind;}`,fs=`#version 300 es\nprecision highp float;in float vk;uniform float zoom;out vec4 o;void main(){vec2 q=gl_PointCoord-.5;float d=length(q);if(d>.5)discard;float rim=smoothstep(.5,.12,d);vec3 c=vk<.5?vec3(.08,.30,.11):vk<1.5?vec3(.25,.52,.16):vec3(.64,.70,.16);if(vk>1.5){float rows=smoothstep(.18,.02,abs(sin((q.x+q.y)*28.)));c+=vec3(.16,.12,.03)*rows;}c*=.72+.38*rim;c+=vec3(.05,.08,.03)*(1.-d)*zoom;o=vec4(c,.58+.36*zoom);}`;this.programEcology=this.program(vs,fs);this.ecologyVao=g.createVertexArray();g.bindVertexArray(this.ecologyVao);const buffer=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,buffer);g.bufferData(g.ARRAY_BUFFER,new Float32Array(points),g.STATIC_DRAW);const pp=g.getAttribLocation(this.programEcology,'p'),ss=g.getAttribLocation(this.programEcology,'size'),kk=g.getAttribLocation(this.programEcology,'kind');g.enableVertexAttribArray(pp);g.vertexAttribPointer(pp,3,g.FLOAT,false,20,0);g.enableVertexAttribArray(ss);g.vertexAttribPointer(ss,1,g.FLOAT,false,20,12);g.enableVertexAttribArray(kk);g.vertexAttribPointer(kk,1,g.FLOAT,false,20,16);this.ecologyVp=g.getUniformLocation(this.programEcology,'vp');this.ecologyZoom=g.getUniformLocation(this.programEcology,'zoom');this.ecology={count:points.length/5}}catch(error){console.warn('ecology package unavailable',error)}}
  zoomToPointer(e){const rect=this.canvas.getBoundingClientRect(),nx=e.clientX/rect.width-.5,nz=e.clientY/rect.height-.5,scale=Math.max(.08,this.distance/2.7);this.target=[this.target[0]+nx*.42*scale,this.target[1],this.target[2]+nz*.42*scale];this.distance=Math.max(.012,this.distance*.62)}
  bind(){this.canvas.addEventListener('pointerdown',e=>{this.drag=true;this.moved=false;this.downAt=performance.now();this.x=e.clientX;this.y=e.clientY;this.canvas.setPointerCapture(e.pointerId)});this.canvas.addEventListener('pointermove',e=>{if(!this.drag)return;if(Math.hypot(e.clientX-this.x,e.clientY-this.y)>3)this.moved=true;this.yaw+=(e.clientX-this.x)*.008;this.pitch=Math.max(.10,Math.min(1.45,this.pitch+(e.clientY-this.y)*.006));this.x=e.clientX;this.y=e.clientY});this.canvas.addEventListener('pointerup',e=>{if(!this.moved&&performance.now()-this.downAt<450)this.zoomToPointer(e);this.drag=false});this.canvas.addEventListener('pointercancel',()=>this.drag=false);this.canvas.addEventListener('wheel',e=>{e.preventDefault();this.distance=Math.max(.012,Math.min(6,this.distance*Math.exp(e.deltaY*.0013)))},{passive:false});window.addEventListener('resize',()=>this.resize())}
 resize(){const d=Math.min(devicePixelRatio||1,2),w=Math.max(1,this.canvas.clientWidth),h=Math.max(1,this.canvas.clientHeight);if(this.canvas.width!==Math.round(w*d)||this.canvas.height!==Math.round(h*d)){this.canvas.width=Math.round(w*d);this.canvas.height=Math.round(h*d);this.gl.viewport(0,0,this.canvas.width,this.canvas.height)}}
  draw(){const g=this.gl;this.resize();g.clearColor(.006,.014,.012,1);g.clear(g.COLOR_BUFFER_BIT|g.DEPTH_BUFFER_BIT);const cp=Math.cos(this.pitch),eye=[this.target[0]+Math.sin(this.yaw)*cp*this.distance,this.target[1]+Math.sin(this.pitch)*this.distance+.12,this.target[2]+Math.cos(this.yaw)*cp*this.distance],vp=mul(perspective(.74,this.canvas.width/this.canvas.height,.0005,30),lookAt(eye,this.target,[0,1,0]));g.useProgram(this.programTerrain);g.bindVertexArray(this.vao);g.uniformMatrix4fv(this.vp,false,vp);g.uniform1f(this.ex,this.exaggeration);g.uniform4f(this.fx,this.gaea.erosion,this.gaea.surface,this.gaea.karst,this.gaea.vegetation);g.uniform4f(this.fx2,this.gaea.talus,this.gaea.vegetation,this.gaea.rock,this.gaea.deposition);g.drawElements(g.TRIANGLES,this.count,g.UNSIGNED_INT,0);if(this.waterCount){g.useProgram(this.programWater);g.bindVertexArray(this.waterVao);g.uniformMatrix4fv(this.waterVp,false,vp);g.uniform4f(this.waterFx,this.water.color,this.gaea.deposition,this.gaea.surface,this.gaea.water);g.drawArrays(g.TRIANGLES,0,this.waterCount)}if(this.programWaterLine){g.useProgram(this.programWaterLine);g.uniformMatrix4fv(this.lineVp,false,vp);g.uniform1f(this.lineOpacity,this.water.centerlineOpacity);for(const network of ['lijiang','xiangjiang','other']){if(this.water.visible[network]&&this.waterLineCount?.[network]){const c=network==='lijiang'?[.42,.78,.91]:network==='xiangjiang'?[.56,.84,1]:[.42,.68,.72];g.uniform3f(this.lineColor,...c);g.bindVertexArray(this.waterLineVao[network]);g.drawArrays(g.LINE_STRIP,0,this.waterLineCount[network])}}}if(this.ecology?.count&&this.distance<(this.focused?1.8:.72)){g.useProgram(this.programEcology);g.bindVertexArray(this.ecologyVao);g.uniformMatrix4fv(this.ecologyVp,false,vp);g.uniform1f(this.ecologyZoom,Math.min(1,Math.max(0,((this.focused?1.8:.72)-this.distance)/((this.focused?1.8:.72)-.08))));g.drawArrays(g.POINTS,0,this.ecology.count)}this.updateLabels(vp);requestAnimationFrame(()=>this.draw())}
}
document.querySelector('#reset').onclick=()=>renderer?.reset();
(async()=>{for(const input of document.querySelectorAll('[data-gaea]')){input.addEventListener('input',()=>{const key=input.dataset.gaea,value=Number(input.value);if(renderer)renderer.gaea[key]=value;input.parentElement.querySelector('output').textContent=Math.round(value*100)});}for(const input of document.querySelectorAll('[data-water-network]')){input.addEventListener('change',()=>{if(renderer){renderer.water.visible[input.dataset.waterNetwork]=input.checked;renderer.rebuildWater()}})}for(const input of document.querySelectorAll('[data-water-width]')){input.addEventListener('input',()=>{const key=input.dataset.waterWidth,value=Number(input.value);if(renderer){renderer.water.width[key]=value;renderer.rebuildWater()}input.parentElement.querySelector('output').textContent=value.toFixed(2)+'×'})}const waterColor=document.querySelector('[data-water-color]');waterColor?.addEventListener('input',()=>{const value=Number(waterColor.value);if(renderer)renderer.water.color=value;waterColor.parentElement.querySelector('output').textContent=Math.round(value*100)});overviewButton.onclick=()=>renderer?.loadOverview();})();
(async()=>{try{const t=META.terrain,[hb,mb]=await Promise.all([fetch(t.heightBinary).then(r=>r.arrayBuffer()),fetch(t.maskBinary).then(r=>r.arrayBuffer())]);renderer=new TerrainRenderer(canvas,t,new Uint16Array(hb),new Uint8Array(mb));document.querySelector('#loading').remove()}catch(error){console.error(error)}})();
</script>
</body></html>'''
    return template.replace("__META_JSON__", json.dumps(meta, ensure_ascii=False, separators=(",", ":")))


def build_html(meta: dict[str, Any], provisional_uri: str, preview_uri: str) -> str:
    template = r'''<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <title>桂林扩展 DEM 完整范围预览</title>
  <style>
    :root{color-scheme:dark;--bg:#07100e;--panel:rgba(14,27,23,.86);--line:rgba(188,221,202,.16);--text:#eef5f0;--muted:#9fb2a8;--accent:#e7b760;--good:#61c58d;--warn:#e99b61;--bad:#e27474}
    *{box-sizing:border-box}html,body{margin:0;min-height:100%;background:radial-gradient(circle at 68% 0,#193226 0,#0b1612 31%,#050908 100%);font-family:Inter,"PingFang SC","Microsoft YaHei",system-ui,sans-serif;color:var(--text)}
    body{overflow-x:hidden}.shell{max-width:1540px;margin:0 auto;padding:22px}.top{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:20px;align-items:end;margin-bottom:18px}
    .eyebrow{font-size:12px;letter-spacing:.18em;color:var(--accent);text-transform:uppercase}.title{font-size:clamp(28px,4vw,56px);line-height:1.04;margin:8px 0 10px;font-weight:760}.subtitle{color:var(--muted);max-width:900px;line-height:1.75}
    .badge{display:inline-flex;align-items:center;gap:9px;padding:10px 14px;border:1px solid var(--line);border-radius:999px;background:rgba(255,255,255,.04);font-size:13px;white-space:nowrap}.dot{width:9px;height:9px;border-radius:50%;background:var(--warn);box-shadow:0 0 18px currentColor}.badge.good .dot{background:var(--good)}
    .grid{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:16px}.viewer{position:relative;min-height:720px;border:1px solid var(--line);border-radius:24px;overflow:hidden;background:#020504;box-shadow:0 24px 80px rgba(0,0,0,.32)}
    #gl,#flat{position:absolute;inset:0;width:100%;height:100%;display:block}#flat{object-fit:contain;background:#f5f4ef;padding:18px}.hidden{display:none!important}
    .landmarks{position:absolute;inset:0;z-index:4;pointer-events:none;overflow:hidden}.landmark{position:absolute;display:flex;align-items:center;gap:9px;transform:translate(-13px,-50%);will-change:transform,left,top;filter:drop-shadow(0 7px 10px rgba(0,0,0,.72))}.landmark.flip{flex-direction:row-reverse;transform:translate(calc(-100% + 13px),-50%)}.landmark-ring{width:27px;height:27px;flex:0 0 auto;border:3px solid var(--marker);border-radius:50%;background:rgba(4,10,7,.25);box-shadow:0 0 0 5px color-mix(in srgb,var(--marker) 22%,transparent),inset 0 0 10px color-mix(in srgb,var(--marker) 40%,transparent);position:relative}.landmark-ring::after{content:"";position:absolute;left:50%;top:24px;width:2px;height:34px;background:linear-gradient(var(--marker),transparent);transform:translateX(-50%)}.landmark-label{padding:7px 10px;border:1px solid color-mix(in srgb,var(--marker) 58%,transparent);border-radius:999px;background:rgba(3,10,7,.82);backdrop-filter:blur(10px);font-size:13px;font-weight:750;white-space:nowrap;color:#fff}.landmark-label small{display:block;font-size:10px;font-weight:500;color:#b8c8bf;margin-top:2px}
    .toolbar{position:absolute;z-index:5;left:18px;top:18px;display:flex;flex-wrap:wrap;gap:8px}.btn{border:1px solid rgba(255,255,255,.16);background:rgba(5,12,9,.72);backdrop-filter:blur(14px);color:var(--text);padding:10px 13px;border-radius:12px;cursor:pointer;font:inherit}.btn:hover,.btn.active{border-color:rgba(231,183,96,.7);background:rgba(67,48,20,.54)}
    .hud{position:absolute;z-index:5;left:18px;right:18px;bottom:18px;display:grid;grid-template-columns:1fr auto;gap:12px;align-items:end}.hud-card{max-width:680px;padding:15px 16px;border:1px solid var(--line);background:rgba(4,10,7,.74);backdrop-filter:blur(15px);border-radius:16px}.hud-title{font-weight:700;margin-bottom:6px}.hud-copy{font-size:13px;color:var(--muted);line-height:1.6}.control{display:flex;align-items:center;gap:10px;padding:12px 14px;border:1px solid var(--line);background:rgba(4,10,7,.76);backdrop-filter:blur(15px);border-radius:14px;font-size:12px}.control input{width:150px}
    .side{display:flex;flex-direction:column;gap:14px}.card{border:1px solid var(--line);border-radius:18px;background:var(--panel);padding:18px;box-shadow:0 12px 40px rgba(0,0,0,.18)}.card h2{margin:0 0 13px;font-size:15px}.metric{display:grid;grid-template-columns:1fr auto;gap:12px;padding:9px 0;border-bottom:1px solid rgba(255,255,255,.075);font-size:13px}.metric:last-child{border-bottom:0}.metric span:first-child{color:var(--muted)}.metric strong{text-align:right;font-weight:650}
    .statusline{display:flex;gap:10px;align-items:flex-start;font-size:13px;line-height:1.55;color:var(--muted);margin:11px 0}.statusline i{width:8px;height:8px;margin-top:6px;border-radius:50%;background:var(--good);flex:0 0 auto}.statusline.warn i{background:var(--warn)}.statusline.bad i{background:var(--bad)}
    .sources{font-size:12px;line-height:1.7;color:var(--muted);word-break:break-word}.footer{margin:18px 0 6px;color:#7f9288;font-size:12px;line-height:1.8}.empty{position:absolute;inset:0;display:grid;place-items:center;padding:40px;text-align:center;background:linear-gradient(155deg,#0c1c17,#050907)}.empty img{max-width:min(90%,760px);max-height:72vh;border-radius:18px;background:white}.empty h3{margin:18px 0 8px;font-size:21px}.empty p{margin:0;color:var(--muted);max-width:650px;line-height:1.8}
    @media(max-width:1080px){.grid{grid-template-columns:1fr}.side{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}.viewer{min-height:680px}}@media(max-width:700px){.shell{padding:12px}.top{grid-template-columns:1fr}.viewer{min-height:590px;border-radius:18px}.side{grid-template-columns:1fr}.hud{grid-template-columns:1fr}.control{justify-content:space-between}.toolbar{left:10px;top:10px}.hud{left:10px;right:10px;bottom:10px}.title{font-size:34px}}
  </style>
</head>
<body>
<div class="shell">
  <header class="top">
    <div><div class="eyebrow">DEM MAP PIPELINE · GUILIN</div><h1 class="title">桂林—全州扩展 DEM</h1><div class="subtitle">使用 9 张实际下载的约 30 米 DEM 源片连续拼接，范围从阳朔、平乐向北覆盖真宝鼎，并向东扩展至全州县城以东。网页不再使用插值补边。</div></div>
    <div id="statusBadge" class="badge"><span class="dot"></span><span id="statusText">读取状态</span></div>
  </header>
  <main class="grid">
    <section class="viewer">
      <canvas id="gl"></canvas>
      <img id="flat" class="hidden" alt="DEM 二维预览">
      <div id="landmarks" class="landmarks" aria-label="地形地标"></div>
      <div id="empty" class="empty hidden"><div><img id="scopeImage" alt="任务范围"><h3>云端 DEM 构建已经登记</h3><p>当前页面先显示任务范围。GitHub Actions 完成源片下载、拼接、裁切和质检后，这里会自动切换为可旋转的真实三维地形。</p></div></div>
      <div class="toolbar"><button class="btn active" data-view="3d">三维地形</button><button class="btn" data-view="2d">二维高程图</button><button class="btn" id="reset">重置视角</button></div>
      <div class="hud"><div class="hud-card"><div class="hud-title" id="hudTitle">2048 级真实 DEM 地形</div><div class="hud-copy" id="hudCopy">拖动旋转，滚轮缩放。圆圈标出真宝鼎、阳朔县城和秧塘机场旧址。</div></div><label class="control">垂直倍率 <input id="exaggeration" type="range" min="0.6" max="8" step="0.1" value="3.2"><strong id="exValue">3.2×</strong></label></div>
    </section>
    <aside class="side">
      <section class="card"><h2>范围</h2><div class="metric"><span>北端</span><strong id="north">读取中</strong></div><div class="metric"><span>南端</span><strong id="south">读取中</strong></div><div class="metric"><span>网页范围面积</span><strong id="area">读取中</strong></div><div class="metric"><span>目标坐标系</span><strong>EPSG:32649</strong></div></section>
      <section class="card"><h2>成果</h2><div class="metric"><span>当前数据源</span><strong id="source">读取中</strong></div><div class="metric"><span>输出像元</span><strong id="spacing">读取中</strong></div><div class="metric"><span>网页高度网格</span><strong id="gridResolution">读取中</strong></div><div class="metric"><span>连续覆盖</span><strong id="coverage">读取中</strong></div><div class="metric"><span>高程范围</span><strong id="elev">读取中</strong></div></section>
      <section class="card"><h2>构建状态</h2><div id="statusLines"></div></section>
      <section class="card"><h2>源片与谱系</h2><div id="sourceDetail" class="sources"></div></section>
    </aside>
  </main>
  <div class="footer">成果登记规则：当前网页使用 2048 级高度网格，全部来自实际下载并拼接的约 30 米 DEM；不使用外推或网页补边。ASF RTC 产品按“12.5 米输出像元参考 DEM”记录，不登记为原生 12.5 米测绘高程。</div>
</div>
<script>
const META=__META_JSON__;
const PROVISIONAL='__PROVISIONAL_DATA__';
const PREVIEW='__PREVIEW_DATA__';
const $=s=>document.querySelector(s);
const fmt=(n,d=2)=>Number.isFinite(Number(n))?Number(n).toLocaleString('zh-CN',{maximumFractionDigits:d}):'待生成';
function setStatus(){
  const t=META.terrain||{}; const s=META.runtimeSource||{}; const ready=!!t.ready;
  $('#statusText').textContent=ready?(s.temporaryFallback?'临时完整范围图已生成':'ASF 完整范围图已生成'):'等待云端构建';
  $('#statusBadge').classList.toggle('good',ready&&!s.temporaryFallback);
  const wb=META.scope?.webContextBounds;
  $('#north').textContent=wb?`北纬 ${fmt(wb[3],2)}°（越过真宝鼎）`:`真宝鼎北 ${fmt(META.scope?.northExtensionMeters/1000,0)} km`;
  $('#south').textContent=wb?`北纬 ${fmt(wb[1],2)}°（阳朔—平乐南侧）`:'阳朔与平乐共享边界';
  $('#area').textContent=`${fmt(META.scope?.areaSquareKilometers,1)} km²`;
  $('#source').textContent=s.productLabel||'等待下载';
  $('#spacing').textContent=t.resolution?`${fmt(t.resolution[0],1)} m`:(s.outputPixelSpacingMeters?`${fmt(s.outputPixelSpacingMeters,1)} m`:'待生成');
  $('#gridResolution').textContent=t.ready?`${fmt(t.gridWidth,0)} × ${fmt(t.gridHeight,0)}（2048级）`:'待生成';
  $('#coverage').textContent=t.ready?`${fmt((t.validFraction||0)*100,3)}%`:'待质检';
  $('#elev').textContent=t.ready?`${fmt(t.minimumElevation,1)} 至 ${fmt(t.maximumElevation,1)} m`:'待生成';
  const lines=[];
  lines.push([META.boundaryExact?'good':'warn',META.boundaryExact?'阳朔平乐共享边界已精确解析':'当前仍使用离线范围预览']);
  lines.push([META.asfPlanCreated?'good':'warn',META.asfPlanCreated?`ASF 新增选片计划已生成，共 ${META.selectedProductCount||0} 项`:'ASF 选片计划等待云端检索']);
  lines.push([ready?'good':'warn',ready?'拼接、裁切、COG 与网页高度网格已生成':'真实 DEM 尚未生成']);
  lines.push([t.sourceCoverageType==='downloaded'?'good':'warn',`真实下载 DEM 覆盖 ${fmt((t.sourceValidFraction||0)*100,3)}%；未使用插值补边`]);
  if(t.landmarks?.length) lines.push(['good','真宝鼎、阳朔县城与秧塘机场旧址地标已校准']);
  if(s.temporaryFallback) lines.push(['warn','当前显示公开约30米临时完整范围图，ASF 下载完成后会替换']);
  $('#statusLines').innerHTML=lines.map(([c,x])=>`<div class="statusline ${c==='warn'?'warn':c==='bad'?'bad':''}"><i></i><span>${x}</span></div>`).join('');
  const detail=[];
  detail.push(`<b>模式</b>：${s.mode||'pending'}`);
  detail.push(`<b>提供方</b>：${s.provider||'等待数据'}`);
  if(META.existingResolvedCount!=null) detail.push(`<b>旧源片复用</b>：${META.existingResolvedCount}/5`);
  if(META.sourceFileCount!=null) detail.push(`<b>实际参与拼接</b>：${META.sourceFileCount} 张`);
  if(s.replacementPolicy) detail.push(`<b>替换规则</b>：${s.replacementPolicy}`);
  $('#sourceDetail').innerHTML=detail.join('<br>');
}
setStatus();
const canvas=$('#gl'),flat=$('#flat'),empty=$('#empty'),scopeImage=$('#scopeImage'),landmarkLayer=$('#landmarks');
flat.src=PREVIEW||PROVISIONAL; scopeImage.src=PROVISIONAL;
let renderer=null;
function showView(view){
  document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
  landmarkLayer.classList.toggle('hidden',view!=='3d');
  if(view==='2d'){canvas.classList.add('hidden');empty.classList.add('hidden');flat.classList.remove('hidden');}
  else{flat.classList.add('hidden');if(META.terrain?.ready){canvas.classList.remove('hidden');empty.classList.add('hidden');renderer?.resize();}else{canvas.classList.add('hidden');empty.classList.remove('hidden');}}
}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>showView(b.dataset.view));
$('#reset').onclick=()=>renderer?.reset();
const slider=$('#exaggeration');slider.oninput=()=>{ $('#exValue').textContent=`${Number(slider.value).toFixed(1)}×`; if(renderer) renderer.exaggeration=Number(slider.value); };

function mul(a,b){const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)o[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];return o}
function perspective(fov,aspect,near,far){const f=1/Math.tan(fov/2),nf=1/(near-far);return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)*nf,-1,0,0,2*far*near*nf,0])}
function lookAt(e,c,u){let zx=e[0]-c[0],zy=e[1]-c[1],zz=e[2]-c[2],zl=Math.hypot(zx,zy,zz)||1;zx/=zl;zy/=zl;zz/=zl;let xx=u[1]*zz-u[2]*zy,xy=u[2]*zx-u[0]*zz,xz=u[0]*zy-u[1]*zx,xl=Math.hypot(xx,xy,xz)||1;xx/=xl;xy/=xl;xz/=xl;const yx=zy*xz-zz*xy,yy=zz*xx-zx*xz,yz=zx*xy-zy*xx;return new Float32Array([xx,yx,zx,0,xy,yy,zy,0,xz,yz,zz,0,-(xx*e[0]+xy*e[1]+xz*e[2]),-(yx*e[0]+yy*e[1]+yz*e[2]),-(zx*e[0]+zy*e[1]+zz*e[2]),1])}
class TerrainRenderer{
 constructor(canvas,meta,height,mask){this.canvas=canvas;this.meta=meta;this.height=height;this.mask=mask;this.yaw=.72;this.pitch=.68;this.distance=2.75;this.exaggeration=Number(slider.value);this.drag=false;this.init();this.initLabels();this.bind();this.resize();requestAnimationFrame(()=>this.draw())}
 reset(){this.yaw=.72;this.pitch=.68;this.distance=2.75}
 shader(type,src){const g=this.gl,s=g.createShader(type);g.shaderSource(s,src);g.compileShader(s);if(!g.getShaderParameter(s,g.COMPILE_STATUS))throw new Error(g.getShaderInfoLog(s));return s}
 init(){const g=this.gl=this.canvas.getContext('webgl2',{antialias:true});if(!g)throw new Error('WebGL2 unavailable');
 const vs=`#version 300 es\nin vec3 p;in float h;uniform mat4 vp;uniform float ex;out float vh;out vec3 wp;void main(){vec3 q=vec3(p.x,p.y*ex,p.z);wp=q;vh=h;gl_Position=vp*vec4(q,1.);}`;
 const fs=`#version 300 es\nprecision highp float;in float vh;in vec3 wp;out vec4 o;vec3 pal(float t){vec3 a=mix(vec3(.035,.12,.10),vec3(.20,.38,.19),smoothstep(0.,.38,t));vec3 b=mix(vec3(.20,.38,.19),vec3(.62,.50,.27),smoothstep(.32,.72,t));vec3 c=mix(b,vec3(.90,.88,.78),smoothstep(.68,1.,t));return mix(a,c,smoothstep(.28,.8,t));}void main(){vec3 n=normalize(cross(dFdx(wp),dFdy(wp)));if(!gl_FrontFacing)n=-n;vec3 l=normalize(vec3(-.4,.85,.25));float d=.28+.72*max(dot(n,l),0.);float rim=pow(1.-max(n.y,0.),2.)*.12;vec3 col=pal(vh)*(d+rim);o=vec4(col,1.);}`;
 const pr=g.createProgram();g.attachShader(pr,this.shader(g.VERTEX_SHADER,vs));g.attachShader(pr,this.shader(g.FRAGMENT_SHADER,fs));g.linkProgram(pr);if(!g.getProgramParameter(pr,g.LINK_STATUS))throw new Error(g.getProgramInfoLog(pr));this.program=pr;
 const w=this.meta.gridWidth,H=this.meta.gridHeight,maxDim=Math.max(this.meta.widthMeters,this.meta.heightMeters),verts=new Float32Array(w*H*4);this.maxDim=maxDim;let k=0;for(let r=0;r<H;r++)for(let c=0;c<w;c++){const i=r*w+c,n=this.height[i]/65535,valid=this.mask[i]>0;verts[k++]=(c/(w-1)-.5)*2*this.meta.widthMeters/maxDim;verts[k++]=valid?n*(this.meta.maximumElevation-this.meta.minimumElevation)/maxDim*2:0;verts[k++]=(r/(H-1)-.5)*2*this.meta.heightMeters/maxDim;verts[k++]=n}
 const step=innerWidth<700?4:innerWidth<1100?2:1,quadRows=Math.ceil((H-1)/step),quadCols=Math.ceil((w-1)/step),idx=new Uint32Array(quadRows*quadCols*6);let q=0;for(let r=0;r<H-1;r+=step){const r1=Math.min(r+step,H-1);for(let c=0;c<w-1;c+=step){const c1=Math.min(c+step,w-1),a=r*w+c,b=r*w+c1,d=r1*w+c,e=r1*w+c1;idx[q++]=a;idx[q++]=d;idx[q++]=b;idx[q++]=b;idx[q++]=d;idx[q++]=e}}this.count=q;
 const vao=g.createVertexArray();g.bindVertexArray(vao);const vb=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,vb);g.bufferData(g.ARRAY_BUFFER,verts,g.STATIC_DRAW);const pl=g.getAttribLocation(pr,'p'),hl=g.getAttribLocation(pr,'h');g.enableVertexAttribArray(pl);g.vertexAttribPointer(pl,3,g.FLOAT,false,16,0);g.enableVertexAttribArray(hl);g.vertexAttribPointer(hl,1,g.FLOAT,false,16,12);const ib=g.createBuffer();g.bindBuffer(g.ELEMENT_ARRAY_BUFFER,ib);g.bufferData(g.ELEMENT_ARRAY_BUFFER,idx,g.STATIC_DRAW);this.vao=vao;this.vp=g.getUniformLocation(pr,'vp');this.ex=g.getUniformLocation(pr,'ex');g.enable(g.DEPTH_TEST);g.enable(g.CULL_FACE);g.cullFace(g.BACK)}
 initLabels(){landmarkLayer.replaceChildren();this.landmarks=(this.meta.landmarks||[]).map(item=>{const el=document.createElement('div');el.className='landmark';el.style.setProperty('--marker',item.color||'#f2bd65');el.innerHTML=`<span class="landmark-ring"></span><span class="landmark-label">${item.name}<small>${item.longitude.toFixed(4)}° E · ${item.latitude.toFixed(4)}° N</small></span>`;landmarkLayer.appendChild(el);return{item,el}})}
 updateLabels(vp){for(const {item,el} of this.landmarks){const x=(item.gridU-.5)*2*this.meta.widthMeters/this.maxDim,z=(item.gridV-.5)*2*this.meta.heightMeters/this.maxDim,n=(item.elevationMeters-this.meta.minimumElevation)/(this.meta.maximumElevation-this.meta.minimumElevation),y=n*(this.meta.maximumElevation-this.meta.minimumElevation)/this.maxDim*2*this.exaggeration+.075;const cx=vp[0]*x+vp[4]*y+vp[8]*z+vp[12],cy=vp[1]*x+vp[5]*y+vp[9]*z+vp[13],cw=vp[3]*x+vp[7]*y+vp[11]*z+vp[15],nx=cx/cw,ny=cy/cw,visible=cw>0&&nx>-1.08&&nx<1.08&&ny>-1.08&&ny<1.08;el.hidden=!visible;if(visible){el.classList.toggle('flip',nx>.42);el.style.left=`${(nx*.5+.5)*this.canvas.clientWidth}px`;el.style.top=`${(-ny*.5+.5)*this.canvas.clientHeight}px`}}}
 bind(){this.canvas.addEventListener('pointerdown',e=>{this.drag=true;this.x=e.clientX;this.y=e.clientY;this.canvas.setPointerCapture(e.pointerId)});this.canvas.addEventListener('pointermove',e=>{if(!this.drag)return;this.yaw+=(e.clientX-this.x)*.008;this.pitch=Math.max(.18,Math.min(1.35,this.pitch+(e.clientY-this.y)*.006));this.x=e.clientX;this.y=e.clientY});this.canvas.addEventListener('pointerup',()=>this.drag=false);this.canvas.addEventListener('wheel',e=>{e.preventDefault();this.distance=Math.max(1.15,Math.min(5,this.distance*Math.exp(e.deltaY*.001)))},{passive:false});window.addEventListener('resize',()=>this.resize())}
 resize(){const d=Math.min(devicePixelRatio||1,2),w=Math.max(1,this.canvas.clientWidth),h=Math.max(1,this.canvas.clientHeight);if(this.canvas.width!==Math.round(w*d)||this.canvas.height!==Math.round(h*d)){this.canvas.width=Math.round(w*d);this.canvas.height=Math.round(h*d);this.gl?.viewport(0,0,this.canvas.width,this.canvas.height)}}
 draw(){const g=this.gl;this.resize();g.clearColor(.012,.025,.021,1);g.clear(g.COLOR_BUFFER_BIT|g.DEPTH_BUFFER_BIT);const cp=Math.cos(this.pitch),eye=[Math.sin(this.yaw)*cp*this.distance,Math.sin(this.pitch)*this.distance+.2,Math.cos(this.yaw)*cp*this.distance],vp=mul(perspective(.78,this.canvas.width/this.canvas.height,.01,20),lookAt(eye,[0,.06,0],[0,1,0]));g.useProgram(this.program);g.bindVertexArray(this.vao);g.uniformMatrix4fv(this.vp,false,vp);g.uniform1f(this.ex,this.exaggeration);g.drawElements(g.TRIANGLES,this.count,g.UNSIGNED_INT,0);this.updateLabels(vp);requestAnimationFrame(()=>this.draw())}
}
async function startTerrain(){if(!META.terrain?.ready){showView('3d');return}try{const [hb,mb]=await Promise.all([fetch(META.terrain.heightBinary).then(r=>r.arrayBuffer()),fetch(META.terrain.maskBinary).then(r=>r.arrayBuffer())]);renderer=new TerrainRenderer(canvas,META.terrain,new Uint16Array(hb),new Uint8Array(mb));showView('3d')}catch(e){console.error(e);showView('2d');$('#hudCopy').textContent='三维高度网格载入失败，已切换二维预览。'}}
startTerrain();
</script>
</body></html>'''
    return (
        template.replace("__META_JSON__", json.dumps(meta, ensure_ascii=False, separators=(",", ":")))
        .replace("__PROVISIONAL_DATA__", provisional_uri)
        .replace("__PREVIEW_DATA__", preview_uri)
    )


def run(config_path: Path, root: Path, site: Path) -> int:
    config = read_json(config_path)
    site.mkdir(parents=True, exist_ok=True)
    assets = site / "assets"
    assets.mkdir(parents=True, exist_ok=True)

    provisional_json = assets / "AOI_PREVIEW_PROVISIONAL.json"
    provisional_png = assets / "AOI_PREVIEW_PROVISIONAL.png"
    resolved_path = root / config["outputs"]["resolvedAoiJson"]
    resolved = json_if_exists(resolved_path, json_if_exists(provisional_json, {}))
    runtime_source = json_if_exists(root / "metadata" / "runtime_source.json", {"mode": "pending", "productLabel": "等待云端下载", "temporaryFallback": False})
    qa = json_if_exists(root / config["outputs"]["qaReport"], {})
    plan = json_if_exists(root / config["outputs"]["downloadPlan"], {})
    existing = json_if_exists(root / config["outputs"]["existingResolved"], {})
    source_manifest = json_if_exists(root / config["outputs"]["sourceManifest"], {})

    context_output = config.get("webContext", {}).get("output")
    dem_path = root / context_output if context_output else root / config["outputs"]["finalDem"]
    terrain: dict[str, Any] = {"ready": False}
    preview_uri = ""
    if dem_path.exists():
        terrain = downsample_height(dem_path, assets)
        attach_waterways(terrain, root / "metadata" / "waterways_osm.geojson", assets, root / "metadata" / "lijiang_osm.geojson")
        if not terrain.get("waterways"):
            attach_lijiang(terrain, root / "metadata" / "lijiang_osm.geojson")
        terrain["verticalScale"] = 1.0
        focus_index = json_if_exists(root / "metadata" / "fine_regions_12_5m.json", {})
        terrain["fineRegions"] = focus_index.get("regions") or json_if_exists(root / "metadata" / "fine_regions_1m_plan.json", {}).get("regions", [])
        attach_ecology(terrain, root / "metadata" / "ecology" / "v0.3.1", assets)
        terrain["manifestUrl"] = "assets/terrain-manifest.json"
        write_json(assets / "terrain-manifest.json", terrain)
        preview_uri = "assets/DEM_PREVIEW.png"

    scope = {
        "northExtensionMeters": float(config.get("aoi", {}).get("northExtensionMeters", 15000)),
        "areaSquareKilometers": (
            terrain.get("widthMeters", 0) * terrain.get("heightMeters", 0) / 1_000_000
            if context_output and terrain.get("ready")
            else resolved.get("final", {}).get("areaSquareKilometersProjected")
        ),
        "bounds": config.get("webContext", {}).get("boundsWgs84", resolved.get("final", {}).get("bounds")),
        "webContextBounds": config.get("webContext", {}).get("boundsWgs84"),
    }
    selected = plan.get("selectedNewProducts", []) if isinstance(plan, dict) else []
    source_files = qa.get("sourceLineage", {}).get("files", []) if isinstance(qa, dict) else []
    cloud_status = json_if_exists(root / "reports" / "CLOUD_RUN_STATUS.json", {})
    meta = {
        "generatedAt": utc_now(),
        "project": config["project"],
        "scope": scope,
        "boundaryExact": resolved.get("status") == "exact_boundary_resolved",
        "runtimeSource": runtime_source,
        "terrain": terrain,
        "asfPlanCreated": bool(selected) or bool(cloud_status.get("asfPlanCreated")),
        "selectedProductCount": len(selected),
        "existingResolvedCount": int(existing.get("resolvedCount", 0) or 0),
        "sourceFileCount": (
            len(source_manifest.get("tiles", []))
            if context_output and isinstance(source_manifest, dict)
            else len(source_files) if source_files
            else len(source_manifest.get("tiles", [])) if isinstance(source_manifest, dict) else 0
        ),
        "qaStatus": qa.get("status"),
    }
    write_json(site / "status.json", meta)
    provisional_uri = "assets/AOI_PREVIEW_PROVISIONAL.png" if provisional_png.exists() else ""
    html = build_minimal_html(meta)
    (site / "index.html").write_text(html, encoding="utf-8")
    print(f"网页预览：{site / 'index.html'}")
    return 0


def run_from_manifest(manifest_path: Path, status_path: Path, root: Path, site: Path) -> int:
    """Refresh overlays and HTML when rasterio/numpy are unavailable but the raster package is intact."""
    site.mkdir(parents=True, exist_ok=True)
    assets = site / "assets"
    assets.mkdir(parents=True, exist_ok=True)
    terrain = read_json(manifest_path)
    refresh_landmarks_from_manifest(terrain)
    attach_waterways(terrain, root / "metadata" / "waterways_osm.geojson", assets, root / "metadata" / "lijiang_osm.geojson")
    if not terrain.get("waterways"):
        attach_lijiang(terrain, root / "metadata" / "lijiang_osm.geojson")
    terrain["verticalScale"] = 1.0
    focus_index = json_if_exists(root / "metadata" / "fine_regions_12_5m.json", {})
    terrain["fineRegions"] = focus_index.get("regions") or json_if_exists(root / "metadata" / "fine_regions_1m_plan.json", {}).get("regions", [])
    attach_ecology(terrain, root / "metadata" / "ecology" / "v0.3.1", assets)
    write_json(manifest_path, terrain)
    meta = json_if_exists(status_path, {})
    meta["generatedAt"] = utc_now()
    meta["terrain"] = terrain
    meta["waterwayCount"] = terrain.get("waterwayCount", 0)
    meta["ecology"] = terrain.get("ecology", {})
    plan = json_if_exists(root / "metadata" / "selected_new_products.json", {})
    meta["asfPlanCreated"] = bool(plan.get("selectedNewProducts"))
    meta["selectedProductCount"] = len(plan.get("selectedNewProducts", [])) if isinstance(plan, dict) else 0
    write_json(status_path, meta)
    (site / "index.html").write_text(build_minimal_html(meta), encoding="utf-8")
    print(f"网页预览：{site / 'index.html'}")
    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build the self-contained DEM web preview")
    parser.add_argument("--config", required=True)
    parser.add_argument("--root", required=True)
    parser.add_argument("--site", required=True)
    parser.add_argument("--from-manifest")
    parser.add_argument("--status")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        if args.from_manifest:
            status = Path(args.status).resolve() if args.status else Path(args.site).resolve() / "status.json"
            return run_from_manifest(Path(args.from_manifest).resolve(), status, Path(args.root).resolve(), Path(args.site).resolve())
        return run(Path(args.config).resolve(), Path(args.root).resolve(), Path(args.site).resolve())
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
