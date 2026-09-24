"""Compile source-bound observations for the remaining original fin patches.

The R005 patch IDs and source seams are retained as observation labels. This
compiler does not alter, mirror, weld, cap, or biologically rename the Teacher.
"""
from pathlib import Path
import argparse
import collections
import hashlib
import importlib.util
import json

import numpy as np

DT = {5120: "i1", 5121: "u1", 5122: "<i2", 5123: "<u2", 5125: "<u4", 5126: "<f4", "FLOAT64": "<f8"}
PART_IDS = ("dorsal_front", "dorsal_rear", "pelvic_l", "pelvic_r", "anal", "finlets_d", "finlets_v")
SHA = lambda value: hashlib.sha256(value).hexdigest()


def compile_fin_surfaces(canonical, parts_path, head_path, out, head_code=None):
    canonical, parts_path, head_path, out = map(Path, (canonical, parts_path, head_path, out))
    out.mkdir(parents=True, exist_ok=True)
    code = Path(head_code) if head_code else Path(__file__).parent.parent / "web-r007" / "compile_head.py"
    spec = importlib.util.spec_from_file_location("r007_source_math", code)
    math = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(math)

    pkg = json.loads((canonical / "teacher-package.json").read_text(encoding="utf-8"))
    raw = (canonical / "teacher-fields.bin").read_bytes()
    parts_data = json.loads(parts_path.read_text(encoding="utf-8"))
    head_data = json.loads(head_path.read_text(encoding="utf-8"))
    assert pkg["sourceArrayAggregate"] == parts_data["sourceArrayAggregate"] == head_data["sourceArrayAggregate"]

    def field(index):
        item = pkg["fields"][index]
        return np.frombuffer(raw[item["offset"]:item["offset"] + item["byteLength"]], dtype=DT[item["componentType"]]).reshape(item["count"], item["width"])

    graph = pkg["objectGraph"]
    canonical_matrix = np.array(pkg["canonicalTransform"], dtype=float).reshape(4, 4).T
    tracks = pkg["motionFields"][0]["tracks"]
    curves = [(field(track["timeField"]).astype(float).ravel(), field(track["valueField"]).astype(float)) for track in tracks]
    assert all(track["interpolation"] in ("LINEAR", "STEP") for track in tracks)

    def pose(time_value):
        trs = [{key: np.array(value, dtype=float) for key, value in node["sourceTRS"].items()} for node in graph]
        if time_value is not None:
            for track, (times, values) in zip(tracks, curves):
                j = int(np.searchsorted(times, time_value, side="right"))
                if j == 0:
                    value = values[0]
                elif j == len(times):
                    value = values[-1]
                else:
                    u = (time_value - times[j - 1]) / (times[j] - times[j - 1])
                    value = values[j - 1] if track["interpolation"] == "STEP" else (
                        math.slerp(values[j - 1], values[j], u) if track["property"] == "rotation"
                        else values[j - 1] * (1 - u) + values[j] * u
                    )
                trs[track["nodeId"]][track["property"]] = value
        local = [
            np.array(node["sourceMatrix"], dtype=float).reshape(4, 4).T
            if node["sourceMatrix"] is not None else math.compose(trs[node["id"]])
            for node in graph
        ]
        world = {}

        def visit(index):
            if index not in world:
                parent = graph[index]["parent"]
                world[index] = (visit(parent) if parent is not None else np.eye(4)) @ local[index]
            return world[index]

        for node in graph:
            visit(node["id"])
        return world

    surface = pkg["surfaces"][0]
    attributes = surface["vertexFields"]
    positions = field(attributes["POSITION"]).astype(float)
    homogeneous = np.c_[positions, np.ones(len(positions))]
    faces = field(surface["faceField"]).reshape(-1, 3)
    joints = field(attributes["JOINTS_0"]).astype(int)
    weights = field(attributes["WEIGHTS_0"]).astype(float)
    weights = (weights / weights.sum(1, keepdims=True)).astype(np.float32).astype(float)
    skin = pkg["skeletonGraphs"][0]
    inverse_bind = field(skin["inverseBindField"]).reshape(-1, 4, 4).transpose(0, 2, 1).astype(float)

    def deform(world):
        matrices = np.array([canonical_matrix @ world[node] @ inverse_bind[joint] for joint, node in enumerate(skin["jointNodes"])])
        return sum(np.einsum("nij,nj->ni", matrices[joints[:, slot]], homogeneous) * weights[:, slot, None] for slot in range(4))[:, :3]

    rest_world = pose(None)
    rest_surface = deform(rest_world)
    body_node = next(node["id"] for node in graph if node["sourceName"] == "Spine_02")
    rest_body = canonical_matrix @ rest_world[body_node]

    def axes(matrix):
        result = matrix[:3, :3].copy()
        result /= np.linalg.norm(result, axis=0)
        return result

    rest_axes = axes(rest_body)
    groups_by_id = {group["id"]: group for group in pkg["controlGroups"]}
    part_by_id = {part["id"]: part for part in parts_data["parts"]}
    definitions = []
    all_support_nodes = set()

    for part_id in PART_IDS:
        part = part_by_id[part_id]
        assert part["mesh"] == 0 and part["sourceTriangles"] and part["sourceVertices"]
        interface_edges = []
        alias_positions = collections.defaultdict(lambda: collections.defaultdict(set))
        for seam_index, seam in enumerate(parts_data["seams"]):
            if part_id not in (seam["a"]["part"], seam["b"]["part"]):
                continue
            fin_side = seam["a"] if seam["a"]["part"] == part_id else seam["b"]
            neighbor_side = seam["b"] if seam["a"]["part"] == part_id else seam["a"]
            assert np.array_equal(positions[fin_side["vertices"]], positions[neighbor_side["vertices"]])
            interface_edges.append({"seamId": seam_index, "neighborPart": neighbor_side["part"], "finVertices": fin_side["vertices"], "neighborVertices": neighbor_side["vertices"]})
            for vertex in fin_side["vertices"]:
                alias_positions[neighbor_side["part"]][tuple(float(x) for x in positions[vertex])].add(int(vertex))
        assert interface_edges
        interface_groups = []
        for neighbor in sorted({edge["neighborPart"] for edge in interface_edges}):
            aliases = alias_positions[neighbor]
            position_groups = [{"sourceVertex": min(ids), "sourceAliases": sorted(ids)} for ids in sorted(aliases.values(), key=min)]
            interface_groups.append({
                "neighborPart": neighbor,
                "edges": [edge for edge in interface_edges if edge["neighborPart"] == neighbor],
                "positionGroups": position_groups,
            })

        source_vertices = np.asarray(part["sourceVertices"], dtype=int)
        patch_center = rest_surface[source_vertices].mean(0)
        probe = int(source_vertices[np.argmax(np.linalg.norm(rest_surface[source_vertices] - patch_center, axis=1))])
        support = []
        support_nodes = set()
        for item in part["sourceControlSupport"]:
            group = groups_by_id[item["id"]]
            nodes = [int(node) for node in group["nodes"]]
            support_nodes.update(nodes)
            support.append({"groupId": item["id"], "sourceName": item["name"], "weightSum": item["weightSum"], "nodes": nodes})
        support_context = set(support_nodes)
        support_context.update(graph[node]["parent"] for node in support_nodes if graph[node]["parent"] is not None)
        all_support_nodes.update(support_context)
        controls = [
            {"node": node, "sourceName": graph[node]["sourceName"], "parent": graph[node]["parent"], "supportedByGroups": [group["sourceName"] for group in support if node in group["nodes"]], "tracks": [track for track in tracks if track["nodeId"] == node]}
            for node in sorted(support_nodes)
        ]
        definitions.append({
            "id": part_id,
            "label": part["label"],
            "mesh": 0,
            "sourceTriangles": part["sourceTriangles"],
            "sourceVertices": part["sourceVertices"],
            "sourceControlSupport": support,
            "controlNodes": sorted(support_nodes),
            "controlContextNodes": sorted(support_context),
            "controls": controls,
            "interfaceEdges": interface_edges,
            "interfaceGroups": interface_groups,
            "probe": {"sourceVertex": probe, "definition": "FROZEN_REST_SOURCE_VERTEX_FARTHEST_FROM_PATCH_VERTEX_MEAN"},
            "patchCenterDefinition": "MEAN_OF_CANONICAL_REST_SOURCE_PATCH_VERTICES",
            "anatomicalApproval": False,
        })

    def sample(time_value, rest=False):
        world = rest_world if rest else pose(time_value)
        deformed = rest_surface if rest else deform(world)
        body_matrix = canonical_matrix @ world[body_node]
        relative_body_frame = axes(body_matrix) @ rest_axes.T
        rows = []
        for definition in definitions:
            interface_points = sorted({
                group["sourceVertex"]
                for group in definition["interfaceGroups"]
                for group in group["positionGroups"]
            })
            mean = deformed[interface_points].mean(0)
            point = deformed[definition["probe"]["sourceVertex"]]
            offset = (point - mean) @ relative_body_frame
            triangle_points = deformed[faces[definition["sourceTriangles"]]]
            areas = np.linalg.norm(np.cross(triangle_points[:, 1] - triangle_points[:, 0], triangle_points[:, 2] - triangle_points[:, 0]), axis=1)
            interface_gaps = {}
            for group in definition["interfaceGroups"]:
                gaps = [float(np.linalg.norm(deformed[edge["finVertices"]] - deformed[edge["neighborVertices"]], axis=1).max()) for edge in group["edges"]]
                interface_gaps[group["neighborPart"]] = max(gaps, default=0.0)
            rows.append({
                "id": definition["id"],
                "probe": point.tolist(),
                "interfaceMean": mean.tolist(),
                "interfaceGaps": interface_gaps,
                "metrics": {
                    "probeToInterfaceMean": float(np.linalg.norm(point - mean)),
                    "bodyFrameProbeLongitudinal": float(offset[0]),
                    "bodyFrameProbeVertical": float(offset[1]),
                    "bodyFrameProbeLateral": float(offset[2]),
                    "sourcePatchSurfaceArea": float(areas.sum() * 0.5),
                    "interfaceMaxGap": max(interface_gaps.values(), default=0.0),
                },
            })
        return {
            "time": time_value,
            "rest": rest,
            "bodyMatrix": body_matrix.T.ravel().tolist(),
            "controlMatrices": [{"node": node, "matrix": (canonical_matrix @ world[node]).T.ravel().tolist()} for node in sorted(all_support_nodes)],
            "patches": rows,
        }

    rest_sample = sample(None, True)
    samples = [sample(item["time"]) for item in head_data["samples"]]
    for index, definition in enumerate(definitions):
        keys = rest_sample["patches"][index]["metrics"].keys()
        definition["summary"] = {
            key: {
                "min": min(item["patches"][index]["metrics"][key] for item in samples),
                "max": max(item["patches"][index]["metrics"][key] for item in samples),
                "minIndex": int(np.argmin([item["patches"][index]["metrics"][key] for item in samples])),
                "maxIndex": int(np.argmax([item["patches"][index]["metrics"][key] for item in samples])),
            }
            for key in keys
        }

    definition_by_id = {item["id"]: item for item in definitions}
    track_memberships = [control_track for definition in definitions for control in definition["controls"] for control_track in control["tracks"]]
    unique_track_keys = {
        (item["nodeId"], item["property"], item["timeField"], item["valueField"], item["interpolation"])
        for item in track_memberships
    }
    qa = {
        "version": "FISH_REMAINING_FINS_R012",
        "patchIds": [item["id"] for item in definitions],
        "sourceTriangles": {item["id"]: len(item["sourceTriangles"]) for item in definitions},
        "sourceVertexIndices": {item["id"]: len(item["sourceVertices"]) for item in definitions},
        "sourceInterfaceEdges": {item["id"]: {group["neighborPart"]: len(group["edges"]) for group in item["interfaceGroups"]} for item in definitions},
        "sourceControlGroups": {item["id"]: len(item["sourceControlSupport"]) for item in definitions},
        "sourceSupportNodes": {item["id"]: len(item["controlNodes"]) for item in definitions},
        "controlContextNodes": len(all_support_nodes),
        "sourceTracks": len(unique_track_keys),
        "sourceTrackMemberships": len(track_memberships),
        "sourceTracksByPatch": {item["id"]: sum(len(control["tracks"]) for control in item["controls"]) for item in definitions},
        "samples": len(samples),
        "restSamples": 1,
        "maxRestInterfaceGap": max(row["metrics"]["interfaceMaxGap"] for row in rest_sample["patches"]),
        "maxObservedInterfaceGap": max(row["metrics"]["interfaceMaxGap"] for sample_row in samples for row in sample_row["patches"]),
        "sourceArrayAggregate": pkg["sourceArrayAggregate"],
        "sourceBinarySha256": SHA(raw),
        "sourceBinaryUnchanged": True,
        "mirroredPatchesCreated": False,
        "weldedVertices": 0,
        "newMotionCreated": False,
        "physicalLengthKnown": False,
        "anatomicalPartitionApproved": False,
        "stageAComplete": False,
        "independentGenerator": False,
        "productionReady": False,
    }
    data = {
        "schema": "kaopu.source-fin-surface-study/1.0",
        "version": qa["version"],
        "sourceArrayAggregate": pkg["sourceArrayAggregate"],
        "sourceBinarySha256": SHA(raw),
        "bodyNode": body_node,
        "bodyName": graph[body_node]["sourceName"],
        "restBodyMatrix": rest_body.T.ravel().tolist(),
        "definitions": definitions,
        "restSample": rest_sample,
        "samples": samples,
        "qa": qa,
        "limitations": [
            "Patch IDs and labels preserve R005 source observations; they do not approve biological fin names or partitions.",
            "Control support records original skin-weight influence, not natural bones or biological function.",
            "The frozen patch-extreme vertex and exact source seams are engineering probes, not anatomical landmarks.",
            "Body-frame offsets and surface areas use canonical normalized source coordinates, not a known physical scale.",
            "All original source vertices, faces, skin weights, 4K textures, and animation curves remain in the Teacher Package.",
            "Open or branching source boundaries are shown as observed; this compiler adds no caps or missing geometry.",
        ],
    }
    (out / "remaining-fin-evidence.json").write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    (out / "REMAINING_FIN_QA.json").write_text(json.dumps(qa, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(qa, ensure_ascii=False, indent=2))
    return data


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--canonical", required=True)
    parser.add_argument("--parts", required=True)
    parser.add_argument("--head", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--head-code")
    args = parser.parse_args()
    compile_fin_surfaces(args.canonical, args.parts, args.head, args.out, args.head_code)
