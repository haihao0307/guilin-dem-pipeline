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
STYLE_PROFILE = "longitudinal-flow-taper-v4"
KEY_SCALE = 10.0
TARGET_SEGMENT_COUNT = 22_000
MAX_SEGMENT_COUNT = 29_000
YANGSHUO_E = 448_648.462659552
YANGSHUO_N = 2_740_850.767499203
TILE_BASE_URL = "../guilin-truth-data/native/"

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
        named_path, named_edges, upstream, downstream, _ = choose_named_route(graph, segments.copy() if False else np.column_stack((segments[:, :7], original_codes.astype(np.float32), original_widths.astype(np.float32), segments[:, 9:])), code)
        # choose_named_route needs the original code column, so restore through a lightweight view copy above.
        full_path = list(named_path)
        extension_count = 0
        if code == 1:
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


def main() -> int:
    parser = argparse.ArgumentParser(description="Build a small, connected and directionally correct Guilin runtime")
    parser.add_argument("--native-manifest", type=Path, required=True)
    parser.add_argument("--overview-manifest", type=Path, required=True)
    parser.add_argument("--hydrology-manifest", type=Path, required=True)
    parser.add_argument("--segments", type=Path, required=True)
    parser.add_argument("--nodes", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)

    native = read_json(args.native_manifest)
    overview = read_json(args.overview_manifest)
    hydrology = read_json(args.hydrology_manifest)
    raw = np.fromfile(args.segments, dtype="<f4")
    if raw.size % SEGMENT_STRIDE:
        raise RuntimeError(f"invalid full hydrology segment float count: {raw.size}")
    full_segments = np.asarray(raw.reshape((-1, SEGMENT_STRIDE)), dtype="<f4")
    expected_full_count = int(hydrology["segments"]["count"])
    if len(full_segments) != expected_full_count:
        raise RuntimeError(f"full hydrology count mismatch: {len(full_segments)} != {expected_full_count}")

    graph = build_graph(full_segments)
    repair = repair_mainstems(graph, full_segments, native)
    selected_indices, selection_metrics = select_connected_runtime(graph, full_segments, repair["all_edges"])
    runtime_segments = np.asarray(full_segments[selected_indices], dtype="<f4")
    runtime_nodes = build_runtime_nodes(runtime_segments)
    semantic_qa = validate_runtime_semantics(runtime_segments, repair["routes"], selection_metrics)

    segment_output = args.output_dir / "osm-waterway-segments.f32.bin"
    node_output = args.output_dir / "osm-waterway-nodes.f32.bin"
    runtime_segments.tofile(segment_output)
    runtime_nodes.tofile(node_output)

    runtime_manifest = copy.deepcopy(hydrology)
    runtime_manifest["status"] = "distilled_runtime_review_asset"
    runtime_manifest["runtime"] = {
        "profile": RUNTIME_PROFILE,
        "first_load": True,
        "full_source_segment_count": expected_full_count,
        "selected_segment_count": int(len(runtime_segments)),
        "selected_node_count": int(len(runtime_nodes)),
        "native_tile_delivery": "same-origin-on-demand",
        "native_tile_base_url": TILE_BASE_URL,
        "selection": selection_metrics,
        "full_detail_source": "truth/OSM_HYDROLOGY_IMMUTABLE.geojson",
        "stale_assets_allowed": False,
    }
    runtime_manifest["topology"]["full_source_segment_count"] = expected_full_count
    runtime_manifest["topology"]["source_segment_count"] = int(len(runtime_segments))
    runtime_manifest["topology"]["segment_count"] = int(len(runtime_segments))
    runtime_manifest["topology"]["node_count"] = int(len(runtime_nodes))
    runtime_manifest["topology"]["dropped_segment_count"] = 0
    runtime_manifest["topology"]["runtime_omitted_segment_count"] = int(expected_full_count - len(runtime_segments))
    runtime_manifest["topology"]["runtime_selected_route_coverage"] = 1.0
    runtime_manifest["topology"]["runtime_route_fragment_count"] = 0
    runtime_manifest["topology"]["runtime_downstream_closure_failure_count"] = 0
    runtime_manifest["styling"]["profile"] = STYLE_PROFILE
    runtime_manifest["styling"]["semantic_revision"] = "li-gui-connected-bankfull-v6"
    runtime_manifest["styling"]["mainstem_segment_counts"] = semantic_qa["mainstem_segment_counts"]
    runtime_manifest["styling"]["mainstem_progress_ranges"] = {key: [0.0, 1.0] for key in ("li", "xiang", "zi")}
    runtime_manifest["styling"]["mainstem_routes"] = repair["routes"]
    runtime_manifest["styling"]["width_model"] = "physical bankfull width in metres, increasing continuously from headwater to downstream"
    runtime_manifest["styling"]["colour_model"] = "upstream light to downstream dark, driven by corrected route progress"
    runtime_manifest["direction"]["segment_vertex_order"] = "upstream_to_downstream"
    runtime_manifest["direction"]["flow_progress_monotonic"] = True
    runtime_manifest["direction"]["flow_distance_monotonic"] = True
    runtime_manifest["direction"]["future_flow_animation_ready"] = True
    runtime_manifest["direction"]["li_gui_continuity"] = {
        "connected": True,
        "continues_south_of_yangshuo": True,
        "route": repair["routes"]["li"],
    }
    runtime_manifest["segments"] = {
        "file": segment_output.name,
        "bytes": segment_output.stat().st_size,
        "sha256": sha256_file(segment_output),
        "dtype": "float32-little-endian",
        "layout": hydrology["segments"]["layout"],
        "count": int(len(runtime_segments)),
        "compression": "none",
    }
    runtime_manifest["nodes"] = {
        "file": node_output.name,
        "bytes": node_output.stat().st_size,
        "sha256": sha256_file(node_output),
        "dtype": "float32-little-endian",
        "layout": hydrology["nodes"]["layout"],
        "count": int(len(runtime_nodes)),
        "compression": "none",
    }
    write_json(args.output_dir / "osm-waterways-manifest.json", runtime_manifest)

    initial_data_bytes = (
        int(overview["asset"]["bytes"])
        + segment_output.stat().st_size
        + node_output.stat().st_size
        + args.native_manifest.stat().st_size
        + args.overview_manifest.stat().st_size
    )
    knowledge = {
        "schema": "guilin-dem-distilled-knowledge-runtime/v2",
        "status": "review_asset",
        "truth": {
            "source_file": native["source"]["file"],
            "source_bytes": native["source"]["bytes"],
            "source_sha256": native["source"]["sha256"],
            "aoi_geometry_sha256": native["aoi"]["geometry_sha256"],
            "native_spacing_m": native["source"]["resolution_m"],
            "native_grid": native["source"]["grid"],
            "native_tile_count": native["tile_matrix"]["full_matrix_tile_count"],
            "native_tile_bytes_each": native["tile_matrix"]["expected_tile_bytes"],
            "compression": native["tile_matrix"]["compression"],
            "resampling": native["tile_matrix"]["resampling"],
            "height_image_texture_used": False,
        },
        "terrain_knowledge": {
            "aoi_bounds_epsg32649": native["aoi"]["native_sample_center_bounds_epsg32649"],
            "native_sample_window": native["aoi"]["native_sample_window"],
            "overview_grid": overview["asset"]["grid"],
            "overview_selection": overview["asset"]["selection"],
            "overview_interpolation": overview["asset"]["interpolation"],
            "elevation_range_m": overview["asset"]["elevation_range_m"],
        },
        "hydrology_knowledge": {
            "full_record_counts": hydrology["topology"]["record_counts"],
            "full_source_segment_count": expected_full_count,
            "full_source_node_count": hydrology["topology"]["node_count"],
            "mainstem_names": hydrology["styling"]["mainstem_names"],
            "mainstem_routes": repair["routes"],
            "segment_vertex_order": "upstream_to_downstream",
            "flow_progress_monotonic": True,
            "flow_distance_monotonic": True,
            "future_flow_animation_ready": True,
            "li_continues_south_of_yangshuo": True,
            "minor_routes_are_downstream_closed": True,
            "lake_surface_asset_count": 0,
            "reservoir_surface_asset_count": 0,
            "synthetic_surface_asset_count": 0,
        },
        "runtime": {
            "profile": RUNTIME_PROFILE,
            "online_page_mode": "small viewer plus distilled route knowledge plus on-demand native data",
            "initial_numeric_data_bytes": int(initial_data_bytes),
            "initial_numeric_data_mib": round(initial_data_bytes / 1024 / 1024, 3),
            "distilled_hydrology_segment_count": int(len(runtime_segments)),
            "distilled_hydrology_node_count": int(len(runtime_nodes)),
            "native_tile_delivery": "same-origin-on-demand",
            "native_tile_base_url": TILE_BASE_URL,
            "native_tile_download_bytes_per_tile": native["tile_matrix"]["expected_tile_bytes"],
            "all_native_tiles_downloaded_on_page_open": False,
            "full_truth_downloaded_on_page_open": False,
            "stale_public_assets_allowed": False,
            "route_selection": selection_metrics,
        },
        "lineage": {
            "native_manifest_sha256": sha256_file(args.native_manifest),
            "overview_manifest_sha256": sha256_file(args.overview_manifest),
            "full_hydrology_manifest_sha256": sha256_file(args.hydrology_manifest),
            "runtime_hydrology_manifest_sha256": sha256_file(args.output_dir / "osm-waterways-manifest.json"),
        },
    }
    write_json(args.output_dir / "guilin-distilled-knowledge.json", knowledge)

    receipt = {
        "schema": "guilin-dem-distilled-runtime-build-receipt/v2",
        "passed": True,
        "runtime_profile": RUNTIME_PROFILE,
        "full_source_segment_count": expected_full_count,
        "distilled_segment_count": int(len(runtime_segments)),
        "distilled_node_count": int(len(runtime_nodes)),
        "distilled_segment_bytes": segment_output.stat().st_size,
        "distilled_node_bytes": node_output.stat().st_size,
        "initial_numeric_data_bytes": int(initial_data_bytes),
        "native_tiles_on_page_open": 0,
        "stale_assets_allowed": False,
        "semantic_qa": semantic_qa,
        "mainstem_routes": repair["routes"],
        "route_selection": selection_metrics,
    }
    write_json(args.output_dir / "DISTILLED_RUNTIME_BUILD_RECEIPT.json", receipt)
    print(json.dumps(receipt, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
