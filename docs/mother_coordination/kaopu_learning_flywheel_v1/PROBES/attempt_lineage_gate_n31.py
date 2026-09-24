#!/usr/bin/env python3
import copy
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
FIXTURE = json.loads((HERE / "attempt_lineage_fixture_n31.json").read_text())


def gate(receipt):
    expected = FIXTURE["expectedRunIds"]
    authority = {a["runId"]: a for a in FIXTURE["authoritativeAttempts"]}
    ledger = receipt.get("attemptLedger", [])
    ids = [a.get("runId") for a in ledger]
    technical = "UNKNOWN"

    if ids != expected:
        return {"technicalGate": technical, "learningClosure": "HOLD_ATTEMPT_LEDGER_INCOMPLETE"}
    for observed in ledger:
        canonical = authority.get(observed.get("runId"))
        identity = ("jobId", "headSha", "conclusion", "failedGate", "failureSignature")
        if canonical is None or any(observed.get(k) != canonical.get(k) for k in identity):
            return {"technicalGate": technical, "learningClosure": "HOLD_ATTEMPT_RECORD_MUTATED"}

    successes = [a for a in ledger if a["conclusion"] == "success"]
    failures = [a for a in ledger if a["conclusion"] == "failure"]
    if not successes or ledger[-1]["conclusion"] != "success":
        return {"technicalGate": "NOT_VERIFIED", "learningClosure": "ROOT_CAUSE_REVIEW_REQUIRED"}
    technical = "VERIFIED_FINAL_ATTEMPT"

    if len(failures) < FIXTURE["rootCauseThreshold"]:
        return {"technicalGate": technical, "learningClosure": "TERMINAL_SUCCESS_WITH_HISTORY"}

    review = receipt.get("rootCauseReview")
    if not review:
        return {"technicalGate": technical, "learningClosure": "HOLD_ROOT_CAUSE_REVIEW_MISSING"}
    if review.get("triggeredAfterRun") != failures[1]["runId"]:
        return {"technicalGate": technical, "learningClosure": "HOLD_ROOT_CAUSE_TRIGGER_UNBOUND"}

    signatures = {a["failureSignature"] for a in failures}
    if set(review.get("observedFailureSignatures", [])) != signatures:
        return {"technicalGate": technical, "learningClosure": "HOLD_ROOT_CAUSE_SIGNATURE_COVERAGE"}

    actions = review.get("correctiveActions", [])
    covered = {s for action in actions for s in action.get("addresses", [])}
    valid_deltas = {(d["to"], tuple(d["addresses"])) for d in FIXTURE["observedCommitDeltas"]}
    action_deltas = {(a.get("fixSha"), tuple(a.get("addresses", []))) for a in actions}
    if covered != signatures or not action_deltas.issubset(valid_deltas):
        return {"technicalGate": technical, "learningClosure": "HOLD_CORRECTIVE_DELTA_UNBOUND"}

    final = receipt.get("terminalSuccess", {})
    if final.get("runId") != successes[-1]["runId"] or set(final.get("retestsSignatures", [])) != signatures:
        return {"technicalGate": technical, "learningClosure": "HOLD_FINAL_RETEST_COVERAGE"}
    if set(final.get("supersedesRunIds", [])) != {a["runId"] for a in failures}:
        return {"technicalGate": technical, "learningClosure": "HOLD_SUPERSESSION_LINK_INCOMPLETE"}
    return {"technicalGate": technical, "learningClosure": "TERMINAL_SUCCESS_WITH_FAILURE_LINEAGE"}


def complete_receipt():
    return {
        "attemptLedger": copy.deepcopy(FIXTURE["authoritativeAttempts"]),
        "rootCauseReview": {
            "triggeredAfterRun": 35973503878,
            "scope": "R012 browser-harness/runtime-UI contract",
            "observedFailureSignatures": [
                "runtime-ui-state-reference",
                "browser-harness-global-scope"
            ],
            "correctiveActions": [
                {
                    "fixSha": "9d3fb3e453e7ac2d1702233e67a43aa6af97927f",
                    "addresses": ["runtime-ui-state-reference"]
                },
                {
                    "fixSha": "b5f2d11cbf55e17518dda411bf034596818c46d5",
                    "addresses": ["browser-harness-global-scope"]
                }
            ]
        },
        "terminalSuccess": {
            "runId": 35974311593,
            "retestsSignatures": [
                "runtime-ui-state-reference",
                "browser-harness-global-scope"
            ],
            "supersedesRunIds": [35972942265, 35973503878]
        }
    }


def main():
    good = complete_receipt()
    cases = []

    def add(name, receipt, expected):
        actual = gate(receipt)
        passed = actual == expected
        cases.append({"name": name, "expected": expected, "actual": actual, "passed": passed})

    add("real_history_without_machine_readable_review", {
        "attemptLedger": copy.deepcopy(FIXTURE["authoritativeAttempts"]),
        "terminalSuccess": good["terminalSuccess"]
    }, {"technicalGate": "VERIFIED_FINAL_ATTEMPT", "learningClosure": "HOLD_ROOT_CAUSE_REVIEW_MISSING"})

    add("complete_counterfactual_closure", good,
        {"technicalGate": "VERIFIED_FINAL_ATTEMPT", "learningClosure": "TERMINAL_SUCCESS_WITH_FAILURE_LINEAGE"})

    incomplete = copy.deepcopy(good)
    incomplete["attemptLedger"] = incomplete["attemptLedger"][-1:]
    add("terminal_success_only_erases_failures", incomplete,
        {"technicalGate": "UNKNOWN", "learningClosure": "HOLD_ATTEMPT_LEDGER_INCOMPLETE"})

    mutated = copy.deepcopy(good)
    mutated["attemptLedger"][0]["conclusion"] = "success"
    add("past_failure_rewritten_as_success", mutated,
        {"technicalGate": "UNKNOWN", "learningClosure": "HOLD_ATTEMPT_RECORD_MUTATED"})

    missing_success = copy.deepcopy(good)
    missing_success["attemptLedger"][-1]["conclusion"] = "failure"
    missing_success["attemptLedger"][-1]["failedGate"] = "real-offline-3d-browser"
    missing_success["attemptLedger"][-1]["failureSignature"] = "unknown-third-failure"
    add("no_terminal_success", missing_success,
        {"technicalGate": "UNKNOWN", "learningClosure": "HOLD_ATTEMPT_RECORD_MUTATED"})

    partial_review = copy.deepcopy(good)
    partial_review["rootCauseReview"]["observedFailureSignatures"] = ["browser-harness-global-scope"]
    add("review_omits_first_failure_signature", partial_review,
        {"technicalGate": "VERIFIED_FINAL_ATTEMPT", "learningClosure": "HOLD_ROOT_CAUSE_SIGNATURE_COVERAGE"})

    unbound_fix = copy.deepcopy(good)
    unbound_fix["rootCauseReview"]["correctiveActions"][1]["fixSha"] = "deadbeef"
    add("corrective_action_not_bound_to_observed_delta", unbound_fix,
        {"technicalGate": "VERIFIED_FINAL_ATTEMPT", "learningClosure": "HOLD_CORRECTIVE_DELTA_UNBOUND"})

    partial_retest = copy.deepcopy(good)
    partial_retest["terminalSuccess"]["retestsSignatures"] = ["browser-harness-global-scope"]
    add("final_success_does_not_cover_both_failure_signatures", partial_retest,
        {"technicalGate": "VERIFIED_FINAL_ATTEMPT", "learningClosure": "HOLD_FINAL_RETEST_COVERAGE"})

    result = {
        "schema": "kaopu.attempt-lineage-result/1.0",
        "candidateRegression": "SUCCESS-MUST-NOT-ERASE-FAILED-ATTEMPTS-001",
        "passed": sum(c["passed"] for c in cases),
        "total": len(cases),
        "allPassed": all(c["passed"] for c in cases),
        "cases": cases,
        "limits": {
            "motherTrial": False,
            "independentVerifier": False,
            "globalAdoption": False,
            "userAcceptance": False
        }
    }
    (HERE / "attempt_lineage_result_n31.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"passed": result["passed"], "total": result["total"], "allPassed": result["allPassed"]}))
    raise SystemExit(0 if result["allPassed"] else 1)


if __name__ == "__main__":
    main()
