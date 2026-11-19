/** Original finite-footprint periodic coverage receiver.
 * Exact separable box integral of rectangular tile occupancy; all units metres.
 * width is FULL support width, not radius, sigma, or screen-space pixels.
 */
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const positivePhase = (x, period) => {
  let phase = x - period * Math.floor(x / period);
  // Repair a possible final-rounding excursion without changing negative phases.
  if (phase < 0) phase += period;
  if (phase >= period) phase -= period;
  return phase;
};
const pointTile = (centeredPhase, halfTile) => {
  const a = Math.abs(centeredPhase);
  return a < halfTile ? 1 : a > halfTile ? 0 : 0.5;
};
const overlap = (q, halfWidth, halfTile) => Math.max(0,
  Math.min(halfWidth, halfTile - q) - Math.max(-halfWidth, -halfTile - q));

/** Returns occupancy and its exact derivative with respect to chart coordinate.
 * At w=0 the derivative is distributional at boundaries, so derivativeValid=false
 * there; at a finite-width kink the symmetric endpoint convention is returned.
 * Away from a boundary, the exact zero-width sample is binary.
 */
export function periodicBox1D(u, tile, joint, width) {
  if (![u, tile, joint, width].every(Number.isFinite) || tile <= 0 || joint < 0 || width < 0)
    throw new RangeError('Finite coordinate, positive tile, nonnegative joint/width required');
  if (joint === 0) return {coverage: 1, derivative: 0, derivativeValid: true};
  const period = tile + joint, halfTile = tile * 0.5, duty = tile / period;
  let q = positivePhase(u, period) - period * 0.5;
  if (width === 0) {
    const coverage = pointTile(q, halfTile);
    return {coverage, derivative: 0, derivativeValid: coverage !== 0.5};
  }
  // Remove full periods without subtracting two large cumulative integrals.
  // Taking them from the left shifts the residual centre by n*period/2;
  // only the parity of n is needed after phase reduction.
  let n = Math.floor(width / period), rem = width - n * period;
  if (rem < 0) { n -= 1; rem += period; }
  if (rem >= period) { n += 1; rem -= period; }
  q = positivePhase(q + period * 0.5 - (n % 2) * period * 0.5, period) - period * 0.5;
  if (rem === 0) return {coverage: duty, derivative: 0, derivativeValid: true};
  const halfWidth = rem * 0.5;
  // At most two of these three intervals overlap. Relative clipping preserves
  // an exact width/zero result for tiny footprints fully inside/outside a tile.
  const residual = overlap(q - period, halfWidth, halfTile)
    + overlap(q, halfWidth, halfTile) + overlap(q + period, halfWidth, halfTile);
  const coverage = clamp(n === 0 ? residual / width : duty + (residual - rem * duty) / width, 0, 1);
  const endpoint = d => pointTile(positivePhase(q + d + period * 0.5, period) - period * 0.5, halfTile);
  const derivative = (endpoint(halfWidth) - endpoint(-halfWidth)) / width;
  return {coverage, derivative, derivativeValid: true};
}

export function periodicBox2D(uv, tile, joint, fullWidths) {
  const gx = Array.isArray(joint) ? joint[0] : joint;
  const gy = Array.isArray(joint) ? joint[1] : joint;
  const x = periodicBox1D(uv[0], tile[0], gx, fullWidths[0]);
  const y = periodicBox1D(uv[1], tile[1], gy, fullWidths[1]);
  return {coverage: x.coverage * y.coverage,
    gradient: [x.derivative * y.coverage, x.coverage * y.derivative],
    axes: [x, y]};
}

/** Filtered two-level recess, not a claim to integrate a separate rounded bevel.
 * Gradient length is bounded for normal conversion only; neither intersection
 * geometry nor coverage/color is modified by the normal-slope limit.
 */
export function filteredRecess(sample, recessM = 0.0015, normalSlopeLimit = 0.5) {
  const rawGradient = sample.gradient.map(g => g * recessM);
  const length = Math.hypot(...rawGradient);
  const scale = length > normalSlopeLimit ? normalSlopeLimit / length : 1;
  return {height: recessM * (sample.coverage - 1), rawGradient,
    normalGradient: rawGradient.map(g => g * scale)};
}

export const PERIODIC_COVERAGE_GLSL="// Original finite-footprint coverage integral.\n// Requires highp float. A coordinate and full footprint widths are in metres.\n// Returns vec2(coverage, dCoverage/dCoordinate).\n// Exact for a separable axis-aligned box, not a sheared/elliptical pixel filter.\nfloat pcPhase(float x, float period) {\n  float phase = x - period * floor(x / period);\n  if (phase < 0.0) phase += period;\n  if (phase >= period) phase -= period;\n  return phase;\n}\nfloat pcPoint(float q, float halfTile) {\n  float a = abs(q);\n  return a < halfTile ? 1.0 : (a > halfTile ? 0.0 : 0.5);\n}\nfloat pcOverlap(float q, float halfWidth, float halfTile) {\n  return max(0.0, min(halfWidth, halfTile - q) - max(-halfWidth, -halfTile - q));\n}\nvec2 pcBox1D(float u, float tile, float joint, float width) {\n  if (joint <= 0.0) return vec2(1.0, 0.0);\n  float period = tile + joint, halfTile = tile * 0.5, duty = tile / period;\n  float q = pcPhase(u, period) - period * 0.5;\n  if (width <= 0.0) return vec2(pcPoint(q, halfTile), 0.0);\n  float n = floor(width / period), rem = width - n * period;\n  if (rem < 0.0) { n -= 1.0; rem += period; }\n  if (rem >= period) { n += 1.0; rem -= period; }\n  q = pcPhase(q + period * 0.5 - mod(n, 2.0) * period * 0.5, period) - period * 0.5;\n  if (rem == 0.0) return vec2(duty, 0.0);\n  float hw = rem * 0.5;\n  float residual = pcOverlap(q - period, hw, halfTile)\n    + pcOverlap(q, hw, halfTile) + pcOverlap(q + period, hw, halfTile);\n  float coverage = clamp(n == 0.0 ? residual / width : duty + (residual - rem * duty) / width, 0.0, 1.0);\n  float left = pcPoint(pcPhase(q - hw + period * 0.5, period) - period * 0.5, halfTile);\n  float right = pcPoint(pcPhase(q + hw + period * 0.5, period) - period * 0.5, halfTile);\n  return vec2(coverage, (right - left) / width);\n}\n// vec3(coverage, derivativeU, derivativeV)\nvec3 pcBox2D(vec2 uv, vec2 tile, vec2 joint, vec2 fullWidths) {\n  vec2 x = pcBox1D(uv.x, tile.x, joint.x, fullWidths.x);\n  vec2 y = pcBox1D(uv.y, tile.y, joint.y, fullWidths.y);\n  return vec3(x.x * y.x, x.y * y.x, x.x * y.y);\n}\n// A bounded shading-only gradient of the filtered two-level tile/grout recess.\n// Integrating a separate 1 mm rounded bevel would need its own continuous profile;\n// never add that unfiltered profile back after applying this coverage filter.\nvec2 pcRecessNormalGradient(vec3 filtered, float recessM, float slopeLimit) {\n  vec2 g = filtered.yz * recessM;\n  return g * min(1.0, slopeLimit / max(length(g), 1e-20));\n}\n";
