#!/usr/bin/env python3
"""Apply only the runtime-safe Candidate A implementation payload.

The candidate workflow itself is written through the GitHub connector because the Actions
GITHUB_TOKEN cannot modify workflow files. This helper is deliberately idempotent and only
writes the Python wrapper, machine contract, and browser semantic mapping.
"""

from __future__ import annotations

from apply_candidate_a_runtime_safe_fix import QA, TEST, WRAPPER, WRAPPER_CONTENT, replace_once


def main() -> None:
    WRAPPER.write_text(WRAPPER_CONTENT, encoding="utf-8")

    test = TEST.read_text(encoding="utf-8")
    if "source-rig-byte-preserved" not in test:
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
    if "qa.regionAnnotations" not in qa:
        qa = replace_once(qa, parse_old, parse_new, "QA semantic annotation call")

    old_gate = "      rigPropagationMachineGatesPassed:receipt.gates.restSkinIdentityPassed===true&&receipt.gates.restJointPropagationPassed===true&&receipt.gates.animationTranslationPropagationPassed===true,\n"
    new_gate = "      rigPreservationMachineGatesPassed:receipt.gates.sourceNodeHierarchyRetained===true&&receipt.gates.sourceSkinTableRetained===true&&receipt.gates.sourceInverseBindMatricesRetained===true&&receipt.gates.sourceAnimationTableRetained===true&&receipt.gates.sourceAnimationAccessorsRetained===true,\n"
    if "rigPreservationMachineGatesPassed" not in qa:
        qa = replace_once(qa, old_gate, new_gate, "QA rig preservation gate")
    QA.write_text(qa, encoding="utf-8")

    print(f"wrote {WRAPPER}")
    print(f"patched {TEST}")
    print(f"patched {QA}")


if __name__ == "__main__":
    main()
