#!/usr/bin/env node

const f32 = Math.fround;
const finite = x => Number.isFinite(x);
const allFinite = xs => xs.every(finite);
const encodeNumber = x => finite(x) ? x : String(x);
const encodeVector = xs => xs.map(encodeNumber);

function fadd(a, b) { return f32(f32(a) + f32(b)); }
function fsub(a, b) { return f32(f32(a) - f32(b)); }
function fmul(a, b) { return f32(f32(a) * f32(b)); }

function sphereF32(p, center, radius) {
  const d = p.map((v, i) => fsub(v, center[i]));
  const d2 = fadd(fadd(fmul(d[0], d[0]), fmul(d[1], d[1])), fmul(d[2], d[2]));
  return fsub(d2, fmul(radius, radius));
}

function centralGradient(fn, p, epsilon) {
  return p.map((_, axis) => {
    const plus = p.slice();
    const minus = p.slice();
    plus[axis] = f32(plus[axis] + epsilon);
    minus[axis] = f32(minus[axis] - epsilon);
    return f32((fn(plus) - fn(minus)) / (2 * epsilon));
  });
}

function gradientNorm(g) {
  return Math.hypot(...g);
}

function unsafeNormalize(g) {
  const n = gradientNorm(g);
  return g.map(v => v / n);
}

function ulpF32(value) {
  const a = Math.abs(value);
  if (a === 0) return 2 ** -149;
  return 2 ** (Math.floor(Math.log2(a)) - 23);
}

function adaptiveEpsilon(p) {
  return Math.max(1e-5, 8 * Math.max(...p.map(ulpF32)));
}

function classifyPoint({ residual, gradient, epsilonSurface = 1e-3, epsilonGradient = 1e-6 }) {
  if (!finite(residual) || !allFinite(gradient)) return "INVALID_NONFINITE";
  if (Math.abs(residual) > epsilonSurface) return "UNCONVERGED_RESIDUAL";
  if (gradientNorm(gradient) <= epsilonGradient) return "INVALID_GRADIENT";
  return "HIT_CONVERGED";
}

function sphereIntervalState(region, maybeNan = false) {
  const minDist2 = region.reduce((sum, [lo, hi]) => {
    const d = lo > 0 ? lo : hi < 0 ? hi : 0;
    return sum + d * d;
  }, 0);
  const maxDist2 = region.reduce(
    (sum, [lo, hi]) => sum + Math.max(lo * lo, hi * hi),
    0,
  );
  const interval = [minDist2 - 1, maxDist2 - 1];
  const state = maybeNan
    ? "AMBIGUOUS"
    : interval[0] > 0
      ? "EMPTY"
      : interval[1] < 0
        ? "FILLED"
        : "AMBIGUOUS";
  return { interval, maybe_nan: maybeNan, state };
}

const center = [10000, 0, 0];
const surfacePoint = [10001, 0, 0];
const sphere = p => sphereF32(p, center, 1);

const fixedEpsilon = 1e-5;
const fixedGradient = centralGradient(sphere, surfacePoint, fixedEpsilon);
const fixedNormal = unsafeNormalize(fixedGradient);
const fixedStatus = classifyPoint({
  residual: sphere(surfacePoint),
  gradient: fixedGradient,
});

const scaleAwareEpsilon = adaptiveEpsilon(surfacePoint);
const adaptiveGradient = centralGradient(sphere, surfacePoint, scaleAwareEpsilon);
const adaptiveNormal = unsafeNormalize(adaptiveGradient);
const adaptiveStatus = classifyPoint({
  residual: sphere(surfacePoint),
  gradient: adaptiveGradient,
});

const unconvergedPoint = [10001.01, 0, 0];
const unconvergedResidual = sphere(unconvergedPoint);
const unconvergedGradient = centralGradient(sphere, unconvergedPoint, scaleAwareEpsilon);
const unconvergedStatus = classifyPoint({
  residual: unconvergedResidual,
  gradient: unconvergedGradient,
});

const nonFiniteResidual = Math.sqrt(-1);
const nonFiniteStatus = classifyPoint({
  residual: nonFiniteResidual,
  gradient: [1, 0, 0],
});

const temporalResiduals = Array.from(
  { length: 8 },
  (_, frame) => 9e-5 + (frame % 2 === 0 ? 2e-5 : -2e-5),
);
const temporalStatuses = temporalResiduals.map(residual => classifyPoint({
  residual,
  gradient: [1, 0, 0],
  epsilonSurface: 1e-4,
}));
const frozenInputStable = new Set(temporalStatuses).size === 1;

const cells = {
  outside: sphereIntervalState([[2, 2.5], [-0.1, 0.1], [-0.1, 0.1]]),
  inside: sphereIntervalState([[-0.2, 0.2], [-0.2, 0.2], [-0.2, 0.2]]),
  crosses_surface: sphereIntervalState([[0.9, 1.1], [0, 0], [0, 0]]),
  unsafe_domain: sphereIntervalState([[0.9, 1.1], [0, 0], [0, 0]], true),
};

const assertions = {
  fixed_epsilon_exposes_invalid_gradient:
    fixedStatus === "INVALID_GRADIENT" && !allFinite(fixedNormal),
  scale_aware_epsilon_recovers_finite_normal:
    adaptiveStatus === "HIT_CONVERGED" && allFinite(adaptiveNormal),
  unconverged_point_is_not_shaded:
    unconvergedStatus === "UNCONVERGED_RESIDUAL",
  nonfinite_domain_is_not_shaded:
    nonFiniteStatus === "INVALID_NONFINITE",
  outside_cell_is_empty: cells.outside.state === "EMPTY",
  inside_cell_is_filled: cells.inside.state === "FILLED",
  crossing_cell_is_ambiguous: cells.crosses_surface.state === "AMBIGUOUS",
  maybe_nan_cell_is_ambiguous: cells.unsafe_domain.state === "AMBIGUOUS",
  hidden_frame_dependency_is_detected: !frozenInputStable,
};

const result = {
  schema: "kaopu.function_surface_validity_probe.v1",
  subject: "synthetic f32 oracle; production source unavailable",
  point_samples: {
    fixed_epsilon: {
      position: surfacePoint,
      epsilon: fixedEpsilon,
      residual: sphere(surfacePoint),
      gradient: fixedGradient,
      gradient_norm: gradientNorm(fixedGradient),
      unsafe_normal: encodeVector(fixedNormal),
      status: fixedStatus,
      silent_black_if_nonfinite_is_zeroed: [0, 0, 0],
    },
    scale_aware_epsilon: {
      position: surfacePoint,
      epsilon: scaleAwareEpsilon,
      residual: sphere(surfacePoint),
      gradient: adaptiveGradient,
      gradient_norm: gradientNorm(adaptiveGradient),
      normal: adaptiveNormal,
      status: adaptiveStatus,
    },
    unconverged: {
      position: unconvergedPoint,
      epsilon_surface: 1e-3,
      residual: unconvergedResidual,
      gradient: unconvergedGradient,
      status: unconvergedStatus,
    },
    nonfinite_domain: {
      residual: encodeNumber(nonFiniteResidual),
      status: nonFiniteStatus,
    },
  },
  cell_states: cells,
  frozen_input_repeat: {
    frame_count: temporalStatuses.length,
    residuals: temporalResiduals,
    statuses: temporalStatuses,
    stable: frozenInputStable,
    expected_gate: "REJECT_HIDDEN_TEMPORAL_DEPENDENCY",
  },
  assertions,
  passed: Object.values(assertions).filter(Boolean).length,
  total: Object.keys(assertions).length,
  decision: "CANDIDATE_GATE_VALIDATES_BOUNDARY_ROOT_CAUSE_UNKNOWN",
};

console.log(JSON.stringify(result, null, 2));
