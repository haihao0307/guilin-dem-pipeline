from __future__ import annotations

import hashlib
import importlib.util
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = ROOT / "scripts" / "ecology_v040" / "terrain_field_compiler.py"
SPEC = importlib.util.spec_from_file_location("terrain_field_compiler", MODULE_PATH)
assert SPEC and SPEC.loader
module = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(module)

CompilerConfig = module.CompilerConfig
GridSpec = module.GridSpec
compile_terrain_fields = module.compile_terrain_fields


class TerrainFieldCompilerV040Tests(unittest.TestCase):
    def setUp(self) -> None:
        self.spec = GridSpec(
            width=9,
            height=9,
            cell_size_m=10.0,
            min_elevation_m=100.0,
            max_elevation_m=220.0,
            origin_col=1000,
            origin_row=2000,
        )
        elevations = []
        water = []
        for row in range(self.spec.height):
            for col in range(self.spec.width):
                elevation = 210.0 - row * 8.0 - abs(col - 4) * 3.0
                elevations.append(elevation)
                water.append(1 if row == 8 and col == 4 else 0)
        self.elevations = tuple(elevations)
        self.water = tuple(water)
        self.config = CompilerConfig(
            erosion_accumulation_threshold=2.0,
            erosion_min_slope_deg=0.1,
            rock_slope_deg=8.0,
            rock_core_slope_deg=55.0,
            rock_relief_m=1.0,
            rock_core_relief_m=99.0,
        )

    def test_truth_elevation_is_immutable(self) -> None:
        before = tuple(self.elevations)
        result = compile_terrain_fields(
            self.elevations, self.water, self.spec, self.config
        )
        self.assertEqual(before, self.elevations)
        truth = result["manifest"]["truth"]
        self.assertTrue(truth["immutable"])
        self.assertEqual(truth["sha256_before"], truth["sha256_after"])

    def test_water_is_a_hard_exclusion(self) -> None:
        result = compile_terrain_fields(
            self.elevations, self.water, self.spec, self.config
        )
        fields = result["fields"]
        water_index = 8 * self.spec.width + 4
        self.assertEqual(fields["permanent_water_mask"][water_index], 1)
        self.assertEqual(fields["hard_exclusion_mask"][water_index], 1)
        self.assertEqual(fields["landform_class"][water_index], 0)

    def test_erosion_channels_drain_downhill_to_water(self) -> None:
        result = compile_terrain_fields(
            self.elevations, self.water, self.spec, self.config
        )
        fields = result["fields"]
        downstream = fields["flow_downstream_index"]
        channels = fields["erosion_channel_mask"]
        water = fields["permanent_water_mask"]
        self.assertGreater(sum(channels), 0)
        for start, enabled in enumerate(channels):
            if not enabled:
                continue
            current = start
            visited = set()
            while current >= 0 and not water[current]:
                self.assertNotIn(current, visited, "flow path must not loop")
                visited.add(current)
                target = downstream[current]
                self.assertGreaterEqual(target, 0, "channel must reach water")
                self.assertLess(
                    self.elevations[target],
                    self.elevations[current],
                    "flow must descend strictly",
                )
                current = target
            self.assertGreaterEqual(current, 0)
            self.assertEqual(water[current], 1)

    def test_rebuild_is_deterministic(self) -> None:
        first = compile_terrain_fields(
            self.elevations, self.water, self.spec, self.config
        )
        second = compile_terrain_fields(
            self.elevations, self.water, self.spec, self.config
        )
        first_payload = json.dumps(
            first, sort_keys=True, ensure_ascii=False, separators=(",", ":")
        ).encode("utf-8")
        second_payload = json.dumps(
            second, sort_keys=True, ensure_ascii=False, separators=(",", ":")
        ).encode("utf-8")
        self.assertEqual(
            hashlib.sha256(first_payload).hexdigest(),
            hashlib.sha256(second_payload).hexdigest(),
        )
        self.assertEqual(first, second)


if __name__ == "__main__":
    unittest.main()
