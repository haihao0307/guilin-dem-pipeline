"""Strict evidence boundary for the Honghe Hani regional profile."""

from __future__ import annotations

import json
import sys
from pathlib import Path


REQUIRED_UNKNOWN_DIMENSIONS = {
    "field_bund_crest_width_m",
    "field_bund_height_m",
    "terrace_riser_height_m",
    "terrace_riser_slope",
    "trunk_channel_cross_section_m",
    "branch_ditch_cross_section_m",
    "inlet_opening_m",
    "outlet_opening_m",
}


def validate_honghe_profile(profile):
    if not isinstance(profile, dict):
        raise ValueError("regional profile must be an object")
    if profile.get("profile_id") != "honghe_hani_rice_terraces_r023":
        raise ValueError("unexpected regional profile identity")
    sources = profile.get("source_locks")
    if not isinstance(sources, dict) or not sources:
        raise ValueError("source locks required")
    for source_id, source in sources.items():
        if (not isinstance(source, dict) or source.get("retrieval_status") != "read" or
            not str(source.get("url", "")).startswith("https://whc.unesco.org/")):
            raise ValueError(f"invalid source lock: {source_id}")

    evidence = profile.get("documented_evidence")
    if not isinstance(evidence, dict):
        raise ValueError("documented evidence required")
    required_blocks = {"system", "water_distribution", "terraces", "rice", "subregions"}
    if required_blocks-set(evidence):
        raise ValueError("regional evidence block incomplete")
    referenced_sources = set()
    for block, facts in evidence.items():
        if not isinstance(facts, list) or not facts:
            raise ValueError(f"evidence block empty: {block}")
        for fact in facts:
            if not isinstance(fact, dict) or not fact.get("claim"):
                raise ValueError(f"malformed fact in {block}")
            if fact.get("source_id") not in sources:
                raise ValueError(f"unlocked evidence in {block}")
            referenced_sources.add(fact["source_id"])
            if fact.get("kind") != "documented":
                raise ValueError(f"regional fact must remain documented: {block}")
    if referenced_sources != set(sources):
        raise ValueError("every source lock must support at least one registered fact")

    divider = profile.get("divider_interpretation", {})
    if divider.get("documented_role") != "allocation_need_marker":
        raise ValueError("wood-cuts must remain allocation markers")
    if divider.get("scarce_water_operation") != "rotation":
        raise ValueError("scarce-water rotation missing")
    if divider.get("instantaneous_hydraulic_ratio_mechanism") != "unknown":
        raise ValueError("source does not establish a hydraulic divider mechanism")
    if divider.get("stick_count_equals_flow_ratio") is not None:
        raise ValueError("stick count to flow ratio is unsupported")

    terraces = profile.get("terrace_interpretation", {})
    if terraces.get("documented_material") != "black_clay":
        raise ValueError("documented terrace material must be preserved")
    if terraces.get("documented_retaining_wall") is not False:
        raise ValueError("ICOMOS documents cut clay faces without retaining walls")
    if terraces.get("default_stone_wall") is not False:
        raise ValueError("stone retaining walls cannot be a Honghe default")

    gradients = profile.get("subregion_gradient_classes", {})
    if gradients != {"Bada": "gentle", "Duoyishu": "steeper", "Laohuzui": "very_steep"}:
        raise ValueError("three documented subregion gradient classes must remain distinct")

    unknown = profile.get("unresolved_dimensions")
    if not isinstance(unknown, dict) or set(unknown) != REQUIRED_UNKNOWN_DIMENSIONS:
        raise ValueError("regional dimension unknown set is incomplete")
    if any(value is not None for value in unknown.values()):
        raise ValueError("unmeasured regional dimensions must remain null")

    gate = profile.get("production_gate", {})
    if (gate.get("ready_for_regional_geometry") is not False or
        gate.get("ready_for_public_candidate") is not False or
        gate.get("visualAcceptance") is not False or
        gate.get("productionReady") is not False):
        raise ValueError("R023 evidence cannot grant geometry or production clearance")
    return {
        "ok": True,
        "profile_id": profile["profile_id"],
        "locked_sources": tuple(sorted(sources)),
        "documented_fact_count": sum(len(facts) for facts in evidence.values()),
        "unknown_dimension_count": len(unknown),
        "regional_geometry_ready": False,
    }


def load_and_validate(path):
    return validate_honghe_profile(json.loads(Path(path).read_text()))


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("usage: regional_profile.py HONGHE_PROFILE.json")
    print(json.dumps(load_and_validate(sys.argv[1]), indent=2))
