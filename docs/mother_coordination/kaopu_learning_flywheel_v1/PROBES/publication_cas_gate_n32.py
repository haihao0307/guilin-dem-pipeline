#!/usr/bin/env python3
import copy
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
FIXTURE = json.loads((HERE / "publication_cas_fixture_n32.json").read_text())


def identity(subject):
    if not subject:
        return None
    return tuple(subject.get(k) for k in ("version", "sourceBuildSha", "htmlSha256"))


def gate(receipt):
    base = {
        "candidateTechnical": "UNKNOWN",
        "publicationDecision": "HOLD",
        "serializationCoverage": receipt.get("serializationCoverage", "UNKNOWN")
    }
    if receipt.get("targetKey") != FIXTURE["targetKey"]:
        return base | {"reason": "HOLD_TARGET_KEY_MISMATCH"}
    if not receipt.get("localGatesPassed"):
        return base | {"reason": "HOLD_LOCAL_GATES_INCOMPLETE"}

    base["candidateTechnical"] = "VERIFIED_LOCAL_CANDIDATE"
    expected = receipt.get("casExpectedSubject")
    at_check = receipt.get("observedSubjectAtCheck")
    at_mutation = receipt.get("observedSubjectAtMutation")
    if not expected or not at_mutation:
        return base | {"reason": "HOLD_MUTATION_PRECONDITION_MISSING"}

    if receipt.get("conflictPolicy") == "pull-rebase-retry" and not receipt.get("revalidateAfterRebase"):
        return base | {"reason": "HOLD_REBASE_WITHOUT_TARGET_REVALIDATION"}

    if identity(expected) != identity(at_mutation):
        return base | {"reason": "HOLD_CONCURRENT_TARGET_ADVANCED"}

    required = set(receipt.get("requiredIntegratedSubjects", []))
    included = set(receipt.get("candidateIncludesSubjects", []))
    reruns = set(receipt.get("testsRerun", []))
    required_tests = set(receipt.get("requiredTests", []))
    if not required.issubset(included) or not required_tests.issubset(reruns):
        return base | {"reason": "HOLD_MERGE_COVERAGE_INCOMPLETE"}

    if at_check and identity(at_check) != identity(at_mutation) and not receipt.get("revalidatedAtMutation"):
        return base | {"reason": "HOLD_TIME_OF_CHECK_TO_USE"}

    return base | {
        "publicationDecision": "PUBLICATION_CAS_ALLOWED",
        "reason": "CAS_PRECONDITION_MATCHED"
    }


def receipt(expected, observed_check, observed_mutation, candidate, **overrides):
    r = {
        "targetKey": FIXTURE["targetKey"],
        "candidateSubject": candidate,
        "localGatesPassed": True,
        "casExpectedSubject": expected,
        "observedSubjectAtCheck": observed_check,
        "observedSubjectAtMutation": observed_mutation,
        "conflictPolicy": "stop",
        "revalidateAfterRebase": False,
        "revalidatedAtMutation": True,
        "serializationCoverage": "INCOMPLETE",
        "requiredIntegratedSubjects": [],
        "candidateIncludesSubjects": [],
        "requiredTests": [],
        "testsRerun": []
    }
    r.update(overrides)
    return r


def main():
    s = FIXTURE["subjects"]
    cases = []

    def add(name, value, expected):
        actual = gate(value)
        cases.append({
            "name": name,
            "expected": expected,
            "actual": actual,
            "passed": actual == expected
        })

    add(
        "features_r008_first_writer_matches_r007",
        receipt(s["r007"], s["r007"], s["r007"], s["featuresR008"]),
        {
            "candidateTechnical": "VERIFIED_LOCAL_CANDIDATE",
            "publicationDecision": "PUBLICATION_CAS_ALLOWED",
            "serializationCoverage": "INCOMPLETE",
            "reason": "CAS_PRECONDITION_MATCHED"
        }
    )

    add(
        "oral_r008_detects_features_advance",
        receipt(s["r007"], s["r007"], s["featuresR008"], s["oralR008"]),
        {
            "candidateTechnical": "VERIFIED_LOCAL_CANDIDATE",
            "publicationDecision": "HOLD",
            "serializationCoverage": "INCOMPLETE",
            "reason": "HOLD_CONCURRENT_TARGET_ADVANCED"
        }
    )

    whitelist = receipt(s["r007"], s["featuresR008"], s["featuresR008"], s["oralR008"])
    whitelist["headerVersionWasAllowed"] = True
    add(
        "allowed_header_string_is_not_cas",
        whitelist,
        {
            "candidateTechnical": "VERIFIED_LOCAL_CANDIDATE",
            "publicationDecision": "HOLD",
            "serializationCoverage": "INCOMPLETE",
            "reason": "HOLD_CONCURRENT_TARGET_ADVANCED"
        }
    )

    add(
        "target_changes_after_early_check",
        receipt(s["r007"], s["r007"], s["featuresR008"], s["oralR008"], revalidatedAtMutation=False),
        {
            "candidateTechnical": "VERIFIED_LOCAL_CANDIDATE",
            "publicationDecision": "HOLD",
            "serializationCoverage": "INCOMPLETE",
            "reason": "HOLD_CONCURRENT_TARGET_ADVANCED"
        }
    )

    add(
        "automatic_rebase_without_target_revalidation",
        receipt(
            s["r007"], s["r007"], s["featuresR008"], s["oralR008"],
            conflictPolicy="pull-rebase-retry", revalidateAfterRebase=False
        ),
        {
            "candidateTechnical": "VERIFIED_LOCAL_CANDIDATE",
            "publicationDecision": "HOLD",
            "serializationCoverage": "INCOMPLETE",
            "reason": "HOLD_REBASE_WITHOUT_TARGET_REVALIDATION"
        }
    )

    merged = receipt(
        s["featuresR008"], s["featuresR008"], s["featuresR008"], s["mergedR009"],
        serializationCoverage="TARGET_WIDE",
        requiredIntegratedSubjects=[
            s["featuresR008"]["sourceBuildSha"],
            s["oralR008"]["sourceBuildSha"]
        ],
        candidateIncludesSubjects=FIXTURE["lineage"]["mergedR009Includes"],
        requiredTests=["features-regression", "oral-regression", "prior-regressions", "public-regression"],
        testsRerun=FIXTURE["lineage"]["mergedR009Reruns"]
    )
    add(
        "merged_r009_exact_predecessor_and_full_rerun",
        merged,
        {
            "candidateTechnical": "VERIFIED_LOCAL_CANDIDATE",
            "publicationDecision": "PUBLICATION_CAS_ALLOWED",
            "serializationCoverage": "TARGET_WIDE",
            "reason": "CAS_PRECONDITION_MATCHED"
        }
    )

    missing_oral = copy.deepcopy(merged)
    missing_oral["candidateIncludesSubjects"] = [s["featuresR008"]["sourceBuildSha"]]
    add(
        "merged_candidate_omits_oral_subject",
        missing_oral,
        {
            "candidateTechnical": "VERIFIED_LOCAL_CANDIDATE",
            "publicationDecision": "HOLD",
            "serializationCoverage": "TARGET_WIDE",
            "reason": "HOLD_MERGE_COVERAGE_INCOMPLETE"
        }
    )

    same_group_stale = receipt(
        s["r007"], s["r007"], s["featuresR008"], s["oralR008"],
        serializationCoverage="TARGET_WIDE"
    )
    add(
        "same_concurrency_group_does_not_replace_cas",
        same_group_stale,
        {
            "candidateTechnical": "VERIFIED_LOCAL_CANDIDATE",
            "publicationDecision": "HOLD",
            "serializationCoverage": "TARGET_WIDE",
            "reason": "HOLD_CONCURRENT_TARGET_ADVANCED"
        }
    )

    result = {
        "schema": "kaopu.publication-cas-result/1.0",
        "candidateRegression": "SHARED-PUBLICATION-TARGET-CAS-001",
        "passed": sum(c["passed"] for c in cases),
        "total": len(cases),
        "allPassed": all(c["passed"] for c in cases),
        "cases": cases,
        "observedHistory": {
            "featuresR008": "published",
            "oralR008": "local gates passed; publication failed at merge conflict; no overwrite",
            "mergedR009": "both deltas rebuilt, rerun and published"
        },
        "limits": {
            "motherTrial": False,
            "independentVerifier": False,
            "workflowImplemented": False,
            "globalAdoption": False,
            "userAcceptance": False
        }
    }
    (HERE / "publication_cas_result_n32.json").write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + "\n"
    )
    print(json.dumps({"passed": result["passed"], "total": result["total"], "allPassed": result["allPassed"]}))
    raise SystemExit(0 if result["allPassed"] else 1)


if __name__ == "__main__":
    main()
