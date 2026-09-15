import copy
import json
import sys
import unittest
from pathlib import Path


TOOLS = Path(__file__).resolve().parent
ROOT = TOOLS.parent
sys.path.insert(0, str(TOOLS))

from rice_morphology import STAGE_ORDER, load_and_validate, validate_rice_lifecycle
from validate_farmland_dna import REQUIRED_RICE_STAGE_MODELS


CONTRACT = ROOT / "research/r024-rice-morphology/RICE_LIFECYCLE_CONTRACT.json"


class RiceMorphologyContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.contract = json.loads(CONTRACT.read_text())

    def changed(self):
        return copy.deepcopy(self.contract)

    def test_locked_contract_passes_without_geometry_clearance(self):
        result = load_and_validate(CONTRACT)
        self.assertTrue(result["ok"])
        self.assertEqual(result["stage_count"], 14)
        self.assertEqual(result["documented_fact_count"], 10)
        self.assertEqual(result["independent_geometry_family_count"], 14)
        self.assertEqual(result["independent_topology_signature_count"], 14)
        self.assertEqual(result["unresolved_regional_parameter_count"], 24)
        self.assertFalse(result["regional_geometry_ready"])

    def test_stage_order_cannot_omit_lifting(self):
        contract = self.changed()
        contract["stage_order"].remove("lifting_seedlings")
        with self.assertRaisesRegex(ValueError, "fourteen"):
            validate_rice_lifecycle(contract)

    def test_stage_order_cannot_omit_panicle_initiation(self):
        contract = self.changed()
        contract["stage_order"].remove("panicle_initiation")
        with self.assertRaisesRegex(ValueError, "fourteen"):
            validate_rice_lifecycle(contract)

    def test_stage_model_set_must_match_order(self):
        contract = self.changed()
        del contract["stage_models"]["stubble"]
        with self.assertRaisesRegex(ValueError, "stage model set"):
            validate_rice_lifecycle(contract)

    def test_one_geometry_family_cannot_represent_two_stages(self):
        contract = self.changed()
        contract["stage_models"]["establishment"]["geometry_family_id"] = \
            contract["stage_models"]["transplanted"]["geometry_family_id"]
        with self.assertRaisesRegex(ValueError, "one geometry family"):
            validate_rice_lifecycle(contract)

    def test_topology_signatures_cannot_be_reused(self):
        contract = self.changed()
        duplicate = ["nursery_root_medium_contact", "broken_root_medium_contact"]
        contract["stage_models"]["nursery"]["topology_tokens"] = duplicate
        contract["stage_models"]["lifting_seedlings"]["topology_tokens"] = duplicate
        with self.assertRaisesRegex(ValueError, "topology signatures"):
            validate_rice_lifecycle(contract)

    def test_field_responses_cannot_be_reused(self):
        contract = self.changed()
        contract["stage_models"]["establishment"]["field_response"] = copy.deepcopy(
            contract["stage_models"]["transplanted"]["field_response"]
        )
        with self.assertRaisesRegex(ValueError, "water, and wind response"):
            validate_rice_lifecycle(contract)

    def test_tillering_cannot_show_a_panicle(self):
        contract = self.changed()
        contract["stage_models"]["tillering"]["structure"]["panicle_state"] = "visible"
        with self.assertRaisesRegex(ValueError, "tillering.panicle_state"):
            validate_rice_lifecycle(contract)

    def test_panicle_initiation_must_remain_hidden(self):
        contract = self.changed()
        contract["stage_models"]["panicle_initiation"]["structure"]["panicle_state"] = \
            "fully_emerged"
        with self.assertRaisesRegex(ValueError, "panicle_initiation.panicle_state"):
            validate_rice_lifecycle(contract)

    def test_booting_requires_flag_sheath_enclosure(self):
        contract = self.changed()
        contract["stage_models"]["booting"]["structure"]["flag_leaf_state"] = "open_empty"
        with self.assertRaisesRegex(ValueError, "booting.flag_leaf_state"):
            validate_rice_lifecycle(contract)

    def test_heading_requires_panicle_emergence(self):
        contract = self.changed()
        contract["stage_models"]["heading"]["structure"]["panicle_state"] = \
            "inside_flag_leaf_sheath"
        with self.assertRaisesRegex(ValueError, "heading.panicle_state"):
            validate_rice_lifecycle(contract)

    def test_flowering_requires_opening_florets(self):
        contract = self.changed()
        contract["stage_models"]["flowering"]["structure"]["spikelet_state"] = \
            "closed_florets_only"
        with self.assertRaisesRegex(ValueError, "flowering.spikelet_state"):
            validate_rice_lifecycle(contract)

    def test_grain_filling_requires_milk_to_dough_state(self):
        contract = self.changed()
        contract["stage_models"]["grain_filling"]["structure"]["grain_state"] = "hard_and_dry"
        with self.assertRaisesRegex(ValueError, "grain_filling.grain_state"):
            validate_rice_lifecycle(contract)

    def test_maturity_requires_hard_dry_grain(self):
        contract = self.changed()
        contract["stage_models"]["maturity"]["structure"]["grain_state"] = "milky"
        with self.assertRaisesRegex(ValueError, "maturity.grain_state"):
            validate_rice_lifecycle(contract)

    def test_harvest_must_interrupt_standing_crop_topology(self):
        contract = self.changed()
        contract["stage_models"]["harvest"]["structure"]["cut_state"] = "uncut"
        with self.assertRaisesRegex(ValueError, "harvest.cut_state"):
            validate_rice_lifecycle(contract)

    def test_stubble_cannot_keep_panicles_on_cut_culms(self):
        contract = self.changed()
        contract["stage_models"]["stubble"]["structure"]["panicle_state"] = "intact"
        with self.assertRaisesRegex(ValueError, "stubble.panicle_state"):
            validate_rice_lifecycle(contract)

    def test_unmeasured_regional_number_cannot_be_filled(self):
        contract = self.changed()
        contract["unresolved_regional_parameters"]["seedlings_per_hill"] = 3
        with self.assertRaisesRegex(ValueError, "must remain null"):
            validate_rice_lifecycle(contract)

    def test_stage_model_cannot_hide_an_unmeasured_numeric_override(self):
        contract = self.changed()
        contract["stage_models"]["tillering"]["plant_height_m"] = 0.5
        with self.assertRaisesRegex(ValueError, "incomplete or unsupported"):
            validate_rice_lifecycle(contract)

    def test_every_regional_parameter_requires_measurement_rule(self):
        contract = self.changed()
        del contract["measurement_requirements"]["stubble_height_m"]
        with self.assertRaisesRegex(ValueError, "every regional parameter"):
            validate_rice_lifecycle(contract)

    def test_timed_out_irri_page_cannot_be_cited_as_read_evidence(self):
        contract = self.changed()
        contract["documented_facts"][0]["source_id"] = "IRRI_GROWTH_STAGES"
        with self.assertRaisesRegex(ValueError, "unavailable source"):
            validate_rice_lifecycle(contract)

    def test_unavailable_source_attempts_cannot_be_silently_dropped(self):
        contract = self.changed()
        contract["unavailable_source_targets"].pop()
        with self.assertRaisesRegex(ValueError, "target set is incomplete"):
            validate_rice_lifecycle(contract)

    def test_locked_source_must_have_been_read(self):
        contract = self.changed()
        contract["source_locks"]["AU_OGTR_RICE_BIOLOGY_2005_2021"]["retrieval_status"] = \
            "search_result_only"
        with self.assertRaisesRegex(ValueError, "was not read"):
            validate_rice_lifecycle(contract)

    def test_every_documented_fact_must_constrain_the_contract(self):
        contract = self.changed()
        contract["scope_evidence_refs"].remove("honghe.red_rice_diversity")
        with self.assertRaisesRegex(ValueError, "every documented fact"):
            validate_rice_lifecycle(contract)

    def test_shortcut_bans_cannot_be_relaxed(self):
        contract = self.changed()
        contract["prohibited_shortcuts"].remove("cone_rice_proxy")
        with self.assertRaisesRegex(ValueError, "shortcut bans"):
            validate_rice_lifecycle(contract)

    def test_contract_stage_cannot_claim_geometry(self):
        contract = self.changed()
        contract["stage_models"]["heading"]["geometry_ready"] = True
        with self.assertRaisesRegex(ValueError, "cannot be ready"):
            validate_rice_lifecycle(contract)

    def test_visible_and_hidden_organs_must_be_disjoint(self):
        contract = self.changed()
        contract["stage_models"]["booting"]["visible_organs"].append("developing_panicles")
        with self.assertRaisesRegex(ValueError, "both visible and hidden"):
            validate_rice_lifecycle(contract)

    def test_r024_cannot_grant_public_clearance(self):
        contract = self.changed()
        contract["production_gate"]["ready_for_public_candidate"] = True
        with self.assertRaisesRegex(ValueError, "cannot grant production clearance"):
            validate_rice_lifecycle(contract)

    def test_exported_stage_order_matches_public_candidate_validator(self):
        self.assertEqual(tuple(self.contract["stage_order"]), STAGE_ORDER)
        self.assertEqual(set(STAGE_ORDER), REQUIRED_RICE_STAGE_MODELS)


if __name__ == "__main__":
    unittest.main()
