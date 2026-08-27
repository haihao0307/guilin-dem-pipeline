#!/usr/bin/env python3
"""Build Kunming V004 Yunnan-color terrain and real OSM hydrology display assets.

The output is a regenerable browser cache. The authoritative uncompressed float32 DEM
is identified by manifest only and is never edited by this script.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import shutil
from pathlib import Path
from typing import Any, Iterable

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from pyproj import Transformer
from scipy.ndimage import distance_transform_edt

CROP_BOUNDS = (243875.0, 2719987.5, 317525.0, 2821175.0)
AUTHORITATIVE_SHA = "9f672e16714d98b7bc7f002826cdf788379bcb54db84227a21f53539b083f3a2"
SOURCE_MOSAIC_SHA = "af95c47f55ab8ff25d33ddc96d07c6d85fc1fcd4c2a2de9e2bef51a015860c50"
SOURCE_ARTIFACT_SHA = "919b1bb0d06b1fb479e0681deeb3c4fc2867dc78ee229a0a5af3723ba20e4c01"
TRANSFORMER = Transformer.from_crs("EPSG:4326", "EPSG:32648", always_xy=True)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def decode_rg16(path: Path) -> tuple[Image.Image, np.ndarray]:
    image = Image.open(path).convert("RGB")
    rgb = np.asarray(image)
    height = ((rgb[:, :, 0].astype(np.uint16) << 8) | rgb[:, :, 1].astype(np.uint16)).astype(np.float32) / 65535.0
    return image, height


def blurred(array: np.ndarray, radius: float) -> np.ndarray:
    image = Image.fromarray(np.uint8(np.clip(array, 0.0, 1.0) * 255.0))
    return np.asarray(image.filter(ImageFilter.GaussianBlur(radius=radius)), dtype=np.float32) / 255.0


def interpolate_palette(height: np.ndarray) -> np.ndarray:
    stops = np.array([0.0, 0.13, 0.27, 0.42, 0.57, 0.71, 0.86, 1.0], dtype=np.float32)
    colors = np.array([
        [42, 76, 57],
        [75, 116, 65],
        [123, 145, 75],
        [162, 157, 88],
        [164, 111, 67],
        [112, 79, 65],
        [159, 153, 145],
        [229, 226, 218],
    ], dtype=np.float32) / 255.0
    output = np.zeros(height.shape + (3,), dtype=np.float32)
    for index in range(len(stops) - 1):
        high = height <= stops[index + 1] if index == len(stops) - 2 else height < stops[index + 1]
        mask = (height >= stops[index]) & high
        t = (height[mask] - stops[index]) / (stops[index + 1] - stops[index] + 1e-6)
        output[mask] = colors[index] * (1.0 - t[:, None]) + colors[index + 1] * t[:, None]
    return output


def generate_yunnan_surface(height_path: Path, surface_path: Path, fallback_path: Path) -> dict[str, Any]:
    source_image, height = decode_rg16(height_path)
    gy, gx = np.gradient(height)
    raw_slope = np.sqrt(gx * gx + gy * gy)
    slope = np.clip(raw_slope / (np.percentile(raw_slope, 99.2) + 1e-6), 0.0, 1.0)
    medium = blurred(height, 34)
    large = blurred(height, 105)
    local_relief = height - medium
    local_relief = np.clip(
        (local_relief - np.percentile(local_relief, 2.0)) /
        (np.percentile(local_relief, 98.0) - np.percentile(local_relief, 2.0) + 1e-6),
        0.0,
        1.0,
    )
    valley = np.clip((medium - height) * 7.5 + 0.48, 0.0, 1.0)
    regional_relief = np.clip((height - large) * 5.0 + 0.5, 0.0, 1.0)
    northness = np.clip(0.5 - gy / (raw_slope * 2.0 + 1e-6), 0.0, 1.0)
    southness = 1.0 - northness

    azimuth_a, azimuth_b, altitude = np.deg2rad(315.0), np.deg2rad(55.0), np.deg2rad(43.0)
    ddy, ddx = np.gradient(height * 3.1)
    slope_angle = np.pi / 2.0 - np.arctan(np.sqrt(ddx * ddx + ddy * ddy))
    aspect = np.arctan2(-ddx, ddy)
    shade_a = np.sin(altitude) * np.sin(slope_angle) + np.cos(altitude) * np.cos(slope_angle) * np.cos(azimuth_a - aspect)
    shade_b = np.sin(altitude) * np.sin(slope_angle) + np.cos(altitude) * np.cos(slope_angle) * np.cos(azimuth_b - aspect)
    hillshade = 0.78 * shade_a + 0.22 * shade_b
    hillshade = (hillshade - np.percentile(hillshade, 1.0)) / (np.percentile(hillshade, 99.0) - np.percentile(hillshade, 1.0) + 1e-6)
    hillshade = np.clip(hillshade, 0.0, 1.0)

    output = interpolate_palette(height)
    moisture = np.clip(0.38 * (1.0 - height) + 0.22 * (1.0 - slope) + 0.28 * valley + 0.12 * northness, 0.0, 1.0)
    output[:, :, 1] += 0.13 * moisture
    output[:, :, 0] -= 0.045 * moisture
    output[:, :, 2] += 0.015 * northness * moisture

    middle = np.clip(1.0 - np.abs(height - 0.52) * 3.0, 0.0, 1.0)
    red_earth = np.clip(middle * (0.25 + 0.55 * slope + 0.30 * southness), 0.0, 1.0)
    output[:, :, 0] += 0.115 * red_earth
    output[:, :, 1] -= 0.065 * red_earth
    output[:, :, 2] -= 0.045 * red_earth

    rock = np.clip(0.72 * slope + np.maximum(height - 0.58, 0.0) * 1.55 + regional_relief * 0.12, 0.0, 1.0)
    output = output * (1.0 - rock[:, :, None] * 0.18) + np.array([0.43, 0.39, 0.37], dtype=np.float32) * rock[:, :, None] * 0.18
    output += (local_relief[:, :, None] - 0.5) * np.array([0.075, 0.060, 0.050], dtype=np.float32)
    output += (regional_relief[:, :, None] - 0.5) * np.array([0.035, 0.030, 0.020], dtype=np.float32)
    output *= (0.69 + 0.48 * hillshade)[:, :, None]
    ridge = np.clip(local_relief * 1.35 + height * 0.42 - 0.78, 0.0, 1.0)
    output += ridge[:, :, None] * np.array([0.105, 0.095, 0.085], dtype=np.float32)
    output = np.clip(output, 0.0, 1.0)

    surface_path.parent.mkdir(parents=True, exist_ok=True)
    surface = Image.fromarray(np.uint8(output * 255.0), "RGB")
    surface.save(surface_path, optimize=False)
    surface.save(fallback_path, optimize=False)
    return {
        "inputSize": list(source_image.size),
        "surfaceSha256": sha256(surface_path),
        "surfaceBytes": surface_path.stat().st_size,
        "fallbackSha256": sha256(fallback_path),
        "deterministic": True,
        "drivers": ["elevation", "slope", "aspect", "local relief", "regional relief", "valley moisture", "dual hillshade"],
    }


def feature_tags(feature: dict[str, Any]) -> dict[str, Any]:
    properties = feature.get("properties") or {}
    tags = properties.get("tags")
    return tags if isinstance(tags, dict) else properties


def projected(point: Iterable[float]) -> tuple[float, float]:
    x, y = tuple(point)[:2]
    x, y = float(x), float(y)
    if -180.0 <= x <= 180.0 and -90.0 <= y <= 90.0:
        return TRANSFORMER.transform(x, y)
    return x, y


def pixel(point: Iterable[float], width: int, height: int) -> tuple[float, float]:
    x, y = projected(point)
    xmin, ymin, xmax, ymax = CROP_BOUNDS
    return (x - xmin) / (xmax - xmin) * (width - 1), (ymax - y) / (ymax - ymin) * (height - 1)


def line_sequences(geometry: dict[str, Any] | None) -> list[list[list[float]]]:
    if not geometry:
        return []
    kind, coordinates = geometry.get("type"), geometry.get("coordinates")
    if kind == "LineString":
        return [coordinates]
    if kind == "MultiLineString":
        return list(coordinates)
    if kind == "GeometryCollection":
        output: list[list[list[float]]] = []
        for child in geometry.get("geometries") or []:
            output.extend(line_sequences(child))
        return output
    return []


def polygon_sequences(geometry: dict[str, Any] | None) -> list[list[list[list[float]]]]:
    if not geometry:
        return []
    kind, coordinates = geometry.get("type"), geometry.get("coordinates")
    if kind == "Polygon":
        return [coordinates]
    if kind == "MultiPolygon":
        return list(coordinates)
    if kind == "GeometryCollection":
        output: list[list[list[list[float]]]] = []
        for child in geometry.get("geometries") or []:
            output.extend(polygon_sequences(child))
        return output
    return []


def importance(tags: dict[str, Any]) -> float:
    waterway = str(tags.get("waterway", "")).lower()
    return {
        "river": 1.0,
        "canal": 0.82,
        "stream": 0.58,
        "tidal_channel": 0.54,
        "ditch": 0.34,
        "drain": 0.30,
        "flowline": 0.48,
    }.get(waterway, 0.44)


def build_water_field(waterways_path: Path, areas_path: Path, output_path: Path, width: int, height: int) -> dict[str, Any]:
    waterways = read_json(waterways_path)
    areas = read_json(areas_path)
    center_image = Image.new("L", (width, height), 0)
    direction_image = Image.new("L", (width, height), 0)
    class_image = Image.new("L", (width, height), 0)
    lake_image = Image.new("L", (width, height), 0)
    center_draw, direction_draw, class_draw, lake_draw = map(ImageDraw.Draw, [center_image, direction_image, class_image, lake_image])

    used_waterways = 0
    named: set[str] = set()
    for feature in waterways.get("features", []):
        tags = feature_tags(feature)
        feature_used = False
        class_value = int(round(importance(tags) * 255.0))
        name = tags.get("name") or tags.get("name:zh")
        if name:
            named.add(str(name))
        for sequence in line_sequences(feature.get("geometry")):
            if len(sequence) < 2:
                continue
            points = [pixel(point, width, height) for point in sequence]
            if max(p[0] for p in points) < -2 or min(p[0] for p in points) > width + 2 or max(p[1] for p in points) < -2 or min(p[1] for p in points) > height + 2:
                continue
            feature_used = True
            center_draw.line(points, fill=255, width=2, joint="curve")
            for start, end in zip(points, points[1:]):
                dx, dy = end[0] - start[0], end[1] - start[1]
                if abs(dx) + abs(dy) < 1e-6:
                    continue
                angle_byte = int(round(((math.atan2(dy, dx) + math.pi) / (2.0 * math.pi)) * 255.0)) % 256
                direction_draw.line([start, end], fill=angle_byte, width=3)
                class_draw.line([start, end], fill=class_value, width=3)
        if feature_used:
            used_waterways += 1

    used_areas = 0
    for feature in areas.get("features", []):
        tags = feature_tags(feature)
        name = tags.get("name") or tags.get("name:zh")
        if name:
            named.add(str(name))
        feature_used = False
        for polygon in polygon_sequences(feature.get("geometry")):
            if not polygon or len(polygon[0]) < 3:
                continue
            outer = [pixel(point, width, height) for point in polygon[0]]
            if max(p[0] for p in outer) < -2 or min(p[0] for p in outer) > width + 2 or max(p[1] for p in outer) < -2 or min(p[1] for p in outer) > height + 2:
                continue
            lake_draw.polygon(outer, fill=255)
            for hole in polygon[1:]:
                if len(hole) >= 3:
                    lake_draw.polygon([pixel(point, width, height) for point in hole], fill=0)
            feature_used = True
        if feature_used:
            used_areas += 1

    center = np.asarray(center_image) > 0
    if not np.any(center):
        raise RuntimeError("no OSM river centerline pixels intersect the Kunming crop")
    distance, nearest = distance_transform_edt(~center, return_indices=True)
    direction = np.asarray(direction_image, dtype=np.uint8)
    classes = np.asarray(class_image, dtype=np.uint8)
    nearest_direction = direction[nearest[0], nearest[1]]
    nearest_class = classes[nearest[0], nearest[1]]
    max_radius_pixels = 22.0
    distance_byte = np.uint8(np.round(np.clip(distance / max_radius_pixels, 0.0, 1.0) * 255.0))
    lake_byte = np.asarray(lake_image, dtype=np.uint8)
    field = np.dstack([distance_byte, lake_byte, nearest_direction, nearest_class]).astype(np.uint8)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(field, "RGBA").save(output_path, optimize=False)
    return {
        "waterwaySourceCount": len(waterways.get("features", [])),
        "waterAreaSourceCount": len(areas.get("features", [])),
        "webWaterways": used_waterways,
        "webWaterAreas": used_areas,
        "namedWaterCount": len(named),
        "namedWaterSample": sorted(named)[:40],
        "fieldSize": [width, height],
        "fieldSha256": sha256(output_path),
        "fieldBytes": output_path.stat().st_size,
        "maxRiverDistancePixels": max_radius_pixels,
        "handDrawnWaterCount": 0,
    }


def find_retrieval_time(artifact_dir: Path) -> str:
    for candidate in [artifact_dir / "QA_REPORT.json", artifact_dir / "RUN_RECEIPT.json", artifact_dir / "raw" / "osm-current" / "MANIFEST.json"]:
        if not candidate.exists():
            continue
        data = read_json(candidate)
        for key in ["retrievedAtUtc", "retrieved_at_utc", "retrievedAt", "timestampUtc", "timestamp"]:
            if key in data and data[key]:
                return str(data[key])
        text = json.dumps(data)
        for marker in ["retrievedAtUtc", "retrieved_at_utc"]:
            if marker in text:
                break
    return "2026-08-26T00:00:00Z"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--artifact-dir", type=Path, required=True)
    parser.add_argument("--height-image", type=Path, required=True)
    parser.add_argument("--source-dir", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--source-run-id", type=int, default=32925496927)
    args = parser.parse_args()

    waterways_path = args.artifact_dir / "distilled" / "osm-current" / "waterways.geojson"
    areas_path = args.artifact_dir / "distilled" / "osm-current" / "water_areas.geojson"
    for required in [waterways_path, areas_path, args.height_image]:
        if not required.exists():
            raise SystemExit(f"required source missing: {required}")

    output = args.output_dir
    assets = output / "assets"
    assets.mkdir(parents=True, exist_ok=True)
    for name in ["index.html", "styles.css", "app.js", "README.md"]:
        shutil.copy2(args.source_dir / name, output / name)
    shutil.copy2(args.height_image, assets / "height_rg16.png")

    surface_report = generate_yunnan_surface(assets / "height_rg16.png", assets / "surface.png", assets / "fallback.png")
    water_report = build_water_field(waterways_path, areas_path, assets / "water_field.png", 2048, 2814)
    retrieved_at = find_retrieval_time(args.artifact_dir)

    manifest = {
        "schemaVersion": "kunming_yunnan_hydrology_web@4.0.0",
        "title": "昆明 DEM 云南色彩与真实水系 V004",
        "status": "yunnan_color_real_osm_hydrology_ready",
        "authoritativeDem": {
            "file": "KUNMING_BASELINE_RESET_CROP_12P5M_FLOAT32_UNCOMPRESSED.tif",
            "sha256": AUTHORITATIVE_SHA,
            "sourceMosaicSha256": SOURCE_MOSAIC_SHA,
            "compression": "NONE",
            "resampled": False,
            "crs": "EPSG:32648",
            "pixelSpacingMeters": [12.5, 12.5],
            "grid": [5892, 8095],
            "bounds": list(CROP_BOUNDS),
            "widthMeters": 73650.0,
            "heightMeters": 101187.5,
            "areaKm2": 7452.459375,
            "elevation": {"min": 1280.53662109375, "max": 2788.21044921875, "mean": 1994.944580078125},
        },
        "sourceArtifact": {"runId": args.source_run_id, "name": "kunming-hydrology-knowledge-v001", "sha256": SOURCE_ARTIFACT_SHA},
        "osmCurrent": {
            "retrievedAtUtc": retrieved_at,
            "license": "ODbL 1.0",
            "attribution": "© OpenStreetMap contributors",
            "sourceCounts": {"waterways": water_report["waterwaySourceCount"], "waterAreas": water_report["waterAreaSourceCount"]},
            "webWaterways": water_report["webWaterways"],
            "webWaterAreas": water_report["webWaterAreas"],
            "namedWaterCount": water_report["namedWaterCount"],
            "namedWaterSample": water_report["namedWaterSample"],
        },
        "historical": {"targetEpoch": [1940, 1945], "acceptedHistoricalTruthCount": 0, "status": "pending dated evidence review"},
        "browserTerrain": {"meshDesktop": [640, 880], "meshCompatibility": [384, 528], "naturalVerticalScale": 1.0},
        "browserAssets": {
            "height": {"file": "assets/height_rg16.png", "width": 2048, "height": 2814, "encoding": "RG16 normalized PNG", "sha256": sha256(assets / "height_rg16.png")},
            "surface": {"file": "assets/surface.png", "width": 2048, "height": 2814, "sha256": sha256(assets / "surface.png"), "role": "deterministic Yunnan color visualization"},
            "waterField": {"file": "assets/water_field.png", "width": 2048, "height": 2814, "sha256": sha256(assets / "water_field.png"), "channels": {"R": "normalized distance to fixed OSM centerline", "G": "fixed OSM lake and reservoir mask", "B": "stored downstream direction", "A": "waterway importance"}},
            "fallback": {"file": "assets/fallback.png", "width": 2048, "height": 2814, "sha256": sha256(assets / "fallback.png")},
        },
        "displayRules": {
            "handDrawnWaterCount": 0,
            "riverCenterlineFixed": True,
            "widthControlLateralOnly": True,
            "lakeShorelineFixed": True,
            "flowUsesStoredDownstreamDirection": True,
            "cameraPresetCount": 0,
            "authoritativeDemModified": False,
        },
        "colorKnowledge": {"drivers": surface_report["drivers"], "palette": ["deep valley green", "moist Yunnan green", "plateau yellow-green", "dry grass", "red earth", "brown rock", "grey stone", "pale ridge"], "randomSeed": None},
    }
    (output / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    report = {
        "status": "complete",
        "surface": surface_report,
        "water": water_report,
        "manifestSha256": sha256(output / "manifest.json"),
        "authoritativeDemModified": False,
        "binaryFloatAssets": 0,
        "cameraPresetCount": 0,
    }
    (output / "BUILD_REPORT.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
