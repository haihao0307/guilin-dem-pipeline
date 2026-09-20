import copy
import json
import sys
import unittest
from pathlib import Path

TOOLS = Path(__file__).resolve().parent
ROOT = TOOLS.parent
sys.path.insert(0, str(TOOLS))

from parcel_topology import build_parcel_topology
from regional_profile import load_and_validate, validate_honghe_profile


PROFILE = ROOT / "research/r023-honghe-regional-contract/HONGHE_PROFILE.json"


class ParcelTopologyTests(unittest.TestCase):
    def setUp(self):
        self.vertices = {
            "a": (0, 0), "b": (10, 0), "c": (20, 0),
            "d": (0, 10), "e": (10, 10), "f": (20, 10),
        }
        self.rings = {"west": ["a", "b", "e", "d"],
                      "east": ["f", "e", "b", "c"]}

    def test_shared_coordinate_edge_built_once_and_triangulated(self):
        result = build_parcel_topology(self.vertices, self.rings)
        shared = [edge for edge in result["boundaries"] if edge["kind"] == "shared"]
        self.assertEqual(len(shared), 1)
        self.assertEqual(shared[0]["vertices"], ("b", "e"))
        self.assertEqual(shared[0]["served_fields"], ("east", "west"))
        self.assertEqual(sum(field["area_m2"] for field in result["fields"]), 200)
        self.assertEqual(sum(len(field["triangles"]) for field in result["fields"]), 4)

    def test_result_is_deterministic_and_inputs_are_immutable(self):
        vertices, rings = copy.deepcopy(self.vertices), copy.deepcopy(self.rings)
        first = build_parcel_topology(vertices, rings)
        second = build_parcel_topology(dict(reversed(list(vertices.items()))),
                                       dict(reversed(list(rings.items()))))
        self.assertEqual(first, second)
        self.assertEqual(vertices, self.vertices)
        self.assertEqual(rings, self.rings)

    def test_duplicate_coordinate_identity_is_rejected(self):
        vertices = dict(self.vertices, alias_b=(10, 0))
        with self.assertRaisesRegex(ValueError, "multiple vertex identities"):
            build_parcel_topology(vertices, self.rings)

    def test_unused_vertex_is_rejected(self):
        vertices = dict(self.vertices, orphan=(30, 30))
        with self.assertRaisesRegex(ValueError, "unused topology vertices"):
            build_parcel_topology(vertices, self.rings)

    def test_t_junction_is_rejected(self):
        vertices = dict(self.vertices, middle=(10, 5))
        rings = dict(self.rings, third=["middle", "e", "f"])
        with self.assertRaisesRegex(ValueError, "T-junction"):
            build_parcel_topology(vertices, rings)

    def test_self_intersection_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "self-intersects"):
            build_parcel_topology(self.vertices, {"bad": ["a", "e", "b", "d"]})

    def test_overlapping_field_interiors_are_rejected(self):
        vertices = dict(self.vertices, g=(5, 2), h=(15, 2), i=(15, 8), j=(5, 8))
        rings = dict(self.rings, overlap=["g", "h", "i", "j"])
        with self.assertRaisesRegex(ValueError, "overlap"):
            build_parcel_topology(vertices, rings)

    def test_nonmanifold_edge_is_rejected(self):
        rings = dict(self.rings, duplicate=["a", "b", "e", "d"])
        with self.assertRaisesRegex(ValueError, "overlap|non-manifold"):
            build_parcel_topology(self.vertices, rings)

    def test_concave_field_triangulation_conserves_area(self):
        vertices = {"a": (0, 0), "b": (4, 0), "c": (4, 4),
                    "d": (2, 2), "e": (0, 4)}
        result = build_parcel_topology(vertices, {"concave": ["a", "b", "c", "d", "e"]})
        field = result["fields"][0]
        self.assertEqual(field["area_m2"], 12)
        self.assertEqual(len(field["triangles"]), 3)


class RegionalProfileTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.profile = json.loads(PROFILE.read_text())

    def test_locked_profile_passes_without_geometry_clearance(self):
        result = load_and_validate(PROFILE)
        self.assertTrue(result["ok"])
        self.assertEqual(result["documented_fact_count"], 20)
        self.assertFalse(result["regional_geometry_ready"])

    def test_stick_count_cannot_be_promoted_to_flow_ratio(self):
        profile = copy.deepcopy(self.profile)
        profile["divider_interpretation"]["stick_count_equals_flow_ratio"] = .3
        with self.assertRaisesRegex(ValueError, "stick count"):
            validate_honghe_profile(profile)

    def test_hydraulic_mechanism_remains_unknown(self):
        profile = copy.deepcopy(self.profile)
        profile["divider_interpretation"]["instantaneous_hydraulic_ratio_mechanism"] = "post_count"
        with self.assertRaisesRegex(ValueError, "hydraulic divider"):
            validate_honghe_profile(profile)

    def test_stone_wall_cannot_become_regional_default(self):
        profile = copy.deepcopy(self.profile)
        profile["terrace_interpretation"]["default_stone_wall"] = True
        with self.assertRaisesRegex(ValueError, "stone"):
            validate_honghe_profile(profile)

    def test_unmeasured_dimension_cannot_be_filled(self):
        profile = copy.deepcopy(self.profile)
        profile["unresolved_dimensions"]["field_bund_crest_width_m"] = .5
        with self.assertRaisesRegex(ValueError, "dimensions"):
            validate_honghe_profile(profile)

    def test_subregions_cannot_be_flattened_to_one_gradient(self):
        profile = copy.deepcopy(self.profile)
        profile["subregion_gradient_classes"]["Laohuzui"] = "gentle"
        with self.assertRaisesRegex(ValueError, "gradient"):
            validate_honghe_profile(profile)

    def test_evidence_stage_cannot_grant_public_clearance(self):
        profile = copy.deepcopy(self.profile)
        profile["production_gate"]["ready_for_regional_geometry"] = True
        with self.assertRaisesRegex(ValueError, "clearance"):
            validate_honghe_profile(profile)


if __name__ == "__main__":
    unittest.main()
