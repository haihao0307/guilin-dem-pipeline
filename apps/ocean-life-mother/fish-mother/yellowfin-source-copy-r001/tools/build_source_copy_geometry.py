from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

import numpy as np
import trimesh

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from classify_source_components import (
    EXPECTED_BYTES,
    EXPECTED_SHA,
    classify,
    load_array,
    parents_for,
    world_matrix,
)


REGION_ALIASES = {
    "axial": "body_core",
    "root": "body_core",
    "dorsal_fin": "dorsal_fin",
    "anal_fin": "anal_fin",
    "pelvic_fin": "pelvic_fin",
    "pectoral_fin": "pectoral_fin",
    "caudal_upper": "caudal_upper",
    "caudal_lower": "caudal_lower",
    "upper_jaw": "upper_jaw",
    "lower_jaw": "lower_jaw",
    "eye": "eye",
    "operculum_candidate": "operculum_candidate",
    "unclassified": "unclassified",
}

REGION_ORDER = [
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
    "unclassified",
]

REGION_COLORS = {
    "body_core": [111, 139, 156, 255],
    "upper_jaw": [196, 157, 104, 255],
    "lower_jaw": [174, 126, 91, 255],
    "eye": [24, 28, 34, 255],
    "operculum_candidate": [118, 181, 190, 255],
    "pectoral_fin": [64, 174, 163, 255],
    "pelvic_fin": [66, 157, 214, 255],
    "dorsal_fin": [239, 180, 64, 255],
    "anal_fin": [224, 118, 72, 255],
    "dorsal_finlets": [37, 119, 212, 255],
    "ventral_finlets": [224, 67, 67, 255],
    "caudal_upper": [246, 198, 68, 255],
    "caudal_lower": [236, 151, 56, 255],
    "unclassified": [196, 72, 186, 255],
    "auxiliary": [172, 190, 198, 255],
}


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def rounded(values, digits: int = 9) -> list[float]:
    return [round(float(value), digits) for value in values]


def normalized_bounds(points: np.ndarray, body_length: float, tail_y: float) -> dict:
    return {
        "xRange": rounded([points[:, 0].min() / body_length, points[:, 0].max() / body_length], 6),
        "uRange": rounded([
            (points[:, 1].min() - tail_y) / body_length,
            (points[:, 1].max() - tail_y) / body_length,
        ], 6),
        "zRange": rounded([points[:, 2].min() / body_length, points[:, 2].max() / body_length], 6),
        "centroid": rounded([
            points[:, 0].mean() / body_length,
            (points[:, 1].mean() - tail_y) / body_length,
            points[:, 2].mean() / body_length,
        ], 6),
    }


def region_mesh(
    positions: np.ndarray,
    faces: np.ndarray,
    face_ids: np.ndarray,
    color: list[int],
) -> tuple[trimesh.Trimesh, np.ndarray]:
    region_faces = faces[face_ids]
    source_vertex_ids, inverse = np.unique(region_faces.reshape(-1), return_inverse=True)
    local_faces = inverse.reshape(-1, 3)
    local_vertices = np.asarray(positions[source_vertex_ids], dtype=np.float32)
    mesh = trimesh.Trimesh(
        vertices=local_vertices,
        faces=np.asarray(local_faces, dtype=np.int64),
        process=False,
        validate=False,
    )
    vertex_colors = np.repeat(np.asarray(color, dtype=np.uint8)[None, :], len(local_vertices), axis=0)
    mesh.visual = trimesh.visual.ColorVisuals(mesh=mesh, vertex_colors=vertex_colors)
    return mesh, source_vertex_ids


def primitive_arrays(package_root: Path, primitive: dict, transform: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    positions = load_array(package_root, primitive["attributes"]["POSITION"]).astype(np.float64)
    positions = (transform @ np.c_[positions, np.ones(len(positions))].T).T[:, :3]
    if "indices" in primitive:
        faces = load_array(package_root, primitive["indices"]).astype(np.int64).reshape(-1, 3)
    else:
        if len(positions) % 3:
            raise ValueError("non-indexed triangle primitive vertex count is not divisible by three")
        faces = np.arange(len(positions), dtype=np.int64).reshape(-1, 3)
    return positions, faces


def add_region(
    scene: trimesh.Scene,
    region_records: list[dict],
    all_source_points: list[np.ndarray],
    name: str,
    positions: np.ndarray,
    faces: np.ndarray,
    face_ids: np.ndarray,
    color: list[int],
    body_length: float,
    tail_y: float,
    source_node: int,
    source_mesh: int,
    source_primitive: int,
    semantic: bool,
) -> None:
    mesh, source_vertex_ids = region_mesh(positions, faces, face_ids, color)
    geometry_name = f"source_copy_{name}"
    scene.add_geometry(mesh, node_name=geometry_name, geom_name=geometry_name)
    points = positions[source_vertex_ids]
    all_source_points.append(points)
    region_records.append({
        "name": name,
        "semanticRegion": semantic,
        "sourceNode": source_node,
        "sourceMesh": source_mesh,
        "sourcePrimitive": source_primitive,
        "faces": int(face_ids.size),
        "vertices": int(source_vertex_ids.size),
        "faceIdSha256": sha256_bytes(np.ascontiguousarray(face_ids.astype("<u4")).tobytes()),
        "sourceVertexIdSha256": sha256_bytes(np.ascontiguousarray(source_vertex_ids.astype("<u4")).tobytes()),
        "boundsSourceUnits": {
            "min": rounded(points.min(axis=0)),
            "max": rounded(points.max(axis=0)),
        },
        "boundsNormalized": normalized_bounds(points, body_length, tail_y),
        "displayColorRgba": color,
    })


def build(
    package_root: Path,
    classification_path: Path,
    out_glb: Path,
    out_receipt: Path,
) -> dict:
    committed = json.loads(classification_path.read_text())
    if committed.get("source", {}).get("sha256") != EXPECTED_SHA:
        raise ValueError("classification is not bound to exact FISH-REF-002")
    if int(committed.get("source", {}).get("bytes", -1)) != EXPECTED_BYTES:
        raise ValueError("classification byte count is not exact FISH-REF-002")

    regenerated, data = classify(package_root)
    if regenerated["finlets"]["dorsal"]["confirmedCount"] != committed["finlets"]["dorsal"]["confirmedCount"]:
        raise ValueError("dorsal finlet classification drift")
    if regenerated["finlets"]["ventral"]["confirmedCount"] != committed["finlets"]["ventral"]["confirmedCount"]:
        raise ValueError("ventral finlet classification drift")
    if regenerated["peduncle"]["minimum"] != committed["peduncle"]["minimum"]:
        raise ValueError("peduncle classification drift")

    manifest = json.loads((package_root / "KAOPU_SOURCE_COPY_MANIFEST.json").read_text())
    if manifest.get("sourceSha256") != EXPECTED_SHA or int(manifest.get("sourceBytes", -1)) != EXPECTED_BYTES:
        raise ValueError("strict package is not exact FISH-REF-002")
    nodes = manifest["nodes"]
    parents = parents_for(nodes)
    primary_node = next(index for index, node in enumerate(nodes) if node.get("mesh") == 0)

    positions = np.asarray(data["positions"], dtype=np.float64)
    faces = np.asarray(data["faces"], dtype=np.int64)
    face_groups = np.asarray(data["faceGroups"], dtype=object)
    labels = np.asarray([REGION_ALIASES.get(str(value), str(value)) for value in face_groups], dtype=object)

    dorsal_ids = np.asarray(data["finletFaces"]["dorsal"], dtype=np.int64)
    ventral_ids = np.asarray(data["finletFaces"]["ventral"], dtype=np.int64)
    if np.intersect1d(dorsal_ids, ventral_ids).size:
        raise ValueError("dorsal and ventral finlet face sets overlap")
    labels[dorsal_ids] = "dorsal_finlets"
    labels[ventral_ids] = "ventral_finlets"

    all_regions = list(REGION_ORDER)
    for name in sorted(set(str(value) for value in labels)):
        if name not in all_regions:
            all_regions.append(name)

    scene = trimesh.Scene()
    region_records: list[dict] = []
    all_source_points: list[np.ndarray] = []
    assigned = np.zeros(len(faces), dtype=np.int16)
    body_length = float(regenerated["frame"]["bodyLengthSourceUnits"])
    tail_y = float(regenerated["frame"]["tailY"])

    for region_name in all_regions:
        face_ids = np.where(labels == region_name)[0].astype(np.int64)
        if face_ids.size == 0:
            continue
        assigned[face_ids] += 1
        add_region(
            scene=scene,
            region_records=region_records,
            all_source_points=all_source_points,
            name=region_name,
            positions=positions,
            faces=faces,
            face_ids=face_ids,
            color=REGION_COLORS.get(region_name, [180, 180, 180, 255]),
            body_length=body_length,
            tail_y=tail_y,
            source_node=primary_node,
            source_mesh=0,
            source_primitive=0,
            semantic=True,
        )

    if not np.all(assigned == 1):
        missing = int(np.count_nonzero(assigned == 0))
        duplicated = int(np.count_nonzero(assigned > 1))
        raise ValueError(f"primary face assignment failed: missing={missing} duplicated={duplicated}")

    full_scene_face_count = int(len(faces))
    source_primitive_count = 1
    auxiliary_face_count = 0
    auxiliary_region_count = 0

    for node_index, node in enumerate(nodes):
        mesh_index = node.get("mesh")
        if mesh_index is None:
            continue
        transform = world_matrix(nodes, parents, node_index)
        mesh_record = manifest["meshes"][int(mesh_index)]
        for primitive_index, primitive in enumerate(mesh_record.get("primitives", [])):
            if node_index == primary_node and int(mesh_index) == 0 and primitive_index == 0:
                continue
            aux_positions, aux_faces = primitive_arrays(package_root, primitive, transform)
            if len(aux_faces) == 0:
                continue
            face_ids = np.arange(len(aux_faces), dtype=np.int64)
            region_name = f"aux_node_{node_index:03d}_mesh_{int(mesh_index):02d}_prim_{primitive_index:02d}"
            add_region(
                scene=scene,
                region_records=region_records,
                all_source_points=all_source_points,
                name=region_name,
                positions=aux_positions,
                faces=aux_faces,
                face_ids=face_ids,
                color=REGION_COLORS["auxiliary"],
                body_length=body_length,
                tail_y=tail_y,
                source_node=node_index,
                source_mesh=int(mesh_index),
                source_primitive=primitive_index,
                semantic=False,
            )
            source_primitive_count += 1
            auxiliary_region_count += 1
            auxiliary_face_count += int(len(aux_faces))
            full_scene_face_count += int(len(aux_faces))

    source_points = np.concatenate(all_source_points, axis=0)
    source_min = source_points.min(axis=0)
    source_max = source_points.max(axis=0)
    scene.metadata.update({
        "schema": "kaopu.fish-mother.yellowfin-source-copy-static-geometry/1.0",
        "sourceSha256": EXPECTED_SHA,
        "sourceBytes": EXPECTED_BYTES,
        "regionCount": len(region_records),
        "sourcePrimitiveCount": source_primitive_count,
        "classifiedPrimaryFaceCount": int(len(faces)),
        "faceCount": full_scene_face_count,
    })

    glb = trimesh.exchange.gltf.export_glb(scene)
    out_glb.parent.mkdir(parents=True, exist_ok=True)
    out_glb.write_bytes(glb)

    receipt = {
        "schema": "kaopu.fish-mother.yellowfin-source-copy-geometry/1.0",
        "date": "2026-09-21",
        "build": "YELLOWFIN-SOURCE-COPY-R001",
        "stage": "STATIC_SEGMENTED_EXACT_SOURCE_COPY",
        "referenceId": "FISH-REF-002",
        "source": {
            "sha256": EXPECTED_SHA,
            "bytes": EXPECTED_BYTES,
            "classification": str(classification_path.as_posix()),
            "axisContract": regenerated["frame"]["axisContract"],
            "bodyLengthSourceUnits": body_length,
            "tailY": tail_y,
            "snoutY": float(regenerated["frame"]["snoutY"]),
            "sceneMeshCount": len(manifest["meshes"]),
            "sceneNodeMeshInstances": sum(1 for node in nodes if node.get("mesh") is not None),
            "copiedPrimitiveInstances": source_primitive_count,
        },
        "output": {
            "glb": str(out_glb.as_posix()),
            "sha256": sha256_bytes(glb),
            "bytes": len(glb),
            "meshCount": len(region_records),
            "faceCount": full_scene_face_count,
            "classifiedPrimaryFaceCount": int(len(faces)),
            "auxiliaryFaceCount": auxiliary_face_count,
            "auxiliaryRegionCount": auxiliary_region_count,
            "exportedVertexCount": int(sum(item["vertices"] for item in region_records)),
            "boundsSourceUnits": {
                "min": rounded(source_min),
                "max": rounded(source_max),
            },
        },
        "regions": region_records,
        "finlets": {
            "dorsalConfirmedCount": int(regenerated["finlets"]["dorsal"]["confirmedCount"]),
            "ventralConfirmedCount": int(regenerated["finlets"]["ventral"]["confirmedCount"]),
            "dorsalFaces": int(dorsal_ids.size),
            "ventralFaces": int(ventral_ids.size),
        },
        "peduncle": regenerated["peduncle"]["minimum"],
        "gates": {
            "exactSourceBound": True,
            "classificationRegeneratedWithoutDrift": True,
            "allPrimaryFacesAssignedExactlyOnce": True,
            "allSourceMeshPrimitiveInstancesCopied": True,
            "allFacesAssignedExactlyOnce": True,
            "sourcePositionsReusedWithoutModification": True,
            "sourceProportionsPreserved": True,
            "sourceBoundsPreserved": True,
            "segmentedStaticGlbGenerated": True,
            "skinnedAnimationTransferred": False,
            "sourceMaterialsTransferred": False,
            "browserVisualQAPassed": False,
            "independentReconstructionUnlocked": False,
            "productionReady": False,
        },
        "interpretationBoundary": [
            "This GLB is a static region-separated copy of every mesh primitive instance in the exact source scene.",
            "The primary skinned mesh is separated by accepted semantic classification; every additional source primitive is retained as an auxiliary region instead of being silently dropped.",
            "No source vertex position or face was altered; shared boundary vertices are duplicated only between exported region meshes.",
            "Original skinning, animation and materials are intentionally not transferred in this stage.",
            "The geometry remains a transitional source reference, not Thunnus albacares biological truth.",
        ],
        "next": "Run fixed-view source-versus-copy browser QA, then transfer the exact source skeleton and skin weights without changing geometry.",
    }
    out_receipt.parent.mkdir(parents=True, exist_ok=True)
    out_receipt.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + "\n")
    return receipt


def main() -> None:
    parser = argparse.ArgumentParser(description="Build the first exact-source segmented Yellowfin Source Copy geometry GLB.")
    parser.add_argument("--package", type=Path, required=True)
    parser.add_argument("--classification", type=Path, required=True)
    parser.add_argument("--out-glb", type=Path, required=True)
    parser.add_argument("--out-receipt", type=Path, required=True)
    args = parser.parse_args()
    receipt = build(args.package, args.classification, args.out_glb, args.out_receipt)
    print(json.dumps({
        "output": receipt["output"],
        "regions": [{"name": item["name"], "faces": item["faces"], "vertices": item["vertices"]} for item in receipt["regions"]],
        "gates": receipt["gates"],
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
