from __future__ import annotations

import json
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CANDIDATE = ROOT / "web" / "guilin-v050"
PROJECT = ROOT / "DEM-Map-Pipeline" / "guilin-zhenbaoding-yangshuo-pingle"
BASELINE_ASSETS = PROJECT / "web" / "assets" / "ecology" / "v0.3.1"
HEIGHT_GRID = (
    PROJECT
    / "metadata"
    / "ecology"
    / "v0.3.1"
    / "runtime-assets"
    / "height-grid.u16"
)
RELEASE_GATE = ROOT / "projects" / "guilin" / "config" / "release_gate_v050.json"


class GuilinRecoveryRuntimeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.manifest = json.loads((CANDIDATE / "manifest.json").read_text(encoding="utf-8"))
        cls.gate = json.loads(RELEASE_GATE.read_text(encoding="utf-8"))
        cls.index = (CANDIDATE / "index.html").read_text(encoding="utf-8")
        cls.runtime = (CANDIDATE / "runtime.js").read_text(encoding="utf-8")
        cls.bootstrap = (CANDIDATE / "bootstrap.js").read_text(encoding="utf-8")

    def test_publication_remains_blocked(self) -> None:
        self.assertFalse(self.manifest["publication"]["allowed"])
        self.assertFalse(self.manifest["publication"]["automatic"])
        self.assertFalse(self.gate["public_release_allowed"])
        self.assertFalse(self.gate["automatic_publication_allowed"])
        self.assertEqual(self.gate["stable_release"], "v0.3.1")

    def test_four_locked_cores_and_core_only_detail(self) -> None:
        cores = self.manifest["fixedCores"]
        self.assertEqual(len(cores), 4)
        self.assertEqual(
            [core["id"] for core in cores],
            [
                "zhenbao-ding",
                "guilin-old-city",
                "yangtang-airfield",
                "yangshuo-county-seat",
            ],
        )
        self.assertTrue(all(core["sideMeters"] == 10000 for core in cores))
        self.assertEqual(
            self.manifest["corePolicy"]["detailedEcologyScope"],
            "active-core-only",
        )

    def test_baseline_assets_and_record_counts_are_real(self) -> None:
        self.assertEqual(HEIGHT_GRID.stat().st_size, 257 * 257 * 2)
        expected = {
            "trees.bin": (12, 23685),
            "shrubs.bin": (10, 7322),
            "rice.bin": (10, 5277),
        }
        for name, (stride, count) in expected.items():
            path = BASELINE_ASSETS / name
            self.assertTrue(path.is_file(), name)
            self.assertEqual(path.stat().st_size // stride, count, name)
            self.assertEqual(path.stat().st_size % stride, 0, name)
        for name in (
            "field0-elevation-slope-forest-water.png",
            "field1-paddy-bund-rows-rock.png",
            "field2-wet-terrace-erosion-landuse.png",
        ):
            self.assertTrue((BASELINE_ASSETS / name).is_file(), name)

    def test_required_runtime_systems_are_executable(self) -> None:
        required_tokens = (
            "buildTerrain",
            "decodeTrees",
            "decodeShrubs",
            "decodeRice",
            "voronoiF1",
            "bundCore",
            "erosionCore",
            "pointerRay",
            "rayTerrainHit",
            "updateGroundMovement",
            "groundClearanceM:1.7",
            "window.DEMEcologySurface",
            "detailedEcologyScope:'active-core-only'",
        )
        for token in required_tokens:
            self.assertIn(token, self.runtime)
        self.assertNotIn("+0.12", self.runtime)
        self.assertNotIn("Math.max(220", self.runtime)

    def test_separate_gaea_and_hydrology_controls_exist(self) -> None:
        self.assertIn("GAEA 地形视觉", self.index)
        self.assertIn("水系系统", self.index)
        self.assertIn("hydrologySurface", self.index)
        self.assertIn("hydrologyDiagnostics", self.index)
        self.assertIn("groundModeButton", self.index)
        self.assertIn('src="bootstrap.js"', self.index)

    def test_bootstrap_repairs_known_source_defect_before_import(self) -> None:
        bad = "state.showWater?.35*state.waterLevel:0"
        good = "(state.showWater ? .35 * state.waterLevel : 0)"
        self.assertIn(bad, self.runtime)
        self.assertIn(bad, self.bootstrap)
        self.assertIn(good, self.bootstrap)
        repaired = self.runtime.replace(bad, good)
        self.assertNotIn(bad, repaired)
        with tempfile.TemporaryDirectory() as temp_dir:
            path = Path(temp_dir) / "runtime-repaired.mjs"
            path.write_text(repaired, encoding="utf-8")
            result = subprocess.run(
                ["node", "--check", str(path)],
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(result.returncode, 0, result.stderr)

    def test_visual_baseline_metrics_are_preserved(self) -> None:
        ecology = self.manifest["ecology"]
        self.assertEqual(ecology["speciesArchetypeCount"], 20)
        self.assertEqual(ecology["treeCount"], 23685)
        self.assertEqual(ecology["shrubCount"], 7322)
        self.assertEqual(ecology["riceClusterCount"], 5277)
        self.assertEqual(ecology["channelVegetationCount"], 0)
        self.assertEqual(ecology["cropPaletteClassCount"], 8)
        self.assertEqual(ecology["erosionStreamlineCount"], 68)
        self.assertEqual(ecology["fieldTextureOrientation"], "world-aligned-no-y-flip")


if __name__ == "__main__":
    unittest.main()
