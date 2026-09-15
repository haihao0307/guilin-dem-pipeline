import copy
import json
import sys
import unittest
from pathlib import Path


TOOLS = Path(__file__).resolve().parent
ROOT = TOOLS.parent
sys.path.insert(0, str(TOOLS))

from cross_mother_intake import (
    load_json,
    validate_tlo_checkpoint,
    validate_xiaoma_dem_intake,
)


RESEARCH = ROOT / "research/r025-xiaoma-tlo-dem-intake"
INTAKE = RESEARCH / "XIAOMA_TLO_DEM_INTAKE.json"
CHECKPOINT = RESEARCH / "FARMLAND_TLO_CHECKPOINT.json"


class CrossMotherIntakeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.intake = json.loads(INTAKE.read_text())
        cls.checkpoint = json.loads(CHECKPOINT.read_text())

    def changed_intake(self):
        return copy.deepcopy(self.intake)

    def changed_checkpoint(self):
        return copy.deepcopy(self.checkpoint)

    def test_locked_intake_and_candidate_checkpoint_pass_with_closed_gates(self):
        intake = load_json(INTAKE)
        intake_result = validate_xiaoma_dem_intake(intake)
        checkpoint_result = validate_tlo_checkpoint(load_json(CHECKPOINT), intake)
        self.assertTrue(intake_result["ok"])
        self.assertEqual(intake_result["xiaoma_locked_file_count"], 6)
        self.assertEqual(intake_result["dem_locked_file_count"], 8)
        self.assertEqual(intake_result["canonical_dem_spacing_m"], (12.5, 12.5))
        self.assertFalse(intake_result["numeric_terrain_connected"])
        self.assertEqual(checkpoint_result["explicit_unknown_count"], 7)
        self.assertFalse(checkpoint_result["parcel_position_known"])

    def test_unread_portal_cannot_be_promoted_to_evidence(self):
        intake = self.changed_intake()
        intake["portal_receipt"]["usable_as_evidence"] = True
        with self.assertRaisesRegex(ValueError, "unread portal"):
            validate_xiaoma_dem_intake(intake)

    def test_xiaoma_commit_lock_cannot_move(self):
        intake = self.changed_intake()
        intake["git_source_locks"]["xiaoma_tlo"]["commit"] = "0" * 40
        with self.assertRaisesRegex(ValueError, "commit lock"):
            validate_xiaoma_dem_intake(intake)

    def test_xiaoma_content_hash_lock_cannot_move(self):
        intake = self.changed_intake()
        intake["git_source_locks"]["xiaoma_tlo"]["files"][0][
            "content_sha256"
        ] = "0" * 64
        with self.assertRaisesRegex(ValueError, "file hash locks"):
            validate_xiaoma_dem_intake(intake)

    def test_landscape_git_blob_lock_cannot_move(self):
        intake = self.changed_intake()
        intake["git_source_locks"]["landscape_dem"]["files"][0][
            "git_blob_sha1"
        ] = "0" * 40
        with self.assertRaisesRegex(ValueError, "file hash locks"):
            validate_xiaoma_dem_intake(intake)

    def test_tlo_discussion_draft_cannot_be_frozen(self):
        intake = self.changed_intake()
        intake["tlo_candidate_adoption"]["source_status"] = "frozen"
        with self.assertRaisesRegex(ValueError, "discussion draft"):
            validate_xiaoma_dem_intake(intake)

    def test_tlo_coordinate_order_cannot_change(self):
        intake = self.changed_intake()
        intake["tlo_candidate_adoption"]["coordinate_order"] = ["x", "y", "z", "t"]
        with self.assertRaisesRegex(ValueError, "coordinate order"):
            validate_xiaoma_dem_intake(intake)

    def test_moving_branch_name_cannot_become_sufficient_evidence(self):
        intake = self.changed_intake()
        intake["tlo_candidate_adoption"][
            "moving_branch_name_is_sufficient_evidence"
        ] = True
        with self.assertRaisesRegex(ValueError, "evidence boundary"):
            validate_xiaoma_dem_intake(intake)

    def test_dem_spacing_cannot_be_misread_as_centimeters(self):
        intake = self.changed_intake()
        intake["guilin_dem_identity"]["source"]["resolution_m"] = [.125, .125]
        with self.assertRaisesRegex(ValueError, "source identity"):
            validate_xiaoma_dem_intake(intake)

    def test_dem_source_hash_cannot_change(self):
        intake = self.changed_intake()
        intake["guilin_dem_identity"]["source"]["sha256"] = "0" * 64
        with self.assertRaisesRegex(ValueError, "source identity"):
            validate_xiaoma_dem_intake(intake)

    def test_aoi_hash_cannot_change(self):
        intake = self.changed_intake()
        intake["guilin_dem_identity"]["aoi"]["geometry_sha256"] = "0" * 64
        with self.assertRaisesRegex(ValueError, "AOI identity"):
            validate_xiaoma_dem_intake(intake)

    def test_tile_identity_cannot_change(self):
        intake = self.changed_intake()
        intake["guilin_dem_identity"]["guilin_anchor_tile"]["id"] = "native-r00-c00"
        with self.assertRaisesRegex(ValueError, "anchor tile"):
            validate_xiaoma_dem_intake(intake)

    def test_hydrology_hash_cannot_change(self):
        intake = self.changed_intake()
        intake["guilin_dem_identity"]["immutable_hydrology"]["sha256"] = "0" * 64
        with self.assertRaisesRegex(ValueError, "hydrology identity"):
            validate_xiaoma_dem_intake(intake)

    def test_macro_dem_cannot_claim_field_component_resolution(self):
        intake = self.changed_intake()
        intake["authority_boundary"]["dem_resolves_field_components"] = True
        with self.assertRaisesRegex(ValueError, "authority overclaim"):
            validate_xiaoma_dem_intake(intake)

    def test_guilin_dem_cannot_be_used_as_honghe_terrain(self):
        intake = self.changed_intake()
        intake["authority_boundary"]["honghe_profile_may_use_guilin_dem"] = True
        with self.assertRaisesRegex(ValueError, "authority overclaim"):
            validate_xiaoma_dem_intake(intake)

    def test_honghe_separation_cannot_be_erased(self):
        intake = self.changed_intake()
        intake["honghe_separation_evidence"]["same_regional_terrain_asset"] = True
        with self.assertRaisesRegex(ValueError, "regional separation"):
            validate_xiaoma_dem_intake(intake)

    def test_synthetic_r6_cannot_be_promoted_to_dem_truth(self):
        intake = self.changed_intake()
        intake["excluded_visual_candidate"]["usable_as_dem_truth"] = True
        with self.assertRaisesRegex(ValueError, "cannot become DEM truth"):
            validate_xiaoma_dem_intake(intake)

    def test_r025_cannot_claim_numeric_terrain_connection(self):
        intake = self.changed_intake()
        intake["production_gate"]["numeric_terrain_connected"] = True
        with self.assertRaisesRegex(ValueError, "production clearance"):
            validate_xiaoma_dem_intake(intake)

    def test_unsampled_world_time_must_remain_null(self):
        checkpoint = self.changed_checkpoint()
        checkpoint["T"]["world_time"] = "2026-09-11T00:00:00Z"
        with self.assertRaisesRegex(ValueError, "must remain null"):
            validate_tlo_checkpoint(checkpoint, self.intake)

    def test_unselected_parcel_position_must_remain_null(self):
        checkpoint = self.changed_checkpoint()
        checkpoint["L"]["position"] = [450000, 2800000, 100]
        with self.assertRaisesRegex(ValueError, "must remain null"):
            validate_tlo_checkpoint(checkpoint, self.intake)

    def test_checkpoint_must_keep_both_region_relations(self):
        checkpoint = self.changed_checkpoint()
        checkpoint["O"]["relations"].pop()
        with self.assertRaisesRegex(ValueError, "relations are incomplete"):
            validate_tlo_checkpoint(checkpoint, self.intake)

    def test_checkpoint_must_keep_all_explicit_unknowns(self):
        checkpoint = self.changed_checkpoint()
        checkpoint["O"]["unknowns"].remove("field_microtopography")
        with self.assertRaisesRegex(ValueError, "unknowns are incomplete"):
            validate_tlo_checkpoint(checkpoint, self.intake)

    def test_checkpoint_cannot_grant_field_geometry_clearance(self):
        checkpoint = self.changed_checkpoint()
        checkpoint["gates"]["field_scale_geometry_ready"] = True
        with self.assertRaisesRegex(ValueError, "gates must remain closed"):
            validate_tlo_checkpoint(checkpoint, self.intake)


if __name__ == "__main__":
    unittest.main()
