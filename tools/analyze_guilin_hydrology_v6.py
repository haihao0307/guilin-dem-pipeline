from __future__ import annotations

import json
import math
from collections import Counter, defaultdict, deque
from pathlib import Path

from pyproj import Transformer

SOURCE = Path("truth/OSM_HYDROLOGY_IMMUTABLE.geojson")
OUTPUT = Path("out/guilin-hydrology-v6-analysis.json")
YANGSHUO_N = 2_740_850.767499203
AOI_BOUNDS = [380_331.8, 2_705_928.1, 530_128.2, 2_926_987.2]
NAME_KEYS = ("name", "name:zh", "name:zh-Hans", "name:en", "alt_name", "official_name", "short_name")


def norm(value: object) -> str:
    return "".join(str(value or "").lower().split()).replace("·", "")


def iter_lines(geometry: dict | None):
    if not geometry:
        return
    kind = geometry.get("type")
    coordinates = geometry.get("coordinates") or []
    if kind == "LineString":
        yield coordinates
    elif kind == "MultiLineString":
        yield from coordinates


def key(e: float, n: float) -> tuple[int, int]:
    return round(e * 10), round(n * 10)


def feature_names(properties: dict) -> list[str]:
    values = []
    for field in NAME_KEYS:
        value = properties.get(field)
        if value not in (None, ""):
            values.append(str(value))
    return values


def main() -> int:
    payload = json.loads(SOURCE.read_text(encoding="utf-8"))
    transformer = Transformer.from_crs("EPSG:4326", "EPSG:32649", always_xy=True)
    features = payload.get("features", [])
    property_keys = Counter()
    name_counts = Counter()
    system_counts = Counter()
    waterway_counts = Counter()
    width_values = Counter()
    nodes: dict[tuple[int, int], tuple[float, float]] = {}
    adjacency: dict[tuple[int, int], list[tuple[tuple[int, int], int, int]]] = defaultdict(list)
    segments: list[dict] = []
    feature_meta: list[dict] = []

    for feature_index, feature in enumerate(features):
        props = feature.get("properties") or {}
        property_keys.update(props.keys())
        names = feature_names(props)
        for name in names:
            name_counts[name] += 1
        system_counts[str(props.get("system") or "")] += 1
        waterway_counts[str(props.get("waterway") or "")] += 1
        width_values[str(props.get("base_width_m"))] += 1
        segment_ids = []
        e_values: list[float] = []
        n_values: list[float] = []
        for line_index, line in enumerate(iter_lines(feature.get("geometry")) or []):
            if len(line) < 2:
                continue
            projected = [transformer.transform(float(point[0]), float(point[1])) for point in line]
            for e, n in projected:
                e_values.append(e)
                n_values.append(n)
            for point_index in range(len(projected) - 1):
                a = projected[point_index]
                b = projected[point_index + 1]
                ka, kb = key(*a), key(*b)
                nodes.setdefault(ka, a)
                nodes.setdefault(kb, b)
                length = math.hypot(b[0] - a[0], b[1] - a[1])
                segment_id = len(segments)
                segments.append({
                    "feature_index": feature_index,
                    "line_index": line_index,
                    "point_index": point_index,
                    "a": ka,
                    "b": kb,
                    "length_m": length,
                })
                adjacency[ka].append((kb, segment_id, feature_index))
                adjacency[kb].append((ka, segment_id, feature_index))
                segment_ids.append(segment_id)
        feature_meta.append({
            "feature_index": feature_index,
            "id": feature.get("id"),
            "osm_id": props.get("osm_id") or props.get("id") or props.get("@id"),
            "names": names,
            "name_norms": [norm(name) for name in names],
            "waterway": props.get("waterway"),
            "system": props.get("system"),
            "base_width_m": props.get("base_width_m"),
            "all_properties": props,
            "segment_ids": segment_ids,
            "bounds_epsg32649": [min(e_values), min(n_values), max(e_values), max(n_values)] if e_values else None,
        })

    component_id: dict[tuple[int, int], int] = {}
    components: list[list[tuple[int, int]]] = []
    for start in nodes:
        if start in component_id:
            continue
        cid = len(components)
        queue = deque([start])
        component_id[start] = cid
        members = []
        while queue:
            current = queue.popleft()
            members.append(current)
            for neighbor, _, _ in adjacency[current]:
                if neighbor not in component_id:
                    component_id[neighbor] = cid
                    queue.append(neighbor)
        components.append(members)

    li_seed_features = []
    gui_named_features = []
    for meta in feature_meta:
        joined = "|".join(meta["name_norms"])
        if any(token in joined for token in ("漓江", "lijiang", "liriver")):
            li_seed_features.append(meta["feature_index"])
        if any(token in joined for token in ("桂江", "guijiang", "guiriver")):
            gui_named_features.append(meta["feature_index"])

    li_components = set()
    for feature_index in li_seed_features:
        for segment_id in feature_meta[feature_index]["segment_ids"]:
            li_components.add(component_id[segments[segment_id]["a"]])

    component_feature_ids: dict[int, set[int]] = defaultdict(set)
    component_segment_ids: dict[int, list[int]] = defaultdict(list)
    for segment_id, segment in enumerate(segments):
        cid = component_id[segment["a"]]
        component_feature_ids[cid].add(segment["feature_index"])
        component_segment_ids[cid].append(segment_id)

    li_component_reports = []
    for cid in sorted(li_components):
        members = components[cid]
        coordinates = [nodes[item] for item in members]
        feature_ids = sorted(component_feature_ids[cid])
        metas = [feature_meta[index] for index in feature_ids]
        named = []
        for meta in metas:
            if meta["names"]:
                named.append({
                    "feature_index": meta["feature_index"],
                    "id": meta["id"],
                    "osm_id": meta["osm_id"],
                    "names": meta["names"],
                    "waterway": meta["waterway"],
                    "system": meta["system"],
                    "base_width_m": meta["base_width_m"],
                    "bounds_epsg32649": meta["bounds_epsg32649"],
                })
        south_segments = []
        for segment_id in component_segment_ids[cid]:
            segment = segments[segment_id]
            a = nodes[segment["a"]]
            b = nodes[segment["b"]]
            if min(a[1], b[1]) < YANGSHUO_N:
                meta = feature_meta[segment["feature_index"]]
                south_segments.append({
                    "segment_id": segment_id,
                    "feature_index": meta["feature_index"],
                    "names": meta["names"],
                    "waterway": meta["waterway"],
                    "system": meta["system"],
                    "base_width_m": meta["base_width_m"],
                    "a": a,
                    "b": b,
                })
        south_segments.sort(key=lambda item: min(item["a"][1], item["b"][1]))
        li_component_reports.append({
            "component_id": cid,
            "node_count": len(members),
            "segment_count": len(component_segment_ids[cid]),
            "feature_count": len(feature_ids),
            "bounds_epsg32649": [
                min(point[0] for point in coordinates),
                min(point[1] for point in coordinates),
                max(point[0] for point in coordinates),
                max(point[1] for point in coordinates),
            ],
            "touches_aoi_boundary": any(
                abs(e - AOI_BOUNDS[0]) < 25 or abs(e - AOI_BOUNDS[2]) < 25 or
                abs(n - AOI_BOUNDS[1]) < 25 or abs(n - AOI_BOUNDS[3]) < 25
                for e, n in coordinates
            ),
            "named_features": named,
            "south_of_yangshuo_segment_count": len(south_segments),
            "southmost_segments": south_segments[:60],
        })

    suspect_names = []
    for name, count in name_counts.items():
        normalized = norm(name)
        if any(token in normalized for token in ("漓", "桂江", "桂水", "li river", "liriver", "gui river", "guiriver")):
            suspect_names.append({"name": name, "count": count})

    report = {
        "schema": "guilin-hydrology-v6-source-audit/v1",
        "feature_count": len(features),
        "segment_count": len(segments),
        "node_count": len(nodes),
        "component_count": len(components),
        "property_keys": property_keys.most_common(),
        "system_counts": system_counts.most_common(),
        "waterway_counts": waterway_counts.most_common(),
        "base_width_m_counts": width_values.most_common(),
        "li_seed_feature_ids": li_seed_features,
        "gui_named_feature_ids": gui_named_features,
        "suspect_name_counts": suspect_names,
        "li_component_reports": li_component_reports,
        "all_named_features_south_of_yangshuo": [
            {
                "feature_index": meta["feature_index"],
                "names": meta["names"],
                "waterway": meta["waterway"],
                "system": meta["system"],
                "base_width_m": meta["base_width_m"],
                "bounds_epsg32649": meta["bounds_epsg32649"],
            }
            for meta in feature_meta
            if meta["names"] and meta["bounds_epsg32649"] and meta["bounds_epsg32649"][1] < YANGSHUO_N
        ],
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "feature_count": report["feature_count"],
        "segment_count": report["segment_count"],
        "li_seed_feature_ids": li_seed_features,
        "gui_named_feature_ids": gui_named_features,
        "li_component_count": len(li_component_reports),
        "li_component_bounds": [item["bounds_epsg32649"] for item in li_component_reports],
        "south_of_yangshuo": [item["south_of_yangshuo_segment_count"] for item in li_component_reports],
    }, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
