from __future__ import annotations

import json
import re
import subprocess
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "web" / "guilin-v050"
RELEASE_GATE = ROOT / "projects" / "guilin" / "config" / "release_gate_v050.json"
CORE_IDS = (
    "zhenbao-ding",
    "guilin-old-city",
    "yangtang-airfield",
    "yangshuo-county-seat",
)
RUNTIME_MODULES = (
    "runtime.js",
    "core-loader.js",
    "gaea-bridge.js",
    "hydrology-runtime.js",
    "ecology-core-runtime.js",
)


class GuilinRecoveryRuntimeTests(unittest.TestCase):
    """Regression gates that prevent a return to the old iframe repair shell."""

    @classmethod
    def setUpClass(cls) -> None:
        cls.manifest = json.loads((WEB / "manifest.json").read_text(encoding="utf-8"))
        cls.gate = json.loads(RELEASE_GATE.read_text(encoding="utf-8"))
        cls.index = (WEB / "index.html").read_text(encoding="utf-8")
        cls.runtime = (WEB / "runtime.js").read_text(encoding="utf-8")
        cls.workbench = (WEB / "workbench.html").read_text(encoding="utf-8")

    def test_pr_and_publication_safety_gates_remain_closed(self) -> None:
        publication = self.manifest["publication"]
        publish_gate = self.manifest["publishGate"]
        self.assertFalse(publication["allowed"])
        self.assertFalse(publication["automatic"])
        self.assertTrue(publication["pullRequestMustRemainDraft"])
        self.assertFalse(publication["mergeAllowed"])
        self.assertEqual(publish_gate["status"], "blocked")
        self.assertTrue(publish_gate["requiresUserVisualApproval"])
        self.assertFalse(self.gate["public_release_allowed"])
        self.assertFalse(self.gate["automatic_publication_allowed"])
        self.assertEqual(self.gate["stable_release"], "v0.3.1")

    def test_main_entry_is_the_single_canvas_workbench(self) -> None:
        self.assertNotRegex(self.index.lower(), r"<\s*iframe\b")
        self.assertEqual(len(re.findall(r"<\s*canvas\b", self.index.lower())), 1)
        self.assertRegex(self.index, r'src=["\'](?:\./)?runtime\.js["\']')
        self.assertFalse((WEB / "bootstrap.js").exists())
        self.assertNotIn("SOURCE_REPLACEMENTS", self.index + self.runtime)
        self.assertNotIn("state.showWater?.35*state.waterLevel:0", self.runtime)

        self.assertNotRegex(self.workbench.lower(), r"<\s*iframe\b")
        self.assertIn("index.html", self.workbench)

    def test_shared_runtime_policy_and_exact_core_set(self) -> None:
        policy = self.manifest["runtimePolicy"]
        self.assertEqual(policy["canvas"], "single-webgl2-canvas")
        self.assertEqual(policy["camera"], "single-shared-camera")
        self.assertEqual(policy["state"], "single-observable-store")
        self.assertFalse(policy["iframeNavigationAllowed"])
        self.assertEqual(policy["denseEcologyScope"], "active-core-only")

        cores = self.manifest["fixedCores"]
        self.assertEqual(tuple(core["id"] for core in cores), CORE_IDS)
        self.assertTrue(all(core["sideMeters"] == 10000 for core in cores))
        self.assertTrue(all(core["resolutionMeters"] == 12.5 for core in cores))
        self.assertEqual(set(self.manifest["corePackages"]), set(CORE_IDS))

    def test_coverage_truth_never_claims_complete_12_5m(self) -> None:
        coverage = self.manifest["coverage"]
        fallback = self.manifest["fallback"]
        overall = self.manifest["overall"]
        self.assertFalse(coverage["continuous12_5mComplete"])
        self.assertGreater(coverage["gapAreaSquareKilometers"], 0)
        self.assertEqual(coverage["currentOverallSourceResolutionMeters"], 30)
        self.assertEqual(len(coverage["currentOverallWebRasterSpacingMeters"]), 2)
        self.assertTrue(fallback["active"])
        self.assertEqual(fallback["sourceResolutionMeters"], 30)
        self.assertTrue(all(value > 100 for value in fallback["rasterSpacingMeters"]))
        self.assertFalse(fallback["mayClaimComplete12_5m"])
        self.assertEqual(overall["sourceResolutionMeters"], 30)
        self.assertGreater(overall["resolutionMeters"], 100)
        self.assertEqual(overall["status"], "complete-web-raster-from-30m-source")

    def test_all_shared_runtime_modules_are_valid_es_modules(self) -> None:
        for filename in RUNTIME_MODULES:
            path = WEB / filename
            self.assertTrue(path.is_file(), filename)
            result = subprocess.run(
                ["node", "--check", str(path)],
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(result.returncode, 0, f"{filename}: {result.stderr}")


if __name__ == "__main__":
    unittest.main()
