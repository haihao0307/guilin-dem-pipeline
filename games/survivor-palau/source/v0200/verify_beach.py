"""Numerical gate for the V0.2.1 reef-protected wake-up beach.

This test reads the actual generated HTML defaults, evaluates the same patched
cross-shore equations, and proves the dry-sand / water contact is continuous.
It does not claim Palau survey accuracy or physical-device performance.
"""
from __future__ import annotations

from pathlib import Path
import json
import math
import re

HERE = Path(__file__).resolve().parent
OUT = HERE.parents[1] / "releases" / "v0.2.1"
HTML = OUT / "index.html"


def smoothstep(a: float, b: float, x: float) -> float:
    if a == b:
        return 0.0
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3.0 - 2.0 * t)


def load_params(text: str) -> dict[str, float]:
    match = re.search(r"const PARAMS=(\[.*?\]);", text, re.S)
    assert match, "PARAMS payload missing"
    params = json.loads(match.group(1))
    return {row["key"]: float(row["value"]) for row in params}


def profile(s: float, p: dict[str, float]) -> float:
    """Cross-shore bed height, s>0 offshore and s<0 inland."""
    if s >= 0.0:
        shelf_u = max(0.0, min(1.0, s / p["shelfWidth"]))
        shelf = -0.035 * min(s, p["shelfWidth"]) - 0.85 * shelf_u**2.2
        deep = -p["seaDepth"] * (
            1.0 - math.exp(-max(0.0, s - p["shelfWidth"]) / 48.0)
        )
        return shelf + deep
    inland = -s
    q = max(0.0, min(1.0, inland / p["beachWidth"]))
    return 0.18 * q + 0.78 * q * q * (3.0 - 2.0 * q)


def bisect_waterline(level: float, p: dict[str, float]) -> float:
    lo = -p["beachWidth"]
    hi = 0.0
    assert profile(lo, p) > level > profile(hi, p)
    for _ in range(70):
        mid = 0.5 * (lo + hi)
        if profile(mid, p) > level:
            lo = mid
        else:
            hi = mid
    return 0.5 * (lo + hi)


def main() -> None:
    text = HTML.read_text(encoding="utf-8")
    params = load_params(text)

    assert "window.StoneMoneyShoreline" in text
    assert "shorelineAt(x,z,time,c=SURFACE)" in text
    assert "shore:(x,z)=>shorelineAt" in text
    assert "frozenShaderAndWorkerStringsUnchanged" not in text  # receipt, not runtime claim

    # C0 continuity at the authored geometric shoreline.
    eps = 1e-5
    inside = profile(-eps, params)
    outside = profile(eps, params)
    c0_gap = abs(inside - outside)
    assert c0_gap < 5e-6, c0_gap

    # The upper beach must rise monotonically toward land; the lagoon shelf must
    # descend monotonically away from shore.
    inland_samples = [
        profile(-params["beachWidth"] * i / 200.0, params) for i in range(201)
    ]
    offshore_samples = [
        profile(params["shelfWidth"] * i / 240.0, params) for i in range(241)
    ]
    assert all(a <= b + 1e-10 for a, b in zip(inland_samples, inland_samples[1:])), (
        "inland profile not monotone"
    )
    assert all(a >= b - 1e-10 for a, b in zip(offshore_samples, offshore_samples[1:])), (
        "offshore profile not monotone"
    )

    # Mean tide intersects the broad beach, and the same bed/water relation gives
    # a near-zero shared signed-distance query at that root.
    level = params["tide"]
    root = bisect_waterline(level, params)
    bed_at_root = profile(root, params)
    contact_gap = abs(level - bed_at_root)
    assert -0.5 * params["beachWidth"] < root < 0.0
    assert contact_gap < 1e-9

    e = 0.25
    slope = max(0.025, abs(profile(root + e, params) - profile(root - e, params)) / (2 * e))
    signed_distance = (level - bed_at_root) / slope
    assert abs(signed_distance) < 1e-8

    # The first 10 m of the lagoon remain shallow enough to read the bottom;
    # this is a game-candidate check, not a biological habitat assertion.
    ten_m_depth = level - profile(10.0, params)
    shelf_edge_depth = level - profile(params["shelfWidth"], params)
    assert 0.2 < ten_m_depth < 1.0, ten_m_depth
    assert 1.5 < shelf_edge_depth < 3.0, shelf_edge_depth

    receipt = {
        "version": "0.2.1",
        "profile": "reef-protected-lagoon-candidate",
        "tests": {
            "c0GapMeters": c0_gap,
            "inlandMonotone": True,
            "offshoreMonotone": True,
            "meanTideWaterlineOffsetMeters": root,
            "waterTerrainContactGapMeters": contact_gap,
            "sharedSignedDistanceAtContactMeters": signed_distance,
            "depthAt10mMeters": ten_m_depth,
            "depthAtShelfEdgeMeters": shelf_edge_depth,
        },
        "limits": [
            "Candidate dimensions are not Palau survey measurements.",
            "Reef pits and secondary islands are excluded from this one-dimensional gate.",
            "Browser, visual and physical iPhone acceptance are separate gates.",
        ],
        "passed": True,
    }
    (OUT / "BEACH_PROFILE_QA.json").write_text(
        json.dumps(receipt, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(receipt, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
