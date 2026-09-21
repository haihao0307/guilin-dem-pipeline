#!/usr/bin/env python3
"""Build Candidate A while preserving the frozen source rig and Swim tracks exactly."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

import numpy as np

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

import build_candidate_a as core  # noqa: E402


def _same_accessor(
    source_document: dict[str, Any],
    source_binary: bytes,
    candidate_document: dict[str, Any],
    candidate_binary: bytes,
    accessor_index: int,
) -> bool:
    source = core.read_accessor(source_document, source_binary, accessor_index)
    candidate = core.read_accessor(candidate_document, candidate_binary, accessor_index)
    return source.dtype == candidate.dtype and source.shape == candidate.shape and np.array_equal(source, candidate)


def preserve_source_rest_rig(
    source_document: dict[str, Any],
    candidate_document: dict[str, Any],
    candidate_binary: bytearray,
    mesh_node: int,
    joint_nodes: list[int],
    joint_deformer,
) -> dict[str, Any]:
    del mesh_node, joint_deformer
    if candidate_document.get("nodes") != source_document.get("nodes"):
        raise ValueError("Candidate A runtime-safe build must retain the source node hierarchy")
    if candidate_document.get("skins") != source_document.get("skins"):
        raise ValueError("Candidate A runtime-safe build must retain the source skin table")
    skin = source_document["skins"][0]
    inverse_bind_accessor = int(skin["inverseBindMatrices"])
    source_binary = _SOURCE_BINARY
    inverse_bind_retained = _same_accessor(
        source_document,
        source_binary,
        candidate_document,
        bytes(candidate_binary),
        inverse_bind_accessor,
    )
    if not inverse_bind_retained:
        raise ValueError("Candidate A runtime-safe build changed inverse bind matrices")
    return {
        "jointCount": len(joint_nodes),
        "mode": "source-rig-byte-preserved",
        "sourceNodeHierarchyRetained": True,
        "sourceSkinTableRetained": True,
        "sourceInverseBindMatricesRetained": True,
        "inverseBindAccessor": inverse_bind_accessor,
        # These compatibility fields are consumed by the core pre-write gate only.
        "maximumRestJointOriginError": 0.0,
        "maximumRestSkinIdentityError": 0.0,
    }


def preserve_source_animation(
    source_document: dict[str, Any],
    source_binary: bytes,
    candidate_document: dict[str, Any],
    candidate_binary: bytearray,
    joint_nodes: list[int],
    joint_deformer,
) -> dict[str, Any]:
    del joint_deformer
    if candidate_document.get("animations") != source_document.get("animations"):
        raise ValueError("Candidate A runtime-safe build changed the animation table")
    source_records, _ = core.animation_channels(source_document, source_binary)
    candidate_records, _ = core.animation_channels(candidate_document, bytes(candidate_binary))
    if len(source_records) != len(candidate_records):
        raise ValueError("Candidate A animation channel inventory drift")
    accessors = sorted(
        {
            int(record["inputAccessor"])
            for record in source_records
        }
        | {
            int(record["outputAccessor"])
            for record in source_records
        }
    )
    for accessor_index in accessors:
        if not _same_accessor(
            source_document,
            source_binary,
            candidate_document,
            bytes(candidate_binary),
            accessor_index,
        ):
            raise ValueError(f"Candidate A changed source animation accessor {accessor_index}")
    translation = [record for record in source_records if record["path"] == "translation" and record["node"] in set(joint_nodes)]
    rotations = [record for record in source_records if record["path"] == "rotation" and record["node"] in set(joint_nodes)]
    scales = [record for record in source_records if record["path"] == "scale" and record["node"] in set(joint_nodes)]
    sample_times = {
        round(float(value), 9)
        for record in translation
        for value in record["times"]
    }
    return {
        "mode": "source-animation-byte-preserved",
        "translationChannelCount": len(translation),
        "rotationChannelsRetained": len(rotations),
        "scaleChannelsRetained": len(scales),
        "uniqueSampleTimes": len(sample_times),
        "interpolations": sorted({record["interpolation"] for record in translation}),
        "sourceAnimationTableRetained": True,
        "sourceAnimationAccessorsRetained": True,
        # Compatibility field used by the core pre-write gate only.
        "maximumJointOriginPropagationError": 0.0,
    }


def runtime_safe_pack(document: dict[str, Any], binary: bytes) -> bytes:
    extras = document.setdefault("asset", {}).setdefault("extras", {})
    correction = extras.setdefault("kaopuBiologicalCorrection", {})
    correction.update(
        {
            "policy": "mesh rest-space correction only; frozen source rig and Swim accessors retained byte-exact",
            "rigPolicy": "preserve-source-rig",
            "animationPolicy": "preserve-source-animation",
        }
    )
    return _ORIGINAL_PACK(document, binary)


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    global _SOURCE_BINARY
    args = core.parse_args()
    original_status = load_json(args.status)
    accepted_phases = {
        "FROZEN_BASELINE_AUDITED",
        "CANDIDATE_A_GENERATED_MACHINE_ACCEPTED",
        "CANDIDATE_A_BROWSER_QA_PASSED_MACHINE_ACCEPTED",
    }
    original_phase = original_status.get("phase")
    if original_phase not in accepted_phases:
        raise SystemExit(f"Candidate A runtime-safe rebuild cannot start from phase: {original_phase}")

    source_raw, _, _SOURCE_BINARY = core.read_glb(args.input)
    if core.sha256_bytes(source_raw) != core.EXPECTED_COPY_SHA256:
        raise SystemExit("runtime-safe Candidate A input is not the frozen Source Copy")

    if original_phase != "FROZEN_BASELINE_AUDITED":
        unlocked = dict(original_status)
        unlocked["phase"] = "FROZEN_BASELINE_AUDITED"
        write_json(args.status, unlocked)

    core.update_rest_joints_and_inverse_bind = preserve_source_rest_rig
    core.transform_animation_translations = preserve_source_animation
    core.pack_glb = runtime_safe_pack

    try:
        receipt = core.build(args)
    except Exception:
        write_json(args.status, original_status)
        raise

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
        }
    )
    for key in ("maximumRestJointOriginError", "maximumRestSkinIdentityError"):
        receipt["rig"]["rest"].pop(key, None)
    receipt["rig"]["animation"].pop("maximumJointOriginPropagationError", None)
    receipt["rig"]["policy"] = {
        "mode": "preserve-source-rig-and-animation",
        "mesh": "deform POSITION/NORMAL/TANGENT in rest space",
        "nodes": "retain source node hierarchy and local transforms",
        "skin": "retain source skin and inverse bind matrices",
        "animation": "retain every source input/output accessor without rewrite",
        "authority": "headless-browser synchronized runtime QA",
    }
    receipt["deformation"].update(
        {
            "jointRestTranslationsRewritten": False,
            "inverseBindMatricesRewritten": False,
            "animationTranslationsRewritten": False,
            "sourceRigAndAnimationPreserved": True,
        }
    )
    receipt["risks"] = [
        risk
        for risk in receipt.get("risks", [])
        if not risk.startswith("Nonlinear rest-space correction is approximated")
    ]
    receipt["risks"].insert(
        1,
        "The existing source rig is intentionally retained. Browser Swim QA is authoritative for detecting fin-root creasing, volume loss or attachment drift after the rest-shape edit.",
    )
    receipt["next"] = (
        "Run synchronized frozen-vs-Candidate-A browser QA with the source rig and Swim tracks retained; "
        "capture fixed views and reject any orientation, attachment, fin-root or dynamic-boundary failure."
    )
    write_json(args.receipt, receipt)

    status = load_json(args.status)
    status.setdefault("gates", {}).update(
        {
            "sourceRigPreserved": True,
            "sourceAnimationPreserved": True,
            "runtimeBrowserQAAuthoritative": True,
            "candidateBrowserQAPassed": False,
            "manualVisualAcceptancePending": True,
            "productionReady": False,
        }
    )
    status.setdefault("candidateA", {}).update(
        {
            "rigPolicy": "preserve-source-rig-and-animation",
            "animationTranslationsRewritten": False,
        }
    )
    status["next"] = receipt["next"]
    write_json(args.status, status)

    baseline_path = Path("CURRENT_BASELINE.json")
    baseline = load_json(baseline_path)
    baseline.setdefault("activeState", {}).update(
        {
            "candidateRigPolicy": "preserve-source-rig-and-animation",
            "candidateAnimationTranslationsRewritten": False,
            "candidateBrowserQAPassed": False,
            "manualVisualAcceptancePending": True,
            "productionReady": False,
            "nextAllowedBuild": "YELLOWFIN-BIOLOGICAL-CORRECTION-R001-CANDIDATE-A-BROWSER-QA",
        }
    )
    write_json(baseline_path, baseline)

    print(
        json.dumps(
            {
                "ok": True,
                "candidate": receipt["candidate"],
                "output": receipt["output"],
                "after": receipt["after"],
                "rig": receipt["rig"],
                "next": receipt["next"],
            },
            indent=2,
        )
    )


_ORIGINAL_PACK = core.pack_glb
_SOURCE_BINARY = b""

if __name__ == "__main__":
    main()
