"""Static/numerical gate for V0.2.2 physical shoreline corrections."""
from __future__ import annotations

from pathlib import Path
import json
import math

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "releases" / "v0.2.2"
html = (OUT / "index.html").read_text(encoding="utf-8")
receipt = json.loads((OUT / "BUILD_RECEIPT.json").read_text(encoding="utf-8"))

old_area = math.pi * (27.0**2 - (27.0 - 11.0) ** 2)
new_area = math.pi * (92.0**2 - (92.0 - 50.0) ** 2)
ratio = new_area / old_area

# Cross-shore candidate used by the runtime defaults.  This check is about the
# relationship and continuity, not a surveyed Palau profile.
def profile(signed_from_shore: float) -> float:
    # Positive is offshore, negative is inland.
    if signed_from_shore >= 0.0:
        s = signed_from_shore
        shelf_u = min(1.0, max(0.0, s / 84.0))
        shelf = -0.010 * min(s, 84.0) - 0.32 * shelf_u**2.35
        deep = -11.5 * (1.0 - math.exp(-max(0.0, s - 84.0) / 48.0))
        return shelf + deep
    inland = -signed_from_shore
    q = min(1.0, max(0.0, inland / 50.0))
    beach = 2.15 * q * q * (3.0 - 2.0 * q)
    return beach

join_error = abs(profile(-1e-5) - profile(1e-5))
upper_samples = [profile(-x) for x in range(0, 51)]
monotone_upper = all(b >= a - 1e-12 for a, b in zip(upper_samples, upper_samples[1:]))
offshore_samples = [profile(x) for x in range(0, 85)]
monotone_offshore = all(b <= a + 1e-12 for a, b in zip(offshore_samples, offshore_samples[1:]))

required_fragments = [
    "physicalWater=1.-smoothstep",
    "coverage*=smiCoastWeight*physicalWater",
    "const slabs=[];",
    "fishWaterViolations=0",
    "!s.fish[f.id]&&f.submerged",
    "physicalWaterAt:",
    "if(!query.has(\"reference\")){drawWater(sun)}",
]
missing = [fragment for fragment in required_fragments if fragment not in html]

report = {
    "version": "0.2.2",
    "passed": False,
    "nominalBeachAreaRatioVsOriginal": ratio,
    "shoreJoinErrorMeters": join_error,
    "upperBeachMonotone": monotone_upper,
    "offshoreShelfMonotone": monotone_offshore,
    "upperBeachRiseMeters": upper_samples[-1] - upper_samples[0],
    "shelfDepthAt84m": -offshore_samples[-1],
    "missingRuntimeRelations": missing,
    "frozenOceanUnchanged": receipt["frozenShaderAndWorkerStringsUnchanged"],
    "constructedStoneHouseRemoved": receipt["constructedStoneHouseRemoved"],
    "curlSheetDrawn": receipt["curlSheetDrawn"],
}
report["passed"] = bool(
    ratio >= 10.0
    and join_error < 1e-4
    and monotone_upper
    and monotone_offshore
    and not missing
    and receipt["frozenShaderAndWorkerStringsUnchanged"]
    and receipt["constructedStoneHouseRemoved"]
    and receipt["curlSheetDrawn"] is False
)
(OUT / "PHYSICAL_RELATION_QA.json").write_text(
    json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
)
print(json.dumps(report, ensure_ascii=False, indent=2))
if not report["passed"]:
    raise SystemExit(1)
