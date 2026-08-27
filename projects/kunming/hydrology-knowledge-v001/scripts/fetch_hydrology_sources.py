#!/usr/bin/env python3
"""Fetch current OSM, OpenHistoricalMap and Library of Congress hydrology candidates.

Outputs are source-preserving candidates. They do not become 1940-1945 truth until
source date, coverage, geometry and DEM topology have been reviewed.
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import time
from pathlib import Path
from typing import Any
from urllib import error, parse, request

OSM_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.nchc.org.tw/api/interpreter",
    "https://overpass.osm.jp/api/interpreter",
]
OHM_ENDPOINTS = ["https://overpass-api.openhistoricalmap.org/api/interpreter"]
LINE_WATER = {"river", "stream", "canal", "ditch", "drain", "tidal_channel", "flowline"}
AREA_WATER = {"lake", "reservoir", "river", "canal", "pond", "basin", "oxbow", "lagoon"}
POINT_WATER = {"spring", "dam", "weir", "waterfall", "lock_gate", "rapids"}
LOC_QUERIES = [
    "Kunming map",
    "Kunming Yunnan map",
    "Yunnan topographic map",
    "Yunnan Army Map Service",
    "China airfields 1943",
    "Yunnan Burma railway map",
    "China military map 1944",
]


def utc_now() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat()


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True), encoding="utf-8")


def post_overpass(query: str, endpoints: list[str], timeout: int = 360) -> tuple[bytes, str, list[dict[str, str]]]:
    body = parse.urlencode({"data": query}).encode("utf-8")
    attempts: list[dict[str, str]] = []
    for endpoint in endpoints:
        for attempt in range(1, 4):
            try:
                req = request.Request(
                    endpoint,
                    data=body,
                    method="POST",
                    headers={
                        "User-Agent": "haihao0307-guilin-dem-pipeline/kunming-hydrology-v001",
                        "Accept": "application/json",
                        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                    },
                )
                with request.urlopen(req, timeout=timeout) as response:
                    raw = response.read()
                    if response.status != 200:
                        raise RuntimeError(f"HTTP {response.status}")
                    json.loads(raw.decode("utf-8"))
                    attempts.append({"endpoint": endpoint, "attempt": str(attempt), "status": "success"})
                    return raw, endpoint, attempts
            except Exception as exc:
                attempts.append(
                    {
                        "endpoint": endpoint,
                        "attempt": str(attempt),
                        "status": "failed",
                        "error": f"{type(exc).__name__}: {exc}",
                    }
                )
                time.sleep(min(15, attempt * 3))
    raise RuntimeError("All Overpass endpoints failed: " + json.dumps(attempts, ensure_ascii=False))


def classify(element: dict[str, Any]) -> str:
    tags = element.get("tags", {})
    if tags.get("type") == "waterway" and element.get("type") == "relation":
        return "waterway_relation"
    if tags.get("natural") == "spring" or tags.get("waterway") in POINT_WATER:
        return "water_node"
    if (
        tags.get("natural") == "water"
        or tags.get("landuse") == "reservoir"
        or tags.get("waterway") == "riverbank"
        or tags.get("water") in AREA_WATER
    ):
        return "water_area"
    if tags.get("waterway") in LINE_WATER:
        return "waterway"
    return "other"


def coords_from_geometry(element: dict[str, Any]) -> list[list[float]]:
    return [
        [float(point["lon"]), float(point["lat"])]
        for point in element.get("geometry", [])
        if "lon" in point and "lat" in point
    ]


def area_way(tags: dict[str, str], coords: list[list[float]]) -> bool:
    if len(coords) < 4 or coords[0] != coords[-1]:
        return False
    return bool(
        tags.get("natural") == "water"
        or tags.get("landuse") == "reservoir"
        or tags.get("waterway") == "riverbank"
        or tags.get("water") in AREA_WATER
        or tags.get("area") == "yes"
    )


def properties(element: dict[str, Any], dataset: str) -> dict[str, Any]:
    return {
        "dataset": dataset,
        "osm_type": element.get("type"),
        "osm_id": element.get("id"),
        "version": element.get("version"),
        "timestamp": element.get("timestamp"),
        "changeset": element.get("changeset"),
        "user": element.get("user"),
        "uid": element.get("uid"),
        "tags": element.get("tags", {}),
        "attribution": (
            "© OpenStreetMap contributors, ODbL 1.0"
            if dataset == "osm-current"
            else "OpenHistoricalMap contributors; retain per-feature source tags"
        ),
    }


def to_feature(element: dict[str, Any], dataset: str) -> dict[str, Any] | None:
    meta = properties(element, dataset)
    element_type = element.get("type")
    if element_type == "node" and "lon" in element and "lat" in element:
        geometry: dict[str, Any] = {
            "type": "Point",
            "coordinates": [float(element["lon"]), float(element["lat"])],
        }
    elif element_type == "way":
        coords = coords_from_geometry(element)
        if len(coords) < 2:
            return None
        geometry = (
            {"type": "Polygon", "coordinates": [coords]}
            if area_way(meta["tags"], coords)
            else {"type": "LineString", "coordinates": coords}
        )
    elif element_type == "relation":
        geometries = []
        members = []
        for member in element.get("members", []):
            coords = [
                [float(point["lon"]), float(point["lat"])]
                for point in member.get("geometry", [])
                if "lon" in point and "lat" in point
            ]
            members.append(
                {"type": member.get("type"), "ref": member.get("ref"), "role": member.get("role")}
            )
            if len(coords) >= 2:
                geometries.append({"type": "LineString", "coordinates": coords})
        meta["relation_members"] = members
        geometry = {"type": "GeometryCollection", "geometries": geometries}
    else:
        return None
    return {
        "type": "Feature",
        "id": f"{dataset}/{element_type}/{element.get('id')}",
        "properties": meta,
        "geometry": geometry,
    }


def geometry_bbox(geometry: dict[str, Any]) -> list[float] | None:
    points: list[tuple[float, float]] = []

    def visit(value: dict[str, Any]) -> None:
        geometry_type = value.get("type")
        coordinates = value.get("coordinates")
        if geometry_type == "Point" and coordinates:
            points.append((coordinates[0], coordinates[1]))
        elif geometry_type == "LineString" and coordinates:
            points.extend((point[0], point[1]) for point in coordinates)
        elif geometry_type == "Polygon" and coordinates:
            for ring in coordinates:
                points.extend((point[0], point[1]) for point in ring)
        elif geometry_type == "GeometryCollection":
            for child in value.get("geometries", []):
                visit(child)

    visit(geometry)
    if not points:
        return None
    xs, ys = zip(*points)
    return [min(xs), min(ys), max(xs), max(ys)]


def process_overpass(raw: bytes, dataset: str, output: Path, endpoint: str, attempts: list[dict[str, str]]) -> dict[str, Any]:
    payload = json.loads(raw.decode("utf-8"))
    groups: dict[str, list[dict[str, Any]]] = {
        "waterways": [],
        "water_areas": [],
        "water_nodes": [],
        "waterway_relations": [],
        "other": [],
    }
    index = []
    for element in payload.get("elements", []):
        feature = to_feature(element, dataset)
        if feature is None:
            continue
        feature_class = classify(element)
        group = {
            "waterway": "waterways",
            "water_area": "water_areas",
            "water_node": "water_nodes",
            "waterway_relation": "waterway_relations",
        }.get(feature_class, "other")
        groups[group].append(feature)
        tags = feature["properties"]["tags"]
        index.append(
            {
                "feature_id": feature["id"],
                "class": feature_class,
                "name": tags.get("name") or tags.get("name:zh") or tags.get("old_name"),
                "start_date": tags.get("start_date"),
                "end_date": tags.get("end_date"),
                "source": tags.get("source"),
                "source_date": tags.get("source:date"),
                "bbox": geometry_bbox(feature["geometry"]),
                "osm_type": feature["properties"]["osm_type"],
                "osm_id": feature["properties"]["osm_id"],
                "version": feature["properties"]["version"],
                "timestamp": feature["properties"]["timestamp"],
                "historical_status": "modern_only" if dataset == "osm-current" else "candidate",
            }
        )

    raw_path = output / dataset / "raw" / "overpass.json"
    raw_path.parent.mkdir(parents=True, exist_ok=True)
    raw_path.write_bytes(raw)
    for name, features in groups.items():
        write_json(
            output / dataset / "layers" / f"{name}.geojson",
            {"type": "FeatureCollection", "features": features},
        )
    write_json(output / dataset / "feature_index.json", index)
    manifest = {
        "schemaVersion": "kunming_hydrology_extract@1.0.0",
        "status": "complete",
        "dataset": dataset,
        "retrievedAtUtc": utc_now(),
        "endpoint": endpoint,
        "queryAttempts": attempts,
        "rawSha256": sha256(raw),
        "rawBytes": len(raw),
        "elementCount": len(payload.get("elements", [])),
        "counts": {name: len(features) for name, features in groups.items()},
        "acceptedHistoricalTruth": False,
    }
    write_json(output / dataset / "manifest.json", manifest)
    return manifest


def fetch_loc(output: Path) -> dict[str, Any]:
    candidates: dict[str, dict[str, Any]] = {}
    searches = []
    for query in LOC_QUERIES:
        url = "https://www.loc.gov/maps/?" + parse.urlencode(
            {"fo": "json", "c": "100", "q": query, "dates": "1800-1945"}
        )
        try:
            req = request.Request(
                url,
                headers={
                    "User-Agent": "haihao0307-guilin-dem-pipeline/kunming-history-v001",
                    "Accept": "application/json",
                },
            )
            with request.urlopen(req, timeout=120) as response:
                payload = json.load(response)
            results = payload.get("results", [])
            searches.append({"query": query, "url": url, "status": "success", "resultCount": len(results)})
            for item in results:
                item_id = item.get("id") or item.get("url")
                if not item_id:
                    continue
                candidates[item_id] = {
                    "id": item_id,
                    "title": item.get("title"),
                    "date": item.get("date") or item.get("dates"),
                    "url": item.get("url") or item.get("id"),
                    "image_url": item.get("image_url"),
                    "description": item.get("description"),
                    "location": item.get("location"),
                    "subject": item.get("subject"),
                    "contributor": item.get("contributor"),
                    "rights": item.get("rights"),
                    "coverage_status": "catalog_candidate_needs_sheet_or_image_inspection",
                    "geometry_usable": False,
                }
        except Exception as exc:
            searches.append(
                {"query": query, "url": url, "status": "failed", "error": f"{type(exc).__name__}: {exc}"}
            )

    known = [
        {
            "title": "Airfields in occupied & unoccupied China (Feb 1943)",
            "year": 1943,
            "url": "https://www.loc.gov/item/2007627806/",
            "role": "wartime airfield and place-name context; inspect whether Kunming and water features are legible",
            "geometry_usable": False,
        },
        {
            "title": "World War II Military Situation Maps",
            "year": "1944-1945",
            "url": "https://www.loc.gov/item/2006577707/",
            "role": "wartime catalog and sheet discovery; detailed Kunming coverage not yet confirmed",
            "geometry_usable": False,
        },
        {
            "title": "The Far East and adjoining areas",
            "year": 1943,
            "url": "https://www.loc.gov/item/2006636620/",
            "role": "regional context and old-name discovery",
            "geometry_usable": False,
        },
        {
            "title": "Chinese civilian war effort, 1940-1943",
            "year": "1940-1943",
            "url": "https://www.loc.gov/item/2005677702/",
            "role": "photographic source discovery for Yunnan-Burma infrastructure",
            "geometry_usable": False,
        },
    ]
    result = {
        "schemaVersion": "kunming_loc_catalog@1.0.0",
        "generatedAtUtc": utc_now(),
        "status": "catalog_search_complete",
        "searches": searches,
        "candidateCount": len(candidates),
        "candidates": list(candidates.values()),
        "knownPriorityRecords": known,
        "warning": "Catalog matches do not prove crop coverage or geometric usability.",
    }
    write_json(output / "historical_catalog" / "LOC_HISTORICAL_CATALOG_CANDIDATES.json", result)
    return {"status": result["status"], "candidateCount": result["candidateCount"], "searches": searches}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--osm-query", type=Path, required=True)
    parser.add_argument("--ohm-query", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)

    report: dict[str, Any] = {
        "schemaVersion": "kunming_hydrology_qa@1.0.0",
        "generatedAtUtc": utc_now(),
        "status": "complete",
        "sources": {},
    }
    failures = []
    for dataset, query_path, endpoints in (
        ("osm-current", args.osm_query, OSM_ENDPOINTS),
        ("ohm-history", args.ohm_query, OHM_ENDPOINTS),
    ):
        try:
            raw, endpoint, attempts = post_overpass(query_path.read_text(encoding="utf-8"), endpoints)
            report["sources"][dataset] = process_overpass(raw, dataset, args.output, endpoint, attempts)
        except Exception as exc:
            failure = {"dataset": dataset, "error": f"{type(exc).__name__}: {exc}"}
            failures.append(failure)
            report["sources"][dataset] = {"status": "failed", "error": failure["error"]}

    report["sources"]["library-of-congress"] = fetch_loc(args.output)
    if failures:
        report["status"] = "partial" if len(failures) == 1 else "failed"
        report["failures"] = failures
    write_json(args.output / "QA_REPORT.json", report)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["status"] != "failed" else 2


if __name__ == "__main__":
    raise SystemExit(main())
