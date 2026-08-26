from __future__ import annotations

import json
import shutil
import tempfile
import unittest
from pathlib import Path

from tools.procedural_landscape.validate import Validation


REPO_ROOT = Path(__file__).resolve().parents[2]


class ProceduralLandscapeValidationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self._copy("skills/dem-procedural-landscape")
        self._copy("web/procedural-landscape-skill/status.json")
        for city in ("guilin", "wenzhou", "kunming"):
            self._copy(f"projects/{city}/config/procedural_landscape_binding_v020.json")

    def tearDown(self) -> None:
        self.temp.cleanup()

    def _copy(self, relative: str) -> None:
        source = REPO_ROOT / relative
        target = self.root / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        if source.is_dir():
            shutil.copytree(source, target, dirs_exist_ok=True)
        else:
            shutil.copy2(source, target)

    def _load(self, relative: str) -> dict:
        return json.loads((self.root / relative).read_text(encoding="utf-8"))

    def _write(self, relative: str, value: dict) -> None:
        path = self.root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    def _codes(self) -> set[str]:
        return {issue["code"] for issue in Validation(self.root).run()["issues"]}

    def test_repository_contract_passes(self) -> None:
        result = Validation(REPO_ROOT).run()
        self.assertTrue(result["passed"], result["issues"])

    def test_duplicate_branch_fails_closed(self) -> None:
        relative = "skills/dem-procedural-landscape/BRANCH_REGISTRY.json"
        registry = self._load(relative)
        registry["activeBranches"].append(dict(registry["activeBranches"][0]))
        self._write(relative, registry)
        self.assertIn("BRANCH_DUPLICATE", self._codes())

    def test_missing_branch_skill_file_fails_closed(self) -> None:
        missing = self.root / "skills/dem-procedural-landscape/branches/terrain-geomorphology/SKILL.md"
        missing.unlink()
        self.assertIn("PATH_TARGET_MISSING", self._codes())

    def test_cross_project_truth_source_fails_closed(self) -> None:
        relative = "projects/guilin/config/procedural_landscape_binding_v020.json"
        binding = self._load(relative)
        binding["truthSources"][0]["projectId"] = "wenzhou-qingjiang-22000km2"
        binding["truthSources"][0]["path"] = "projects/wenzhou/archive/truth/foreign.tif"
        self._write(relative, binding)
        codes = self._codes()
        self.assertIn("PROJECT_DATA_LEAK", codes)
        self.assertIn("PROJECT_PATH_LEAK", codes)

    def test_one_meter_history_claim_fails_closed(self) -> None:
        relative = "projects/kunming/config/procedural_landscape_binding_v020.json"
        binding = self._load(relative)
        binding["historicalOutput"]["native1mSurveyClaim"] = True
        self._write(relative, binding)
        self.assertIn("HISTORICAL_1M_CLAIM", self._codes())

    def test_public_release_without_evidence_fails_closed(self) -> None:
        relative = "projects/wenzhou/config/procedural_landscape_binding_v020.json"
        binding = self._load(relative)
        binding["release"]["status"] = "published"
        binding["release"]["publicReleaseApproved"] = True
        self._write(relative, binding)
        codes = self._codes()
        self.assertIn("PUBLIC_BROWSER_QA", codes)
        self.assertIn("PUBLIC_ROLLBACK", codes)
        self.assertIn("PUBLIC_VISUAL_APPROVAL", codes)

    def test_delta_without_parent_mask_fails_closed(self) -> None:
        layer = {
            "schemaVersion": "2.0.0",
            "documentType": "dem-procedural-landscape-layer-manifest",
            "projectId": "guilin-yangtang",
            "layerId": "test-erosion",
            "layerRole": "procedural-delta",
            "source": {"status": "verified", "name": "fixture", "version": "1"},
            "spatial": {"crs": "EPSG:32649", "units": "m", "nodata": None},
            "parentMask": None,
            "delta": {"maxAbsDelta": 2.0, "rollbackValue": 0.0, "reversible": True},
            "quality": {"status": "verified", "uncertaintyVisible": True},
            "runtime": {"role": "fixture", "published": False},
        }
        self._write("projects/guilin/procedural-landscape/tests/test.layer.json", layer)
        self.assertIn("PARENT_MASK_REQUIRED", self._codes())

    def test_thirty_meter_final_output_fails_closed(self) -> None:
        relative = "projects/guilin/config/procedural_landscape_binding_v020.json"
        binding = self._load(relative)
        binding["truthSources"][1]["outputGridMeters"] = 30.0
        self._write(relative, binding)
        self.assertIn("FINAL_30M_FALLBACK", self._codes())


if __name__ == "__main__":
    unittest.main()
