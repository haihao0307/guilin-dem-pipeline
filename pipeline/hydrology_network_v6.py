from __future__ import annotations

import heapq
import math
from collections import defaultdict, deque
from typing import Any, Iterable

import numpy as np

YANGSHUO_NORTHING_M = 2_740_850.767499203
BOUNDARY_TOLERANCE_M = 25.0


def _edge_length(segment: dict[str, Any]) -> float:
    start = segment["start"]
    end = segment["end"]
    return max(0.01, float(math.hypot(end[0] - start[0], end[1] - start[1])))


def _boundary_node(node: tuple[float, float], bounds: tuple[float, float, float, float]) -> bool:
    west, south, east, north = bounds
    easting, northing = node
    return (
        abs(easting - west) <= BOUNDARY_TOLERANCE_M or
        abs(easting - east) <= BOUNDARY_TOLERANCE_M or
        abs(northing - south) <= BOUNDARY_TOLERANCE_M or
        abs(northing - north) <= BOUNDARY_TOLERANCE_M
    )


def _subgraph_components(
    edge_indices: Iterable[int],
    raw_segments: list[dict[str, Any]],
) -> tuple[dict[tuple[float, float], list[tuple[tuple[float, float], int, float]]], list[dict[str, Any]]]:
    adjacency: dict[tuple[float, float], list[tuple[tuple[float, float], int, float]]] = defaultdict(list)
    edge_set = set(int(index) for index in edge_indices)
    for edge_index in edge_set:
        segment = raw_segments[edge_index]
        start = segment["start"]
        end = segment["end"]
        length = _edge_length(segment)
        adjacency[start].append((end, edge_index, length))
        adjacency[end].append((start, edge_index, length))

    components: list[dict[str, Any]] = []
    visited: set[tuple[float, float]] = set()
    for start in sorted(adjacency):
        if start in visited:
            continue
        queue = deque([start])
        visited.add(start)
        nodes: list[tuple[float, float]] = []
        edges: set[int] = set()
        while queue:
            current = queue.popleft()
            nodes.append(current)
            for neighbor, edge_index, _ in adjacency[current]:
                edges.add(edge_index)
                if neighbor not in visited:
                    visited.add(neighbor)
                    queue.append(neighbor)
        components.append({"nodes": nodes, "edges": sorted(edges)})
    return adjacency, components


def _choose_outlets(
    component_nodes: list[tuple[float, float]],
    adjacency: dict[tuple[float, float], list[tuple[tuple[float, float], int, float]]],
    node_data: dict[tuple[float, float], dict[str, Any]],
    bounds: tuple[float, float, float, float],
    single_outlet: bool,
) -> list[tuple[float, float]]:
    terminals = [node for node in component_nodes if len(adjacency[node]) == 1]
    candidates = terminals or component_nodes
    boundary = [node for node in candidates if _boundary_node(node, bounds)]
    pool = boundary or candidates
    if single_outlet:
        return [min(pool, key=lambda node: (float(node_data[node]["elevation"]), node[1], node[0]))]

    elevations = np.asarray([float(node_data[node]["elevation"]) for node in pool], dtype=np.float64)
    threshold = float(np.quantile(elevations, 0.25)) if len(elevations) > 1 else float(elevations[0])
    low = [node for node in pool if float(node_data[node]["elevation"]) <= threshold + 1e-6]
    if not low:
        low = [min(pool, key=lambda node: (float(node_data[node]["elevation"]), node[1], node[0]))]
    low.sort(key=lambda node: (float(node_data[node]["elevation"]), node[1], node[0]))
    return low[:8]


def _distance_field(
    edge_indices: Iterable[int],
    raw_segments: list[dict[str, Any]],
    node_data: dict[tuple[float, float], dict[str, Any]],
    bounds: tuple[float, float, float, float],
    single_outlet: bool,
) -> tuple[dict[tuple[float, float], dict[str, Any]], list[dict[str, Any]]]:
    adjacency, components = _subgraph_components(edge_indices, raw_segments)
    field: dict[tuple[float, float], dict[str, Any]] = {}
    reports: list[dict[str, Any]] = []
    for component_index, component in enumerate(components):
        nodes = component["nodes"]
        outlets = _choose_outlets(nodes, adjacency, node_data, bounds, single_outlet)
        distances = {node: math.inf for node in nodes}
        heap: list[tuple[float, float, float]] = []
        for outlet in outlets:
            distances[outlet] = 0.0
            heapq.heappush(heap, (0.0, outlet[0], outlet[1]))
        while heap:
            distance, easting, northing = heapq.heappop(heap)
            node = (easting, northing)
            if distance > distances[node] + 1e-9:
                continue
            for neighbor, _, length in adjacency[node]:
                candidate = distance + length
                if candidate + 1e-9 < distances[neighbor]:
                    distances[neighbor] = candidate
                    heapq.heappush(heap, (candidate, neighbor[0], neighbor[1]))
        maximum = max(distances.values()) if distances else 0.0
        maximum = max(maximum, 1.0)
        for node in nodes:
            distance = float(distances[node])
            flow_distance = maximum - distance
            field[node] = {
                "component": component_index,
                "distance_to_outlet_m": distance,
                "maximum_route_distance_m": maximum,
                "flow_distance_m": flow_distance,
                "progress": float(np.clip(flow_distance / maximum, 0.0, 1.0)),
                "is_outlet": node in outlets,
            }
        reports.append({
            "component": component_index,
            "node_count": len(nodes),
            "edge_count": len(component["edges"]),
            "outlet_count": len(outlets),
            "outlets": [
                {
                    "easting": outlet[0],
                    "northing": outlet[1],
                    "elevation_m": float(node_data[outlet]["elevation"]),
                    "on_aoi_boundary": _boundary_node(outlet, bounds),
                }
                for outlet in outlets
            ],
            "maximum_route_distance_m": maximum,
        })
    return field, reports


def orient_network(
    raw_segments: list[dict[str, Any]],
    node_data: dict[tuple[float, float], dict[str, Any]],
    bounds: tuple[float, float, float, float],
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    all_indices = list(range(len(raw_segments)))
    general_field, general_reports = _distance_field(
        all_indices, raw_segments, node_data, bounds, single_outlet=False
    )
    major_fields: dict[int, dict[tuple[float, float], dict[str, Any]]] = {}
    major_reports: dict[int, list[dict[str, Any]]] = {}
    for code in (1, 2, 3):
        indices = [index for index, segment in enumerate(raw_segments) if int(segment.get("major_code", 0)) == code]
        field, reports = _distance_field(indices, raw_segments, node_data, bounds, single_outlet=True)
        major_fields[code] = field
        major_reports[code] = reports

    directed_edges: list[dict[str, Any]] = []
    tie_count = 0
    for source in raw_segments:
        start = source["start"]
        end = source["end"]
        code = int(source.get("major_code", 0))
        field = major_fields.get(code) if code else general_field
        if not field or start not in field or end not in field:
            field = general_field
        start_info = field[start]
        end_info = field[end]
        start_distance = float(start_info["distance_to_outlet_m"])
        end_distance = float(end_info["distance_to_outlet_m"])
        if start_distance > end_distance + 1e-7:
            upstream, downstream = start, end
            upstream_info, downstream_info = start_info, end_info
        elif end_distance > start_distance + 1e-7:
            upstream, downstream = end, start
            upstream_info, downstream_info = end_info, start_info
        else:
            tie_count += 1
            start_rank = (float(node_data[start]["elevation"]), start[1], start[0])
            end_rank = (float(node_data[end]["elevation"]), end[1], end[0])
            if start_rank >= end_rank:
                upstream, downstream = start, end
                upstream_info, downstream_info = start_info, end_info
            else:
                upstream, downstream = end, start
                upstream_info, downstream_info = end_info, start_info

        length = _edge_length(source)
        start_progress = float(upstream_info["progress"])
        end_progress = float(downstream_info["progress"])
        start_flow_distance = float(upstream_info["flow_distance_m"])
        end_flow_distance = float(downstream_info["flow_distance_m"])
        maximum_route = max(
            1.0,
            float(upstream_info["maximum_route_distance_m"]),
            float(downstream_info["maximum_route_distance_m"]),
        )
        minimum_progress_step = min(0.02, max(1e-7, length / maximum_route * 0.08))
        if end_progress <= start_progress:
            end_progress = min(1.0, start_progress + minimum_progress_step)
        if end_flow_distance <= start_flow_distance:
            end_flow_distance = start_flow_distance + max(0.01, length * 0.08)

        edge = dict(source)
        edge.update({
            "upstream": upstream,
            "downstream": downstream,
            "length_m": length,
            "flow_accumulation_start_m": 0.0,
            "flow_accumulation_end_m": 0.0,
            "flow_distance_start_m": start_flow_distance,
            "flow_distance_end_m": end_flow_distance,
            "start_flow_progress": float(np.clip(start_progress, 0.0, 1.0)),
            "end_flow_progress": float(np.clip(max(start_progress, end_progress), 0.0, 1.0)),
            "orientation_component": int(upstream_info["component"]),
            "orientation_method": "named-mainstem-outlet-distance" if code else "component-outlet-distance",
        })
        directed_edges.append(edge)

    outgoing: dict[tuple[float, float], list[int]] = defaultdict(list)
    for edge_index, edge in enumerate(directed_edges):
        outgoing[edge["upstream"]].append(edge_index)
    accumulation_at_node = {node: 0.0 for node in node_data}
    ordered_nodes = sorted(
        node_data,
        key=lambda node: min(
            [
                directed_edges[index]["flow_distance_start_m"]
                for index in outgoing.get(node, [])
            ] or [math.inf]
        ),
    )
    for node in ordered_nodes:
        edge_indices = outgoing.get(node, [])
        if not edge_indices:
            continue
        share = accumulation_at_node[node] / max(1, len(edge_indices))
        for edge_index in edge_indices:
            edge = directed_edges[edge_index]
            edge["flow_accumulation_start_m"] = share
            edge["flow_accumulation_end_m"] = share + edge["length_m"]
            accumulation_at_node[edge["downstream"]] += edge["flow_accumulation_end_m"]

    li_edges = [edge for edge in directed_edges if int(edge.get("major_code", 0)) == 1]
    li_min_northing = min(
        min(edge["upstream"][1], edge["downstream"][1]) for edge in li_edges
    ) if li_edges else math.inf
    li_south_count = sum(
        1 for edge in li_edges
        if min(edge["upstream"][1], edge["downstream"][1]) < YANGSHUO_NORTHING_M
    )
    li_gui_count = sum(1 for edge in li_edges if "桂江" in str(edge.get("name_blob") or ""))
    west, south, east, north = bounds
    li_reaches_south = bool(li_edges and li_min_northing <= south + BOUNDARY_TOLERANCE_M)

    mainstem_component_counts = {
        "li": len(major_reports.get(1, [])),
        "xiang": len(major_reports.get(2, [])),
        "zi": len(major_reports.get(3, [])),
    }
    diagnostics = {
        "orientation_method": "connected-network outlet shortest-path distance",
        "general_component_count": len(general_reports),
        "general_outlet_count": sum(item["outlet_count"] for item in general_reports),
        "mainstem_component_counts": mainstem_component_counts,
        "mainstem_component_reports": {
            "li": major_reports.get(1, []),
            "xiang": major_reports.get(2, []),
            "zi": major_reports.get(3, []),
        },
        "distance_tie_segment_count": tie_count,
        "li_mainstem_segment_count": len(li_edges),
        "li_gui_continuation_segment_count": li_gui_count,
        "li_south_of_yangshuo_segment_count": li_south_count,
        "li_min_northing_m": li_min_northing,
        "li_reaches_aoi_south_boundary": li_reaches_south,
        "yangshuo_northing_m": YANGSHUO_NORTHING_M,
    }
    if not li_edges:
        raise RuntimeError("Li/Gui mainstem is missing")
    if li_gui_count <= 0:
        raise RuntimeError("Gui River continuation is not classified as the Li mainstem")
    if li_south_count <= 0:
        raise RuntimeError("Li River does not continue south of Yangshuo")
    if not li_reaches_south:
        raise RuntimeError(
            f"Li/Gui mainstem stops before the AOI south boundary: {li_min_northing} > {south}"
        )
    return directed_edges, diagnostics
