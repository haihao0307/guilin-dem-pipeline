const finite = (value) => Number.isFinite(value);

export function validateFloatTarget(report, options = {}) {
  const errors = [];
  const warnings = [];
  const maxFloatRegression = options.maxFloatRegression ?? 1e-5;

  if (report?.schema !== 'kaopu-gaussian-float-target-probe/r49') errors.push('schema-mismatch');
  if (report?.source?.threeRevision !== '148ef33ecb6d2502ff796d4554abd1549c95d519') errors.push('three-r186-source-not-locked');
  if (report?.source?.r48Commit !== '7e7b3897f9e05b310bd6eec1771caeb2e84b8a2f') errors.push('r48-parent-not-locked');
  if (!String(report?.backend?.renderer).toLowerCase().includes('llvmpipe')) errors.push('software-backend-identity-missing');

  const fixture = report?.fixture;
  if (fixture?.floatTarget !== 'RGBA32F texture framebuffer') errors.push('float-target-mismatch');
  if (fixture?.finalTarget !== 'RGBA8 EGL pbuffer') errors.push('final-target-mismatch');
  if (fixture?.dither !== false || fixture?.srgb !== false || fixture?.toneMapping !== false) errors.push('output-state-not-linear-raw');

  for (const name of ['reference', 'candidate']) {
    const floatMetric = report?.[name]?.rgba32fVsContinuousCpu;
    const rgba8Metric = report?.[name]?.rgba8VsRgba32f;
    if (![floatMetric?.maxAbs, floatMetric?.rmse, rgba8Metric?.maxAbs, rgba8Metric?.rmse].every(finite)) errors.push(`${name}-metrics-missing`);
    if (floatMetric?.maxAbs > maxFloatRegression) errors.push(`${name}-float-regression`);
    if (!Array.isArray(report?.[name]?.coverageMismatchPixels) || report[name].coverageMismatchPixels.length !== 0) errors.push(`${name}-coverage-mismatch`);
  }

  if (report?.checks?.rgba8AddsMoreErrorThanFloatArithmetic !== true) errors.push('target-separation-check-failed');
  if (report?.checks?.materialCombinedDifferencePersistsInFloatTarget !== true) errors.push('combined-difference-check-failed');

  if (report?.limits?.directThreeTsl !== true) warnings.push('direct-three-tsl-missing');
  if (report?.limits?.webglOrWebgpu !== true) warnings.push('webgl-webgpu-missing');
  if (report?.limits?.hardwareGpu !== true) warnings.push('hardware-gpu-missing');
  if (report?.limits?.browserOrTargetDevice !== true) warnings.push('browser-target-device-missing');
  if (report?.limits?.realPhotoOrLearnedAsset !== true) warnings.push('real-photo-learned-asset-missing');
  if (report?.limits?.humanAcceptance !== true) warnings.push('human-acceptance-missing');

  return {
    status: errors.length === 0 ? 'Candidate-pass' : 'Candidate-fail',
    errors,
    warnings,
    interpretation: 'Fixed llvmpipe float-target regression only; agreement does not establish Three.js TSL, WebGL/WebGPU, hardware, device, asset or perceptual equivalence.'
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  console.log(JSON.stringify(validateFloatTarget(JSON.parse(Buffer.concat(chunks).toString('utf8'))), null, 2));
}
