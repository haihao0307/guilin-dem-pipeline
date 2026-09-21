#!/usr/bin/env python3
"""Build Yellowfin biological-correction Candidate A from the frozen Source Copy.

The frozen GLB is never edited. Candidate A uses one longitudinal rest-space cage for body
depth and root-pinned local extensions for the pectoral, second dorsal and main anal fins.
The same point deformation is propagated to bind-joint origins and all animated joint
translation channels; inverse bind matrices, normals and tangents are rebuilt.
"""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import math
import struct
import sys
from collections import defaultdict, deque
from pathlib import Path
from typing import Any, Callable, Iterable

import numpy as np

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from audit_frozen_baseline import (  # noqa: E402
    BIN_CHUNK,
    JSON_CHUNK,
    COMPONENT_DTYPES,
    EXPECTED_COPY_BYTES,
    EXPECTED_COPY_SHA256,
    EXPECTED_REGIONS,
    TYPE_COMPONENTS,
    clean_float,
    connected_components,
    edges_for_face,
    load_json,
    max_min_distance,
    node_matrix,
    parent_map,
    profile_metrics,
    quaternion_matrix,
    read_accessor,
    read_glb,
    sha256_bytes,
    transform_points,
    vector,
    world_matrix,
    write_json,
)


CANDIDATE_NAME = "YELLOWFIN-BIOLOGICAL-CORRECTION-R001-CANDIDATE-A"


def accessor_layout(document: dict[str, Any], accessor_index: int) -> tuple[dict[str, Any], np.dtype, int, int, int, int]:
    accessor = document["accessors"][int(accessor_index)]
    if accessor.get("sparse"):
        raise ValueError(f"sparse accessor cannot be rewritten: {accessor_index}")
    dtype = COMPONENT_DTYPES[int(accessor["componentType"])]
    components = TYPE_COMPONENTS[accessor["type"]]
    view = document["bufferViews"][int(accessor["bufferView"])]
    offset = int(view.get("byteOffset", 0)) + int(accessor.get("byteOffset", 0))
    element_bytes = dtype.itemsize * components
    stride = int(view.get("byteStride", element_bytes))
    return accessor, dtype, components, int(accessor["count"]), offset, stride


def write_accessor(document: dict[str, Any], binary: bytearray, accessor_index: int, values: np.ndarray) -> None:
    accessor, dtype, components, count, offset, stride = accessor_layout(document, accessor_index)
    array = np.asarray(values)
    if components == 1:
        array = array.reshape(count, 1)
    if array.shape != (count, components):
        raise ValueError(f"accessor {accessor_index} shape mismatch: {array.shape} != {(count, components)}")
    encoded_array = np.asarray(array, dtype=dtype)
    element_bytes = dtype.itemsize * components
    if stride == element_bytes:
        encoded = encoded_array.reshape(-1).tobytes()
        binary[offset : offset + len(encoded)] = encoded
    else:
        for row_index, row in enumerate(encoded_array):
            encoded = row.tobytes()
            row_offset = offset + row_index * stride
            binary[row_offset : row_offset + len(encoded)] = encoded
    if accessor["type"] in {"SCALAR", "VEC2", "VEC3", "VEC4"} and np.issubdtype(dtype, np.floating):
        accessor["min"] = [float(value) for value in encoded_array.min(axis=0)]
        accessor["max"] = [float(value) for value in encoded_array.max(axis=0)]


def pack_glb(document: dict[str, Any], binary: bytes) -> bytes:
    document.setdefault("buffers", [{}])
    if len(document["buffers"]) != 1:
        raise ValueError("Candidate A requires one embedded buffer")
    document["buffers"][0].pop("uri", None)
    document["buffers"][0]["byteLength"] = len(binary)
    json_bytes = json.dumps(document, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    json_bytes += b" " * ((4 - len(json_bytes) % 4) % 4)
    bin_bytes = binary + b"\x00" * ((4 - len(binary) % 4) % 4)
    total = 12 + 8 + len(json_bytes) + 8 + len(bin_bytes)
    return b"".join(
        [
            struct.pack("<4sII", b"glTF", 2, total),
            struct.pack("<II", len(json_bytes), JSON_CHUNK),
            json_bytes,
            struct.pack("<II", len(bin_bytes), BIN_CHUNK),
            bin_bytes,
        ]
    )


def smoothstep(value: np.ndarray | float) -> np.ndarray | float:
    clipped = np.clip(value, 0.0, 1.0)
    return clipped * clipped * (3.0 - 2.0 * clipped)


def matrix_to_trs(matrix: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    translation = matrix[:3, 3].copy()
    basis = matrix[:3, :3].copy()
    scale = np.linalg.norm(basis, axis=0)
    if np.any(scale < 1e-12):
        raise ValueError("cannot decompose zero-scale node matrix")
    rotation_matrix = basis / scale[None, :]
    if np.linalg.det(rotation_matrix) < 0:
        scale[0] *= -1
        rotation_matrix[:, 0] *= -1
    quaternion = rotation_matrix_to_quaternion(rotation_matrix)
    return translation, quaternion, scale


def rotation_matrix_to_quaternion(matrix: np.ndarray) -> np.ndarray:
    m = matrix
    trace = float(np.trace(m))
    if trace > 0:
        s = math.sqrt(trace + 1.0) * 2.0
        quaternion = np.array(
            [
                (m[2, 1] - m[1, 2]) / s,
                (m[0, 2] - m[2, 0]) / s,
                (m[1, 0] - m[0, 1]) / s,
                0.25 * s,
            ],
            dtype=np.float64,
        )
    elif m[0, 0] > m[1, 1] and m[0, 0] > m[2, 2]:
        s = math.sqrt(1.0 + m[0, 0] - m[1, 1] - m[2, 2]) * 2.0
        quaternion = np.array(
            [0.25 * s, (m[0, 1] + m[1, 0]) / s, (m[0, 2] + m[2, 0]) / s, (m[2, 1] - m[1, 2]) / s],
            dtype=np.float64,
        )
    elif m[1, 1] > m[2, 2]:
        s = math.sqrt(1.0 + m[1, 1] - m[0, 0] - m[2, 2]) * 2.0
        quaternion = np.array(
            [(m[0, 1] + m[1, 0]) / s, 0.25 * s, (m[1, 2] + m[2, 1]) / s, (m[0, 2] - m[2, 0]) / s],
            dtype=np.float64,
        )
    else:
        s = math.sqrt(1.0 + m[2, 2] - m[0, 0] - m[1, 1]) * 2.0
        quaternion = np.array(
            [(m[0, 2] + m[2, 0]) / s, (m[1, 2] + m[2, 1]) / s, 0.25 * s, (m[1, 0] - m[0, 1]) / s],
            dtype=np.float64,
        )
    quaternion /= np.linalg.norm(quaternion)
    return quaternion


def compose_trs(translation: np.ndarray, rotation: np.ndarray, scale: np.ndarray) -> np.ndarray:
    matrix = quaternion_matrix(rotation)
    matrix[:3, :3] = matrix[:3, :3] @ np.diag(scale)
    matrix[:3, 3] = translation
    return matrix


def node_trs(node: dict[str, Any]) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    if node.get("matrix") is not None:
        return matrix_to_trs(np.asarray(node["matrix"], dtype=np.float64).reshape(4, 4, order="F"))
    translation = np.asarray(node.get("translation", [0.0, 0.0, 0.0]), dtype=np.float64)
    rotation = np.asarray(node.get("rotation", [0.0, 0.0, 0.0, 1.0]), dtype=np.float64)
    scale = np.asarray(node.get("scale", [1.0, 1.0, 1.0]), dtype=np.float64)
    return translation, rotation, scale


def set_node_local_translation(node: dict[str, Any], local_translation: np.ndarray) -> None:
    if node.get("matrix") is not None:
        matrix = np.asarray(node["matrix"], dtype=np.float64).reshape(4, 4, order="F")
        matrix[:3, 3] = local_translation
        node["matrix"] = [float(value) for value in matrix.reshape(-1, order="F")]
    else:
        node["translation"] = [float(value) for value in local_translation]


def topological_nodes(nodes: list[dict[str, Any]], parents: dict[int, int]) -> list[int]:
    children: dict[int, list[int]] = defaultdict(list)
    roots: list[int] = []
    for index in range(len(nodes)):
        if index in parents:
            children[parents[index]].append(index)
        else:
            roots.append(index)
    order: list[int] = []
    queue: deque[int] = deque(roots)
    while queue:
        current = queue.popleft()
        order.append(current)
        queue.extend(children[current])
    if len(order) != len(nodes):
        raise ValueError("node graph is not a tree/forest")
    return order


def extract_regions(document: dict[str, Any], binary: bytes) -> tuple[dict[str, dict[str, Any]], dict[str, np.ndarray], dict[str, np.ndarray]]:
    mesh = document["meshes"][0]
    primitives: dict[str, dict[str, Any]] = {}
    faces: dict[str, np.ndarray] = {}
    vertices: dict[str, np.ndarray] = {}
    for primitive in mesh.get("primitives", []):
        extras = primitive.get("extras") if isinstance(primitive.get("extras"), dict) else {}
        region = extras.get("kaopuSourceCopyRegion")
        if not region:
            continue
        region_name = str(region)
        primitives[region_name] = primitive
        indices = read_accessor(document, binary, int(primitive["indices"])).astype(np.int64)
        faces[region_name] = indices.reshape(-1, 3)
        vertices[region_name] = np.unique(indices).astype(np.int64)
    if list(primitives) != EXPECTED_REGIONS:
        raise ValueError(f"semantic region drift: {list(primitives)}")
    return primitives, faces, vertices


def build_edge_members(region_faces: dict[str, np.ndarray]) -> dict[tuple[int, int], list[tuple[str, int]]]:
    members: dict[tuple[int, int], list[tuple[str, int]]] = defaultdict(list)
    for region_name in EXPECTED_REGIONS:
        for face_index, face in enumerate(region_faces[region_name]):
            for edge in edges_for_face(face):
                members[edge].append((region_name, face_index))
    return members


def component_topology(
    region_name: str,
    region_faces: dict[str, np.ndarray],
    positions: np.ndarray,
    edge_members: dict[tuple[int, int], list[tuple[str, int]]],
    fork_y: float,
    fork_length: float,
) -> list[dict[str, Any]]:
    faces = region_faces[region_name]
    records: list[dict[str, Any]] = []
    for component_index, face_ids in enumerate(connected_components(np.arange(len(faces), dtype=np.int64), faces)):
        component_faces = faces[face_ids]
        vertex_ids = np.unique(component_faces.reshape(-1)).astype(np.int64)
        root_edges: set[tuple[int, int]] = set()
        for face in component_faces:
            for edge in edges_for_face(face):
                if any(other_region != region_name for other_region, _ in edge_members[edge]):
                    root_edges.add(edge)
        root_vertex_ids = (
            np.unique(np.asarray([vertex for edge in root_edges for vertex in edge], dtype=np.int64))
            if root_edges
            else np.empty(0, dtype=np.int64)
        )
        component_points = positions[vertex_ids]
        root_points = positions[root_vertex_ids]
        root_centroid = root_points.mean(axis=0) if len(root_points) else component_points.mean(axis=0)
        max_distance = max_min_distance(component_points, root_points)
        root_z = float(np.median(root_points[:, 2])) if len(root_points) else float(np.median(component_points[:, 2]))
        records.append(
            {
                "component": component_index,
                "faceIds": face_ids,
                "vertexIds": vertex_ids,
                "rootVertexIds": root_vertex_ids,
                "rootCentroid": root_centroid,
                "centroid": component_points.mean(axis=0),
                "maxRootDistance": float(max_distance or 0.0),
                "rootU": float((root_centroid[1] - fork_y) / fork_length),
                "uRange": [
                    float((component_points[:, 1].min() - fork_y) / fork_length),
                    float((component_points[:, 1].max() - fork_y) / fork_length),
                ],
                "dorsalHeight": max(0.0, root_z - float(component_points[:, 2].min())),
                "ventralHeight": max(0.0, float(component_points[:, 2].max()) - root_z),
                "faces": int(len(face_ids)),
                "vertices": int(len(vertex_ids)),
            }
        )
    records.sort(key=lambda item: item["rootU"], reverse=True)
    return records


def group_mirrored_components(components: list[dict[str, Any]]) -> list[list[dict[str, Any]]]:
    """Resolve disconnected mirrored sheets into anatomical fin groups."""
    used: set[int] = set()
    groups: list[list[dict[str, Any]]] = []
    tolerance = 2e-6
    for index, component in enumerate(components):
        if index in used:
            continue
        used.add(index)
        group = [component]
        centroid = component["centroid"]
        if abs(float(centroid[0])) > tolerance:
            best_index: int | None = None
            best_score = float("inf")
            for other_index, other in enumerate(components):
                if other_index in used:
                    continue
                if component["faces"] != other["faces"] or component["vertices"] != other["vertices"]:
                    continue
                if not np.allclose(component["uRange"], other["uRange"], atol=tolerance, rtol=0):
                    continue
                if abs(component["rootU"] - other["rootU"]) > tolerance:
                    continue
                if abs(component["dorsalHeight"] - other["dorsalHeight"]) > fork_length_for_pairing(components) * tolerance:
                    continue
                if abs(float(centroid[0]) + float(other["centroid"][0])) > fork_length_for_pairing(components) * tolerance:
                    continue
                score = (
                    abs(component["rootU"] - other["rootU"])
                    + abs(float(component["rootCentroid"][2]) - float(other["rootCentroid"][2]))
                    + abs(abs(float(centroid[0])) - abs(float(other["centroid"][0])))
                )
                if score < best_score:
                    best_score = score
                    best_index = other_index
            if best_index is not None:
                used.add(best_index)
                group.append(components[best_index])
        groups.append(group)
    groups.sort(key=lambda group: float(np.mean([component["rootU"] for component in group])), reverse=True)
    return groups


def fork_length_for_pairing(components: list[dict[str, Any]]) -> float:
    spans = [
        max(float(component["maxRootDistance"]), float(component["dorsalHeight"]), float(component["ventralHeight"]))
        for component in components
    ]
    return max(max(spans, default=1.0), 1.0)


def anatomical_group_summary(group: list[dict[str, Any]], fork_length: float) -> dict[str, Any]:
    heights = [component_metric(component, np.empty((0, 3)), fork_length, "dorsal") if False else component["dorsalHeight"] / fork_length for component in group]
    return {
        "componentIds": [int(component["component"]) for component in group],
        "surfaceCount": len(group),
        "rootU": clean_float(float(np.mean([component["rootU"] for component in group]))),
        "uRange": vector([
            min(component["uRange"][0] for component in group),
            max(component["uRange"][1] for component in group),
        ]),
        "dorsalHeightOverForkLength": clean_float(max(heights)),
        "surfaceHeightSpread": clean_float(max(heights) - min(heights), 12),
        "surfaces": [component_summary(component, fork_length) for component in group],
    }


def component_summary(component: dict[str, Any], fork_length: float) -> dict[str, Any]:
    return {
        "component": int(component["component"]),
        "faces": int(component["faces"]),
        "vertices": int(component["vertices"]),
        "rootVertices": int(len(component["rootVertexIds"])),
        "rootU": clean_float(component["rootU"]),
        "uRange": vector(component["uRange"]),
        "maximumRootDistanceOverForkLength": clean_float(component["maxRootDistance"] / fork_length),
        "dorsalHeightOverForkLength": clean_float(component["dorsalHeight"] / fork_length),
        "ventralHeightOverForkLength": clean_float(component["ventralHeight"] / fork_length),
    }


def body_centerline_function(bind_positions: np.ndarray, joint_names: list[str]) -> Callable[[np.ndarray], np.ndarray]:
    selected = [
        index
        for index, name in enumerate(joint_names)
        if name in {"_rootJoint", "Hips_01", "Head_05"} or name.startswith("Spine")
    ]
    if len(selected) < 3:
        raise ValueError("insufficient axial joints for body centerline")
    points = bind_positions[selected]
    order = np.argsort(points[:, 1])
    points = points[order]
    unique_y: list[float] = []
    unique_z: list[float] = []
    for y_value in np.unique(np.round(points[:, 1], 9)):
        mask = np.isclose(points[:, 1], y_value, atol=1e-8)
        unique_y.append(float(points[mask, 1].mean()))
        unique_z.append(float(np.median(points[mask, 2])))
    y_array = np.asarray(unique_y, dtype=np.float64)
    z_array = np.asarray(unique_z, dtype=np.float64)

    def centerline(y_values: np.ndarray) -> np.ndarray:
        return np.interp(y_values, y_array, z_array, left=z_array[0], right=z_array[-1])

    return centerline


def body_weight_function(controls: dict[str, Any], fork_y: float, fork_length: float) -> Callable[[np.ndarray], np.ndarray]:
    knots = np.asarray(controls["longitudinalBodyDepthWeight"], dtype=np.float64)

    def weights(y_values: np.ndarray) -> np.ndarray:
        u = (y_values - fork_y) / fork_length
        return np.interp(u, knots[:, 0], knots[:, 1], left=knots[0, 1], right=knots[-1, 1])

    return weights


def make_global_deformer(
    centerline: Callable[[np.ndarray], np.ndarray],
    longitudinal_weight: Callable[[np.ndarray], np.ndarray],
    amplitude: float,
) -> Callable[[np.ndarray], np.ndarray]:
    def deform(points: np.ndarray) -> np.ndarray:
        array = np.asarray(points, dtype=np.float64)
        single = array.ndim == 1
        if single:
            array = array.reshape(1, 3)
        output = array.copy()
        centers = centerline(array[:, 1])
        weights = longitudinal_weight(array[:, 1])
        scale = 1.0 - float(amplitude) * weights
        output[:, 2] = centers + (array[:, 2] - centers) * scale
        return output[0] if single else output

    return deform


def solve_body_amplitude(
    body_points: np.ndarray,
    fork_y: float,
    fork_length: float,
    centerline: Callable[[np.ndarray], np.ndarray],
    longitudinal_weight: Callable[[np.ndarray], np.ndarray],
    target_depth: float,
) -> tuple[float, float]:
    def depth(amplitude: float) -> float:
        deformed = make_global_deformer(centerline, longitudinal_weight, amplitude)(body_points)
        return float(profile_metrics(deformed, fork_y, fork_length)["deepest"]["depthOverForkLength"])

    zero_depth = depth(0.0)
    if zero_depth < target_depth:
        raise ValueError(f"Candidate A only reduces body depth; baseline {zero_depth:.6f} < target {target_depth:.6f}")
    low = 0.0
    high = 0.45
    high_depth = depth(high)
    if high_depth > target_depth:
        raise ValueError(f"body cage cannot reach target: {high_depth:.6f} > {target_depth:.6f}")
    for _ in range(40):
        middle = (low + high) * 0.5
        middle_depth = depth(middle)
        if middle_depth > target_depth:
            low = middle
        else:
            high = middle
    amplitude = (low + high) * 0.5
    return amplitude, depth(amplitude)


def nearest_root_data(points: np.ndarray, roots: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    if len(roots) == 0:
        raise ValueError("root-pinned deformation requires root vertices")
    nearest = np.empty(len(points), dtype=np.int64)
    distances = np.empty(len(points), dtype=np.float64)
    for start in range(0, len(points), 512):
        chunk = points[start : start + 512]
        matrix = np.linalg.norm(chunk[:, None, :] - roots[None, :, :], axis=2)
        local = np.argmin(matrix, axis=1)
        nearest[start : start + len(chunk)] = local
        distances[start : start + len(chunk)] = matrix[np.arange(len(chunk)), local]
    return nearest, distances


def apply_root_pinned_extension(
    points: np.ndarray,
    roots: np.ndarray,
    factor: float,
    mode: str,
    max_distance: float,
) -> np.ndarray:
    if factor <= 0:
        raise ValueError("extension factor must be positive")
    if max_distance <= 1e-12:
        return points.copy()
    nearest, distances = nearest_root_data(points, roots)
    anchors = roots[nearest]
    weight = smoothstep(np.clip(distances / (max_distance * 0.34), 0.0, 1.0))
    output = points.copy()
    if mode == "isotropic":
        scale = 1.0 + (factor - 1.0) * weight
        output = anchors + (points - anchors) * scale[:, None]
    elif mode == "vertical":
        scale = 1.0 + (factor - 1.0) * weight
        output[:, 2] = anchors[:, 2] + (points[:, 2] - anchors[:, 2]) * scale
    else:
        raise ValueError(f"unknown root-pinned extension mode: {mode}")
    return output


def component_metric(component: dict[str, Any], positions: np.ndarray, fork_length: float, mode: str) -> float:
    component_points = positions[component["vertexIds"]]
    root_points = positions[component["rootVertexIds"]]
    if mode == "distance":
        value = max_min_distance(component_points, root_points) or 0.0
    elif mode == "dorsal":
        root_z = float(np.median(root_points[:, 2]))
        value = max(0.0, root_z - float(component_points[:, 2].min()))
    elif mode == "ventral":
        root_z = float(np.median(root_points[:, 2]))
        value = max(0.0, float(component_points[:, 2].max()) - root_z)
    else:
        raise ValueError(mode)
    return float(value / fork_length)


def extend_component_vertices(
    positions: np.ndarray,
    component: dict[str, Any],
    factor: float,
    mode: str,
) -> None:
    vertex_ids = component["vertexIds"]
    roots = positions[component["rootVertexIds"]]
    points = positions[vertex_ids]
    max_distance = max_min_distance(points, roots) or 0.0
    positions[vertex_ids] = apply_root_pinned_extension(points, roots, factor, mode, max_distance)


def solve_component_extension_factor(
    positions: np.ndarray,
    component: dict[str, Any],
    target_metric: float,
    fork_length: float,
    extension_mode: str,
    metric_mode: str,
) -> tuple[float, float]:
    """Solve the real root-pinned deformation factor against its final metric.

    A target/current ratio is not valid here because the root is pinned and the
    smoothstep weight varies over the component. Solve the nonlinear monotonic map
    directly and always evaluate from the same undeformed component state.
    """
    vertex_ids = component["vertexIds"]
    root_vertex_ids = component["rootVertexIds"]
    roots = positions[root_vertex_ids]
    points = positions[vertex_ids]
    max_distance = max_min_distance(points, roots) or 0.0
    if len(roots) == 0 or max_distance <= 1e-12:
        raise ValueError("cannot solve a root-pinned component without a valid root")

    def metric_for_factor(factor: float) -> float:
        deformed = apply_root_pinned_extension(
            points,
            roots,
            factor,
            extension_mode,
            max_distance,
        )
        if metric_mode == "distance":
            value = max_min_distance(deformed, roots) or 0.0
        elif metric_mode == "dorsal":
            root_z = float(np.median(roots[:, 2]))
            value = max(0.0, root_z - float(deformed[:, 2].min()))
        elif metric_mode == "ventral":
            root_z = float(np.median(roots[:, 2]))
            value = max(0.0, float(deformed[:, 2].max()) - root_z)
        else:
            raise ValueError(f"unknown component metric mode: {metric_mode}")
        return float(value / fork_length)

    baseline_metric = metric_for_factor(1.0)
    tolerance = 2.5e-8
    if target_metric < baseline_metric - tolerance:
        raise ValueError(
            f"Candidate A extension solver cannot shrink {metric_mode}: "
            f"baseline={baseline_metric:.9f} target={target_metric:.9f}"
        )
    if abs(target_metric - baseline_metric) <= tolerance:
        return 1.0, baseline_metric

    low = 1.0
    high = 1.25
    high_metric = metric_for_factor(high)
    while high_metric < target_metric and high < 12.0:
        high *= 1.5
        high_metric = metric_for_factor(high)
    if high_metric < target_metric:
        raise ValueError(
            f"root-pinned solver could not reach {metric_mode} target: "
            f"factor={high:.6f} metric={high_metric:.9f} target={target_metric:.9f}"
        )

    for _ in range(56):
        middle = (low + high) * 0.5
        middle_metric = metric_for_factor(middle)
        if middle_metric < target_metric:
            low = middle
        else:
            high = middle
    factor = (low + high) * 0.5
    return factor, metric_for_factor(factor)


def component_point_deformer(component: dict[str, Any], global_positions: np.ndarray, factor: float, mode: str) -> dict[str, Any]:
    roots = global_positions[component["rootVertexIds"]]
    points = global_positions[component["vertexIds"]]
    max_distance = max_min_distance(points, roots) or 0.0
    return {
        "component": component,
        "roots": roots,
        "points": points,
        "factor": float(factor),
        "mode": mode,
        "maxDistance": float(max_distance),
        "centroid": points.mean(axis=0),
    }


def apply_component_to_point(point: np.ndarray, config: dict[str, Any]) -> np.ndarray:
    roots = config["roots"]
    if len(roots) == 0 or config["maxDistance"] <= 1e-12:
        return point.copy()
    distances = np.linalg.norm(roots - point[None, :], axis=1)
    anchor = roots[int(np.argmin(distances))]
    distance = float(np.min(distances))
    weight = float(smoothstep(np.clip(distance / (config["maxDistance"] * 0.34), 0.0, 1.0)))
    factor = 1.0 + (config["factor"] - 1.0) * weight
    output = point.copy()
    if config["mode"] == "isotropic":
        output = anchor + (point - anchor) * factor
    elif config["mode"] == "vertical":
        output[2] = anchor[2] + (point[2] - anchor[2]) * factor
    return output


def nearest_component(point: np.ndarray, configs: list[dict[str, Any]]) -> dict[str, Any] | None:
    if not configs:
        return None
    return min(configs, key=lambda config: float(np.linalg.norm(point - config["centroid"])))


def slerp(left: np.ndarray, right: np.ndarray, amount: float) -> np.ndarray:
    q0 = left.astype(np.float64)
    q1 = right.astype(np.float64)
    q0 /= np.linalg.norm(q0)
    q1 /= np.linalg.norm(q1)
    dot = float(np.dot(q0, q1))
    if dot < 0.0:
        q1 = -q1
        dot = -dot
    dot = min(1.0, max(-1.0, dot))
    if dot > 0.9995:
        result = q0 + amount * (q1 - q0)
        return result / np.linalg.norm(result)
    theta_0 = math.acos(dot)
    theta = theta_0 * amount
    sin_theta = math.sin(theta)
    sin_theta_0 = math.sin(theta_0)
    return q0 * (math.cos(theta) - dot * sin_theta / sin_theta_0) + q1 * (sin_theta / sin_theta_0)


def sample_track(times: np.ndarray, values: np.ndarray, time: float, path: str, interpolation: str) -> np.ndarray:
    if interpolation == "CUBICSPLINE":
        raise ValueError("CUBICSPLINE animation is not accepted for Candidate A translation propagation")
    if len(times) == 1 or time <= float(times[0]):
        return values[0].copy()
    if time >= float(times[-1]):
        return values[-1].copy()
    right = int(np.searchsorted(times, time, side="right"))
    left = right - 1
    if interpolation == "STEP":
        return values[left].copy()
    alpha = (time - float(times[left])) / (float(times[right]) - float(times[left]))
    if path == "rotation":
        return slerp(values[left], values[right], alpha)
    return values[left] * (1.0 - alpha) + values[right] * alpha


def animation_channels(document: dict[str, Any], binary: bytes) -> tuple[list[dict[str, Any]], dict[tuple[int, str], dict[str, Any]]]:
    animations = document.get("animations", [])
    if len(animations) != 1:
        raise ValueError(f"Candidate A expects one animation, found {len(animations)}")
    animation = animations[0]
    records: list[dict[str, Any]] = []
    by_target: dict[tuple[int, str], dict[str, Any]] = {}
    for channel_index, channel in enumerate(animation.get("channels", [])):
        sampler_index = int(channel["sampler"])
        sampler = animation["samplers"][sampler_index]
        node = int(channel["target"]["node"])
        path = str(channel["target"]["path"])
        times = read_accessor(document, binary, int(sampler["input"])).astype(np.float64).reshape(-1)
        values = read_accessor(document, binary, int(sampler["output"])).astype(np.float64)
        interpolation = str(sampler.get("interpolation", "LINEAR"))
        record = {
            "channelIndex": channel_index,
            "samplerIndex": sampler_index,
            "node": node,
            "path": path,
            "times": times,
            "values": values,
            "inputAccessor": int(sampler["input"]),
            "outputAccessor": int(sampler["output"]),
            "interpolation": interpolation,
        }
        if (node, path) in by_target:
            raise ValueError(f"duplicate animation target: {(node, path)}")
        by_target[(node, path)] = record
        records.append(record)
    return records, by_target


def original_pose_at_time(
    nodes: list[dict[str, Any]],
    parents: dict[int, int],
    order: list[int],
    channels: dict[tuple[int, str], dict[str, Any]],
    time: float,
) -> tuple[list[np.ndarray], list[np.ndarray]]:
    local_matrices: list[np.ndarray] = [np.eye(4) for _ in nodes]
    world_matrices: list[np.ndarray] = [np.eye(4) for _ in nodes]
    for node_index in order:
        translation, rotation, scale = node_trs(nodes[node_index])
        for path in ("translation", "rotation", "scale"):
            channel = channels.get((node_index, path))
            if channel is None:
                continue
            sampled = sample_track(channel["times"], channel["values"], time, path, channel["interpolation"])
            if path == "translation":
                translation = sampled
            elif path == "rotation":
                rotation = sampled
            else:
                scale = sampled
        local = compose_trs(translation, rotation, scale)
        local_matrices[node_index] = local
        parent_world = world_matrices[parents[node_index]] if node_index in parents else np.eye(4)
        world_matrices[node_index] = parent_world @ local
    return local_matrices, world_matrices


def corrected_pose_at_time(
    nodes: list[dict[str, Any]],
    parents: dict[int, int],
    order: list[int],
    joint_nodes: set[int],
    joint_deformer: Callable[[np.ndarray, str], np.ndarray],
    local_original: list[np.ndarray],
    world_original: list[np.ndarray],
) -> tuple[list[np.ndarray], list[np.ndarray], float]:
    local_corrected: list[np.ndarray] = [np.eye(4) for _ in nodes]
    world_corrected: list[np.ndarray] = [np.eye(4) for _ in nodes]
    maximum_error = 0.0
    for node_index in order:
        local = local_original[node_index].copy()
        parent_world = world_corrected[parents[node_index]] if node_index in parents else np.eye(4)
        if node_index in joint_nodes:
            original_position = world_original[node_index][:3, 3]
            desired_position = joint_deformer(original_position, nodes[node_index].get("name", f"node_{node_index}"))
            desired_h = np.r_[desired_position, 1.0]
            local[:3, 3] = (np.linalg.inv(parent_world) @ desired_h)[:3]
        local_corrected[node_index] = local
        world_corrected[node_index] = parent_world @ local
        if node_index in joint_nodes:
            desired_position = joint_deformer(
                world_original[node_index][:3, 3], nodes[node_index].get("name", f"node_{node_index}")
            )
            maximum_error = max(
                maximum_error,
                float(np.max(np.abs(world_corrected[node_index][:3, 3] - desired_position))),
            )
    return local_corrected, world_corrected, maximum_error


def transform_animation_translations(
    source_document: dict[str, Any],
    source_binary: bytes,
    candidate_document: dict[str, Any],
    candidate_binary: bytearray,
    joint_nodes: list[int],
    joint_deformer: Callable[[np.ndarray, str], np.ndarray],
) -> dict[str, Any]:
    nodes = source_document["nodes"]
    parents = parent_map(nodes)
    order = topological_nodes(nodes, parents)
    channel_records, channel_map = animation_channels(source_document, source_binary)
    translation_records = [record for record in channel_records if record["path"] == "translation" and record["node"] in set(joint_nodes)]
    if not translation_records:
        raise ValueError("no joint translation channels found")
    output_accessors = [record["outputAccessor"] for record in translation_records]
    if len(output_accessors) != len(set(output_accessors)):
        raise ValueError("joint translation output accessors are unexpectedly shared")

    cache: dict[float, tuple[list[np.ndarray], float]] = {}
    output_arrays: dict[int, np.ndarray] = {
        record["outputAccessor"]: record["values"].copy() for record in translation_records
    }
    maximum_error = 0.0
    for record in translation_records:
        for sample_index, time_value in enumerate(record["times"]):
            key = round(float(time_value), 9)
            if key not in cache:
                local_original, world_original = original_pose_at_time(nodes, parents, order, channel_map, float(time_value))
                local_corrected, _, error = corrected_pose_at_time(
                    nodes,
                    parents,
                    order,
                    set(joint_nodes),
                    joint_deformer,
                    local_original,
                    world_original,
                )
                cache[key] = (local_corrected, error)
            local_corrected, error = cache[key]
            maximum_error = max(maximum_error, error)
            output_arrays[record["outputAccessor"]][sample_index] = local_corrected[record["node"]][:3, 3]

    for accessor_index, values in output_arrays.items():
        write_accessor(candidate_document, candidate_binary, accessor_index, values)

    return {
        "translationChannelCount": len(translation_records),
        "uniqueSampleTimes": len(cache),
        "maximumJointOriginPropagationError": clean_float(maximum_error, 12),
        "interpolations": sorted({record["interpolation"] for record in translation_records}),
        "rotationChannelsRetained": sum(1 for record in channel_records if record["path"] == "rotation"),
        "scaleChannelsRetained": sum(1 for record in channel_records if record["path"] == "scale"),
    }


def update_rest_joints_and_inverse_bind(
    source_document: dict[str, Any],
    candidate_document: dict[str, Any],
    candidate_binary: bytearray,
    mesh_node: int,
    joint_nodes: list[int],
    joint_deformer: Callable[[np.ndarray, str], np.ndarray],
) -> dict[str, Any]:
    source_nodes = source_document["nodes"]
    candidate_nodes = candidate_document["nodes"]
    parents = parent_map(source_nodes)
    order = topological_nodes(source_nodes, parents)
    original_world = [world_matrix(source_nodes, parents, index) for index in range(len(source_nodes))]
    corrected_world: list[np.ndarray] = [np.eye(4) for _ in source_nodes]
    joint_set = set(joint_nodes)
    max_origin_error = 0.0
    for node_index in order:
        local = node_matrix(source_nodes[node_index]).copy()
        parent_world = corrected_world[parents[node_index]] if node_index in parents else np.eye(4)
        if node_index in joint_set:
            desired = joint_deformer(original_world[node_index][:3, 3], source_nodes[node_index].get("name", f"node_{node_index}"))
            local[:3, 3] = (np.linalg.inv(parent_world) @ np.r_[desired, 1.0])[:3]
            set_node_local_translation(candidate_nodes[node_index], local[:3, 3])
        corrected_world[node_index] = parent_world @ local
        if node_index in joint_set:
            desired = joint_deformer(original_world[node_index][:3, 3], source_nodes[node_index].get("name", f"node_{node_index}"))
            max_origin_error = max(max_origin_error, float(np.max(np.abs(corrected_world[node_index][:3, 3] - desired))))

    mesh_world = corrected_world[mesh_node]
    skin = candidate_document["skins"][0]
    inverse_bind_accessor = int(skin["inverseBindMatrices"])
    inverse_bind = np.empty((len(joint_nodes), 16), dtype=np.float64)
    rest_identity_error = 0.0
    for skin_index, node_index in enumerate(joint_nodes):
        matrix = np.linalg.inv(corrected_world[node_index]) @ mesh_world
        inverse_bind[skin_index] = matrix.reshape(-1, order="F")
        skin_matrix = np.linalg.inv(mesh_world) @ corrected_world[node_index] @ matrix
        rest_identity_error = max(rest_identity_error, float(np.max(np.abs(skin_matrix - np.eye(4)))))
    write_accessor(candidate_document, candidate_binary, inverse_bind_accessor, inverse_bind)
    return {
        "jointCount": len(joint_nodes),
        "maximumRestJointOriginError": clean_float(max_origin_error, 12),
        "maximumRestSkinIdentityError": clean_float(rest_identity_error, 12),
        "inverseBindAccessor": inverse_bind_accessor,
    }


def recompute_normals_and_tangents(
    document: dict[str, Any],
    binary: bytearray,
    candidate_positions: dict[int, np.ndarray],
) -> dict[str, Any]:
    normal_updates: dict[int, np.ndarray] = {}
    tangent_updates: dict[int, np.ndarray] = {}
    processed_groups = 0
    for mesh in document.get("meshes", []):
        groups: dict[tuple[int, int, int | None, int | None], list[dict[str, Any]]] = defaultdict(list)
        for primitive in mesh.get("primitives", []):
            attrs = primitive.get("attributes", {})
            if "POSITION" not in attrs or "NORMAL" not in attrs:
                continue
            key = (
                int(attrs["POSITION"]),
                int(attrs["NORMAL"]),
                int(attrs["TANGENT"]) if "TANGENT" in attrs else None,
                int(attrs["TEXCOORD_0"]) if "TEXCOORD_0" in attrs else None,
            )
            groups[key].append(primitive)
        for (position_accessor, normal_accessor, tangent_accessor, uv_accessor), primitives in groups.items():
            positions = candidate_positions[position_accessor]
            normals = np.zeros((len(positions), 3), dtype=np.float64)
            tangent_accum = np.zeros((len(positions), 3), dtype=np.float64)
            bitangent_accum = np.zeros((len(positions), 3), dtype=np.float64)
            uvs = read_accessor(document, bytes(binary), uv_accessor).astype(np.float64) if uv_accessor is not None else None
            referenced = np.zeros(len(positions), dtype=bool)
            seen_faces: set[tuple[int, int, int]] = set()
            for primitive in primitives:
                if int(primitive.get("mode", 4)) != 4:
                    continue
                if "indices" in primitive:
                    faces = read_accessor(document, bytes(binary), int(primitive["indices"])).astype(np.int64).reshape(-1, 3)
                else:
                    faces = np.arange(len(positions), dtype=np.int64).reshape(-1, 3)
                for face in faces:
                    face_key = tuple(int(value) for value in face)
                    if face_key in seen_faces:
                        continue
                    seen_faces.add(face_key)
                    i0, i1, i2 = face_key
                    p0, p1, p2 = positions[[i0, i1, i2]]
                    edge1 = p1 - p0
                    edge2 = p2 - p0
                    face_normal = np.cross(edge1, edge2)
                    for vertex in face_key:
                        normals[vertex] += face_normal
                        referenced[vertex] = True
                    if uvs is not None and tangent_accessor is not None:
                        uv0, uv1, uv2 = uvs[[i0, i1, i2], :2]
                        delta1 = uv1 - uv0
                        delta2 = uv2 - uv0
                        denominator = delta1[0] * delta2[1] - delta1[1] * delta2[0]
                        if abs(float(denominator)) > 1e-12:
                            reciprocal = 1.0 / float(denominator)
                            tangent = (edge1 * delta2[1] - edge2 * delta1[1]) * reciprocal
                            bitangent = (edge2 * delta1[0] - edge1 * delta2[0]) * reciprocal
                            for vertex in face_key:
                                tangent_accum[vertex] += tangent
                                bitangent_accum[vertex] += bitangent
            old_normals = read_accessor(document, bytes(binary), normal_accessor).astype(np.float64)
            lengths = np.linalg.norm(normals, axis=1)
            valid = referenced & (lengths > 1e-12)
            normals[valid] /= lengths[valid, None]
            normals[~valid] = old_normals[~valid]
            normal_updates[normal_accessor] = normals
            if tangent_accessor is not None:
                old_tangents = read_accessor(document, bytes(binary), tangent_accessor).astype(np.float64)
                tangents = old_tangents.copy()
                for vertex in np.where(valid)[0]:
                    tangent = tangent_accum[vertex] - normals[vertex] * np.dot(normals[vertex], tangent_accum[vertex])
                    length = float(np.linalg.norm(tangent))
                    if length <= 1e-12:
                        continue
                    tangent /= length
                    handedness = -1.0 if np.dot(np.cross(normals[vertex], tangent), bitangent_accum[vertex]) < 0.0 else 1.0
                    tangents[vertex, :3] = tangent
                    tangents[vertex, 3] = handedness
                tangent_updates[tangent_accessor] = tangents
            processed_groups += 1
    for accessor_index, values in normal_updates.items():
        write_accessor(document, binary, accessor_index, values)
    for accessor_index, values in tangent_updates.items():
        write_accessor(document, binary, accessor_index, values)
    return {
        "groups": processed_groups,
        "normalAccessors": sorted(normal_updates),
        "tangentAccessors": sorted(tangent_updates),
    }


def measure_candidate(
    positions: np.ndarray,
    region_faces: dict[str, np.ndarray],
    region_vertices: dict[str, np.ndarray],
    edge_members: dict[tuple[int, int], list[tuple[str, int]]],
    fork_vertex: int,
    peduncle_u_total: float,
) -> dict[str, Any]:
    tail_y = float(positions[:, 1].min())
    snout_y = float(positions[:, 1].max())
    total_length = snout_y - tail_y
    fork_y = float(positions[fork_vertex, 1])
    fork_length = snout_y - fork_y
    body_names = ["body_core", "upper_jaw", "lower_jaw", "eye", "operculum_candidate"]
    body_vertex_ids = np.unique(np.concatenate([region_vertices[name] for name in body_names])).astype(np.int64)
    body_points = positions[body_vertex_ids]
    profile = profile_metrics(body_points, fork_y, fork_length)
    components = {
        name: component_topology(name, region_faces, positions, edge_members, fork_y, fork_length)
        for name in ("pectoral_fin", "dorsal_fin", "anal_fin")
    }
    pectoral = max(
        (component_metric(component, positions, fork_length, "distance") for component in components["pectoral_fin"]),
        default=0.0,
    )
    dorsal_groups = group_mirrored_components(components["dorsal_fin"])
    if len(dorsal_groups) < 3 or len(dorsal_groups[0]) != 2 or len(dorsal_groups[1]) != 2:
        raise ValueError(f"candidate dorsal anatomy unresolved: {[len(group) for group in dorsal_groups]}")
    first_dorsal_group = dorsal_groups[0]
    second_dorsal_group = dorsal_groups[1]
    first_dorsal_heights = [
        component_metric(component, positions, fork_length, "dorsal") for component in first_dorsal_group
    ]
    second_dorsal_heights = [
        component_metric(component, positions, fork_length, "dorsal") for component in second_dorsal_group
    ]
    second_dorsal_height = max(second_dorsal_heights)
    anal_height = max(
        (component_metric(component, positions, fork_length, "ventral") for component in components["anal_fin"]),
        default=0.0,
    )
    head_vertices = np.unique(
        np.concatenate(
            [
                region_vertices["upper_jaw"],
                region_vertices["lower_jaw"],
                region_vertices["eye"],
                region_vertices["operculum_candidate"],
            ]
        )
    ).astype(np.int64)
    head_length = snout_y - float(positions[head_vertices, 1].min())
    caudal_vertices = np.union1d(region_vertices["caudal_upper"], region_vertices["caudal_lower"])
    caudal_span = float(positions[caudal_vertices, 2].max() - positions[caudal_vertices, 2].min())
    peduncle_y = tail_y + peduncle_u_total * total_length
    peduncle_select = np.abs(body_points[:, 1] - peduncle_y) <= total_length * 0.008
    peduncle_points = body_points[peduncle_select]
    peduncle_depth = float(peduncle_points[:, 2].max() - peduncle_points[:, 2].min())
    peduncle_width = float(peduncle_points[:, 0].max() - peduncle_points[:, 0].min())
    first_root_vertex_ids = np.unique(
        np.concatenate([component["rootVertexIds"] for component in first_dorsal_group])
    ).astype(np.int64)
    first_root_points = positions[first_root_vertex_ids]
    first_base_u = [
        float((first_root_points[:, 1].min() - fork_y) / fork_length),
        float((first_root_points[:, 1].max() - fork_y) / fork_length),
    ]
    deepest_u = float(profile["deepest"]["u"])
    return {
        "forkLength": clean_float(fork_length),
        "forkOverTotalLength": clean_float(fork_length / total_length),
        "maximumBodyDepthOverForkLength": profile["deepest"]["depthOverForkLength"],
        "maximumBodyDepthU": profile["deepest"]["u"],
        "maximumBodyWidthOverForkLength": profile["widest"]["widthOverForkLength"],
        "maximumBodyWidthU": profile["widest"]["u"],
        "semanticHeadLengthOverForkLength": clean_float(head_length / fork_length),
        "pectoralLengthOverForkLength": clean_float(pectoral),
        "secondDorsalHeightOverForkLength": clean_float(second_dorsal_height),
        "firstDorsalSurfaceHeightSpread": clean_float(max(first_dorsal_heights) - min(first_dorsal_heights), 12),
        "secondDorsalSurfaceHeightSpread": clean_float(max(second_dorsal_heights) - min(second_dorsal_heights), 12),
        "dorsalAnatomicalGroupCount": len(dorsal_groups),
        "firstDorsalSurfaceCount": len(first_dorsal_group),
        "secondDorsalSurfaceCount": len(second_dorsal_group),
        "analHeightOverForkLength": clean_float(anal_height),
        "caudalVerticalSpanOverForkLength": clean_float(caudal_span / fork_length),
        "peduncleDepthOverForkLength": clean_float(peduncle_depth / fork_length),
        "peduncleWidthOverForkLength": clean_float(peduncle_width / fork_length),
        "deepestBodyNearFirstDorsalBase": bool(first_base_u[0] - 0.08 <= deepest_u <= first_base_u[1] + 0.08),
        "firstDorsalBaseURange": vector(first_base_u),
    }


def within(value: float, window: list[float]) -> bool:
    return float(window[0]) <= float(value) <= float(window[1])


def build(args: argparse.Namespace) -> dict[str, Any]:
    controls = load_json(args.controls)
    baseline = load_json(args.baseline)
    status = load_json(args.status)
    source_raw, source_document, source_binary = read_glb(args.input)
    if sha256_bytes(source_raw) != EXPECTED_COPY_SHA256 or len(source_raw) != EXPECTED_COPY_BYTES:
        raise ValueError("Candidate A input is not the frozen Source Copy")
    if baseline.get("gates", {}).get("baselineAuditPassed") is not True:
        raise ValueError("baseline audit must pass before Candidate A")
    if status.get("phase") != "FROZEN_BASELINE_AUDITED":
        raise ValueError(f"unexpected correction phase: {status.get('phase')}")

    candidate_document = copy.deepcopy(source_document)
    candidate_binary = bytearray(source_binary)
    region_primitives, region_faces, region_vertices = extract_regions(source_document, source_binary)
    edge_members = build_edge_members(region_faces)
    main_position_accessor = int(region_primitives["body_core"]["attributes"]["POSITION"])

    source_nodes = source_document["nodes"]
    parents = parent_map(source_nodes)
    mesh_nodes_by_mesh: dict[int, list[int]] = defaultdict(list)
    for node_index, node in enumerate(source_nodes):
        if "mesh" in node:
            mesh_nodes_by_mesh[int(node["mesh"])].append(node_index)
    for mesh_index, mesh_nodes in mesh_nodes_by_mesh.items():
        if len(mesh_nodes) != 1:
            raise ValueError(f"mesh {mesh_index} is instanced by multiple nodes; Candidate A requires one deformation frame")
    mesh_node = int(baseline["frame"]["meshNode"])
    if mesh_nodes_by_mesh[0] != [mesh_node]:
        raise ValueError("primary mesh node drift")
    mesh_world = world_matrix(source_nodes, parents, mesh_node)
    inverse_mesh_world = np.linalg.inv(mesh_world)

    local_main_positions = read_accessor(source_document, source_binary, main_position_accessor).astype(np.float64)
    world_main_positions = transform_points(local_main_positions, mesh_world)
    fork_vertex = int(baseline["frame"]["forkInference"]["forkVertex"])
    fork_y = float(baseline["frame"]["forkInference"]["forkY"])
    fork_length = float(baseline["frame"]["forkInference"]["forkLength"])

    skin = source_document["skins"][0]
    joint_nodes = [int(value) for value in skin["joints"]]
    joint_names = [source_nodes[index].get("name", f"node_{index}") for index in joint_nodes]
    inverse_bind = read_accessor(source_document, source_binary, int(skin["inverseBindMatrices"])).astype(np.float64)
    bind_positions: list[np.ndarray] = []
    for row in inverse_bind:
        inverse_matrix = row.reshape(4, 4, order="F")
        bind_positions.append((mesh_world @ np.linalg.inv(inverse_matrix) @ np.array([0.0, 0.0, 0.0, 1.0]))[:3])
    bind_positions_array = np.asarray(bind_positions)
    centerline = body_centerline_function(bind_positions_array, joint_names)
    longitudinal_weight = body_weight_function(controls, fork_y, fork_length)

    body_names = ["body_core", "upper_jaw", "lower_jaw", "eye", "operculum_candidate"]
    body_vertices = np.unique(np.concatenate([region_vertices[name] for name in body_names])).astype(np.int64)
    body_points = world_main_positions[body_vertices]
    target_depth = float(controls["targets"]["maximumBodyDepthOverForkLength"])
    body_amplitude, solved_depth = solve_body_amplitude(
        body_points,
        fork_y,
        fork_length,
        centerline,
        longitudinal_weight,
        target_depth,
    )
    global_deformer = make_global_deformer(centerline, longitudinal_weight, body_amplitude)
    global_main_positions = global_deformer(world_main_positions)
    candidate_main_positions = global_main_positions.copy()

    component_source = {
        name: component_topology(name, region_faces, world_main_positions, edge_members, fork_y, fork_length)
        for name in ("pectoral_fin", "dorsal_fin", "anal_fin")
    }
    component_global = {
        name: component_topology(name, region_faces, global_main_positions, edge_members, fork_y, fork_length)
        for name in ("pectoral_fin", "dorsal_fin", "anal_fin")
    }

    pectoral_target = float(controls["targets"]["pectoralLengthOverForkLength"])
    pectoral_configs: list[dict[str, Any]] = []
    pectoral_factors: list[float] = []
    pectoral_solved_metrics: list[float] = []
    for source_component, global_component in zip(component_source["pectoral_fin"], component_global["pectoral_fin"], strict=True):
        factor, solved_metric = solve_component_extension_factor(
            candidate_main_positions,
            global_component,
            pectoral_target,
            fork_length,
            "isotropic",
            "distance",
        )
        extend_component_vertices(candidate_main_positions, global_component, factor, "isotropic")
        pectoral_factors.append(factor)
        pectoral_solved_metrics.append(solved_metric)
        pectoral_configs.append(component_point_deformer(global_component, global_main_positions, factor, "isotropic"))

    dorsal_surface_groups = group_mirrored_components(component_global["dorsal_fin"])
    if len(dorsal_surface_groups) < 3:
        raise ValueError(f"second dorsal anatomy is missing: {len(dorsal_surface_groups)} groups")
    first_dorsal_surfaces = dorsal_surface_groups[0]
    second_dorsal_surfaces = dorsal_surface_groups[1]
    if len(first_dorsal_surfaces) != 2 or len(second_dorsal_surfaces) != 2:
        raise ValueError(
            "first and second dorsal fins must each have two mirrored sheets: "
            f"{[len(group) for group in dorsal_surface_groups]}"
        )
    second_dorsal_target = float(controls["targets"]["secondDorsalHeightOverForkLength"])
    second_dorsal_factors: list[float] = []
    second_dorsal_solved_metrics: list[float] = []
    second_dorsal_configs: list[dict[str, Any]] = []
    for second_dorsal_component in second_dorsal_surfaces:
        factor, solved_metric = solve_component_extension_factor(
            candidate_main_positions,
            second_dorsal_component,
            second_dorsal_target,
            fork_length,
            "vertical",
            "dorsal",
        )
        extend_component_vertices(candidate_main_positions, second_dorsal_component, factor, "vertical")
        second_dorsal_factors.append(factor)
        second_dorsal_solved_metrics.append(solved_metric)
        second_dorsal_configs.append(
            component_point_deformer(second_dorsal_component, global_main_positions, factor, "vertical")
        )
    second_dorsal_component_ids = {
        int(component["component"]) for component in second_dorsal_surfaces
    }

    anal_component = max(
        component_global["anal_fin"],
        key=lambda component: component_metric(component, candidate_main_positions, fork_length, "ventral"),
    )
    anal_target = float(controls["targets"]["analHeightOverForkLength"])
    anal_factor, anal_solved_metric = solve_component_extension_factor(
        candidate_main_positions,
        anal_component,
        anal_target,
        fork_length,
        "vertical",
        "ventral",
    )
    extend_component_vertices(candidate_main_positions, anal_component, anal_factor, "vertical")
    anal_config = component_point_deformer(anal_component, global_main_positions, anal_factor, "vertical")

    second_dorsal_config_by_id = {
        int(config["component"]["component"]): config for config in second_dorsal_configs
    }
    dorsal_all_configs = [
        second_dorsal_config_by_id.get(
            int(component["component"]),
            component_point_deformer(component, global_main_positions, 1.0, "vertical"),
        )
        for component in component_global["dorsal_fin"]
    ]
    anal_all_configs = [
        component_point_deformer(component, global_main_positions, 1.0, "vertical")
        for component in component_global["anal_fin"]
    ]
    anal_target_index = next(
        index for index, component in enumerate(component_global["anal_fin"]) if component is anal_component
    )
    anal_all_configs[anal_target_index] = anal_config

    def joint_deformer(point: np.ndarray, name: str) -> np.ndarray:
        globally_deformed = global_deformer(point)
        if name.startswith("SideFin"):
            config = nearest_component(globally_deformed, pectoral_configs)
            return apply_component_to_point(globally_deformed, config) if config else globally_deformed
        if name.startswith("UpperFin"):
            nearest = nearest_component(globally_deformed, dorsal_all_configs)
            if nearest and int(nearest["component"]["component"]) in second_dorsal_component_ids:
                return apply_component_to_point(globally_deformed, nearest)
        if name.startswith("LowerBackFin"):
            nearest = nearest_component(globally_deformed, anal_all_configs)
            if nearest is anal_config:
                return apply_component_to_point(globally_deformed, anal_config)
        return globally_deformed

    candidate_positions: dict[int, np.ndarray] = {}
    accessor_frames: dict[int, tuple[np.ndarray, np.ndarray]] = {}
    for mesh_index, node_indices in mesh_nodes_by_mesh.items():
        node_index = node_indices[0]
        mesh_matrix = world_matrix(source_nodes, parents, node_index)
        inverse_matrix = np.linalg.inv(mesh_matrix)
        for primitive in source_document["meshes"][mesh_index].get("primitives", []):
            attrs = primitive.get("attributes", {})
            if "POSITION" not in attrs:
                continue
            accessor_index = int(attrs["POSITION"])
            if accessor_index in candidate_positions:
                previous_matrix, _ = accessor_frames[accessor_index]
                if not np.allclose(previous_matrix, mesh_matrix, atol=1e-10):
                    raise ValueError(f"POSITION accessor {accessor_index} appears in incompatible mesh frames")
                continue
            local_positions = read_accessor(source_document, source_binary, accessor_index).astype(np.float64)
            world_positions = transform_points(local_positions, mesh_matrix)
            if accessor_index == main_position_accessor:
                deformed_world = candidate_main_positions
            else:
                deformed_world = global_deformer(world_positions)
            deformed_local = transform_points(deformed_world, inverse_matrix)
            candidate_positions[accessor_index] = deformed_local
            accessor_frames[accessor_index] = (mesh_matrix, inverse_matrix)
            write_accessor(candidate_document, candidate_binary, accessor_index, deformed_local)

    rest_rig = update_rest_joints_and_inverse_bind(
        source_document,
        candidate_document,
        candidate_binary,
        mesh_node,
        joint_nodes,
        joint_deformer,
    )
    animation_rig = transform_animation_translations(
        source_document,
        source_binary,
        candidate_document,
        candidate_binary,
        joint_nodes,
        joint_deformer,
    )
    shading = recompute_normals_and_tangents(candidate_document, candidate_binary, candidate_positions)

    asset_extras = candidate_document.setdefault("asset", {}).get("extras")
    if not isinstance(asset_extras, dict):
        asset_extras = {}
    candidate_document["asset"]["extras"] = {
        **asset_extras,
        "kaopuBiologicalCorrection": {
            "schema": "kaopu.fish-mother.yellowfin-biological-correction-candidate/1.0",
            "candidate": CANDIDATE_NAME,
            "frozenInputSha256": EXPECTED_COPY_SHA256,
            "bodyDepthAmplitude": body_amplitude,
            "targetMetrics": controls["targets"],
            "policy": "smooth rest-space cage plus root-pinned fin correction; propagated to bind joints and translation animation",
        },
    }

    output_raw = pack_glb(candidate_document, bytes(candidate_binary))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_bytes(output_raw)
    output_sha = sha256_bytes(output_raw)
    if output_sha == EXPECTED_COPY_SHA256:
        raise ValueError("Candidate A output is byte-identical to frozen input")
    if sha256_bytes(args.input.read_bytes()) != EXPECTED_COPY_SHA256:
        raise ValueError("frozen input changed during Candidate A build")

    reread_raw, reread_document, reread_binary = read_glb(args.output)
    reread_primitives, reread_faces, reread_vertices = extract_regions(reread_document, reread_binary)
    reread_mesh_world = world_matrix(
        reread_document["nodes"], parent_map(reread_document["nodes"]), mesh_node
    )
    reread_main_accessor = int(reread_primitives["body_core"]["attributes"]["POSITION"])
    reread_positions = transform_points(
        read_accessor(reread_document, reread_binary, reread_main_accessor).astype(np.float64),
        reread_mesh_world,
    )
    after = measure_candidate(
        reread_positions,
        reread_faces,
        reread_vertices,
        build_edge_members(reread_faces),
        fork_vertex,
        float(baseline["morphometrics"]["peduncleUFromTailOverTotalExtent"]),
    )
    before = {
        key: baseline["morphometrics"][key]
        for key in (
            "maximumBodyDepthOverForkLength",
            "maximumBodyDepthU",
            "maximumBodyWidthOverForkLength",
            "maximumBodyWidthU",
            "semanticHeadLengthOverForkLength",
            "pectoralLengthOverForkLength",
            "secondDorsalHeightOverForkLength",
            "analHeightOverForkLength",
            "caudalVerticalSpanOverForkLength",
            "peduncleDepthOverForkLength",
            "peduncleWidthOverForkLength",
            "deepestBodyNearFirstDorsalBase",
            "firstDorsalBaseURange",
        )
    }
    windows = controls["acceptanceWindows"]
    material_tables_equal = (
        source_document.get("materials") == reread_document.get("materials")
        and source_document.get("textures") == reread_document.get("textures")
        and source_document.get("images") == reread_document.get("images")
    )
    region_face_count = sum(len(faces) for faces in reread_faces.values())
    gates = {
        "frozenInputShaPreserved": sha256_bytes(args.input.read_bytes()) == EXPECTED_COPY_SHA256,
        "outputSeparatedFromFrozenInput": args.output.resolve() != args.input.resolve() and output_sha != EXPECTED_COPY_SHA256,
        "semanticRegionCountRetained": len(reread_primitives) == 13,
        "semanticFaceInventoryRetained": region_face_count == 6920,
        "skinCountRetained": len(reread_document.get("skins", [])) == 1,
        "jointCountRetained": len(reread_document["skins"][0]["joints"]) == 98,
        "animationCountRetained": len(reread_document.get("animations", [])) == 1,
        "materialTextureImageTablesRetained": material_tables_equal,
        "materialCountRetained": len(reread_document.get("materials", [])) == 3,
        "imageCountRetained": len(reread_document.get("images", [])) == 6,
        "finletCountsRetained": controls["invariants"]["dorsalFinlets"] == 9 and controls["invariants"]["ventralFinlets"] == 8,
        "restSkinIdentityPassed": rest_rig["maximumRestSkinIdentityError"] <= 1e-7,
        "restJointPropagationPassed": rest_rig["maximumRestJointOriginError"] <= 1e-7,
        "animationTranslationPropagationPassed": animation_rig["maximumJointOriginPropagationError"] <= 1e-6,
        "bodyDepthTargetPassed": within(after["maximumBodyDepthOverForkLength"], windows["maximumBodyDepthOverForkLength"]),
        "headLengthPreservedWithinEnvelope": within(after["semanticHeadLengthOverForkLength"], windows["semanticHeadLengthOverForkLength"]),
        "pectoralPublishedRangeCandidatePassed": within(after["pectoralLengthOverForkLength"], windows["pectoralLengthOverForkLength"]),
        "secondDorsalCandidatePassed": within(after["secondDorsalHeightOverForkLength"], windows["secondDorsalHeightOverForkLength"]),
        "analCandidatePassed": within(after["analHeightOverForkLength"], windows["analHeightOverForkLength"]),
        "caudalSpanPreserved": within(after["caudalVerticalSpanOverForkLength"], windows["caudalVerticalSpanOverForkLength"]),
        "peduncleDepthPreserved": within(after["peduncleDepthOverForkLength"], windows["peduncleDepthOverForkLength"]),
        "deepestBodyLocationPreserved": after["deepestBodyNearFirstDorsalBase"] is True,
        "dorsalAnatomicalSurfaceGroupsResolved": (
            after["dorsalAnatomicalGroupCount"] >= 3
            and after["firstDorsalSurfaceCount"] == 2
            and after["secondDorsalSurfaceCount"] == 2
        ),
        "firstDorsalSurfaceSymmetryPassed": after["firstDorsalSurfaceHeightSpread"] <= 1e-6,
        "secondDorsalSurfaceSymmetryPassed": after["secondDorsalSurfaceHeightSpread"] <= 1e-6,
        "candidateBrowserQAPassed": False,
        "manualVisualAcceptancePending": True,
        "productionReady": False,
    }
    required = [
        key
        for key in gates
        if key not in {"candidateBrowserQAPassed", "manualVisualAcceptancePending", "productionReady"}
    ]
    failed = [key for key in required if gates[key] is not True]
    if failed:
        raise ValueError(f"Candidate A machine gates failed: {failed}; after={after}")
    gates["candidateMachineAcceptancePassed"] = True

    displacement = reread_positions - world_main_positions
    displacement_norm = np.linalg.norm(displacement, axis=1)
    receipt = {
        "schema": "kaopu.fish-mother.yellowfin-biological-correction-candidate/1.0",
        "date": "2026-09-21",
        "candidate": CANDIDATE_NAME,
        "frozenInput": {
            "path": args.input.as_posix(),
            "sha256": EXPECTED_COPY_SHA256,
            "bytes": len(source_raw),
            "commit": baseline["frozenInput"]["commit"],
            "immutable": True,
        },
        "output": {
            "path": args.output.as_posix(),
            "sha256": output_sha,
            "bytes": len(output_raw),
            "meshCount": len(reread_document.get("meshes", [])),
            "primitiveCount": sum(len(mesh.get("primitives", [])) for mesh in reread_document.get("meshes", [])),
            "nodeCount": len(reread_document.get("nodes", [])),
            "skinCount": len(reread_document.get("skins", [])),
            "jointCount": len(reread_document["skins"][0]["joints"]),
            "animationCount": len(reread_document.get("animations", [])),
            "materialCount": len(reread_document.get("materials", [])),
            "imageCount": len(reread_document.get("images", [])),
            "semanticRegionCount": len(reread_primitives),
            "semanticFaceCount": region_face_count,
        },
        "controls": {
            "bodyDepthAmplitude": clean_float(body_amplitude),
            "solvedGlobalBodyDepth": clean_float(solved_depth),
            "pectoralFactors": vector(pectoral_factors),
            "pectoralSolvedMetrics": vector(pectoral_solved_metrics),
            "secondDorsalFactor": clean_float(second_dorsal_factors[0]),
            "secondDorsalFactors": vector(second_dorsal_factors),
            "secondDorsalSolvedMetric": clean_float(max(second_dorsal_solved_metrics)),
            "secondDorsalSolvedMetrics": vector(second_dorsal_solved_metrics),
            "analFactor": clean_float(anal_factor),
            "analSolvedMetric": clean_float(anal_solved_metric),
            "targets": controls["targets"],
            "acceptanceWindows": windows,
        },
        "before": before,
        "after": after,
        "delta": {
            key: clean_float(float(after[key]) - float(before[key]))
            for key in (
                "maximumBodyDepthOverForkLength",
                "semanticHeadLengthOverForkLength",
                "pectoralLengthOverForkLength",
                "secondDorsalHeightOverForkLength",
                "analHeightOverForkLength",
                "caudalVerticalSpanOverForkLength",
                "peduncleDepthOverForkLength",
                "peduncleWidthOverForkLength",
            )
        },
        "deformation": {
            "maximumPrimaryVertexDisplacementOverForkLength": clean_float(float(displacement_norm.max()) / fork_length),
            "meanPrimaryVertexDisplacementOverForkLength": clean_float(float(displacement_norm.mean()) / fork_length),
            "changedPrimaryVertices": int(np.count_nonzero(displacement_norm > 1e-8)),
            "primaryVertices": int(len(displacement_norm)),
            "firstDorsalIndependentlyElongated": False,
            "secondDorsalMirroredSheetsDeformedTogether": True,
            "caudalIndependentlyRescaled": False,
            "finletCountChanged": False,
        },
        "rig": {
            "rest": rest_rig,
            "animation": animation_rig,
            "shading": shading,
            "policy": controls["rigPolicy"],
        },
        "componentSelection": {
            "pectoral": [component_summary(component, fork_length) for component in component_global["pectoral_fin"]],
            "dorsalAnatomicalGroups": [
                anatomical_group_summary(group, fork_length) for group in dorsal_surface_groups
            ],
            "firstDorsalSurfaces": [
                component_summary(component, fork_length) for component in first_dorsal_surfaces
            ],
            "secondDorsalSurfaces": [
                component_summary(component, fork_length) for component in second_dorsal_surfaces
            ],
            "anal": component_summary(anal_component, fork_length),
        },
        "gates": gates,
        "risks": [
            "Candidate A is a machine-valid morphometric candidate, not a visually approved final fish.",
            "Nonlinear rest-space correction is approximated through the existing 98-joint rig; extreme poses may still reveal volume loss or local creasing.",
            "Dorsal anatomical identity is resolved from mirrored surface pairs, not raw connected-component order.",
            "The inferred fork landmark remains a machine hypothesis and must be checked in the browser overlay.",
            "Published adult fin elongation is variable; the 0.18 FL target is a declared large-adult design candidate, not universal species truth.",
        ],
        "next": "Run synchronized frozen-vs-Candidate-A browser QA in rest pose and Swim, capture fixed views, verify console zero errors, silhouette, eye/cornea attachment and fin-root continuity.",
    }
    write_json(args.receipt, receipt)

    status["phase"] = "CANDIDATE_A_GENERATED_MACHINE_ACCEPTED"
    status.setdefault("gates", {}).update(
        {
            "sourceCopyFrozen": True,
            "sourceCopyImmutable": True,
            "evidenceContractWritten": True,
            "morphometricBaselineAudited": True,
            "forkLengthInferenceValid": True,
            "skinInfluenceAuditPassed": True,
            "animationChannelAuditPassed": True,
            "correctionCandidateGenerated": True,
            "candidateMachineAcceptancePassed": True,
            "candidateBrowserQAPassed": False,
            "manualVisualAcceptancePending": True,
            "productionReady": False,
        }
    )
    status["candidateA"] = {
        "glb": str(args.output.relative_to(args.status.parent).as_posix()),
        "receipt": args.receipt.name,
        "sha256": output_sha,
        "bytes": len(output_raw),
        "before": before,
        "after": after,
    }
    status["next"] = receipt["next"]
    write_json(args.status, status)

    baseline_state_path = Path("CURRENT_BASELINE.json")
    baseline_state = load_json(baseline_state_path)
    active = baseline_state.setdefault("activeState", {})
    active.update(
        {
            "phase": "YELLOWFIN_BIOLOGICAL_CORRECTION_R001_CANDIDATE_A_MACHINE_ACCEPTED",
            "workBranch": "work/ocean-life-fish-mother-yellowfin-biological-correction-r001-20260921",
            "frozenSourceCopyCommit": baseline["frozenInput"]["commit"],
            "frozenSourceCopySha256": EXPECTED_COPY_SHA256,
            "frozenSourceCopyImmutable": True,
            "biologicalCorrectionCandidate": args.output.as_posix(),
            "biologicalCorrectionCandidateReceipt": args.receipt.as_posix(),
            "biologicalCorrectionCandidateSha256": output_sha,
            "correctionCandidateGenerated": True,
            "candidateMachineAcceptancePassed": True,
            "candidateBrowserQAPassed": False,
            "manualVisualAcceptancePending": True,
            "productionReady": False,
            "nextAllowedBuild": "YELLOWFIN-BIOLOGICAL-CORRECTION-R001-CANDIDATE-A-BROWSER-QA",
        }
    )
    write_json(baseline_state_path, baseline_state)
    return receipt


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--baseline", type=Path, required=True)
    parser.add_argument("--controls", type=Path, required=True)
    parser.add_argument("--status", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--receipt", type=Path, required=True)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    receipt = build(args)
    print(
        json.dumps(
            {
                "ok": True,
                "candidate": receipt["candidate"],
                "output": receipt["output"],
                "before": receipt["before"],
                "after": receipt["after"],
                "rig": receipt["rig"],
                "next": receipt["next"],
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
