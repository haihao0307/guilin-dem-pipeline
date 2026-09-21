from __future__ import annotations

import argparse
import hashlib
import json
import struct
from collections import Counter, defaultdict, deque
from pathlib import Path
from typing import Any

EXPECTED_SOURCE_SHA = "5603d4aabc9a1127856841335a86ae7aa462b6b25d1a6586e93bf644f4d47abe"
EXPECTED_SOURCE_BYTES = 58_908_280
JSON_CHUNK = 0x4E4F534A
BIN_CHUNK = 0x004E4942
COMPONENTS = {
    5121: ("B", 1),
    5123: ("H", 2),
    5125: ("I", 4),
}


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def canonical_sha(value: Any) -> str:
    raw = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return sha256(raw)


def read_glb(path: Path) -> tuple[bytes, dict, bytes]:
    raw = path.read_bytes()
    if raw[:4] != b"glTF" or struct.unpack_from("<I", raw, 4)[0] != 2:
        raise ValueError(f"invalid GLB: {path}")
    if struct.unpack_from("<I", raw, 8)[0] != len(raw):
        raise ValueError(f"GLB length mismatch: {path}")
    document = None
    binary = None
    offset = 12
    while offset + 8 <= len(raw):
        length, chunk_type = struct.unpack_from("<II", raw, offset)
        start = offset + 8
        end = start + length
        if end > len(raw):
            raise ValueError(f"GLB chunk overflow: {path}")
        payload = raw[start:end]
        if chunk_type == JSON_CHUNK:
            document = json.loads(payload.decode("utf-8").rstrip("\x00 \t\r\n"))
        elif chunk_type == BIN_CHUNK:
            binary = bytes(payload)
        offset = end
    if document is None or binary is None:
        raise ValueError(f"GLB JSON/BIN chunks missing: {path}")
    declared = int(document["buffers"][0]["byteLength"])
    if declared > len(binary):
        raise ValueError(f"declared BIN exceeds chunk: {path}")
    return raw, document, binary[:declared]


def read_scalar_accessor(document: dict, binary: bytes, accessor_index: int) -> list[int]:
    accessor = document["accessors"][accessor_index]
    if accessor.get("type") != "SCALAR":
        raise ValueError(f"accessor {accessor_index} is not SCALAR")
    component_type = int(accessor["componentType"])
    if component_type not in COMPONENTS:
        raise ValueError(f"unsupported scalar component type: {component_type}")
    fmt, width = COMPONENTS[component_type]
    view = document["bufferViews"][accessor["bufferView"]]
    stride = int(view.get("byteStride", width))
    start = int(view.get("byteOffset", 0)) + int(accessor.get("byteOffset", 0))
    values = []
    for index in range(int(accessor["count"])):
        values.append(struct.unpack_from("<" + fmt, binary, start + index * stride)[0])
    return values


def triangles(indices: list[int]) -> list[tuple[int, int, int]]:
    if len(indices) % 3:
        raise ValueError("triangle index accessor is not divisible by three")
    return [tuple(indices[index:index + 3]) for index in range(0, len(indices), 3)]


def material_record(document: dict, material_index: int) -> dict:
    material = document.get("materials", [])[material_index]
    pbr = material.get("pbrMetallicRoughness", {})
    return {
        "index": material_index,
        "name": material.get("name", f"material-{material_index}"),
        "alphaMode": material.get("alphaMode", "OPAQUE"),
        "doubleSided": bool(material.get("doubleSided", False)),
        "baseColorTexture": (pbr.get("baseColorTexture") or {}).get("index"),
        "metallicRoughnessTexture": (pbr.get("metallicRoughnessTexture") or {}).get("index"),
        "normalTexture": (material.get("normalTexture") or {}).get("index"),
        "occlusionTexture": (material.get("occlusionTexture") or {}).get("index"),
        "emissiveTexture": (material.get("emissiveTexture") or {}).get("index"),
        "canonicalSha256": canonical_sha(material),
    }


def build(
    source_path: Path,
    copy_path: Path,
    skinned_receipt_path: Path,
    skinned_browser_path: Path,
    output_path: Path,
) -> dict:
    source_raw, source_doc, source_bin = read_glb(source_path)
    copy_raw, copy_doc, copy_bin = read_glb(copy_path)
    skinned = json.loads(skinned_receipt_path.read_text())
    browser = json.loads(skinned_browser_path.read_text())

    if len(source_raw) != EXPECTED_SOURCE_BYTES or sha256(source_raw) != EXPECTED_SOURCE_SHA:
        raise ValueError("exact FISH-REF-002 source required")
    if sha256(copy_raw) != skinned["output"]["sha256"] or len(copy_raw) != skinned["output"]["bytes"]:
        raise ValueError("copy GLB does not match accepted skinned receipt")
    if browser.get("passed") is not True or browser.get("copySha256") != skinned["output"]["sha256"]:
        raise ValueError("accepted skinned browser receipt required")

    source_primary = source_doc["meshes"][0]["primitives"][0]
    semantic_count = int(skinned["output"]["semanticPrimitiveCount"])
    copy_primary_primitives = copy_doc["meshes"][0]["primitives"][:semantic_count]
    source_faces = triangles(read_scalar_accessor(source_doc, source_bin, int(source_primary["indices"])))

    source_face_queues: dict[tuple[int, int, int], deque[int]] = defaultdict(deque)
    for face_id, face in enumerate(source_faces):
        source_face_queues[face].append(face_id)

    region_records = []
    region_for_face: list[str | None] = [None] * len(source_faces)
    source_material_index = int(source_primary.get("material", 0))
    expected_region_order = [entry["name"] for entry in skinned["regions"]]

    for primitive_index, primitive in enumerate(copy_primary_primitives):
        extras = primitive.get("extras") if isinstance(primitive.get("extras"), dict) else {}
        region_name = extras.get("kaopuSourceCopyRegion")
        if not region_name:
            raise ValueError(f"semantic primitive {primitive_index} has no region name")
        region_faces = triangles(read_scalar_accessor(copy_doc, copy_bin, int(primitive["indices"])))
        face_ids = []
        for face in region_faces:
            queue = source_face_queues.get(face)
            if not queue:
                raise ValueError(f"region {region_name} contains a triangle absent from source")
            face_id = queue.popleft()
            if region_for_face[face_id] is not None:
                raise ValueError(f"source face assigned twice: {face_id}")
            region_for_face[face_id] = region_name
            face_ids.append(face_id)
        material_index = int(primitive.get("material", 0))
        region_records.append({
            "name": region_name,
            "primitiveIndex": primitive_index,
            "faces": len(region_faces),
            "indices": len(region_faces) * 3,
            "sourceFaceIdSha256": sha256(b"".join(struct.pack("<I", value) for value in face_ids)),
            "material": material_record(copy_doc, material_index),
            "usesOriginalPrimaryMaterial": material_index == source_material_index,
            "attributesEqualSourcePrimary": primitive.get("attributes", {}) == source_primary.get("attributes", {}),
            "modeEqualSourcePrimary": int(primitive.get("mode", 4)) == int(source_primary.get("mode", 4)),
            "targetsEqualSourcePrimary": primitive.get("targets", []) == source_primary.get("targets", []),
            "extensionsEqualSourcePrimary": primitive.get("extensions", {}) == source_primary.get("extensions", {}),
        })

    unconsumed_source_faces = sum(len(queue) for queue in source_face_queues.values())
    unassigned_faces = [index for index, region in enumerate(region_for_face) if region is None]
    if unconsumed_source_faces or unassigned_faces:
        raise ValueError(f"source face partition incomplete: unconsumed={unconsumed_source_faces} unassigned={len(unassigned_faces)}")

    edge_incidents: dict[tuple[int, int], list[int]] = defaultdict(list)
    for face_id, face in enumerate(source_faces):
        a, b, c = face
        for edge in ((a, b), (b, c), (c, a)):
            edge_incidents[tuple(sorted(edge))].append(face_id)

    boundary_pairs: Counter[tuple[str, str]] = Counter()
    boundary_vertices = set()
    inter_region_edges = 0
    external_edges = 0
    non_manifold_edges = 0
    for edge, face_ids in edge_incidents.items():
        if len(face_ids) == 1:
            external_edges += 1
            continue
        if len(face_ids) > 2:
            non_manifold_edges += 1
        regions = sorted({region_for_face[face_id] for face_id in face_ids if region_for_face[face_id] is not None})
        if len(regions) > 1:
            inter_region_edges += 1
            boundary_vertices.update(edge)
            for left_index in range(len(regions)):
                for right_index in range(left_index + 1, len(regions)):
                    boundary_pairs[(regions[left_index], regions[right_index])] += 1

    source_prefix = copy_bin[:len(source_bin)]
    materials_equal = source_doc.get("materials", []) == copy_doc.get("materials", [])
    textures_equal = source_doc.get("textures", []) == copy_doc.get("textures", [])
    images_equal = source_doc.get("images", []) == copy_doc.get("images", [])
    samplers_equal = source_doc.get("samplers", []) == copy_doc.get("samplers", [])

    source_meshes = source_doc.get("meshes", [])
    copy_meshes = copy_doc.get("meshes", [])
    eye_material_index = int(source_meshes[1]["primitives"][0].get("material", 0)) if len(source_meshes) > 1 else None
    cornea_material_index = int(source_meshes[2]["primitives"][0].get("material", 0)) if len(source_meshes) > 2 else None
    eye_material = material_record(copy_doc, eye_material_index) if eye_material_index is not None else None
    cornea_material = material_record(copy_doc, cornea_material_index) if cornea_material_index is not None else None

    region_order = [record["name"] for record in region_records]
    region_material_indices = sorted({record["material"]["index"] for record in region_records})
    region_faces_total = sum(record["faces"] for record in region_records)

    gates = {
        "exactSourceBound": True,
        "acceptedSkinnedCopyBound": True,
        "semanticRegionCountExact": len(region_records) == semantic_count == 13,
        "semanticRegionOrderMatchesReceipt": region_order == expected_region_order,
        "semanticRegionNamesUnique": len(region_order) == len(set(region_order)),
        "primaryTriangleInventoryExact": region_faces_total == len(source_faces) == int(skinned["output"]["semanticFaceCount"]),
        "everyPrimaryFaceAssignedExactlyOnce": all(region is not None for region in region_for_face),
        "allSemanticRegionsUseOriginalPrimaryMaterial": all(record["usesOriginalPrimaryMaterial"] for record in region_records),
        "allSemanticRegionsShareOriginalAttributes": all(record["attributesEqualSourcePrimary"] for record in region_records),
        "allSemanticRegionsRetainModeTargetsExtensions": all(
            record["modeEqualSourcePrimary"] and record["targetsEqualSourcePrimary"] and record["extensionsEqualSourcePrimary"]
            for record in region_records
        ),
        "interRegionBoundaryUsesSharedSourceVertexIds": inter_region_edges > 0 and len(boundary_vertices) > 0,
        "sourceBinaryPrefixByteIdentical": source_prefix == source_bin,
        "sourceMaterialTableUnchanged": materials_equal,
        "sourceTextureTableUnchanged": textures_equal,
        "sourceImageTableUnchanged": images_equal,
        "sourceSamplerTableUnchanged": samplers_equal,
        "eyeMaterialRetained": eye_material is not None and copy_meshes[1] == source_meshes[1],
        "corneaMaterialRetained": cornea_material is not None and copy_meshes[2] == source_meshes[2],
        "corneaBlendModeRetained": cornea_material is not None and cornea_material["alphaMode"] == "BLEND",
        "skinnedMotionBrowserQAPassed": browser.get("passed") is True,
        "skinnedDynamicBoundsExact": float(browser.get("maximumDynamicBoundsDelta", 1)) == 0.0,
        "skinnedBoneMatricesExact": float(browser.get("maximumBoneMatrixDelta", 1)) == 0.0,
        "browserRegionVisibilityQAPassed": False,
        "sourceCopyR001Frozen": False,
        "productionReady": False,
    }

    hard_gate_names = [name for name in gates if name not in {"browserRegionVisibilityQAPassed", "sourceCopyR001Frozen", "productionReady"}]
    failed = [name for name in hard_gate_names if gates[name] is not True]
    if failed:
        raise ValueError(f"region/material acceptance structural gates failed: {failed}")

    report = {
        "schema": "kaopu.fish-mother.yellowfin-source-copy-region-material-acceptance/1.0",
        "date": "2026-09-21",
        "build": "YELLOWFIN-SOURCE-COPY-R001-REGION-MATERIAL-ACCEPTANCE",
        "referenceId": "FISH-REF-002",
        "source": {
            "path": str(source_path.as_posix()),
            "sha256": EXPECTED_SOURCE_SHA,
            "bytes": len(source_raw),
            "primaryFaces": len(source_faces),
            "primaryMaterial": material_record(source_doc, source_material_index),
        },
        "copy": {
            "path": str(copy_path.as_posix()),
            "sha256": sha256(copy_raw),
            "bytes": len(copy_raw),
            "semanticRegionCount": len(region_records),
            "semanticFaces": region_faces_total,
            "regionMaterialIndices": region_material_indices,
            "meshCount": len(copy_doc.get("meshes", [])),
            "primitiveCount": sum(len(mesh.get("primitives", [])) for mesh in copy_doc.get("meshes", [])),
            "skinCount": len(copy_doc.get("skins", [])),
            "animationCount": len(copy_doc.get("animations", [])),
        },
        "regions": region_records,
        "boundary": {
            "interRegionEdges": inter_region_edges,
            "interRegionVertices": len(boundary_vertices),
            "externalEdges": external_edges,
            "nonManifoldEdges": non_manifold_edges,
            "adjacency": [
                {"regions": [left, right], "sharedEdges": count}
                for (left, right), count in sorted(boundary_pairs.items())
            ],
            "interpretation": "Region primitives reuse the exact source POSITION/NORMAL/TANGENT/UV/JOINTS/WEIGHTS accessors and original vertex IDs. The split adds draw-call addressability without introducing geometric gaps or independent boundary vertices.",
        },
        "materials": {
            "inventory": [material_record(copy_doc, index) for index in range(len(copy_doc.get("materials", [])))],
            "primaryBodyMaterialIndex": source_material_index,
            "eyeMaterial": eye_material,
            "corneaMaterial": cornea_material,
            "tables": {
                "materialsSha256": canonical_sha(copy_doc.get("materials", [])),
                "texturesSha256": canonical_sha(copy_doc.get("textures", [])),
                "imagesSha256": canonical_sha(copy_doc.get("images", [])),
                "samplersSha256": canonical_sha(copy_doc.get("samplers", [])),
            },
        },
        "gates": gates,
        "visualEvidence": None,
        "acceptanceBoundary": [
            "This stage accepts region addressability and exact source material boundaries only.",
            "It does not claim the transitional source is biologically correct Yellowfin tuna.",
            "Automated browser evidence is machine acceptance; user visual approval remains a separate signal.",
        ],
        "next": "Run region-by-region browser isolation at rest and mid-Swim, capture source-material views, then freeze Source Copy R001 as an immutable baseline.",
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description="Build Yellowfin Source Copy R001 region/material acceptance evidence.")
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--copy", type=Path, required=True)
    parser.add_argument("--skinned-receipt", type=Path, required=True)
    parser.add_argument("--skinned-browser", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    report = build(args.source, args.copy, args.skinned_receipt, args.skinned_browser, args.out)
    print(json.dumps({
        "copy": report["copy"],
        "boundary": report["boundary"],
        "materials": report["materials"],
        "gates": report["gates"],
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
