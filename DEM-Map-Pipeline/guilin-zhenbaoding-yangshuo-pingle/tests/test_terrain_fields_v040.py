from __future__ import annotations

import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve()
MODULE_PATH = HERE.parents[1] / "scripts" / "compile_terrain_fields_v040.py"
SPEC = importlib.util.spec_from_file_location("terrain_v040", MODULE_PATH)
assert SPEC and SPEC.loader
terrain = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = terrain
SPEC.loader.exec_module(terrain)


class TerrainFieldsV040Tests(unittest.TestCase):
    def setUp(self) -> None:
        size = 65
        rows, cols = np.indices((size, size), dtype=np.float64)
        self.z = 260.0 - rows * 1.8 + 0.004 * (cols - 32.0) ** 2
        self.z += 7.0 * np.exp(-((rows - 18.0) ** 2 + (cols - 22.0) ** 2) / 90.0)
        self.water = np.zeros_like(self.z, dtype=bool)
        self.water[-2:, :] = True
        self.spec = terrain.GridSpec(size, size, (415000.0, 2789000.0, 415640.0, 2789640.0), "EPSG:32649")

    def test_truth_grid_is_immutable(self) -> None:
        before = terrain.array_sha256(self.z)
        result = terrain.compile_fields(self.z, self.spec, self.water)
        self.assertEqual(before, terrain.array_sha256(self.z))
        self.assertEqual(before, terrain.array_sha256(result.z_truth_m))
        self.assertFalse(np.shares_memory(result.z_truth_m, self.z))

    def test_water_is_hard_excluded(self) -> None:
        result = terrain.compile_fields(self.z, self.spec, self.water)
        bit = terrain.EXCLUSION_BITS["permanent_water"]
        self.assertTrue(np.all((result.hard_exclusion_mask[self.water] & bit) != 0))
        self.assertFalse(np.any(result.erosion_channel_mask[self.water]))
        self.assertFalse(np.any(result.karst_rock_core_mask[self.water]))

    def test_flow_never_climbs_and_channels_reach_water(self) -> None:
        result = terrain.compile_fields(self.z, self.spec, self.water)
        flat_z = result.z_truth_m.reshape(-1)
        flat_to = result.flow_to_index.reshape(-1)
        flowing = np.flatnonzero(flat_to >= 0)
        self.assertTrue(np.all(flat_z[flat_to[flowing]] < flat_z[flowing] + 1e-9))
        channel = result.erosion_channel_mask.astype(bool)
        self.assertTrue(np.all(result.reaches_permanent_water[channel] == 1))

    def test_output_is_deterministic(self) -> None:
        first = terrain.compile_fields(self.z, self.spec, self.water)
        second = terrain.compile_fields(self.z.copy(), self.spec, self.water.copy())
        for name in first.arrays():
            self.assertEqual(
                terrain.array_sha256(first.arrays()[name]),
                terrain.array_sha256(second.arrays()[name]),
                name,
            )

    def test_manifest_records_all_required_fields(self) -> None:
        result = terrain.compile_fields(self.z, self.spec, self.water)
        with tempfile.TemporaryDirectory() as folder:
            manifest_path = terrain.write_release(result, self.spec, Path(folder), {"test": True})
            payload = json.loads(manifest_path.read_text(encoding="utf-8"))
            required = {
                "permanent_water_mask",
                "active_bank_mask",
                "distance_to_water_m",
                "flow_direction_xy",
                "flow_accumulation",
                "erosion_channel_mask",
                "erosion_depth_m",
                "karst_rock_mask",
                "karst_rock_core_mask",
                "landform_class",
                "hard_exclusion_mask",
            }
            self.assertTrue(required.issubset(payload["fields"]))
            self.assertTrue(payload["truthPolicy"]["zTruthReadOnly"])
            self.assertEqual(payload["validation"]["waterHardExclusionMissing"], 0)


if __name__ == "__main__":
    unittest.main()
