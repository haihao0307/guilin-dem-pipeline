import fs from 'node:fs';

const regressionCandidates = [
  new URL('../REGRESSION_CASES/CANDIDATE_MECHANICAL_SURFACE_RELATION_NOT_SHAPE_LABEL_001.json', import.meta.url),
  new URL('./CANDIDATE_MECHANICAL_SURFACE_RELATION_NOT_SHAPE_LABEL_001.json', import.meta.url)
];
const regressionPath = regressionCandidates.find((candidate) => fs.existsSync(candidate));
if (!regressionPath) throw new Error('regression fixture not found');
const regression = JSON.parse(fs.readFileSync(regressionPath, 'utf8'));
const EPS = 1e-9;

function postconditionPass(p) {
  if (Object.hasOwn(p, 'expected')) return p.actual === p.expected;
  if (Number.isFinite(p.expectedMin) && !(p.actual >= p.expectedMin)) return false;
  if (Number.isFinite(p.expectedMax) && !(p.actual <= p.expectedMax)) return false;
  return true;
}

function hasBoundRuntimeRoute(input) {
  return Boolean(
    input.authoritativeAuthoringRepresentation &&
    input.runtimeSubjectDigest &&
    input.displayEvaluationRoute &&
    input.displayEvaluationTraceDigest &&
    input.displayRouteIndependentVerifier &&
    typeof input.tessellationInvoked === 'boolean' &&
    typeof input.trianglePrimitivesOrBuffersObserved === 'boolean'
  );
}

function hasBoundWebgpuReceipt(input) {
  return Boolean(
    input.webgpuSpecRevision &&
    input.webgpuCtsRevision &&
    input.webgpuCommandTraceDigest &&
    input.allCommandEncodersObserved === true &&
    Array.isArray(input.pipelineKindsUsed) &&
    Number.isInteger(input.renderDrawCallCount) &&
    Array.isArray(input.renderPrimitiveTopologies) &&
    Number.isInteger(input.computeDispatchCount) &&
    input.canvasFormat &&
    Array.isArray(input.canvasUsageFlags) &&
    Array.isArray(input.deviceFeatureSet) &&
    typeof input.storageTextureWriteObserved === 'boolean'
  );
}

function classify(input) {
  if (!input.equationBound) return 'HOLD_SURFACE_EQUATION_UNBOUND';
  if (!input.coordinateFrameBound || !input.unitsBound) return 'HOLD_FRAME_OR_UNITS_UNBOUND';
  if (!input.domainBound) return 'HOLD_SURFACE_DOMAIN_UNBOUND';
  if (!input.patchGraphBound) return 'HOLD_PATCH_RELATION_UNBOUND';
  const left = input.leftPolynomial;
  const right = input.rightPolynomial;
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== 3 || right.length !== 3) return 'HOLD_PATCH_RELATION_UNBOUND';
  if (Math.abs(left[0] - right[0]) > EPS) return 'REJECT_C0_DISCONTINUITY';
  if (['G1','G2'].includes(input.requiredContinuity) && Math.abs(left[1] - right[1]) > EPS) return 'REJECT_G1_DISCONTINUITY';
  if (input.requiredContinuity === 'G2' && Math.abs(2 * left[2] - 2 * right[2]) > EPS) return 'REJECT_G2_DISCONTINUITY';
  if (input.materialUsedAsGeometryEvidence) return 'REJECT_MATERIAL_SUBSTITUTED_FOR_GEOMETRY';
  if (!Array.isArray(input.referenceResidualSamples) || input.referenceResidualSamples.length === 0) return 'HOLD_REFERENCE_RESIDUAL_UNVERIFIED';
  const maxResidual = Math.max(...input.referenceResidualSamples.map(Math.abs));
  if (!Number.isFinite(input.referenceTolerance) || maxResidual > input.referenceTolerance) return 'REJECT_REFERENCE_CURVATURE_RESIDUAL';
  if (!input.independentVerifier) return 'HOLD_REFERENCE_RESIDUAL_UNVERIFIED';

  if (input.modelingOperationClaimed) {
    if (!input.kernelRevision || !input.kernelStatus || !Array.isArray(input.inputSubjectDigests) || input.inputSubjectDigests.length === 0 || !input.outputSubjectDigest) return 'HOLD_KERNEL_OPERATION_RECEIPT_UNBOUND';
    if (!input.schemaValidation) return 'HOLD_SCHEMA_VALIDATION_MISSING';
    if (input.schemaValidation !== 'PASS') return 'REJECT_SCHEMA_INVALID_BREP';
    if (!input.kernelGeometryValidation) return 'HOLD_KERNEL_GEOMETRY_VALIDATION_MISSING';
    if (input.kernelGeometryValidation !== 'PASS') return 'REJECT_KERNEL_GEOMETRY_INVALID';
    if (!Array.isArray(input.semanticPostconditions) || input.semanticPostconditions.length === 0) return 'HOLD_SEMANTIC_POSTCONDITIONS_MISSING';
    if (!input.semanticPostconditions.every(postconditionPass)) return 'REJECT_OPERATION_SEMANTIC_POSTCONDITION';
  }

  if (input.runtimeDisplayClaim === 'TRIANGLE_FREE') {
    if (!hasBoundRuntimeRoute(input)) return 'HOLD_RUNTIME_EVALUATION_ROUTE_UNBOUND';
    if (input.allRenderPassesCovered !== true) return 'HOLD_RUNTIME_RENDER_PASS_COVERAGE_INCOMPLETE';
    if (input.tessellationInvoked || input.trianglePrimitivesOrBuffersObserved || /MESH|TESSELL/i.test(input.displayEvaluationRoute)) {
      return 'REJECT_EXACT_AUTHORING_MISCLAIMED_AS_TRIANGLE_FREE_RUNTIME';
    }

    if (input.webgpuBackendClaimed) {
      if (!hasBoundWebgpuReceipt(input)) return 'HOLD_WEBGPU_BACKEND_ROUTE_UNBOUND';
      const renderPipelineUsed = input.pipelineKindsUsed.includes('RENDER');
      const triangleTopologyUsed = input.renderPrimitiveTopologies.some(t => /^triangle-(list|strip)$/.test(t));
      if (renderPipelineUsed || input.renderDrawCallCount > 0 || triangleTopologyUsed) {
        return 'REJECT_RENDER_PIPELINE_USED_IN_TRIANGLE_FREE_CLAIM';
      }
      const storageUsageBound = input.canvasUsageFlags.includes('STORAGE_BINDING');
      const bgraStorageAvailable = input.canvasFormat !== 'bgra8unorm' || input.deviceFeatureSet.includes('bgra8unorm-storage');
      if (!storageUsageBound || !bgraStorageAvailable || input.computeDispatchCount < 1 || !input.storageTextureWriteObserved) {
        return 'HOLD_STORAGE_CANVAS_CAPABILITY_UNVERIFIED';
      }
      return 'CANDIDATE_COMPUTE_STORAGE_CANVAS_ROUTE_ELIGIBLE_NOT_PRODUCTION_PROVEN';
    }

    return 'CANDIDATE_TRIANGLE_FREE_RUNTIME_ROUTE_ELIGIBLE_NOT_REFERENCE_ACCEPTED';
  }

  return 'CANDIDATE_SURFACE_RELATION_ELIGIBLE_NOT_REFERENCE_ACCEPTED';
}

const results = regression.cases.map((fixture) => {
  const actual = classify(fixture.input);
  return {id: fixture.id, expect: fixture.expect, actual, passed: actual === fixture.expect};
});
const output = {
  caseId: regression.caseId,
  extension: 'N221_WEBGPU_COMPUTE_STORAGE_CANVAS_BACKEND_ROUTE',
  total: results.length,
  passed: results.filter(r => r.passed).length,
  allPassed: results.every(r => r.passed),
  sourceScope: 'W3C WebGPU specification and official CTS source contract plus synthetic command-receipt replay; no KAOPU browser/device execution.',
  results
};
console.log(JSON.stringify(output, null, 2));
if (!output.allPassed) process.exitCode = 1;
