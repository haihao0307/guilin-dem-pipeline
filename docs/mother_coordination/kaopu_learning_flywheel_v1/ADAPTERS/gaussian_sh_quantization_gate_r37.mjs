const COEFFICIENTS_PER_DEGREE = [0, 3, 8, 15];

export function analyzeGaussianShQuantizationR37(source, decoded, budget) {
  const errors = [];
  const warnings = [];
  const degree = source?.shDegree;
  const pointCount = source?.numPoints;
  const expected = Number.isInteger(degree) && degree >= 0 && degree <= 3 && Number.isInteger(pointCount) && pointCount >= 0
    ? pointCount * COEFFICIENTS_PER_DEGREE[degree] * 3
    : null;

  if (expected === null) errors.push('invalid-point-count-or-sh-degree');
  for (const [label, values] of [['source', source?.sh], ['decoded', decoded?.sh]]) {
    if (!Array.isArray(values) || (expected !== null && values.length !== expected)) errors.push(`${label}-sh-length-mismatch`);
    else if (values.some(value => typeof value !== 'number' || !Number.isFinite(value))) errors.push(`${label}-sh-nonfinite`);
  }
  if (errors.length) return { errors, warnings, metrics: {} };

  let outsideCodecDomainCount = 0;
  let maxCoefficientError = 0;
  let squaredError = 0;
  for (let i = 0; i < expected; i++) {
    if (source.sh[i] < -1 || source.sh[i] > 1) outsideCodecDomainCount++;
    const error = Math.abs(source.sh[i] - decoded.sh[i]);
    maxCoefficientError = Math.max(maxCoefficientError, error);
    squaredError += error * error;
  }
  if (outsideCodecDomainCount) errors.push('source-sh-outside-declared-minus-one-to-one-domain');

  if (!budget || typeof budget !== 'object') {
    errors.push('missing-explicit-quantization-budget');
  } else {
    if (!Number.isFinite(budget.maxCoefficientError) || budget.maxCoefficientError < 0) errors.push('invalid-max-coefficient-error-budget');
    else if (maxCoefficientError > budget.maxCoefficientError) errors.push('coefficient-error-budget-exceeded');
    if (!Number.isFinite(budget.measuredDirectionalMax) || budget.measuredDirectionalMax < 0) errors.push('missing-measured-directional-error');
    if (!Number.isFinite(budget.maxDirectionalError) || budget.maxDirectionalError < 0) errors.push('invalid-max-directional-error-budget');
    else if (Number.isFinite(budget.measuredDirectionalMax) && budget.measuredDirectionalMax > budget.maxDirectionalError) errors.push('directional-error-budget-exceeded');
  }

  return {
    errors,
    warnings,
    metrics: {
      coefficientCount: expected,
      outsideCodecDomainCount,
      maxCoefficientError,
      coefficientRmse: expected ? Math.sqrt(squaredError / expected) : 0,
      measuredDirectionalMax: budget?.measuredDirectionalMax ?? null,
    },
  };
}
