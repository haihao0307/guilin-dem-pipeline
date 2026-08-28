"""Native-grid analysis helpers for Yangshuo Lijiang candidates v3.0."""
from __future__ import annotations

import math
from typing import Any, Iterator


def terrain_derivatives(np: Any, heights: Any, valid: Any, spacing: float) -> dict[str, Any]:
    z = np.asarray(heights, dtype=np.float64).copy(); z[~valid] = np.nan
    row, col = np.gradient(z, spacing, spacing); east, north = col, -row
    slope = np.degrees(np.arctan(np.hypot(east, north)))
    curvature = np.gradient(east, spacing, axis=1) - np.gradient(north, spacing, axis=0)
    azimuth, altitude = math.radians(315), math.radians(45)
    light = (math.sin(azimuth) * math.cos(altitude), math.cos(azimuth) * math.cos(altitude), math.sin(altitude))
    nx, ny, nz = -east, -north, np.ones(z.shape); length = np.sqrt(nx * nx + ny * ny + nz * nz)
    hillshade = np.clip(((nx * light[0] + ny * light[1] + nz * light[2]) / length + 1) * 127.5, 0, 255)
    derivative_valid = valid & np.isfinite(slope) & np.isfinite(curvature) & np.isfinite(hillshade)
    return {"slopeDegrees": slope, "curvature": curvature, "hillshade": hillshade, "valid": derivative_valid}


def normalize(np: Any, values: Any, valid: Any, signed: bool = False) -> tuple[Any, dict[str, float]]:
    output = np.zeros(values.shape, dtype=np.uint8); usable = valid & np.isfinite(values)
    if not bool(usable.any()): return output, {"low": 0.0, "high": 0.0}
    if signed:
        limit = max(float(np.percentile(np.abs(values[usable]), 98)), 1e-12)
        output[usable] = np.rint((np.clip(values[usable] / limit, -1, 1) * .5 + .5) * 255).astype(np.uint8)
        return output, {"absoluteLimit": limit}
    low, high = map(float, np.percentile(values[usable], [2, 98])); high = max(high, low + 1e-12)
    output[usable] = np.rint(np.clip((values[usable] - low) / (high - low), 0, 1) * 255).astype(np.uint8)
    return output, {"low": low, "high": high}


def _lines(geometry: dict[str, Any] | None) -> Iterator[list[list[float]]]:
    if not geometry: return
    kind, coords = geometry.get("type"), geometry.get("coordinates")
    if kind == "LineString": yield coords
    elif kind in ("MultiLineString", "Polygon"): yield from coords
    elif kind == "MultiPolygon":
        for polygon in coords: yield from polygon
    elif kind == "GeometryCollection":
        for item in geometry.get("geometries", []): yield from _lines(item)


def geojson_lines(document: dict[str, Any]) -> Iterator[list[list[float]]]:
    if document.get("type") == "FeatureCollection":
        for feature in document.get("features", []): yield from _lines(feature.get("geometry"))
    elif document.get("type") == "Feature": yield from _lines(document.get("geometry"))
    else: yield from _lines(document)


def projected_lines(document: dict[str, Any], bounds: list[float], spacing: float, osr: Any) -> list[list[tuple[float, float]]]:
    source, target = osr.SpatialReference(), osr.SpatialReference(); source.ImportFromEPSG(4326); target.ImportFromEPSG(32649)
    if hasattr(source, "SetAxisMappingStrategy"):
        source.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER); target.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    transform = osr.CoordinateTransformation(source, target); min_x, _, _, max_y = bounds; result = []
    for line in geojson_lines(document):
        pixels = []
        for coordinate in line or []:
            if not isinstance(coordinate, (list, tuple)) or len(coordinate) < 2: continue
            x, y, *_ = transform.TransformPoint(float(coordinate[0]), float(coordinate[1]))
            pixels.append(((x - min_x) / spacing, (max_y - y) / spacing))
        if len(pixels) >= 2: result.append(pixels)
    return result
