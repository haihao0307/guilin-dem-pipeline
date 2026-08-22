from __future__ import annotations

import importlib.util
import json
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = ROOT.parents[1]


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


builder = load_module(
    "build_ops_control_plane",
    ROOT / "scripts" / "ecology_v040" / "build_ops_control_plane.py",
)
runtime_qa = load_module(
    "runtime_qa",
    ROOT / "scripts" / "ecology_v040" / "runtime_qa.py",
)
packager = load_module(
    "package_v040_release",
    ROOT / "scripts" / "ecology_v040" / "package_v040_release.py",
)


class OpsControlPlaneV040Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.control_state = json.loads((REPO_ROOT / "ops" / "control-state.json").read_text(encoding="utf-8"))
        cls.candidate = json.loads((ROOT / "metadata" / "ecology" / "v0.4.0" / "ecology-release-candidate.json").read_text(encoding="utf-8"))

    def test_public_status_is_sanitized_and_deterministic(self) -> None:
        first = builder.build_status_document(self.control_state, self.candidate, generated_at="2026-08-22T07:20:00Z")
        second = builder.build_status_document(self.control_state, self.candidate, generated_at="2026-08-22T07:20:00Z")
        self.assertEqual(first, second)
        builder.assert_sanitized(first)
        self.assertEqual(first["stable_release"], "v0.3.1")
        self.assertEqual(first["target_release"], "v0.4.0-rc1")
        self.assertEqual(first["tests"]["focused_passed"], 9)
        self.assertEqual(len(first["payload_sha256"]), 64)

    def test_release_candidate_cannot_promote_early(self) -> None:
        self.assertFalse(self.candidate["default_runtime"])
        self.assertEqual(self.candidate["stable_release"], "v0.3.1")
        self.assertEqual(self.candidate["rollback_release"], "v0.3.1")
        self.assertGreaterEqual(len(self.candidate["release_blockers"]), 8)

    def test_ops_page_has_required_links_and_local_runtime(self) -> None:
        html = (ROOT / "web" / "ops" / "index.html").read_text(encoding="utf-8")
        self.assertIn('fetch("./status.json"', html)
        self.assertIn("../live-terrain.html", html)
        self.assertIn("../", html)
        self.assertNotIn("<script src=", html.lower())
        self.assertIn("浏览器页面不保存", html)

    def test_runtime_qa_passes_phase_a_contract(self) -> None:
        report = runtime_qa.run_checks()
        failed = [item for item in report["checks"] if not item["passed"]]
        self.assertEqual(failed, [])
        self.assertTrue(report["passed"])
        self.assertEqual(report["stable_release"], "v0.3.1")

    def test_windows_package_is_integral_and_uses_ascii_paths(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            output = Path(temp_dir) / "Guilin_Ecology_v0.4.0_PhaseA_Windows.zip"
            manifest = packager.build_package(output)
            self.assertTrue(output.is_file())
            self.assertEqual(len(manifest["sha256"]), 64)
            self.assertGreater(manifest["member_count"], 10)
            with zipfile.ZipFile(output, "r") as archive:
                self.assertIsNone(archive.testzip())
                for name in archive.namelist():
                    name.encode("ascii")
                    self.assertNotIn("..", Path(name).parts)
                    self.assertLessEqual(len(name), 180)


if __name__ == "__main__":
    unittest.main()
