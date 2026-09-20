#!/usr/bin/env python3
"""Reproduce the R025 fixed-source TLO and Guilin DEM intake checks."""

from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path


TOOLS = Path(__file__).resolve().parent
ROOT = TOOLS.parent
sys.path.insert(0, str(TOOLS))

from cross_mother_intake import validate_tlo_checkpoint, validate_xiaoma_dem_intake


RESEARCH = ROOT / "research/r025-xiaoma-tlo-dem-intake"
INTAKE = RESEARCH / "XIAOMA_TLO_DEM_INTAKE.json"
CHECKPOINT = RESEARCH / "FARMLAND_TLO_CHECKPOINT.json"


def run():
    intake = json.loads(INTAKE.read_text())
    checkpoint = json.loads(CHECKPOINT.read_text())
    validation = validate_xiaoma_dem_intake(intake)
    checkpoint_validation = validate_tlo_checkpoint(checkpoint, intake)
    sources = [
        TOOLS / "cross_mother_intake.py",
        TOOLS / "probe_cross_mother_intake_r025.py",
        INTAKE,
        CHECKPOINT,
    ]
    return {
        "probe": "farmland-r025-xiaoma-tlo-guilin-dem-intake",
        "status": "pass",
        "validation": validation,
        "checkpoint_validation": checkpoint_validation,
        "source_locks": {
            "xiaoma_tlo_commit": intake["git_source_locks"]["xiaoma_tlo"]["commit"],
            "landscape_dem_commit": intake["git_source_locks"]["landscape_dem"]["commit"],
            "canonical_dem_release_commit": intake["git_source_locks"][
                "landscape_dem"
            ]["canonical_release_commit"],
            "xiaoma_locked_file_count": len(
                intake["git_source_locks"]["xiaoma_tlo"]["files"]
            ),
            "dem_locked_file_count": len(
                intake["git_source_locks"]["landscape_dem"]["files"]
            ),
            "hashes_per_file": 2,
        },
        "terrain_authority": {
            "region": "Guilin only",
            "crs": intake["guilin_dem_identity"]["source"]["crs"],
            "resolution_m": intake["guilin_dem_identity"]["source"]["resolution_m"],
            "tile_count": intake["guilin_dem_identity"]["tiling"]["tile_count"],
            "numeric_tile_bytes_present": intake["authority_boundary"][
                "numeric_tile_bytes_present_in_farmland_branch"
            ],
            "terrain_sample_read": intake["authority_boundary"][
                "terrain_sample_read_in_r025"
            ],
            "field_components_resolved": intake["authority_boundary"][
                "dem_resolves_field_components"
            ],
            "honghe_covered": intake["authority_boundary"][
                "honghe_inside_guilin_aoi"
            ],
        },
        "tlo_status": {
            "source_schema_frozen": False,
            "farmland_core_schema_changed": False,
            "coordinate_order": intake["tlo_candidate_adoption"]["coordinate_order"],
            "explicit_unknown_count": len(checkpoint["O"]["unknowns"]),
            "world_time_known": False,
            "parcel_position_known": False,
        },
        "source_sha256": {
            str(path.relative_to(ROOT)): hashlib.sha256(path.read_bytes()).hexdigest()
            for path in sources
        },
        "sourceReceiptComplete": True,
        "numericTerrainConnected": False,
        "fieldScaleTerrainComplete": False,
        "hongheTerrainComplete": False,
        "readyForRegionalGeometry": False,
        "readyForStructuralTruthWorkbench": False,
        "visualCandidateProduced": False,
        "visualAcceptance": False,
        "productionReady": False,
    }


if __name__ == "__main__":
    print(json.dumps(run(), indent=2))
