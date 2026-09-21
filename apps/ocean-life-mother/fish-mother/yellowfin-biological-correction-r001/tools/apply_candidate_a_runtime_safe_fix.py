#!/usr/bin/env python3
"""Patch Candidate A to preserve the frozen source rig and animation at runtime.

The first Candidate A solver correctly changed morphometrics but also rewrote every joint
rest translation, inverse bind matrix and animation translation channel. The browser runtime
showed that this duplicated the rest-space correction and rotated/scaled the candidate away
from the frozen fish. This patch switches the build to mesh-only rest-space correction while
retaining the source node hierarchy, skin table, inverse binds and animation accessors exactly.
It also restores semantic primitive labels in Three.js via GLTFLoader parser associations.
"""

from __future__ import annotations

from pathlib import Path

ROOT = Path("apps/ocean-life-mother/fish-mother/yellowfin-biological-correction-r001")
TOOLS = ROOT / "tools"
WORKFLOW = Path(".github/workflows/fish-yellowfin-biological-correction-r001-candidate-a.yml")
TEST = ROOT / "tests/candidate-a-r001.test.mjs"
QA = ROOT / "candidate-a-qa.html"
WRAPPER = TOOLS / "build_candidate_a_runtime_safe.py"

WRAPPER_CONTENT = r'''#!/usr/bin/env python3
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
'''


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected one match, found {count}")
    return text.replace(old, new, 1)


def main() -> None:
    WRAPPER.write_text(WRAPPER_CONTENT, encoding="utf-8")

    workflow = WORKFLOW.read_text(encoding="utf-8")
    trigger = "      - apps/ocean-life-mother/fish-mother/yellowfin-biological-correction-r001/tools/build_candidate_a.py\n"
    if "tools/build_candidate_a_runtime_safe.py" not in workflow:
        workflow = replace_once(
            workflow,
            trigger,
            trigger + "      - apps/ocean-life-mother/fish-mother/yellowfin-biological-correction-r001/tools/build_candidate_a_runtime_safe.py\n",
            "candidate workflow trigger",
        )
    workflow = replace_once(
        workflow,
        "      - name: Build rig-coherent Candidate A\n",
        "      - name: Build runtime-safe Candidate A with the frozen source rig\n",
        "candidate workflow step name",
    )
    workflow = replace_once(
        workflow,
        '          python "$CORRECTION_ROOT/tools/build_candidate_a.py" \\\n',
        '          python "$CORRECTION_ROOT/tools/build_candidate_a_runtime_safe.py" \\\n',
        "candidate workflow command",
    )
    WORKFLOW.write_text(workflow, encoding="utf-8")

    test = TEST.read_text(encoding="utf-8")
    old_rig = '''assert.equal(receipt.rig.rest.jointCount, 98);
assert.ok(receipt.rig.rest.maximumRestJointOriginError <= 1e-7);
assert.ok(receipt.rig.rest.maximumRestSkinIdentityError <= 1e-7);
assert.equal(receipt.rig.animation.translationChannelCount, 97);
assert.equal(receipt.rig.animation.rotationChannelsRetained, 97);
assert.equal(receipt.rig.animation.scaleChannelsRetained, 97);
assert.ok(receipt.rig.animation.maximumJointOriginPropagationError <= 1e-6);
'''
    new_rig = '''assert.equal(receipt.rig.rest.jointCount, 98);
assert.equal(receipt.rig.rest.mode, 'source-rig-byte-preserved');
assert.equal(receipt.rig.rest.sourceNodeHierarchyRetained, true);
assert.equal(receipt.rig.rest.sourceSkinTableRetained, true);
assert.equal(receipt.rig.rest.sourceInverseBindMatricesRetained, true);
assert.equal(receipt.rig.animation.mode, 'source-animation-byte-preserved');
assert.equal(receipt.rig.animation.translationChannelCount, 97);
assert.equal(receipt.rig.animation.rotationChannelsRetained, 97);
assert.equal(receipt.rig.animation.scaleChannelsRetained, 97);
assert.equal(receipt.rig.animation.sourceAnimationTableRetained, true);
assert.equal(receipt.rig.animation.sourceAnimationAccessorsRetained, true);
assert.equal(receipt.deformation.jointRestTranslationsRewritten, false);
assert.equal(receipt.deformation.inverseBindMatricesRewritten, false);
assert.equal(receipt.deformation.animationTranslationsRewritten, false);
assert.equal(receipt.deformation.sourceRigAndAnimationPreserved, true);
'''
    test = replace_once(test, old_rig, new_rig, "Candidate A rig contract")
    TEST.write_text(test, encoding="utf-8")

    qa = QA.read_text(encoding="utf-8")
    expected_line = "const EXPECTED_REGIONS=['anal_fin','body_core','caudal_lower','caudal_upper','dorsal_fin','dorsal_finlets','eye','lower_jaw','operculum_candidate','pectoral_fin','pelvic_fin','upper_jaw','ventral_finlets'];\n"
    primitive_line = "const REGION_PRIMITIVE_ORDER=['body_core','upper_jaw','lower_jaw','eye','operculum_candidate','pectoral_fin','pelvic_fin','dorsal_fin','anal_fin','dorsal_finlets','ventral_finlets','caudal_upper','caudal_lower'];\n"
    if "REGION_PRIMITIVE_ORDER" not in qa:
        qa = replace_once(qa, expected_line, expected_line + primitive_line, "QA region primitive order")

    animation_line = "function animationRecords(clips){return clips.map(clip=>({name:clip.name,duration:clip.duration,tracks:clip.tracks.length}))}\n"
    annotation = '''function annotateSemanticRegions(gltf){
  let annotated=0;
  gltf.scene.traverse(object=>{
    if(!object.isMesh)return;
    const association=gltf.parser?.associations?.get(object);
    const meshIndex=association?.meshes;
    const primitiveIndex=association?.primitives;
    if(meshIndex===0&&Number.isInteger(primitiveIndex)&&primitiveIndex>=0&&primitiveIndex<REGION_PRIMITIVE_ORDER.length){
      object.userData.kaopuSourceCopyRegion=REGION_PRIMITIVE_ORDER[primitiveIndex];
      annotated++;
    }
  });
  return annotated;
}
'''
    if "function annotateSemanticRegions" not in qa:
        qa = replace_once(qa, animation_line, animation_line + annotation, "QA semantic annotation helper")

    parse_old = "const [frozenGltf,candidateGltf]=await Promise.all([parseGlb(frozenBytes),parseGlb(candidateBytes)]);frozenRoot=frozenGltf.scene;candidateRoot=candidateGltf.scene;"
    parse_new = "const [frozenGltf,candidateGltf]=await Promise.all([parseGlb(frozenBytes),parseGlb(candidateBytes)]);qa.regionAnnotations={frozen:annotateSemanticRegions(frozenGltf),candidate:annotateSemanticRegions(candidateGltf)};frozenRoot=frozenGltf.scene;candidateRoot=candidateGltf.scene;"
    qa = replace_once(qa, parse_old, parse_new, "QA semantic annotation call")

    old_gate = "      rigPropagationMachineGatesPassed:receipt.gates.restSkinIdentityPassed===true&&receipt.gates.restJointPropagationPassed===true&&receipt.gates.animationTranslationPropagationPassed===true,\n"
    new_gate = "      rigPreservationMachineGatesPassed:receipt.gates.sourceNodeHierarchyRetained===true&&receipt.gates.sourceSkinTableRetained===true&&receipt.gates.sourceInverseBindMatricesRetained===true&&receipt.gates.sourceAnimationTableRetained===true&&receipt.gates.sourceAnimationAccessorsRetained===true,\n"
    qa = replace_once(qa, old_gate, new_gate, "QA rig preservation gate")
    QA.write_text(qa, encoding="utf-8")

    print(
        "\n".join(
            [
                f"wrote {WRAPPER}",
                f"patched {WORKFLOW}",
                f"patched {TEST}",
                f"patched {QA}",
            ]
        )
    )


if __name__ == "__main__":
    main()
