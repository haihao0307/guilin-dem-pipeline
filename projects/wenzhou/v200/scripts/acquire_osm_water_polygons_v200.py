#!/usr/bin/env python3
"""Acquire source-traceable OSM water polygons for the Wenzhou V200 AOI."""
from __future__ import annotations

import gzip
import hashlib
import json
import math
import os
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

ROOT = Path(__file__).resolve().parents[4]
CONFIG = ROOT / "projects/wenzhou/v200/config/osm_water_polygons_v200.json"
DATA = ROOT / "projects/wenzhou/v200/data/hydrology/osm_water_polygons"
RAW = DATA / "raw"
REPORTS = ROOT / "projects/wenzhou/v200/reports"
ACQ = REPORTS / "OSM_WATER_POLYGONS_ACQUISITION.json"
QA = REPORTS / "OSM_WATER_POLYGONS_QA.json"
OUT_WGS = DATA / "WENZHOU_OSM_WATER_POLYGONS_WGS84.geojson"
OUT_UTM = DATA / "WENZHOU_OSM_WATER_POLYGONS_EPSG32651.geojson"


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
    with tempfile.NamedTemporaryFile(delete=False, dir=path.parent) as temp:
        temp.write(content)
        temp.flush()
        os.fsync(temp.fileno())
        temporary = Path(temp.name)
    os.replace(temporary, path)


def write_json(path: Path, payload: Any) -> None:
    atomic_write(
        path,
        (json.dumps(payload, ensure_ascii=False, sort_keys=True, indent=2) + "\n").encode("utf-8"),
    )


def write_gzip(path: Path, content: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(delete=False, dir=path.parent) as temp:
        temporary = Path(temp.name)
    with temporary.open("wb") as handle:
        with gzip.GzipFile(filename="", mode="wb", fileobj=handle, mtime=0) as compressed:
            compressed.write(content)
    os.replace(temporary, path)


def file_record(path: Path, role: str) -> dict[str, Any]:
    return {
        "role": role,
        "path": str(path.relative_to(ROOT)),
        "bytes": path.stat().st_size,
        "sha256": sha256_file(path),
    }


def build_tiles(bounds: list[float], columns: int, rows: int, overlap: float) -> list[dict[str, Any]]:
    west, south, east, north = map(float, bounds)
    dx = (east - west) / columns
    dy = (north - south) / rows
    result = []
    for row in range(rows):
        for column in range(columns):
            result.append(
                {
                    "row": row,
                    "column": column,
                    "bounds": [
                        west + column * dx - (overlap if column else 0.0),
                        south + row * dy - (overlap if row else 0.0),
                        west + (column + 1) * dx + (overlap if column < columns - 1 else 0.0),
                        south + (row + 1) * dy + (overlap if row < rows - 1 else 0.0),
                    ],
                }
            )
    return result


def overpass_query(bounds: list[float], timeout_seconds: int) -> str:
    west, south, east, north = bounds
    bbox = f"{south:.8f},{west:.8f},{north:.8f},{east:.8f}"
    return f'''[out:json][timeout:{timeout_seconds}];
(
  way["natural"="water"]({bbox});
  relation["natural"="water"]({bbox});
  way["waterway"="riverbank"]({bbox});
  relation["waterway"="riverbank"]({bbox});
  way["natural"="bay"]({bbox});
  relation["natural"="bay"]({bbox});
  way["natural"="strait"]({bbox});
  relation["natural"="strait"]({bbox});
);
out body geom qt;
'''


def request_overpass(
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
            started = time.monotonic()
            try:
                request = urllib.request.Request(
                    endpoint,
                    data=encoded,
                    method="POST",
                    headers={
                        "User-Agent": "WenzhouV200WaterPolygons/1.0 repository=haihao0307/guilin-dem-pipeline",
                        "Referer": "https://github.com/haihao0307/guilin-dem-pipeline",
                        "Accept": "application/json",
                        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                    },
                )
                with urllib.request.urlopen(request, timeout=300) as response:
                    content = response.read()
                    status = int(getattr(response, "status", 200))
                    attempts.append(
                        {
                            "endpoint": endpoint,
                            "attempt": round_index + 1,
                            "httpStatus": status,
                            "durationSeconds": time.monotonic() - started,
                        }
                    )
                    payload = json.loads(content)
                    if status != 200 or not isinstance(payload.get("elements"), list):
                        raise RuntimeError("invalid Overpass response")
                    return content, {
                        "selectedEndpoint": endpoint,
                        "selectedAttempt": round_index + 1,
                        "attempts": attempts,
                    }
            except urllib.error.HTTPError as exc:
                attempts.append(
                    {
                        "endpoint": endpoint,
                        "attempt": round_index + 1,
                        "error": "HTTPError",
                        "httpStatus": int(exc.code),
                        "detail": str(exc),
                        "durationSeconds": time.monotonic() - started,
                    }
                )
                time.sleep(pause_429 if exc.code == 429 else pause_other)
            except Exception as exc:
                attempts.append(
                    {
                        "endpoint": endpoint,
                        "attempt": round_index + 1,
                        "error": type(exc).__name__,
                        "detail": str(exc),
                        "durationSeconds": time.monotonic() - started,
                    }
                )
                time.sleep(pause_other)
    raise RuntimeError(f"all Overpass endpoints failed: {attempts}")


def coordinates_from_geometry(geometry: Any) -> list[tuple[float, float]]:
    if not isinstance(geometry, list):
        return []
    coordinates = []
    for point in geometry:
        if not isinstance(point, dict) or "lon" not in point or "lat" not in point:
            return []
        coordinates.append((float(point["lon"]), float(point["lat"])))
    return coordinates


def closed_ring(coordinates: list[tuple[float, float]]) -> list[tuple[float, float]] | None:
    if len(coordinates) < 4:
        return None
    if math.hypot(
        coordinates[0][0] - coordinates[-1][0],
        coordinates[0][1] - coordinates[-1][1],
    ) > 1e-10:
        return None
    return coordinates


def polygon_parts(geometry: Any) -> Iterable[Any]:
    if geometry.is_empty:
        return []
    if geometry.geom_type == "Polygon":
        return [geometry]
    if geometry.geom_type in {"MultiPolygon", "GeometryCollection"}:
        return [part for part in geometry.geoms if part.geom_type == "Polygon" and not part.is_empty]
    return []


def main() -> int:
    generated = datetime.now(timezone.utc).isoformat()
    acquisition: dict[str, Any] = {
        "schema": "wenzhou_osm_water_polygons_acquisition@1.0.0",
        "generatedAtUtc": generated,
        "passed": False,
    }
    qa: dict[str, Any] = {
        "schema": "wenzhou_osm_water_polygons_qa@1.0.0",
        "generatedAtUtc": generated,
        "passed": False,
        "manualGeometryCount": 0,
        "topologyGapBridgeCount": 0,
    }
    try:
        import shutil
        from pyproj import Transformer
        from shapely.geometry import LineString, Polygon, box, mapping, shape
        from shapely.ops import polygonize, transform as shapely_transform, unary_union

        config = json.loads(CONFIG.read_text(encoding="utf-8"))
        source = config["source"]
        domain = config["domain"]
        tiling = config["tiling"]
        retry = config["retry"]
        endpoints = [source["primaryEndpoint"], *source["fallbackEndpoints"]]

        shutil.rmtree(DATA, ignore_errors=True)
        RAW.mkdir(parents=True, exist_ok=True)
        REPORTS.mkdir(parents=True, exist_ok=True)
        for path in (ACQ, QA):
            path.unlink(missing_ok=True)

        tile_records: list[dict[str, Any]] = []
        raw_files: list[dict[str, Any]] = []
        elements: dict[tuple[str, int], dict[str, Any]] = {}
        changed_duplicates = 0
        tile_plan = build_tiles(
            domain["wgs84Bounds"],
            int(tiling["columns"]),
            int(tiling["rows"]),
            float(tiling["overlapDegrees"]),
        )
        for tile_index, tile in enumerate(tile_plan):
            query = overpass_query(tile["bounds"], int(config["query"]["timeoutSeconds"]))
            content, transfer = request_overpass(
                endpoints,
                query,
                int(retry["attemptsPerEndpoint"]),
                float(retry["http429PauseSeconds"]),
                float(retry["otherRetryPauseSeconds"]),
            )
            payload = json.loads(content)
            raw_path = RAW / f"overpass_r{tile['row']}_c{tile['column']}.json.gz"
            query_path = RAW / f"overpass_r{tile['row']}_c{tile['column']}.query.overpassql"
            write_gzip(raw_path, content)
            atomic_write(query_path, query.encode("utf-8"))
            raw_files.extend(
                [
                    file_record(raw_path, "raw_overpass_json_gzip"),
                    file_record(query_path, "overpass_query"),
                ]
            )
            for element in payload["elements"]:
                if element.get("type") not in {"way", "relation"}:
                    continue
                key = (str(element["type"]), int(element["id"]))
                if key in elements and elements[key] != element:
                    changed_duplicates += 1
                elements[key] = element
            tile_records.append(
                {
                    **tile,
                    "querySha256": sha256_bytes(query.encode("utf-8")),
                    "rawUncompressedBytes": len(content),
                    "rawUncompressedSha256": sha256_bytes(content),
                    "rawCompressed": raw_files[-2],
                    "queryFile": raw_files[-1],
                    "elementCount": len(payload["elements"]),
                    "osmVersion": payload.get("version"),
                    "osmGenerator": payload.get("generator"),
                    "osm3s": payload.get("osm3s"),
                    "transfer": transfer,
                }
            )
            if tile_index < len(tile_plan) - 1:
                time.sleep(float(tiling["secondsBetweenSuccessfulTiles"]))

        source_features: list[dict[str, Any]] = []
        unresolved_elements: list[dict[str, Any]] = []
        invalid_parts: list[dict[str, Any]] = []
        for (element_type, element_id), element in sorted(elements.items()):
            tags = {str(key): str(value) for key, value in (element.get("tags") or {}).items()}
            polygons: list[Any] = []
            if element_type == "way":
                ring = closed_ring(coordinates_from_geometry(element.get("geometry")))
                if ring:
                    polygons = list(polygon_parts(Polygon(ring)))
            else:
                outer_lines = []
                inner_lines = []
                for member in element.get("members") or []:
                    coordinates = coordinates_from_geometry(member.get("geometry"))
                    if len(coordinates) < 2:
                        continue
                    (inner_lines if member.get("role") == "inner" else outer_lines).append(
                        LineString(coordinates)
                    )
                outer_polygons = list(polygonize(unary_union(outer_lines))) if outer_lines else []
                inner_polygons = list(polygonize(unary_union(inner_lines))) if inner_lines else []
                inner_union = unary_union(inner_polygons) if inner_polygons else None
                for outer in outer_polygons:
                    geometry = outer.difference(inner_union) if inner_union is not None else outer
                    polygons.extend(polygon_parts(geometry))

            if not polygons:
                unresolved_elements.append(
                    {"source_element_type": element_type, "source_element_id": element_id, "tags": tags}
                )
                continue
            for part_index, polygon in enumerate(polygons):
                if not polygon.is_valid:
                    polygon = polygon.buffer(0)
                valid_parts = list(polygon_parts(polygon))
                if not valid_parts:
                    invalid_parts.append(
                        {
                            "source_element_type": element_type,
                            "source_element_id": element_id,
                            "part_index": part_index,
                        }
                    )
                    continue
                for subpart_index, valid_polygon in enumerate(valid_parts):
                    source_features.append(
                        {
                            "type": "Feature",
                            "id": f"{element_type}-{element_id}-part-{part_index}-{subpart_index}",
                            "properties": {
                                "source_element_type": element_type,
                                "source_element_id": element_id,
                                "part_index": part_index,
                                "subpart_index": subpart_index,
                                "name": tags.get("name"),
                                "water": tags.get("water"),
                                "waterway": tags.get("waterway"),
                                "natural": tags.get("natural"),
                                "tidal": tags.get("tidal"),
                                "tags": tags,
                                "manual_geometry": False,
                                "topology_gap_bridge": False,
                            },
                            "geometry": mapping(valid_polygon),
                        }
                    )

        transformer = Transformer.from_crs("EPSG:4326", domain["projectedCrs"], always_xy=True)
        clip_bounds = [float(value) for value in domain["projectedClipBounds"]]
        clip_polygon = box(*clip_bounds)
        projected_features: list[dict[str, Any]] = []
        out_of_bounds_vertices = 0
        total_area_m2 = 0.0
        for source_feature in source_features:
            projected_geometry = shapely_transform(transformer.transform, shape(source_feature["geometry"]))
            clipped = projected_geometry.intersection(clip_polygon)
            for projected_part_index, polygon in enumerate(polygon_parts(clipped)):
                if polygon.area <= 0:
                    continue
                for x, y in polygon.exterior.coords:
                    if not (
                        clip_bounds[0] - 1e-6 <= x <= clip_bounds[2] + 1e-6
                        and clip_bounds[1] - 1e-6 <= y <= clip_bounds[3] + 1e-6
                    ):
                        out_of_bounds_vertices += 1
                properties = dict(source_feature["properties"])
                properties.update(
                    {
                        "projected_part_index": projected_part_index,
                        "area_m2": float(polygon.area),
                    }
                )
                total_area_m2 += float(polygon.area)
                projected_features.append(
                    {
                        "type": "Feature",
                        "id": f"{source_feature['id']}-projected-{projected_part_index}",
                        "properties": properties,
                        "geometry": mapping(polygon),
                    }
                )

        metadata = {
            "source": "OpenStreetMap Overpass API",
            "license": source["license"],
            "attribution": source["attribution"],
            "generatedAtUtc": generated,
            "truthCogSha256": domain["truthCogSha256"],
            "manualGeometryUsed": False,
            "topologyGapBridgingUsed": False,
            "rawTileCount": len(tile_records),
        }
        write_json(
            OUT_WGS,
            {"type": "FeatureCollection", "metadata": metadata, "features": source_features},
        )
        write_json(
            OUT_UTM,
            {
                "type": "FeatureCollection",
                "crs": {"type": "name", "properties": {"name": domain["projectedCrs"]}},
                "metadata": {**metadata, "clipBounds": clip_bounds, "derived": True},
                "features": projected_features,
            },
        )
        output_files = [
            file_record(OUT_WGS, "source_water_polygons_wgs84"),
            file_record(OUT_UTM, "derived_water_polygons_projected"),
        ]
        acquisition_passed = len(tile_records) == len(tile_plan) and len(raw_files) == 2 * len(tile_plan)
        qa_passed = acquisition_passed and bool(projected_features) and out_of_bounds_vertices == 0
        acquisition.update(
            {
                "passed": acquisition_passed,
                "project": config["project"],
                "source": source,
                "domain": domain,
                "license": source["license"],
                "attribution": source["attribution"],
                "tiles": tile_records,
                "rawFiles": raw_files,
                "outputFiles": output_files,
                "sourceElementCount": len(elements),
                "changedDuplicateElementCount": changed_duplicates,
                "sourcePolygonPartCount": len(source_features),
                "unresolvedElementCount": len(unresolved_elements),
                "unresolvedElements": unresolved_elements,
                "invalidPartCount": len(invalid_parts),
                "invalidParts": invalid_parts,
                "manualGeometryUsed": False,
                "topologyGapBridgingUsed": False,
            }
        )
        qa.update(
            {
                "passed": qa_passed,
                "project": config["project"],
                "truthCogSha256": domain["truthCogSha256"],
                "sourceAcquisitionPassed": acquisition_passed,
                "sourcePolygonPartCount": len(source_features),
                "projectedPolygonPartCount": len(projected_features),
                "projectedAreaKm2": total_area_m2 / 1_000_000.0,
                "outOfBoundsVertexCount": out_of_bounds_vertices,
                "manualGeometryCount": 0,
                "topologyGapBridgeCount": 0,
                "estuaryTopologyStatus": config["qa"]["estuaryTopologyStatusAfterThisStage"],
                "files": output_files,
            }
        )
    except Exception as exc:
        acquisition["error"] = type(exc).__name__
        acquisition["detail"] = str(exc)
        qa["error"] = "osm_water_polygon_acquisition_or_projection_failed"
        qa["detail"] = str(exc)
    finally:
        write_json(ACQ, acquisition)
        write_json(QA, qa)
    print(json.dumps({"acquisition": acquisition, "qa": qa}, ensure_ascii=False, indent=2))
    return 0 if acquisition.get("passed") and qa.get("passed") else 2


if __name__ == "__main__":
    raise SystemExit(main())
