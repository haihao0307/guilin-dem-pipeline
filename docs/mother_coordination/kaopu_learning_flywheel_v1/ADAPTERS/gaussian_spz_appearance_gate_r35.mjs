const SPZ_DC_SCALE = 0.15;
const SH_C0 = 0.2820947917738781;

function roundHalfAwayFromZero(value) {
  return value >= 0 ? Math.floor(value + 0.5) : Math.ceil(value - 0.5);
}

function clampByte(value) {
  return Math.max(0, Math.min(255, value));
}

export function analyzeGaussianAppearanceForSpzR186(source) {
  const errors = [];
  const warnings = [];
  if (!source || typeof source !== 'object') return { errors: ['source-not-object'], warnings, metrics: {} };
  const count = source.numPoints;
  if (!Number.isInteger(count) || count < 0) errors.push('num-points-must-be-nonnegative-integer');
  for (const [name, expected] of [['colors', count * 3], ['alphas', count]]) {
    if (!Array.isArray(source[name]) || source[name].length !== expected) errors.push(`${name}-length-mismatch`);
    else if (source[name].some(value => typeof value !== 'number' || !Number.isFinite(value))) errors.push(`${name}-nonfinite`);
  }
  if (errors.length) return { errors, warnings, metrics: {} };

  let spzDcSaturationCount = 0;
  let threeDcClampCount = 0;
  let alphaEndpointCount = 0;
  for (let i = 0; i < source.colors.length; i++) {
    const packedUnclamped = roundHalfAwayFromZero((source.colors[i] * SPZ_DC_SCALE + 0.5) * 255);
    if (packedUnclamped < 0 || packedUnclamped > 255) {
      errors.push(`color-${i}-spz-dc-would-saturate`);
      spzDcSaturationCount++;
    }
    const packed = clampByte(packedUnclamped);
    const decodedCoefficient = (packed / 255 - 0.5) / SPZ_DC_SCALE;
    const linearDc = decodedCoefficient * SH_C0 + 0.5;
    if (linearDc < 0 || linearDc > 1) {
      errors.push(`color-${i}-three-r186-dc-would-clamp`);
      threeDcClampCount++;
    }
  }
  for (let i = 0; i < source.alphas.length; i++) {
    const probability = 1 / (1 + Math.exp(-source.alphas[i]));
    const packed = clampByte(roundHalfAwayFromZero(probability * 255));
    if (packed === 0 || packed === 255) {
      warnings.push(`alpha-${i}-quantizes-to-endpoint`);
      alphaEndpointCount++;
    }
  }
  return {
    errors,
    warnings,
    metrics: { spzDcSaturationCount, threeDcClampCount, alphaEndpointCount },
  };
}

export const GAUSSIAN_SPZ_APPEARANCE_CONSTANTS_R35 = Object.freeze({
  spzDcScale: SPZ_DC_SCALE,
  shC0: SH_C0,
});
