#!/usr/bin/env python3
"""Reproduce the R024 rice lifecycle contract checks."""

from __future__ import annotations

import hashlib
import json
import sys
from collections import Counter
from pathlib import Path


TOOLS = Path(__file__).resolve().parent
ROOT = TOOLS.parent
sys.path.insert(0, str(TOOLS))

from rice_morphology import EXPECTED_TOPOLOGY_MARKER, STAGE_ORDER, load_and_validate


CONTRACT = ROOT / "research/r024-rice-morphology/RICE_LIFECYCLE_CONTRACT.json"


def run():
    contract = json.loads(CONTRACT.read_text())
    validation = load_and_validate(CONTRACT)
    models = contract["stage_models"]
    sources = [
        TOOLS / "rice_morphology.py",
        TOOLS / "probe_rice_morphology_r024.py",
        CONTRACT,
    ]
    return {
        "probe": "farmland-r024-rice-organ-lifecycle-contract",
        "status": "pass",
        "validation": validation,
        "phase_counts": dict(sorted(Counter(
            models[stage]["phase"] for stage in STAGE_ORDER
        ).items())),
        "stage_transitions": [
            {
                "stage": stage,
                "basis": models[stage]["basis"],
                "geometry_family_id": models[stage]["geometry_family_id"],
                "required_topology_event": EXPECTED_TOPOLOGY_MARKER[stage],
                "panicle_state": models[stage]["structure"]["panicle_state"],
                "grain_state": models[stage]["structure"]["grain_state"],
                "cut_state": models[stage]["structure"]["cut_state"],
                "geometry_ready": models[stage]["geometry_ready"],
            }
            for stage in STAGE_ORDER
        ],
        "source_sha256": {
            str(path.relative_to(ROOT)): hashlib.sha256(path.read_bytes()).hexdigest()
            for path in sources
        },
        "speciesStageContractComplete": True,
        "regionalNumericProfileComplete": False,
        "geometryAssetsComplete": False,
        "readyForStructuralTruthWorkbench": False,
        "syntheticGeometryProduced": False,
        "visualAcceptance": False,
        "productionReady": False,
    }


if __name__ == "__main__":
    print(json.dumps(run(), indent=2))
