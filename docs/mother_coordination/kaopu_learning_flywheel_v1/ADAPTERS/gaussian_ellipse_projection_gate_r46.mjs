export const R46_VIEWER = Object.freeze({
  spzRevision: 'affd0ecea7fbb4c265ee119475af7ee5b2997482',
  threeRevision: '148ef33ecb6d2502ff796d4554abd1549c95d519',
  kernel2D: 0.3,
  eigenRadiusFloor: 1e-7,
  maxScreenScalePixels: 1024,
});

function finite(value, label) {
  if (!Number.isFinite(value)) throw new Error(`${label} must be finite`);
}

function ellipse(base, label) {
  for (const key of ['aBase', 'b', 'cBase']) finite(base[key], `${label}.${key}`);
  if (base.aBase < 0 || base.cBase < 0 || base.aBase * base.cBase - base.b * base.b < -1e-8) {
    throw new Error(`${label} is not a positive-semidefinite projected covariance`);
  }
  const a = base.aBase + R46_VIEWER.kernel2D;
  const c = base.cBase + R46_VIEWER.kernel2D;
  const radius = Math.sqrt(Math.max(((a - c) * 0.5) ** 2 + base.b ** 2,
    R46_VIEWER.eigenRadiusFloor));
  const lambda1 = Math.max((a + c) * 0.5 + radius, 1e-7);
  const lambda2 = Math.max((a + c) * 0.5 - radius, 1e-7);
  const raw1 = Math.sqrt(lambda1);
  const raw2 = Math.sqrt(lambda2);
  return {
    a, b: base.b, c, lambda1, lambda2, raw1, raw2,
    shown1: Math.min(raw1, R46_VIEWER.maxScreenScalePixels),
    shown2: Math.min(raw2, R46_VIEWER.maxScreenScalePixels),
    capped: raw1 > R46_VIEWER.maxScreenScalePixels || raw2 > R46_VIEWER.maxScreenScalePixels,
    kernelDominated: Math.max(base.aBase, base.cBase) < R46_VIEWER.kernel2D,
  };
}

function spectralNorm2(a, b, c) {
  return Math.max(Math.abs((a + c) * 0.5 + Math.hypot((a - c) * 0.5, b)),
    Math.abs((a + c) * 0.5 - Math.hypot((a - c) * 0.5, b)));
}

export function assessR46EllipseProjection(manifest) {
  if (manifest.spzRevision !== R46_VIEWER.spzRevision) throw new Error('unverified SPZ revision');
  if (manifest.threeRevision !== R46_VIEWER.threeRevision) throw new Error('unverified Three.js revision');
  for (const key of ['maxProjectedCovarianceRelativeSpectralError', 'maxRawScalePixelError']) {
    finite(manifest.tolerances?.[key], `tolerances.${key}`);
    if (manifest.tolerances[key] < 0) throw new Error(`${key} must be nonnegative`);
  }
  if (!Array.isArray(manifest.splats) || manifest.splats.length === 0) throw new Error('splats required');

  let maxCovarianceRelativeSpectralError = 0;
  let maxRawScalePixelError = 0;
  let maxDisplayedScalePixelError = 0;
  let capMaskedCount = 0;
  let kernelDominatedCount = 0;
  for (const [index, splat] of manifest.splats.entries()) {
    const source = ellipse(splat.floatProjectedCovariance, `splats[${index}].floatProjectedCovariance`);
    const decoded = ellipse(splat.decodedProjectedCovariance, `splats[${index}].decodedProjectedCovariance`);
    const covarianceError = spectralNorm2(decoded.a - source.a, decoded.b - source.b,
      decoded.c - source.c) / source.lambda1;
    maxCovarianceRelativeSpectralError = Math.max(maxCovarianceRelativeSpectralError, covarianceError);
    const rawError = Math.max(Math.abs(decoded.raw1 - source.raw1), Math.abs(decoded.raw2 - source.raw2));
    const displayedError = Math.max(Math.abs(decoded.shown1 - source.shown1),
      Math.abs(decoded.shown2 - source.shown2));
    maxRawScalePixelError = Math.max(maxRawScalePixelError, rawError);
    maxDisplayedScalePixelError = Math.max(maxDisplayedScalePixelError, displayedError);
    if ((source.capped || decoded.capped) && rawError > displayedError + 1e-12) capMaskedCount++;
    if (source.kernelDominated || decoded.kernelDominated) kernelDominatedCount++;
  }
  const tolerancePass = maxCovarianceRelativeSpectralError <= manifest.tolerances.maxProjectedCovarianceRelativeSpectralError &&
    maxRawScalePixelError <= manifest.tolerances.maxRawScalePixelError;
  return {
    status: tolerancePass && capMaskedCount === 0 ? 'Candidate-pass' : 'Candidate-fail',
    splatCount: manifest.splats.length,
    maxCovarianceRelativeSpectralError,
    maxRawScalePixelError,
    maxDisplayedScalePixelError,
    capMaskedCount,
    kernelDominatedCount,
    tolerancePass,
    limits: 'Ellipse-parameter gate only; compositing, GPU/device behavior and human acceptance remain separate.',
  };
}
