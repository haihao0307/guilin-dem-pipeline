/** HAIR-FIBER-R01: independent scalar research probes, NOT a renderer/rod solver.
 * References and derivation boundaries are in RESEARCH.md. Units: metre/kg/s/Pa.
 * No teacher source, groom, head mesh, or film imagery is copied by this module.
 */
export const SCALP_LOCK = 'F02.1@ee3c7fac9f187dd9e5dc81d1363c4814b9a015a3';
function finite(x, name) {
  if (!Number.isFinite(x)) throw new TypeError(`${name} must be finite`);
  return x;
}
function nonnegative(x, name) {
  finite(x, name);
  if (x < 0) throw new RangeError(`${name} must be nonnegative`);
  return x;
}
function positive(x, name) {
  nonnegative(x, name);
  if (x === 0) throw new RangeError(`${name} must be positive`);
  return x;
}
function vec3(v, name) {
  if (!Array.isArray(v) || v.length !== 3) throw new TypeError(`${name} must be a vec3`);
  return v.map(x => finite(x, name));
}
const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);

/** Circular, uniform, linear-elastic section. No biological calibration implied. */
export function fiberSection({ diameterM, lengthM, youngPa, densityKgM3 }) {
  for (const [name, value] of Object.entries({ diameterM, lengthM, youngPa, densityKgM3 })) positive(value, name);
  const radius = diameterM / 2;
  const area = Math.PI * radius ** 2;
  const secondMoment = Math.PI * radius ** 4 / 4;
  const result = {
    areaM2: area,
    secondMomentM4: secondMoment,
    massKg: densityKgM3 * area * lengthM,
    bendingRigidityNm2: youngPa * secondMoment,
    axialComplianceMPerN: lengthM / (youngPa * area)
  };
  for (const [name, value] of Object.entries(result)) positive(value, name);
  return result;
}

/** Scalar boundary-path accounting with prescribed f and optical depth tau.
 * Higher orders are INTERNAL reflections, NOT inter-fiber multiple scattering.
 * Does not evaluate angular lobes, Fresnel angles, spectral transport or a BSDF.
 */
export function opticalPathBudget(f, tau) {
  nonnegative(f, 'f'); nonnegative(tau, 'tau');
  if (f > 1) throw new RangeError('f must be <= 1');
  if (f === 1) return { R: 1, TT: 0, TRT: 0, higher: 0, absorbed: 0 };
  const t = Math.exp(-tau);
  const TT = (1 - f) ** 2 * t;
  const TRT = TT * f * t;
  const higher = TRT * f * t / (1 - f * t);
  return { R: f, TT, TRT, higher, absorbed: Math.max(0, 1 - f - TT - TRT - higher) };
}

/** One isolated XPBD distance projection. Caller owns substeps and multipliers.
 * Reset lambda per time step in this reference; retain it across its iterations.
 * This is NOT bending, twist, collision, a time integrator, or full hair physics.
 */
export function xpbdDistance(a, b, invA, invB, restM, compliance, dt, lambda = 0) {
  a = vec3(a, 'a'); b = vec3(b, 'b');
  nonnegative(invA, 'invA'); nonnegative(invB, 'invB');
  positive(restM, 'restM'); nonnegative(compliance, 'compliance');
  positive(dt, 'dt'); finite(lambda, 'lambda');
  const delta = b.map((x, i) => x - a[i]);
  const length = Math.hypot(...delta);
  if (length < 1e-12) throw new RangeError('coincident nodes require a rest direction');
  const C = length - restM;
  if (invA + invB === 0) return { a, b, lambda, residualM: C, constrained: false };
  const scaledCompliance = compliance / (dt * dt);
  const dl = (-C - scaledCompliance * lambda) / (invA + invB + scaledCompliance);
  const unit = delta.map(x => x / length);
  a = a.map((x, i) => x - invA * dl * unit[i]);
  b = b.map((x, i) => x + invB * dl * unit[i]);
  return { a, b, lambda: lambda + dl, residualM: Math.hypot(...b.map((x, i) => x - a[i])) - restM, constrained: true };
}

/** Positive-definite LINEAR diagnostic drag, not Weta's porous nonlinear model.
 * relativeVelocity = strandVelocity - airVelocity; coefficients use kg/s.
 */
export function linearAnisotropicDrag(relativeVelocity, tangent, parallelKgS, transverseKgS) {
  const v = vec3(relativeVelocity, 'relativeVelocity');
  const t = vec3(tangent, 'tangent');
  nonnegative(parallelKgS, 'parallelKgS'); nonnegative(transverseKgS, 'transverseKgS');
  const n = Math.hypot(...t);
  if (n < 1e-12) throw new RangeError('tangent must be nonzero');
  const u = t.map(x => x / n), speed = dot(v, u);
  return v.map((x, i) => -parallelKgS * speed * u[i] - transverseKgS * (x - speed * u[i]));
}

/** Continuous importance response only; NOT a complete global budget scheduler. */
export function allocationWeight(importance, budgetPressure) {
  nonnegative(importance, 'importance'); positive(budgetPressure, 'budgetPressure');
  return importance / (importance + budgetPressure);
}

/** Read-only structural adapter for F03 guide attachment records. */
export function readF03Attachment(guide, scalpLock) {
  if (scalpLock !== SCALP_LOCK) throw new Error('approved scalp revision mismatch');
  if (!guide || !Number.isSafeInteger(guide.rootId) || guide.rootId < 0 || !Number.isSafeInteger(guide.face) || guide.face < 0) throw new TypeError('invalid stable root/face id');
  const barycentric = vec3(guide.barycentric, 'barycentric');
  if (barycentric.some(x => x < 0 || x > 1) || Math.abs(barycentric.reduce((a, b) => a + b, 0) - 1) > 1e-9) throw new RangeError('invalid barycentric binding');
  return Object.freeze({ rootId: guide.rootId, face: guide.face, barycentric: Object.freeze(barycentric), scalpLock });
}
