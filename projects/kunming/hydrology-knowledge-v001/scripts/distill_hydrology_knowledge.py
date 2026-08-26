#!/usr/bin/env python3
"""Distill fetched OSM/OHM hydrology into source-preserving knowledge outputs.

This postprocessor assembles OSM multipolygon water areas from relation members,
preserves relation topology, audits historical date/source tags, and emits small
summaries suitable for Git while the full geometry remains in an Actions artifact.
"""
from __future__ import annotations

import argparse
import collections
import hashlib
import json
import math
from pathlib import Path
from typing import Any, Iterable

AREA_WATER = {"lake", "reservoir", "river", "canal", "pond", "basin", "oxbow", "lagoon"}
LINE_WATER = {"river", "stream", "canal", "ditch", "drain", "tidal_channel", "flowline"}
NODE_WATER = {"spring", "dam", "weir", "waterfall", "lock_gate", "rapids"}
EARTH_RADIUS_M = 6_371_008.8


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True), encoding="utf-8")


def coord_key(coord: list[float]) -> tuple[float, float]:
    return (round(float(coord[0]), 8), round(float(coord[1]), 8))


def same_coord(a: list[float], b: list[float]) -> bool:
    return coord_key(a) == coord_key(b)


def member_coords(member: dict[str, Any]) -> list[list[float]]:
    return [
        [float(point["lon"]), float(point["lat"])]
        for point in member.get("geometry", [])
        if "lon" in point and "lat" in point
    ]


def close_ring(ring: list[list[float]]) -> list[list[float]]:
    if ring and not same_coord(ring[0], ring[-1]):
        ring = ring + [ring[0]]
    return ring


def assemble_rings(segments: Iterable[list[list[float]]]) -> tuple[list[list[list[float]]], list[list[list[float]]]]:
    pending = [segment[:] for segment in segments if len(segment) >= 2]
    closed: list[list[list[float]]] = []
    open_chains: list[list[list[float]]] = []
    while pending:
        chain = pending.pop(0)
        progressed = True
        while progressed and not same_coord(chain[0], chain[-1]):
            progressed = False
            for index, segment in enumerate(pending):
                if same_coord(chain[-1], segment[0]):
                    chain.extend(segment[1:])
                elif same_coord(chain[-1], segment[-1]):
                    chain.extend(reversed(segment[:-1]))
                elif same_coord(chain[0], segment[-1]):
                    chain = segment[:-1] + chain
                elif same_coord(chain[0], segment[0]):
                    chain = list(reversed(segment[1:])) + chain
                else:
                    continue
                pending.pop(index)
                progressed = True
                break
        if len(chain) >= 4 and same_coord(chain[0], chain[-1]):
            closed.append(close_ring(chain))
        else:
            open_chains.append(chain)
    return closed, open_chains


def point_in_ring(point: list[float], ring: list[list[float]]) -> bool:
    x, y = point
    inside = False
    for index in range(len(ring) - 1):
        x1, y1 = ring[index]
        x2, y2 = ring[index + 1]
        if (y1 > y) != (y2 > y):
            x_intersection = (x2 - x1) * (y - y1) / ((y2 - y1) or 1e-30) + x1
            if x < x_intersection:
                inside = not inside
    return inside


def ring_area_m2(ring: list[list[float]]) -> float:
    if len(ring) < 4:
        return 0.0
    lat0 = math.radians(sum(point[1] for point in ring[:-1]) / max(1, len(ring) - 1))
    projected = [
        (
            EARTH_RADIUS_M * math.radians(point[0]) * math.cos(lat0),
            EARTH_RADIUS_M * math.radians(point[1]),
        )
        for point in ring
    ]
    area = 0.0
    for (x1, y1), (x2, y2) in zip(projected, projected[1:]):
        area += x1 * y2 - x2 * y1
    return area / 2.0


def relation_polygon(element: dict[str, Any]) -> tuple[dict[str, Any] | None, dict[str, Any]]:
    outer_segments = []
    inner_segments = []
    for member in element.get("members", []):
        coords = member_coords(member)
        if len(coords) < 2:
            continue
        if member.get("role") == "inner":
            inner_segments.append(coords)
        else:
            outer_segments.append(coords)
    outer_rings, open_outer = assemble_rings(outer_segments)
    inner_rings, open_inner = assemble_rings(inner_segments)
    if not outer_rings:
        return None, {
            "outerRingCount": 0,
            "innerRingCount": len(inner_rings),
            "openOuterChains": len(open_outer),
            "openInnerChains": len(open_inner),
        }
    polygons: list[list[list[list[float]]]] = [[outer] for outer in outer_rings]
    for inner in inner_rings:
        point = inner[0]
        candidates = [
            (index, abs(ring_area_m2(outer)))
            for index, outer in enumerate(outer_rings)
            if point_in_ring(point, outer)
        ]
        if candidates:
            polygon_index = min(candidates, key=lambda item: item[1])[0]
            polygons[polygon_index].append(inner)
    geometry: dict[str, Any]
    if len(polygons) == 1:
        geometry = {"type": "Polygon", "coordinates": polygons[0]}
    else:
        geometry = {"type": "MultiPolygon", "coordinates": polygons}
    return geometry, {
        "outerRingCount": len(outer_rings),
        "innerRingCount": len(inner_rings),
        "openOuterChains": len(open_outer),
        "openInnerChains": len(open_inner),
    }


def way_geometry(element: dict[str, Any]) -> dict[str, Any] | None:
    coords = [
        [float(point["lon"]), float(point["lat"])]
        for point in element.get("geometry", [])
        if "lon" in point and "lat" in point
    ]
    if len(coords) < 2:
        return None
    tags = element.get("tags", {})
    is_area = (
        len(coords) >= 4
        and same_coord(coords[0], coords[-1])
        and (
            tags.get("natural") == "water"
            or tags.get("landuse") == "reservoir"
            or tags.get("waterway") == "riverbank"
            or tags.get("water") in AREA_WATER
            or tags.get("area") == "yes"
        )
    )
    if is_area:
        return {"type": "Polygon", "coordinates": [close_ring(coords)]}
    return {"type": "LineString", "coordinates": coords}


def node_geometry(element: dict[str, Any]) -> dict[str, Any] | None:
    if "lon" not in element or "lat" not in element:
        return None
    return {"type": "Point", "coordinates": [float(element["lon"]), float(element["lat"])]}


def waterway_relation_geometry(element: dict[str, Any]) -> dict[str, Any]:
    geometries = []
    for member in element.get("members", []):
        coords = member_coords(member)
        if len(coords) >= 2:
            geometries.append({"type": "LineString", "coordinates": coords})
    return {"type": "GeometryCollection", "geometries": geometries}


def classify(element: dict[str, Any]) -> str:
    tags = element.get("tags", {})
    if element.get("type") == "relation" and tags.get("type") == "waterway":
        return "waterway_relation"
    if tags.get("natural") == "spring" or tags.get("waterway") in NODE_WATER:
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


def feature_from_element(element: dict[str, Any], dataset: str) -> tuple[dict[str, Any] | None, dict[str, Any]]:
    tags = element.get("tags", {})
    element_type = element.get("type")
    geometry_diagnostics: dict[str, Any] = {}
    if element_type == "node":
        geometry = node_geometry(element)
    elif element_type == "way":
        geometry = way_geometry(element)
    elif element_type == "relation" and tags.get("type") == "multipolygon":
        geometry, geometry_diagnostics = relation_polygon(element)
    elif element_type == "relation":
        geometry = waterway_relation_geometry(element)
    else:
        geometry = None
    if geometry is None:
        return None, geometry_diagnostics
    properties = {
        "dataset": dataset,
        "osm_type": element_type,
        "osm_id": element.get("id"),
        "version": element.get("version"),
        "timestamp": element.get("timestamp"),
        "changeset": element.get("changeset"),
        "tags": tags,
        "feature_class": classify(element),
        "historical_status": "modern_only" if dataset == "osm-current" else "candidate",
        "accepted_historical_truth": False,
    }
    if element_type == "relation":
        properties["relation_members"] = [
            {"type": member.get("type"), "ref": member.get("ref"), "role": member.get("role")}
            for member in element.get("members", [])
        ]
        properties["geometry_diagnostics"] = geometry_diagnostics
    return {
        "type": "Feature",
        "id": f"{dataset}/{element_type}/{element.get('id')}",
        "properties": properties,
        "geometry": geometry,
    }, geometry_diagnostics


def feature_area_m2(feature: dict[str, Any]) -> float:
    geometry = feature["geometry"]
    if geometry["type"] == "Polygon":
        rings = geometry["coordinates"]
        return abs(ring_area_m2(rings[0])) - sum(abs(ring_area_m2(ring)) for ring in rings[1:])
    if geometry["type"] == "MultiPolygon":
        total = 0.0
        for polygon in geometry["coordinates"]:
            total += abs(ring_area_m2(polygon[0])) - sum(abs(ring_area_m2(ring)) for ring in polygon[1:])
        return total
    return 0.0


def distill_dataset(root: Path, dataset: str) -> dict[str, Any]:
    raw_path = root / dataset / "raw" / "overpass.json"
    payload = read_json(raw_path)
    layers: dict[str, list[dict[str, Any]]] = {
        "waterways": [],
        "water_areas": [],
        "water_nodes": [],
        "waterway_relations": [],
    }
    diagnostics = collections.Counter()
    tag_class_counts: collections.Counter[str] = collections.Counter()
    source_counts: collections.Counter[str] = collections.Counter()
    named_count = 0
    dated_count = 0
    sourced_count = 0
    candidates = []
    for element in payload.get("elements", []):
        feature, relation_diagnostics = feature_from_element(element, dataset)
        if feature is None:
            diagnostics["geometry_failed"] += 1
            continue
        feature_class = feature["properties"]["feature_class"]
        layer = {
            "waterway": "waterways",
            "water_area": "water_areas",
            "water_node": "water_nodes",
            "waterway_relation": "waterway_relations",
        }.get(feature_class)
        if layer is None:
            continue
        layers[layer].append(feature)
        tags = feature["properties"]["tags"]
        name = tags.get("name") or tags.get("name:zh") or tags.get("old_name")
        if name:
            named_count += 1
        if tags.get("start_date") or tags.get("end_date") or tags.get("source:date"):
            dated_count += 1
        if tags.get("source") or tags.get("source:geometry"):
            sourced_count += 1
        if tags.get("source"):
            source_counts[str(tags["source"])] += 1
        class_value = tags.get("waterway") or tags.get("water") or tags.get("natural") or tags.get("landuse") or feature_class
        tag_class_counts[str(class_value)] += 1
        if relation_diagnostics.get("openOuterChains"):
            diagnostics["open_outer_chains"] += relation_diagnostics["openOuterChains"]
        if relation_diagnostics.get("openInnerChains"):
            diagnostics["open_inner_chains"] += relation_diagnostics["openInnerChains"]
        candidates.append(
            {
                "feature_id": feature["id"],
                "name": name,
                "class": feature_class,
                "subclass": class_value,
                "start_date": tags.get("start_date"),
                "end_date": tags.get("end_date"),
                "source": tags.get("source"),
                "source_date": tags.get("source:date"),
                "osm_type": feature["properties"]["osm_type"],
                "osm_id": feature["properties"]["osm_id"],
                "version": feature["properties"]["version"],
                "timestamp": feature["properties"]["timestamp"],
                "area_m2_approx": round(feature_area_m2(feature), 2),
                "historical_status": feature["properties"]["historical_status"],
                "accepted_historical_truth": False,
            }
        )

    distilled = root / "distilled" / dataset
    for name, features in layers.items():
        write_json(distilled / f"{name}.geojson", {"type": "FeatureCollection", "features": features})
    write_json(distilled / "feature_index.json", candidates)

    major_areas = [item for item in candidates if item["class"] == "water_area" and item["area_m2_approx"] > 0]
    major_areas.sort(key=lambda item: item["area_m2_approx"], reverse=True)
    major_waterways = [item for item in candidates if item["class"] == "waterway" and item["name"]]
    summary = {
        "schemaVersion": "kunming_hydrology_distilled@1.0.0",
        "dataset": dataset,
        "rawSha256": hashlib.sha256(raw_path.read_bytes()).hexdigest(),
        "elementCount": len(payload.get("elements", [])),
        "counts": {name: len(features) for name, features in layers.items()},
        "namedFeatureCount": named_count,
        "dateTaggedFeatureCount": dated_count,
        "sourceTaggedFeatureCount": sourced_count,
        "acceptedHistoricalTruthCount": 0,
        "waterwayRelationCount": len(layers["waterway_relations"]),
        "relationGeometryDiagnostics": dict(diagnostics),
        "tagClassCounts": dict(tag_class_counts.most_common()),
        "sourceTagCounts": dict(source_counts.most_common()),
        "largestNamedWaterAreas": [item for item in major_areas if item["name"]][:50],
        "namedWaterways": major_waterways[:200],
        "historicalAssessment": (
            "Modern OSM reference only."
            if dataset == "osm-current"
            else "No feature is accepted as historical truth until date and cited source are verified."
        ),
    }
    write_json(distilled / "SUMMARY.json", summary)
    return summary


def historical_review(osm_summary: dict[str, Any], ohm_summary: dict[str, Any]) -> dict[str, Any]:
    return {
        "schemaVersion": "kunming_historical_hydrology_review@1.0.0",
        "status": "candidate_sources_extracted_historical_truth_pending",
        "modernOsm": {
            "elementCount": osm_summary["elementCount"],
            "counts": osm_summary["counts"],
            "acceptedHistoricalTruthCount": 0,
            "role": "present-day reference skeleton",
        },
        "openHistoricalMap": {
            "elementCount": ohm_summary["elementCount"],
            "counts": ohm_summary["counts"],
            "dateTaggedFeatureCount": ohm_summary["dateTaggedFeatureCount"],
            "sourceTaggedFeatureCount": ohm_summary["sourceTaggedFeatureCount"],
            "acceptedHistoricalTruthCount": 0,
            "decision": "All extracted OHM objects remain candidates. Features without a dated cited source cannot represent 1940-1945 truth.",
        },
        "nextHistoricalPriority": [
            {
                "title": "NG 48 K'un-Ming, International Map of the World 1:1,000,000, Series 1301, Edition 5-AMS",
                "url": "https://maps.lib.utexas.edu/maps/imw/txu-oclc-6654394-ng-48-5th-ed.jpg",
                "role": "wartime-era major hydrography and names; scale too small for detailed shorelines",
                "geometry_usable": "major features only after georeferencing and inspection",
            },
            {
                "title": "Yunnan quan tu, 1864",
                "url": "https://www.loc.gov/item/96685901/",
                "role": "early major hydrography and historical names; pictorial relief",
                "geometry_usable": False,
            },
            {
                "title": "Airfields in occupied & unoccupied China, February 1943",
                "url": "https://www.loc.gov/item/2007627806/",
                "role": "wartime place-name and airfield context; inspect Kunming area",
                "geometry_usable": False,
            },
        ],
        "formalViewerRule": "Remove hand-drawn water. Display only accepted modern OSM reference or later verified dated historical layers, each with a visible source label.",
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, required=True)
    args = parser.parse_args()
    osm_summary = distill_dataset(args.root, "osm-current")
    ohm_summary = distill_dataset(args.root, "ohm-history")
    review = historical_review(osm_summary, ohm_summary)
    write_json(args.root / "distilled" / "HISTORICAL_REVIEW.json", review)
    combined = {
        "schemaVersion": "kunming_hydrology_distilled_combined@1.0.0",
        "status": "complete",
        "osmCurrent": osm_summary,
        "ohmHistory": ohm_summary,
        "historicalReview": review,
    }
    write_json(args.root / "distilled" / "DISTILLED_SUMMARY.json", combined)
    print(json.dumps(combined, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
