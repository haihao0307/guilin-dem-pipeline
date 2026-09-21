from __future__ import annotations

import argparse
import hashlib
import json
import math
from collections import defaultdict
from pathlib import Path

import numpy as np

EXPECTED_SHA = "5603d4aabc9a1127856841335a86ae7aa462b6b25d1a6586e93bf644f4d47abe"
EXPECTED_BYTES = 58908280


def quat_matrix(q):
    x, y, z, w = [float(v) for v in q]
    return np.array([
        [1 - 2 * (y*y + z*z), 2 * (x*y - z*w), 2 * (x*z + y*w), 0],
        [2 * (x*y + z*w), 1 - 2 * (x*x + z*z), 2 * (y*z - x*w), 0],
        [2 * (x*z - y*w), 2 * (y*z + x*w), 1 - 2 * (x*x + y*y), 0],
        [0, 0, 0, 1],
    ], dtype=float)


def node_matrix(node):
    if node.get("matrix") is not None:
        return np.asarray(node["matrix"], dtype=float).reshape(4, 4, order="F")
    out = np.eye(4)
    if node.get("translation") is not None:
        out[:3, 3] = node["translation"]
    if node.get("rotation") is not None:
        out = out @ quat_matrix(node["rotation"])
    if node.get("scale") is not None:
        out = out @ np.diag([*node["scale"], 1])
    return out


def parents_for(nodes):
    out = {}
    for index, node in enumerate(nodes):
        for child in node.get("children", []):
            out[int(child)] = index
    return out


def world_matrix(nodes, parents, index):
    path = []
    while True:
        path.append(index)
        if index not in parents:
            break
        index = parents[index]
    out = np.eye(4)
    for node_index in reversed(path):
        out = out @ node_matrix(nodes[node_index])
    return out


def load_array(root: Path, spec: dict) -> np.ndarray:
    path = root / spec["path"]
    raw = path.read_bytes()
    actual = hashlib.sha256(raw).hexdigest()
    if actual != spec["sha256"]:
        raise ValueError(f"array hash mismatch: {path} {actual} != {spec['sha256']}")
    if len(raw) != int(spec["bytes"]):
        raise ValueError(f"array byte mismatch: {path}")
    return np.frombuffer(raw, dtype=np.dtype(spec["dtype"])).reshape(spec["shape"])


def semantic_group(name: str) -> str:
    if name in {"_rootJoint", "Hips_01"}:
        return "root"
    if name.startswith("Spine") or name == "Head_05":
        return "axial"
    if "UpperJaw" in name:
        return "upper_jaw"
    if "LoweJaw" in name:
        return "lower_jaw"
    if name.startswith("Eye."):
        return "eye"
    if name.startswith("Side.") and "Fin" not in name:
        return "operculum_candidate"
    if name.startswith("SideFin"):
        return "pectoral_fin"
    if name.startswith("LowerFin") and "Back" not in name:
        return "pelvic_fin"
    if name.startswith("UpperFin"):
        return "dorsal_fin"
    if name.startswith("LowerBackFin"):
        return "anal_fin"
    if name.startswith("UpperTail"):
        return "caudal_upper"
    if name.startswith("LowerTail"):
        return "caudal_lower"
    return "unclassified"


def components(face_ids: np.ndarray, faces: np.ndarray) -> list[np.ndarray]:
    if len(face_ids) == 0:
        return []
    local_faces = faces[face_ids]
    edge_map: dict[tuple[int, int], list[int]] = defaultdict(list)
    for local_index, face in enumerate(local_faces):
        for a, b in ((face[0], face[1]), (face[1], face[2]), (face[2], face[0])):
            edge_map[tuple(sorted((int(a), int(b))))].append(local_index)
    adjacency = [set() for _ in range(len(local_faces))]
    for members in edge_map.values():
        if len(members) < 2:
            continue
        for a in members:
            adjacency[a].update(b for b in members if b != a)
    seen = set()
    out = []
    for seed in range(len(local_faces)):
        if seed in seen:
            continue
        stack = [seed]
        seen.add(seed)
        found = []
        while stack:
            current = stack.pop()
            found.append(current)
            for other in adjacency[current]:
                if other not in seen:
                    seen.add(other)
                    stack.append(other)
        out.append(face_ids[np.asarray(found, dtype=int)])
    return out


def normalized_bounds(points: np.ndarray, length: float, tail_y: float) -> dict:
    x = points[:, 0] / length
    u = (points[:, 1] - tail_y) / length
    z = points[:, 2] / length
    return {
        "xRange": [round(float(x.min()), 6), round(float(x.max()), 6)],
        "uRange": [round(float(u.min()), 6), round(float(u.max()), 6)],
        "zRange": [round(float(z.min()), 6), round(float(z.max()), 6)],
        "centroid": [round(float(x.mean()), 6), round(float(u.mean()), 6), round(float(z.mean()), 6)],
    }


def sampled_points(points: np.ndarray, length: float, tail_y: float, limit: int = 40) -> list[list[float]]:
    if len(points) == 0:
        return []
    order = np.argsort(points[:, 1])
    points = points[order]
    if len(points) > limit:
        picks = np.linspace(0, len(points) - 1, limit).round().astype(int)
        points = points[picks]
    return [[
        round(float(p[0] / length), 6),
        round(float((p[1] - tail_y) / length), 6),
        round(float(p[2] / length), 6),
    ] for p in points]


def merge_finlet_components(raw_components: list[dict], u_tolerance: float = 0.012) -> list[dict]:
    if not raw_components:
        return []
    ordered = sorted(raw_components, key=lambda item: item["centerU"], reverse=True)
    clusters: list[list[dict]] = []
    for component in ordered:
        for cluster in clusters:
            cluster_u = float(np.mean([item["centerU"] for item in cluster]))
            if abs(component["centerU"] - cluster_u) <= u_tolerance:
                cluster.append(component)
                break
        else:
            clusters.append([component])
    merged = []
    for cluster in clusters:
        face_ids = np.unique(np.concatenate([item["faceIds"] for item in cluster])).astype(int)
        vertex_ids = np.unique(np.concatenate([item["vertexIds"] for item in cluster])).astype(int)
        merged.append({"faceIds": face_ids, "vertexIds": vertex_ids})
    return merged


def rolling_median(values: np.ndarray, u: np.ndarray, radius: float = 0.003) -> np.ndarray:
    out = np.empty_like(values, dtype=float)
    for index, center in enumerate(u):
        select = np.abs(u - center) <= radius
        out[index] = float(np.median(values[select]))
    return out


def classify(package_root: Path) -> tuple[dict, dict]:
    manifest = json.loads((package_root / "KAOPU_SOURCE_COPY_MANIFEST.json").read_text())
    if manifest.get("sourceSha256") != EXPECTED_SHA or int(manifest.get("sourceBytes", -1)) != EXPECTED_BYTES:
        raise ValueError("strict package is not exact FISH-REF-002")
    nodes = manifest["nodes"]
    parents = parents_for(nodes)
    mesh_node = next(index for index, node in enumerate(nodes) if node.get("mesh") == 0)
    mesh_world = world_matrix(nodes, parents, mesh_node)
    primitive = manifest["meshes"][0]["primitives"][0]
    raw_positions = load_array(package_root, primitive["attributes"]["POSITION"]).astype(float)
    positions = (mesh_world @ np.c_[raw_positions, np.ones(len(raw_positions))].T).T[:, :3]
    faces = load_array(package_root, primitive["indices"]).astype(int).reshape(-1, 3)
    joints = load_array(package_root, primitive["attributes"]["JOINTS_0"]).astype(int)
    weights = load_array(package_root, primitive["attributes"]["WEIGHTS_0"]).astype(float)
    weights /= np.maximum(weights.sum(axis=1, keepdims=True), 1e-12)
    skin = manifest["skins"][0]
    joint_names = [nodes[index].get("name", f"node_{index}") for index in skin["joints"]]
    groups = sorted(set(semantic_group(name) for name in joint_names))
    group_index = {name: index for index, name in enumerate(groups)}
    vertex_group_weight = np.zeros((len(positions), len(groups)), dtype=float)
    for influence in range(joints.shape[1]):
        semantics = np.array([group_index[semantic_group(joint_names[index])] for index in joints[:, influence]], dtype=int)
        vertex_group_weight[np.arange(len(positions)), semantics] += weights[:, influence]
    face_group_weight = vertex_group_weight[faces].sum(axis=1)
    face_groups = np.asarray(groups, dtype=object)[face_group_weight.argmax(axis=1)]

    body_length = float(positions[:, 1].max() - positions[:, 1].min())
    tail_y = float(positions[:, 1].min())
    snout_y = float(positions[:, 1].max())
    triangles = positions[faces]
    face_centers = triangles.mean(axis=1)
    face_normals = np.cross(triangles[:, 1] - triangles[:, 0], triangles[:, 2] - triangles[:, 0])
    face_normals /= np.maximum(np.linalg.norm(face_normals, axis=1)[:, None], 1e-12)

    inverse_bind = load_array(package_root, skin["inverseBindMatrices"]).astype(float)
    joint_bind_positions = []
    for row in inverse_bind:
        inverse_matrix = row.reshape(4, 4, order="F")
        bind = np.linalg.inv(inverse_matrix)
        point = (mesh_world @ bind @ np.array([0, 0, 0, 1.0]))[:3]
        joint_bind_positions.append(point)
    joint_bind_positions = np.asarray(joint_bind_positions)
    spine_indices = [index for index, name in enumerate(joint_names) if name.startswith("Spine")]
    centerline_z = float(np.median(joint_bind_positions[spine_indices, 2]))

    global_edge_faces: dict[tuple[int, int], list[int]] = defaultdict(list)
    for face_index, face in enumerate(faces):
        for a, b in ((face[0], face[1]), (face[1], face[2]), (face[2], face[0])):
            global_edge_faces[tuple(sorted((int(a), int(b))))].append(face_index)

    semantic_components = {}
    tracked_groups = [
        "dorsal_fin", "anal_fin", "pelvic_fin", "pectoral_fin",
        "caudal_upper", "caudal_lower", "upper_jaw", "lower_jaw", "operculum_candidate",
    ]
    for target in tracked_groups:
        target_faces = np.where(face_groups == target)[0]
        records = []
        for component_index, component_face_ids in enumerate(components(target_faces, faces)):
            component_vertex_ids = np.unique(faces[component_face_ids])
            component_face_set = set(int(value) for value in component_face_ids)
            root_edges = set()
            free_edges = set()
            for face_index in component_face_ids:
                face = faces[face_index]
                for a, b in ((face[0], face[1]), (face[1], face[2]), (face[2], face[0])):
                    edge = tuple(sorted((int(a), int(b))))
                    neighbors = global_edge_faces[edge]
                    if len(neighbors) == 1:
                        free_edges.add(edge)
                    elif any(other not in component_face_set for other in neighbors):
                        root_edges.add(edge)
            root_vertex_ids = np.unique([vertex for edge in root_edges for vertex in edge]).astype(int) if root_edges else np.empty(0, dtype=int)
            free_vertex_ids = np.unique([vertex for edge in free_edges for vertex in edge]).astype(int) if free_edges else np.empty(0, dtype=int)
            points = positions[component_vertex_ids]
            record = {
                "component": component_index,
                "faces": int(len(component_face_ids)),
                "vertices": int(len(component_vertex_ids)),
                "bounds": normalized_bounds(points, body_length, tail_y),
                "attachmentRoot": {
                    "edges": int(len(root_edges)),
                    "vertices": int(len(root_vertex_ids)),
                    "bounds": normalized_bounds(positions[root_vertex_ids], body_length, tail_y) if len(root_vertex_ids) else None,
                    "sample": sampled_points(positions[root_vertex_ids], body_length, tail_y),
                },
                "freeEdge": {
                    "edges": int(len(free_edges)),
                    "vertices": int(len(free_vertex_ids)),
                    "bounds": normalized_bounds(positions[free_vertex_ids], body_length, tail_y) if len(free_vertex_ids) else None,
                    "sample": sampled_points(positions[free_vertex_ids], body_length, tail_y),
                },
            }
            records.append(record)
        records.sort(key=lambda item: (-item["faces"], item["bounds"]["centroid"][1]))
        semantic_components[target] = records

    normalized_u = (face_centers[:, 1] - tail_y) / body_length
    mean_abs_x = np.mean(np.abs(triangles[:, :, 0]), axis=1) / body_length
    finlet_mask = (
        np.isin(face_groups, ["axial", "root"])
        & (normalized_u >= 0.17)
        & (normalized_u <= 0.40)
        & (mean_abs_x <= 0.012)
        & (np.abs(face_normals[:, 0]) >= 0.65)
    )
    finlet_results = {}
    finlet_face_ids_by_side = {}
    for side, selector in {
        "dorsal": finlet_mask & (face_centers[:, 2] < centerline_z),
        "ventral": finlet_mask & (face_centers[:, 2] >= centerline_z),
    }.items():
        raw = []
        for component_face_ids in components(np.where(selector)[0], faces):
            vertex_ids = np.unique(faces[component_face_ids])
            points = positions[vertex_ids]
            bounds = normalized_bounds(points, body_length, tail_y)
            max_abs_x = max(abs(value) for value in bounds["xRange"])
            u_span = bounds["uRange"][1] - bounds["uRange"][0]
            z_span = bounds["zRange"][1] - bounds["zRange"][0]
            if max_abs_x > 0.015 or u_span > 0.055 or z_span > 0.04:
                continue
            raw.append({
                "faceIds": component_face_ids,
                "vertexIds": vertex_ids,
                "centerU": float(np.mean((points[:, 1] - tail_y) / body_length)),
            })
        merged = merge_finlet_components(raw)
        confirmed = []
        overlap = []
        side_faces = []
        for cluster in merged:
            face_ids = cluster["faceIds"]
            vertex_ids = cluster["vertexIds"]
            points = positions[vertex_ids]
            bounds = normalized_bounds(points, body_length, tail_y)
            record = {
                "faces": int(len(face_ids)),
                "vertices": int(len(vertex_ids)),
                "bounds": bounds,
                "centerU": round(float(np.mean((points[:, 1] - tail_y) / body_length)), 6),
                "centerSource": [round(float(v), 6) for v in points.mean(axis=0)],
            }
            if len(face_ids) >= 12:
                confirmed.append(record)
                side_faces.extend(int(value) for value in face_ids)
            elif len(face_ids) >= 2:
                overlap.append(record)
        confirmed.sort(key=lambda item: item["centerU"], reverse=True)
        overlap.sort(key=lambda item: item["centerU"], reverse=True)
        for index, item in enumerate(confirmed, start=1):
            item["seriesIndexFrontToTail"] = index
        finlet_results[side] = {
            "confirmedCount": len(confirmed),
            "confirmed": confirmed,
            "overlapCandidates": overlap,
            "rule": "Confirmed only after axial/root thin-sheet topology, midline thickness, face-normal and repeated-series gates all pass.",
        }
        finlet_face_ids_by_side[side] = np.asarray(sorted(set(side_faces)), dtype=int)

    body_weight = np.zeros(len(positions), dtype=float)
    for name in ["axial", "root", "caudal_upper", "caudal_lower"]:
        if name in group_index:
            body_weight += vertex_group_weight[:, group_index[name]]
    rows = []
    for u in np.linspace(0.16, 0.23, 141):
        y = tail_y + float(u) * body_length
        window = 0.010 * body_length
        point_mask = (np.abs(positions[:, 1] - y) <= window) & (body_weight >= 0.45)
        points = positions[point_mask]
        if len(points) < 12:
            continue
        x_low, x_high = np.quantile(points[:, 0], [0.02, 0.98])
        half_width = max(abs(float(x_low)), abs(float(x_high)))
        side_points = points[np.abs(points[:, 0]) >= 0.25 * half_width]
        if len(side_points) < 12:
            continue
        z_low, z_high = np.quantile(side_points[:, 2], [0.08, 0.92])
        width = float(x_high - x_low)
        depth = float(z_high - z_low)
        rows.append({
            "u": float(u),
            "widthPctL": width / body_length * 100,
            "depthPctL": depth / body_length * 100,
            "areaProxyPctL2": width * depth / (body_length * body_length) * 10000,
            "points": int(len(points)),
            "sidePoints": int(len(side_points)),
            "sideZ": side_points[:, 2] / body_length,
        })
    if not rows:
        raise ValueError("peduncle scan produced no stable rows")
    u_values = np.asarray([row["u"] for row in rows])
    width_values = rolling_median(np.asarray([row["widthPctL"] for row in rows]), u_values)
    depth_values = rolling_median(np.asarray([row["depthPctL"] for row in rows]), u_values)
    area_values = rolling_median(np.asarray([row["areaProxyPctL2"] for row in rows]), u_values)
    stable_indices = np.asarray([index for index, row in enumerate(rows) if row["points"] >= 48 and row["sidePoints"] >= 12], dtype=int)
    if len(stable_indices) == 0:
        raise ValueError("peduncle scan has no stable high-support window")
    minimum_index = int(stable_indices[np.argmin(area_values[stable_indices])])
    minimum_row = rows[minimum_index]
    z_values = np.sort(minimum_row["sideZ"])
    z_clusters: list[list[float]] = []
    for value in z_values:
        if not z_clusters or abs(float(value) - float(np.mean(z_clusters[-1]))) > 0.006:
            z_clusters.append([float(value)])
        else:
            z_clusters[-1].append(float(value))
    keel_candidates = [
        {"zNormalized": round(float(np.mean(cluster)), 6), "supportPoints": len(cluster)}
        for cluster in z_clusters if len(cluster) >= 2
    ]
    minimum_width = float(width_values[minimum_index])
    stable_set = set(int(value) for value in stable_indices)
    plateau_set = set(int(value) for value in stable_indices if width_values[value] <= minimum_width * 1.03)
    selected_plateau = [minimum_index]
    for direction in (-1, 1):
        cursor = minimum_index + direction
        while 0 <= cursor < len(rows) and cursor in stable_set and cursor in plateau_set:
            selected_plateau.append(cursor)
            cursor += direction
    plateau_u = [rows[index]["u"] for index in selected_plateau]
    peduncle = {
        "method": "weighted body-vertex window; finlet midline points excluded from depth by lateral-support gate",
        "scanRangeU": [0.16, 0.23],
        "minimum": {
            "u": round(float(rows[minimum_index]["u"]), 6),
            "widthPctL": round(float(width_values[minimum_index]), 3),
            "depthPctL": round(float(depth_values[minimum_index]), 3),
            "areaProxyPctL2": round(float(area_values[minimum_index]), 3),
            "supportPoints": int(rows[minimum_index]["points"]),
            "lateralSupportPoints": int(rows[minimum_index]["sidePoints"]),
            "widthPlateauU": [round(float(min(plateau_u)), 6), round(float(max(plateau_u)), 6)],
            "lateralKeelZCandidatesNormalized": keel_candidates,
        },
        "scan": [{
            "u": round(float(row["u"]), 6),
            "widthPctL": round(float(width_values[index]), 3),
            "depthPctL": round(float(depth_values[index]), 3),
            "areaProxyPctL2": round(float(area_values[index]), 3),
            "supportPoints": int(row["points"]),
            "lateralSupportPoints": int(row["sidePoints"]),
        } for index, row in enumerate(rows)],
    }

    joint_roots = []
    for local_index, node_index in enumerate(skin["joints"]):
        name = joint_names[local_index]
        group_name = semantic_group(name)
        if group_name not in {"dorsal_fin", "anal_fin", "pelvic_fin", "pectoral_fin", "caudal_upper", "caudal_lower"}:
            continue
        parent_node = parents.get(node_index)
        parent_name = nodes[parent_node].get("name", "") if parent_node is not None else ""
        if semantic_group(parent_name) == group_name:
            continue
        point = joint_bind_positions[local_index]
        joint_roots.append({
            "group": group_name,
            "joint": name,
            "node": int(node_index),
            "position": [
                round(float(point[0] / body_length), 6),
                round(float((point[1] - tail_y) / body_length), 6),
                round(float(point[2] / body_length), 6),
            ],
        })

    report = {
        "schema": "kaopu.fish-mother.source-component-classification/1.0",
        "date": "2026-09-21",
        "build": "YELLOWFIN-SOURCE-COPY-R001",
        "referenceId": "FISH-REF-002",
        "source": {"sha256": EXPECTED_SHA, "bytes": EXPECTED_BYTES, "strictPackage": True},
        "frame": {
            "axisContract": {"x": "lateral", "y": "tail-to-snout", "z": "dorsal-negative / ventral-positive"},
            "bodyLengthSourceUnits": round(body_length, 6),
            "tailY": round(tail_y, 6),
            "snoutY": round(snout_y, 6),
            "centerlineZFromSpineBind": round(centerline_z, 6),
        },
        "faceGroupCounts": {name: int(np.count_nonzero(face_groups == name)) for name in groups},
        "semanticComponents": semantic_components,
        "finlets": finlet_results,
        "peduncle": peduncle,
        "jointRootAnchors": joint_roots,
        "gates": {
            "exactSourceBound": True,
            "finletsRecoveredFromAxialThinSheets": True,
            "dorsalConfirmedCount": finlet_results["dorsal"]["confirmedCount"],
            "ventralConfirmedCount": finlet_results["ventral"]["confirmedCount"],
            "attachmentRootsRecorded": True,
            "freeEdgesRecorded": True,
            "peduncleStableWindowRecorded": True,
            "keelCandidatesRequireVisualConfirmation": True,
            "sourceCopyGeometryGenerated": False,
            "productionReady": False,
        },
        "interpretationBoundary": [
            "These are exact-source topology facts, not Thunnus albacares biological truth.",
            "Low-face leading overlap candidates remain candidates until fixed-view visual acceptance.",
            "Lateral keel z clusters are geometry candidates and are not yet accepted anatomical keels.",
        ],
    }
    plot_data = {
        "positions": positions,
        "faces": faces,
        "faceGroups": face_groups,
        "finletFaces": finlet_face_ids_by_side,
        "peduncleRows": rows,
        "peduncleWidth": width_values,
        "peduncleDepth": depth_values,
        "peduncleArea": area_values,
    }
    return report, plot_data


def render_evidence(report: dict, data: dict, out_dir: Path) -> None:
    import matplotlib.pyplot as plt
    from matplotlib.collections import PolyCollection

    out_dir.mkdir(parents=True, exist_ok=True)
    positions = data["positions"]
    faces = data["faces"]
    polygons = positions[faces][:, :, [1, 2]]
    depths = positions[faces][:, :, 0].mean(axis=1)
    order = np.argsort(depths)
    figure, axis = plt.subplots(figsize=(16, 8), dpi=160)
    axis.add_collection(PolyCollection(polygons[order], facecolors="#d8e1e5", edgecolors="#607d8b", linewidths=0.08, alpha=0.32))
    palette = {"dorsal": "#1565c0", "ventral": "#d32f2f"}
    for side in ("dorsal", "ventral"):
        ids = data["finletFaces"][side]
        if len(ids):
            axis.add_collection(PolyCollection(polygons[ids], facecolors=palette[side], edgecolors="#111111", linewidths=0.24, alpha=0.95))
        for item in report["finlets"][side]["confirmed"]:
            center = item["centerSource"]
            axis.text(center[1], center[2], f"{side[0].upper()}{item['seriesIndexFrontToTail']}", fontsize=7, ha="center", va="bottom", bbox={"facecolor": "white", "alpha": 0.82, "linewidth": 0.25})
        for item in report["finlets"][side]["overlapCandidates"]:
            center = item["centerSource"]
            axis.text(center[1], center[2], f"{side[0].upper()}?", fontsize=7, ha="center", va="bottom", color="#7b1fa2", bbox={"facecolor": "white", "alpha": 0.82, "linewidth": 0.25})
    axis.autoscale_view()
    axis.set_aspect("equal", adjustable="box")
    axis.invert_xaxis()
    axis.set_xlabel("source y · snout to tail")
    axis.set_ylabel("source z")
    axis.set_title(f"FISH-REF-002 axial thin-sheet finlet recovery · confirmed {report['finlets']['dorsal']['confirmedCount']} dorsal / {report['finlets']['ventral']['confirmedCount']} ventral")
    axis.grid(alpha=0.16)
    figure.tight_layout()
    figure.savefig(out_dir / "source-finlet-classification-side.png")
    plt.close(figure)

    scan = report["peduncle"]["scan"]
    u = np.asarray([row["u"] for row in scan])
    width = np.asarray([row["widthPctL"] for row in scan])
    depth = np.asarray([row["depthPctL"] for row in scan])
    area = np.asarray([row["areaProxyPctL2"] for row in scan])
    selected = report["peduncle"]["minimum"]["u"]
    figure, axis = plt.subplots(figsize=(12, 6), dpi=160)
    axis.plot(u, width, label="width %L")
    axis.plot(u, depth, label="depth %L")
    axis.plot(u, area, label="area proxy %L²")
    axis.axvline(selected, linestyle="--", linewidth=1.0, label=f"selected u={selected:.4f}")
    axis.set_xlabel("normalized u · tail=0")
    axis.set_ylabel("percent")
    axis.set_title("FISH-REF-002 robust caudal-peduncle scan")
    axis.grid(alpha=0.2)
    axis.legend()
    figure.tight_layout()
    figure.savefig(out_dir / "source-peduncle-scan.png")
    plt.close(figure)


def main():
    parser = argparse.ArgumentParser(description="Classify exact FISH-REF-002 source components from a strict reference package")
    parser.add_argument("--package", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--evidence-dir", type=Path)
    args = parser.parse_args()
    report, plot_data = classify(args.package)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    if args.evidence_dir:
        render_evidence(report, plot_data, args.evidence_dir)
    print(json.dumps({
        "out": str(args.out),
        "dorsalFinlets": report["finlets"]["dorsal"]["confirmedCount"],
        "ventralFinlets": report["finlets"]["ventral"]["confirmedCount"],
        "peduncleMinimum": report["peduncle"]["minimum"],
    }, indent=2))


if __name__ == "__main__":
    main()
