#!/usr/bin/env python3
"""Reproducible R023 profile and parcel-topology probe."""

from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

TOOLS = Path(__file__).resolve().parent
ROOT = TOOLS.parent
sys.path.insert(0, str(TOOLS))

from parcel_topology import build_parcel_topology
from regional_profile import load_and_validate


PROFILE = ROOT / "research/r023-honghe-regional-contract/HONGHE_PROFILE.json"


def _summary(name, topology):
    fields = topology["fields"]
    boundaries = topology["boundaries"]
    shared = [edge for edge in boundaries if edge["kind"] == "shared"]
    assert sum(len(field["triangles"]) for field in fields) == sum(
        len(field["ring"])-2 for field in fields)
    assert all(len(edge["served_fields"]) == 2 for edge in shared)
    assert len({edge["id"] for edge in boundaries}) == len(boundaries)
    return {
        "name": name,
        "provenance": "generated_topology_fixture_not_regional_measurement",
        "field_count": len(fields),
        "total_area_m2": sum(field["area_m2"] for field in fields),
        "triangle_count": sum(len(field["triangles"]) for field in fields),
        "unique_boundary_count": len(boundaries),
        "shared_boundary_count": len(shared),
        "shared_boundaries": [
            {"id": edge["id"], "served_fields": edge["served_fields"],
             "length_m": edge["length_m"]}
            for edge in shared
        ],
    }


def run():
    profile = load_and_validate(PROFILE)
    flat = build_parcel_topology(
        {
            "f0": (0, 0), "f1": (9, -.6), "f2": (18, .5),
            "f3": (19, 8.2), "f4": (9.5, 8.8), "f5": (-.8, 7.5),
        },
        {
            "flat_west": ["f0", "f1", "f4", "f5"],
            "flat_east": ["f1", "f2", "f3", "f4"],
        },
    )
    terrace = build_parcel_topology(
        {
            "t0": (0, 0), "t1": (7, -.4), "t2": (15, .3), "t3": (23, -.2),
            "t4": (22.2, 4.7), "t5": (14.5, 5.3), "t6": (6.4, 4.5), "t7": (-.6, 5.1),
            "t8": (21.1, 9.5), "t9": (13.7, 10.2), "t10": (5.7, 9.2), "t11": (-1.0, 9.8),
        },
        {
            "terrace_upper_west": ["t0", "t1", "t6", "t7"],
            "terrace_upper_mid": ["t1", "t2", "t5", "t6"],
            "terrace_upper_east": ["t2", "t3", "t4", "t5"],
            "terrace_lower_west": ["t7", "t6", "t10", "t11"],
            "terrace_lower_mid": ["t6", "t5", "t9", "t10"],
            "terrace_lower_east": ["t5", "t4", "t8", "t9"],
        },
    )
    sources = [
        TOOLS / "parcel_topology.py",
        TOOLS / "regional_profile.py",
        TOOLS / "probe_regional_r023.py",
        PROFILE,
    ]
    return {
        "probe": "farmland-r023-regional-and-parcel-topology",
        "status": "pass",
        "regional_profile": profile,
        "fixtures": [_summary("flatland_irregular_pair", flat),
                     _summary("terrace_irregular_six_cells", terrace)],
        "source_sha256": {
            str(path.relative_to(ROOT)): hashlib.sha256(path.read_bytes()).hexdigest()
            for path in sources
        },
        "regional_dimensions_measured": False,
        "terrain_elevations_attached": False,
        "bund_and_riser_sections_attached": False,
        "syntheticFixtureOnly": True,
        "visualAcceptance": False,
        "productionReady": False,
    }


if __name__ == "__main__":
    print(json.dumps(run(), indent=2))
