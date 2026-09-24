#!/usr/bin/env python3
"""Bounded N30 history-replay gate; not a production Mother gate."""

from __future__ import annotations

import json
import sys
from pathlib import Path


def is_ancestor(subject: str, head: str, parent_map: dict[str, str | None]) -> bool:
    seen: set[str] = set()
    current: str | None = head
    while current is not None and current not in seen:
        if current == subject:
            return True
        seen.add(current)
        current = parent_map.get(current)
    return False


def classify(case: dict, observation: dict) -> tuple[str, list[str]]:
    subject = observation["testedSubjectSha"]
    head = case["head"]
    parent_map = dict(observation["parentMap"])
    changed = dict(observation["changedPathsFromTestedSubject"])

    if "parent" in case:
        parent_map[head] = case["parent"]
    if "changedPaths" in case:
        inherited = []
        parent = case.get("parent")
        if parent:
            inherited = changed.get(parent, [])
        changed[head] = inherited + case["changedPaths"]

    paths = changed.get(head, [])
    if not is_ancestor(subject, head, parent_map):
        return "HOLD_LINEAGE_DIVERGED", paths
    if case["claimSubjectSha"] != subject:
        return "HOLD_RECEIPT_SUBJECT_MISMATCH", paths
    if not case["bindingComplete"]:
        return "HOLD_RECEIPT_BINDING_INCOMPLETE", paths

    allowed = tuple(observation["metadataPathPrefixes"])
    if any(not path.startswith(allowed) for path in paths):
        return "HOLD_UNTESTED_NONMETADATA_DELTA", paths
    if head == subject:
        return "TESTED_SUBJECT_VERIFIED", paths
    return "METADATA_ONLY_DESCENDANT_VERIFIED", paths


def main() -> int:
    fixture_path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).with_name(
        "tested_subject_lineage_fixture_n30.json"
    )
    output_path = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(__file__).with_name(
        "tested_subject_lineage_result_n30.json"
    )
    fixture = json.loads(fixture_path.read_text(encoding="utf-8"))
    observation = fixture["observation"]
    results = []
    for case in fixture["cases"]:
        actual, paths = classify(case, observation)
        results.append(
            {
                "id": case["id"],
                "expected": case["expected"],
                "actual": actual,
                "pass": actual == case["expected"],
                "changedPathsFromTestedSubject": paths,
            }
        )

    passed = sum(item["pass"] for item in results)
    output = {
        "schema": "kaopu.tested-subject-lineage-result/1.0",
        "status": "PASS" if passed == len(results) else "FAIL",
        "passed": passed,
        "total": len(results),
        "testedSubjectSha": observation["testedSubjectSha"],
        "receiptSha": observation["receiptSha"],
        "observedBranchHead": observation["observedBranchHead"],
        "claimBoundary": (
            "Metadata-only descendants may carry a receipt for an immutable tested subject, "
            "but they are not themselves the tested subject."
        ),
        "results": results,
    }
    output_path.write_text(json.dumps(output, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps(output, indent=2, ensure_ascii=False))
    return 0 if output["status"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
