const finite = (x) => Number.isFinite(x);

export function validateReferenceCompositor(report, options = {}) {
  const errors = [];
  const warnings = [];
  const maxRgbTolerance = options.maxRgbTolerance;
  const maxAlphaTolerance = options.maxAlphaTolerance;

  if (report?.schema !== 'kaopu-gaussian-reference-compositor-probe/r47') errors.push('schema-mismatch');
  if (report?.sources?.threeRevision !== '148ef33ecb6d2502ff796d4554abd1549c95d519') errors.push('three-r186-source-not-locked');
  if (report?.sources?.spzRevision !== 'affd0ecea7fbb4c265ee119475af7ee5b2997482') errors.push('spz-source-not-locked');

  const fixture = report?.fixture;
  if (!Array.isArray(fixture?.imagePixels) || fixture.imagePixels.length !== 2) errors.push('viewport-missing');
  if (!Array.isArray(fixture?.exactBackToFront)) errors.push('reference-order-missing');
  if (!Array.isArray(fixture?.sameBinInputOrder)) errors.push('viewer-order-missing');

  for (const name of ['dcOnly', 'orderOnly', 'ellipseOnly', 'combined']) {
    const m = report?.ablations?.[name];
    if (![m?.maxRgbAbs, m?.rgbRmse, m?.maxAlphaAbs].every(finite)) errors.push(`ablation-${name}-metrics-missing`);
  }

  const combined = report?.ablations?.combined;
  if (finite(maxRgbTolerance) && combined?.maxRgbAbs > maxRgbTolerance) errors.push('combined-rgb-tolerance-exceeded');
  if (finite(maxAlphaTolerance) && combined?.maxAlphaAbs > maxAlphaTolerance) errors.push('combined-alpha-tolerance-exceeded');

  if (report?.checks?.componentErrorsAreNonAdditive !== true) errors.push('interaction-check-failed');
  if (report?.checks?.kernelPreservesContinuousMassProxyForIsotropicFixture !== true) errors.push('kernel-proxy-check-failed');
  if (report?.checks?.capCanEraseDisplayedAxisDifference !== true) errors.push('cap-mask-check-failed');

  if (report?.limits?.directTslOrGpuRasterization !== true) warnings.push('direct-tsl-gpu-rasterization-missing');
  if (report?.limits?.browserOrTargetDevice !== true) warnings.push('browser-target-device-missing');
  if (report?.limits?.realPhotoOrLearnedAsset !== true) warnings.push('real-photo-learned-asset-missing');
  if (report?.limits?.humanAcceptance !== true) warnings.push('human-acceptance-missing');

  return {
    status: errors.length === 0 ? 'Candidate-pass' : 'Candidate-fail',
    errors,
    warnings,
    metrics: combined ?? null,
    interpretation: 'CPU linear-channel compositor gate only; passing does not imply GPU, device, perceptual, physical, or Mother acceptance.'
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const report = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  console.log(JSON.stringify(validateReferenceCompositor(report), null, 2));
}
