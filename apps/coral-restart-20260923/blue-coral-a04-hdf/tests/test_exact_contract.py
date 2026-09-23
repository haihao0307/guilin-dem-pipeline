#!/usr/bin/env python3
"""Static regression gate for the Blue Coral A04 exact-field stage."""
from pathlib import Path
import json
import sys

root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[1]
package = json.loads((root / "teacher-package.json").read_text(encoding="utf-8"))
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
print("BLUE_CORAL_A04_EXACT_CONTRACT_PASS")
