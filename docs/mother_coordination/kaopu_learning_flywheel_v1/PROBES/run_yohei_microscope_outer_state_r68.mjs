import assert from 'node:assert/strict';

const subtractOne = (v) => v.map((x) => x - 1);
const snapBySourceUpdate = (d) => d.map((x) => x / -x);
const reverseDirection = (d) => d.map((x) => -x);
const maxAbsDiff = (a, b) => Math.max(...a.map((x, i) => Math.abs(x - b[i])));

function traceLoop(i0) {
  let i = i0;
  let bodyIterations = 0;
  const snapUpdates = [];

  while (true) {
    const compared = i;
    i += 1;
    if (!(compared < 119)) break;

    bodyIterations += 1;
    if (i > 89) snapUpdates.push({ afterBody: bodyIterations, i });
  }

  return {
    initialI: i0,
    bodyIterations,
    firstSnapUpdate: snapUpdates[0] ?? null,
    snapUpdateCount: snapUpdates.length,
    finalI: i
  };
}

function firstOuterPosition({ i0, e0, R0, q0, d }) {
  const qAfterPostDecrement = subtractOne(q0);
  const comparedI = i0;
  const i = i0 + 1;
  if (!(comparedI < 119)) return null;
  const e = e0 + i / 5000;
  const p = qAfterPostDecrement.map((q, index) => q + d[index] * e * R0 * 0.16);
  const radius = Math.hypot(...p);
  return { qAfterPostDecrement, comparedI, i, e, p, radius };
}

const zeroI = traceLoop(0);
const fiveI = traceLoop(5);
const negativeI = traceLoop(-2);
const direction = [0.25, -0.5, 1];
const sourceUpdate = snapBySourceUpdate(direction);
const trueReversal = reverseDirection(direction);
const withZero = snapBySourceUpdate([0, 0.5, 1]);
const qZero = subtractOne([0, 0, 0]);
const qOther = subtractOne([2, -3, 0.5]);
const firstFromZeroQ = firstOuterPosition({ i0: 0, e0: 0, R0: 0, q0: [0, 0, 0], d: direction });
const firstFromOneQ = firstOuterPosition({ i0: 0, e0: 0, R0: 0, q0: [1, 1, 1], d: direction });

const checks = {
  zeroSeedRuns119Bodies: zeroI.bodyIterations === 119,
  fiveSeedRuns114Bodies: fiveI.bodyIterations === 114,
  negativeSeedRuns121Bodies: negativeI.bodyIterations === 121,
  firstSnapAfterBody90: zeroI.firstSnapUpdate?.afterBody === 90 && zeroI.firstSnapUpdate?.i === 90,
  zeroSeedHas30SnapUpdates: zeroI.snapUpdateCount === 30,
  sourceUpdateSnapsNonzeroComponentsToMinusOne: sourceUpdate.every((x) => Object.is(x, -1)),
  sourceUpdateIsNotDirectionReversal: maxAbsDiff(sourceUpdate, trueReversal) === 1.5,
  zeroDirectionComponentIsNonFinite: Number.isNaN(withZero[0]),
  qPostDecrementFromZeroBecomesMinusOne: qZero.every((x) => x === -1),
  qPostDecrementDependsOnSeed: maxAbsDiff(qZero, qOther) === 3,
  explicitQSeedChangesFirstRadius: firstFromZeroQ.radius === Math.sqrt(3) && firstFromOneQ.radius === 0,
  oneQSeedHitsKnownOriginSingularity: firstFromOneQ.radius === 0
};

for (const [name, passed] of Object.entries(checks)) assert.equal(passed, true, name);

const result = {
  schema: 'kaopu-yohei-microscope-outer-state-probe/r68',
  status: 'candidate-partial',
  question: 'Does the published compact outer loop define portable deterministic state, and does d/=-d reverse the ray direction?',
  sourceExpression: 'float i,e,R,s; vec3 q,p,d=...; for(q--; i++<119.; i>89.?d/=-d:d){...}',
  normativeInputs: {
    glslSpec: 'Khronos OpenGL Shading Language 4.60.8',
    uninitializedRead: 'legal, value undefined',
    compoundAssignment: 'lvalue op= expression is equivalent to lvalue = lvalue op expression',
    vectorArithmetic: 'same-size vector arithmetic is component-wise'
  },
  explicitSeedCounterexamples: {
    iterationTraces: [zeroI, fiveI, negativeI],
    qPostDecrement: {
      fromZero: qZero,
      fromOther: qOther
    },
    firstPosition: {
      fromZeroQ: firstFromZeroQ,
      fromOneQ: firstFromOneQ,
      note: 'With identical explicit i/e/R/d seeds, q0=[1,1,1] reaches radius 0 while q0=[0,0,0] does not.'
    }
  },
  directionUpdate: {
    input: direction,
    source_d_divide_equals_negative_d: sourceUpdate,
    actual_negation: trueReversal,
    maxAbsDifference: maxAbsDiff(sourceUpdate, trueReversal),
    zeroComponentInput: [0, 0.5, 1],
    zeroComponentResult: withZero.map((x) => Number.isNaN(x) ? 'NaN' : x),
    zeroComponentClassification: 'undefined/non-finite boundary; do not normalize it into a portable rule'
  },
  undefinedFirstReadsInPublishedFragment: [
    { variable: 'q', site: 'q--', consequence: 'post-decrement reads an undefined old vector before writing it' },
    { variable: 'i', site: 'i++<119.', consequence: 'iteration count and branch boundary depend on an undefined old scalar' },
    { variable: 'e', site: 'e+=i/5e3', consequence: 'compound assignment reads an undefined old scalar' },
    { variable: 'R', site: 'd*e*R*.16', consequence: 'R is read before the later R=length(p) assignment' },
    { variable: 'o', site: 'o+=e*e/25.', consequence: 'initial value depends on the unavailable host wrapper/output contract' }
  ],
  checks,
  totals: { passed: Object.values(checks).filter(Boolean).length, total: Object.keys(checks).length },
  classifications: {
    observation: 'The article visibly declares i/e/R/s and q/p without initializers and visibly contains i++, e+=, q+=, R use-before-assignment, and d/=-d.',
    candidate: 'The typographic q dash is repaired as q--; exact source bytes and host wrapper remain unavailable.',
    currentBestView: 'The fragment is not a portable deterministic standalone program without an explicit initialization/host contract. d/=-d snaps each nonzero component to -1; it is not vector negation.',
    rejected: [
      'Uninitialized GLSL locals can be treated as portable zero initialization.',
      'd/=-d reverses the existing direction vector.',
      'One matching driver image proves defined cross-runtime semantics.'
    ],
    unknown: [
      'Original byte-exact source and exact host wrapper',
      'Whether the author intentionally relied on a particular compiler or host initialization behavior',
      'Original GLSL profile, precision, GPU, framebuffer and pixels',
      'Permission or license for adaptation and redistribution'
    ]
  },
  evidenceBoundary: 'This CPU probe checks explicit-seed consequences and source-token semantics. It is not an original GPU pixel observation or an independent physical root.'
};

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
