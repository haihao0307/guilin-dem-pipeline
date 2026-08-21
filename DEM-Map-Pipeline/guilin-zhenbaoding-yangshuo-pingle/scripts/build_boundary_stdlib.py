from __future__ import annotations

import argparse
import json
import math
import sys
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any, Iterable

from common import read_json, utc_now, write_json

USER_AGENT = "Haihao-DEM-Pipeline/1.0 (+OpenStreetMap boundary resolution)"


def request_bytes(url: str, data: bytes | None = None, timeout: int = 360) -> bytes:
    headers = {"User-Agent": USER_AGENT, "Accept": "application/json, application/xml, text/xml, */*"}
    if data is not None:
        headers["Content-Type"] = "application/x-www-form-urlencoded; charset=utf-8"
    request = urllib.request.Request(url, data=data, headers=headers)
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.read()


def fetch_overpass(endpoint: str, relation_ids: tuple[int, int]) -> dict[str, Any]:
    query = f"""
[out:json][timeout:300];
(
  relation({relation_ids[0]});
  relation({relation_ids[1]});
);
(._;>>;);
out body;
""".strip()
    body = urllib.parse.urlencode({"data": query}).encode("utf-8")
    parsed = json.loads(request_bytes(endpoint, body).decode("utf-8"))
    if not isinstance(parsed, dict) or not isinstance(parsed.get("elements"), list):
        raise RuntimeError("Overpass response does not contain elements")
    return parsed


def parse_overpass(payload: dict[str, Any]) -> tuple[dict[int, tuple[float, float]], dict[int, list[int]], dict[int, list[dict[str, Any]]]]:
    nodes: dict[int, tuple[float, float]] = {}
    ways: dict[int, list[int]] = {}
    relations: dict[int, list[dict[str, Any]]] = {}
    for element in payload.get("elements", []):
        kind = element.get("type")
        element_id = int(element.get("id"))
        if kind == "node":
            nodes[element_id] = (float(element["lon"]), float(element["lat"]))
        elif kind == "way":
            ways[element_id] = [int(item) for item in element.get("nodes", [])]
        elif kind == "relation":
            relations[element_id] = list(element.get("members", []))
    return nodes, ways, relations


def parse_osm_xml(payload: bytes) -> tuple[dict[int, tuple[float, float]], dict[int, list[int]], dict[int, list[dict[str, Any]]]]:
    root = ET.fromstring(payload)
    nodes = {
        int(node.attrib["id"]): (float(node.attrib["lon"]), float(node.attrib["lat"]))
        for node in root.findall("node")
    }
    ways = {
        int(way.attrib["id"]): [int(nd.attrib["ref"]) for nd in way.findall("nd")]
        for way in root.findall("way")
    }
    relations: dict[int, list[dict[str, Any]]] = {}
    for relation in root.findall("relation"):
        relations[int(relation.attrib["id"])] = [
            {
                "type": member.attrib.get("type"),
                "ref": int(member.attrib["ref"]),
                "role": member.attrib.get("role", ""),
            }
            for member in relation.findall("member")
        ]
    return nodes, ways, relations


def merge_models(models: Iterable[tuple[dict[int, tuple[float, float]], dict[int, list[int]], dict[int, list[dict[str, Any]]]]]) -> tuple[dict[int, tuple[float, float]], dict[int, list[int]], dict[int, list[dict[str, Any]]]]:
    nodes: dict[int, tuple[float, float]] = {}
    ways: dict[int, list[int]] = {}
    relations: dict[int, list[dict[str, Any]]] = {}
    for model_nodes, model_ways, model_relations in models:
        nodes.update(model_nodes)
        ways.update(model_ways)
        relations.update(model_relations)
    return nodes, ways, relations


def fetch_osm_model(boundary: dict[str, Any]) -> tuple[dict[int, tuple[float, float]], dict[int, list[int]], dict[int, list[dict[str, Any]]], dict[str, Any]]:
    relation_ids = (int(boundary["yangshuoRelationId"]), int(boundary["pingleRelationId"]))
    errors: list[str] = []
    for endpoint in boundary.get("overpassEndpoints", []):
        try:
            print(f"读取行政边界：{endpoint}")
            model = parse_overpass(fetch_overpass(endpoint, relation_ids))
            if all(relation_id in model[2] for relation_id in relation_ids):
                return (*model, {"method": "overpass_json", "endpoint": endpoint, "relationIds": list(relation_ids), "retrievedAt": utc_now()})
        except Exception as exc:
            errors.append(f"{endpoint}: {exc}")
            print(f"边界端点失败，继续回退：{exc}")
            time.sleep(1.5)

    template = str(boundary["osmApiTemplate"])
    try:
        models = []
        for relation_id in relation_ids:
            url = template.format(relation_id=relation_id)
            print(f"使用 OSM API 回退：{url}")
            models.append(parse_osm_xml(request_bytes(url)))
        model = merge_models(models)
        if all(relation_id in model[2] for relation_id in relation_ids):
            return (*model, {"method": "osm_api_xml", "endpoint": template, "relationIds": list(relation_ids), "retrievedAt": utc_now(), "previousErrors": errors})
    except Exception as exc:
        errors.append(f"OSM API: {exc}")
    raise RuntimeError("无法读取阳朔县与平乐县边界。\n" + "\n".join(errors))


def relation_outer_way_ids(relation_id: int, relations: dict[int, list[dict[str, Any]]]) -> list[int]:
    result = []
    for member in relations.get(relation_id, []):
        if member.get("type") == "way" and str(member.get("role") or "") in ("outer", ""):
            result.append(int(member["ref"]))
    if not result:
        raise RuntimeError(f"OSM relation has no outer ways: {relation_id}")
    return result




def common_edge_segments(
    first_way_ids: list[int],
    second_way_ids: list[int],
    ways: dict[int, list[int]],
    nodes: dict[int, tuple[float, float]],
) -> list[list[tuple[float, float]]]:
    def edge_set(way_ids: list[int]) -> set[tuple[int, int]]:
        result: set[tuple[int, int]] = set()
        for way_id in way_ids:
            node_ids = ways.get(way_id, [])
            for a, b in zip(node_ids, node_ids[1:]):
                if a != b:
                    result.add((a, b) if a < b else (b, a))
        return result

    common = edge_set(first_way_ids) & edge_set(second_way_ids)
    if not common:
        return []
    adjacency: dict[int, set[int]] = {}
    for a, b in common:
        adjacency.setdefault(a, set()).add(b)
        adjacency.setdefault(b, set()).add(a)

    unused = set(common)
    node_chains: list[list[int]] = []

    def edge_key(a: int, b: int) -> tuple[int, int]:
        return (a, b) if a < b else (b, a)

    while unused:
        nodes_in_unused = {value for edge in unused for value in edge}
        endpoints = [node_id for node_id in nodes_in_unused if sum(edge_key(node_id, other) in unused for other in adjacency.get(node_id, ())) == 1]
        start = min(endpoints) if endpoints else min(nodes_in_unused)
        chain = [start]
        previous: int | None = None
        current = start
        while True:
            candidates = [
                other
                for other in adjacency.get(current, ())
                if edge_key(current, other) in unused and other != previous
            ]
            if not candidates:
                break
            next_node = min(candidates)
            unused.remove(edge_key(current, next_node))
            chain.append(next_node)
            previous, current = current, next_node
            if current == start:
                break
        if len(chain) >= 2:
            node_chains.append(chain)

    segments: list[list[tuple[float, float]]] = []
    for chain in node_chains:
        missing = [node_id for node_id in chain if node_id not in nodes]
        if missing:
            raise RuntimeError(f"Shared OSM boundary references missing nodes: {missing[:5]}")
        segments.append([nodes[node_id] for node_id in chain])
    return segments


def close(a: tuple[float, float], b: tuple[float, float], tolerance: float = 1e-8) -> bool:
    return abs(a[0] - b[0]) <= tolerance and abs(a[1] - b[1]) <= tolerance


def segment_length(coords: list[tuple[float, float]]) -> float:
    return sum(math.hypot(b[0] - a[0], b[1] - a[1]) for a, b in zip(coords, coords[1:]))


def assemble_segments(segments: list[list[tuple[float, float]]]) -> tuple[list[tuple[float, float]], int]:
    remaining = [segment[:] for segment in segments if len(segment) >= 2]
    if not remaining:
        raise RuntimeError("No shared boundary segments were found")
    chains: list[list[tuple[float, float]]] = []
    while remaining:
        chain = remaining.pop(0)
        changed = True
        while changed and remaining:
            changed = False
            for index, segment in enumerate(remaining):
                if close(chain[-1], segment[0]):
                    chain.extend(segment[1:])
                elif close(chain[-1], segment[-1]):
                    chain.extend(reversed(segment[:-1]))
                elif close(chain[0], segment[-1]):
                    chain = segment[:-1] + chain
                elif close(chain[0], segment[0]):
                    chain = list(reversed(segment[1:])) + chain
                else:
                    continue
                remaining.pop(index)
                changed = True
                break
        chains.append(chain)
    chains.sort(key=segment_length, reverse=True)
    return chains[0], len(chains)


def vincenty_direct(lon_deg: float, lat_deg: float, azimuth_deg: float, distance_m: float) -> tuple[float, float]:
    a = 6378137.0
    f = 1.0 / 298.257223563
    b = (1.0 - f) * a
    alpha1 = math.radians(azimuth_deg)
    phi1 = math.radians(lat_deg)
    lon1 = math.radians(lon_deg)
    tan_u1 = (1.0 - f) * math.tan(phi1)
    cos_u1 = 1.0 / math.sqrt(1.0 + tan_u1 * tan_u1)
    sin_u1 = tan_u1 * cos_u1
    sigma1 = math.atan2(tan_u1, math.cos(alpha1))
    sin_alpha = cos_u1 * math.sin(alpha1)
    cos_sq_alpha = 1.0 - sin_alpha * sin_alpha
    u_sq = cos_sq_alpha * (a * a - b * b) / (b * b)
    coeff_a = 1.0 + u_sq / 16384.0 * (4096.0 + u_sq * (-768.0 + u_sq * (320.0 - 175.0 * u_sq)))
    coeff_b = u_sq / 1024.0 * (256.0 + u_sq * (-128.0 + u_sq * (74.0 - 47.0 * u_sq)))
    sigma = distance_m / (b * coeff_a)
    previous = float("inf")
    while abs(sigma - previous) > 1e-12:
        cos_2_sigma_m = math.cos(2.0 * sigma1 + sigma)
        sin_sigma = math.sin(sigma)
        cos_sigma = math.cos(sigma)
        delta_sigma = coeff_b * sin_sigma * (
            cos_2_sigma_m
            + coeff_b / 4.0 * (
                cos_sigma * (-1.0 + 2.0 * cos_2_sigma_m * cos_2_sigma_m)
                - coeff_b / 6.0 * cos_2_sigma_m * (-3.0 + 4.0 * sin_sigma * sin_sigma) * (-3.0 + 4.0 * cos_2_sigma_m * cos_2_sigma_m)
            )
        )
        previous = sigma
        sigma = distance_m / (b * coeff_a) + delta_sigma
    sin_sigma = math.sin(sigma)
    cos_sigma = math.cos(sigma)
    cos_2_sigma_m = math.cos(2.0 * sigma1 + sigma)
    tmp = sin_u1 * sin_sigma - cos_u1 * cos_sigma * math.cos(alpha1)
    phi2 = math.atan2(
        sin_u1 * cos_sigma + cos_u1 * sin_sigma * math.cos(alpha1),
        (1.0 - f) * math.sqrt(sin_alpha * sin_alpha + tmp * tmp),
    )
    lam = math.atan2(sin_sigma * math.sin(alpha1), cos_u1 * cos_sigma - sin_u1 * sin_sigma * math.cos(alpha1))
    c = f / 16.0 * cos_sq_alpha * (4.0 + f * (4.0 - 3.0 * cos_sq_alpha))
    l = lam - (1.0 - c) * f * sin_alpha * (
        sigma + c * sin_sigma * (cos_2_sigma_m + c * cos_sigma * (-1.0 + 2.0 * cos_2_sigma_m * cos_2_sigma_m))
    )
    lon2 = (lon1 + l + 3.0 * math.pi) % (2.0 * math.pi) - math.pi
    return math.degrees(lon2), math.degrees(phi2)


def polygon_wkt(coords: list[tuple[float, float]]) -> str:
    return "POLYGON((" + ",".join(f"{x:.12f} {y:.12f}" for x, y in coords) + "))"


def approximate_area_km2(coords: list[tuple[float, float]]) -> float:
    mean_lat = math.radians(sum(y for _, y in coords) / len(coords))
    scale_x = 111320.0 * math.cos(mean_lat)
    scale_y = 110574.0
    projected = [(x * scale_x, y * scale_y) for x, y in coords]
    twice_area = 0.0
    for a, b in zip(projected, projected[1:]):
        twice_area += a[0] * b[1] - b[0] * a[1]
    return abs(twice_area) / 2.0 / 1_000_000.0


def run(config_path: Path, root: Path, offline_preview: bool) -> int:
    config = read_json(config_path)
    aoi = config["aoi"]
    summit = (float(aoi["summit"]["longitude"]), float(aoi["summit"]["latitude"]))
    north = vincenty_direct(summit[0], summit[1], 0.0, float(aoi["northExtensionMeters"]))
    east_anchor = vincenty_direct(summit[0], summit[1], 90.0, float(aoi["eastSafetyBufferMeters"]))
    west = float(aoi["westLongitude"])
    fallback_south = float(aoi["fallbackSouthLatitude"])
    relation_ids = (int(aoi["boundary"]["yangshuoRelationId"]), int(aoi["boundary"]["pingleRelationId"]))

    if offline_preview:
        shared = [(west + 0.35, fallback_south + 0.2), (east_anchor[0], fallback_south + 0.2)]
        source_info = {"method": "offline_provisional_line", "relationIds": list(relation_ids)}
        shared_ids: list[int] = []
        component_count = 1
        status = "provisional_offline_preview"
    else:
        nodes, ways, relations, source_info = fetch_osm_model(aoi["boundary"])
        first_ids = relation_outer_way_ids(relation_ids[0], relations)
        second_ids = relation_outer_way_ids(relation_ids[1], relations)
        first = set(first_ids)
        second = set(second_ids)
        shared_ids = sorted(first & second)
        segments: list[list[tuple[float, float]]] = []
        resolution_method = "shared_osm_way_ids"
        if shared_ids:
            for way_id in shared_ids:
                node_ids = ways.get(way_id, [])
                if len(node_ids) < 2:
                    continue
                missing = [node_id for node_id in node_ids if node_id not in nodes]
                if missing:
                    raise RuntimeError(f"Shared OSM way {way_id} references missing nodes: {missing[:5]}")
                segments.append([nodes[node_id] for node_id in node_ids])
        else:
            segments = common_edge_segments(first_ids, second_ids, ways, nodes)
            resolution_method = "shared_osm_node_edges"
        if not segments:
            raise RuntimeError("阳朔县与平乐县边界没有可验证的共用 OSM 线段，任务停止以避免估算裁切")
        shared, component_count = assemble_segments(segments)
        component_lengths = sorted((segment_length(segment) for segment in segments), reverse=True)
        if component_count > 1:
            raise RuntimeError(
                f"阳朔县与平乐县共用边界解析成 {component_count} 个不连续部分，任务停止等待边界复核"
            )
        if segment_length(shared) < 0.05:
            raise RuntimeError("阳朔县与平乐县共用边界长度异常，任务停止等待边界复核")
        status = "exact_boundary_resolved"

    if shared[0][0] > shared[-1][0]:
        shared.reverse()
    boundary_max_lon = max(x for x, _ in shared)
    east = max(east_anchor[0], boundary_max_lon + 0.005)
    west_endpoint = shared[0]
    east_endpoint = shared[-1]
    final_coords = [(west, north[1]), (east, north[1]), (east, east_endpoint[1])]
    final_coords.extend(reversed(shared))
    final_coords.extend([(west, west_endpoint[1]), (west, north[1])])

    minx = min(x for x, _ in final_coords)
    miny = min(y for _, y in final_coords)
    maxx = max(x for x, _ in final_coords)
    maxy = max(y for _, y in final_coords)
    buffer_m = float(aoi["retrievalBufferMeters"])
    mid_lat = (miny + maxy) / 2.0
    lat_buffer = buffer_m / 110574.0
    lon_buffer = buffer_m / max(111320.0 * math.cos(math.radians(mid_lat)), 1.0)
    search_coords = [
        (minx - lon_buffer, miny - lat_buffer),
        (maxx + lon_buffer, miny - lat_buffer),
        (maxx + lon_buffer, maxy + lat_buffer),
        (minx - lon_buffer, maxy + lat_buffer),
        (minx - lon_buffer, miny - lat_buffer),
    ]

    resolved = {
        "schemaVersion": "1.0.0",
        "generatedAt": utc_now(),
        "status": status,
        "project": config["project"],
        "summit": {"longitude": summit[0], "latitude": summit[1], "source": aoi["summit"]["source"]},
        "northPoint": {"longitude": north[0], "latitude": north[1], "distanceFromSummitMeters": float(aoi["northExtensionMeters"]), "azimuthDegrees": 0.0},
        "boundarySource": source_info,
        "sharedBoundaryResolution": {
            "method": "offline_provisional_line" if offline_preview else resolution_method,
            "sharedWayIds": shared_ids,
            "componentCount": component_count,
            "lengthDegrees": segment_length(shared),
        },
        "edgeConstruction": {
            "westBoundaryLongitude": west,
            "eastBoundaryLongitude": east,
            "northBoundaryLatitude": north[1],
            "sharedBoundaryBounds": [min(x for x, _ in shared), min(y for _, y in shared), max(x for x, _ in shared), max(y for _, y in shared)],
            "westHorizontalExtension": [[west, west_endpoint[1]], [west_endpoint[0], west_endpoint[1]]],
            "eastHorizontalExtension": [[east_endpoint[0], east_endpoint[1]], [east, east_endpoint[1]]],
            "southernEdgePolicy": "exact shared county boundary with horizontal extensions to the task west and east edges",
        },
        "final": {
            "wgs84Polygon": [[round(x, 12), round(y, 12)] for x, y in final_coords],
            "wkt": polygon_wkt(final_coords),
            "bounds": [minx, miny, maxx, maxy],
            "areaSquareKilometersProjected": approximate_area_km2(final_coords),
            "areaMethod": "local equirectangular approximation for task reporting only",
        },
        "search": {
            "wgs84Polygon": [[round(x, 12), round(y, 12)] for x, y in search_coords],
            "wkt": polygon_wkt(search_coords),
            "bounds": [minx - lon_buffer, miny - lat_buffer, maxx + lon_buffer, maxy + lat_buffer],
            "envelopeWkt": polygon_wkt(search_coords),
            "envelopePolygon": [[round(x, 12), round(y, 12)] for x, y in search_coords],
            "bufferMeters": buffer_m,
        },
    }
    write_json(root / config["outputs"]["resolvedAoiJson"], resolved)
    features = [
        {"type": "Feature", "properties": {"role": "final_dem_aoi", "status": status}, "geometry": {"type": "Polygon", "coordinates": [[[x, y] for x, y in final_coords]]}},
        {"type": "Feature", "properties": {"role": "download_search_envelope"}, "geometry": {"type": "Polygon", "coordinates": [[[x, y] for x, y in search_coords]]}},
        {"type": "Feature", "properties": {"role": "yangshuo_pingle_shared_boundary", "sharedWayIds": shared_ids}, "geometry": {"type": "LineString", "coordinates": [[x, y] for x, y in shared]}},
        {"type": "Feature", "properties": {"role": "zhenbao_ding_summit"}, "geometry": {"type": "Point", "coordinates": [summit[0], summit[1]]}},
        {"type": "Feature", "properties": {"role": "north_limit_15000m"}, "geometry": {"type": "Point", "coordinates": [north[0], north[1]]}},
    ]
    write_json(root / config["outputs"]["resolvedAoiGeoJson"], {"type": "FeatureCollection", "features": features})
    print(f"真宝鼎山顶：{summit[1]:.8f}, {summit[0]:.8f}")
    print(f"北界点：{north[1]:.8f}, {north[0]:.8f}")
    print(f"最终范围面积约：{resolved['final']['areaSquareKilometersProjected']:.2f} km²")
    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Resolve the DEM task boundary with Python standard library only")
    parser.add_argument("--config", required=True)
    parser.add_argument("--root", required=True)
    parser.add_argument("--offline-preview", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    config_path = Path(args.config).resolve()
    root = Path(args.root).resolve()
    try:
        return run(config_path, root, bool(args.offline_preview))
    except Exception as exc:
        if not args.offline_preview:
            try:
                config = read_json(config_path)
                cached_path = root / config["outputs"]["resolvedAoiJson"]
                cached_geojson = root / config["outputs"]["resolvedAoiGeoJson"]
                cached = read_json(cached_path)
                expected_project = config.get("project", {}).get("id")
                cached_project = cached.get("project", {}).get("id")
                if (
                    cached.get("status") == "exact_boundary_resolved"
                    and cached_project == expected_project
                    and cached_geojson.exists()
                    and cached.get("final", {}).get("wgs84Polygon")
                ):
                    print(f"边界在线刷新失败，复用已验证的精确边界缓存：{cached_path}")
                    print(f"刷新错误：{exc}")
                    return 0
            except Exception:
                pass
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
