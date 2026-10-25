"""N192 replay: a measured value is not a passed performance claim without a budget.

The production report is read-only evidence. This probe classifies claim scope;
it does not change Road Mother code or invent a device-independent threshold.
"""

import json
import pathlib
import sys


def classify(report, budget=None, claim_environment=None):
    metrics = [
        {
            "name": row["name"],
            "medianMs": row["performance"]["medianMs"],
            "maxMs": row["performance"]["maxMs"],
            "method": row["performance"]["method"],
        }
        for row in report.get("tests", [])
        if row.get("performance")
    ]
    runtime_ok = bool(report.get("passed")) and not report.get("errors")
    observed_environment = (
        "physical_device"
        if report.get("physicalDeviceTested")
        else "software_renderer"
    )

    result = {
        "runtimeFunctional": (
            "CLAIM_VERIFIED" if runtime_ok else "HOLD_RUNTIME_FAILED"
        ),
        "performanceMetricCount": len(metrics),
        "observedEnvironment": observed_environment,
        "performanceClaim": "HOLD_PERFORMANCE_BUDGET_MISSING",
        "metrics": metrics,
    }

    if not metrics:
        result["performanceClaim"] = "HOLD_PERFORMANCE_MEASUREMENT_MISSING"
    elif budget is not None:
        if claim_environment != observed_environment:
            result["performanceClaim"] = "HOLD_MEASUREMENT_ENVIRONMENT_MISMATCH"
        elif budget.get("method") != metrics[0]["method"]:
            result["performanceClaim"] = "HOLD_METRIC_METHOD_MISMATCH"
        else:
            limit = budget["medianMsMax"]
            result["performanceClaim"] = (
                "CLAIM_VERIFIED"
                if all(row["medianMs"] <= limit for row in metrics)
                else "HOLD_PERFORMANCE_BUDGET_EXCEEDED"
            )
            result["budget"] = budget
    return result


report_path = pathlib.Path(sys.argv[1])
report = json.loads(report_path.read_text())
actual = classify(report)

method = actual["metrics"][0]["method"]
fixtures = [
    {
        "name": "actual_report_no_budget",
        "result": actual["performanceClaim"],
        "expected": "HOLD_PERFORMANCE_BUDGET_MISSING",
    },
    {
        "name": "software_budget_pass",
        "result": classify(
            report,
            {"method": method, "medianMsMax": 4000},
            "software_renderer",
        )["performanceClaim"],
        "expected": "CLAIM_VERIFIED",
    },
    {
        "name": "software_budget_fail",
        "result": classify(
            report,
            {"method": method, "medianMsMax": 1000},
            "software_renderer",
        )["performanceClaim"],
        "expected": "HOLD_PERFORMANCE_BUDGET_EXCEEDED",
    },
    {
        "name": "software_evidence_cannot_verify_physical_device",
        "result": classify(
            report,
            {"method": method, "medianMsMax": 4000},
            "physical_device",
        )["performanceClaim"],
        "expected": "HOLD_MEASUREMENT_ENVIRONMENT_MISMATCH",
    },
    {
        "name": "different_metric_method_cannot_reuse_budget",
        "result": classify(
            report,
            {"method": "Long Animation Frame duration", "medianMsMax": 50},
            "software_renderer",
        )["performanceClaim"],
        "expected": "HOLD_METRIC_METHOD_MISMATCH",
    },
]

for fixture in fixtures:
    assert fixture["result"] == fixture["expected"], fixture

medians = [row["medianMs"] for row in actual["metrics"]]
output = {
    "schemaVersion": "n192-v1",
    "subject": {
        "mainCommit": "23a5efbe517d6e629c2104c3411d428c9a65b3c6",
        "workflowRun": 40153232777,
        "artifactId": 12583322837,
        "report": "artifact:public/report.json",
    },
    "productionObservation": {
        "reportPassed": report.get("passed"),
        "physicalDeviceTested": report.get("physicalDeviceTested"),
        "scope": report.get("scope"),
        "performanceMetricCount": len(actual["metrics"]),
        "medianMsMin": min(medians),
        "medianMsMax": max(medians),
        "budgetPresent": False,
    },
    "claimClassification": actual,
    "historyReplay": fixtures,
    "historyReplayPassed": all(
        fixture["result"] == fixture["expected"] for fixture in fixtures
    ),
    "decision": {
        "RUNTIME_FUNCTIONAL": actual["runtimeFunctional"],
        "SOFTWARE_RENDERER_PERFORMANCE": actual["performanceClaim"],
        "PHYSICAL_DEVICE_PERFORMANCE": "HOLD_PHYSICAL_DEVICE_NOT_TESTED",
        "overall": "HOLD_PERFORMANCE_ACCEPTANCE_UNSCOPED",
    },
    "regressionReuse": "CI-GREEN-SKIPPED-CLAIM-001 / N26 claim-scope logic",
}

print(json.dumps(output, ensure_ascii=False, indent=2, sort_keys=True))

