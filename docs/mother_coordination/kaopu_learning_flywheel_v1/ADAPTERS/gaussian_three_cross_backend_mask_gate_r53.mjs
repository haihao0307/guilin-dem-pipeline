export function validateCrossBackendMaskR53(report) {
  const errors = [];
  const warnings = [];
  if (report?.schema !== 'kaopu-gaussian-cross-backend-mask-comparison/r53') errors.push('schema-mismatch');
  if (report?.status !== 'Candidate-pass') errors.push('comparison-not-pass');

  const checks = report?.checks || {};
  for (const key of [
    'webglCandidateObservation',
    'webgpuCandidateObservation',
    'actualBackendsAreDistinctAndCorrect',
    'sameThreeRevision',
    'fullCaseCounts',
    'fullGroupCounts',
    'exactInputIdentity',
    'exactBackendCoverageMaskIdentity',
    'bothBackendsMatchFloat32Masks',
    'aggregateBackendMaskHashIdentity',
    'aggregateInputHashIdentity',
    'expectedDoubleCounterexampleCounts',
  ]) {
    if (checks[key] !== true) errors.push(`check-failed-${key}`);
  }

  if (report?.firstDivergence !== null) errors.push('first-divergence-present');
  if (report?.summary?.webglFloat32MismatchCount !== 0) errors.push('webgl-float32-mismatch');
  if (report?.summary?.webgpuFloat32MismatchCount !== 0) errors.push('webgpu-float32-mismatch');
  if (report?.summary?.webglDoubleMismatchCount !== 32) errors.push('webgl-double-counterexample-count-changed');
  if (report?.summary?.webgpuDoubleMismatchCount !== 32) errors.push('webgpu-double-counterexample-count-changed');
  if (report?.summary?.webglAggregateBackendMaskSha256 !== report?.summary?.webgpuAggregateBackendMaskSha256) errors.push('aggregate-backend-mask-hash-differs');
  if (report?.summary?.webglAggregateInputSha256 !== report?.summary?.webgpuAggregateInputSha256) errors.push('aggregate-input-hash-differs');

  warnings.push('software-webgl-webgpu-exactness-is-not-hardware-device-proof');
  warnings.push('coverage-mask-exactness-does-not-measure-stable-pixel-color-error');
  warnings.push('real-photo-learned-asset-and-human-acceptance-remain-unverified');

  return {
    status: errors.length === 0 ? 'Candidate-pass' : 'Candidate-fail',
    errors,
    warnings,
    interpretation: 'Exact per-case direct Three.js r186 WebGL/WebGPU coverage-mask comparison for the locked 4,644 cutoff-neighbor samples under one Chromium toolchain. This gate does not establish hardware, target-device, asset, color-error, Object DNA, Canonical Truth, or human-acceptance authority.'
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  console.log(JSON.stringify(validateCrossBackendMaskR53(JSON.parse(Buffer.concat(chunks).toString('utf8'))), null, 2));
}
