export function validateCutoffBoundary(report) {
  const errors = [];
  const warnings = [];
  if (report?.schema !== 'kaopu-gaussian-cutoff-boundary-probe/r50') errors.push('schema-mismatch');
  if (report?.source?.threeRevision !== '148ef33ecb6d2502ff796d4554abd1549c95d519') errors.push('three-r186-source-not-locked');
  if (report?.source?.r49Commit !== '2987fe98d2d5d32e915959ae250c7fca2982d8c8') errors.push('r49-parent-not-locked');
  if (!String(report?.backend?.renderer).toLowerCase().includes('llvmpipe')) errors.push('software-backend-identity-missing');
  if (report?.fixture?.target !== 'RGBA32F texture framebuffer') errors.push('target-mismatch');
  if (report?.fixture?.caseCount !== 4644) errors.push('case-count-mismatch');
  if (report?.summary?.float32PredicateMismatchCount !== 0) errors.push('float32-backend-coverage-mismatch');
  if (!(report?.summary?.doublePredicateMismatchCount > 0)) errors.push('double-counterexample-missing');
  if (report?.summary?.exactTwiceScaleCasesCovered !== report?.summary?.exactTwiceScaleCaseCount) errors.push('exact-cutoff-not-included');

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
    interpretation: 'Hard-cutoff edge regression for one independent llvmpipe float shader. The observed excess is not a universal guard-band width or Three.js/device acceptance threshold.'
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  console.log(JSON.stringify(validateCutoffBoundary(JSON.parse(Buffer.concat(chunks).toString('utf8'))), null, 2));
}
