import fs from 'node:fs';

const regression = JSON.parse(fs.readFileSync(new URL('./CANDIDATE_FUNCTION_CLASS_SHARING_NOT_TOTAL_INSTANCE_COLLAPSE_001.json', import.meta.url), 'utf8'));

const norm = v => {
  const m = Math.hypot(...v);
  return v.map(x => x / m);
};
const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
const spread = values => Math.max(...values) - Math.min(...values);
const roundedUnique = values => new Set(values.map(v => v.toFixed(9))).size;

const light = [0, 0, 1];
const rotationDiffuse = Array.from({length: 100}, (_, i) => {
  const a = 2 * Math.PI * i / 100;
  const worldNormal = [Math.sin(a), 0, Math.cos(a)];
  return Math.max(0, dot(worldNormal, light));
});

const pointLight = [0, 0, 5];
const pointLightDiffuse = Array.from({length: 100}, (_, i) => {
  const x = -5 + 10 * i / 99;
  const toLight = norm([pointLight[0] - x, 0, pointLight[2]]);
  return Math.max(0, dot([0, 0, 1], toLight));
});

const canonicalNormal = norm([1, 1, 1]);
const normalIdentity = canonicalNormal;
const normalNonuniform = norm([canonicalNormal[0] / 2, canonicalNormal[1] / 1, canonicalNormal[2] / 0.5]);
const normalDelta = Math.hypot(...normalIdentity.map((x, i) => x - normalNonuniform[i]));

const directionalTranslationDiffuse = Array.from({length: 100}, () => Math.max(0, dot([0, 0, 1], light)));
const visibility = Array.from({length: 100}, (_, i) => i < 50 ? 1 : 0);

const evidence = {
  rotationSweep: {
    instances: 100,
    diffuseMin: Math.min(...rotationDiffuse),
    diffuseMax: Math.max(...rotationDiffuse),
    diffuseSpread: spread(rotationDiffuse),
    roundedUniqueValues: roundedUnique(rotationDiffuse),
    oneSharedFinalValueValid: spread(rotationDiffuse) < 1e-9
  },
  pointLightTranslationSweep: {
    instances: 100,
    diffuseMin: Math.min(...pointLightDiffuse),
    diffuseMax: Math.max(...pointLightDiffuse),
    diffuseSpread: spread(pointLightDiffuse),
    roundedUniqueValues: roundedUnique(pointLightDiffuse),
    oneSharedLightVectorOrDiffuseValid: spread(pointLightDiffuse) < 1e-9
  },
  normalMatrixSweep: {
    canonicalNormal,
    identityWorldNormal: normalIdentity,
    nonuniformScaleWorldNormal: normalNonuniform,
    l2Delta: normalDelta,
    oneSharedWorldNormalValid: normalDelta < 1e-9
  },
  directionalTranslationInvariant: {
    instances: 100,
    diffuseSpread: spread(directionalTranslationDiffuse),
    scopedClaim: "translation-only, same orientation/material/sample, constant directional light, unshadowed view-independent diffuse",
    scopedSharedDiffuseValid: spread(directionalTranslationDiffuse) < 1e-9
  },
  occlusionPartition: {
    instances: 100,
    visibleCount: visibility.reduce((a, b) => a + b, 0),
    occludedCount: visibility.filter(v => v === 0).length,
    oneSharedVisibilityValid: roundedUnique(visibility) === 1
  }
};

const intrinsic = new Set(['functionDefinition', 'coefficients', 'canonicalDomain', 'canonicalSamples', 'canonicalDerivatives']);
const instanceDependent = new Set(['worldToObjectQuery', 'worldRayHit', 'worldPoint', 'worldNormal', 'lightVector', 'viewVector', 'visibility', 'shadow', 'finalShading']);

function classify(input) {
  if (!input.functionClassId || !input.functionDefinitionDigest || !input.parameterDigest || !input.canonicalDomainDigest) {
    return 'HOLD_FUNCTION_CLASS_IDENTITY_UNBOUND';
  }
  if (!Array.isArray(input.instanceIds) || input.instanceIds.length === 0 || !Array.isArray(input.instanceTransformDigests) || input.instanceTransformDigests.length !== input.instanceIds.length) {
    return 'HOLD_INSTANCE_SET_OR_TRANSFORMS_UNBOUND';
  }
  const shared = Array.isArray(input.sharedQuantities) ? input.sharedQuantities : [];
  if (!input.sharedEvaluationClaim) {
    return 'CANDIDATE_FUNCTION_CLASS_BATCHING_WITH_INSTANCE_EVALUATION_REQUIRED';
  }
  if (!input.equivalenceProof || input.equivalenceProof.verified !== true) {
    return 'HOLD_SHARED_EVALUATION_INVARIANCE_UNPROVEN';
  }
  if (input.totalEvaluationReductionClaim === 'ONE_OVER_N') {
    const hasInstanceWork = shared.some(q => instanceDependent.has(q)) || shared.includes('unshadowedDirectionalDiffuse');
    if (hasInstanceWork) return 'REJECT_FUNCTION_CLASS_IDENTITY_AS_TOTAL_INSTANCE_EVALUATION_COLLAPSE';
  }
  const onlyIntrinsic = shared.length > 0 && shared.every(q => intrinsic.has(q));
  if (onlyIntrinsic) {
    const p = input.equivalenceProof;
    if (p.sameFunctionDefinition && p.sameParameters && p.sameCanonicalSampleArguments) {
      return 'CANDIDATE_FUNCTION_CLASS_SHARING_SCOPED_NOT_GENERAL_1_OVER_N_PROVEN';
    }
    return 'REJECT_INSTANCE_DEPENDENT_RESULT_REUSED_ACROSS_NON_EQUIVALENT_INSTANCES';
  }
  if (shared.includes('unshadowedDirectionalDiffuse')) {
    const p = input.equivalenceProof;
    if (p.sameNormalTransform && p.sameLightVector && p.lightModel === 'DIRECTIONAL_CONSTANT' && p.viewIndependent && p.visibilityExcluded && p.shadowExcluded && p.sameMaterial) {
      return 'CANDIDATE_FUNCTION_CLASS_SHARING_SCOPED_NOT_GENERAL_1_OVER_N_PROVEN';
    }
  }
  if (shared.some(q => instanceDependent.has(q))) {
    return 'REJECT_INSTANCE_DEPENDENT_RESULT_REUSED_ACROSS_NON_EQUIVALENT_INSTANCES';
  }
  return 'HOLD_SHARED_EVALUATION_INVARIANCE_UNPROVEN';
}

const results = regression.cases.map(fixture => {
  const actual = classify(fixture.input);
  const evidenceOk = !fixture.syntheticEvidence || (() => {
    const e = evidence[fixture.syntheticEvidence];
    if (fixture.syntheticEvidence === 'rotationSweep') return e.diffuseSpread > 0.9 && !e.oneSharedFinalValueValid;
    if (fixture.syntheticEvidence === 'pointLightTranslationSweep') return e.diffuseSpread > 0.25 && !e.oneSharedLightVectorOrDiffuseValid;
    if (fixture.syntheticEvidence === 'normalMatrixSweep') return e.l2Delta > 0.4 && !e.oneSharedWorldNormalValid;
    if (fixture.syntheticEvidence === 'directionalTranslationInvariant') return e.scopedSharedDiffuseValid;
    if (fixture.syntheticEvidence === 'occlusionPartition') return e.visibleCount === 50 && e.occludedCount === 50 && !e.oneSharedVisibilityValid;
    return false;
  })();
  return {id: fixture.id, expect: fixture.expect, actual, evidenceOk, passed: actual === fixture.expect && evidenceOk};
});

const output = {
  caseId: regression.caseId,
  extension: 'N222_FUNCTION_CLASS_SHARING_INSTANCE_DEPENDENCE',
  total: results.length,
  passed: results.filter(r => r.passed).length,
  allPassed: results.every(r => r.passed),
  evidence,
  results,
  boundary: 'Synthetic analytic replay only; no production renderer, browser, GPU timing, image-quality or user-acceptance run.'
};

console.log(JSON.stringify(output, null, 2));
if (!output.allPassed) process.exitCode = 1;
