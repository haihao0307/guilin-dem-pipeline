#!/usr/bin/env python3
"""Offline regression tests for frozen Stage A and OSM skeleton contracts."""

from __future__ import annotations

import gzip
import hashlib
import json
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[4]
STAGE_A_WORKFLOW = REPO_ROOT / ".github/workflows/wenzhou-coastal-stage-a.yml"
OSM_WORKFLOW = REPO_ROOT / ".github/workflows/wenzhou-osm-hydrology.yml"
STAGE_A_RECEIPT = (
    REPO_ROOT / "projects/wenzhou/coastal/reports/STAGE_A_UPLOAD_RECEIPT.json"
)
OSM_ACQUISITION = (
    REPO_ROOT / "projects/wenzhou/coastal/reports/OSM_HYDROLOGY_ACQUISITION.json"
)
OSM_QA = REPO_ROOT / "projects/wenzhou/coastal/reports/HYDROLOGY_TOPOLOGY_QA.json"
OSM_RECEIPT = REPO_ROOT / "projects/wenzhou/coastal/reports/OSM_HYDROLOGY_RECEIPT.json"

STAGE_A_TRIGGER_PATHS = (
    ".github/workflows/wenzhou-coastal-stage-a.yml",
    "projects/wenzhou/coastal/config/coastal_domain_v100.json",
    "projects/wenzhou/coastal/scripts/run_stage_a.py",
    "projects/wenzhou/coastal/scripts/verify_parent_truth.py",
    "projects/wenzhou/coastal/scripts/download_gebco2026_ceda_subset.py",
    "projects/wenzhou/coastal/scripts/build_coastal_bathymetry.py",
)
STAGE_A_SCRIPTS = STAGE_A_TRIGGER_PATHS[2:]
STAGE_A_FILES = {
    "projects/wenzhou/coastal/data/raw/gebco_2026/WENZHOU_GEBCO_2026_BATHY_NATIVE.tif": (
        300150,
        "19906facec06851d0f46c58738c71f9de2221f764bd3cf034924a8658a205a5e",
    ),
    "projects/wenzhou/coastal/data/raw/gebco_2026/WENZHOU_GEBCO_2026_TID_NATIVE.tif": (
        16696,
        "8325b94bffa5786488cd3f67114e89cb74d572ca969bada4e742178b97ba537c",
    ),
    "projects/wenzhou/coastal/data/derived/WENZHOU_COASTAL_BATHY_100M_EPSG32651_COG.tif": (
        17637178,
        "591e92eef61699088a87e32bfd83417498f89cfe3a6a84f4ce6a2e2ac3b689fc",
    ),
    "projects/wenzhou/coastal/data/derived/WENZHOU_TRUTH_AOI_MARINE_BATHY_100M_EPSG32651_COG.tif": (
        3648707,
        "d722ab6ce121dca4ae2681ee4eea5c3131058a9c7cf76b96025a59c62867dfe7",
    ),
    "projects/wenzhou/coastal/data/derived/WENZHOU_COASTAL_TID_100M_EPSG32651_COG.tif": (
        80594,
        "57ec051848a52b34f808586454651072a0184f254943fc6d53299e5151651825",
    ),
    "projects/wenzhou/coastal/data/derived/WENZHOU_COASTAL_VERTICAL_DATUM_UNCERTAINTY_100M_COG.tif": (
        107821,
        "2d6104c944a1100efe744661674274cc8e3bbd1afd8a8bc30dd473c5a7c3c14e",
    ),
    "projects/wenzhou/coastal/data/derived/WENZHOU_COASTAL_LAND_SEA_CONFLICT_100M_COG.tif": (
        78618,
        "46ba81fd67cccc43301e713df96b2eec3d7f0047e324d2d09018db12039cda76",
    ),
}
STAGE_A_REPORTS = {
    "projects/wenzhou/coastal/reports/PARENT_TRUTH_PREFLIGHT.json",
    "projects/wenzhou/coastal/reports/GEBCO_2026_ACQUISITION.json",
    "projects/wenzhou/coastal/reports/GEBCO_2026_QA.json",
}
STAGE_A_RECEIPT_PATH = "projects/wenzhou/coastal/reports/STAGE_A_UPLOAD_RECEIPT.json"


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(8 * 1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def workflow_trigger_paths(text: str) -> tuple[str, ...]:
    lines = text.splitlines()
    start = lines.index("    paths:") + 1
    paths: list[str] = []
    for line in lines[start:]:
        if line.startswith("      - "):
            paths.append(line.removeprefix("      - "))
            continue
        if line.strip():
            break
    return tuple(paths)


def named_step(text: str, name: str) -> str:
    marker = f"      - name: {name}"
    remainder = text.split(marker, 1)[1]
    return remainder.split("\n      - name:", 1)[0]


def project_paths(block: str) -> set[str]:
    return {
        line.strip().removesuffix(" \\")
        for line in block.splitlines()
        if line.strip().startswith("projects/")
    }


class StageAFrozenContractTests(unittest.TestCase):
    def test_receipt_matches_all_seven_materialized_files(self) -> None:
        receipt = load_json(STAGE_A_RECEIPT)
        self.assertEqual(
            receipt["truthDemSha256"],
            "8a1bc6ee17dd731007804a0281f9e083e01f5745468f90cf2c11c108ec0b1c6e",
        )
        self.assertEqual(receipt["landPixelsModified"], 0)
        reported = {
            item["path"]: (item["bytes"], item["sha256"])
            for item in receipt["files"]
        }
        self.assertEqual(reported, STAGE_A_FILES)

        for relative_path, (expected_bytes, expected_sha256) in STAGE_A_FILES.items():
            path = REPO_ROOT / relative_path
            self.assertEqual(path.stat().st_size, expected_bytes, relative_path)
            self.assertEqual(sha256_file(path), expected_sha256, relative_path)

    def test_workflow_isolated_to_stage_a_inputs_and_outputs(self) -> None:
        text = STAGE_A_WORKFLOW.read_text(encoding="utf-8")
        self.assertEqual(workflow_trigger_paths(text), STAGE_A_TRIGGER_PATHS)
        self.assertNotIn("projects/wenzhou/coastal/**", text)

        static_checks = named_step(text, "Static syntax checks")
        self.assertNotIn("projects/wenzhou/coastal/scripts/*.py", static_checks)
        self.assertNotIn("tide_points_v100.json", static_checks)
        for script in STAGE_A_SCRIPTS:
            self.assertIn(script, static_checks)

        commit_step = named_step(
            text, "Commit Stage A rasters and reports through Git LFS"
        )
        self.assertEqual(
            project_paths(commit_step), set(STAGE_A_FILES) | STAGE_A_REPORTS
        )

        artifact_step = named_step(text, "Preserve Stage A evidence artifact")
        self.assertEqual(
            project_paths(artifact_step),
            set(STAGE_A_FILES) | STAGE_A_REPORTS | {STAGE_A_RECEIPT_PATH},
        )


class OsmSkeletonContractTests(unittest.TestCase):
    def test_report_distinguishes_skeleton_from_full_topology(self) -> None:
        qa = load_json(OSM_QA)
        self.assertEqual(qa["schema"], "wenzhou_hydrology_topology_qa@1.2.0")
        self.assertIs(qa["passed"], False)
        self.assertIs(qa["sourceAcquisitionPassed"], True)
        self.assertIs(qa["projectedSkeletonPassed"], True)
        self.assertIs(qa["hydrologyTopologyPassed"], False)
        self.assertEqual(qa["estuaryConnectivityStatus"], "pending")
        self.assertEqual(
            qa["nodeReferenceValidationStatus"],
            "not_evaluable_source_omits_node_ids",
        )
        self.assertEqual(qa["sourceNodeIdCount"], 0)

    def test_frozen_osm_files_match_acquisition_receipt_and_qa(self) -> None:
        acquisition = load_json(OSM_ACQUISITION)
        receipt = load_json(OSM_RECEIPT)
        qa = load_json(OSM_QA)
        acquisition_items = acquisition["rawFiles"] + acquisition["outputFiles"]
        self.assertEqual(len(acquisition["rawFiles"]), 8)
        self.assertEqual(len(acquisition["outputFiles"]), 4)

        expected_by_path: dict[str, tuple[int, str]] = {}
        for item in acquisition_items + receipt["files"] + qa["files"]:
            expected = (item["bytes"], item["sha256"])
            previous = expected_by_path.setdefault(item["path"], expected)
            self.assertEqual(previous, expected, item["path"])

        for relative_path, (expected_bytes, expected_sha256) in expected_by_path.items():
            path = REPO_ROOT / relative_path
            self.assertEqual(path.stat().st_size, expected_bytes, relative_path)
            self.assertEqual(sha256_file(path), expected_sha256, relative_path)

        for tile in acquisition["tiles"]:
            raw_path = REPO_ROOT / tile["rawCompressed"]["path"]
            content = gzip.decompress(raw_path.read_bytes())
            self.assertEqual(len(content), tile["rawUncompressedBytes"])
            self.assertEqual(
                hashlib.sha256(content).hexdigest(),
                tile["rawUncompressedSha256"],
            )

    def test_generator_and_workflow_use_the_partial_stage_contract(self) -> None:
        script = (
            REPO_ROOT / "projects/wenzhou/coastal/scripts/download_osm_hydrology.py"
        ).read_text(encoding="utf-8")
        self.assertIn('"schema": "wenzhou_hydrology_topology_qa@1.2.0"', script)
        self.assertIn('"sourceAcquisitionPassed": source_acquisition_passed', script)
        self.assertIn('"projectedSkeletonPassed": projected_skeleton_passed', script)
        self.assertNotIn(
            'return 0 if acquisition["passed"] and qa["passed"] else 2', script
        )

        workflow = OSM_WORKFLOW.read_text(encoding="utf-8")
        self.assertNotIn("assert qa['passed'] is True", workflow)
        expected_assertions = (
            "assert qa['passed'] is False",
            "assert qa['sourceAcquisitionPassed'] is True",
            "assert qa['projectedSkeletonPassed'] is True",
            "assert qa['hydrologyTopologyPassed'] is False",
            "assert qa['estuaryConnectivityStatus'] == 'pending'",
            "assert qa['nodeReferenceValidationStatus'] == 'not_evaluable_source_omits_node_ids'",
        )
        for assertion in expected_assertions:
            self.assertEqual(workflow.count(assertion), 2, assertion)


if __name__ == "__main__":
    unittest.main()
