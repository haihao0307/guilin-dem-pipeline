import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const regression = JSON.parse(
  fs.readFileSync(path.join(here, 'CANDIDATE_MECHANICAL_SURFACE_RELATION_NOT_SHAPE_LABEL_001.json'), 'utf8')
);

const EPS = 1e-9;

function classify(input) {
  if (!input.equationBound) return 'HOLD_SURFACE_EQUATION_UNBOUND';
  if (!input.coordinateFrameBound || !input.unitsBound) return 'HOLD_FRAME_OR_UNITS_UNBOUND';
  if (!input.domainBound) return 'HOLD_SURFACE_DOMAIN_UNBOUND';
  if (!input.patchGraphBound) return 'HOLD_PATCH_RELATION_UNBOUND';

  const left = input.leftPolynomial;
  const right = input.rightPolynomial;
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== 3 || right.length !== 3) {
    return 'HOLD_PATCH_RELATION_UNBOUND';
  }

  const positionResidual = Math.abs(left[0] - right[0]);
  const tangentResidual = Math.abs(left[1] - right[1]);
  const curvatureResidual = Math.abs(2 * left[2] - 2 * right[2]);
  if (positionResidual > EPS) return 'REJECT_C0_DISCONTINUITY';
  if (['G1', 'G2'].includes(input.requiredContinuity) && tangentResidual > EPS) {
    return 'REJECT_G1_DISCONTINUITY';
  }
  if (input.requiredContinuity === 'G2' && curvatureResidual > EPS) {
    return 'REJECT_G2_DISCONTINUITY';
  }
  if (input.materialUsedAsGeometryEvidence) return 'REJECT_MATERIAL_SUBSTITUTED_FOR_GEOMETRY';
  if (!Array.isArray(input.referenceResidualSamples) || input.referenceResidualSamples.length === 0) {
    return 'HOLD_REFERENCE_RESIDUAL_UNVERIFIED';
  }
  const maxReferenceResidual = Math.max(...input.referenceResidualSamples.map(Math.abs));
  if (!(Number.isFinite(input.referenceTolerance)) || maxReferenceResidual > input.referenceTolerance) {
    return 'REJECT_REFERENCE_CURVATURE_RESIDUAL';
  }
  if (!input.independentVerifier) return 'HOLD_REFERENCE_RESIDUAL_UNVERIFIED';
  return 'CANDIDATE_SURFACE_RELATION_ELIGIBLE_NOT_REFERENCE_ACCEPTED';
}

const results = regression.cases.map((fixture) => {
  const actual = classify(fixture.input);
  return { id: fixture.id, expect: fixture.expect, actual, passed: actual === fixture.expect };
});
const output = {
  caseId: regression.caseId,
  total: results.length,
  passed: results.filter((result) => result.passed).length,
  allPassed: results.every((result) => result.passed),
  results
};
console.log(JSON.stringify(output, null, 2));
if (!output.allPassed) process.exitCode = 1;
