const MAX_DERIVED_ANGLE_DEGREES_R43 = 0.275221295263479;
const MAX_DERIVED_RELATIVE_SPECTRAL_COVARIANCE_R43 = 0.0096070263116278;

function validateSpzQuaternionQuantizationEvidenceR43({
  sourceQuaternionNormMin,
  observedMaxAngleDegrees,
  observedMaxRelativeCovarianceError,
  decodedCovarianceCompared = false,
  fixedViewPixelsCompared = false,
  targetDeviceTested = false,
} = {}) {
  const errors = [];
  if (!Number.isFinite(sourceQuaternionNormMin) || Math.abs(sourceQuaternionNormMin - 1) > 1e-5) errors.push('finite-normalized-source-quaternion-missing');
  if (!Number.isFinite(observedMaxAngleDegrees) || observedMaxAngleDegrees > MAX_DERIVED_ANGLE_DEGREES_R43) errors.push('rotation-error-bound-failed');
  if (!Number.isFinite(observedMaxRelativeCovarianceError)) errors.push('covariance-error-missing');
  if (decodedCovarianceCompared !== true) errors.push('decoded-covariance-comparison-missing');
  if (fixedViewPixelsCompared !== true) errors.push('fixed-view-pixel-comparison-missing');
  if (targetDeviceTested !== true) errors.push('target-device-test-missing');
  return {
    status: errors.length ? 'Candidate-incomplete' : 'Candidate-asset-evidence-complete',
    errors,
    warning: 'R43 isolates rotation quantization; it is not a pixel, visual, physical-scale, or device acceptance threshold.',
  };
}

export { MAX_DERIVED_ANGLE_DEGREES_R43, MAX_DERIVED_RELATIVE_SPECTRAL_COVARIANCE_R43, validateSpzQuaternionQuantizationEvidenceR43 };
