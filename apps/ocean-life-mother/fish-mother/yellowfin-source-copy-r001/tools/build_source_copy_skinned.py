from __future__ import annotations

import argparse
import copy
import hashlib
import json
import struct
import sys
from pathlib import Path

import numpy as np

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from classify_source_components import EXPECTED_BYTES, EXPECTED_SHA, classify


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

JSON_CHUNK = 0x4E4F534A
BIN_CHUNK = 0x004E4942


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def read_glb(path: Path) -> tuple[bytes, dict, bytes]:
    raw = path.read_bytes()
    if len(raw) != EXPECTED_BYTES or sha256(raw) != EXPECTED_SHA:
        raise ValueError("exact FISH-REF-002 GLB required")
    if raw[:4] != b"glTF" or struct.unpack_from("<I", raw, 4)[0] != 2:
        raise ValueError("invalid GLB header")
    if struct.unpack_from("<I", raw, 8)[0] != len(raw):
        raise ValueError("invalid GLB length")
    offset = 12
    document = None
    binary = None
    while offset + 8 <= len(raw):
        length, chunk_type = struct.unpack_from("<II", raw, offset)
        start = offset + 8
        end = start + length
        if end > len(raw):
            raise ValueError("GLB chunk exceeds file length")
        payload = raw[start:end]
        if chunk_type == JSON_CHUNK:
            document = json.loads(payload.decode("utf-8").rstrip("\x00 \t\r\n"))
        elif chunk_type == BIN_CHUNK:
            binary = bytes(payload)
        offset = end
    if document is None or binary is None:
        raise ValueError("GLB must contain JSON and BIN chunks")
    return raw, document, binary


def align4(buffer: bytearray, pad: int = 0) -> None:
    while len(buffer) % 4:
        buffer.append(pad)


def append_index_accessor(document: dict, binary: bytearray, indices: np.ndarray) -> tuple[int, dict]:
    flat = np.ascontiguousarray(indices.reshape(-1))
    max_index = int(flat.max()) if len(flat) else 0
    if max_index <= np.iinfo(np.uint16).max:
        encoded = flat.astype("<u2", copy=False).tobytes()
        component_type = 5123
        dtype = "uint16"
    else:
        encoded = flat.astype("<u4", copy=False).tobytes()
        component_type = 5125
        dtype = "uint32"
    align4(binary)
    byte_offset = len(binary)
    binary.extend(encoded)
    buffer_view_index = len(document.setdefault("bufferViews", []))
    document["bufferViews"].append({
        "buffer": 0,
        "byteOffset": byte_offset,
        "byteLength": len(encoded),
        "target": 34963,
    })
    accessor_index = len(document.setdefault("accessors", []))
    accessor = {
        "bufferView": buffer_view_index,
        "byteOffset": 0,
        "componentType": component_type,
        "count": int(flat.size),
        "type": "SCALAR",
        "min": [int(flat.min())] if len(flat) else [0],
        "max": [max_index],
    }
    document["accessors"].append(accessor)
    return accessor_index, {
        "componentType": component_type,
        "dtype": dtype,
        "count": int(flat.size),
        "triangles": int(flat.size // 3),
        "bytes": len(encoded),
        "sha256": sha256(encoded),
    }


def pack_glb(document: dict, binary: bytes) -> bytes:
    document.setdefault("buffers", [{}])
    if len(document["buffers"]) != 1:
        raise ValueError("single embedded GLB buffer required")
    document["buffers"][0].pop("uri", None)
    document["buffers"][0]["byteLength"] = len(binary)
    json_bytes = json.dumps(document, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    json_bytes += b" " * ((4 - len(json_bytes) % 4) % 4)
    bin_bytes = bytes(binary)
    bin_bytes += b"\x00" * ((4 - len(bin_bytes) % 4) % 4)
    total = 12 + 8 + len(json_bytes) + 8 + len(bin_bytes)
    return b"".join([
        struct.pack("<4sII", b"glTF", 2, total),
        struct.pack("<II", len(json_bytes), JSON_CHUNK),
        json_bytes,
        struct.pack("<II", len(bin_bytes), BIN_CHUNK),
        bin_bytes,
    ])


def semantic_labels(data: dict) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    labels = np.asarray([REGION_ALIASES.get(str(value), str(value)) for value in data["faceGroups"]], dtype=object)
    dorsal_ids = np.asarray(data["finletFaces"]["dorsal"], dtype=np.int64)
    ventral_ids = np.asarray(data["finletFaces"]["ventral"], dtype=np.int64)
    if np.intersect1d(dorsal_ids, ventral_ids).size:
        raise ValueError("dorsal and ventral finlet face sets overlap")
    labels[dorsal_ids] = "dorsal_finlets"
    labels[ventral_ids] = "ventral_finlets"
    return labels, dorsal_ids, ventral_ids


def build(source_glb: Path, package_root: Path, classification_path: Path, out_glb: Path, out_receipt: Path) -> dict:
    committed = json.loads(classification_path.read_text())
    if committed.get("source", {}).get("sha256") != EXPECTED_SHA or int(committed.get("source", {}).get("bytes", -1)) != EXPECTED_BYTES:
        raise ValueError("classification is not bound to exact FISH-REF-002")

    source_raw, source_document, source_binary_chunk = read_glb(source_glb)
    source_buffer_length = int(source_document["buffers"][0]["byteLength"])
    if source_buffer_length > len(source_binary_chunk):
        raise ValueError("declared source buffer exceeds BIN chunk")
    source_binary = source_binary_chunk[:source_buffer_length]

    regenerated, data = classify(package_root)
    if regenerated["finlets"]["dorsal"]["confirmedCount"] != committed["finlets"]["dorsal"]["confirmedCount"]:
        raise ValueError("dorsal finlet classification drift")
    if regenerated["finlets"]["ventral"]["confirmedCount"] != committed["finlets"]["ventral"]["confirmedCount"]:
        raise ValueError("ventral finlet classification drift")
    if regenerated["peduncle"]["minimum"] != committed["peduncle"]["minimum"]:
        raise ValueError("peduncle classification drift")

    faces = np.asarray(data["faces"], dtype=np.int64)
    labels, dorsal_ids, ventral_ids = semantic_labels(data)
    original_primary = source_document["meshes"][0]["primitives"][0]
    if int(original_primary.get("mode", 4)) != 4:
        raise ValueError("primary source primitive must use TRIANGLES mode")
    original_index_accessor = int(original_primary["indices"])
    original_index_count = int(source_document["accessors"][original_index_accessor]["count"])
    if original_index_count != faces.size:
        raise ValueError(f"primary source index count drift: {original_index_count} != {faces.size}")

    output_document = copy.deepcopy(source_document)
    output_binary = bytearray(source_binary)
    source_mesh_count = len(source_document.get("meshes", []))
    source_primitive_count = sum(len(mesh.get("primitives", [])) for mesh in source_document.get("meshes", []))
    source_node_count = len(source_document.get("nodes", []))
    source_skin_count = len(source_document.get("skins", []))
    source_animation_count = len(source_document.get("animations", []))
    source_material_count = len(source_document.get("materials", []))
    source_image_count = len(source_document.get("images", []))

    region_order = list(REGION_ORDER)
    for name in sorted(set(str(value) for value in labels)):
        if name not in region_order:
            region_order.append(name)

    assigned = np.zeros(len(faces), dtype=np.int16)
    region_primitives = []
    region_records = []
    for region_name in region_order:
        face_ids = np.where(labels == region_name)[0].astype(np.int64)
        if face_ids.size == 0:
            continue
        assigned[face_ids] += 1
        region_indices = faces[face_ids]
        accessor_index, index_record = append_index_accessor(output_document, output_binary, region_indices)
        primitive = copy.deepcopy(original_primary)
        primitive["indices"] = accessor_index
        primitive_extras = primitive.get("extras") if isinstance(primitive.get("extras"), dict) else {}
        primitive["extras"] = {
            **primitive_extras,
            "kaopuSourceCopyRegion": region_name,
            "sourceFaceCount": int(face_ids.size),
            "sourceFaceIdSha256": sha256(np.ascontiguousarray(face_ids.astype("<u4")).tobytes()),
        }
        region_primitives.append(primitive)
        region_records.append({
            "name": region_name,
            "faces": int(face_ids.size),
            "sourceFaceIdSha256": primitive["extras"]["sourceFaceIdSha256"],
            "indexAccessor": accessor_index,
            "index": index_record,
        })

    if not np.all(assigned == 1):
        missing = int(np.count_nonzero(assigned == 0))
        duplicated = int(np.count_nonzero(assigned > 1))
        raise ValueError(f"semantic primitive partition failed: missing={missing} duplicated={duplicated}")

    primary_mesh = output_document["meshes"][0]
    untouched_primary_primitives = copy.deepcopy(primary_mesh.get("primitives", [])[1:])
    primary_mesh["primitives"] = region_primitives + untouched_primary_primitives
    mesh_extras = primary_mesh.get("extras") if isinstance(primary_mesh.get("extras"), dict) else {}
    primary_mesh["extras"] = {
        **mesh_extras,
        "kaopuSourceCopy": {
            "referenceId": "FISH-REF-002",
            "sourceSha256": EXPECTED_SHA,
            "segmentedPrimitiveCount": len(region_primitives),
            "regions": [item["name"] for item in region_records],
        },
    }

    asset_extras = output_document.setdefault("asset", {}).get("extras")
    if not isinstance(asset_extras, dict):
        asset_extras = {}
    output_document["asset"]["extras"] = {
        **asset_extras,
        "kaopuSourceCopy": {
            "schema": "kaopu.fish-mother.yellowfin-source-copy-skinned/1.0",
            "referenceId": "FISH-REF-002",
            "sourceSha256": EXPECTED_SHA,
            "geometryPolicy": "exact source positions and topology; primary primitive partition only",
            "skinPolicy": "source skin, inverse bind matrices, joint hierarchy and weights retained",
            "animationPolicy": "all source animation channels and samplers retained",
            "materialPolicy": "all source materials, textures and images retained",
        },
    }

    output_raw = pack_glb(output_document, bytes(output_binary))
    out_glb.parent.mkdir(parents=True, exist_ok=True)
    out_glb.write_bytes(output_raw)

    output_raw_check, output_document_check, output_binary_chunk = read_output_glb(out_glb)
    output_buffer_length = int(output_document_check["buffers"][0]["byteLength"])
    output_binary_prefix = output_binary_chunk[:source_buffer_length]
    if output_binary_prefix != source_binary:
        raise ValueError("source BIN prefix changed during skin transfer")
    if len(output_raw_check) != len(output_raw):
        raise ValueError("output GLB re-read length mismatch")

    receipt = {
        "schema": "kaopu.fish-mother.yellowfin-source-copy-skinned/1.0",
        "date": "2026-09-21",
        "build": "YELLOWFIN-SOURCE-COPY-R001-SKINNED",
        "referenceId": "FISH-REF-002",
        "source": {
            "path": str(source_glb.as_posix()),
            "sha256": EXPECTED_SHA,
            "bytes": len(source_raw),
            "bufferBytes": source_buffer_length,
            "bufferSha256": sha256(source_binary),
            "meshCount": source_mesh_count,
            "primitiveCount": source_primitive_count,
            "nodeCount": source_node_count,
            "skinCount": source_skin_count,
            "animationCount": source_animation_count,
            "materialCount": source_material_count,
            "imageCount": source_image_count,
            "primaryIndexAccessor": original_index_accessor,
            "primaryIndexCount": original_index_count,
        },
        "output": {
            "path": str(out_glb.as_posix()),
            "sha256": sha256(output_raw),
            "bytes": len(output_raw),
            "bufferBytes": output_buffer_length,
            "sourceBufferPrefixBytes": source_buffer_length,
            "sourceBufferPrefixSha256": sha256(output_binary_prefix),
            "meshCount": len(output_document_check.get("meshes", [])),
            "primitiveCount": sum(len(mesh.get("primitives", [])) for mesh in output_document_check.get("meshes", [])),
            "nodeCount": len(output_document_check.get("nodes", [])),
            "skinCount": len(output_document_check.get("skins", [])),
            "animationCount": len(output_document_check.get("animations", [])),
            "materialCount": len(output_document_check.get("materials", [])),
            "imageCount": len(output_document_check.get("images", [])),
            "semanticPrimitiveCount": len(region_primitives),
            "semanticFaceCount": int(sum(item["faces"] for item in region_records)),
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
            "primaryFacesPartitionedExactlyOnce": True,
            "sourceBinaryPrefixByteIdentical": True,
            "sourcePositionNormalUvJointWeightAccessorsRetained": True,
            "sourceNodesRetained": True,
            "sourceSkinsRetained": True,
            "sourceInverseBindMatricesRetained": True,
            "sourceAnimationsRetained": True,
            "sourceMaterialsTexturesImagesRetained": True,
            "nonPrimaryPrimitivesRetained": True,
            "browserRestPoseQAPassed": False,
            "browserAnimationQAPassed": False,
            "productionReady": False,
        },
        "next": "Run synchronized rest-pose and Swim animation browser overlay QA before accepting the skinned segmented source copy.",
    }
    out_receipt.parent.mkdir(parents=True, exist_ok=True)
    out_receipt.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + "\n")
    return receipt


def read_output_glb(path: Path) -> tuple[bytes, dict, bytes]:
    raw = path.read_bytes()
    if raw[:4] != b"glTF" or struct.unpack_from("<I", raw, 4)[0] != 2 or struct.unpack_from("<I", raw, 8)[0] != len(raw):
        raise ValueError("generated GLB is invalid")
    offset = 12
    document = None
    binary = None
    while offset + 8 <= len(raw):
        length, chunk_type = struct.unpack_from("<II", raw, offset)
        start = offset + 8
        end = start + length
        if chunk_type == JSON_CHUNK:
            document = json.loads(raw[start:end].decode("utf-8").rstrip("\x00 \t\r\n"))
        elif chunk_type == BIN_CHUNK:
            binary = bytes(raw[start:end])
        offset = end
    if document is None or binary is None:
        raise ValueError("generated GLB is missing chunks")
    return raw, document, binary


def main() -> None:
    parser = argparse.ArgumentParser(description="Create a lossless skinned and animated segmented copy of exact FISH-REF-002.")
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--package", type=Path, required=True)
    parser.add_argument("--classification", type=Path, required=True)
    parser.add_argument("--out-glb", type=Path, required=True)
    parser.add_argument("--out-receipt", type=Path, required=True)
    args = parser.parse_args()
    receipt = build(args.source, args.package, args.classification, args.out_glb, args.out_receipt)
    print(json.dumps({
        "output": receipt["output"],
        "regions": [{"name": item["name"], "faces": item["faces"], "index": item["index"]} for item in receipt["regions"]],
        "gates": receipt["gates"],
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
