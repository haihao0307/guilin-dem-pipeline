#!/usr/bin/env python3
"""Verify Blue Coral A04 exact teacher fields against the current user source.

This verifier is deliberately hostile to silent downgrade. It checks every source
accessor byte, every field offset/hash, all surface counts, and the frozen
no-simplification contract. It does not approve visual quality or unlock the
structure-grammar stage.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any

COMPONENT_BYTES = {5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4}
TYPE_WIDTHS = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT2": 4, "MAT3": 9, "MAT4": 16}
LOCKED = {
    "archiveSha256": "c65bc1b9c389b3b1c3f4c09fc345619ad4ad4994666a06eb294822eafa503857",
    "gltfSha256": "6a13fc948469db72878528f4941a734bfac256dc1d2939ab6dcc9e2fe1818e0a",
    "binarySha256": "23f65069936dc9316b975617beb9a07991a24b20bba8de5f45ff6bb0afecadb3",
    "textureSha256": "27734e7adaa0657fb314715088f74c707c12c8029965cb12172fef104a673906",
    "accessors": 36,
    "surfaces": 9,
    "vertices": 582_034,
    "triangles": 1_000_000,
}
FORBIDDEN_TRUE = {
    "sourceCloneUsed",
    "gltfLoaderUsedForCandidate",
    "meshSimplification",
    "decimation",
    "remeshing",
    "voxelization",
    "marchingCubes",
    "fittedProxy",
    "genericNoiseReplacement",
}


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def read_source_accessor(gltf: dict[str, Any], source: bytes, accessor_id: int) -> bytes:
    accessor = gltf["accessors"][accessor_id]
    if "sparse" in accessor:
        raise AssertionError(f"Sparse accessor {accessor_id} requires explicit implementation")
    view = gltf["bufferViews"][accessor["bufferView"]]
    item_bytes = COMPONENT_BYTES[accessor["componentType"]] * TYPE_WIDTHS[accessor["type"]]
    stride = int(view.get("byteStride", item_bytes))
    offset = int(view.get("byteOffset", 0)) + int(accessor.get("byteOffset", 0))
    count = int(accessor["count"])
    if stride == item_bytes:
        result = source[offset : offset + count * item_bytes]
    else:
        result = b"".join(source[offset + i * stride : offset + i * stride + item_bytes] for i in range(count))
    assert len(result) == count * item_bytes
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-dir", required=True)
    parser.add_argument("--source-zip", required=True)
    parser.add_argument("--package", required=True)
    parser.add_argument("--fields", required=True)
    parser.add_argument("--workbench")
    parser.add_argument("--receipt", required=True)
    args = parser.parse_args()

    source_dir = Path(args.source_dir)
    source_zip = Path(args.source_zip)
    package_path = Path(args.package)
    fields_path = Path(args.fields)
    receipt_path = Path(args.receipt)

    gltf_bytes = (source_dir / "scene.gltf").read_bytes()
    binary_bytes = (source_dir / "scene.bin").read_bytes()
    texture_bytes = (source_dir / "textures/material_0_baseColor.png").read_bytes()
    archive_bytes = source_zip.read_bytes()
    actual = {
        "archiveSha256": sha(archive_bytes),
        "gltfSha256": sha(gltf_bytes),
        "binarySha256": sha(binary_bytes),
        "textureSha256": sha(texture_bytes),
    }
    for key in actual:
        assert actual[key] == LOCKED[key], (key, actual[key], LOCKED[key])

    gltf = json.loads(gltf_bytes)
    package = json.loads(package_path.read_text(encoding="utf-8"))
    fields_blob = fields_path.read_bytes()
    assert package["schema"] == "kaopu.canonical-coral-teacher/1.0"
    assert package["version"] == "BLUE_CORAL_CANONICAL_A04"
    assert package["stage"] == "ONE_TO_ONE_HIGH_DIMENSIONAL_FIELD_EXPRESSION"
    assert len(package["fields"]) == LOCKED["accessors"] == len(gltf["accessors"])
    assert len(package["surfaces"]) == LOCKED["surfaces"]
    dims = package["sourceDimensions"]
    assert dims["vertices"] == LOCKED["vertices"]
    assert dims["triangles"] == LOCKED["triangles"]

    mismatches: list[dict[str, Any]] = []
    scalar_values = 0
    for accessor_id, field in enumerate(package["fields"]):
        source_bytes = read_source_accessor(gltf, binary_bytes, accessor_id)
        decoded_bytes = fields_blob[field["offset"] : field["offset"] + field["byteLength"]]
        scalar_values += int(field["count"]) * int(field["width"])
        if source_bytes != decoded_bytes or sha(decoded_bytes) != field["sha256"]:
            mismatches.append(
                {
                    "accessor": accessor_id,
                    "sourceSha256": sha(source_bytes),
                    "fieldSha256": sha(decoded_bytes),
                    "declaredSha256": field["sha256"],
                    "sourceBytes": len(source_bytes),
                    "fieldBytes": len(decoded_bytes),
                }
            )
    assert not mismatches, mismatches

    contracts = package["contracts"]
    for key in FORBIDDEN_TRUE:
        assert contracts.get(key) is False, (key, contracts.get(key))
    assert contracts["allSourceAccessorsPreservedByteExact"] is True
    assert contracts["separateCandidateBuffersRequired"] is True
    assert contracts["sameScaleSameCameraComparisonRequired"] is True
    assert contracts["teacherRemovableFinalGenerator"] is False

    workbench = None
    if args.workbench:
        data = Path(args.workbench).read_bytes()
        workbench = {"bytes": len(data), "sha256": sha(data)}
        text = data.decode("utf-8")
        required = [
            "BLUE_CORAL_CANONICAL_A04",
            "ONE_TO_ONE_HIGH_DIMENSIONAL_FIELD_EXPRESSION",
            "separateTypedArrays",
            "separateGpuBuffers",
            "noSourceObjectClone",
        ]
        forbidden = [
            "new GLTFLoader(",
            "from 'three/addons/loaders/GLTFLoader.js'",
            'from "three/addons/loaders/GLTFLoader.js"',
            "new MarchingCubes(",
            "new SimplifyModifier(",
            "meshopt_simplify(",
        ]
        for marker in required:
            assert marker in text, marker
        for marker in forbidden:
            assert marker not in text, marker

    receipt = {
        "schema": "kaopu.coral-a04-exact-verification/1.0",
        "version": package["version"],
        "sourceIdentity": actual,
        "fieldPayload": {"bytes": len(fields_blob), "sha256": sha(fields_blob)},
        "accessorCount": len(package["fields"]),
        "surfaceCount": len(package["surfaces"]),
        "vertexRecordCount": dims["vertices"],
        "triangleCount": dims["triangles"],
        "scalarValueCountChecked": scalar_values,
        "accessorByteMismatchCount": 0,
        "forbiddenMethodCount": 0,
        "workbench": workbench,
        "visualApproval": False,
        "structureGrammarUnlocked": False,
        "finalGenerator": False,
        "productionReady": False,
        "passed": True,
    }
    receipt_path.parent.mkdir(parents=True, exist_ok=True)
    receipt_path.write_text(json.dumps(receipt, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps(receipt, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
