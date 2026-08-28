from __future__ import annotations

import copy
import json
import shutil
import sys
import tempfile
import unittest
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
MODULE_DIR = ROOT / "tools" / "terrain_hydrology"
if str(MODULE_DIR) not in sys.path:
    sys.path.insert(0, str(MODULE_DIR))

import compile_yangshuo_candidates_v300 as compiler
import validate_yangshuo_candidates_v300 as validator


CONFIG_RELATIVE = Path("projects/guilin/config/yangshuo_lijiang_candidates_v300.json")


class YangshuoCandidateContractTests(unittest.TestCase):
    def test_production_contract_passes(self) -> None:
        report = validator.validate_contract(ROOT, ROOT / CONFIG_RELATIVE)
        self.assertTrue(report["passed"])
        self.assertEqual(len(report["candidates"]), 4)
        self.assertTrue(report["gates"]["native2048Windows"])
        for candidate in report["candidates"]:
            self.assertEqual(candidate["grid"], [2048, 2048])
            self.assertEqual(candidate["spacingMeters"], 12.5)
            self.assertAlmostEqual(candidate["widthMeters"], 25600.0)
            self.assertAlmostEqual(candidate["heightMeters"], 25600.0)
            self.assertAlmostEqual(candidate["areaSquareKilometers"], 655.36)
            self.assertFalse(candidate["resampled"])

    def test_recorded_windows_are_exact_source_windows(self) -> None:
        config = json.loads((ROOT / CONFIG_RELATIVE).read_text(encoding="utf-8"))
        transform = config["truthSource"]["transform"]
        for candidate in config["candidates"]:
            calculated = validator.window_bounds(transform, candidate["pixelWindow"])
            self.assertEqual(calculated, candidate["alignedBounds"])
            self.assertEqual(
                validator.bounds_center(calculated),
                candidate["alignedCenterProjected"],
            )

    def test_contract_rejects_1024_grid(self) -> None:
        with self._temporary_contract_root() as temporary_root:
            config_path = temporary_root / CONFIG_RELATIVE
            config = json.loads(config_path.read_text(encoding="utf-8"))
            config["windowContract"]["grid"] = [1024, 1024]
            config_path.write_text(
                json.dumps(config, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
            with self.assertRaisesRegex(validator.ValidationError, "2048"):
                validator.validate_contract(temporary_root, config_path)

    def test_contract_rejects_nonzero_macro_delta(self) -> None:
        with self._temporary_contract_root() as temporary_root:
            config_path = temporary_root / CONFIG_RELATIVE
            config = json.loads(config_path.read_text(encoding="utf-8"))
            config["windowContract"]["macroDeltaMeters"] = 1.0
            config_path.write_text(
                json.dumps(config, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
            with self.assertRaisesRegex(validator.ValidationError, "macroDeltaMeters"):
                validator.validate_contract(temporary_root, config_path)

    def test_contract_rejects_out_of_bounds_candidate(self) -> None:
        with self._temporary_contract_root() as temporary_root:
            config_path = temporary_root / CONFIG_RELATIVE
            config = json.loads(config_path.read_text(encoding="utf-8"))
            config["candidates"][0]["pixelWindow"][0] = config["truthSource"]["grid"][0] - 100
            config_path.write_text(
                json.dumps(config, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
            with self.assertRaisesRegex(validator.ValidationError, "exceeds source width"):
                validator.validate_contract(temporary_root, config_path)

    def test_derivative_previews_keep_native_grid_shape(self) -> None:
        axis = np.linspace(0.0, 1.0, 64, dtype=np.float32)
        heights = (
            axis[None, :] * 120.0
            + axis[:, None] * 40.0
            + np.sin(axis[None, :] * np.pi * 4.0) * 8.0
        ).astype(np.float32)
        valid = np.ones(heights.shape, dtype=bool)
        derivatives = compiler.terrain_derivatives(np, heights, valid, 12.5)
        self.assertEqual(derivatives["slopeDegrees"].shape, heights.shape)
        self.assertEqual(derivatives["curvature"].shape, heights.shape)
        self.assertEqual(derivatives["hillshade"].shape, heights.shape)
        self.assertTrue(np.isfinite(derivatives["slopeDegrees"]).all())

    def _temporary_contract_root(self):
        class ContractRoot:
            def __init__(self, owner: "YangshuoCandidateContractTests") -> None:
                self.owner = owner
                self.context = tempfile.TemporaryDirectory()
                self.path = Path(self.context.name)

            def __enter__(self) -> Path:
                config = json.loads((ROOT / CONFIG_RELATIVE).read_text(encoding="utf-8"))
                required = [
                    CONFIG_RELATIVE,
                    Path(config["truthSource"]["preflightPath"]),
                    Path(config["truthSource"]["verificationIndexPath"]),
                    Path(config["hydrology"]["path"]),
                ]
                for relative in required:
                    source = ROOT / relative
                    destination = self.path / relative
                    destination.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(source, destination)
                return self.path

            def __exit__(self, exc_type, exc, traceback) -> None:
                self.context.cleanup()

        return ContractRoot(self)


if __name__ == "__main__":
    unittest.main()
