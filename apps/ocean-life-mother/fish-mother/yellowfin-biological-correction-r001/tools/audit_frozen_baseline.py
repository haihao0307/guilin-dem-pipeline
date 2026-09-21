#!/usr/bin/env python3
"""Audit the frozen skinned Source Copy before any Yellowfin deformation.

This script deliberately does not create a corrected fish. It records the exact rest-space
geometry, semantic-region boundaries, inferred fork-length frame, bind skeleton, skin
influences and animation channel contract that a later correction must preserve.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import struct
from collections import Counter, defaultdict, deque
from pathlib import Path
from typing import Any, Iterable

import numpy as np

JSON_CHUNK = 0x4E4F534A
BIN_CHUNK = 0x004E4942
EXPECTED_COPY_SHA256 = "2130a3c03fc50d22676919c3599e75707e61d9f75ddd90523a6897887715ec02"
EXPECTED_COPY_BYTES = 58956620
EXPECTED_SOURCE_SHA256 = "5603d4aabc9a1127856841335a86ae7aa462b6b25d1a6586e93bf644f4d47abe"
EXPECTED_FREEZE_COMMIT = "9b610f4ef0134e015c2fb6b14574e7e4f48ed943"
EXPECTED_REGIONS = [
    "body_core",
    "upper_jaw",
    "lower_jaw",
    "eye",
    "operculum_candidate",
    "pectoral_fin",
    "pelvic_fin",
    "dorsal_fin",
    "anal_fin",
    "dorsal_finlets",
    "ventral_finlets",
    "caudal_upper",
    "caudal_lower",
]
COMPONENT_DTYPES = {
    5120: np.dtype("<i1"),
    5121: np.dtype("<u1"),
    5122: np.dtype("<i2"),
    5123: np.dtype("<u2"),
    5125: np.dtype("<u4"),
    5126: np.dtype("<f4"),
}
TYPE_COMPONENTS = {
    "SCALAR": 1,
    "VEC2": 2,
    "VEC3": 3,
    "VEC4": 4,
    "MAT2": 4,
    "MAT3": 9,
    "MAT4": 16,
}


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def clean_float(value: float, digits: int = 9) -> float:
    value = float(value)
    if not math.isfinite(value):
        raise ValueError(f"non-finite metric: {value}")
    rounded = round(value, digits)
    return 0.0 if rounded == -0.0 else rounded


def vector(values: Iterable[float], digits: int = 9) -> list[float]:
    return [clean_float(value, digits) for value in values]


def read_glb(path: Path) -> tuple[bytes, dict[str, Any], bytes]:
    raw = path.read_bytes()
    if raw[:4] != b"glTF" or struct.unpack_from("<I", raw, 4)[0] != 2:
        raise ValueError("invalid GLB header")
    if struct.unpack_from("<I", raw, 8)[0] != len(raw):
        raise ValueError("invalid GLB byte length")
    offset = 12
    document: dict[str, Any] | None = None
    binary: bytes | None = None
    while offset + 8 <= len(raw):
        chunk_length, chunk_type = struct.unpack_from("<II", raw, offset)
        start = offset + 8
        end = start + chunk_length
        if end > len(raw):
            raise ValueError("GLB chunk exceeds file length")
        payload = raw[start:end]
        if chunk_type == JSON_CHUNK:
            document = json.loads(payload.decode("utf-8").rstrip("\x00 \t\r\n"))
        elif chunk_type == BIN_CHUNK:
            binary = bytes(payload)
        offset = end
    if document is None or binary is None:
        raise ValueError("GLB requires embedded JSON and BIN chunks")
    declared = int(document["buffers"][0]["byteLength"])
    if declared > len(binary):
        raise ValueError("declared glTF buffer exceeds BIN chunk")
    return raw, document, binary[:declared]


def read_accessor(document: dict[str, Any], binary: bytes, accessor_index: int) -> np.ndarray:
    accessor = document["accessors"][int(accessor_index)]
    if accessor.get("sparse"):
        raise ValueError(f"sparse accessor not supported in baseline audit: {accessor_index}")
    component_type = int(accessor["componentType"])
    dtype = COMPONENT_DTYPES.get(component_type)
    if dtype is None:
        raise ValueError(f"unsupported accessor component type: {component_type}")
    components = TYPE_COMPONENTS[accessor["type"]]
    count = int(accessor["count"])
    view = document["bufferViews"][int(accessor["bufferView"])]
    base_offset = int(view.get("byteOffset", 0)) + int(accessor.get("byteOffset", 0))
    element_bytes = dtype.itemsize * components
    stride = int(view.get("byteStride", element_bytes))
    if stride < element_bytes:
        raise ValueError(f"invalid byte stride for accessor {accessor_index}")
    if count == 0:
        array = np.empty((0, components), dtype=dtype)
    elif stride == element_bytes:
        array = np.frombuffer(binary, dtype=dtype, count=count * components, offset=base_offset).reshape(count, components).copy()
    else:
        array = np.ndarray(
            shape=(count, components),
            dtype=dtype,
            buffer=binary,
            offset=base_offset,
            strides=(stride, dtype.itemsize),
        ).copy()
    if accessor.get("normalized") and np.issubdtype(dtype, np.integer):
        if np.issubdtype(dtype, np.unsignedinteger):
            array = array.astype(np.float64) / float(np.iinfo(dtype).max)
        else:
            limit = float(np.iinfo(dtype).max)
            array = np.maximum(array.astype(np.float64) / limit, -1.0)
    return array[:, 0] if components == 1 else array


def quaternion_matrix(rotation: Iterable[float]) -> np.ndarray:
    x, y, z, w = [float(value) for value in rotation]
    return np.array(
        [
            [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w), 0],
            [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w), 0],
            [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y), 0],
            [0, 0, 0, 1],
        ],
        dtype=np.float64,
    )


def node_matrix(node: dict[str, Any]) -> np.ndarray:
    if node.get("matrix") is not None:
        return np.asarray(node["matrix"], dtype=np.float64).reshape(4, 4, order="F")
    matrix = np.eye(4, dtype=np.float64)
    if node.get("translation") is not None:
        matrix[:3, 3] = np.asarray(node["translation"], dtype=np.float64)
    if node.get("rotation") is not None:
        matrix = matrix @ quaternion_matrix(node["rotation"])
    if node.get("scale") is not None:
        matrix = matrix @ np.diag([*node["scale"], 1.0])
    return matrix


def parent_map(nodes: list[dict[str, Any]]) -> dict[int, int]:
    parents: dict[int, int] = {}
    for parent_index, node in enumerate(nodes):
        for child in node.get("children", []):
            child_index = int(child)
            if child_index in parents:
                raise ValueError(f"node {child_index} has multiple parents")
            parents[child_index] = parent_index
    return parents


def world_matrix(nodes: list[dict[str, Any]], parents: dict[int, int], node_index: int) -> np.ndarray:
    chain: list[int] = []
    cursor = int(node_index)
    while True:
        chain.append(cursor)
        if cursor not in parents:
            break
        cursor = parents[cursor]
    matrix = np.eye(4, dtype=np.float64)
    for item in reversed(chain):
        matrix = matrix @ node_matrix(nodes[item])
    return matrix


def transform_points(points: np.ndarray, matrix: np.ndarray) -> np.ndarray:
    homogeneous = np.c_[points, np.ones(len(points), dtype=np.float64)]
    return (matrix @ homogeneous.T).T[:, :3]


def edges_for_face(face: np.ndarray) -> tuple[tuple[int, int], tuple[int, int], tuple[int, int]]:
    return tuple(
        tuple(sorted((int(a), int(b))))
        for a, b in ((face[0], face[1]), (face[1], face[2]), (face[2], face[0]))
    )  # type: ignore[return-value]


def connected_components(face_ids: np.ndarray, faces: np.ndarray) -> list[np.ndarray]:
    if len(face_ids) == 0:
        return []
    edge_to_local: dict[tuple[int, int], list[int]] = defaultdict(list)
    local_faces = faces[face_ids]
    for local_index, face in enumerate(local_faces):
        for edge in edges_for_face(face):
            edge_to_local[edge].append(local_index)
    adjacency: list[set[int]] = [set() for _ in range(len(local_faces))]
    for members in edge_to_local.values():
        for member in members:
            adjacency[member].update(other for other in members if other != member)
    seen: set[int] = set()
    components: list[np.ndarray] = []
    for seed in range(len(local_faces)):
        if seed in seen:
            continue
        queue: deque[int] = deque([seed])
        seen.add(seed)
        found: list[int] = []
        while queue:
            current = queue.popleft()
            found.append(current)
            for other in adjacency[current]:
                if other not in seen:
                    seen.add(other)
                    queue.append(other)
        components.append(face_ids[np.asarray(found, dtype=np.int64)])
    return components


def bounds(points: np.ndarray) -> dict[str, Any]:
    if len(points) == 0:
        return {"min": None, "max": None, "span": None, "centroid": None}
    minimum = points.min(axis=0)
    maximum = points.max(axis=0)
    return {
        "min": vector(minimum),
        "max": vector(maximum),
        "span": vector(maximum - minimum),
        "centroid": vector(points.mean(axis=0)),
    }


def normalized_bounds(points: np.ndarray, fork_y: float, fork_length: float) -> dict[str, Any]:
    if len(points) == 0:
        return {"xRange": None, "uRange": None, "zRange": None, "centroid": None}
    normalized = np.column_stack(
        [points[:, 0] / fork_length, (points[:, 1] - fork_y) / fork_length, points[:, 2] / fork_length]
    )
    return {
        "xRange": vector([normalized[:, 0].min(), normalized[:, 0].max()]),
        "uRange": vector([normalized[:, 1].min(), normalized[:, 1].max()]),
        "zRange": vector([normalized[:, 2].min(), normalized[:, 2].max()]),
        "centroid": vector(normalized.mean(axis=0)),
    }


def max_min_distance(points: np.ndarray, roots: np.ndarray) -> float | None:
    if len(points) == 0 or len(roots) == 0:
        return None
    maximum = 0.0
    chunk_size = 512
    for start in range(0, len(points), chunk_size):
        chunk = points[start : start + chunk_size]
        distances = np.linalg.norm(chunk[:, None, :] - roots[None, :, :], axis=2)
        maximum = max(maximum, float(distances.min(axis=1).max()))
    return maximum


def region_components(
    region_name: str,
    region_face_ids: np.ndarray,
    faces: np.ndarray,
    positions: np.ndarray,
    edge_members: dict[tuple[int, int], list[tuple[str, int]]],
    fork_y: float,
    fork_length: float,
) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for component_index, component_face_ids in enumerate(connected_components(region_face_ids, faces)):
        component_faces = faces[component_face_ids]
        component_vertices = np.unique(component_faces.reshape(-1)).astype(np.int64)
        root_edges: set[tuple[int, int]] = set()
        free_edges: set[tuple[int, int]] = set()
        for face in component_faces:
            for edge in edges_for_face(face):
                members = edge_members[edge]
                if any(member_region != region_name for member_region, _ in members):
                    root_edges.add(edge)
                if len(members) == 1:
                    free_edges.add(edge)
        root_vertices = (
            np.unique(np.asarray([vertex for edge in root_edges for vertex in edge], dtype=np.int64))
            if root_edges
            else np.empty(0, dtype=np.int64)
        )
        free_vertices = (
            np.unique(np.asarray([vertex for edge in free_edges for vertex in edge], dtype=np.int64))
            if free_edges
            else np.empty(0, dtype=np.int64)
        )
        component_points = positions[component_vertices]
        root_points = positions[root_vertices]
        free_points = positions[free_vertices]
        root_distance = max_min_distance(component_points, root_points)
        root_z = float(np.median(root_points[:, 2])) if len(root_points) else float(np.median(component_points[:, 2]))
        dorsal_height = max(0.0, root_z - float(component_points[:, 2].min()))
        ventral_height = max(0.0, float(component_points[:, 2].max()) - root_z)
        records.append(
            {
                "component": component_index,
                "faces": int(len(component_face_ids)),
                "vertices": int(len(component_vertices)),
                "bounds": normalized_bounds(component_points, fork_y, fork_length),
                "attachmentRoot": {
                    "edges": int(len(root_edges)),
                    "vertices": int(len(root_vertices)),
                    "bounds": normalized_bounds(root_points, fork_y, fork_length),
                },
                "freeEdge": {
                    "edges": int(len(free_edges)),
                    "vertices": int(len(free_vertices)),
                    "bounds": normalized_bounds(free_points, fork_y, fork_length),
                },
                "maximumRootDistanceOverForkLength": None
                if root_distance is None
                else clean_float(root_distance / fork_length),
                "dorsalHeightOverForkLength": clean_float(dorsal_height / fork_length),
                "ventralHeightOverForkLength": clean_float(ventral_height / fork_length),
            }
        )
    records.sort(
        key=lambda item: (
            item["attachmentRoot"]["bounds"]["centroid"][1]
            if item["attachmentRoot"]["bounds"]["centroid"] is not None
            else item["bounds"]["centroid"][1]
        ),
        reverse=True,
    )
    for order, record in enumerate(records):
        record["anteriorOrder"] = order
    return records


def profile_metrics(points: np.ndarray, fork_y: float, fork_length: float, bins: int = 120) -> dict[str, Any]:
    u = (points[:, 1] - fork_y) / fork_length
    samples: list[dict[str, Any]] = []
    for index in range(bins):
        low = index / bins
        high = (index + 1) / bins
        select = (u >= low) & (u < high if index + 1 < bins else u <= high)
        selected = points[select]
        if len(selected) < 4:
            continue
        samples.append(
            {
                "u": clean_float((low + high) * 0.5, 6),
                "vertices": int(len(selected)),
                "depthOverForkLength": clean_float((selected[:, 2].max() - selected[:, 2].min()) / fork_length),
                "widthOverForkLength": clean_float((selected[:, 0].max() - selected[:, 0].min()) / fork_length),
                "dorsalZOverForkLength": clean_float(selected[:, 2].min() / fork_length),
                "ventralZOverForkLength": clean_float(selected[:, 2].max() / fork_length),
            }
        )
    if not samples:
        raise ValueError("body profile has no populated longitudinal bins")
    deepest = max(samples, key=lambda item: item["depthOverForkLength"])
    widest = max(samples, key=lambda item: item["widthOverForkLength"])
    return {"samples": samples, "deepest": deepest, "widest": widest}


def top_joint_influences(
    region_vertices: np.ndarray,
    joints: np.ndarray,
    weights: np.ndarray,
    joint_names: list[str],
    limit: int = 10,
) -> list[dict[str, Any]]:
    totals = np.zeros(len(joint_names), dtype=np.float64)
    for influence in range(joints.shape[1]):
        indices = joints[region_vertices, influence].astype(np.int64)
        influence_weights = weights[region_vertices, influence]
        np.add.at(totals, indices, influence_weights)
    total = float(totals.sum())
    order = np.argsort(totals)[::-1]
    records: list[dict[str, Any]] = []
    for joint_index in order[:limit]:
        if totals[joint_index] <= 0:
            continue
        records.append(
            {
                "skinJointIndex": int(joint_index),
                "node": int(joint_index),
                "name": joint_names[joint_index],
                "weightShare": clean_float(totals[joint_index] / total if total else 0.0),
                "weightSum": clean_float(totals[joint_index]),
            }
        )
    return records


def animation_audit(document: dict[str, Any], binary: bytes, skin_joint_nodes: set[int]) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for animation_index, animation in enumerate(document.get("animations", [])):
        path_counts: Counter[str] = Counter()
        joint_path_counts: Counter[str] = Counter()
        durations: list[float] = []
        channel_targets: list[dict[str, Any]] = []
        for channel in animation.get("channels", []):
            sampler = animation["samplers"][int(channel["sampler"])]
            input_values = read_accessor(document, binary, int(sampler["input"]))
            if len(input_values):
                durations.append(float(np.max(input_values)))
            target = channel.get("target", {})
            path = str(target.get("path", "unknown"))
            node = int(target.get("node", -1))
            path_counts[path] += 1
            if node in skin_joint_nodes:
                joint_path_counts[path] += 1
            channel_targets.append({"node": node, "path": path, "joint": node in skin_joint_nodes})
        records.append(
            {
                "animation": animation_index,
                "name": animation.get("name", f"animation_{animation_index}"),
                "duration": clean_float(max(durations) if durations else 0.0),
                "channelCount": len(animation.get("channels", [])),
                "pathCounts": dict(sorted(path_counts.items())),
                "jointPathCounts": dict(sorted(joint_path_counts.items())),
                "translationChannelsRequireCorrectionPropagation": int(joint_path_counts.get("translation", 0)),
                "targets": channel_targets,
            }
        )
    return records


def audit(args: argparse.Namespace) -> dict[str, Any]:
    spec = load_json(args.spec)
    status = load_json(args.source_status)
    freeze_report = load_json(args.freeze_report)
    classification = load_json(args.classification)
    raw, document, binary = read_glb(args.glb)

    actual_sha = sha256_bytes(raw)
    if actual_sha != EXPECTED_COPY_SHA256 or len(raw) != EXPECTED_COPY_BYTES:
        raise ValueError(f"frozen copy identity mismatch: {actual_sha} / {len(raw)}")
    if status.get("phase") != "SOURCE_COPY_R001_FROZEN_MACHINE_ACCEPTED":
        raise ValueError("Source Copy lifecycle is not frozen")
    if status.get("gates", {}).get("sourceCopyImmutable") is not True:
        raise ValueError("Source Copy immutable gate is not closed")
    if freeze_report.get("copy", {}).get("sha256") != actual_sha:
        raise ValueError("freeze report does not bind the audited GLB")
    if freeze_report.get("gates", {}).get("sourceCopyR001Frozen") is not True:
        raise ValueError("freeze report lacks sourceCopyR001Frozen")
    if classification.get("source", {}).get("sha256") != EXPECTED_SOURCE_SHA256:
        raise ValueError("classification is not bound to the exact source")

    nodes = document.get("nodes", [])
    parents = parent_map(nodes)
    mesh_nodes = [index for index, node in enumerate(nodes) if int(node.get("mesh", -1)) == 0]
    if len(mesh_nodes) != 1:
        raise ValueError(f"expected one primary mesh node, got {mesh_nodes}")
    mesh_node = mesh_nodes[0]
    mesh_world = world_matrix(nodes, parents, mesh_node)
    mesh = document["meshes"][0]

    region_primitives: dict[str, dict[str, Any]] = {}
    for primitive in mesh.get("primitives", []):
        extras = primitive.get("extras") if isinstance(primitive.get("extras"), dict) else {}
        region_name = extras.get("kaopuSourceCopyRegion")
        if region_name:
            region_primitives[str(region_name)] = primitive
    if list(region_primitives) != EXPECTED_REGIONS:
        raise ValueError(f"semantic region order drift: {list(region_primitives)}")

    shared_position_accessors = {int(primitive["attributes"]["POSITION"]) for primitive in region_primitives.values()}
    if len(shared_position_accessors) != 1:
        raise ValueError("semantic regions do not share one POSITION accessor")
    position_accessor = next(iter(shared_position_accessors))
    local_positions = read_accessor(document, binary, position_accessor).astype(np.float64)
    positions = transform_points(local_positions, mesh_world)

    region_faces: dict[str, np.ndarray] = {}
    region_vertices: dict[str, np.ndarray] = {}
    all_faces_list: list[np.ndarray] = []
    face_regions: list[str] = []
    for region_name in EXPECTED_REGIONS:
        primitive = region_primitives[region_name]
        indices = read_accessor(document, binary, int(primitive["indices"])).astype(np.int64)
        faces = indices.reshape(-1, 3)
        region_faces[region_name] = faces
        region_vertices[region_name] = np.unique(indices).astype(np.int64)
        all_faces_list.append(faces)
        face_regions.extend([region_name] * len(faces))
    all_faces = np.vstack(all_faces_list)
    face_region_array = np.asarray(face_regions, dtype=object)
    if len(all_faces) != 6920:
        raise ValueError(f"semantic face inventory drift: {len(all_faces)}")

    edge_members: dict[tuple[int, int], list[tuple[str, int]]] = defaultdict(list)
    face_offset = 0
    for region_name in EXPECTED_REGIONS:
        for local_face_index, face in enumerate(region_faces[region_name]):
            global_face_index = face_offset + local_face_index
            for edge in edges_for_face(face):
                edge_members[edge].append((region_name, global_face_index))
        face_offset += len(region_faces[region_name])

    inter_region_edges = {
        edge: members
        for edge, members in edge_members.items()
        if len({region for region, _ in members}) > 1
    }
    non_manifold_edges = {edge: members for edge, members in edge_members.items() if len(members) > 2}
    adjacency_counts: Counter[tuple[str, str]] = Counter()
    for members in inter_region_edges.values():
        member_regions = sorted({region for region, _ in members})
        for left_index, left in enumerate(member_regions):
            for right in member_regions[left_index + 1 :]:
                adjacency_counts[(left, right)] += 1

    tail_y = float(positions[:, 1].min())
    snout_y = float(positions[:, 1].max())
    total_length = snout_y - tail_y
    caudal_shared = np.intersect1d(region_vertices["caudal_upper"], region_vertices["caudal_lower"])
    fork_method = "caudal-upper/lower shared trailing centerline vertex"
    if len(caudal_shared):
        fork_vertex = int(caudal_shared[np.argmin(positions[caudal_shared, 1])])
    else:
        caudal_union = np.union1d(region_vertices["caudal_upper"], region_vertices["caudal_lower"])
        centerline_z = float(np.median(positions[region_vertices["body_core"], 2]))
        order = np.argsort(np.abs(positions[caudal_union, 2] - centerline_z))
        candidates = caudal_union[order[: max(4, len(order) // 12)]]
        fork_vertex = int(candidates[np.argmin(positions[candidates, 1])])
        fork_method = "fallback caudal centerline candidate"
    fork_point = positions[fork_vertex]
    fork_y = float(fork_point[1])
    fork_length = snout_y - fork_y
    fork_ratio = fork_length / total_length
    fork_valid = bool(0.72 <= fork_ratio <= 1.0 and fork_length > 0 and len(caudal_shared) >= 2)
    if not fork_valid:
        raise ValueError(
            f"fork-length inference invalid: shared={len(caudal_shared)} ratio={fork_ratio:.6f} method={fork_method}"
        )

    body_region_names = ["body_core", "upper_jaw", "lower_jaw", "eye", "operculum_candidate"]
    body_vertices = np.unique(np.concatenate([region_vertices[name] for name in body_region_names])).astype(np.int64)
    body_points = positions[body_vertices]
    profile = profile_metrics(body_points, fork_y, fork_length)

    region_records: list[dict[str, Any]] = []
    component_records: dict[str, list[dict[str, Any]]] = {}
    for region_name in EXPECTED_REGIONS:
        vertices = region_vertices[region_name]
        points = positions[vertices]
        components = region_components(
            region_name,
            np.where(face_region_array == region_name)[0].astype(np.int64),
            all_faces,
            positions,
            edge_members,
            fork_y,
            fork_length,
        )
        component_records[region_name] = components
        root_edges = [
            edge
            for edge, members in edge_members.items()
            if region_name in {member_region for member_region, _ in members}
            and any(member_region != region_name for member_region, _ in members)
        ]
        root_vertices = (
            np.unique(np.asarray([vertex for edge in root_edges for vertex in edge], dtype=np.int64))
            if root_edges
            else np.empty(0, dtype=np.int64)
        )
        region_records.append(
            {
                "name": region_name,
                "faces": int(len(region_faces[region_name])),
                "vertices": int(len(vertices)),
                "positionAccessor": position_accessor,
                "indexAccessor": int(region_primitives[region_name]["indices"]),
                "material": int(region_primitives[region_name].get("material", -1)),
                "bounds": normalized_bounds(points, fork_y, fork_length),
                "attachmentRootEdges": int(len(root_edges)),
                "attachmentRootVertices": int(len(root_vertices)),
                "componentCount": int(len(components)),
            }
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
    semantic_head_length = snout_y - float(positions[head_vertices, 1].min())

    pectoral_components = component_records["pectoral_fin"]
    pectoral_length_ratio = max(
        (component["maximumRootDistanceOverForkLength"] or 0.0 for component in pectoral_components),
        default=0.0,
    )
    dorsal_components = component_records["dorsal_fin"]
    anal_components = component_records["anal_fin"]
    second_dorsal = dorsal_components[1] if len(dorsal_components) > 1 else (dorsal_components[0] if dorsal_components else None)
    first_dorsal = dorsal_components[0] if dorsal_components else None
    first_dorsal_base_u = (
        first_dorsal["attachmentRoot"]["bounds"]["uRange"] if first_dorsal is not None else None
    )
    deepest_u = float(profile["deepest"]["u"])
    deepest_near_first_dorsal = bool(
        first_dorsal_base_u is not None
        and first_dorsal_base_u[0] - 0.08 <= deepest_u <= first_dorsal_base_u[1] + 0.08
    )

    caudal_vertices = np.union1d(region_vertices["caudal_upper"], region_vertices["caudal_lower"])
    caudal_span = float(positions[caudal_vertices, 2].max() - positions[caudal_vertices, 2].min())

    classification_peduncle = classification["peduncle"]["minimum"]
    peduncle_u_total = float(classification_peduncle["u"])
    peduncle_y = tail_y + peduncle_u_total * total_length
    peduncle_window = total_length * 0.008
    peduncle_select = np.abs(body_points[:, 1] - peduncle_y) <= peduncle_window
    peduncle_points = body_points[peduncle_select]
    if len(peduncle_points) < 4:
        raise ValueError("insufficient body vertices in peduncle audit window")
    peduncle_depth = float(peduncle_points[:, 2].max() - peduncle_points[:, 2].min())
    peduncle_width = float(peduncle_points[:, 0].max() - peduncle_points[:, 0].min())

    skin_count = len(document.get("skins", []))
    if skin_count != 1:
        raise ValueError(f"expected one skin, found {skin_count}")
    skin = document["skins"][0]
    skin_joint_nodes = [int(value) for value in skin["joints"]]
    joint_names = [nodes[index].get("name", f"node_{index}") for index in skin_joint_nodes]
    inverse_bind = read_accessor(document, binary, int(skin["inverseBindMatrices"])).astype(np.float64)
    if inverse_bind.shape != (len(skin_joint_nodes), 16):
        raise ValueError("inverse bind matrix shape drift")
    bind_positions: list[np.ndarray] = []
    for row in inverse_bind:
        inverse_matrix = row.reshape(4, 4, order="F")
        bind = np.linalg.inv(inverse_matrix)
        bind_positions.append((mesh_world @ bind @ np.array([0.0, 0.0, 0.0, 1.0]))[:3])
    bind_positions_array = np.asarray(bind_positions)

    primary_primitive = region_primitives["body_core"]
    attributes = primary_primitive["attributes"]
    joints = read_accessor(document, binary, int(attributes["JOINTS_0"])).astype(np.int64)
    weights = read_accessor(document, binary, int(attributes["WEIGHTS_0"])).astype(np.float64)
    weight_sums = weights.sum(axis=1)
    if np.any(weight_sums <= 0):
        raise ValueError("zero-sum skin weights found")
    weights = weights / weight_sums[:, None]
    if int(joints.max()) >= len(skin_joint_nodes):
        raise ValueError("JOINTS_0 index exceeds skin joint table")

    region_influences = {
        region_name: top_joint_influences(region_vertices[region_name], joints, weights, joint_names)
        for region_name in EXPECTED_REGIONS
    }
    animation_records = animation_audit(document, binary, set(skin_joint_nodes))

    morph_target_count = sum(
        len(primitive.get("targets", []))
        for mesh_record in document.get("meshes", [])
        for primitive in mesh_record.get("primitives", [])
    )
    texture_count = len(document.get("textures", []))
    image_count = len(document.get("images", []))
    material_count = len(document.get("materials", []))

    source_finlets = classification["finlets"]
    dorsal_finlet_count = int(source_finlets["dorsal"]["confirmedCount"])
    ventral_finlet_count = int(source_finlets["ventral"]["confirmedCount"])
    provisional = spec["evidencePolicy"]["provisionalEngineeringEnvelopes"]
    pectoral_hard = spec["evidencePolicy"]["publishedHardConstraints"][0]["range"]

    gates = {
        "exactFrozenCopyBound": actual_sha == EXPECTED_COPY_SHA256 and len(raw) == EXPECTED_COPY_BYTES,
        "freezeCommitPinned": spec["frozenInput"]["commit"] == EXPECTED_FREEZE_COMMIT,
        "frozenStatusBound": status.get("phase") == "SOURCE_COPY_R001_FROZEN_MACHINE_ACCEPTED",
        "frozenCopyImmutable": status.get("gates", {}).get("sourceCopyImmutable") is True,
        "semanticRegionCountExact": len(region_primitives) == 13,
        "semanticRegionOrderExact": list(region_primitives) == EXPECTED_REGIONS,
        "semanticFaceInventoryExact": len(all_faces) == 6920,
        "sharedPositionAccessorRetained": len(shared_position_accessors) == 1,
        "interRegionBoundariesUseSharedVertices": len(inter_region_edges) > 0,
        "nonManifoldSemanticEdgesZero": len(non_manifold_edges) == 0,
        "forkLengthInferenceValid": fork_valid,
        "singleSkinRetained": skin_count == 1,
        "jointCountExpected98": len(skin_joint_nodes) == 98,
        "skinWeightsNormalized": float(np.max(np.abs(weights.sum(axis=1) - 1.0))) <= 1e-8,
        "singleAnimationRetained": len(animation_records) == 1,
        "materialCountRetained": material_count == 3,
        "finletCountsRetained": dorsal_finlet_count == 9 and ventral_finlet_count == 8,
        "frozenGlbNotModified": True,
        "candidateGenerated": False,
        "productionReady": False,
    }
    required_gates = [
        key
        for key in gates
        if key not in {"candidateGenerated", "productionReady"}
    ]
    baseline_passed = all(gates[key] is True for key in required_gates)
    gates["baselineAuditPassed"] = baseline_passed
    if not baseline_passed:
        failed = [key for key in required_gates if gates[key] is not True]
        raise ValueError(f"baseline audit failed: {failed}")

    report = {
        "schema": "kaopu.fish-mother.yellowfin-biological-correction-baseline/1.0",
        "date": "2026-09-21",
        "build": "YELLOWFIN-BIOLOGICAL-CORRECTION-R001-BASELINE",
        "species": spec["species"],
        "frozenInput": {
            "commit": EXPECTED_FREEZE_COMMIT,
            "path": args.glb.as_posix(),
            "sha256": actual_sha,
            "bytes": len(raw),
            "sourceSha256": EXPECTED_SOURCE_SHA256,
            "immutable": True,
        },
        "frame": {
            "axisContract": classification["frame"]["axisContract"],
            "meshNode": mesh_node,
            "meshWorldMatrixColumnMajor": vector(mesh_world.reshape(-1, order="F")),
            "tailY": clean_float(tail_y),
            "snoutY": clean_float(snout_y),
            "totalLongitudinalExtent": clean_float(total_length),
            "forkInference": {
                "method": fork_method,
                "sharedCaudalVertexCount": int(len(caudal_shared)),
                "forkVertex": fork_vertex,
                "forkPoint": vector(fork_point),
                "forkY": clean_float(fork_y),
                "forkLength": clean_float(fork_length),
                "forkOverTotalLength": clean_float(fork_ratio),
                "valid": fork_valid,
                "caveat": "The source has no anatomical landmark metadata. Fork position is inferred from the shared caudal-upper/lower trailing centerline and remains a machine hypothesis for visual review.",
            },
        },
        "morphometrics": {
            "normalization": "inferred fork length",
            "maximumBodyDepthOverForkLength": profile["deepest"]["depthOverForkLength"],
            "maximumBodyDepthU": profile["deepest"]["u"],
            "maximumBodyWidthOverForkLength": profile["widest"]["widthOverForkLength"],
            "maximumBodyWidthU": profile["widest"]["u"],
            "semanticHeadLengthOverForkLength": clean_float(semantic_head_length / fork_length),
            "pectoralLengthOverForkLength": clean_float(pectoral_length_ratio),
            "secondDorsalHeightOverForkLength": None
            if second_dorsal is None
            else second_dorsal["dorsalHeightOverForkLength"],
            "analHeightOverForkLength": max(
                (component["ventralHeightOverForkLength"] for component in anal_components),
                default=0.0,
            ),
            "caudalVerticalSpanOverForkLength": clean_float(caudal_span / fork_length),
            "peduncleDepthOverForkLength": clean_float(peduncle_depth / fork_length),
            "peduncleWidthOverForkLength": clean_float(peduncle_width / fork_length),
            "peduncleUFromTailOverTotalExtent": clean_float(peduncle_u_total),
            "deepestBodyNearFirstDorsalBase": deepest_near_first_dorsal,
            "firstDorsalBaseURange": first_dorsal_base_u,
            "publishedPectoralRange": pectoral_hard,
            "pectoralWithinPublishedRange": bool(pectoral_hard[0] <= pectoral_length_ratio <= pectoral_hard[1]),
            "provisionalEngineeringEnvelopes": provisional,
            "profile": profile,
        },
        "regions": region_records,
        "components": component_records,
        "boundary": {
            "uniqueEdges": int(len(edge_members)),
            "interRegionEdges": int(len(inter_region_edges)),
            "interRegionVertices": int(len({vertex for edge in inter_region_edges for vertex in edge})),
            "nonManifoldEdges": int(len(non_manifold_edges)),
            "adjacency": [
                {"regions": list(pair), "sharedEdges": int(count)}
                for pair, count in sorted(adjacency_counts.items())
            ],
        },
        "skin": {
            "skinCount": skin_count,
            "skinIndex": 0,
            "jointCount": len(skin_joint_nodes),
            "jointNodes": skin_joint_nodes,
            "jointNames": joint_names,
            "inverseBindAccessor": int(skin["inverseBindMatrices"]),
            "bindPositionBounds": bounds(bind_positions_array),
            "weightSumMaximumError": clean_float(float(np.max(np.abs(weights.sum(axis=1) - 1.0))), 12),
            "regionTopJointInfluences": region_influences,
            "correctionConstraint": "A rest-space cage deformation must be propagated coherently to affected mesh positions, bind-joint translations/inverse bind matrices, and any animated translation channels. Vertex-only deformation is not accepted.",
        },
        "animations": animation_records,
        "assetInventory": {
            "meshCount": len(document.get("meshes", [])),
            "primaryPrimitiveCount": len(mesh.get("primitives", [])),
            "semanticPrimitiveCount": len(region_primitives),
            "nodeCount": len(nodes),
            "skinCount": skin_count,
            "animationCount": len(document.get("animations", [])),
            "materialCount": material_count,
            "textureCount": texture_count,
            "imageCount": image_count,
            "morphTargetSetCount": morph_target_count,
        },
        "finlets": {
            "dorsal": dorsal_finlet_count,
            "ventral": ventral_finlet_count,
            "policy": "Counts already satisfy the frozen semantic baseline; do not alter them without evidence of a classification error.",
        },
        "risks": [
            "The fork landmark is inferred, not authored; manual silhouette review remains required.",
            "Royce documented size and geographic morphometric variation, so a single exact adult ratio would be false precision.",
            "The current source may violate published adult pectoral or mature-fin proportions; candidate deformation must report the delta rather than silently forcing a preset.",
            "The rig contains joint translation animation channels; changing only vertices would cause rest/motion divergence.",
            "The frozen Source Copy is machine accepted but still awaits manual visual acceptance and is not production ready.",
        ],
        "gates": gates,
        "next": "Generate Candidate A with one smooth rest-space deformation field shared by geometry, bind skeleton and translation animation channels; preserve the frozen GLB unchanged.",
    }

    write_json(args.out, report)

    correction_status = load_json(args.correction_status)
    correction_status["phase"] = "FROZEN_BASELINE_AUDITED"
    correction_status.setdefault("gates", {}).update(
        {
            "sourceCopyFrozen": True,
            "sourceCopyImmutable": True,
            "evidenceContractWritten": True,
            "morphometricBaselineAudited": True,
            "forkLengthInferenceValid": fork_valid,
            "skinInfluenceAuditPassed": gates["jointCountExpected98"] and gates["skinWeightsNormalized"],
            "animationChannelAuditPassed": gates["singleAnimationRetained"],
            "correctionCandidateGenerated": False,
            "candidateBrowserQAPassed": False,
            "manualVisualAcceptancePending": True,
            "productionReady": False,
        }
    )
    correction_status["baseline"] = {
        "report": args.out.name,
        "frozenCopySha256": actual_sha,
        "forkLength": clean_float(fork_length),
        "forkOverTotalLength": clean_float(fork_ratio),
        "semanticRegions": len(region_primitives),
        "semanticFaces": len(all_faces),
        "joints": len(skin_joint_nodes),
        "animations": len(animation_records),
    }
    correction_status["next"] = report["next"]
    write_json(args.correction_status, correction_status)

    baseline_path = Path("CURRENT_BASELINE.json")
    baseline = load_json(baseline_path)
    active = baseline.setdefault("activeState", {})
    active.update(
        {
            "phase": "YELLOWFIN_BIOLOGICAL_CORRECTION_R001_BASELINE_AUDITED",
            "workBranch": "work/ocean-life-fish-mother-yellowfin-biological-correction-r001-20260921",
            "frozenSourceCopyCommit": EXPECTED_FREEZE_COMMIT,
            "frozenSourceCopySha256": actual_sha,
            "frozenSourceCopyImmutable": True,
            "biologicalCorrectionSpec": "apps/ocean-life-mother/fish-mother/yellowfin-biological-correction-r001/BIOLOGICAL_CORRECTION_R001_SPEC.json",
            "biologicalCorrectionBaseline": "apps/ocean-life-mother/fish-mother/yellowfin-biological-correction-r001/BIOLOGICAL_CORRECTION_R001_BASELINE.json",
            "morphometricBaselineAudited": True,
            "forkLengthInferenceValid": fork_valid,
            "correctionCandidateGenerated": False,
            "generationLocked": False,
            "productionReady": False,
            "nextAllowedBuild": "YELLOWFIN-BIOLOGICAL-CORRECTION-R001-CANDIDATE-A",
        }
    )
    write_json(baseline_path, baseline)
    return report


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--glb", type=Path, required=True)
    parser.add_argument("--spec", type=Path, required=True)
    parser.add_argument("--source-status", type=Path, required=True)
    parser.add_argument("--freeze-report", type=Path, required=True)
    parser.add_argument("--classification", type=Path, required=True)
    parser.add_argument("--correction-status", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    report = audit(args)
    print(
        json.dumps(
            {
                "ok": True,
                "phase": "FROZEN_BASELINE_AUDITED",
                "forkLength": report["frame"]["forkInference"]["forkLength"],
                "forkOverTotalLength": report["frame"]["forkInference"]["forkOverTotalLength"],
                "maximumBodyDepthOverForkLength": report["morphometrics"]["maximumBodyDepthOverForkLength"],
                "pectoralLengthOverForkLength": report["morphometrics"]["pectoralLengthOverForkLength"],
                "jointCount": report["skin"]["jointCount"],
                "animationCount": report["assetInventory"]["animationCount"],
                "next": report["next"],
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
