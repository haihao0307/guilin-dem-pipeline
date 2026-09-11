import copy
import json
import sys
import unittest
from pathlib import Path


TOOLS = Path(__file__).resolve().parent
ROOT = TOOLS.parent
sys.path.insert(0, str(TOOLS))

from verify_bridge_package_r025 import (  # noqa: E402
    validate_bridge_contract,
    validate_package_scope,
)


BRIDGE = ROOT / "bridges/r025-xiaoma-tlo-dem/BRIDGE_CONTRACT.json"
SCOPE = ROOT / "bridges/r025-xiaoma-tlo-dem/PACKAGE_SCOPE.json"


class BridgePackageR025Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.bridge = json.loads(BRIDGE.read_text(encoding="utf-8"))
        cls.scope = json.loads(SCOPE.read_text(encoding="utf-8"))

    def changed_bridge(self):
        return copy.deepcopy(self.bridge)

    def changed_scope(self):
        return copy.deepcopy(self.scope)

    def test_fixed_bridge_contract_and_scope_pass(self):
        bridge_result = validate_bridge_contract(self.bridge)
        scope_result = validate_package_scope(self.scope)
        self.assertTrue(bridge_result["ok"])
        self.assertEqual(bridge_result["explicit_unknown_count"], 7)
        self.assertFalse(bridge_result["numeric_terrain_connected"])
        self.assertTrue(scope_result["ok"])
        self.assertEqual(scope_result["excluded_prefix_count"], 2)

    def test_published_r025_commit_cannot_drift(self):
        bridge = self.changed_bridge()
        bridge["r025_baseline"]["commit"] = "0" * 40
        with self.assertRaisesRegex(ValueError, "R025 baseline"):
            validate_bridge_contract(bridge)

    def test_published_r025_tree_cannot_drift(self):
        bridge = self.changed_bridge()
        bridge["r025_baseline"]["tree"] = "0" * 40
        with self.assertRaisesRegex(ValueError, "R025 baseline"):
            validate_bridge_contract(bridge)

    def test_tlo_candidate_cannot_be_frozen(self):
        bridge = self.changed_bridge()
        bridge["tlo"]["status"] = "frozen"
        with self.assertRaisesRegex(ValueError, "not frozen"):
            validate_bridge_contract(bridge)

    def test_tlo_coordinate_order_cannot_change(self):
        bridge = self.changed_bridge()
        bridge["tlo"]["coordinate_order"] = ["x", "y", "z", "t"]
        with self.assertRaisesRegex(ValueError, "coordinate order"):
            validate_bridge_contract(bridge)

    def test_numeric_terrain_cannot_be_claimed_connected(self):
        bridge = self.changed_bridge()
        bridge["gates"]["numeric_terrain_connected"] = True
        with self.assertRaisesRegex(ValueError, "gates changed"):
            validate_bridge_contract(bridge)

    def test_guilin_dem_cannot_claim_honghe_coverage(self):
        bridge = self.changed_bridge()
        bridge["terrain_authority"]["honghe_covered"] = True
        with self.assertRaisesRegex(ValueError, "terrain authority"):
            validate_bridge_contract(bridge)

    def test_explicit_unknown_cannot_be_removed(self):
        bridge = self.changed_bridge()
        bridge["explicit_unknowns"].remove("field_microtopography")
        with self.assertRaisesRegex(ValueError, "seven bridge unknowns"):
            validate_bridge_contract(bridge)

    def test_public_or_production_gate_cannot_open(self):
        for gate in ("ready_for_public_candidate", "visualAcceptance", "productionReady"):
            with self.subTest(gate=gate):
                bridge = self.changed_bridge()
                bridge["gates"][gate] = True
                with self.assertRaisesRegex(ValueError, "gates changed"):
                    validate_bridge_contract(bridge)

    def test_distribution_exclusion_cannot_be_removed(self):
        scope = self.changed_scope()
        scope["exclude_prefixes"].remove("farmland-object-dna/distributions/")
        with self.assertRaisesRegex(ValueError, "exclusions"):
            validate_package_scope(scope)

    def test_protected_portal_content_must_remain_prohibited(self):
        scope = self.changed_scope()
        scope["prohibited_payloads"].remove("protected portal content")
        with self.assertRaisesRegex(ValueError, "prohibited payload"):
            validate_package_scope(scope)


if __name__ == "__main__":
    unittest.main()
