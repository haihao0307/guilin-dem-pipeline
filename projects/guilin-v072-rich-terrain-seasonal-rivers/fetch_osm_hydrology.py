from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
import time
from pathlib import Path
from typing import Any
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from pyproj import Transformer


ENDPOINTS = (
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
)
EXPECTED_REVIEWED_SOURCE_SHA256 = (
    "be3e8e67f625fa87c843e2d7ea423c48b98e750c6912cae8cf3863df6ae6d4df"
)
EXPECTED_CENTERLINE_COORDINATES_SHA256 = (
    "fc69d8197106de229af2ecb9ca1d77cafe3e7ed291b5d119c0689682e68473d0"
)
EXPECTED_FEATURE_COUNT = 1426

LI_RE = re.compile(r"(?:漓江|漓水|桂江|Li River|Li Jiang|Lijiang)", re.I)
XIANG_RE = re.compile(r"(?:湘江|湘水|Xiang River|Xiang Jiang|Xiangjiang)", re.I)
NUMBER_RE = re.compile(r"[-+]?\d+(?:\.\d+)?")
BASE_COLLECTION_KEYS = (
    "type",
    "name",
    "generated_from",
    "osm_attribution",
    "query_bbox_wgs84",
    "feature_counts",
    "base_width_summary",
    "centerline_policy",
    "features",
)


def sha256_bytes(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def compact_coordinate_digest(collection: dict[str, Any]) -> str:
    """Hash only ordered centerline coordinates using the frozen builder algorithm."""
    coords = [feature["geometry"]["coordinates"] for feature in collection["features"]]
    encoded = json.dumps(coords, separators=(",", ":")).encode("utf-8")
    return sha256_bytes(encoded)


def terrain_bounds(path: Path) -> tuple[float, float, float, float]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    candidates: list[Any] = [
        payload.get("bounds_epsg32649"),
        payload.get("source_bounds_epsg32649"),
        payload.get("grid", {}).get("bounds_epsg32649"),
        payload.get("mosaic", {}).get("bounds"),
    ]
    grid = payload.get("grid", {})
    if all(key in grid for key in ("west", "south", "east", "north")):
        candidates.append([grid["west"], grid["south"], grid["east"], grid["north"]])
    for candidate in candidates:
        if isinstance(candidate, list) and len(candidate) == 4:
            values = tuple(float(value) for value in candidate)
            if all(math.isfinite(value) for value in values):
                west, south, east, north = values
                if west < east and south < north:
                    return west, south, east, north
    raise ValueError(f"{path} does not contain a valid EPSG:32649 bounds contract")


def build_query(bounds: tuple[float, float, float, float]) -> tuple[str, list[float]]:
    west, south, east, north = bounds
    to_wgs84 = Transformer.from_crs("EPSG:32649", "EPSG:4326", always_xy=True)
    corners = (
        to_wgs84.transform(west, south),
        to_wgs84.transform(east, south),
        to_wgs84.transform(east, north),
        to_wgs84.transform(west, north),
    )
    lons = [point[0] for point in corners]
    lats = [point[1] for point in corners]
    south_lat, west_lon, north_lat, east_lon = min(lats), min(lons), max(lats), max(lons)
    query = f'''[out:json][timeout:240];
(
  way["waterway"="river"]({south_lat},{west_lon},{north_lat},{east_lon});
  way["waterway"="stream"]["name"]({south_lat},{west_lon},{north_lat},{east_lon});
  way["waterway"="canal"]["name"]({south_lat},{west_lon},{north_lat},{east_lon});
);
out tags geom;'''
    return query, [west_lon, south_lat, east_lon, north_lat]


def query_overpass(query: str) -> tuple[dict[str, Any], bytes, str]:
    form_payload = urlencode({"data": query}).encode("utf-8")
    errors: list[str] = []
    for endpoint in ENDPOINTS:
        for attempt in range(3):
            try:
                request = Request(
                    endpoint,
                    data=form_payload,
                    headers={
                        "User-Agent": "GuilinDEM/0.7.2 (https://github.com/haihao0307/guilin-dem-pipeline)",
                        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
                    },
                )
                with urlopen(request, timeout=240) as response:
                    raw = response.read()
                return json.loads(raw), raw, endpoint
            except Exception as exc:  # pragma: no cover - Actions retry path
                errors.append(f"{endpoint} attempt {attempt + 1}: {exc}")
                if attempt < 2:
                    time.sleep(3 * (attempt + 1))
    raise RuntimeError("Overpass query failed: " + " | ".join(errors))


def classify(tags: dict[str, Any]) -> str:
    names = " | ".join(
        str(tags.get(key, ""))
        for key in ("name", "name:zh", "name:en", "alt_name", "official_name")
    )
    if LI_RE.search(names):
        return "li"
    if XIANG_RE.search(names):
        return "xiang"
    return "other"


def parse_width(tags: dict[str, Any], system: str) -> tuple[float, str]:
    for key in ("width", "est_width"):
        raw = str(tags.get(key, "")).strip()
        match = NUMBER_RE.search(raw)
        if match:
            value = float(match.group(0))
            if 1.0 <= value <= 2000.0:
                return value, key
    waterway = str(tags.get("waterway", "river"))
    if system == "li":
        return (180.0 if waterway == "river" else 38.0), "system-default"
    if system == "xiang":
        return (150.0 if waterway == "river" else 34.0), "system-default"
    defaults = {"river": 58.0, "stream": 18.0, "canal": 28.0, "drain": 10.0, "ditch": 7.0}
    return defaults.get(waterway, 20.0), "waterway-default"


def collection_from_overpass(payload: dict[str, Any], bbox: list[float]) -> dict[str, Any]:
    features: list[dict[str, Any]] = []
    counts = {"li": 0, "xiang": 0, "other": 0}
    widths: dict[str, list[float]] = {"li": [], "xiang": [], "other": []}
    seen_elements: set[tuple[str, int]] = set()
    for element in payload.get("elements", []):
        geometry = element.get("geometry") or []
        if len(geometry) < 2:
            continue
        osm_type = str(element.get("type", ""))
        osm_id = int(element["id"])
        identity = (osm_type, osm_id)
        if identity in seen_elements:
            raise ValueError(f"duplicate Overpass element {identity}")
        seen_elements.add(identity)
        coordinates = [[float(point["lon"]), float(point["lat"])] for point in geometry]
        tags = element.get("tags") or {}
        system = classify(tags)
        base_width_m, width_source = parse_width(tags, system)
        counts[system] += 1
        widths[system].append(base_width_m)
        features.append(
            {
                "type": "Feature",
                "properties": {
                    "osm_type": element.get("type"),
                    "osm_id": element.get("id"),
                    "system": system,
                    "waterway": tags.get("waterway", ""),
                    "name": tags.get("name", ""),
                    "name_zh": tags.get("name:zh", ""),
                    "name_en": tags.get("name:en", ""),
                    "base_width_m": base_width_m,
                    "width_source": width_source,
                    "intermittent": tags.get("intermittent", ""),
                    "seasonal": tags.get("seasonal", ""),
                },
                "geometry": {"type": "LineString", "coordinates": coordinates},
            }
        )
    width_summary = {
        key: {
            "minimum_m": min(values) if values else 0.0,
            "maximum_m": max(values) if values else 0.0,
            "mean_m": sum(values) / len(values) if values else 0.0,
        }
        for key, values in widths.items()
    }
    return {
        "type": "FeatureCollection",
        "name": "Guilin OSM hydrology river-ribbon source",
        "generated_from": "OpenStreetMap Overpass API",
        "osm_attribution": "© OpenStreetMap contributors",
        "query_bbox_wgs84": bbox,
        "feature_counts": counts,
        "base_width_summary": width_summary,
        "centerline_policy": "OSM coordinates immutable; display width is derived separately",
        "features": features,
    }


def validate_collection(collection: dict[str, Any], expected_count: int) -> None:
    if collection.get("type") != "FeatureCollection":
        raise ValueError("hydrology source is not a FeatureCollection")
    features = collection.get("features")
    if not isinstance(features, list) or len(features) != expected_count:
        raise ValueError(f"expected {expected_count} features, got {len(features or [])}")
    identities: set[tuple[Any, Any]] = set()
    for index, feature in enumerate(features):
        if feature.get("type") != "Feature":
            raise ValueError(f"feature {index} is not a GeoJSON Feature")
        geometry = feature.get("geometry") or {}
        coordinates = geometry.get("coordinates")
        if geometry.get("type") != "LineString" or not isinstance(coordinates, list) or len(coordinates) < 2:
            raise ValueError(f"feature {index} is not a usable LineString")
        for coordinate in coordinates:
            if not isinstance(coordinate, list) or len(coordinate) != 2:
                raise ValueError(f"feature {index} has a malformed coordinate")
            lon, lat = float(coordinate[0]), float(coordinate[1])
            if not (math.isfinite(lon) and math.isfinite(lat) and -180 <= lon <= 180 and -90 <= lat <= 90):
                raise ValueError(f"feature {index} has an invalid coordinate")
        properties = feature.get("properties") or {}
        identity = (properties.get("osm_type"), properties.get("osm_id"))
        if identity in identities:
            raise ValueError(f"duplicate GeoJSON OSM feature {identity}")
        identities.add(identity)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--terrain-manifest", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--reviewed-source", type=Path)
    source.add_argument("--overpass-json", type=Path)
    source.add_argument("--allow-live-overpass", action="store_true")
    parser.add_argument("--expected-reviewed-source-sha256", default=EXPECTED_REVIEWED_SOURCE_SHA256)
    parser.add_argument(
        "--expected-centerline-coordinates-sha256",
        default=EXPECTED_CENTERLINE_COORDINATES_SHA256,
    )
    parser.add_argument("--expected-feature-count", type=int, default=EXPECTED_FEATURE_COUNT)
    args = parser.parse_args()

    query, bbox = build_query(terrain_bounds(args.terrain_manifest))
    query_sha256 = sha256_bytes(query.encode("utf-8"))
    overpass_payload_sha256: str | None = None
    overpass_endpoint: str | None = None
    if args.reviewed_source:
        raw_source = args.reviewed_source.read_bytes()
        collection = json.loads(raw_source)
        source_mode = "reviewed-geojson"
        reviewed_source_sha256 = sha256_bytes(raw_source)
    else:
        if args.overpass_json:
            raw_payload = args.overpass_json.read_bytes()
            payload = json.loads(raw_payload)
            source_mode = "overpass-json"
        else:
            payload, raw_payload, overpass_endpoint = query_overpass(query)
            source_mode = "live-overpass"
        overpass_payload_sha256 = sha256_bytes(raw_payload)
        collection = collection_from_overpass(payload, bbox)
        reviewed_source_sha256 = sha256_bytes(json.dumps(collection, ensure_ascii=False).encode("utf-8"))

    validate_collection(collection, args.expected_feature_count)
    missing = [key for key in BASE_COLLECTION_KEYS if key not in collection]
    if missing:
        raise ValueError(f"reviewed GeoJSON lacks frozen base fields: {missing}")
    base_collection = {key: collection[key] for key in BASE_COLLECTION_KEYS}
    if args.reviewed_source and collection != base_collection:
        raise ValueError("reviewed source contains fields outside the frozen base collection")

    centerline_digest = compact_coordinate_digest(base_collection)
    reviewed_ok = reviewed_source_sha256 == args.expected_reviewed_source_sha256
    centerline_ok = centerline_digest == args.expected_centerline_coordinates_sha256
    if not reviewed_ok:
        raise ValueError(
            f"reviewed source SHA-256 mismatch: {reviewed_source_sha256} != "
            f"{args.expected_reviewed_source_sha256}"
        )
    if not centerline_ok:
        raise ValueError(
            f"ordered centerline coordinate SHA-256 mismatch: {centerline_digest} != "
            f"{args.expected_centerline_coordinates_sha256}"
        )

    result = dict(base_collection)
    result.update(
        {
            "source_mode": source_mode,
            "reviewed_source_sha256": reviewed_source_sha256,
            "expected_reviewed_source_sha256": args.expected_reviewed_source_sha256,
            "reviewed_source_digest_verified": reviewed_ok,
            "centerline_coordinates_sha256": centerline_digest,
            "expected_centerline_coordinates_sha256": args.expected_centerline_coordinates_sha256,
            "centerline_digest_verified": centerline_ok,
            "overpass_query_sha256": query_sha256 if source_mode != "reviewed-geojson" else None,
            "overpass_payload_sha256": overpass_payload_sha256,
            "overpass_endpoint": overpass_endpoint,
        }
    )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")
    print(
        json.dumps(
            {
                "source_mode": source_mode,
                "reviewed_source_sha256": reviewed_source_sha256,
                "feature_count": len(result["features"]),
                "centerline_coordinates_sha256": centerline_digest,
                "overpass_payload_sha256": overpass_payload_sha256,
                "overpass_endpoint": overpass_endpoint,
            },
            ensure_ascii=False,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
