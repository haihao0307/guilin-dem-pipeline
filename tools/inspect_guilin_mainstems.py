from __future__ import annotations

import json
from collections import Counter, defaultdict, deque
from pathlib import Path
from typing import Any, Iterable

from pyproj import Transformer
from shapely.geometry import GeometryCollection, LineString, MultiLineString, box, shape
from shapely.ops import transform as shapely_transform

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "truth" / "OSM_HYDROLOGY_IMMUTABLE.geojson"
OUTPUT = ROOT / "qa" / "GUILIN_MAINSTEM_SOURCE_INSPECTION.json"
AOI_BOUNDS = [380331.8, 2705928.1, 530128.2, 2926987.2]
CRS = "EPSG:32649"
PATTERNS = {
    "li": ("漓江", "漓水", "li river", "li jiang", "lijiang river", "li-jiang"),
    "xiang": ("湘江", "湘水", "xiang river", "xiang jiang", "xiangjiang"),
    "zi": ("资江", "資江", "资水", "資水", "夫夷水", "夫夷江", "zi river", "zi jiang", "zijiang", "zi shui", "zishui", "fuyi river", "fu yi river", "fuyi shui"),
}


def iter_lines(geometry: Any) -> Iterable[LineString]:
    if geometry.is_empty:
        return
    if isinstance(geometry, LineString):
        if len(geometry.coords) >= 2 and geometry.length > 0:
            yield geometry
        return
    if isinstance(geometry, MultiLineString):
        for part in geometry.geoms:
            yield from iter_lines(part)
        return
    if isinstance(geometry, GeometryCollection):
        for part in geometry.geoms:
            yield from iter_lines(part)


def name_blob(properties: dict[str, Any]) -> str:
    values: list[str] = []
    for key, value in properties.items():
        lowered = str(key).lower()
        if lowered == "name" or lowered.startswith("name:") or lowered in {
            "alt_name", "official_name", "short_name", "local_name", "old_name",
            "name_zh", "name_en", "river_name",
        }:
            if value not in (None, ""):
                values.append(str(value))
    return " | ".join(values)


def classify(text: str) -> str | None:
    lowered = text.lower()
    for system, patterns in PATTERNS.items():
        if any(pattern.lower() in lowered for pattern in patterns):
            return system
    return None


def connected_components(edges: list[tuple[tuple[float, float], tuple[float, float]]]) -> tuple[int, list[int], Counter[int]]:
    adjacency: dict[tuple[float, float], set[tuple[float, float]]] = defaultdict(set)
    degree: Counter[tuple[float, float]] = Counter()
    for start, end in edges:
        adjacency[start].add(end)
        adjacency[end].add(start)
        degree[start] += 1
        degree[end] += 1
    visited: set[tuple[float, float]] = set()
    sizes: list[int] = []
    for node in adjacency:
        if node in visited:
            continue
        queue = deque([node])
        visited.add(node)
        count = 0
        while queue:
            current = queue.popleft()
            count += 1
            for neighbour in adjacency[current]:
                if neighbour not in visited:
                    visited.add(neighbour)
                    queue.append(neighbour)
        sizes.append(count)
    sizes.sort(reverse=True)
    degree_histogram = Counter(degree.values())
    return len(sizes), sizes, degree_histogram


def main() -> None:
    collection = json.loads(SOURCE.read_text(encoding="utf-8"))
    transformer = Transformer.from_crs("EPSG:4326", CRS, always_xy=True)
    domain = box(*AOI_BOUNDS)
    systems: dict[str, dict[str, Any]] = {
        system: {
            "feature_count": 0,
            "part_count": 0,
            "source_coordinate_segment_count": 0,
            "length_m": 0.0,
            "features": [],
            "edges": [],
        }
        for system in PATTERNS
    }

    for feature_index, feature in enumerate(collection.get("features", [])):
        properties = feature.get("properties") or {}
        if str(properties.get("waterway") or "").lower() != "river":
            continue
        names = name_blob(properties)
        system = classify(names)
        if system is None:
            continue
        geometry_payload = feature.get("geometry")
        if not geometry_payload:
            continue
        projected = shapely_transform(transformer.transform, shape(geometry_payload))
        clipped = projected.intersection(domain)
        part_summaries: list[dict[str, Any]] = []
        for line in iter_lines(clipped):
            coordinates = list(line.coords)
            if len(coordinates) < 2:
                continue
            segment_count = len(coordinates) - 1
            edge_start = (round(float(coordinates[0][0]), 3), round(float(coordinates[0][1]), 3))
            edge_end = (round(float(coordinates[-1][0]), 3), round(float(coordinates[-1][1]), 3))
            systems[system]["edges"].append((edge_start, edge_end))
            systems[system]["part_count"] += 1
            systems[system]["source_coordinate_segment_count"] += segment_count
            systems[system]["length_m"] += float(line.length)
            part_summaries.append({
                "segment_count": segment_count,
                "length_m": round(float(line.length), 3),
                "start": list(edge_start),
                "end": list(edge_end),
            })
        if not part_summaries:
            continue
        systems[system]["feature_count"] += 1
        systems[system]["features"].append({
            "feature_index": feature_index,
            "osm_id": properties.get("osm_id") or properties.get("id") or properties.get("@id"),
            "names": names,
            "base_width_m": properties.get("base_width_m"),
            "part_count": len(part_summaries),
            "segment_count": sum(part["segment_count"] for part in part_summaries),
            "length_m": round(sum(part["length_m"] for part in part_summaries), 3),
            "parts": part_summaries,
        })

    result_systems: dict[str, Any] = {}
    for system, data in systems.items():
        component_count, component_sizes, degree_histogram = connected_components(data.pop("edges"))
        data["length_km"] = round(data.pop("length_m") / 1000.0, 3)
        data["endpoint_graph_component_count"] = component_count
        data["endpoint_graph_component_sizes"] = component_sizes
        data["endpoint_graph_degree_histogram"] = {str(key): value for key, value in sorted(degree_histogram.items())}
        data["features"].sort(key=lambda item: (-item["segment_count"], item["feature_index"]))
        result_systems[system] = data

    payload = {
        "schema": "guilin-explicit-mainstem-source-inspection/v1",
        "source_file": str(SOURCE.relative_to(ROOT)),
        "classification": "explicit OSM river names only",
        "patterns": {key: list(value) for key, value in PATTERNS.items()},
        "systems": result_systems,
        "total_explicit_segment_count": sum(item["source_coordinate_segment_count"] for item in result_systems.values()),
        "total_source_linear_segment_count_reference": 155429,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        system: {
            "features": data["feature_count"],
            "segments": data["source_coordinate_segment_count"],
            "length_km": data["length_km"],
            "components": data["endpoint_graph_component_count"],
        }
        for system, data in result_systems.items()
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
