#!/usr/bin/env python3
"""Static regression gate for the Blue Coral A04 exact-field stage."""
from pathlib import Path
import json
import sys

root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[1]
package = json.loads((root / "teacher-package.json").read_text(encoding="utf-8"))
manifest = json.loads((root / "contracts/ACCESSOR_MANIFEST.json").read_text(encoding="utf-8"))
receipt = json.loads((root / "contracts/EXACT_VERIFICATION.json").read_text(encoding="utf-8"))
assert package["schema"] in {"kaopu.coral.teacher-fields/1.0", "kaopu.canonical-coral-teacher/1.0"}
assert package["stage"] in {
    "ONE_TO_ONE_HIGH_DIMENSIONAL_FUNCTION_EXPRESSION_GEOMETRY_CORE",
    "ONE_TO_ONE_HIGH_DIMENSIONAL_FIELD_EXPRESSION",
}
geometry = package.get("geometry") or package["sourceDimensions"]
assert geometry.get("primitiveCount", geometry.get("surfaces")) == 9
assert geometry.get("vertexRecordCount", geometry.get("vertices")) == 582_034
assert geometry.get("triangleCount", geometry.get("triangles")) == 1_000_000
proof = package.get("proof", package.get("contracts", {}))
for key in (
    "meshSimplification",
    "decimation",
    "remesh",
    "remeshing",
    "voxel",
    "voxelization",
    "marchingCubes",
    "surfaceProjection",
    "cloneTeacherObject",
    "sourceCloneUsed",
):
    if key in proof:
        assert proof[key] is False, key

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
print("BLUE_CORAL_A04_EXACT_CONTRACT_PASS")
