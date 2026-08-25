#!/usr/bin/env python3
"""Acquire source-traceable OSM coastline and waterway ways for Wenzhou.

The raw Overpass JSON responses are preserved with deterministic gzip encoding.
Source way coordinates remain unchanged in WGS84. Projected and clipped geometry
is written as a separate derived layer in EPSG:32651.
"""

from __future__ import annotations

import gzip
import hashlib
import json
import math
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
CONFIG_PATH = REPO_ROOT / "projects/wenzhou/coastal/config/osm_hydrology_v100.json"
DATA_ROOT = REPO_ROOT / "projects/wenzhou/coastal/data/hydrology/osm"
RAW_ROOT = DATA_ROOT / "raw"
REPORT_ROOT = REPO_ROOT / "projects/wenzhou/coastal/reports"
ACQUISITION_REPORT = REPORT_ROOT / "OSM_HYDROLOGY_ACQUISITION.json"
QA_REPORT = REPORT_ROOT / "HYDROLOGY_TOPOLOGY_QA.json"


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


def tile_bounds(bounds: list[float], columns: int, rows: int, overlap: float) -> list[dict[str, Any]]:
    west, south, east, north = bounds
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
                    "row": row,
                    "column": column,
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
        "out body;\n"
        ">;\n"
        "out skel qt;\n"
    )


def request_overpass(endpoints: list[str], query: str) -> tuple[bytes, dict[str, Any]]:
    encoded = urllib.parse.urlencode({"data": query}).encode("utf-8")
    attempts: list[dict[str, Any]] = []
    for endpoint in endpoints:
        for attempt in range(1, 4):
            started = time.monotonic()
            request = urllib.request.Request(
                endpoint,
                data=encoded,
                method="POST",
                headers={
                    "User-Agent": "WenzhouCoastalPipeline/1.0",
                    "Accept": "application/json",
                    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                },
            )
            try:
                with urllib.request.urlopen(request, timeout=300) as response:
                    content = response.read()
                    status = getattr(response, "status", 200)
                    content_type = response.headers.get("Content-Type", "")
                    duration = time.monotonic() - started
                    attempt_record = {
                        "endpoint": endpoint,
                        "attempt": attempt,
                        "httpStatus": status,
                        "contentType": content_type,
                        "contentLengthHeader": response.headers.get("Content-Length"),
                        "durationSeconds": duration,
                    }
                    attempts.append(attempt_record)
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
                        "selectedAttempt": attempt,
                        "attempts": attempts,
                    }
            except Exception as exc:
                attempts.append(
                    {
                        "endpoint": endpoint,
                        "attempt": attempt,
                        "error": type(exc).__name__,
                        "detail": str(exc),
                        "durationSeconds": time.monotonic() - started,
                    }
                )
                if attempt < 3:
                    time.sleep(min(2**attempt * 3, 20))
    raise RuntimeError(f"All Overpass endpoints failed: {attempts}")


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
        return [item for item in geometry.geoms if item.geom_type == "LineString" and not item.is_empty]
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
        "schema": "wenzhou_osm_hydrology_acquisition@1.0.0",
        "generatedAtUtc": generated,
        "passed": False,
    }
    qa: dict[str, Any] = {
        "schema": "wenzhou_hydrology_topology_qa@1.0.0",
        "generatedAtUtc": generated,
        "passed": False,
        "estuaryConnectivityStatus": "pending named network and coastline topology stage",
    }

    try:
        from pyproj import Transformer
        from shapely.geometry import LineString, box, mapping
        from shapely.ops import transform as shapely_transform

        config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
        source_config = config["source"]
        domain = config["domain"]
        tiling = config["tiling"]
        query_config = config["query"]
        endpoints = [source_config["primaryEndpoint"], *source_config["fallbackEndpoints"]]
        tiles = tile_bounds(
            domain["wgs84Bounds"],
            int(tiling["columns"]),
            int(tiling["rows"]),
            float(tiling["overlapDegrees"]),
        )

        all_nodes: dict[int, tuple[float, float]] = {}
        all_ways: dict[int, dict[str, Any]] = {}
        tile_records: list[dict[str, Any]] = []
        raw_files: list[dict[str, Any]] = []
        for tile in tiles:
            query = overpass_query(tile["bounds"], int(query_config["timeoutSeconds"]))
            content, transfer = request_overpass(endpoints, query)
            payload = json.loads(content)
            raw_path = RAW_ROOT / f"overpass_r{tile['row']}_c{tile['column']}.json.gz"
            query_path = RAW_ROOT / f"overpass_r{tile['row']}_c{tile['column']}.query.overpassql"
            write_deterministic_gzip(raw_path, content)
            atomic_write(query_path, query.encode("utf-8"))
            raw_files.extend(
                [
                    file_record(raw_path, "raw_overpass_json_gzip"),
                    file_record(query_path, "overpass_query"),
                ]
            )

            element_counts: dict[str, int] = {}
            for element in payload["elements"]:
                element_type = str(element.get("type"))
                element_counts[element_type] = element_counts.get(element_type, 0) + 1
                if element_type == "node":
                    node_id = int(element["id"])
                    coordinate = (float(element["lon"]), float(element["lat"]))
                    previous = all_nodes.get(node_id)
                    if previous is not None and previous != coordinate:
                        raise RuntimeError(f"OSM node {node_id} changed across tile responses")
                    all_nodes[node_id] = coordinate
                elif element_type == "way":
                    way_id = int(element["id"])
                    way = {
                        "id": way_id,
                        "nodes": [int(item) for item in element.get("nodes", [])],
                        "tags": {str(key): str(value) for key, value in element.get("tags", {}).items()},
                    }
                    previous = all_ways.get(way_id)
                    if previous is not None and previous != way:
                        raise RuntimeError(f"OSM way {way_id} changed across tile responses")
                    all_ways[way_id] = way

            tile_records.append(
                {
                    **tile,
                    "querySha256": sha256_bytes(query.encode("utf-8")),
                    "rawUncompressedBytes": len(content),
                    "rawUncompressedSha256": sha256_bytes(content),
                    "rawCompressed": raw_files[-2],
                    "queryFile": raw_files[-1],
                    "osmGenerator": payload.get("generator"),
                    "osmVersion": payload.get("version"),
                    "osm3s": payload.get("osm3s"),
                    "elementCounts": element_counts,
                    "transfer": transfer,
                }
            )

        transformer = Transformer.from_crs("EPSG:4326", domain["projectedCrs"], always_xy=True)
        clip_bounds = [float(value) for value in domain["projectedClipBounds"]]
        clip_polygon = box(*clip_bounds)
        missing_references: list[dict[str, Any]] = []
        source_features: list[dict[str, Any]] = []
        projected_features: list[dict[str, Any]] = []
        introduced_self_intersections: list[str] = []
        out_of_bounds_vertices = 0
        part_ids: list[str] = []

        for way_id, way in sorted(all_ways.items()):
            tags = way["tags"]
            is_coastline = tags.get("natural") == "coastline"
            waterway = tags.get("waterway")
            if not is_coastline and waterway not in {"river", "stream", "canal", "tidal_channel"}:
                continue
            node_ids = way["nodes"]
            absent = [node_id for node_id in node_ids if node_id not in all_nodes]
            if absent:
                missing_references.append({"wayId": way_id, "missingNodeIds": absent})
                continue
            coordinates = [all_nodes[node_id] for node_id in node_ids]
            if len(coordinates) < int(config["derived"]["minimumWayVertexCount"]):
                continue
            source_line = LineString(coordinates)
            category = "coastline" if is_coastline else "waterway"
            source_properties = {
                "source_way_id": way_id,
                "source_node_ids": node_ids,
                "category": category,
                "waterway": waterway,
                "name": tags.get("name"),
                "name_en": tags.get("name:en"),
                "tags": tags,
                "source_vertex_count": len(coordinates),
                "source_is_simple": bool(source_line.is_simple),
            }
            source_features.append(
                {
                    "type": "Feature",
                    "id": f"way/{way_id}",
                    "properties": source_properties,
                    "geometry": {
                        "type": "LineString",
                        "coordinates": [[lon, lat] for lon, lat in coordinates],
                    },
                }
            )

            projected_line = shapely_transform(transformer.transform, source_line)
            clipped = projected_line.intersection(clip_polygon)
            for part_index, part in enumerate(line_parts(clipped)):
                if len(part.coords) < 2 or part.length <= 0:
                    continue
                part_id = f"way-{way_id}-part-{part_index}"
                part_ids.append(part_id)
                if source_line.is_simple and not part.is_simple:
                    introduced_self_intersections.append(part_id)
                part_coordinates = [[float(x), float(y)] for x, y in part.coords]
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
                            "source_node_count": len(node_ids),
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
            "source": "OpenStreetMap Overpass API",
            "license": source_config["license"],
            "attribution": source_config["attribution"],
            "retrievedAtUtc": generated,
            "rawTileCount": len(tile_records),
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

        qa.update(
            {
                "sourceNodeCount": len(all_nodes),
                "sourceWayCount": len(all_ways),
                "sourceFeatureCount": len(source_features),
                "sourceCoastlineWayCount": len(coastline_source),
                "sourceWaterwayWayCount": len(waterway_source),
                "derivedCoastlinePartCount": len(coastline_projected),
                "derivedWaterwayPartCount": len(waterway_projected),
                "waterwayTypePartCounts": waterway_type_counts,
                "totalCoastlineLengthMeters": total_coastline_length,
                "totalWaterwayLengthMeters": total_waterway_length,
                "missingNodeReferenceCount": sum(
                    len(item["missingNodeIds"]) for item in missing_references
                ),
                "missingNodeReferences": missing_references,
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
            }
        )
        qa["passed"] = (
            len(coastline_projected) > 0
            and len(waterway_projected) > 0
            and qa["missingNodeReferenceCount"] == 0
            and duplicate_part_ids == 0
            and out_of_bounds_vertices == 0
            and not introduced_self_intersections
        )
        acquisition.update(
            {
                "passed": qa["passed"],
                "source": source_config,
                "domain": domain,
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
                "deduplicatedNodeCount": len(all_nodes),
                "deduplicatedWayCount": len(all_ways),
                "outputFiles": output_files,
                "license": source_config["license"],
                "attribution": source_config["attribution"],
            }
        )
        if not qa["passed"]:
            acquisition["error"] = "hydrology_topology_qa_failed"
    except Exception as exc:
        acquisition["error"] = type(exc).__name__
        acquisition["detail"] = str(exc)
        qa["error"] = "osm_hydrology_acquisition_or_topology_failed"
        qa["detail"] = str(exc)

    REPORT_ROOT.mkdir(parents=True, exist_ok=True)
    write_json(ACQUISITION_REPORT, acquisition)
    write_json(QA_REPORT, qa)
    print(json.dumps({"acquisition": acquisition, "qa": qa}, ensure_ascii=False, indent=2))
    return 0 if acquisition["passed"] and qa["passed"] else 2


if __name__ == "__main__":
    sys.exit(main())
