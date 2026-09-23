#!/usr/bin/env python3
"""Static regression gate for the Blue Coral A04 exact-field stage."""
from pathlib import Path
import json
import sys

root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[1]
package = json.loads((root / "teacher-package.json").read_text(encoding="utf-8"))
manifest = json.loads((root / "contracts/ACCESSOR_MANIFEST.json").read_text(encoding="utf-8"))
receipt = json.loads((root / "contracts/EXACT_VERIFICATION.json").read_text(encoding="utf-8"))

assert package["schema"] == "kaopu.canonical-coral-teacher/1.0"
assert package["version"] == "BLUE_CORAL_CANONICAL_A04"
assert package["stage"] == "ONE_TO_ONE_HIGH_DIMENSIONAL_FIELD_EXPRESSION"
dimensions = package["dimensions"]
assert dimensions["accessorCount"] == 36
assert dimensions["surfaceCount"] == 9
assert dimensions["vertexRecordCount"] == 582_034
assert dimensions["indexCount"] == 3_000_000
assert dimensions["triangleCount"] == 1_000_000
assert dimensions["scalarValueCount"] == 7_656_272

assert package["fields"] == {
    "manifest": "contracts/ACCESSOR_MANIFEST.json",
    "payload": "teacher-fields.bin",
    "payloadBytes": 30_625_096,
    "payloadSha256": "4763714feed24c967d8e39a27ccba18a456a70131247856d6b4fc3c697cd4f06",
    "position": "SOURCE_FLOAT32_BYTE_EXACT",
    "normal": "SOURCE_FLOAT32_BYTE_EXACT",
    "uv0": "SOURCE_FLOAT32_BYTE_EXACT",
    "topology": "SOURCE_UINT32_BYTE_EXACT",
    "allSourceAccessorsPreservedByteExact": True,
}
runtime = package["runtime"]
assert runtime["sourceCloneUsed"] is False
assert runtime["gltfLoaderUsedForCandidate"] is False
assert runtime["runtimeGlbDependency"] is False
assert runtime["runtimeReferenceTextureDependencyForCandidate"] is False
assert runtime["separateCandidateArrayBuffers"] is True
assert runtime["separateCandidateGpuBuffers"] is True
assert runtime["sameScaleSameCameraCompare"] is True
for key, value in package["forbiddenMethods"].items():
    assert value is False, key
boundary = package["boundary"]
assert boundary["oneToOneVisualRestatementApproved"] is False
assert boundary["structureGrammarUnlocked"] is False
assert boundary["isFinalCoralGenerator"] is False
assert boundary["productionReady"] is False

assert manifest["schema"] == "kaopu.coral-a04-accessor-manifest/1.0"
assert manifest["dimensions"]["accessors"] == len(manifest["accessors"]) == 36
assert manifest["dimensions"]["surfaces"] == len(manifest["surfaces"]) == 9
assert manifest["dimensions"]["vertices"] == 582_034
assert manifest["dimensions"]["triangles"] == 1_000_000
assert manifest["fieldPayload"] == {
    "bytes": 30_625_096,
    "sha256": "4763714feed24c967d8e39a27ccba18a456a70131247856d6b4fc3c697cd4f06",
}
assert [a["id"] for a in manifest["accessors"]] == list(range(36))
assert sum(a["count"] * a["width"] for a in manifest["accessors"]) == 7_656_272
assert sum(s["vertexCount"] for s in manifest["surfaces"]) == 582_034
assert sum(s["triangleCount"] for s in manifest["surfaces"]) == 1_000_000
for surface in manifest["surfaces"]:
    bindings = {
        binding["semantic"]
        for accessor in manifest["accessors"]
        for binding in accessor["bindings"]
        if binding["surface"] == surface["id"]
    }
    assert bindings == {"POSITION", "NORMAL", "TEXCOORD_0", "INDICES"}, (surface["id"], bindings)

assert receipt["passed"] is True
assert receipt["accessorByteMismatchCount"] == 0
assert receipt["forbiddenMethodCount"] == 0
assert receipt["scalarValueCountChecked"] == 7_656_272
assert receipt["visualApproval"] is False
assert receipt["structureGrammarUnlocked"] is False
assert receipt["finalGenerator"] is False
print("BLUE_CORAL_A04_SINGLE_CANONICAL_CONTRACT_PASS")
