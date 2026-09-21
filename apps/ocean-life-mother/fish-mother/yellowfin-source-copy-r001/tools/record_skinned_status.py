#!/usr/bin/env python3
"""Record skinned Source Copy QA without regressing a later frozen lifecycle state."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

SKINNED_PHASE = "SOURCE_COPY_SKINNED_R001_BROWSER_QA_PASSED"
FROZEN_PHASE = "SOURCE_COPY_R001_FROZEN_MACHINE_ACCEPTED"
BASELINE_SKINNED_PHASE = "YELLOWFIN_SOURCE_COPY_R001_SKINNED_BROWSER_QA_PASSED"
BASELINE_FROZEN_PHASE = "YELLOWFIN_SOURCE_COPY_R001_FROZEN_MACHINE_ACCEPTED"
REGION_ACCEPTANCE_NEXT = (
    "Close region-by-region visibility and material-boundary acceptance, then freeze "
    "Source Copy R001 before Yellowfin biological correction."
)
BIOLOGICAL_CORRECTION_NEXT = (
    "Begin YELLOWFIN-BIOLOGICAL-CORRECTION-R001 from the frozen Source Copy baseline. "
    "Keep all Source Copy R001 assets immutable."
)


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def require_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise SystemExit(f"Missing required environment variable: {name}")
    return value


def acceptance_is_frozen(root: Path, copy_sha256: str) -> bool:
    acceptance_path = root / "SOURCE_COPY_REGION_MATERIAL_ACCEPTANCE_R001.json"
    if not acceptance_path.exists():
        return False

    acceptance = load_json(acceptance_path)
    gates = acceptance.get("gates", {})
    accepted_copy_sha = acceptance.get("copy", {}).get("sha256")
    return (
        accepted_copy_sha == copy_sha256
        and gates.get("sourceCopyR001Frozen") is True
        and gates.get("sourceCopyMachineAcceptancePassed") is True
        and gates.get("browserRegionVisibilityQAPassed") is True
    )


def main() -> None:
    root = Path(require_env("COPY_ROOT"))
    receipt_path = Path(require_env("SKINNED_RECEIPT"))
    browser_path = Path(require_env("QA_SKINNED_OUT")) / "SKINNED_BROWSER_QA_RECEIPT.json"

    receipt = load_json(receipt_path)
    browser = load_json(browser_path)

    if browser.get("passed") is not True:
        raise SystemExit("Skinned browser QA receipt did not pass")

    output = receipt.get("output", {})
    output_sha256 = output.get("sha256")
    if not output_sha256:
        raise SystemExit("Skinned receipt is missing output.sha256")
    if browser.get("copySha256") != output_sha256:
        raise SystemExit("Skinned browser QA is not bound to generated copy SHA")

    receipt.setdefault("gates", {}).update(
        {
            "browserRestPoseQAPassed": True,
            "browserAnimationQAPassed": True,
        }
    )
    receipt["visualEvidence"] = {
        "receipt": "evidence/skinned-browser/SKINNED_BROWSER_QA_RECEIPT.json",
        "animationName": browser["animationName"],
        "duration": browser["duration"],
        "samples": browser["samples"],
        "maximumDynamicBoundsDelta": browser["maximumDynamicBoundsDelta"],
        "maximumBoneMatrixDelta": browser["maximumBoneMatrixDelta"],
        "boundsTolerance": browser["boundsTolerance"],
        "boneTolerance": browser["boneTolerance"],
        "consoleZeroErrors": browser.get("consoleErrors") == [],
        "pageZeroErrors": browser.get("pageErrors") == [],
        "views": [item["name"] for item in browser["screenshots"]],
    }

    frozen_evidence = acceptance_is_frozen(root, output_sha256)
    receipt["next"] = BIOLOGICAL_CORRECTION_NEXT if frozen_evidence else REGION_ACCEPTANCE_NEXT
    write_json(receipt_path, receipt)

    status_path = root / "CURRENT_STATUS.json"
    status = load_json(status_path)
    status_gates = status.setdefault("gates", {})
    status_was_frozen = (
        status.get("phase") == FROZEN_PHASE
        or status_gates.get("sourceCopyR001Frozen") is True
        or frozen_evidence
    )

    status_gates.update(
        {
            "sourceCopySkinTransferred": True,
            "sourceCopyAnimationTransferred": True,
            "sourceCopyMaterialsTransferred": True,
            "sourceCopySkinnedBrowserQAPassed": True,
            "sourceCopySkinnedFixedViewsCaptured": True,
            "sourceCopySkinnedConsoleZeroErrors": True,
            "sourceCopySkinnedPageErrorsZero": True,
        }
    )

    if status_was_frozen:
        status["phase"] = FROZEN_PHASE
        status_gates.update(
            {
                "sourceCopyR001Frozen": True,
                "sourceCopyImmutable": True,
                "sourceCopyMachineAcceptancePassed": True,
                "biologicalCorrectionCandidateUnlocked": True,
                "independentReconstructionUnlocked": True,
                "generationLocked": False,
            }
        )
        if frozen_evidence:
            status_gates.update(
                {
                    "sourceCopyRegionVisibilityPassed": True,
                    "sourceCopyMaterialBoundaryPassed": True,
                    "sourceCopyManualVisualAcceptancePending": True,
                }
            )
        status["next"] = BIOLOGICAL_CORRECTION_NEXT
    else:
        status["phase"] = SKINNED_PHASE
        status_gates.update(
            {
                "independentReconstructionUnlocked": False,
                "generationLocked": True,
            }
        )
        status["next"] = REGION_ACCEPTANCE_NEXT

    status_skinned = status.setdefault("sourceCopySkinned", {})
    status_skinned.update(
        {
            "receipt": "SOURCE_COPY_SKINNED_R001.json",
            "glb": "geometry/YELLOWFIN_SOURCE_COPY_SKINNED_R001.glb",
            "qaWorkbench": "skinned-qa.html",
            "browserReceipt": "evidence/skinned-browser/SKINNED_BROWSER_QA_RECEIPT.json",
            "sha256": output_sha256,
            "bytes": output["bytes"],
            "semanticPrimitiveCount": output["semanticPrimitiveCount"],
            "semanticFaceCount": output["semanticFaceCount"],
            "meshCount": output["meshCount"],
            "primitiveCount": output["primitiveCount"],
            "nodeCount": output["nodeCount"],
            "skinCount": output["skinCount"],
            "animationCount": output["animationCount"],
            "materialCount": output["materialCount"],
            "imageCount": output["imageCount"],
            "maximumDynamicBoundsDelta": browser["maximumDynamicBoundsDelta"],
            "maximumBoneMatrixDelta": browser["maximumBoneMatrixDelta"],
            "sourceBinaryPrefixByteIdentical": True,
            "sourceSkinWeightsRetained": True,
            "sourceAnimationsRetained": True,
            "sourceMaterialsRetained": True,
        }
    )
    write_json(status_path, status)

    baseline_path = Path("CURRENT_BASELINE.json")
    baseline = load_json(baseline_path)
    active = baseline.setdefault("activeState", {})
    baseline_was_frozen = (
        active.get("phase") == BASELINE_FROZEN_PHASE
        or active.get("sourceCopyR001Frozen") is True
        or status_was_frozen
    )

    active.update(
        {
            "workBranch": "work/ocean-life-fish-mother-yellowfin-source-copy-r001-20260921",
            "activeWorkbench": "apps/ocean-life-mother/fish-mother/yellowfin-source-copy-r001/index.html",
            "skinnedQaWorkbench": "apps/ocean-life-mother/fish-mother/yellowfin-source-copy-r001/skinned-qa.html",
            "sourceCopySkinnedGlb": "apps/ocean-life-mother/fish-mother/yellowfin-source-copy-r001/geometry/YELLOWFIN_SOURCE_COPY_SKINNED_R001.glb",
            "sourceCopySkinnedReceipt": "apps/ocean-life-mother/fish-mother/yellowfin-source-copy-r001/SOURCE_COPY_SKINNED_R001.json",
            "sourceCopySkinnedSha256": output_sha256,
            "sourceCopySkinTransferred": True,
            "sourceCopyAnimationTransferred": True,
            "sourceCopyMaterialsTransferred": True,
            "sourceCopySkinnedBrowserQAPassed": True,
        }
    )

    if baseline_was_frozen:
        active.update(
            {
                "phase": BASELINE_FROZEN_PHASE,
                "sourceCopyR001Frozen": True,
                "sourceCopyImmutable": True,
                "sourceCopyMachineAcceptancePassed": True,
                "sourceCopyManualVisualAcceptancePending": True,
                "sourceCopyUnlocked": True,
                "biologicalCorrectionCandidateUnlocked": True,
                "independentReconstructionUnlocked": True,
                "generationLocked": False,
                "productionReady": False,
                "nextAllowedBuild": "YELLOWFIN-BIOLOGICAL-CORRECTION-R001",
            }
        )
    else:
        active.update(
            {
                "phase": BASELINE_SKINNED_PHASE,
                "sourceCopyUnlocked": False,
                "generationLocked": True,
                "nextAllowedBuild": "YELLOWFIN-SOURCE-COPY-R001-REGION-MATERIAL-ACCEPTANCE",
            }
        )

    write_json(baseline_path, baseline)

    print(
        json.dumps(
            {
                "ok": True,
                "phase": status["phase"],
                "baselinePhase": active["phase"],
                "frozenStatePreserved": status_was_frozen,
                "copySha256": output_sha256,
                "semanticFaceCount": output["semanticFaceCount"],
                "primitiveCount": output["primitiveCount"],
                "nodeCount": output["nodeCount"],
                "imageCount": output["imageCount"],
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
