import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.join(here, 'composite_human_binding_compatibility_fixture_n186.json');
const resultPath = path.join(here, 'composite_human_binding_compatibility_result_n186.json');
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

const requiredManifest = [
  'meshVertexCount', 'skinVertexCount', 'jointCount', 'maxJointIndex',
  'jointOrderDigest', 'inverseBindOrderDigest', 'skeletonParentDigest',
  'bindPoseDigest', 'skinBindPoseDigest', 'motionTargetDigest',
  'skeletonTargetDigest', 'coordinateFrame', 'motionCoordinateFrame'
];

function classify(testCase) {
  if (testCase.componentIdentity !== 'VERIFIED') {
    return {state: 'HOLD_COMPONENT_IDENTITY_UNRESOLVED'};
  }
  const manifest = testCase.bindingManifest || {};
  const missing = requiredManifest.filter(field => manifest[field] === undefined || manifest[field] === null);
  if (missing.length) return {state: 'HOLD_BINDING_MANIFEST_INCOMPLETE', missing};
  if (manifest.meshVertexCount !== manifest.skinVertexCount || manifest.maxJointIndex >= manifest.jointCount || manifest.weightsValid !== true) {
    return {state: 'REJECT_SKIN_INFLUENCE_INVALID'};
  }
  if (manifest.jointOrderDigest !== manifest.inverseBindOrderDigest || manifest.skeletonParentDigest !== manifest.expectedSkeletonParentDigest) {
    return {state: 'REJECT_JOINT_MAP_INCOMPATIBLE'};
  }
  if (manifest.bindPoseDigest !== manifest.skinBindPoseDigest) {
    return {state: 'REJECT_BIND_SPACE_INCOMPATIBLE'};
  }
  if (manifest.motionTargetDigest !== manifest.skeletonTargetDigest || manifest.coordinateFrame !== manifest.motionCoordinateFrame) {
    return {state: 'REJECT_MOTION_TARGET_INCOMPATIBLE'};
  }
  const runtime = testCase.runtimeEvidence || {};
  if (!runtime.actionTraceDigest || !Array.isArray(runtime.fixedActions) || runtime.fixedActions.length < fixture.minimumFixedActions) {
    return {state: 'HOLD_RUNTIME_COUPLING_UNPROVEN'};
  }
  if (!Number.isInteger(runtime.selfCollisionSampleCount) || runtime.selfCollisionSampleCount < fixture.minimumSelfCollisionSamples) {
    return {state: 'HOLD_SELF_PENETRATION_OBSERVATION_MISSING'};
  }
  if (!Number.isFinite(runtime.maxSelfInterpenetrationM) || runtime.maxSelfInterpenetrationM > fixture.maximumSelfInterpenetrationM) {
    return {state: 'REJECT_SELF_PENETRATION', observedM: runtime.maxSelfInterpenetrationM};
  }
  if (runtime.verifierRole !== 'INDEPENDENT_VERIFIER' || runtime.verifierId === runtime.producerId) {
    return {state: 'HOLD_INDEPENDENT_VERIFIER_MISSING'};
  }
  if (!Array.isArray(runtime.negativeControlsRejected) ||
      !fixture.requiredNegativeControls.every(control => runtime.negativeControlsRejected.includes(control))) {
    return {state: 'HOLD_NEGATIVE_CONTROLS_UNPROVEN'};
  }
  return {state: 'COMPOSITE_BINDING_VERIFIED_SCOPED'};
}

const results = fixture.cases.map(testCase => {
  const detail = classify(testCase);
  return {
    name: testCase.name,
    expected: testCase.expect,
    actual: detail.state,
    detail,
    pass: detail.state === testCase.expect
  };
});

const output = {
  schema: 'kaopu/composite-human-binding-compatibility-result@1',
  fixture: path.basename(fixturePath),
  passed: results.filter(result => result.pass).length,
  total: results.length,
  currentProductionEventState: results[0].actual,
  results
};

fs.writeFileSync(resultPath, JSON.stringify(output, null, 2) + '\n');
console.log(`${output.passed}/${output.total} composite binding cases passed`);
if (output.passed !== output.total) process.exitCode = 1;
