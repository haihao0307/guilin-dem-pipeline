from __future__ import annotations

import argparse
import copy
import hashlib
import heapq
import json
import math
from collections import defaultdict, deque
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable

import numpy as np

SEGMENT_STRIDE = 13
NODE_STRIDE = 8
RUNTIME_PROFILE = "knowledge-indexed-connected-routes-v6"
STYLE_PROFILE = "network-directed-physical-width-v6"
KEY_SCALE = 10.0
TARGET_SEGMENT_COUNT = 22_000
MAX_SEGMENT_COUNT = 29_000
YANGSHUO_E = 448_648.462659552
YANGSHUO_N = 2_740_850.767499203
CANONICAL_STORE_URL = "../guilin-elevation-store-v1/"

MAINSTEMS = {
    1: {"id": "li", "name": "漓江至桂江连续主干", "downstream_axis": (0.24, 1.0)},
    2: {"id": "xiang", "name": "湘江", "downstream_axis": (0.35, -1.0)},
    3: {"id": "zi", "name": "资江", "downstream_axis": (-0.08, -1.0)},
}


def sha256_file(path: Path, chunk_size: int = 8 * 1024 * 1024) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(chunk_size), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def node_key(x: float, z: float) -> tuple[int, int]:
    return int(round(float(x) * KEY_SCALE)), int(round(float(z) * KEY_SCALE))


@dataclass
class Graph:
    edge_u: np.ndarray
    edge_v: np.ndarray
    edge_length: np.ndarray
    node_x: np.ndarray
    node_z: np.ndarray
    node_y: np.ndarray
    adjacency: list[list[int]]
    outgoing: list[list[int]]
    incoming: list[list[int]]
    key_to_node: dict[tuple[int, int], int]


def build_graph(segments: np.ndarray) -> Graph:
    key_to_node: dict[tuple[int, int], int] = {}
    node_x: list[float] = []
    node_z: list[float] = []
    node_y_sum: list[float] = []
    node_y_count: list[int] = []
    edge_u = np.empty(len(segments), dtype=np.int32)
    edge_v = np.empty(len(segments), dtype=np.int32)

    def intern(x: float, y: float, z: float) -> int:
        key = node_key(x, z)
        found = key_to_node.get(key)
        if found is None:
            found = len(node_x)
            key_to_node[key] = found
            node_x.append(float(x))
            node_z.append(float(z))
            node_y_sum.append(float(y))
            node_y_count.append(1)
        else:
            node_y_sum[found] += float(y)
            node_y_count[found] += 1
        return found

    for index, segment in enumerate(segments):
        edge_u[index] = intern(segment[0], segment[1], segment[2])
        edge_v[index] = intern(segment[3], segment[4], segment[5])

    adjacency: list[list[int]] = [[] for _ in node_x]
    outgoing: list[list[int]] = [[] for _ in node_x]
    incoming: list[list[int]] = [[] for _ in node_x]
    for index, (u, v) in enumerate(zip(edge_u, edge_v, strict=True)):
        adjacency[int(u)].append(index)
        adjacency[int(v)].append(index)
        outgoing[int(u)].append(index)
        incoming[int(v)].append(index)

    dx = segments[:, 3].astype(np.float64) - segments[:, 0].astype(np.float64)
    dz = segments[:, 5].astype(np.float64) - segments[:, 2].astype(np.float64)
    edge_length = np.hypot(dx, dz)
    edge_length[edge_length < 0.01] = 0.01
    node_y = np.asarray(node_y_sum, dtype=np.float64) / np.maximum(1, np.asarray(node_y_count, dtype=np.int32))
    return Graph(
        edge_u=edge_u,
        edge_v=edge_v,
        edge_length=edge_length,
        node_x=np.asarray(node_x, dtype=np.float64),
        node_z=np.asarray(node_z, dtype=np.float64),
        node_y=node_y,
        adjacency=adjacency,
        outgoing=outgoing,
        incoming=incoming,
        key_to_node=key_to_node,
    )


def other_node(graph: Graph, edge: int, node: int) -> int:
    u = int(graph.edge_u[edge])
    v = int(graph.edge_v[edge])
    return v if u == node else u


def edge_components(graph: Graph, allowed_edges: set[int]) -> list[set[int]]:
    remaining = set(allowed_edges)
    components: list[set[int]] = []
    while remaining:
        seed = next(iter(remaining))
        component: set[int] = set()
        queue = deque([seed])
        remaining.remove(seed)
        while queue:
            edge = queue.popleft()
            component.add(edge)
            for node in (int(graph.edge_u[edge]), int(graph.edge_v[edge])):
                for neighbor in graph.adjacency[node]:
                    if neighbor in remaining and neighbor in allowed_edges:
                        remaining.remove(neighbor)
                        queue.append(neighbor)
        components.append(component)
    return components


def dijkstra(
    graph: Graph,
    start: int,
    allowed_edges: set[int],
    segments: np.ndarray,
    axis: tuple[float, float] | None = None,
    forbidden_edges: set[int] | None = None,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    count = len(graph.node_x)
    distances = np.full(count, np.inf, dtype=np.float64)
    previous_node = np.full(count, -1, dtype=np.int32)
    previous_edge = np.full(count, -1, dtype=np.int32)
    distances[start] = 0.0
    queue: list[tuple[float, int]] = [(0.0, start)]
    forbidden = forbidden_edges or set()
    if axis is not None:
        norm = math.hypot(axis[0], axis[1]) or 1.0
        axis = (axis[0] / norm, axis[1] / norm)

    while queue:
        current_distance, node = heapq.heappop(queue)
        if current_distance != distances[node]:
            continue
        for edge in graph.adjacency[node]:
            if edge not in allowed_edges or edge in forbidden:
                continue
            neighbor = other_node(graph, edge, node)
            length = float(graph.edge_length[edge])
            width = max(2.0, float(segments[edge, 8]))
            cost = length
            if axis is not None:
                dx = graph.node_x[neighbor] - graph.node_x[node]
                dz = graph.node_z[neighbor] - graph.node_z[node]
                direction_length = math.hypot(dx, dz) or 1.0
                alignment = (dx / direction_length) * axis[0] + (dz / direction_length) * axis[1]
                cost *= 1.0 + 3.2 * max(0.0, -alignment)
                rise = graph.node_y[neighbor] - graph.node_y[node]
                if rise > 1.5:
                    cost *= 1.0 + min(8.0, rise / 12.0)
                cost /= 1.0 + min(width, 220.0) / 90.0
            candidate = current_distance + cost
            if candidate + 1e-9 < distances[neighbor]:
                distances[neighbor] = candidate
                previous_node[neighbor] = node
                previous_edge[neighbor] = edge
                heapq.heappush(queue, (candidate, neighbor))
    return distances, previous_node, previous_edge


def reconstruct_path(start: int, end: int, previous_node: np.ndarray, previous_edge: np.ndarray) -> list[tuple[int, int, int]]:
    reverse: list[tuple[int, int, int]] = []
    current = end
    seen: set[int] = set()
    while current != start:
        if current in seen:
            raise RuntimeError("cycle while reconstructing mainstem")
        seen.add(current)
        edge = int(previous_edge[current])
        parent = int(previous_node[current])
        if edge < 0 or parent < 0:
            raise RuntimeError(f"no path from node {start} to {end}")
        reverse.append((edge, parent, current))
        current = parent
    reverse.reverse()
    return reverse


def choose_named_route(
    graph: Graph,
    segments: np.ndarray,
    code: int,
) -> tuple[list[tuple[int, int, int]], set[int], int, int, float]:
    named_edges = set(int(index) for index in np.flatnonzero(np.rint(segments[:, 7]).astype(np.int32) == code))
    if not named_edges:
        raise RuntimeError(f"named mainstem code {code} is empty")
    components = edge_components(graph, named_edges)
    component = max(components, key=lambda item: sum(float(graph.edge_length[index]) for index in item))
    degree: dict[int, int] = defaultdict(int)
    for edge in component:
        degree[int(graph.edge_u[edge])] += 1
        degree[int(graph.edge_v[edge])] += 1
    terminals = [node for node, value in degree.items() if value == 1]
    if len(terminals) < 2:
        terminals = list(degree)
    if code == 1:
        upstream = min(terminals, key=lambda node: (graph.node_z[node], -graph.node_y[node]))
        downstream = max(terminals, key=lambda node: (graph.node_z[node], -graph.node_y[node]))
    else:
        upstream = max(terminals, key=lambda node: (graph.node_z[node], graph.node_y[node]))
        downstream = min(terminals, key=lambda node: (graph.node_z[node], graph.node_y[node]))
    distances, previous_node, previous_edge = dijkstra(graph, upstream, component, segments)
    if not math.isfinite(float(distances[downstream])):
        raise RuntimeError(f"named mainstem code {code} has no continuous trunk")
    path = reconstruct_path(upstream, downstream, previous_node, previous_edge)
    route_length = sum(float(graph.edge_length[edge]) for edge, _, _ in path)
    return path, named_edges, upstream, downstream, route_length


def extend_li_downstream(
    graph: Graph,
    segments: np.ndarray,
    native: dict[str, Any],
    seed: int,
    named_path_edges: set[int],
) -> list[tuple[int, int, int]]:
    river_edges = set(int(index) for index in np.flatnonzero(segments[:, 6] < 0.5))
    foreign_mainstems = set(
        int(index)
        for index in np.flatnonzero(np.isin(np.rint(segments[:, 7]).astype(np.int32), np.asarray([2, 3], dtype=np.int32)))
    )
    allowed = river_edges - foreign_mainstems
    distances, previous_node, previous_edge = dijkstra(
        graph,
        seed,
        allowed,
        segments,
        axis=MAINSTEMS[1]["downstream_axis"],
        forbidden_edges=named_path_edges,
    )
    west, south, east, north = [float(value) for value in native["aoi"]["native_sample_center_bounds_epsg32649"]]
    center_e = (west + east) * 0.5
    center_n = (south + north) * 0.5
    half_x = (east - west) * 0.5
    half_z = (north - south) * 0.5
    yangshuo_z = center_n - YANGSHUO_N
    candidates: list[int] = []
    fallback: list[int] = []
    for node, distance in enumerate(distances):
        if not math.isfinite(float(distance)) or node == seed:
            continue
        x = graph.node_x[node]
        z = graph.node_z[node]
        absolute_n = center_n - z
        river_degree = sum(1 for edge in graph.adjacency[node] if edge in allowed)
        if z > yangshuo_z + 8_000.0 and river_degree <= 2:
            fallback.append(node)
        near_south = z >= half_z - 1_800.0
        near_east = x >= half_x - 1_800.0 and z > yangshuo_z + 8_000.0
        if absolute_n < YANGSHUO_N - 8_000.0 and (near_south or near_east):
            candidates.append(node)
    pool = candidates or fallback
    if not pool:
        raise RuntimeError("Li to Gui downstream continuation cannot reach a valid outlet south of Yangshuo")

    def outlet_score(node: int) -> float:
        x_normalized = (graph.node_x[node] + half_x) / max(1.0, half_x * 2.0)
        z_normalized = (graph.node_z[node] + half_z) / max(1.0, half_z * 2.0)
        elevation_penalty = max(0.0, graph.node_y[node]) / 5_000.0
        distance_bonus = math.log1p(float(distances[node])) / 20.0
        return 2.6 * z_normalized + 0.32 * x_normalized + 0.25 * distance_bonus - 0.20 * elevation_penalty

    outlet = max(pool, key=outlet_score)
    path = reconstruct_path(seed, outlet, previous_node, previous_edge)
    absolute_outlet_n = center_n - graph.node_z[outlet]
    if absolute_outlet_n >= YANGSHUO_N - 8_000.0:
        raise RuntimeError(f"Li outlet is not south of Yangshuo: {absolute_outlet_n}")
    if not path:
        raise RuntimeError("Li downstream continuation is empty")
    return path


def orient_and_parameterize_route(
    graph: Graph,
    segments: np.ndarray,
    path: list[tuple[int, int, int]],
    code: int,
    downstream_width: float,
) -> dict[str, Any]:
    lengths = np.asarray([float(graph.edge_length[edge]) for edge, _, _ in path], dtype=np.float64)
    total = float(lengths.sum())
    if total <= 0.0:
        raise RuntimeError(f"mainstem {code} has zero length")
    cumulative = 0.0
    head_width = max(3.0, min(12.0, downstream_width * 0.06))
    for (edge, from_node, to_node), length in zip(path, lengths, strict=True):
        current_u = int(graph.edge_u[edge])
        current_v = int(graph.edge_v[edge])
        if current_u == to_node and current_v == from_node:
            start = segments[edge, 0:3].copy()
            segments[edge, 0:3] = segments[edge, 3:6]
            segments[edge, 3:6] = start
            graph.edge_u[edge], graph.edge_v[edge] = graph.edge_v[edge], graph.edge_u[edge]
        elif current_u != from_node or current_v != to_node:
            raise RuntimeError(f"route edge {edge} does not match its node sequence")
        start_progress = cumulative / total
        end_progress = (cumulative + float(length)) / total
        midpoint = (start_progress + end_progress) * 0.5
        width = head_width + (downstream_width - head_width) * math.pow(max(0.0, min(1.0, midpoint)), 1.35)
        segments[edge, 7] = float(code)
        segments[edge, 8] = float(width)
        segments[edge, 9] = float(start_progress)
        segments[edge, 10] = float(end_progress)
        segments[edge, 11] = float(cumulative)
        segments[edge, 12] = float(cumulative + float(length))
        cumulative += float(length)
    first_node = path[0][1]
    last_node = path[-1][2]
    return {
        "id": MAINSTEMS[code]["id"],
        "name": MAINSTEMS[code]["name"],
        "segment_count": len(path),
        "length_m": total,
        "upstream_node_world": [float(graph.node_x[first_node]), float(graph.node_z[first_node])],
        "downstream_node_world": [float(graph.node_x[last_node]), float(graph.node_z[last_node])],
        "headwater_width_m": head_width,
        "downstream_bankfull_width_m": downstream_width,
        "progress_min": 0.0,
        "progress_max": 1.0,
    }


def repair_mainstems(graph: Graph, segments: np.ndarray, native: dict[str, Any]) -> dict[str, Any]:
    original_codes = np.rint(segments[:, 7]).astype(np.int32)
    original_widths = segments[:, 8].astype(np.float64).copy()
    original_named = {code: set(int(i) for i in np.flatnonzero(original_codes == code)) for code in MAINSTEMS}
    for code in MAINSTEMS:
        segments[np.asarray(sorted(original_named[code]), dtype=np.int64), 7] = 0.0

    route_reports: dict[str, Any] = {}
    route_edge_sets: dict[int, set[int]] = {}
    for code in (1, 2, 3):
        named_path, named_edges, upstream, downstream, _ = choose_named_route(graph, np.column_stack((segments[:, :7], original_codes.astype(np.float32), original_widths.astype(np.float32), segments[:, 9:])), code)
        # choose_named_route needs the original code column, so restore through a lightweight view copy above.
        full_path = list(named_path)
        extension_count = 0
        if code == 1:
            # The upstream builder can already include the Gui River to the AOI
            # boundary. Extending it again has no valid outside-AOI destination.
            west, south, east, north = map(float, native["aoi"]["native_sample_center_bounds_epsg32649"])
            end_northing = (south + north) * 0.5 - float(graph.node_z[downstream])
            already_at_south_boundary = end_northing <= south + 25.0
            if not already_at_south_boundary:
                extension = extend_li_downstream(graph, np.column_stack((segments[:, :7], original_codes.astype(np.float32), original_widths.astype(np.float32), segments[:, 9:])), native, downstream, set(edge for edge, _, _ in named_path))
                existing = set(edge for edge, _, _ in full_path)
                extension = [record for record in extension if record[0] not in existing]
                full_path.extend(extension)
                extension_count = len(extension)
        downstream_width = float(max(original_widths[list(named_edges)]))
        report = orient_and_parameterize_route(graph, segments, full_path, code, downstream_width)
        report["named_source_segment_count"] = len(named_edges)
        report["downstream_extension_segment_count"] = extension_count
        if code == 1:
            west, south, east, north = [float(value) for value in native["aoi"]["native_sample_center_bounds_epsg32649"]]
            center_n = (south + north) * 0.5
            downstream_z = report["downstream_node_world"][1]
            report["downstream_northing_epsg32649"] = center_n - downstream_z
            report["continues_south_of_yangshuo"] = report["downstream_northing_epsg32649"] < YANGSHUO_N - 8_000.0
            if not report["continues_south_of_yangshuo"]:
                raise RuntimeError("Li to Gui mainstem still stops at or north of Yangshuo")
        route_reports[MAINSTEMS[code]["id"]] = report
        route_edge_sets[code] = set(edge for edge, _, _ in full_path)

    all_main_edges = set().union(*route_edge_sets.values())
    if len(all_main_edges) != sum(len(value) for value in route_edge_sets.values()):
        raise RuntimeError("named mainstem routes overlap unexpectedly")
    return {"routes": route_reports, "edge_sets": route_edge_sets, "all_edges": all_main_edges}


def rebuild_directed_lists(graph: Graph, segments: np.ndarray) -> None:
    graph.outgoing = [[] for _ in graph.node_x]
    graph.incoming = [[] for _ in graph.node_x]
    for edge in range(len(segments)):
        start_key = node_key(segments[edge, 0], segments[edge, 2])
        end_key = node_key(segments[edge, 3], segments[edge, 5])
        u = graph.key_to_node[start_key]
        v = graph.key_to_node[end_key]
        graph.edge_u[edge] = u
        graph.edge_v[edge] = v
        graph.outgoing[u].append(edge)
        graph.incoming[v].append(edge)


def trace_route(graph: Graph, segments: np.ndarray, seed_edge: int, main_edges: set[int]) -> tuple[list[int], bool]:
    route: list[int] = []
    visited_edges: set[int] = set()
    edge = seed_edge
    for _ in range(20_000):
        if edge in main_edges:
            return route, True
        if edge in visited_edges:
            return route, False
        visited_edges.add(edge)
        route.append(edge)
        node = int(graph.edge_v[edge])
        outgoing = [candidate for candidate in graph.outgoing[node] if candidate not in visited_edges]
        if not outgoing:
            return route, True
        main_candidates = [candidate for candidate in outgoing if candidate in main_edges]
        if main_candidates:
            return route, True
        current_class = int(round(float(segments[edge, 6])))
        same_class = [candidate for candidate in outgoing if int(round(float(segments[candidate, 6]))) == current_class]
        candidates = same_class or outgoing
        edge = max(
            candidates,
            key=lambda candidate: (
                float(segments[candidate, 8]),
                float(segments[candidate, 10]),
                float(graph.edge_length[candidate]),
            ),
        )
    return route, False


def route_priority(graph: Graph, segments: np.ndarray, route: list[int]) -> float:
    if not route:
        return -math.inf
    classes = segments[np.asarray(route), 6]
    class_value = int(round(float(np.median(classes))))
    class_weight = {0: 5.0, 1: 2.0, 2: 1.4}.get(class_value, 1.0)
    max_width = float(np.max(segments[np.asarray(route), 8]))
    max_progress = float(np.max(segments[np.asarray(route), 10]))
    length = float(np.sum(graph.edge_length[np.asarray(route)]))
    return class_weight + 1.75 * math.log1p(max_width) + 0.42 * math.log1p(length) + 1.5 * max_progress


def select_connected_runtime(graph: Graph, segments: np.ndarray, main_edges: set[int]) -> tuple[np.ndarray, dict[str, Any]]:
    rebuild_directed_lists(graph, segments)
    selected: set[int] = set(main_edges)
    source_nodes = [node for node in range(len(graph.node_x)) if not graph.incoming[node] and graph.outgoing[node]]
    candidates: list[tuple[float, int, int, list[int]]] = []
    x_min, x_max = float(graph.node_x.min()), float(graph.node_x.max())
    z_min, z_max = float(graph.node_z.min()), float(graph.node_z.max())
    for node in source_nodes:
        for seed in graph.outgoing[node]:
            if seed in main_edges:
                continue
            route, closed = trace_route(graph, segments, seed, main_edges)
            if not route or not closed:
                continue
            score = route_priority(graph, segments, route)
            x = float(graph.node_x[node])
            z = float(graph.node_z[node])
            gx = max(0, min(7, int((x - x_min) / max(1.0, x_max - x_min) * 8.0)))
            gz = max(0, min(9, int((z - z_min) / max(1.0, z_max - z_min) * 10.0)))
            spatial = gz * 8 + gx
            class_value = int(round(float(segments[seed, 6])))
            candidates.append((score, spatial, class_value, route))

    best_by_cell_class: dict[tuple[int, int], tuple[float, list[int]]] = {}
    for score, spatial, class_value, route in candidates:
        key = (spatial, class_value)
        current = best_by_cell_class.get(key)
        if current is None or score > current[0]:
            best_by_cell_class[key] = (score, route)

    selected_route_count = 0
    for score, route in sorted(best_by_cell_class.values(), key=lambda item: item[0], reverse=True):
        additions = [edge for edge in route if edge not in selected]
        if additions and len(selected) + len(additions) <= TARGET_SEGMENT_COUNT:
            selected.update(additions)
            selected_route_count += 1

    for score, _, _, route in sorted(candidates, key=lambda item: item[0], reverse=True):
        if len(selected) >= TARGET_SEGMENT_COUNT:
            break
        additions = [edge for edge in route if edge not in selected]
        if not additions:
            continue
        if len(selected) + len(additions) > MAX_SEGMENT_COUNT:
            continue
        selected.update(additions)
        selected_route_count += 1

    selected_indices = np.asarray(sorted(selected), dtype=np.int64)
    if len(selected_indices) < 6_000 or len(selected_indices) > MAX_SEGMENT_COUNT:
        raise RuntimeError(f"connected runtime size outside bounds: {len(selected_indices)}")

    selected_set = set(int(value) for value in selected_indices)
    downstream_failures = 0
    internal_cut_nodes = 0
    for edge in selected_indices:
        node = int(graph.edge_v[int(edge)])
        if int(edge) in main_edges:
            continue
        full_out = graph.outgoing[node]
        selected_out = [candidate for candidate in full_out if candidate in selected_set or candidate in main_edges]
        if full_out and not selected_out:
            downstream_failures += 1
    selected_degree: dict[int, int] = defaultdict(int)
    for edge in selected_indices:
        selected_degree[int(graph.edge_u[int(edge)])] += 1
        selected_degree[int(graph.edge_v[int(edge)])] += 1
    for node, degree in selected_degree.items():
        if degree == 1 and graph.incoming[node] and graph.outgoing[node]:
            incident_selected = [edge for edge in graph.adjacency[node] if edge in selected_set]
            if incident_selected and not any(edge in main_edges for edge in incident_selected):
                internal_cut_nodes += 1
    if downstream_failures:
        raise RuntimeError(f"runtime route downstream closure failures: {downstream_failures}")

    metrics = {
        "selected_route_count": selected_route_count,
        "source_route_candidate_count": len(candidates),
        "selected_segment_count": int(len(selected_indices)),
        "runtime_omitted_segment_count": int(len(segments) - len(selected_indices)),
        "downstream_closure_failure_count": downstream_failures,
        "internal_degree_one_node_count": internal_cut_nodes,
        "selection_policy": "complete source-to-outlet or source-to-mainstem routes, with downstream closure",
        "segment_level_random_sampling": False,
        "mid_chain_segment_cutting": False,
    }
    return selected_indices, metrics


def build_runtime_nodes(segments: np.ndarray) -> np.ndarray:
    records: dict[tuple[int, int], list[float]] = {}
    degrees: dict[tuple[int, int], int] = defaultdict(int)
    for segment in segments:
        endpoints = (
            (segment[0], segment[1], segment[2], segment[9]),
            (segment[3], segment[4], segment[5], segment[10]),
        )
        for x, y, z, progress in endpoints:
            key = node_key(x, z)
            degrees[key] += 1
            candidate = [
                float(x),
                float(y),
                float(z),
                float(segment[6]),
                float(segment[7]),
                float(segment[8]),
                float(progress),
                0.0,
            ]
            previous = records.get(key)
            if previous is None or candidate[4] > previous[4] or (candidate[4] == previous[4] and candidate[6] > previous[6]):
                records[key] = candidate
    output: list[list[float]] = []
    for key in sorted(records):
        record = records[key]
        record[7] = float(degrees[key])
        output.append(record)
    return np.asarray(output, dtype="<f4")


def validate_runtime_semantics(
    runtime_segments: np.ndarray,
    route_report: dict[str, Any],
    selection_metrics: dict[str, Any],
) -> dict[str, Any]:
    inversions = int(np.count_nonzero(runtime_segments[:, 9] > runtime_segments[:, 10] + 1e-6))
    distance_inversions = int(np.count_nonzero(runtime_segments[:, 11] > runtime_segments[:, 12] + 1e-4))
    mainstem_counts = {
        "li": int(np.count_nonzero(np.rint(runtime_segments[:, 7]).astype(np.int32) == 1)),
        "xiang": int(np.count_nonzero(np.rint(runtime_segments[:, 7]).astype(np.int32) == 2)),
        "zi": int(np.count_nonzero(np.rint(runtime_segments[:, 7]).astype(np.int32) == 3)),
    }
    if inversions or distance_inversions:
        raise RuntimeError(f"runtime direction inversions: progress={inversions}, distance={distance_inversions}")
    if any(value <= 0 for value in mainstem_counts.values()):
        raise RuntimeError(f"runtime lost named mainstem: {mainstem_counts}")
    if not route_report["li"]["continues_south_of_yangshuo"]:
        raise RuntimeError("Li route does not continue downstream beyond Yangshuo")
    if selection_metrics["downstream_closure_failure_count"] != 0:
        raise RuntimeError("minor waterway downstream closure failed")
    return {
        "passed": True,
        "flow_progress_inversion_count": inversions,
        "flow_distance_inversion_count": distance_inversions,
        "mainstem_segment_counts": mainstem_counts,
        "li_continues_south_of_yangshuo": True,
        "minor_route_downstream_closure_failure_count": 0,
        "segment_level_random_sampling": False,
    }

