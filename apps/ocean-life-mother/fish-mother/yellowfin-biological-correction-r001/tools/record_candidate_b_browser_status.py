#!/usr/bin/env python3
"""Record Candidate B browser QA without claiming manual or production approval."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

PHASE = "CANDIDATE_B_BROWSER_QA_PASSED_MACHINE_ACCEPTED"
BASELINE_PHASE = "YELLOWFIN_BIOLOGICAL_CORRECTION_R001_CANDIDATE_B_BROWSER_QA_PASSED"
NEXT = (
    "Review Candidate B screenshots manually for Yellowfin silhouette, complete first-dorsal assembly, true second dorsal component 1, "
    "eye/cornea attachment, pectoral and anal roots, and Swim deformation. Keep productionReady false until explicit visual approval."
)


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def require_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise SystemExit(f"Missing required environment variable: {name}")
    return value


def main() -> None:
    root = Path(require_env("CORRECTION_ROOT"))
    evidence_dir = Path(require_env("QA_CANDIDATE_OUT"))
    browser_path = evidence_dir / "CANDIDATE_B_BROWSER_QA_RECEIPT.json"
    machine_path = root / "CANDIDATE_B_RECEIPT.json"
    status_path = root / "CURRENT_STATUS.json"
    baseline_path = Path("CURRENT_BASELINE.json")

    browser = load_json(browser_path)
    machine = load_json(machine_path)
    status = load_json(status_path)
    baseline = load_json(baseline_path)

    if browser.get("passed") is not True:
        raise SystemExit("Candidate B browser QA receipt did not pass")
    if browser.get("candidateSha256") != machine.get("output", {}).get("sha256"):
        raise SystemExit("Browser QA is not bound to the machine-accepted Candidate B SHA")
    if browser.get("frozenSha256") != machine.get("frozenInput", {}).get("sha256"):
        raise SystemExit("Browser QA is not bound to the frozen Source Copy SHA")
    if browser.get("consoleErrors") != [] or browser.get("pageErrors") != []:
        raise SystemExit("Candidate B browser QA contains console or page errors")
    if browser.get("failedChecks") != []:
        raise SystemExit(f"Candidate B browser QA failed checks: {browser.get('failedChecks')}")
    if len(browser.get("screenshots", [])) < 15:
        raise SystemExit("Candidate B browser QA did not capture the required fixed-view evidence")
    if machine.get("gates", {}).get("candidateMachineAcceptancePassed") is not True:
        raise SystemExit("Candidate B machine acceptance is not closed")
    if machine.get("gates", {}).get("dorsalAnatomicalSurfaceGroupsResolved") is not True:
        raise SystemExit("Candidate B dorsal anatomical surface groups are unresolved")
    if machine.get("gates", {}).get("trueSecondDorsalComponentSelected") is not True:
        raise SystemExit("Candidate B true second dorsal component is unresolved")
    if machine.get("gates", {}).get("firstDorsalRearSheetsPreservedFromIndependentElongation") is not True:
        raise SystemExit("Candidate B first-dorsal rear panels were independently elongated")

    status["phase"] = PHASE
    status.setdefault("gates", {}).update(
        {
            "sourceCopyFrozen": True,
            "sourceCopyImmutable": True,
            "evidenceContractWritten": True,
            "morphometricBaselineAudited": True,
            "forkLengthInferenceValid": True,
            "skinInfluenceAuditPassed": True,
            "animationChannelAuditPassed": True,
            "correctionCandidateGenerated": True,
            "candidateMachineAcceptancePassed": True,
            "candidateBrowserQAPassed": True,
            "candidateFixedViewsCaptured": True,
            "candidateSwimSamplesCaptured": True,
            "candidateConsoleZeroErrors": True,
            "candidatePageErrorsZero": True,
            "manualVisualAcceptancePending": True,
            "productionReady": False,
        }
    )
    candidate = status.setdefault("candidateB", {})
    candidate.update(
        {
            "sha256": browser["candidateSha256"],
            "browserWorkbench": "candidate-b-qa.html",
            "browserReceipt": "evidence/candidate-b-browser/CANDIDATE_B_BROWSER_QA_RECEIPT.json",
            "browserPassed": True,
            "screenshots": len(browser["screenshots"]),
            "swimSamples": len(browser.get("samples", [])),
            "minimumSampledSpanRatio": browser.get("minimumSampledSpanRatio"),
            "maximumSampledSpanRatio": browser.get("maximumSampledSpanRatio"),
            "maximumSampledCenterDelta": browser.get("maximumSampledCenterDelta"),
            "maximumCandidateBoneMagnitude": browser.get("maximumCandidateBoneMagnitude"),
            "manualVisualAcceptancePending": True,
            "productionReady": False,
        }
    )
    status["next"] = NEXT
    write_json(status_path, status)

    active = baseline.setdefault("activeState", {})
    if active.get("biologicalCorrectionCandidateSha256") != browser["candidateSha256"]:
        raise SystemExit("CURRENT_BASELINE is not bound to the browser-tested Candidate B SHA")
    active.update(
        {
            "phase": BASELINE_PHASE,
            "workBranch": "work/ocean-life-fish-mother-yellowfin-biological-correction-r001-20260921",
            "frozenSourceCopySha256": browser["frozenSha256"],
            "frozenSourceCopyImmutable": True,
            "biologicalCorrectionCandidateSha256": browser["candidateSha256"],
            "candidateMachineAcceptancePassed": True,
            "candidateBrowserQAPassed": True,
            "candidateBrowserWorkbench": "apps/ocean-life-mother/fish-mother/yellowfin-biological-correction-r001/candidate-b-qa.html",
            "candidateBrowserReceipt": "apps/ocean-life-mother/fish-mother/yellowfin-biological-correction-r001/evidence/candidate-b-browser/CANDIDATE_B_BROWSER_QA_RECEIPT.json",
            "candidateFixedViewsCaptured": True,
            "candidateSwimSamplesCaptured": True,
            "candidateConsoleZeroErrors": True,
            "candidatePageErrorsZero": True,
            "manualVisualAcceptancePending": True,
            "productionReady": False,
            "nextAllowedBuild": "YELLOWFIN-BIOLOGICAL-CORRECTION-R001-CANDIDATE-B-MANUAL-VISUAL-ACCEPTANCE",
        }
    )
    write_json(baseline_path, baseline)

    print(
        json.dumps(
            {
                "ok": True,
                "phase": PHASE,
                "candidateSha256": browser["candidateSha256"],
                "screenshots": len(browser["screenshots"]),
                "swimSamples": len(browser.get("samples", [])),
                "consoleErrors": len(browser.get("consoleErrors", [])),
                "pageErrors": len(browser.get("pageErrors", [])),
                "manualVisualAcceptancePending": True,
                "productionReady": False,
                "next": NEXT,
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
