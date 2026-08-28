#!/usr/bin/env python3
"""Build source-traceable OSM coastline and waterways for Wenzhou V200.

The already verified PR #49 WGS84 source collections cover most of the new
17-tile AOI. This script validates those exact seed files, downloads only the
west, south and north fringe that lies outside the old domain, merges by OSM
way ID, and projects/clips the result to the exact EPSG:32651 V200 bounds.

No manual coastline, river or place geometry is created. Raw Overpass replies,
queries, endpoint attempts, OSM IDs, source coordinates, hashes and snapshot
lineage remain preserved. Estuary connectivity stays pending.
"""

from __future__ import annotations

import gzip
import hashlib
import json
import os
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

REPO_ROOT = Path(__file__).resolve().parents[4]
CONFIG_PATH = REPO_ROOT / "projects/wenzhou/v200/config/osm_hydrology_v200.json"
TRUTH_MANIFEST_PATH = REPO_ROOT / "projects/wenzhou/v200/truth/WENZHOU_17TILE_TRUTH_MANIFEST.json"
DATA_ROOT = REPO_ROOT / "projects/wenzhou/v200/data/hydrology/osm"
RAW_ROOT = DATA_ROOT / "raw"
REPORT_ROOT = REPO_ROOT / "projects/wenzhou/v200/reports"
ACQUISITION_REPORT = REPORT_ROOT / "OSM_HYDROLOGY_ACQUISITION.json"
QA_REPORT = REPORT_ROOT / "HYDROLOGY_TOPOLOGY_QA.json"
STATE_REPORT = REPORT_ROOT / "WENZHOU_V200_OSM_REACQUISITION_STATE.json"


def sha256_bytes(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(8 * 1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def atomic_write(path: Path, content: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(delete=False, dir=path.parent) as temporary:
        temporary.write(content)
        temporary.flush()
        os.fsync(temporary.fileno())
        temporary_path = Path(temporary.name)
    try:
        os.replace(temporary_path, path)
    finally:
        temporary_path.unlink(missing_ok=True)


def write_json(path: Path, payload: Any) -> None:
    atomic_write(
        path,
        (json.dumps(payload, ensure_ascii=False, sort_keys=True, indent=2) + "\n").encode("utf-8"),
    )


def write_deterministic_gzip(path: Path, content: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(delete=False, dir=path.parent) as temporary:
        temporary_path = Path(temporary.name)
    try:
        with temporary_path.open("wb") as target:
            with gzip.GzipFile(filename="", mode="wb", fileobj=target, mtime=0) as compressed:
                compressed.write(content)
        os.replace(temporary_path, path)
    finally:
        temporary_path.unlink(missing_ok=True)


def file_record(path: Path, role: str) -> dict[str, Any]:
    return {
        "role": role,
        "path": str(path.relative_to(REPO_ROOT)),
        "bytes": path.stat().st_size,
        "sha256": sha256_file(path),
    }


def validate_file(path: Path, expected: dict[str, Any], role: str) -> dict[str, Any]:
    if not path.is_file():
        raise FileNotFoundError(path)
    actual_bytes = path.stat().st_size
    actual_sha = sha256_file(path)
    if actual_bytes != int(expected["bytes"]):
        raise RuntimeError(
            f"{role} byte mismatch: {path}; got {actual_bytes}, expected {expected['bytes']}"
        )
    if actual_sha != expected["sha256"]:
        raise RuntimeError(
            f"{role} SHA-256 mismatch: {path}; got {actual_sha}, expected {expected['sha256']}"
        )
    return {
        "role": role,
        "path": str(path.relative_to(REPO_ROOT)),
        "bytes": actual_bytes,
        "sha256": actual_sha,
    }


def split_region(
    region_id: str,
    bounds: list[float],
    columns: int,
    rows: int,
    overlap: float,
) -> list[dict[str, Any]]:
    west, south, east, north = [float(value) for value in bounds]
    width = (east - west) / columns
    height = (north - south) / rows
    tiles: list[dict[str, Any]] = []
    for row in range(rows):
        for column in range(columns):
            tile_west = west + column * width
            tile_east = west + (column + 1) * width
            tile_south = south + row * height
            tile_north = south + (row + 1) * height
            if column > 0:
                tile_west -= overlap
            if column < columns - 1:
                tile_east += overlap
            if row > 0:
                tile_south -= overlap
            if row < rows - 1:
                tile_north += overlap
            tiles.append(
                {
                    "region": region_id,
                    "row": row,
                    "column": column,
                    "id": f"{region_id}_r{row}_c{column}",
                    "bounds": [tile_west, tile_south, tile_east, tile_north],
                }
            )
    return tiles


def overpass_query(bounds: list[float], timeout_seconds: int) -> str:
    west, south, east, north = bounds
    bbox = f"{south:.8f},{west:.8f},{north:.8f},{east:.8f}"
    return (
        f"[out:json][timeout:{timeout_seconds}];\n"
        "(\n"
        f'  way["natural"="coastline"]({bbox});\n'
        f'  way["waterway"~"^(river|stream|canal|tidal_channel)$"]({bbox});\n'
        ");\n"
        "out tags geom qt;\n"
    )


def request_overpass(
    tile_id: str,
    endpoints: list[str],
    query: str,
    attempts_per_endpoint: int,
    pause_429: float,
    pause_other: float,
) -> tuple[bytes, dict[str, Any]]:
    encoded = urllib.parse.urlencode({"data": query}).encode("utf-8")
    attempts: list[dict[str, Any]] = []
    for round_index in range(attempts_per_endpoint):
        for endpoint in endpoints:
            attempt_number = round_index + 1
            started = time.monotonic()
            request = urllib.request.Request(
                endpoint,
                data=encoded,
                method="POST",
                headers={
                    "User-Agent": (
                        "WenzhouV200Hydrology/2.1 "
                        "repository=haihao0307/guilin-dem-pipeline"
                    ),
                    "Referer": "https://github.com/haihao0307/guilin-dem-pipeline",
                    "Accept": "application/json",
                    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                },
            )
            try:
                with urllib.request.urlopen(request, timeout=330) as response:
                    content = response.read()
                    status = int(getattr(response, "status", 200))
                    content_type = response.headers.get("Content-Type", "")
                    duration = time.monotonic() - started
                    selected = {
                        "tileId": tile_id,
                        "endpoint": endpoint,
                        "attempt": attempt_number,
                        "httpStatus": status,
                        "contentType": content_type,
                        "contentLengthHeader": response.headers.get("Content-Length"),
                        "durationSeconds": duration,
                    }
                    attempts.append(selected)
                    if status != 200:
                        raise RuntimeError(f"Overpass returned HTTP {status}")
                    if not content:
                        raise RuntimeError("Overpass returned no bytes")
                    prefix = content[:256].lstrip().lower()
                    if b"<html" in prefix or b"<!doctype" in prefix:
                        raise RuntimeError("Overpass returned HTML instead of JSON")
                    payload = json.loads(content)
                    if not isinstance(payload.get("elements"), list):
                        raise RuntimeError("Overpass JSON lacks an elements array")
                    return content, {
                        "selectedEndpoint": endpoint,
                        "selectedAttempt": attempt_number,
                        "attempts": attempts,
                    }
            except urllib.error.HTTPError as exc:
                code = int(exc.code)
                retry_after = exc.headers.get("Retry-After") if exc.headers else None
                attempts.append(
                    {
                        "tileId": tile_id,
                        "endpoint": endpoint,
                        "attempt": attempt_number,
                        "error": "HTTPError",
                        "httpStatus": code,
                        "detail": str(exc),
                        "retryAfter": retry_after,
                        "durationSeconds": time.monotonic() - started,
                    }
                )
                delay = pause_429 if code == 429 else pause_other
                if retry_after:
                    try:
                        delay = max(delay, float(retry_after))
                    except ValueError:
                        pass
                time.sleep(delay)
            except Exception as exc:
                attempts.append(
                    {
                        "tileId": tile_id,
                        "endpoint": endpoint,
                        "attempt": attempt_number,
                        "error": type(exc).__name__,
                        "detail": str(exc),
                        "durationSeconds": time.monotonic() - started,
                    }
                )
                time.sleep(pause_other)
    raise RuntimeError(f"Overpass tile {tile_id} failed on all endpoints: {attempts}")


def parse_way_geometry(element: dict[str, Any]) -> list[list[float]]:
    geometry = element.get("geometry")
    if not isinstance(geometry, list):
        return []
    coordinates: list[list[float]] = []
    for item in geometry:
        if not isinstance(item, dict) or "lon" not in item or "lat" not in item:
            return []
        coordinates.append([float(item["lon"]), float(item["lat"])])
    return coordinates


def way_digest(record: dict[str, Any]) -> str:
    payload = {
        "id": int(record["id"]),
        "tags": record["tags"],
        "coordinates": record["coordinates"],
    }
    return sha256_bytes(
        json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    )


def load_seed_collection(
    path: Path,
    expected: dict[str, Any],
    role: str,
    snapshot: dict[str, Any],
) -> tuple[dict[int, dict[str, Any]], dict[str, Any]]:
    verified = validate_file(path, expected, role)
    collection = json.loads(path.read_text(encoding="utf-8"))
    if collection.get("type") != "FeatureCollection":
        raise RuntimeError(f"seed is not a FeatureCollection: {path}")
    ways: dict[int, dict[str, Any]] = {}
    for feature in collection.get("features", []):
        properties = feature.get("properties") or {}
        geometry = feature.get("geometry") or {}
        if geometry.get("type") != "LineString":
            continue
        way_id = int(properties["source_way_id"])
        coordinates = [[float(x), float(y)] for x, y in geometry.get("coordinates", [])]
        if len(coordinates) < 2:
            raise RuntimeError(f"seed way {way_id} has fewer than two coordinates")
        tags = {str(key): str(value) for key, value in (properties.get("tags") or {}).items()}
        record = {
            "id": way_id,
            "nodes": [int(value) for value in properties.get("source_node_ids", [])],
            "tags": tags,
            "coordinates": coordinates,
            "origin": "pr49_seed",
            "originTileIds": [],
            "snapshot": snapshot,
        }
        previous = ways.get(way_id)
        if previous is not None and way_digest(previous) != way_digest(record):
            raise RuntimeError(f"seed collection contains conflicting way {way_id}")
        ways[way_id] = record
    verified["featureCount"] = len(ways)
    verified["collectionMetadata"] = collection.get("metadata")
    return ways, verified


def canonical_feature_collection(
    features: list[dict[str, Any]],
    crs: str,
    metadata: dict[str, Any],
) -> dict[str, Any]:
    collection: dict[str, Any] = {
        "type": "FeatureCollection",
        "features": features,
        "metadata": metadata,
    }
    if crs != "EPSG:4326":
        collection["crs"] = {
            "type": "name",
            "properties": {"name": crs},
        }
    return collection


def line_parts(geometry: Any) -> Iterable[Any]:
    if geometry.is_empty:
        return []
    if geometry.geom_type == "LineString":
        return [geometry]
    if geometry.geom_type == "MultiLineString":
        return list(geometry.geoms)
    if geometry.geom_type == "GeometryCollection":
        return [
            item
            for item in geometry.geoms
            if item.geom_type == "LineString" and not item.is_empty
        ]
    return []


def coordinate_hash(features: list[dict[str, Any]]) -> str:
    payload = [
        {
            "id": feature["properties"].get("part_id")
            or feature["properties"].get("source_way_id"),
            "coordinates": feature["geometry"]["coordinates"],
        }
        for feature in features
    ]
    return sha256_bytes(
        json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    )


def main() -> int:
    generated = datetime.now(timezone.utc).isoformat()
    acquisition: dict[str, Any] = {
        "schema": "wenzhou_osm_hydrology_acquisition@2.1.0",
        "project": "wenzhou-v200-17tile-truth-hydrology-rebuild",
        "generatedAtUtc": generated,
        "passed": False,
        "manualGeometryUsed": False,
        "fullFreshSnapshot": False,
        "seedAndFringeSnapshot": True,
    }
    qa: dict[str, Any] = {
        "schema": "wenzhou_hydrology_topology_qa@2.1.0",
        "project": "wenzhou-v200-17tile-truth-hydrology-rebuild",
        "generatedAtUtc": generated,
        "passed": False,
        "sourceAcquisitionPassed": False,
        "projectedSkeletonPassed": False,
        "hydrologyTopologyPassed": False,
        "estuaryConnectivityStatus": "pending",
        "nodeReferenceValidationStatus": "not_evaluable_source_omits_node_ids",
        "manualGeometryUsed": False,
    }
    state: dict[str, Any] = {
        "schema": "wenzhou_v200_osm_reacquisition_state@2.1.0",
        "generatedAtUtc": generated,
        "status": "failed",
        "manualGeometryUsed": False,
        "estuaryConnectivityStatus": "pending",
    }

    try:
        from pyproj import Transformer
        from shapely.geometry import LineString, box, mapping
        from shapely.ops import transform as shapely_transform

        config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
        truth_manifest = json.loads(TRUTH_MANIFEST_PATH.read_text(encoding="utf-8"))
        source_config = config["source"]
        domain = config["domain"]
        seed_config = config["seed"]
        fringe_plan = config["fringePlan"]
        query_config = config["query"]
        retry_config = config["retry"]
        derived_config = config["derived"]

        if config["qa"].get("manualGeometryAllowed") is not False:
            raise RuntimeError("manual geometry must remain disabled")
        if domain["truthCogSha256"] != truth_manifest["truthCog"]["expectedSha256"]:
            raise RuntimeError("OSM config truth hash does not match the frozen V200 manifest")

        if DATA_ROOT.exists():
            import shutil

            shutil.rmtree(DATA_ROOT)
        REPORT_ROOT.mkdir(parents=True, exist_ok=True)
        for path in (ACQUISITION_REPORT, QA_REPORT, STATE_REPORT):
            path.unlink(missing_ok=True)

        seed_snapshot = {
            "repository": seed_config["repository"],
            "branch": seed_config["branch"],
            "commit": seed_config["commit"],
            "sourceDomainWgs84": seed_config["sourceDomainWgs84"],
        }
        seed_coast_path = REPO_ROOT / seed_config["coastline"]["path"]
        seed_water_path = REPO_ROOT / seed_config["waterways"]["path"]
        coast_ways, seed_coast_record = load_seed_collection(
            seed_coast_path,
            seed_config["coastline"],
            "seed_coastline_wgs84",
            seed_snapshot,
        )
        water_ways, seed_water_record = load_seed_collection(
            seed_water_path,
            seed_config["waterways"],
            "seed_waterways_wgs84",
            seed_snapshot,
        )
        overlap_ids = set(coast_ways).intersection(water_ways)
        if overlap_ids:
            raise RuntimeError(f"seed coastline and waterway collections share way IDs: {sorted(overlap_ids)[:20]}")
        merged_ways: dict[int, dict[str, Any]] = {**coast_ways, **water_ways}
        seed_way_count = len(merged_ways)

        tiles: list[dict[str, Any]] = []
        overlap = float(fringe_plan["overlapDegrees"])
        for region in fringe_plan["regions"]:
            tiles.extend(
                split_region(
                    str(region["id"]),
                    region["bounds"],
                    int(region["columns"]),
                    int(region["rows"]),
                    overlap,
                )
            )

        endpoints = [source_config["primaryEndpoint"], *source_config["fallbackEndpoints"]]
        raw_files: list[dict[str, Any]] = []
        tile_records: list[dict[str, Any]] = []
        fringe_unique_ids: set[int] = set()
        fringe_new_ids: set[int] = set()
        unchanged_duplicates: set[int] = set()
        changed_duplicates: list[dict[str, Any]] = []
        missing_way_geometry: set[int] = set()

        for tile_index, tile in enumerate(tiles):
            query = overpass_query(tile["bounds"], int(query_config["timeoutSeconds"]))
            content, transfer = request_overpass(
                tile["id"],
                endpoints,
                query,
                int(retry_config["attemptsPerEndpoint"]),
                float(retry_config["http429PauseSeconds"]),
                float(retry_config["otherRetryPauseSeconds"]),
            )
            payload = json.loads(content)
            raw_path = RAW_ROOT / f"overpass_{tile['id']}.json.gz"
            query_path = RAW_ROOT / f"overpass_{tile['id']}.query.overpassql"
            write_deterministic_gzip(raw_path, content)
            atomic_write(query_path, query.encode("utf-8"))
            raw_record = file_record(raw_path, "raw_overpass_json_gzip")
            query_record = file_record(query_path, "overpass_query")
            raw_files.extend([raw_record, query_record])

            way_count = 0
            accepted_count = 0
            for element in payload["elements"]:
                if element.get("type") != "way":
                    continue
                way_count += 1
                way_id = int(element["id"])
                tags = {str(key): str(value) for key, value in element.get("tags", {}).items()}
                is_coastline = tags.get("natural") == "coastline"
                waterway = tags.get("waterway")
                if not is_coastline and waterway not in {"river", "stream", "canal", "tidal_channel"}:
                    continue
                coordinates = parse_way_geometry(element)
                if len(coordinates) < int(derived_config["minimumWayVertexCount"]):
                    missing_way_geometry.add(way_id)
                    continue
                accepted_count += 1
                fringe_unique_ids.add(way_id)
                record = {
                    "id": way_id,
                    "nodes": [int(value) for value in element.get("nodes", [])],
                    "tags": tags,
                    "coordinates": coordinates,
                    "origin": "v200_fringe_overpass",
                    "originTileIds": [tile["id"]],
                    "snapshot": {
                        "retrievedAtUtc": generated,
                        "osm3s": payload.get("osm3s"),
                        "generator": payload.get("generator"),
                    },
                }
                previous = merged_ways.get(way_id)
                if previous is None:
                    merged_ways[way_id] = record
                    fringe_new_ids.add(way_id)
                    continue
                previous_digest = way_digest(previous)
                current_digest = way_digest(record)
                if previous_digest == current_digest:
                    unchanged_duplicates.add(way_id)
                    previous.setdefault("originTileIds", [])
                    previous["originTileIds"] = sorted(
                        set(previous["originTileIds"] + [tile["id"]])
                    )
                    continue
                changed_duplicates.append(
                    {
                        "sourceWayId": way_id,
                        "previousOrigin": previous.get("origin"),
                        "previousDigest": previous_digest,
                        "newDigest": current_digest,
                        "newTileId": tile["id"],
                        "policy": "newer_fringe_snapshot_wins",
                    }
                )
                if derived_config.get("newerFringeSnapshotWinsOnDuplicateWayId") is not True:
                    raise RuntimeError(f"changed duplicate OSM way {way_id} requires an explicit policy")
                merged_ways[way_id] = record

            tile_records.append(
                {
                    **tile,
                    "querySha256": sha256_bytes(query.encode("utf-8")),
                    "rawUncompressedBytes": len(content),
                    "rawUncompressedSha256": sha256_bytes(content),
                    "rawCompressed": raw_record,
                    "queryFile": query_record,
                    "osmGenerator": payload.get("generator"),
                    "osmVersion": payload.get("version"),
                    "osm3s": payload.get("osm3s"),
                    "wayCount": way_count,
                    "acceptedWayCount": accepted_count,
                    "transfer": transfer,
                }
            )
            if tile_index < len(tiles) - 1:
                time.sleep(float(retry_config["secondsBetweenSuccessfulTiles"]))

        transformer = Transformer.from_crs("EPSG:4326", domain["projectedCrs"], always_xy=True)
        clip_bounds = [float(value) for value in domain["projectedClipBounds"]]
        clip_polygon = box(*clip_bounds)
        source_features: list[dict[str, Any]] = []
        projected_features: list[dict[str, Any]] = []
        introduced_self_intersections: list[str] = []
        out_of_bounds_vertices = 0
        part_ids: list[str] = []

        for way_id, way in sorted(merged_ways.items()):
            tags = way["tags"]
            is_coastline = tags.get("natural") == "coastline"
            waterway = tags.get("waterway")
            if not is_coastline and waterway not in {"river", "stream", "canal", "tidal_channel"}:
                continue
            coordinates = way["coordinates"]
            source_line = LineString(coordinates)
            category = "coastline" if is_coastline else "waterway"
            source_properties = {
                "source_way_id": way_id,
                "source_node_ids": way.get("nodes", []),
                "category": category,
                "waterway": waterway,
                "name": tags.get("name"),
                "name_en": tags.get("name:en"),
                "tags": tags,
                "source_vertex_count": len(coordinates),
                "source_is_simple": bool(source_line.is_simple),
                "source_geometry_preserved": True,
                "source_origin": way["origin"],
                "source_tile_ids": way.get("originTileIds", []),
                "source_snapshot": way.get("snapshot"),
            }
            projected_line = shapely_transform(transformer.transform, source_line)
            clipped = projected_line.intersection(clip_polygon)
            clipped_parts = list(line_parts(clipped))
            if not clipped_parts:
                continue
            source_features.append(
                {
                    "type": "Feature",
                    "id": f"way/{way_id}",
                    "properties": source_properties,
                    "geometry": {
                        "type": "LineString",
                        "coordinates": coordinates,
                    },
                }
            )

            for part_index, part in enumerate(clipped_parts):
                if len(part.coords) < 2 or part.length <= 0:
                    continue
                part_id = f"way-{way_id}-part-{part_index}"
                part_ids.append(part_id)
                if source_line.is_simple and not part.is_simple:
                    introduced_self_intersections.append(part_id)
                for x, y in part.coords:
                    if not (
                        clip_bounds[0] - 1e-6 <= x <= clip_bounds[2] + 1e-6
                        and clip_bounds[1] - 1e-6 <= y <= clip_bounds[3] + 1e-6
                    ):
                        out_of_bounds_vertices += 1
                projected_features.append(
                    {
                        "type": "Feature",
                        "id": part_id,
                        "properties": {
                            "part_id": part_id,
                            "part_index": part_index,
                            "source_way_id": way_id,
                            "category": category,
                            "waterway": waterway,
                            "name": tags.get("name"),
                            "name_en": tags.get("name:en"),
                            "source_node_count": len(way.get("nodes", [])),
                            "source_origin": way["origin"],
                            "length_m": float(part.length),
                            "centerline_immutable": True,
                            "width_changes_lateral_offsets_only": True,
                        },
                        "geometry": mapping(part),
                    }
                )

        coastline_source = [
            feature for feature in source_features if feature["properties"]["category"] == "coastline"
        ]
        waterway_source = [
            feature for feature in source_features if feature["properties"]["category"] == "waterway"
        ]
        coastline_projected = [
            feature for feature in projected_features if feature["properties"]["category"] == "coastline"
        ]
        waterway_projected = [
            feature for feature in projected_features if feature["properties"]["category"] == "waterway"
        ]

        common_metadata = {
            "source": "OpenStreetMap",
            "license": source_config["license"],
            "attribution": source_config["attribution"],
            "generatedAtUtc": generated,
            "truthCogSha256": domain["truthCogSha256"],
            "seedAndFringeSnapshot": True,
            "fullFreshSnapshot": False,
            "seed": seed_snapshot,
            "fringeRawTileCount": len(tile_records),
            "changedDuplicateWayCount": len(changed_duplicates),
            "manualGeometryUsed": False,
        }
        output_payloads = [
            (
                DATA_ROOT / "OSM_COASTLINE_SOURCE_WGS84.geojson",
                canonical_feature_collection(coastline_source, "EPSG:4326", common_metadata),
                "source_coastline_wgs84",
            ),
            (
                DATA_ROOT / "OSM_WATERWAYS_SOURCE_WGS84.geojson",
                canonical_feature_collection(waterway_source, "EPSG:4326", common_metadata),
                "source_waterways_wgs84",
            ),
            (
                DATA_ROOT / "WENZHOU_COASTLINE_EPSG32651.geojson",
                canonical_feature_collection(
                    coastline_projected,
                    domain["projectedCrs"],
                    {**common_metadata, "clipBounds": clip_bounds, "derived": True},
                ),
                "derived_coastline_projected",
            ),
            (
                DATA_ROOT / "WENZHOU_RIVER_CENTERLINES_EPSG32651.geojson",
                canonical_feature_collection(
                    waterway_projected,
                    domain["projectedCrs"],
                    {**common_metadata, "clipBounds": clip_bounds, "derived": True},
                ),
                "derived_waterway_centerlines_projected",
            ),
        ]
        output_files: list[dict[str, Any]] = []
        for path, payload, role in output_payloads:
            write_json(path, payload)
            output_files.append(file_record(path, role))

        duplicate_part_ids = len(part_ids) - len(set(part_ids))
        waterway_type_counts: dict[str, int] = {}
        for feature in waterway_projected:
            key = feature["properties"].get("waterway") or "unknown"
            waterway_type_counts[key] = waterway_type_counts.get(key, 0) + 1
        total_waterway_length = sum(
            float(feature["properties"]["length_m"]) for feature in waterway_projected
        )
        total_coastline_length = sum(
            float(feature["properties"]["length_m"]) for feature in coastline_projected
        )

        source_acquisition_passed = (
            len(tile_records) == len(tiles)
            and len(raw_files) == 2 * len(tiles)
            and seed_way_count > 0
            and len(merged_ways) > 0
        )
        projected_skeleton_passed = (
            len(coastline_projected) > 0
            and len(waterway_projected) > 0
            and len(missing_way_geometry) == 0
            and duplicate_part_ids == 0
            and out_of_bounds_vertices == 0
            and not introduced_self_intersections
        )

        qa.update(
            {
                "truthCogSha256": domain["truthCogSha256"],
                "seedWayCount": seed_way_count,
                "fringeUniqueWayCount": len(fringe_unique_ids),
                "fringeNewWayCount": len(fringe_new_ids),
                "unchangedDuplicateWayCount": len(unchanged_duplicates),
                "changedDuplicateWayCount": len(changed_duplicates),
                "changedDuplicateWays": changed_duplicates,
                "mergedWayCount": len(merged_ways),
                "sourceFeatureCount": len(source_features),
                "sourceCoastlineWayCount": len(coastline_source),
                "sourceWaterwayWayCount": len(waterway_source),
                "derivedCoastlinePartCount": len(coastline_projected),
                "derivedWaterwayPartCount": len(waterway_projected),
                "waterwayTypePartCounts": waterway_type_counts,
                "totalCoastlineLengthMeters": total_coastline_length,
                "totalWaterwayLengthMeters": total_waterway_length,
                "missingWayGeometryCount": len(missing_way_geometry),
                "missingWayGeometryIds": sorted(missing_way_geometry),
                "duplicatePartIdCount": duplicate_part_ids,
                "outOfBoundsVertexCount": out_of_bounds_vertices,
                "introducedSelfIntersectionCount": len(introduced_self_intersections),
                "introducedSelfIntersections": introduced_self_intersections,
                "sourceCoastlineCoordinateHash": coordinate_hash(coastline_source),
                "sourceWaterwayCoordinateHash": coordinate_hash(waterway_source),
                "derivedCoastlineCoordinateHash": coordinate_hash(coastline_projected),
                "derivedWaterwayCoordinateHash": coordinate_hash(waterway_projected),
                "widthCenterlineInvariantPolicy": "width changes lateral offsets only",
                "files": output_files,
                "sourceAcquisitionPassed": source_acquisition_passed,
                "projectedSkeletonPassed": projected_skeleton_passed,
                "hydrologyTopologyPassed": False,
                "passed": False,
            }
        )

        acquisition.update(
            {
                "passed": source_acquisition_passed and projected_skeleton_passed,
                "truthCogSha256": domain["truthCogSha256"],
                "source": source_config,
                "domain": domain,
                "seedPolicy": seed_config["policy"],
                "seedFiles": [seed_coast_record, seed_water_record],
                "seedWayCount": seed_way_count,
                "fringeRegions": fringe_plan["regions"],
                "tiles": tile_records,
                "rawFiles": raw_files,
                "rawUncompressedTotalBytes": sum(
                    int(item["rawUncompressedBytes"]) for item in tile_records
                ),
                "rawCompressedTotalBytes": sum(
                    int(item["bytes"])
                    for item in raw_files
                    if item["role"] == "raw_overpass_json_gzip"
                ),
                "fringeUniqueWayCount": len(fringe_unique_ids),
                "fringeNewWayCount": len(fringe_new_ids),
                "unchangedDuplicateWayCount": len(unchanged_duplicates),
                "changedDuplicateWayCount": len(changed_duplicates),
                "changedDuplicateWays": changed_duplicates,
                "mergedWayCount": len(merged_ways),
                "outputFiles": output_files,
                "license": source_config["license"],
                "attribution": source_config["attribution"],
                "estuaryConnectivityStatus": "pending",
            }
        )
        if not source_acquisition_passed:
            acquisition["error"] = "osm_source_acquisition_failed"
        elif not projected_skeleton_passed:
            acquisition["error"] = "projected_hydrology_skeleton_qa_failed"

        truth_binary_present = bool(truth_manifest["truthCog"].get("binaryObjectPresent"))
        truth_fresh_verified = bool(truth_manifest["truthCog"].get("freshDownloadVerified"))
        state.update(
            {
                "status": (
                    "source_acquired_projected_skeleton_passed_estuary_topology_pending"
                    if acquisition["passed"]
                    else "source_or_projected_skeleton_failed"
                ),
                "truthCogSha256": domain["truthCogSha256"],
                "seedWayCount": seed_way_count,
                "fringeTileCount": len(tile_records),
                "mergedWayCount": len(merged_ways),
                "derivedCoastlinePartCount": len(coastline_projected),
                "derivedWaterwayPartCount": len(waterway_projected),
                "changedDuplicateWayCount": len(changed_duplicates),
                "truthBinaryPresent": truth_binary_present,
                "truthFreshDownloadVerified": truth_fresh_verified,
                "truthDependentDrapingAllowed": truth_binary_present and truth_fresh_verified,
                "fullFreshSnapshot": False,
                "seedAndFringeSnapshot": True,
            }
        )
    except Exception as exc:
        acquisition["error"] = type(exc).__name__
        acquisition["detail"] = str(exc)
        qa["error"] = "osm_hydrology_acquisition_or_projection_failed"
        qa["detail"] = str(exc)
        state["error"] = type(exc).__name__
        state["detail"] = str(exc)

    REPORT_ROOT.mkdir(parents=True, exist_ok=True)
    write_json(ACQUISITION_REPORT, acquisition)
    write_json(QA_REPORT, qa)
    write_json(STATE_REPORT, state)
    print(json.dumps({"acquisition": acquisition, "qa": qa, "state": state}, ensure_ascii=False, indent=2))
    return 0 if qa["sourceAcquisitionPassed"] and qa["projectedSkeletonPassed"] else 2


if __name__ == "__main__":
    sys.exit(main())
