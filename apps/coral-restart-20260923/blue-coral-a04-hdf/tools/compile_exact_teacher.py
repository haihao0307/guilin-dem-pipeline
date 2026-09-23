#!/usr/bin/env python3
"""Compile the current user-provided Blue Coral teacher into an exact high-dimensional field package.

This is an execution-only implementation of the frozen Mother canonical-teacher method:
- no decimation
- no remesh
- no voxelization / marching cubes
- no fitted proxy
- every source accessor is preserved byte-for-byte in a new aligned field payload
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any

import numpy as np

COMPONENT_DTYPES: dict[int, str] = {
    5120: "i1",
    5121: "u1",
    5122: "<i2",
    5123: "<u2",
    5125: "<u4",
    5126: "<f4",
}
LOCKED_SOURCE = {
    "archiveSha256": "c65bc1b9c389b3b1c3f4c09fc345619ad4ad4994666a06eb294822eafa503857",
    "gltfSha256": "6a13fc948469db72878528f4941a734bfac256dc1d2939ab6dcc9e2fe1818e0a",
    "binarySha256": "23f65069936dc9316b975617beb9a07991a24b20bba8de5f45ff6bb0afecadb3",
    "textureSha256": "27734e7adaa0657fb314715088f74c707c12c8029965cb12172fef104a673906",
    "accessors": 36,
    "surfaces": 9,
    "vertices": 582_034,
    "triangles": 1_000_000,
}

TYPE_WIDTHS = {
    "SCALAR": 1,
    "VEC2": 2,
    "VEC3": 3,
    "VEC4": 4,
    "MAT2": 4,
    "MAT3": 9,
    "MAT4": 16,
}


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def compact(obj: Any) -> str:
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":"), sort_keys=True)


def node_matrix(node: dict[str, Any]) -> np.ndarray:
    if "matrix" in node:
        return np.asarray(node["matrix"], dtype=np.float64).reshape(4, 4).T
    t = np.asarray(node.get("translation", [0.0, 0.0, 0.0]), dtype=np.float64)
    s = np.asarray(node.get("scale", [1.0, 1.0, 1.0]), dtype=np.float64)
    x, y, z, w = node.get("rotation", [0.0, 0.0, 0.0, 1.0])
    r = np.array(
        [
            [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
            [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
            [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
        ],
        dtype=np.float64,
    )
    m = np.eye(4, dtype=np.float64)
    m[:3, :3] = r @ np.diag(s)
    m[:3, 3] = t
    return m


def read_accessor(gltf: dict[str, Any], buffers: list[bytes], accessor_id: int) -> tuple[bytes, np.ndarray]:
    accessor = gltf["accessors"][accessor_id]
    if "sparse" in accessor:
        raise ValueError(f"Sparse accessor {accessor_id} is not supported by this exact-source compiler")
    view = gltf["bufferViews"][accessor["bufferView"]]
    width = TYPE_WIDTHS[accessor["type"]]
    dtype = np.dtype(COMPONENT_DTYPES[accessor["componentType"]])
    item_bytes = dtype.itemsize * width
    stride = int(view.get("byteStride", item_bytes))
    offset = int(view.get("byteOffset", 0)) + int(accessor.get("byteOffset", 0))
    source = buffers[view["buffer"]]
    count = int(accessor["count"])
    if stride == item_bytes:
        packed = source[offset : offset + count * item_bytes]
    else:
        out = bytearray(count * item_bytes)
        for i in range(count):
            src = offset + i * stride
            dst = i * item_bytes
            out[dst : dst + item_bytes] = source[src : src + item_bytes]
        packed = bytes(out)
    if len(packed) != count * item_bytes:
        raise ValueError(f"Accessor {accessor_id} byte length mismatch")
    array = np.frombuffer(packed, dtype=dtype).reshape(count, width)
    return packed, array


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--source-dir", required=True)
    ap.add_argument("--source-zip", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    source_dir = Path(args.source_dir)
    source_zip = Path(args.source_zip)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    gltf_path = source_dir / "scene.gltf"
    bin_path = source_dir / "scene.bin"
    texture_path = source_dir / "textures" / "material_0_baseColor.png"
    license_path = source_dir / "license.txt"

    gltf_bytes = gltf_path.read_bytes()
    bin_bytes = bin_path.read_bytes()
    texture_bytes = texture_path.read_bytes()
    zip_bytes = source_zip.read_bytes()
    license_text = license_path.read_text(encoding="utf-8")
    actual_identity = {
        "archiveSha256": sha256(zip_bytes),
        "gltfSha256": sha256(gltf_bytes),
        "binarySha256": sha256(bin_bytes),
        "textureSha256": sha256(texture_bytes),
    }
    for key, expected in LOCKED_SOURCE.items():
        if key in actual_identity and actual_identity[key] != expected:
            raise AssertionError(f"Wrong Blue Coral teacher input for {key}: {actual_identity[key]} != {expected}")
    gltf = json.loads(gltf_bytes)
    buffers = [bin_bytes]

    payload = bytearray()
    fields: list[dict[str, Any]] = []
    arrays: list[np.ndarray] = []
    accessor_hashes: list[str] = []

    for accessor_id, accessor in enumerate(gltf["accessors"]):
        packed, arr = read_accessor(gltf, buffers, accessor_id)
        while len(payload) % 8:
            payload.append(0)
        entry = {
            "id": accessor_id,
            "sourceAccessor": accessor_id,
            "offset": len(payload),
            "byteLength": len(packed),
            "componentType": accessor["componentType"],
            "type": accessor["type"],
            "width": TYPE_WIDTHS[accessor["type"]],
            "count": accessor["count"],
            "normalized": bool(accessor.get("normalized", False)),
            "min": accessor.get("min"),
            "max": accessor.get("max"),
            "sha256": sha256(packed),
        }
        payload.extend(packed)
        fields.append(entry)
        arrays.append(arr)
        accessor_hashes.append(entry["sha256"])

    parent: dict[int, int] = {
        child: parent_id
        for parent_id, node in enumerate(gltf["nodes"])
        for child in node.get("children", [])
    }
    local_matrices = [node_matrix(node) for node in gltf["nodes"]]
    world_cache: dict[int, np.ndarray] = {}

    def world_matrix(node_id: int) -> np.ndarray:
        if node_id not in world_cache:
            local = local_matrices[node_id]
            world_cache[node_id] = world_matrix(parent[node_id]) @ local if node_id in parent else local
        return world_cache[node_id]

    for i in range(len(gltf["nodes"])):
        world_matrix(i)

    object_graph = []
    for node_id, node in enumerate(gltf["nodes"]):
        object_graph.append(
            {
                "id": node_id,
                "sourceName": node.get("name", ""),
                "parent": parent.get(node_id),
                "children": node.get("children", []),
                "meshId": node.get("mesh"),
                "sourceMatrix": node.get("matrix"),
                "sourceTRS": {
                    key: node[key]
                    for key in ("translation", "rotation", "scale")
                    if key in node
                },
                "localMatrix": local_matrices[node_id].T.reshape(-1).tolist(),
                "worldMatrix": world_cache[node_id].T.reshape(-1).tolist(),
            }
        )

    surfaces: list[dict[str, Any]] = []
    global_lo = np.full(3, np.inf, dtype=np.float64)
    global_hi = np.full(3, -np.inf, dtype=np.float64)
    total_vertices = 0
    total_triangles = 0
    total_surface_area = 0.0

    mesh_nodes: dict[int, list[int]] = {}
    for node_id, node in enumerate(gltf["nodes"]):
        if "mesh" in node:
            mesh_nodes.setdefault(node["mesh"], []).append(node_id)

    for mesh_id, mesh in enumerate(gltf["meshes"]):
        node_ids = mesh_nodes.get(mesh_id, [])
        if len(node_ids) != 1:
            raise ValueError(f"Expected exactly one node for mesh {mesh_id}, got {node_ids}")
        node_id = node_ids[0]
        world = world_cache[node_id]
        normal_matrix = np.linalg.inv(world[:3, :3]).T
        for primitive_id, primitive in enumerate(mesh["primitives"]):
            attrs = primitive["attributes"]
            position_field = attrs["POSITION"]
            normal_field = attrs["NORMAL"]
            uv_field = attrs.get("TEXCOORD_0")
            index_field = primitive["indices"]

            local_positions = arrays[position_field].astype(np.float64)
            hp = np.c_[local_positions, np.ones(len(local_positions), dtype=np.float64)]
            world_positions = (hp @ world.T)[:, :3]
            local_normals = arrays[normal_field].astype(np.float64)
            world_normals = local_normals @ normal_matrix.T
            lengths = np.linalg.norm(world_normals, axis=1)
            world_normals /= np.where(lengths[:, None] == 0, 1.0, lengths[:, None])
            indices = arrays[index_field].reshape(-1, 3).astype(np.int64)
            triangles = world_positions[indices]
            areas = 0.5 * np.linalg.norm(
                np.cross(triangles[:, 1] - triangles[:, 0], triangles[:, 2] - triangles[:, 0]),
                axis=1,
            )
            surface_area = float(areas.sum())
            lo = world_positions.min(axis=0)
            hi = world_positions.max(axis=0)
            global_lo = np.minimum(global_lo, lo)
            global_hi = np.maximum(global_hi, hi)
            total_vertices += len(world_positions)
            total_triangles += len(indices)
            total_surface_area += surface_area

            surfaces.append(
                {
                    "id": len(surfaces),
                    "sourceMesh": mesh_id,
                    "sourcePrimitive": primitive_id,
                    "sourceNode": node_id,
                    "name": mesh.get("name", f"mesh-{mesh_id}"),
                    "vertexFields": attrs,
                    "faceField": index_field,
                    "materialId": primitive.get("material"),
                    "mode": primitive.get("mode", 4),
                    "worldMatrix": world.T.reshape(-1).tolist(),
                    "normalMatrix": normal_matrix.T.reshape(-1).tolist(),
                    "worldBounds": [lo.tolist(), hi.tolist()],
                    "vertexCount": int(len(world_positions)),
                    "triangleCount": int(len(indices)),
                    "surfaceAreaSourceUnits2": surface_area,
                    "centroid": world_positions.mean(axis=0).tolist(),
                    "positionField": position_field,
                    "normalField": normal_field,
                    "uvField": uv_field,
                    "indexField": index_field,
                }
            )

    semantic_subset = {
        key: gltf.get(key)
        for key in ("nodes", "scenes", "scene", "meshes", "materials", "textures", "samplers", "images")
    }
    package = {
        "schema": "kaopu.canonical-coral-teacher/1.0",
        "version": "BLUE_CORAL_CANONICAL_A04",
        "stage": "ONE_TO_ONE_HIGH_DIMENSIONAL_FIELD_EXPRESSION",
        "teacher": {
            "title": gltf.get("asset", {}).get("extras", {}).get("title", "Blue Coral"),
            "author": gltf.get("asset", {}).get("extras", {}).get("author"),
            "license": gltf.get("asset", {}).get("extras", {}).get("license"),
            "source": gltf.get("asset", {}).get("extras", {}).get("source"),
            "specimen": "Heliopora coerulea",
            "accession": "34.25",
        },
        "sourceIdentity": {
            "archiveSha256": sha256(zip_bytes),
            "gltfSha256": sha256(gltf_bytes),
            "binarySha256": sha256(bin_bytes),
            "textureSha256": sha256(texture_bytes),
            "licenseSha256": sha256(license_text.encode("utf-8")),
            "accessorAggregateSha256": sha256("".join(accessor_hashes).encode("ascii")),
            "semanticSha256": sha256(compact(semantic_subset).encode("utf-8")),
        },
        "sourceDimensions": {
            "accessors": len(gltf["accessors"]),
            "surfaces": len(surfaces),
            "vertices": total_vertices,
            "triangles": total_triangles,
            "worldBounds": [global_lo.tolist(), global_hi.tolist()],
            "worldExtents": (global_hi - global_lo).tolist(),
            "surfaceAreaSourceUnits2": total_surface_area,
            "physicalScaleKnown": False,
        },
        "fields": fields,
        "surfaces": surfaces,
        "objectGraph": object_graph,
        "rootNodes": gltf["scenes"][gltf.get("scene", 0)]["nodes"],
        "materialFields": gltf.get("materials", []),
        "textureBindings": gltf.get("textures", []),
        "samplerFields": gltf.get("samplers", []),
        "imageBindings": gltf.get("images", []),
        "contracts": {
            "sourceCloneUsed": False,
            "gltfLoaderUsedForCandidate": False,
            "meshSimplification": False,
            "decimation": False,
            "remeshing": False,
            "voxelization": False,
            "marchingCubes": False,
            "fittedProxy": False,
            "genericNoiseReplacement": False,
            "allSourceAccessorsPreservedByteExact": True,
            "separateCandidateBuffersRequired": True,
            "sameScaleSameCameraComparisonRequired": True,
            "teacherRemovableFinalGenerator": False,
        },
        "approval": {
            "sourceStudyComplete": True,
            "sourceDissectionComplete": True,
            "highDimensionalFieldExpressionBuilt": True,
            "oneToOneVisualAcceptance": False,
            "structureGrammarApproved": False,
            "independentLowDimensionalGenerator": False,
            "productionReady": False,
        },
    }

    field_path = out / "teacher-fields.bin"
    package_path = out / "teacher-package.json"
    source_json_path = out / "source-json-preserved.json"
    field_path.write_bytes(payload)
    package_path.write_text(json.dumps(package, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    source_json_path.write_bytes(gltf_bytes)
    (out / "license.txt").write_text(license_text, encoding="utf-8")

    readback = field_path.read_bytes()
    readback_mismatches = []
    for field in fields:
        chunk = readback[field["offset"] : field["offset"] + field["byteLength"]]
        if sha256(chunk) != field["sha256"]:
            readback_mismatches.append(field["id"])

    expected_triangles = sum(int(np.prod(arrays[s["faceField"]].shape)) // 3 for s in surfaces)
    report = {
        "version": package["version"],
        "sourceArchiveSha256": package["sourceIdentity"]["archiveSha256"],
        "sourceGltfSha256": package["sourceIdentity"]["gltfSha256"],
        "sourceBinarySha256": package["sourceIdentity"]["binarySha256"],
        "sourceTextureSha256": package["sourceIdentity"]["textureSha256"],
        "fieldPayloadSha256": sha256(bytes(payload)),
        "fieldPayloadBytes": len(payload),
        "accessorCount": len(fields),
        "surfaceCount": len(surfaces),
        "vertices": total_vertices,
        "triangles": total_triangles,
        "triangleRecount": expected_triangles,
        "worldBounds": package["sourceDimensions"]["worldBounds"],
        "worldExtents": package["sourceDimensions"]["worldExtents"],
        "surfaceAreaSourceUnits2": total_surface_area,
        "fieldReadbackHashMismatchIds": readback_mismatches,
        "fieldReadbackPassed": not readback_mismatches,
        "sourceArraysPreservedByteExact": True,
        "noSimplification": True,
        "noRemesh": True,
        "noVoxelization": True,
        "noMarchingCubes": True,
        "candidateIsHighDimensionalFieldDecode": True,
        "candidateIsFinalGenerator": False,
        "manualVisualAcceptance": False,
        "productionReady": False,
    }
    if (
        len(fields) != LOCKED_SOURCE["accessors"]
        or len(surfaces) != LOCKED_SOURCE["surfaces"]
        or total_vertices != LOCKED_SOURCE["vertices"]
        or total_triangles != LOCKED_SOURCE["triangles"]
    ):
        raise AssertionError(f"Unexpected source identity: {report}")
    if readback_mismatches:
        raise AssertionError(f"Field readback failed: {readback_mismatches}")
    (out / "EXTRACTION_QA.json").write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps(report, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
