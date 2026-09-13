export function validateThreeTslWebgpuR52(report) {
  const errors = [];
  const warnings = [];

  if (report?.schema !== 'kaopu-gaussian-three-tsl-cutoff/r51') errors.push('schema-mismatch');
  if (report?.status !== 'candidate-observation') errors.push('status-not-candidate-observation');
  if (report?.requestedMode !== 'webgpu') errors.push('requested-mode-not-webgpu');
  if (report?.actualBackend !== 'webgpu') errors.push('actual-backend-not-webgpu');
  if (String(report?.threeRevision) !== '186') errors.push('three-r186-not-locked');
  if (report?.identity?.backendClass !== 'WebGPUBackend') errors.push('webgpu-backend-class-missing');
  if (report?.identity?.adapter?.architecture !== 'swiftshader') warnings.push('adapter-architecture-differs-from-r52-ci-lock');

  if (report?.fixture?.caseCount !== 4644) errors.push('case-count-mismatch');
  if (report?.fixture?.ulpStepCountPerDirection !== 129) errors.push('ulp-step-count-mismatch');
  if (report?.fixture?.scaleCount !== 6) errors.push('scale-count-mismatch');
  if (report?.fixture?.directionCount !== 6) errors.push('direction-count-mismatch');
  if (report?.fixture?.tslMaterialCount !== 1) errors.push('single-tsl-material-contract-missing');
  if (report?.fixture?.renderSubmissionCount !== 36) errors.push('render-submission-count-mismatch');
  if (report?.fixture?.readbackCount !== 36) errors.push('readback-count-mismatch');

  if (report?.summary?.float32PredicateMismatchCount !== 0) errors.push('float32-backend-coverage-mismatch');
  if (report?.summary?.doublePredicateMismatchCount !== 32) errors.push('double-counterexample-count-changed');
  if (report?.summary?.doubleOutsideBackendInsideCount !== 32) errors.push('double-outside-backend-inside-count-changed');
  if (report?.summary?.doubleInsideBackendOutsideCount !== 0) errors.push('unexpected-double-inside-backend-outside');
  if (report?.summary?.exactTwiceScaleCasesCovered !== 6 || report?.summary?.exactTwiceScaleCaseCount !== 6) errors.push('exact-cutoff-controls-changed');

  const expectedByDirection = {
    axis: 0,
    shallow: 5,
    'one-one-root2': 6,
    diagonal: 6,
    steep: 8,
    root3: 7,
  };
  for (const [key, expected] of Object.entries(expectedByDirection)) {
    if (report?.summary?.mismatchCountsByDirection?.[key] !== expected) errors.push(`direction-mismatch-${key}`);
  }

  const checks = report?.checks || {};
  for (const key of [
    'allCasesExecuted',
    'fullR50UlpRangeCovered',
    'singleTslMaterialUsed',
    'renderSubmissionBatchCountIsExpected',
    'readbackBatchCountIsExpected',
    'float32ModelMatchesBackendCoverage',
    'doublePredicateHasCoverageCounterexample',
    'exactCutoffIsIncluded',
    'bothSidesOfBoundaryWereSampled',
  ]) {
    if (checks[key] !== true) errors.push(`check-failed-${key}`);
  }

  if (report?.limits?.hardwareGpu !== true) warnings.push('hardware-gpu-missing');
  if (report?.limits?.targetDevice !== true) warnings.push('target-device-missing');
  if (report?.limits?.realPhotoOrLearnedAsset !== true) warnings.push('real-photo-learned-asset-missing');
  if (report?.limits?.humanAcceptance !== true) warnings.push('human-acceptance-missing');
  warnings.push('swiftshader-webgpu-is-not-hardware-webgpu');
  warnings.push('stable-pixel-float-target-color-error-not-covered-by-this-mask-gate');

  return {
    status: errors.length === 0 ? 'Candidate-pass' : 'Candidate-fail',
    errors,
    warnings,
    interpretation: 'Direct Three.js r186 TSL WebGPU hard-cutoff regression for the locked R50-compatible 4,644-case fixture. Passing this gate establishes a confirmed software WebGPU execution path, not hardware-device, asset, Object DNA, Canonical Truth, or human-acceptance authority.'
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  console.log(JSON.stringify(validateThreeTslWebgpuR52(JSON.parse(Buffer.concat(chunks).toString('utf8'))), null, 2));
}
