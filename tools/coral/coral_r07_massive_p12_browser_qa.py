from __future__ import annotations

"""R07-P12 browser and geometry gate profile.

P12 keeps the P11 Poisson sites, real geometry displacement, uniform RGB
species colour, and non-RGB micro-lighting signal, but replaces the
latitude-longitude skin with a uniformly subdivided octahedral geodesic
hemisphere.  The gates reject apex duplication and directional lat-long
singularities before accepting the existing readable-corallite checks.
"""

import json
import sys
from pathlib import Path


SOURCE = Path(__file__).with_name("coral_r07_massive_p11_browser_qa.py")
code = SOURCE.read_text(encoding="utf-8")

old_space = "assert qa.get('microDisplacementSpace') == 'surface-normal-integrated-voronoi' and abs(qa.get('microTangentialLeakRms', 1)) < 1e-10, initial"
new_space = "assert qa.get('microDisplacementSpace') == 'surface-normal-geodesic-voronoi' and abs(qa.get('microTangentialLeakRms', 1)) < 1e-10, initial"
if old_space not in code:
    raise RuntimeError("P12 QA displacement-space marker missing")
code = code.replace(old_space, new_space, 1)

needle = (
    "assert qa.get('baseVertexCount') == qa.get('vertexCount'), initial\\n"
    "        assert qa.get('maxMicroNormalDisplacement', 1) < .016, initial"
)
replacement = (
    "assert qa.get('baseVertexCount') == qa.get('vertexCount'), initial\\n"
    "        assert qa.get('surfaceTopology') == 'geodesic-octahedron-hemisphere' and qa.get('subdivisionLevel') == 8, initial\\n"
    "        assert qa.get('latLongSingularity') is False and qa.get('apexDuplicateCount') == 1, initial\\n"
    "        assert qa.get('boundaryVertexCount') == 1024, initial\\n"
    "        assert qa.get('triangleAspectMean', 99) < 1.30 and qa.get('triangleAspectMax', 99) < 1.43, initial\\n"
    "        assert qa.get('meshResolution') == 'geodesic-subdivision-8', initial\\n"
    "        assert qa.get('maxMicroNormalDisplacement', 1) < .016, initial"
)
if needle not in code:
    raise RuntimeError("P12 QA geodesic insertion point missing")
code = code.replace(needle, replacement, 1)

result_needle = (
    "'microSignalRange': qa['microSignalRange'], 'microSignalRms': qa['microSignalRms'],"
)
result_replacement = (
    "'microSignalRange': qa['microSignalRange'], 'microSignalRms': qa['microSignalRms'], "
    "'surfaceTopology': qa['surfaceTopology'], 'subdivisionLevel': qa['subdivisionLevel'], "
    "'boundaryVertexCount': qa['boundaryVertexCount'], 'triangleAspectMean': qa['triangleAspectMean'], "
    "'triangleAspectMax': qa['triangleAspectMax'],"
)
if result_needle not in code:
    raise RuntimeError("P12 QA result insertion point missing")
code = code.replace(result_needle, result_replacement, 1)

exec(compile(code, str(SOURCE), "exec"), {"__name__": "__main__", "__file__": str(SOURCE)})

root = Path(sys.argv[1])
path = root / "BUILD_R07_P00.json"
build = json.loads(path.read_text(encoding="utf-8"))
build.setdefault("functionalGates", {}).update(
    {
        "geodesicOctahedronHemisphere": True,
        "latLongSingularityRejected": True,
        "singleApexVertex": True,
        "uniformBoundaryRing": True,
        "triangleAspectGate": True,
        "geodesicSurfaceNormalDisplacement": True,
    }
)
path.write_text(json.dumps(build, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
