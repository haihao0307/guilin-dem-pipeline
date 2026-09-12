export const R45_POSITION = Object.freeze({
  spzRevision: 'affd0ecea7fbb4c265ee119475af7ee5b2997482',
  threeRevision: '148ef33ecb6d2502ff796d4554abd1549c95d519',
  componentHalfStepStorageUnits: 0.0001220703125,
});

function positive(value, label) {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${label} must be finite and positive`);
}

export function assessR45PositionProjection(manifest) {
  if (manifest.spzRevision !== R45_POSITION.spzRevision) throw new Error('unverified SPZ revision');
  if (manifest.threeRevision !== R45_POSITION.threeRevision) throw new Error('unverified Three.js revision');
  for (const key of ['storageUnitsPerWorldUnit', 'minimumViewDepthWorld',
    'minimumVisibilityBoundaryDistanceWorld', 'assetCenterPixelTolerance']) positive(manifest[key], key);
  positive(manifest.viewportWidth, 'viewportWidth');
  positive(manifest.viewportHeight, 'viewportHeight');
  positive(manifest.projection00, 'projection00');
  positive(manifest.projection11, 'projection11');
  if (![manifest.maxAbsViewXOverDepth, manifest.maxAbsViewYOverDepth].every(v => Number.isFinite(v) && v >= 0)) {
    throw new Error('measured view ratios must be finite and nonnegative');
  }

  // A storage-space component error can rotate into any view axis. Use the
  // Euclidean cube radius unless a tighter transform-aware bound is supplied.
  const viewComponentErrorWorld = Math.sqrt(3) *
    R45_POSITION.componentHalfStepStorageUnits / manifest.storageUnitsPerWorldUnit;
  if (manifest.minimumViewDepthWorld <= viewComponentErrorWorld) {
    throw new Error('depth is too small for a finite conservative projection bound');
  }
  const decodedMinimumDepth = manifest.minimumViewDepthWorld - viewComponentErrorWorld;
  const focalX = 0.5 * manifest.viewportWidth * manifest.projection00;
  const focalY = 0.5 * manifest.viewportHeight * manifest.projection11;
  const boundX = focalX * viewComponentErrorWorld *
    (1 + manifest.maxAbsViewXOverDepth) / decodedMinimumDepth;
  const boundY = focalY * viewComponentErrorWorld *
    (1 + manifest.maxAbsViewYOverDepth) / decodedMinimumDepth;
  const conservativeCenterPixelBound = Math.hypot(boundX, boundY);
  const visibilityMarginPass = manifest.minimumVisibilityBoundaryDistanceWorld > viewComponentErrorWorld;
  const pixelPass = conservativeCenterPixelBound <= manifest.assetCenterPixelTolerance;

  return {
    status: visibilityMarginPass && pixelPass ? 'Candidate-pass' : 'Candidate-fail',
    viewComponentErrorWorld,
    decodedMinimumDepth,
    conservativeCenterPixelBound,
    assetCenterPixelTolerance: manifest.assetCenterPixelTolerance,
    visibilityMarginPass,
    pixelPass,
    limits: 'Projection-center gate only; covariance footprint, compositing, GPU/device and human acceptance remain separate.',
  };
}
