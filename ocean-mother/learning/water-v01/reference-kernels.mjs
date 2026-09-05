/** Independent numerical study kernels. Not imported by the R018.11 runtime.
 * Scope and source distinctions: SKILL.md and SOURCES.json.
 * No renderer, simulation transport, GPU cache or external assets are implemented.
 */
function finite(value, name) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${name} must be a finite number`);
  }
  return value;
}
function nonnegative(value, name) {
  finite(value, name);
  if (value < 0) throw new RangeError(`${name} must be nonnegative`);
  return value;
}
function vec(value, length, name) {
  if (!Array.isArray(value) || value.length !== length) {
    throw new TypeError(`${name} must be an array of length ${length}`);
  }
  value.forEach((n, i) => finite(n, `${name}[${i}]`));
  return value;
}

/** Homogeneous beam attenuation only. Coefficients: m^-1; path: m.
 * Does not include in-scattering, surface reflection/refraction or emission.
 */
export function beamTransmittance(sigmaA, sigmaS, pathM) {
  vec(sigmaA, 3, 'sigmaA'); vec(sigmaS, 3, 'sigmaS');
  nonnegative(pathM, 'pathM');
  return sigmaA.map((a, i) => {
    nonnegative(a, `sigmaA[${i}]`);
    nonnegative(sigmaS[i], `sigmaS[${i}]`);
    const extinction = a + sigmaS[i];
    if (!Number.isFinite(extinction)) throw new RangeError('coefficient sum overflow');
    return pathM === 0 ? 1 : Math.exp(-extinction * pathM);
  });
}

/** Project approximation: dF/dt = birth*(1-F) - decay*F for one cell.
 * F in [0,1], rates in s^-1, dt in simulation seconds.
 * Constant-rate exact local update; NO advection, spray, FLIP or conservation claim.
 * The equation is our proposal, not a formula copied from a vendor solver.
 */
export function advanceFoamCoverage(coverage, birthPerS, decayPerS, dtS) {
  finite(coverage, 'coverage');
  if (coverage < 0 || coverage > 1) throw new RangeError('coverage must be in [0,1]');
  nonnegative(birthPerS, 'birthPerS'); nonnegative(decayPerS, 'decayPerS');
  nonnegative(dtS, 'dtS');
  const rate = birthPerS + decayPerS;
  if (!Number.isFinite(rate)) throw new RangeError('rate sum overflow');
  if (rate === 0 || dtS === 0) return coverage;
  const equilibrium = birthPerS / rate;
  const weight = -Math.expm1(-rate * dtS);
  return Math.max(0, Math.min(1, coverage + (equilibrium - coverage) * weight));
}

/** Project field-sampling warp, not a fluid solver or image-node clone.
 * Position is world [x,z] in m. Angle in rad: +X toward +Z. Amplitude in m.
 */
export function directionalSamplePoint(positionXZ, angleRad, amplitudeM) {
  vec(positionXZ, 2, 'positionXZ'); finite(angleRad, 'angleRad');
  finite(amplitudeM, 'amplitudeM');
  const q = [positionXZ[0] + Math.cos(angleRad) * amplitudeM,
    positionXZ[1] + Math.sin(angleRad) * amplitudeM];
  if (!q.every(Number.isFinite)) throw new RangeError('warped coordinate overflow');
  return q;
}
