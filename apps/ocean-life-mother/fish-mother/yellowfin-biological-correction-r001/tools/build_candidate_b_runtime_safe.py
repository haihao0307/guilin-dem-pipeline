#!/usr/bin/env python3
"""Build Candidate B from the immutable frozen Source Copy.

Candidate A reached its numeric targets but failed manual visual review because disconnected
first-dorsal rear panels [2,4] were misidentified as the second dorsal and enlarged into an
extra rectangular sail. Candidate B preserves both anterior paired groups as the complete
first-dorsal assembly and selects the caudal sickle-shaped component [1] as the true second
dorsal. Mesh rest positions are corrected while the frozen source node hierarchy, skin,
inverse bind matrices and all Swim accessors remain byte-exact.
"""

from __future__ import annotations

import copy
import json
import sys
import types
from pathlib import Path
from typing import Any

import numpy as np

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

import build_candidate_a_runtime_safe as runtime_safe  # noqa: E402

CANDIDATE_A_SHA = "7653c63f2a5fda43a3217178257e9bfe10c446ac4445b54f2585ff8456d1fdee"
CANDIDATE_B_NAME = "YELLOWFIN-BIOLOGICAL-CORRECTION-R001-CANDIDATE-B"


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one match, found {count}")
    return text.replace(old, new, 1)


def load_candidate_b_core() -> types.ModuleType:
    path = SCRIPT_DIR / "build_candidate_a.py"
    source = path.read_text(encoding="utf-8")
    source = replace_once(
        source,
        'CANDIDATE_NAME = "YELLOWFIN-BIOLOGICAL-CORRECTION-R001-CANDIDATE-A"',
        f'CANDIDATE_NAME = "{CANDIDATE_B_NAME}"',
        "candidate name",
    )
    source = replace_once(
        source,
        'if len(dorsal_groups) < 3 or len(dorsal_groups[0]) != 2 or len(dorsal_groups[1]) != 2:',
        'if len(dorsal_groups) < 3 or len(dorsal_groups[0]) != 2 or len(dorsal_groups[-1]) < 1:',
        "measure dorsal group guard",
    )
    source = replace_once(
        source,
        'second_dorsal_group = dorsal_groups[1]',
        'second_dorsal_group = dorsal_groups[-1]',
        "measure true second dorsal selection",
    )
    source = replace_once(
        source,
        'second_dorsal_surfaces = dorsal_surface_groups[1]',
        'second_dorsal_surfaces = dorsal_surface_groups[-1]',
        "build true second dorsal selection",
    )
    source = replace_once(
        source,
        'if len(first_dorsal_surfaces) != 2 or len(second_dorsal_surfaces) != 2:',
        'if len(first_dorsal_surfaces) != 2 or len(second_dorsal_surfaces) < 1:',
        "build dorsal group guard",
    )
    source = replace_once(
        source,
        'and after["secondDorsalSurfaceCount"] == 2',
        'and after["secondDorsalSurfaceCount"] >= 1',
        "machine gate second dorsal surface count",
    )
    source = replace_once(
        source,
        '"secondDorsalMirroredSheetsDeformedTogether": True,',
        '"secondDorsalMirroredSheetsDeformedTogether": len(second_dorsal_surfaces) == 2,\n            "secondDorsalSingleWatertightStructureSelected": len(second_dorsal_surfaces) == 1,\n            "firstDorsalRearPanelsIndependentlyElongated": False,',
        "candidate deformation identity",
    )

    module = types.ModuleType("yellowfin_candidate_b_core")
    module.__file__ = str(path)
    module.__package__ = ""
    exec(compile(source, str(path), "exec"), module.__dict__)
    return module


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def true_frozen_measurement(core: types.ModuleType, args, baseline: dict[str, Any]) -> dict[str, Any]:
    _, document, binary = core.read_glb(args.input)
    primitives, region_faces, region_vertices = core.extract_regions(document, binary)
    mesh_node = int(baseline["frame"]["meshNode"])
    mesh_world = core.world_matrix(document["nodes"], core.parent_map(document["nodes"]), mesh_node)
    position_accessor = int(primitives["body_core"]["attributes"]["POSITION"])
    positions = core.transform_points(
        core.read_accessor(document, binary, position_accessor).astype(np.float64),
        mesh_world,
    )
    return core.measure_candidate(
        positions,
        region_faces,
        region_vertices,
        core.build_edge_members(region_faces),
        int(baseline["frame"]["forkInference"]["forkVertex"]),
        float(baseline["morphometrics"]["peduncleUFromTailOverTotalExtent"]),
    )


def selected_ids(receipt: dict[str, Any], key: str) -> list[int]:
    return sorted(int(item["component"]) for item in receipt["componentSelection"][key])


def main() -> None:
    core = load_candidate_b_core()
    args = core.parse_args()
    original_status = load_json(args.status)
    baseline_state_path = Path("CURRENT_BASELINE.json")
    original_baseline_state = load_json(baseline_state_path)
    correction_baseline = load_json(args.baseline)

    accepted_phases = {
        "CANDIDATE_A_BROWSER_QA_PASSED_MACHINE_ACCEPTED",
        "CANDIDATE_A_BROWSER_QA_PASSED_MANUAL_VISUAL_REJECTED",
        "CANDIDATE_B_GENERATED_MACHINE_ACCEPTED",
        "CANDIDATE_B_BROWSER_QA_PASSED_MACHINE_ACCEPTED",
    }
    if original_status.get("phase") not in accepted_phases:
        raise SystemExit(f"Candidate B cannot start from phase: {original_status.get('phase')}")
    if original_status.get("candidateA", {}).get("sha256") != CANDIDATE_A_SHA:
        raise SystemExit("Candidate B requires the reviewed Candidate A predecessor")
    if original_status.get("candidateA", {}).get("browserPassed") is not True:
        raise SystemExit("Candidate A browser machine QA must pass before manual visual rejection")

    source_raw, _, source_binary = core.read_glb(args.input)
    if core.sha256_bytes(source_raw) != core.EXPECTED_COPY_SHA256:
        raise SystemExit("Candidate B input is not the frozen Source Copy")

    unlocked = copy.deepcopy(original_status)
    unlocked["phase"] = "FROZEN_BASELINE_AUDITED"
    write_json(args.status, unlocked)

    runtime_safe.core = core
    runtime_safe._ORIGINAL_PACK = core.pack_glb
    runtime_safe._SOURCE_BINARY = source_binary
    core.update_rest_joints_and_inverse_bind = runtime_safe.preserve_source_rest_rig
    core.transform_animation_translations = runtime_safe.preserve_source_animation
    core.pack_glb = runtime_safe.runtime_safe_pack

    try:
        receipt = core.build(args)
        true_before = true_frozen_measurement(core, args, correction_baseline)
    except Exception:
        write_json(args.status, original_status)
        write_json(baseline_state_path, original_baseline_state)
        raise

    true_second_ids = selected_ids(receipt, "secondDorsalSurfaces")
    first_dorsal_ids = selected_ids(receipt, "firstDorsalSurfaces")
    group_ids = [
        sorted(int(value) for value in group["componentIds"])
        for group in receipt["componentSelection"]["dorsalAnatomicalGroups"]
    ]
    if true_second_ids != [1]:
        raise RuntimeError(f"Candidate B selected the wrong second dorsal: {true_second_ids}")
    if first_dorsal_ids != [0, 3]:
        raise RuntimeError(f"Candidate B first-dorsal front sheets drifted: {first_dorsal_ids}")
    if [2, 4] not in group_ids:
        raise RuntimeError(f"Candidate B cannot locate preserved first-dorsal rear sheets: {group_ids}")

    keys = [
        "maximumBodyDepthOverForkLength",
        "maximumBodyDepthU",
        "maximumBodyWidthOverForkLength",
        "maximumBodyWidthU",
        "semanticHeadLengthOverForkLength",
        "pectoralLengthOverForkLength",
        "secondDorsalHeightOverForkLength",
        "analHeightOverForkLength",
        "caudalVerticalSpanOverForkLength",
        "peduncleDepthOverForkLength",
        "peduncleWidthOverForkLength",
        "deepestBodyNearFirstDorsalBase",
        "firstDorsalBaseURange",
    ]
    receipt["before"] = {key: true_before[key] for key in keys}
    for key in (
        "maximumBodyDepthOverForkLength",
        "semanticHeadLengthOverForkLength",
        "pectoralLengthOverForkLength",
        "secondDorsalHeightOverForkLength",
        "analHeightOverForkLength",
        "caudalVerticalSpanOverForkLength",
        "peduncleDepthOverForkLength",
        "peduncleWidthOverForkLength",
    ):
        receipt["delta"][key] = core.clean_float(float(receipt["after"][key]) - float(receipt["before"][key]))

    gates = receipt.setdefault("gates", {})
    for obsolete in (
        "restSkinIdentityPassed",
        "restJointPropagationPassed",
        "animationTranslationPropagationPassed",
    ):
        gates.pop(obsolete, None)
    gates.update(
        {
            "sourceNodeHierarchyRetained": receipt["rig"]["rest"]["sourceNodeHierarchyRetained"],
            "sourceSkinTableRetained": receipt["rig"]["rest"]["sourceSkinTableRetained"],
            "sourceInverseBindMatricesRetained": receipt["rig"]["rest"]["sourceInverseBindMatricesRetained"],
            "sourceAnimationTableRetained": receipt["rig"]["animation"]["sourceAnimationTableRetained"],
            "sourceAnimationAccessorsRetained": receipt["rig"]["animation"]["sourceAnimationAccessorsRetained"],
            "runtimeBrowserQAAuthoritative": True,
            "candidateAVisualRejected": True,
            "trueSecondDorsalComponentSelected": true_second_ids == [1],
            "firstDorsalFrontSheetsPreserved": first_dorsal_ids == [0, 3],
            "firstDorsalRearSheetsPreservedFromIndependentElongation": [2, 4] in group_ids,
            "candidateBMachineAcceptancePassed": True,
        }
    )
    for key in ("maximumRestJointOriginError", "maximumRestSkinIdentityError"):
        receipt["rig"]["rest"].pop(key, None)
    receipt["rig"]["animation"].pop("maximumJointOriginPropagationError", None)
    receipt["rig"]["policy"] = {
        "mode": "preserve-source-rig-and-animation",
        "mesh": "deform POSITION/NORMAL/TANGENT in frozen rest space",
        "nodes": "retain source hierarchy and local transforms",
        "skin": "retain source skin and inverse bind matrices",
        "animation": "retain every source input/output accessor without rewrite",
        "authority": "synchronized headless-browser runtime QA",
    }
    receipt["deformation"].update(
        {
            "jointRestTranslationsRewritten": False,
            "inverseBindMatricesRewritten": False,
            "animationTranslationsRewritten": False,
            "sourceRigAndAnimationPreserved": True,
            "secondDorsalMirroredSheetsDeformedTogether": False,
            "secondDorsalSingleWatertightStructureSelected": True,
            "firstDorsalRearPanelsIndependentlyElongated": False,
        }
    )
    receipt["predecessorReview"] = {
        "candidate": "YELLOWFIN-BIOLOGICAL-CORRECTION-R001-CANDIDATE-A",
        "sha256": CANDIDATE_A_SHA,
        "machineBrowserQAPassed": True,
        "manualVisualAcceptance": False,
        "failure": "Wrong dorsal identity: components 2 and 4 are rear panels of the first-dorsal assembly, not the true second dorsal. Their 4.722846545 enlargement produced an extra rectangular sail.",
        "evidence": [
            "evidence/candidate-a-browser/candidate-a-corrected-side-rest.png",
            "evidence/candidate-a-browser/candidate-a-overlay-side-rest.png",
            "evidence/candidate-a-browser/candidate-a-corrected-quarter-tmid.png",
        ],
    }
    receipt["componentSelection"]["dorsalIdentityPolicy"] = {
        "firstDorsalFrontSheets": [0, 3],
        "firstDorsalRearSheets": [2, 4],
        "trueSecondDorsal": [1],
        "selectionBasis": "manual fixed-view anatomy review plus caudal-most sickle geometry",
    }
    receipt["risks"] = [
        "Candidate B is machine-accepted but still requires manual visual approval.",
        "The inferred fork landmark remains a machine hypothesis.",
        "The true second dorsal is represented by one watertight connected component rather than two disconnected mirrored sheets; this is a topology fact, not a missing half.",
        "The 0.18 FL second-dorsal and anal targets describe a declared large-adult candidate, not a universal Yellowfin proportion.",
        "The existing source rig is retained; browser Swim QA is authoritative for detecting root creasing or volume loss after the rest-shape edit.",
    ]
    receipt["next"] = (
        "Run Candidate B browser QA with real close-ups of first-dorsal front/rear panels, true second dorsal component 1, pectoral roots, eye/cornea attachment and five synchronized Swim samples."
    )
    write_json(args.receipt, receipt)

    built_status = load_json(args.status)
    built_entry = copy.deepcopy(built_status.get("candidateA", {}))
    status = copy.deepcopy(original_status)
    status["phase"] = "CANDIDATE_B_GENERATED_MACHINE_ACCEPTED"
    status.setdefault("gates", {}).update(
        {
            "candidateAVisualRejected": True,
            "candidateBMachineAcceptancePassed": True,
            "candidateBrowserQAPassed": False,
            "manualVisualAcceptancePending": True,
            "productionReady": False,
            "sourceRigPreserved": True,
            "sourceAnimationPreserved": True,
            "runtimeBrowserQAAuthoritative": True,
        }
    )
    status["candidateA"].update(
        {
            "manualVisualAcceptance": False,
            "manualVisualReview": receipt["predecessorReview"],
            "productionReady": False,
        }
    )
    built_entry.update(
        {
            "manualVisualAcceptancePending": True,
            "productionReady": False,
            "trueSecondDorsalComponents": [1],
            "preservedFirstDorsalComponents": [0, 3, 2, 4],
            "rigPolicy": "preserve-source-rig-and-animation",
            "animationTranslationsRewritten": False,
        }
    )
    status["candidateB"] = built_entry
    status["next"] = receipt["next"]
    write_json(args.status, status)

    baseline_state = copy.deepcopy(original_baseline_state)
    active = baseline_state.setdefault("activeState", {})
    active.update(
        {
            "phase": "YELLOWFIN_BIOLOGICAL_CORRECTION_R001_CANDIDATE_B_MACHINE_ACCEPTED",
            "workBranch": "work/ocean-life-fish-mother-yellowfin-biological-correction-r001-20260921",
            "candidateAVisualRejected": True,
            "candidateAManualVisualAcceptance": False,
            "biologicalCorrectionCandidate": args.output.as_posix(),
            "biologicalCorrectionCandidateReceipt": args.receipt.as_posix(),
            "biologicalCorrectionCandidateSha256": receipt["output"]["sha256"],
            "correctionCandidateGenerated": True,
            "candidateMachineAcceptancePassed": True,
            "candidateBrowserQAPassed": False,
            "manualVisualAcceptancePending": True,
            "productionReady": False,
            "nextAllowedBuild": "YELLOWFIN-BIOLOGICAL-CORRECTION-R001-CANDIDATE-B-BROWSER-QA",
        }
    )
    write_json(baseline_state_path, baseline_state)

    review_path = args.receipt.parent / "CANDIDATE_A_VISUAL_REVIEW.json"
    write_json(
        review_path,
        {
            "schema": "kaopu.fish-mother.yellowfin-biological-correction-manual-visual-review/1.0",
            "date": "2026-09-21",
            **receipt["predecessorReview"],
            "disposition": "REJECTED_RETAIN_AS_EVIDENCE",
            "nextCandidate": CANDIDATE_B_NAME,
            "productionReady": False,
        },
    )

    print(
        json.dumps(
            {
                "ok": True,
                "candidate": receipt["candidate"],
                "output": receipt["output"],
                "before": receipt["before"],
                "after": receipt["after"],
                "secondDorsalComponents": true_second_ids,
                "secondDorsalFactors": receipt["controls"]["secondDorsalFactors"],
                "next": receipt["next"],
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
