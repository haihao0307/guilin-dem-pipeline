#!/usr/bin/env python3
"""KAOPU N34 bounded replay: reversible visual state must round-trip."""

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parent


def evaluate(case):
    claim = case["claim"]
    evidence = case["evidence"]

    if claim == "TECHNICAL_RUN_COMPLETE":
        required = ("immutableSubjectBound", "workflowSuccess", "finalBrowserReady")
        missing = [key for key in required if not evidence.get(key, False)]
        return {
            "decision": "CLAIM_VERIFIED" if not missing else "HOLD_TECHNICAL_RUN_INCOMPLETE",
            "missing": missing,
        }

    if claim == "VISUAL_STATE_ROUNDTRIP_VERIFIED":
        if evidence.get("actualVisualFailureObserved", False):
            return {"decision": "REJECTED_BY_VISUAL_OBSERVATION", "missing": []}
        required = (
            "immutableSubjectBound",
            "immutableBaselineTuple",
            "transitionSequenceRecorded",
            "returnedToBaselineState",
            "fullTupleEqualityAfterReturn",
            "repeatCycleEquality",
            "paintedVisualEvidenceAfterReturn",
            "visualEnvironmentPinned",
        )
        missing = [key for key in required if not evidence.get(key, False)]
        return {
            "decision": "ROUNDTRIP_VERIFIED" if not missing else "HOLD_VISUAL_STATE_ROUNDTRIP_INCOMPLETE",
            "missing": missing,
        }

    if claim == "ROOT_CAUSE_CONFIRMED":
        required = ("failureSignatureBound", "repairDiffBound", "counterfactualReplayPassed")
        missing = [key for key in required if not evidence.get(key, False)]
        return {
            "decision": "ROOT_CAUSE_CONFIRMED" if not missing else "HOLD_ROOT_CAUSE_EVIDENCE_INCOMPLETE",
            "missing": missing,
        }

    raise ValueError(f"unknown claim: {claim}")


def main():
    fixture = json.loads((ROOT / "visual_state_roundtrip_fixture_n34.json").read_text())
    rows = []
    for case in fixture["cases"]:
        actual = evaluate(case)
        rows.append(
            {
                "id": case["id"],
                "claim": case["claim"],
                "expectedDecision": case["expectedDecision"],
                "actualDecision": actual["decision"],
                "missing": actual["missing"],
                "passed": actual["decision"] == case["expectedDecision"],
            }
        )

    result = {
        "schema": "kaopu.learning-probe/1.0",
        "round": "N34",
        "question": "Can a green final-state browser run prove a reversible visual control restores its original rendered state?",
        "passed": sum(row["passed"] for row in rows),
        "total": len(rows),
        "allPassed": all(row["passed"] for row in rows),
        "results": rows,
        "status": "Candidate historical replay verified",
        "limits": {
            "productionGateInstalled": False,
            "globalR2Changed": False,
            "crossMotherValidated": False,
            "userAccepted": False,
        },
    }
    (ROOT / "visual_state_roundtrip_result_n34.json").write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + "\n"
    )
    print(json.dumps({"passed": result["passed"], "total": result["total"], "allPassed": result["allPassed"]}))
    if not result["allPassed"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
