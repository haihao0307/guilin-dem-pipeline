import assert from 'node:assert/strict';

const EPSILON = 1e-12;

function dyadicScales() {
  const values = [];
  for (let s = 1; s < 1e5; s += s) values.push(s);
  return values;
}

function compactKernel([u, v, w], s) {
  return Math.cos(
    Math.cos(w * s) * Math.cos(u * s)
      + Math.cos(v * s) * Math.cos(v * s)
      + Math.cos(v * s) * Math.cos(u * s),
  ) / s;
}

function dotExpandedKernel([u, v, w], s) {
  const zyy = [w * s, v * s, v * s];
  const xyx = [u * s, v * s, u * s];
  const dot = zyy.reduce((sum, value, index) => (
    sum + Math.cos(value) * Math.cos(xyx[index])
  ), 0);
  return Math.cos(dot) / s;
}

function glslAtanTwoArg(firstArgument, secondArgument) {
  // GLSL spells the signature atan(y, x). JavaScript spells it atan2(y, x).
  return Math.atan2(firstArgument, secondArgument);
}

const scales = dyadicScales();
const amplitudes = scales.map((s) => 1 / s);
const samplePoints = [
  [0.125, -0.25, 0.5],
  [-1.25, 0.75, 2.5],
  [Math.PI / 7, -Math.E / 5, Math.sqrt(2)],
];

let maxExpansionDifference = 0;
for (const point of samplePoints) {
  for (const s of scales) {
    maxExpansionDifference = Math.max(
      maxExpansionDifference,
      Math.abs(compactKernel(point, s) - dotExpandedKernel(point, s)),
    );
  }
}

const angleCounterexample = {
  transformedX: 1,
  transformedY: 0,
  sourceCall_atan_pX_pY: glslAtanTwoArg(1, 0),
  conventionalAtan2_y_x: Math.atan2(0, 1),
};
angleCounterexample.absoluteDifference = Math.abs(
  angleCounterexample.sourceCall_atan_pX_pY - angleCounterexample.conventionalAtan2_y_x,
);

const originDomain = {
  radius: 0,
  log2RadiusFinite: Number.isFinite(Math.log2(0)),
  normalizedZFinite: Number.isFinite(0 / 0),
  glslAtanDefinedBySpec: false,
};

const checks = {
  scaleCountIs17: scales.length === 17,
  scaleEndpointsAre1And65536: scales[0] === 1 && scales.at(-1) === 65536,
  nextScaleFailsLoopGuard: scales.at(-1) * 2 >= 1e5,
  everyScaleDoubles: scales.slice(1).every((s, index) => s === 2 * scales[index]),
  amplitudeIsReciprocalScale: amplitudes.every((a, index) => a === 1 / scales[index]),
  frequencyAmplitudeProductIsOne: scales.every((s, index) => s * amplitudes[index] === 1),
  compactExpansionMatches: maxExpansionDifference <= EPSILON,
  atanArgumentOrderHasCounterexample: Math.abs(angleCounterexample.absoluteDifference - Math.PI / 2) <= EPSILON,
  originIsOutsideDeclaredSafeDomain: !originDomain.log2RadiusFinite
    && !originDomain.normalizedZFinite
    && !originDomain.glslAtanDefinedBySpec,
};

for (const [name, passed] of Object.entries(checks)) assert.equal(passed, true, name);

const result = {
  schema: 'kaopu-yohei-microscope-source-audit/r67',
  status: 'Observation plus reproducible derivation; artwork reconstruction remains Candidate partial',
  sourceExpressionUnderTest: 'for (...; s < 1e5; s += s) e += cos(dot(cos(p.zyy*s), cos(p.xyx*s))) / s',
  scales,
  amplitudes,
  amplitudeSum: amplitudes.reduce((sum, value) => sum + value, 0),
  maximumScale: scales.at(-1),
  nextScale: scales.at(-1) * 2,
  termCount: scales.length,
  maxCompactVsExpandedDifference: maxExpansionDifference,
  angleCounterexample,
  originDomain,
  checks,
  checkCount: Object.keys(checks).length,
  passedCheckCount: Object.values(checks).filter(Boolean).length,
  constraints: [
    'The Codrops rendering contains typographic dash substitutions; this probe does not claim byte-identical recovery of the original X shader.',
    'The 17-term result is a derivation from the published loop guard and update, not an author prose statement about a reusable universal octave count.',
    'The angle result follows the GLSL 4.60 atan(y, x) contract; it is not the common atan2(y, x) spelling applied to the same textual argument order.',
    'The origin is singular for log2(R), z/R, and atan(0,0); no epsilon or fallback is silently introduced.',
    'Dimensionless transformed-coordinate scales do not define metres, displacement, material identity, or physical truth.',
  ],
};

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
