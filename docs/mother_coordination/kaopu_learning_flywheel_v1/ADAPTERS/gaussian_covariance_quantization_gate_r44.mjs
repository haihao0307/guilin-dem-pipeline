export const R44_CODEC = Object.freeze({
  spzRevision: 'affd0ecea7fbb4c265ee119475af7ee5b2997482',
  logScaleRange: [-10, 5.9375],
  implementationRelativeSpectralEnvelope: 0.0741036142205341,
});

function finiteArray(value, length, label) {
  if (!Array.isArray(value) || value.length !== length || !value.every(Number.isFinite)) {
    throw new Error(`${label} must contain ${length} finite numbers`);
  }
}

function symmetricMatrix(packed) {
  finiteArray(packed, 6, 'covariance');
  const [xx, xy, xz, yy, yz, zz] = packed;
  return [xx, xy, xz, xy, yy, yz, xz, yz, zz];
}

function spectralNormSymmetric(input) {
  const a = [...input];
  for (let sweep = 0; sweep < 12; sweep++) {
    for (const [p, q] of [[0, 1], [0, 2], [1, 2]]) {
      const apq = a[p * 3 + q];
      if (Math.abs(apq) < 1e-18) continue;
      const tau = (a[q * 3 + q] - a[p * 3 + p]) / (2 * apq);
      const t = Math.sign(tau || 1) / (Math.abs(tau) + Math.sqrt(1 + tau * tau));
      const c = 1 / Math.sqrt(1 + t * t);
      const s = t * c;
      const app = a[p * 3 + p];
      const aqq = a[q * 3 + q];
      a[p * 3 + p] = app - t * apq;
      a[q * 3 + q] = aqq + t * apq;
      a[p * 3 + q] = a[q * 3 + p] = 0;
      for (let k = 0; k < 3; k++) if (k !== p && k !== q) {
        const akp = a[k * 3 + p];
        const akq = a[k * 3 + q];
        a[k * 3 + p] = a[p * 3 + k] = c * akp - s * akq;
        a[k * 3 + q] = a[q * 3 + k] = s * akp + c * akq;
      }
    }
  }
  return Math.max(Math.abs(a[0]), Math.abs(a[4]), Math.abs(a[8]));
}

export function assessR44CovarianceDelivery(manifest) {
  if (manifest.spzRevision !== R44_CODEC.spzRevision) throw new Error('unverified SPZ revision');
  if (!Number.isFinite(manifest.assetRelativeSpectralTolerance) || manifest.assetRelativeSpectralTolerance < 0) {
    throw new Error('assetRelativeSpectralTolerance must be a nonnegative measured acceptance value');
  }
  if (!Array.isArray(manifest.splats) || manifest.splats.length === 0) throw new Error('splats required');

  let maxRelativeSpectralError = 0;
  for (const [index, splat] of manifest.splats.entries()) {
    finiteArray(splat.logScale, 3, `splats[${index}].logScale`);
    if (splat.logScale.some(v => v < R44_CODEC.logScaleRange[0] || v > R44_CODEC.logScaleRange[1])) {
      throw new Error(`splats[${index}] logScale would saturate SPZ`);
    }
    finiteArray(splat.quaternion, 4, `splats[${index}].quaternion`);
    const norm = Math.hypot(...splat.quaternion);
    if (Math.abs(norm - 1) > 1e-4) throw new Error(`splats[${index}] quaternion is not normalized`);

    const source = symmetricMatrix(splat.floatCovariance);
    const decoded = symmetricMatrix(splat.decodedCovariance);
    const lambdaMax = spectralNormSymmetric(source);
    if (!(lambdaMax > 0)) throw new Error(`splats[${index}] source covariance is not positive-scale`);
    const difference = source.map((value, i) => decoded[i] - value);
    maxRelativeSpectralError = Math.max(maxRelativeSpectralError,
      spectralNormSymmetric(difference) / lambdaMax);
  }

  return {
    status: maxRelativeSpectralError <= manifest.assetRelativeSpectralTolerance &&
      maxRelativeSpectralError <= R44_CODEC.implementationRelativeSpectralEnvelope ? 'Candidate-pass' : 'Candidate-fail',
    splatCount: manifest.splats.length,
    maxRelativeSpectralError,
    assetRelativeSpectralTolerance: manifest.assetRelativeSpectralTolerance,
    codecRegressionEnvelope: R44_CODEC.implementationRelativeSpectralEnvelope,
    limits: 'This gate checks parameters only; it does not establish pixel, device, physical, or human acceptance.',
  };
}
