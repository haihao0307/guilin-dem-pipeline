"""Counterexamples and independent arithmetic oracles; synthetic, no visual QA."""
import copy
import json
from pathlib import Path
import unittest

from validate_farmland_dna import validate, validate_water_budget, validate_public_paddy
from water_ledger import SnapshotKey, Transfer, advance

ROOT = Path(__file__).resolve().parents[1]


def record():
    return json.loads((ROOT / "examples/traditional-paddy-v002-research.json").read_text())


def water(**changes):
    # 100 m2, 5 cm -> 5 m3. Initial 4 + supply 2 + rain .5
    # - drainage 1 - evaporation .2 - seepage .3 = 5.
    w = dict(storage_model="level_planar_field", start_time_s=0, end_time_s=60,
             initial_storage_volume_m3=4, bed_elevation_m=9.8,
             mud_surface_elevation_m=10, water_surface_elevation_m=10.05,
             average_depth_m=.05, storage_area_m2=100, storage_volume_m3=5,
             bund_crest_minimum_m=10.3, inflow_m3=2, rainfall_m3=.5,
             outflow_m3=1, overflow_m3=0, evaporation_m3=.2, seepage_m3=.3,
             storage_change_m3=1, mass_balance_error_m3=0)
    w.update(changes)
    return w


class GraphTests(unittest.TestCase):
    def test_unknown_research_remains_usable_and_unapproved(self):
        r = validate(record())
        self.assertTrue(r["ok"])
        self.assertFalse(r["productionReady"])
        self.assertFalse(r["visualAcceptance"])

    def test_social_edge_cannot_carry_water(self):
        for kind in ("adjacent_to", "maintained_by", "allocated_to", "invented"):
            with self.subTest(kind=kind):
                d = record()
                d["hydraulics"]["graph"][0]["kind"] = kind
                with self.assertRaisesRegex(ValueError, "hydraulic transfer"):
                    validate(d)

    def test_duplicate_edges_rejected(self):
        d = record()
        d["hydraulics"]["graph"].append(copy.deepcopy(d["hydraulics"]["graph"][0]))
        with self.assertRaisesRegex(ValueError, "duplicate hydraulic"):
            validate(d)

    def test_source_and_sink_collision(self):
        d = record()
        d["hydraulics"]["downstream_receiver"]["id"] = d["hydraulics"]["water_source"]["id"]
        with self.assertRaisesRegex(ValueError, "distinct ids"):
            validate(d)

    def test_shortcut_does_not_excuse_orphan(self):
        d = record()
        edges = d["hydraulics"]["graph"]
        edges[0]["to"] = edges[1]["to"]
        del edges[1]
        with self.assertRaisesRegex(ValueError, "component lacks"):
            validate(d)

    def test_disconnected_field_rejected(self):
        d = record()
        d["hydraulics"]["graph"].pop()
        with self.assertRaisesRegex(ValueError, "receiver path"):
            validate(d)

    def test_public_flag_cannot_bypass_checks(self):
        d = record()
        d["representation"]["mode"] = "public_candidate"
        with self.assertRaisesRegex(ValueError, "both directions"):
            validate(d)

    def test_rejected_v001_stays_rejected(self):
        d = json.loads((ROOT / "examples/traditional-paddy-v001.json").read_text())
        with self.assertRaises(ValueError):
            validate(d)


class BudgetTests(unittest.TestCase):
    def test_hand_calculated_budget(self):
        r = validate_water_budget(water())
        self.assertAlmostEqual(r["storage_change_m3"], 1)
        self.assertAlmostEqual(r["recomputed_error_m3"], 0)

    def test_forged_zero_residual_rejected(self):
        with self.assertRaisesRegex(ValueError, "mass balance"):
            validate_water_budget(water(inflow_m3=200))

    def test_forged_storage_delta_rejected(self):
        with self.assertRaisesRegex(ValueError, "storage_change"):
            validate_water_budget(water(initial_storage_volume_m3=3))

    def test_wrong_depth_and_volume_rejected(self):
        for change in ({"average_depth_m": .051}, {"storage_volume_m3": 6}):
            with self.subTest(change=change), self.assertRaises(ValueError):
                validate_water_budget(water(**change))

    def test_invalid_inputs_and_unsupported_model(self):
        for value in ("unknown", None, True, float("nan"), float("inf"), -1):
            with self.subTest(value=value), self.assertRaises(ValueError):
                validate_water_budget(water(inflow_m3=value))
        for change in ({"end_time_s": 0}, {"storage_area_m2": 0},
                       {"storage_model": "nonplanar"}, {"water_surface_elevation_m": 10.4}):
            with self.subTest(change=change), self.assertRaises(ValueError):
                validate_water_budget(water(**change))

    def test_dry_zero_input_is_valid(self):
        w = water(initial_storage_volume_m3=0, storage_volume_m3=0,
                  average_depth_m=0, water_surface_elevation_m=10,
                  inflow_m3=0, rainfall_m3=0, outflow_m3=0,
                  evaporation_m3=0, seepage_m3=0, storage_change_m3=0)
        self.assertEqual(validate_water_budget(w)["recomputed_error_m3"], 0)

    def test_public_route_calls_recomputation(self):
        d = record()
        d["identity"].update(review_status="checked")
        d["representation"].update(mode="public_candidate", public_candidate=True,
                                   debug_only=False, microscope_allowed=True)
        d["hydraulics"].update(closed_graph_check=True, elevation_check=True,
                                mass_balance_check=True, water_state=water(inflow_m3=200))
        with self.assertRaisesRegex(ValueError, "mass balance"):
            validate(d)

    def test_multifield_cannot_hide_behind_one_budget(self):
        d = record()
        d["identity"].update(review_status="checked")
        d["representation"].update(mode="public_candidate", public_candidate=True,
                                   debug_only=False, microscope_allowed=True)
        d["hydraulics"].update(closed_graph_check=True, elevation_check=True,
                                mass_balance_check=True, water_state=water())
        d["parcel"]["cells"].append({"id": "second-field"})
        with self.assertRaisesRegex(ValueError, "multiple fields"):
            validate_public_paddy(d, {"cell_count": 2}, [])


class LedgerTests(unittest.TestCase):
    def args(self):
        key = SnapshotKey("synthetic-farmland", "local-metre-frame", "r021", 0)
        return dict(snapshot=key, expected_snapshot=key, end_time_s=60,
                    storage_m3={"upper": 5., "lower": 2.},
                    source_budgets_m3={"spring": 3., "rain": 1.},
                    receivers=["river", "atmosphere", "subsoil"],
                    allowed_edges=[("spring", "upper"), ("rain", "upper"),
                                   ("upper", "lower"), ("lower", "river"),
                                   ("upper", "atmosphere"), ("upper", "subsoil")],
                    transfers=[])

    def test_two_fields_double_entry_and_order_independence(self):
        a = self.args()
        a["transfers"] = [Transfer("s", "spring", "upper", 3),
                          Transfer("r", "rain", "upper", 1),
                          Transfer("u", "upper", "lower", 2),
                          Transfer("d", "lower", "river", 1),
                          Transfer("e", "upper", "atmosphere", .25),
                          Transfer("p", "upper", "subsoil", .75)]
        original = copy.deepcopy(a)
        result = advance(**a)
        self.assertEqual(result["storage_m3"], {"lower": 3, "upper": 6})
        self.assertEqual(result["external_in_m3"], 4)
        self.assertEqual(result["external_out_m3"], 2)
        self.assertEqual(result["mass_balance_error_m3"], 0)
        self.assertEqual(a, original)
        a["transfers"].reverse()
        self.assertEqual(advance(**a), result)

    def test_zero_input_and_replay(self):
        a = self.args()
        result = advance(**a)
        self.assertEqual(result["storage_m3"], a["storage_m3"])
        self.assertEqual(advance(**a), result)

    def test_finite_supply_not_created_by_request(self):
        a = self.args()
        a["transfers"] = [Transfer("too-much", "spring", "upper", 4)]
        with self.assertRaisesRegex(ValueError, "accepted supply"):
            advance(**a)

    def test_no_same_step_forwarding_or_negative_storage(self):
        a = self.args()
        a["transfers"] = [Transfer("u", "upper", "lower", 5), Transfer("d", "lower", "river", 7)]
        with self.assertRaisesRegex(ValueError, "committed storage"):
            advance(**a)

    def test_duplicate_transaction_and_invalid_path_rejected(self):
        for transfers in ([Transfer("x", "upper", "lower", 1)] * 2,
                          [Transfer("x", "upper", "river", 1)]):
            a = self.args()
            a["transfers"] = transfers
            with self.assertRaises(ValueError):
                advance(**a)

    def test_failure_is_atomic_and_unknown_not_zero(self):
        a = self.args()
        a["source_budgets_m3"]["spring"] = None
        before = copy.deepcopy(a)
        with self.assertRaisesRegex(ValueError, "unknown is not zero"):
            advance(**a)
        self.assertEqual(a, before)

    def test_stale_world_frame_time_revision_rejected(self):
        for key in (SnapshotKey("other", "local-metre-frame", "r021", 0),
                    SnapshotKey("synthetic-farmland", "other", "r021", 0),
                    SnapshotKey("synthetic-farmland", "local-metre-frame", "old", 0),
                    SnapshotKey("synthetic-farmland", "local-metre-frame", "r021", 1)):
            a = self.args()
            a["expected_snapshot"] = key
            with self.subTest(key=key), self.assertRaisesRegex(ValueError, "snapshot"):
                advance(**a)

    def test_blocked_edge_does_not_teleport_water(self):
        a = self.args()
        a["allowed_edges"].remove(("upper", "lower"))
        a["transfers"] = [Transfer("blocked", "upper", "lower", 1)]
        with self.assertRaisesRegex(ValueError, "declared path"):
            advance(**a)


if __name__ == "__main__":
    unittest.main()
