#!/usr/bin/env python3
"""Bounded replay for KAOPU N33: visible boot before a large payload."""

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parent


def evaluate(case):
    claim = case["claim"]
    evidence = case["evidence"]

    if claim == "FINAL_RUNTIME_READY":
        required = (
            "immutableSubjectBound",
            "artifactIdentityBound",
            "finalBrowserReady",
        )
        missing = [key for key in required if not evidence.get(key, False)]
        return {
            "decision": "CLAIM_VERIFIED" if not missing else "HOLD_FINAL_READY_INCOMPLETE",
            "missing": missing,
        }

    if claim == "USER_VISIBLE_BOOT_RESILIENT":
        if evidence.get("actualUserVisibleFailure", False):
            return {
                "decision": "REJECTED_BY_USER_OBSERVATION",
                "missing": [],
            }
        required = (
            "immutableSubjectBound",
            "artifactIdentityBound",
            "shellBeforePayload",
            "responseHeldBeforePayload",
            "paintedShellObserved",
            "boundedVisibilityAssertion",
            "truncatedResponseVisibleError",
            "runtimeFailureVisibleRecovery",
            "finalBrowserReady",
        )
        missing = [key for key in required if not evidence.get(key, False)]
        return {
            "decision": "CLAIM_VERIFIED" if not missing else "HOLD_VISIBLE_BOOT_INCOMPLETE",
            "missing": missing,
        }

    if claim == "USER_DEVICE_FIXED":
        return {
            "decision": (
                "USER_DEVICE_VERIFIED"
                if evidence.get("userDeviceRetested", False)
                else "UNKNOWN_USER_DEVICE_NOT_RETESTED"
            ),
            "missing": [] if evidence.get("userDeviceRetested", False) else ["userDeviceRetested"],
        }

    if claim == "ORIGINAL_ROOT_CAUSE_CONFIRMED":
        return {
            "decision": (
                "ROOT_CAUSE_CONFIRMED"
                if evidence.get("originalClientCauseConfirmed", False)
                else "UNKNOWN_ORIGINAL_ROOT_CAUSE"
            ),
            "missing": []
            if evidence.get("originalClientCauseConfirmed", False)
            else ["originalClientCauseConfirmed"],
        }

    raise ValueError(f"unknown claim: {claim}")


def main():
    fixture = json.loads((ROOT / "visible_boot_fixture_n33.json").read_text())
    results = []
    for case in fixture["cases"]:
        actual = evaluate(case)
        passed = actual["decision"] == case["expectedDecision"]
        results.append(
            {
                "id": case["id"],
                "claim": case["claim"],
                "expectedDecision": case["expectedDecision"],
                "actualDecision": actual["decision"],
                "missing": actual["missing"],
                "passed": passed,
            }
        )

    output = {
        "schema": "kaopu.learning-probe/1.0",
        "round": "N33",
        "question": "Can final-ready success prove a large single-file page is visibly alive before its payload completes?",
        "passed": sum(item["passed"] for item in results),
        "total": len(results),
        "allPassed": all(item["passed"] for item in results),
        "results": results,
        "status": "Candidate historical replay verified",
        "limits": {
            "productionGateInstalled": False,
            "userDeviceRetested": False,
            "originalClientCauseConfirmed": False,
            "globalR2Changed": False,
        },
    }
    (ROOT / "visible_boot_result_n33.json").write_text(
        json.dumps(output, ensure_ascii=False, indent=2) + "\n"
    )
    print(json.dumps({"passed": output["passed"], "total": output["total"], "allPassed": output["allPassed"]}))
    if not output["allPassed"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
