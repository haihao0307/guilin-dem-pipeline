#!/usr/bin/env python3
"""Evaluate whether a published standalone may inherit named CI claims."""

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parent
FIXTURE = ROOT / "lace_r05_tested_artifact_lineage_fixture_n193.json"
RESULT = ROOT / "lace_r05_tested_artifact_lineage_result_n193.json"


def evaluate(case):
    if case["publishedIndexBlob"] != case["previewIndexBlob"]:
        return "HOLD_ARTIFACT_IDENTITY_MISMATCH"
    if not case["manifestAndEmbeddedHashesMatch"]:
        return "HOLD_MANIFEST_BYTES_MISMATCH"
    if case["claimedRunHead"] != case["publishedSourceHead"]:
        return "HOLD_RECEIPT_SUBJECT_MISMATCH"
    if case["nonMetadataDeltaAfterTest"]:
        return "HOLD_UNTESTED_NONMETADATA_DELTA"
    if case["claimType"] == "PUBLIC_BROWSER_RUNTIME" and not case["publicBrowserGateRun"]:
        return "HOLD_PUBLIC_BROWSER_NOT_TESTED"
    if case["claimType"] == "TARGET_GPU_PERFORMANCE" and not case["targetGpuGateRun"]:
        return "HOLD_TARGET_GPU_NOT_TESTED"
    return "CLAIM_VERIFIED_SCOPED"


def main():
    fixture = json.loads(FIXTURE.read_text())
    outcomes = []
    for case in fixture["cases"]:
        actual = evaluate(case)
        outcomes.append({
            "id": case["id"],
            "expected": case["expected"],
            "actual": actual,
            "match": actual == case["expected"],
        })
    result = {
        "probe": "N193_LACE_R05_TESTED_ARTIFACT_LINEAGE",
        "passed": all(item["match"] for item in outcomes),
        "outcomes": outcomes,
    }
    RESULT.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
