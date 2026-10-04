#!/usr/bin/env python3
import copy
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
FIXTURE = json.loads((HERE / "attempt_matrix_fixture_n71.json").read_text())


def job_key(job):
    return f"{job['cell']}:{job['failureSignature']}"


def gate(receipt):
    expected_runs = FIXTURE["expectedRunIds"]
    authority = {a["runId"]: a for a in FIXTURE["authoritativeAttempts"]}
    attempts = receipt.get("attemptLedger", [])
    if [a.get("runId") for a in attempts] != expected_runs:
        return {"technicalGate": "UNKNOWN", "learningClosure": "HOLD_ATTEMPT_LEDGER_INCOMPLETE"}

    for observed in attempts:
        canonical = authority[observed["runId"]]
        for field in ("headSha", "conclusion", "aggregateJobId"):
            if observed.get(field) != canonical.get(field):
                return {"technicalGate": "UNKNOWN", "learningClosure": "HOLD_ATTEMPT_RECORD_MUTATED"}
        observed_jobs = observed.get("matrixJobs", [])
        canonical_jobs = canonical["matrixJobs"]
        if len(observed_jobs) != len(canonical_jobs):
            return {"technicalGate": "UNKNOWN", "learningClosure": "HOLD_MATRIX_JOB_LEDGER_INCOMPLETE"}
        for got, wanted in zip(observed_jobs, canonical_jobs):
            if got != wanted:
                return {"technicalGate": "UNKNOWN", "learningClosure": "HOLD_MATRIX_JOB_RECORD_MUTATED"}

    final = attempts[-1]
    if final["conclusion"] != "success" or any(j["conclusion"] != "success" for j in final["matrixJobs"]):
        return {"technicalGate": "NOT_VERIFIED", "learningClosure": "ROOT_CAUSE_REVIEW_REQUIRED"}
    technical = "VERIFIED_FINAL_ATTEMPT"

    failures = [a for a in attempts if a["conclusion"] == "failure"]
    if len(failures) < FIXTURE["rootCauseThreshold"]:
        return {"technicalGate": technical, "learningClosure": "TERMINAL_SUCCESS_WITH_HISTORY"}
    review = receipt.get("rootCauseReview")
    if not review:
        return {"technicalGate": technical, "learningClosure": "HOLD_ROOT_CAUSE_REVIEW_MISSING"}
    if review.get("triggeredAfterRun") != failures[1]["runId"]:
        return {"technicalGate": technical, "learningClosure": "HOLD_ROOT_CAUSE_TRIGGER_UNBOUND"}

    failure_keys = {
        job_key(job)
        for attempt in failures
        for job in attempt["matrixJobs"]
        if job["conclusion"] == "failure"
    }
    if set(review.get("observedFailureKeys", [])) != failure_keys:
        return {"technicalGate": technical, "learningClosure": "HOLD_MATRIX_SIGNATURE_COVERAGE"}

    signatures = {key.split(":", 1)[1] for key in failure_keys}
    actions = review.get("correctiveActions", [])
    covered = {s for action in actions for s in action.get("addresses", [])}
    valid = {(d["to"], tuple(d["addresses"])) for d in FIXTURE["observedCommitDeltas"]}
    actual = {(a.get("fixSha"), tuple(a.get("addresses", []))) for a in actions}
    if covered != signatures or actual != valid:
        return {"technicalGate": technical, "learningClosure": "HOLD_CORRECTIVE_DELTA_UNBOUND"}

    success = receipt.get("terminalSuccess", {})
    if success.get("runId") != final["runId"]:
        return {"technicalGate": technical, "learningClosure": "HOLD_FINAL_RETEST_COVERAGE"}
    if set(success.get("retestsFailureKeys", [])) != failure_keys:
        return {"technicalGate": technical, "learningClosure": "HOLD_FINAL_RETEST_COVERAGE"}
    if set(success.get("supersedesRunIds", [])) != {a["runId"] for a in failures}:
        return {"technicalGate": technical, "learningClosure": "HOLD_SUPERSESSION_LINK_INCOMPLETE"}
    return {"technicalGate": technical, "learningClosure": "TERMINAL_SUCCESS_WITH_MATRIX_FAILURE_LINEAGE"}


def complete_receipt():
    failures = FIXTURE["authoritativeAttempts"][:-1]
    keys = sorted({job_key(j) for a in failures for j in a["matrixJobs"] if j["conclusion"] == "failure"})
    return {
        "attemptLedger": copy.deepcopy(FIXTURE["authoritativeAttempts"]),
        "rootCauseReview": {
            "triggeredAfterRun": 37171413749,
            "observedFailureKeys": list(keys),
            "correctiveActions": [
                {"fixSha": d["to"], "addresses": d["addresses"]}
                for d in FIXTURE["observedCommitDeltas"]
            ]
        },
        "terminalSuccess": {
            "runId": 37172690396,
            "retestsFailureKeys": list(keys),
            "supersedesRunIds": [37170827682, 37171413749, 37172382735]
        }
    }


def main():
    good = complete_receipt()
    cases = []

    def add(name, receipt, expected):
        actual = gate(receipt)
        cases.append({"name": name, "expected": expected, "actual": actual, "passed": actual == expected})

    add("real_kuko_history_without_review", {"attemptLedger": copy.deepcopy(FIXTURE["authoritativeAttempts"])},
        {"technicalGate": "VERIFIED_FINAL_ATTEMPT", "learningClosure": "HOLD_ROOT_CAUSE_REVIEW_MISSING"})
    add("complete_counterfactual_matrix_closure", good,
        {"technicalGate": "VERIFIED_FINAL_ATTEMPT", "learningClosure": "TERMINAL_SUCCESS_WITH_MATRIX_FAILURE_LINEAGE"})

    only_final = copy.deepcopy(good)
    only_final["attemptLedger"] = only_final["attemptLedger"][-1:]
    add("terminal_success_erases_attempts", only_final,
        {"technicalGate": "UNKNOWN", "learningClosure": "HOLD_ATTEMPT_LEDGER_INCOMPLETE"})

    missing_job = copy.deepcopy(good)
    missing_job["attemptLedger"][0]["matrixJobs"].pop(5)
    add("parallel_failure_job_omitted", missing_job,
        {"technicalGate": "UNKNOWN", "learningClosure": "HOLD_MATRIX_JOB_LEDGER_INCOMPLETE"})

    mutated_job = copy.deepcopy(good)
    mutated_job["attemptLedger"][0]["matrixJobs"][0]["conclusion"] = "success"
    add("past_matrix_failure_rewritten", mutated_job,
        {"technicalGate": "UNKNOWN", "learningClosure": "HOLD_MATRIX_JOB_RECORD_MUTATED"})

    partial_review = copy.deepcopy(good)
    partial_review["rootCauseReview"]["observedFailureKeys"].remove("public/catalog:fiber-playback-state-static")
    add("review_collapses_one_parallel_cell", partial_review,
        {"technicalGate": "VERIFIED_FINAL_ATTEMPT", "learningClosure": "HOLD_MATRIX_SIGNATURE_COVERAGE"})

    unbound = copy.deepcopy(good)
    unbound["rootCauseReview"]["correctiveActions"][-1]["fixSha"] = "deadbeef"
    add("repair_not_bound_to_observed_delta", unbound,
        {"technicalGate": "VERIFIED_FINAL_ATTEMPT", "learningClosure": "HOLD_CORRECTIVE_DELTA_UNBOUND"})

    partial_retest = copy.deepcopy(good)
    partial_retest["terminalSuccess"]["retestsFailureKeys"].remove("file/catalog:fiber-playback-time-not-advancing")
    add("terminal_success_omits_failed_matrix_cell", partial_retest,
        {"technicalGate": "VERIFIED_FINAL_ATTEMPT", "learningClosure": "HOLD_FINAL_RETEST_COVERAGE"})

    missing_supersession = copy.deepcopy(good)
    missing_supersession["terminalSuccess"]["supersedesRunIds"].remove(37171413749)
    add("terminal_success_omits_failed_run", missing_supersession,
        {"technicalGate": "VERIFIED_FINAL_ATTEMPT", "learningClosure": "HOLD_SUPERSESSION_LINK_INCOMPLETE"})

    result = {
        "schema": "kaopu.attempt-matrix-result/1.0",
        "candidateRegression": "SUCCESS-MUST-NOT-ERASE-FAILED-ATTEMPTS-001",
        "passed": sum(c["passed"] for c in cases),
        "total": len(cases),
        "allPassed": all(c["passed"] for c in cases),
        "cases": cases,
        "limits": {
            "motherImplemented": False,
            "independentVerifier": False,
            "globalAdoption": False,
            "userAcceptance": False
        }
    }
    (HERE / "attempt_matrix_result_n71.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"passed": result["passed"], "total": result["total"], "allPassed": result["allPassed"]}))
    raise SystemExit(0 if result["allPassed"] else 1)


if __name__ == "__main__":
    main()
