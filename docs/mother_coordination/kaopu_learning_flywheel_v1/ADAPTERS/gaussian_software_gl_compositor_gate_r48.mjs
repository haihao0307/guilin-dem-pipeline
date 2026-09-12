const finite = (x) => Number.isFinite(x);

export function validateSoftwareGlCompositor(report, options = {}) {
  const errors = [];
  const warnings = [];
  const maxFixtureCodeDelta = options.maxFixtureCodeDelta ?? 2;

  if (report?.schema !== 'kaopu-gaussian-software-gl-compositor-probe/r48') errors.push('schema-mismatch');
  if (report?.source?.threeRevision !== '148ef33ecb6d2502ff796d4554abd1549c95d519') errors.push('three-r186-source-not-locked');
  if (report?.source?.r47Commit !== '9c6a86f9c3b1eb1ec463dc096947424c5072477e') errors.push('r47-parent-not-locked');
  if (!String(report?.backend?.renderer).toLowerCase().includes('llvmpipe')) errors.push('software-backend-identity-missing');

  const fixture = report?.fixture;
  if (fixture?.framebuffer !== 'RGBA8') errors.push('framebuffer-format-mismatch');
  if (fixture?.dither !== false || fixture?.srgb !== false || fixture?.toneMapping !== false) errors.push('output-state-not-linear-raw');
  if (!String(fixture?.blend).includes('SRC_ALPHA')) errors.push('blend-state-missing');

  for (const name of ['reference', 'candidate']) {
    const continuous = report?.[name]?.glVsContinuousCpu;
    const quantized = report?.[name]?.glVsPerDrawUnorm8Cpu;
    if (![continuous?.maxAbs, continuous?.rmse, quantized?.maxCodeDifference].every(finite)) errors.push(`${name}-metrics-missing`);
    if (quantized?.maxCodeDifference > maxFixtureCodeDelta) errors.push(`${name}-fixture-code-regression`);
  }

  if (report?.checks?.oneCodeBackendEquivalenceIsRejected !== true) errors.push('one-code-counterexample-missing');
  if (report?.checks?.backendStillShowsMaterialCombinedDifference !== true) errors.push('combined-difference-check-failed');

  if (report?.limits?.directThreeTsl !== true) warnings.push('direct-three-tsl-missing');
  if (report?.limits?.hardwareGpu !== true) warnings.push('hardware-gpu-missing');
  if (report?.limits?.browserOrTargetDevice !== true) warnings.push('browser-target-device-missing');
  if (report?.limits?.realPhotoOrLearnedAsset !== true) warnings.push('real-photo-learned-asset-missing');
  if (report?.limits?.humanAcceptance !== true) warnings.push('human-acceptance-missing');

  return {
    status: errors.length === 0 ? 'Candidate-pass' : 'Candidate-fail',
    errors,
    warnings,
    interpretation: 'Software llvmpipe RGBA8 regression only. The two-code tolerance is fixture-specific and is not a visual, hardware-GPU, browser, device or asset threshold.'
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  console.log(JSON.stringify(validateSoftwareGlCompositor(JSON.parse(Buffer.concat(chunks).toString('utf8'))), null, 2));
}
