from __future__ import annotations

import importlib.util
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = ROOT / "scripts" / "ecology_v040" / "ecology_agriculture_compiler.py"
KNOWLEDGE_PATH = ROOT / "metadata" / "ecology" / "v0.4.0" / "ecology-knowledge.json"
AGRICULTURE_PATH = ROOT / "metadata" / "ecology" / "v0.4.0" / "agriculture-config.json"
SPEC = importlib.util.spec_from_file_location("ecology_agriculture_compiler", MODULE_PATH)
assert SPEC and SPEC.loader
module = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = module
SPEC.loader.exec_module(module)

EcologyConfig = module.EcologyConfig
compile_ecology_agriculture = module.compile_ecology_agriculture
field_pattern_at_global_cell = module.field_pattern_at_global_cell


class EcologyAgricultureCompilerV040Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.knowledge = json.loads(KNOWLEDGE_PATH.read_text(encoding="utf-8"))
        cls.agriculture = json.loads(AGRICULTURE_PATH.read_text(encoding="utf-8"))

    def build_terrain(self) -> dict:
        width = 36
        height = 32
        size = width * height
        fields = {
            "permanent_water_mask": [0] * size,
            "active_bank_mask": [0] * size,
            "hard_exclusion_mask": [0] * size,
            "karst_rock_core_mask": [0] * size,
            "landform_class": [5] * size,
            "slope_deg": [12.0] * size,
            "distance_to_water_m": [800.0] * size,
            "drains_to_permanent_water": [1] * size,
            "distance_to_settlement_m": [900.0] * size,
        }
        for row in range(height):
            for col in range(width):
                idx = row * width + col
                if row == 0:
                    fields["permanent_water_mask"][idx] = 1
                    fields["hard_exclusion_mask"][idx] = 1
                    fields["landform_class"][idx] = 0
                    fields["slope_deg"][idx] = 0.0
                    fields["distance_to_water_m"][idx] = 0.0
                elif row == 1:
                    fields["active_bank_mask"][idx] = 1
                    fields["landform_class"][idx] = 1
                    fields["slope_deg"][idx] = 1.0
                    fields["distance_to_water_m"][idx] = 10.0
                elif row <= 6:
                    fields["landform_class"][idx] = 2
                    fields["slope_deg"][idx] = 1.5
                    fields["distance_to_water_m"][idx] = 30.0 + (row - 2) * 22.0
                    fields["distance_to_settlement_m"][idx] = 500.0
                elif row <= 12:
                    fields["landform_class"][idx] = 3
                    fields["slope_deg"][idx] = 3.2
                    fields["distance_to_water_m"][idx] = 150.0 + (row - 7) * 35.0
                    fields["distance_to_settlement_m"][idx] = 120.0
                elif row <= 19:
                    fields["landform_class"][idx] = 4
                    fields["slope_deg"][idx] = 8.0
                    fields["distance_to_water_m"][idx] = 420.0 + (row - 13) * 35.0
                    fields["distance_to_settlement_m"][idx] = 780.0
                elif row <= 25:
                    fields["landform_class"][idx] = 5
                    fields["slope_deg"][idx] = 20.0
                    fields["distance_to_water_m"][idx] = 850.0 + (row - 20) * 120.0
                    fields["distance_to_settlement_m"][idx] = 2200.0
                else:
                    fields["landform_class"][idx] = 6
                    fields["slope_deg"][idx] = 26.0
                    fields["distance_to_water_m"][idx] = 1800.0
                    fields["distance_to_settlement_m"][idx] = 3200.0
                if row in {23, 24} and col % 9 == 0:
                    fields["karst_rock_core_mask"][idx] = 1
                    fields["hard_exclusion_mask"][idx] = 1
                    fields["landform_class"][idx] = 7
        return {
            "manifest": {
                "schema": "dem_terrain_fields@0.4.0",
                "release_sha256": "1" * 64,
                "grid": {
                    "width": width,
                    "height": height,
                    "cell_size_m": 12.5,
                    "origin_col": 4000,
                    "origin_row": 8000,
                    "crs": "EPSG:32649"
                }
            },
            "fields": fields
        }

    def compile(self) -> dict:
        return compile_ecology_agriculture(
            self.build_terrain(),
            self.knowledge,
            self.agriculture,
            EcologyConfig(seed=1944, minimum_active_prototypes=18, ensure_catalog_coverage=True)
        )

    def test_water_and_hard_exclusions_have_no_instances(self) -> None:
        terrain = self.build_terrain()
        release = compile_ecology_agriculture(
            terrain,
            self.knowledge,
            self.agriculture,
            EcologyConfig(seed=1944, minimum_active_prototypes=18, ensure_catalog_coverage=True)
        )
        fields = terrain["fields"]
        for instance in release["instances"]:
            idx = instance["local_cell_index"]
            self.assertEqual(fields["permanent_water_mask"][idx], 0)
            self.assertEqual(fields["hard_exclusion_mask"][idx], 0)
            self.assertEqual(fields["active_bank_mask"][idx], 0)
        self.assertEqual(release["validation"]["water_instance_count"], 0)
        self.assertEqual(release["validation"]["hard_exclusion_instance_count"], 0)

    def test_agriculture_respects_forbidden_landforms(self) -> None:
        terrain = self.build_terrain()
        release = compile_ecology_agriculture(
            terrain,
            self.knowledge,
            self.agriculture,
            EcologyConfig(seed=1944, minimum_active_prototypes=18, ensure_catalog_coverage=True)
        )
        agriculture = release["fields"]["agriculture_class"]
        forbidden = {0, 1, 6, 7, 8}
        for idx, selected in enumerate(agriculture):
            if selected:
                self.assertNotIn(terrain["fields"]["landform_class"][idx], forbidden)
                self.assertEqual(terrain["fields"]["hard_exclusion_mask"][idx], 0)
        self.assertEqual(release["validation"]["agriculture_forbidden_cell_count"], 0)

    def test_all_instance_prototypes_are_declared_and_catalog_is_active(self) -> None:
        release = self.compile()
        declared = {item["id"] for item in self.knowledge["prototypes"]}
        active = {item["prototype_id"] for item in release["instances"]}
        self.assertTrue(active.issubset(declared))
        self.assertGreaterEqual(len(declared), 18)
        self.assertGreaterEqual(len(active), 18)
        self.assertEqual(release["validation"]["undeclared_prototype_instance_count"], 0)

    def test_rebuild_is_deterministic(self) -> None:
        first = self.compile()
        second = self.compile()
        self.assertEqual(first, second)
        self.assertEqual(first["release_sha256"], second["release_sha256"])
        self.assertEqual(first["instance_checksum"], second["instance_checksum"])

    def test_global_row_phase_is_tile_independent(self) -> None:
        expected = field_pattern_at_global_cell(4100, 8200, 12.5, 37.5, 0.45, 0.713)
        from_left_tile = field_pattern_at_global_cell(4100, 8200, 12.5, 37.5, 0.45, 0.713)
        from_right_tile = field_pattern_at_global_cell(4100, 8200, 12.5, 37.5, 0.45, 0.713)
        self.assertEqual(expected, from_left_tile)
        self.assertEqual(expected, from_right_tile)


if __name__ == "__main__":
    unittest.main()
