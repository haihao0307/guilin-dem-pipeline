// A conservative execution certificate, never a replacement distance/material.
// false = every supported f32 query on this pixel's entire forward finite ray
// is outside the original shed guard. true = execute the original groups.
const U = 2 ** -23, MIN_NORMAL = 2 ** -126;
const POSITION_LIMIT = 2048, MATRIX_LIMIT = 2048, RAY_LIMIT = 4096;
const scratch = new DataView(new ArrayBuffer(8));
function next(x, up) {
  if (!Number.isFinite(x)) return x;
  if (x === 0) return up ? Number.MIN_VALUE : -Number.MIN_VALUE;
  scratch.setFloat64(0, x); let bits = scratch.getBigUint64(0);
  bits += (x > 0) === up ? 1n : -1n;
  scratch.setBigUint64(0, bits); return scratch.getFloat64(0);
}
const down = x => next(x, false), up = x => next(x, true);
const I = (lo, hi = lo) => [lo, hi];
const magnitude = a => Math.max(Math.abs(a[0]), Math.abs(a[1]));
const realAdd = (a, b) => I(down(a[0] + b[0]), up(a[1] + b[1]));
const realSub = (a, b) => I(down(a[0] - b[1]), up(a[1] - b[0]));
function realMul(a, b) {
  const terms = [a[0] * b[0], a[0] * b[1], a[1] * b[0], a[1] * b[1]];
  return I(down(Math.min(...terms)), up(Math.max(...terms)));
}
function realDiv(a, b) {
  if (b[0] <= 0 && b[1] >= 0) throw Error('denominator-contains-zero');
  return realMul(a, I(down(1 / b[1]), up(1 / b[0])));
}
const hull = (a, b) => I(Math.min(a[0], b[0]), Math.max(a[1], b[1]));
// >= one binary32 ULP throughout [-x,x], deliberately doubled at powers of 2.
// MIN_NORMAL also encloses every possible subnormal flush-to-zero error.
function ulpBound(x) {
  if (!Number.isFinite(x) || x > 2 ** 60) throw Error('arithmetic-range');
  scratch.setFloat64(0, Math.max(x, MIN_NORMAL));
  const exponent = ((scratch.getUint32(0) >>> 20) & 2047) - 1023;
  return Math.max(MIN_NORMAL, 2 ** (exponent - 22));
}
function expand(a, error) { return I(down(a[0] - error), up(a[1] + error)); }
function rounded(a, ulps = 1) { return expand(a, up(ulps * ulpBound(magnitude(a)))); }
const add = (a, b) => rounded(realAdd(a, b));
const sub = (a, b) => rounded(realSub(a, b));
const mul = (a, b) => rounded(realMul(a, b));
const div = (a, b) => rounded(realDiv(a, b), 3);
function dot(a, b) {
  let sum = I(0), absolute = 0;
  for (let k = 0; k < a.length; k++) {
    const term = realMul(a[k], b[k]); sum = realAdd(sum, term);
    absolute = up(absolute + magnitude(term));
  }
  // At most 2*n-1 product/add roundings, in any reduction order or FMA
  // contraction. Every intermediate's magnitude is < 2*S in this bounded
  // domain. 2*n ULP(2*S) encloses their accumulated absolute error.
  return expand(sum, up(2 * a.length * ulpBound(up(2 * absolute))));
}
function inverseSqrt(a) {
  if (!(a[0] > MIN_NORMAL) || !Number.isFinite(a[1])) throw Error('normalization-range');
  return rounded(I(down(1 / Math.sqrt(a[1])), up(1 / Math.sqrt(a[0]))), 2);
}
function lengthOf(v) { return div(I(1), inverseSqrt(dot(v, v))); }
function normalized(v) {
  const d = dot(v, v), inv = inverseSqrt(d), len = div(I(1), inv);
  const inverseLength = div(I(1), len);
  // Enclose x/length(x), the specification's reciprocal-length example,
  // and the common reciprocal-sqrt lowering (with one fewer reciprocal).
  return v.map(c => hull(hull(div(c, len), mul(c, inverseLength)), mul(c, inv)));
}
function matrixProduct(a, b) {
  const out = [];
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++)
    out[4 * c + r] = dot([0, 1, 2, 3].map(k => a[r + k * 4]), b.slice(c * 4, c * 4 + 4));
  return out;
}
const matrixVector = (m, v) => [0, 1, 2, 3].map(r => dot([0, 1, 2, 3].map(k => m[r + 4 * k]), v));

export const SHED_CERTIFICATE_CONTRACT = Object.freeze({
  version: 'shed-empty-domain-f32-interval-r01',
  groups: Object.freeze([4, 5, 6, 7, 8]),
  guard: 'shedBox<2.', center: Object.freeze([0, 7, -77.5]),
  half: Object.freeze([34, 8, Math.fround(Math.fround(67.5) + Math.fround(2.2))]),
  positionLimit: POSITION_LIMIT, matrixLimit: MATRIX_LIMIT, rayLimit: RAY_LIMIT,
  arithmetic: 'GLSL ES 3.00 highp binary32; bounded basic/dot/division/inversesqrt error; uncertain retains original groups',
});

// If any q_i > 0, box's min(max(q),0) term is exactly zero. For max(q)>=2,
// length(max(q,0)) has a <32*U relative-error enclosure: <=5 elementary
// dot roundings, <=2 ULP inverse sqrt, <=3 ULP reciprocal/division, and
// subnormal flush errors far below this allowance. Thus box<2 requires
// q_i < 2/(1-32*U). Add separately bounded p-center and abs(...)-half errors.
function guardBounds() {
  const radius = up(2 / (1 - 32 * U)), {center, half} = SHED_CERTIFICATE_CONTRACT;
  const lo = [], hi = [];
  for (let k = 0; k < 3; k++) {
    const first = ulpBound(POSITION_LIMIT + Math.abs(center[k]));
    const second = ulpBound(POSITION_LIMIT + Math.abs(center[k]) + first + half[k]);
    const extent = up(half[k] + radius + first + second);
    lo[k] = down(center[k] - extent); hi[k] = up(center[k] + extent);
  }
  return Object.freeze({lo: Object.freeze(lo), hi: Object.freeze(hi)});
}
export const SHED_GUARD_INTERVAL_BOUNDS = guardBounds();

function rayIntervals(snapshot, x, y) {
  const {width, height, flipY, inverse, camera, combined} = snapshot;
  const ndc = [sub(mul(div(I(x + .5), I(width)), I(2)), I(1)), sub(mul(div(I(y + .5), I(height)), I(2)), I(1))];
  if (flipY) ndc[1] = I(-ndc[1][1], -ndc[1][0]);
  function point(z) {
    const v = [...ndc, I(z), I(1)];
    const left = matrixVector(combined, v);
    // Also enclose reassociation of the two original matrix products.
    const right = matrixVector(camera, matrixVector(inverse, v));
    const p = left.map((a, i) => hull(a, right[i]));
    if (p[3][0] <= 0 && p[3][1] >= 0 || Math.min(Math.abs(p[3][0]), Math.abs(p[3][1])) < 2 ** -32) throw Error('unprojection-w');
    return p.slice(0, 3).map(a => div(a, p[3]));
  }
  const ro = point(-1), far = point(1), delta = far.map((a, i) => sub(a, ro[i]));
  const length = lengthOf(delta), rd = normalized(delta);
  if (!(length[0] > 0) || length[1] > RAY_LIMIT || ro.some(a => magnitude(a) > POSITION_LIMIT) || far.some(a => magnitude(a) > POSITION_LIMIT)) throw Error('ray-range');
  return {ro, rd, length};
}

function certifyMiss({ro, rd, length}) {
  const maximumT = length[1];
  if (!(maximumT > 0 && maximumT <= RAY_LIMIT)) return false;
  const boxes = [];
  for (let axis = 0; axis < 3; axis++) {
    const r = ro[axis], d = rd[axis];
    if (![...r, ...d].every(Number.isFinite)) return false;
    const productBound = up(magnitude(d) * maximumT);
    const productError = ulpBound(productBound);
    const sumBound = up(magnitude(r) + productBound + productError);
    const addError = ulpBound(sumBound);
    // Original p expression also adds the zero offset. Include that final
    // rounding even though exact +0 would usually be a no-op.
    const offsetError = ulpBound(sumBound + addError);
    if (sumBound + addError + offsetError > POSITION_LIMIT) return false;
    const error = up(productError + addError + offsetError);
    boxes.push([down(SHED_GUARD_INTERVAL_BOUNDS.lo[axis] - error), up(SHED_GUARD_INTERVAL_BOUNDS.hi[axis] + error)]);
  }
  let enter = 0, leave = maximumT;
  for (let axis = 0; axis < 3; axis++) {
    const r = ro[axis], d = rd[axis], [lo, hi] = boxes[axis];
    if (d[0] <= 0 && d[1] >= 0) {
      const possible = realAdd(r, realMul(d, I(0, maximumT)));
      if (possible[1] < lo || possible[0] > hi) return true;
      continue; // Parallel/uncertain axis cannot further narrow possible t.
    }
    const lowTimes = realDiv(realSub(I(lo), r), d), highTimes = realDiv(realSub(I(hi), r), d);
    // Union over every admitted origin/direction: use the lowest possible
    // entry and highest possible exit, never nominal-ray slab distances.
    const axisEnter = d[0] > 0 ? lowTimes[0] : highTimes[0];
    const axisLeave = d[0] > 0 ? highTimes[1] : lowTimes[1];
    enter = Math.max(enter, axisEnter); leave = Math.min(leave, axisLeave);
    if (enter > leave) return true;
  }
  return false; // Touching the enclosure is deliberately retained.
}

export function createShedRayCertificate({inverseProjection, cameraToLocal, width, height, flipY = 0, precision} = {}) {
  let reason = 'qualified-bounded-f32-interval', snapshot = null, key = null;
  const stats = {evaluatedPixels: 0, excludedPixels: 0, eligiblePixels: 0, uncertainPixels: 0, cacheHits: 0};
  try {
    if (![width, height].every(n => Number.isInteger(n) && n > 0 && n <= 16384) || ![0, 1, false, true].includes(flipY)) throw Error('viewport-unqualified');
    if (precision?.precision !== 23 || precision.rangeMin < 127 || precision.rangeMax < 127 || !Number.isFinite(precision.rangeMin) || !Number.isFinite(precision.rangeMax)) throw Error('highp-unqualified');
    const matrices = [inverseProjection, cameraToLocal].map(a => {
      if (!a || a.length !== 16 || !Array.from(a).every(Number.isFinite)) throw Error('matrix-unqualified');
      const f = Array.from(a, Math.fround);
      if (!f.every(n => Number.isFinite(n) && Math.abs(n) <= MATRIX_LIMIT)) throw Error('matrix-range');
      return f;
    });
    const [inverseValues, cameraValues] = matrices, inverse = inverseValues.map(n => I(n)), camera = cameraValues.map(n => I(n));
    snapshot = {width, height, flipY: !!flipY, inverse, camera, combined: matrixProduct(camera, inverse)};
    key = JSON.stringify([SHED_CERTIFICATE_CONTRACT.version, width, height, !!flipY, ...matrices, precision.precision, precision.rangeMin, precision.rangeMax]);
  } catch (error) { reason = error.message; }
  const cache = new Map();
  function eligible(x, y) {
    if (!snapshot || ![x, y].every(Number.isInteger) || x < 0 || y < 0 || x >= width || y >= height) return true;
    const id = y * width + x;
    if (cache.has(id)) { stats.cacheHits++; return cache.get(id); }
    let keep = true;
    try { keep = !certifyMiss(rayIntervals(snapshot, x, y)); }
    catch { stats.uncertainPixels++; }
    stats.evaluatedPixels++; stats[keep ? 'eligiblePixels' : 'excludedPixels']++;
    cache.set(id, keep); return keep;
  }
  const certificate = {width, height, key, qualified: snapshot !== null, reason, stats, eligible, pixelEligible: eligible};
  certificate.partitionRects = rects => clipShedEligibleRects(rects, certificate);
  return certificate;
}

export function clipShedEligibleRects(rects, certificate) {
  const {width, height} = certificate;
  if (rects == null) rects = [{x: 0, y: 0, w: width, h: height}];
  if (!Array.isArray(rects) || !rects.every(r => r && ['x', 'y', 'w', 'h'].every(k => Number.isInteger(r[k])) && r.x >= 0 && r.y >= 0 && r.w > 0 && r.h > 0 && r.x + r.w <= width && r.y + r.h <= height)) throw Error('Invalid shed query rectangles');
  // Input coverage is normally disjoint. Union row intervals also makes
  // overlapping diagnostic requests deterministic and prevents duplicate draws.
  const rows = new Map();
  for (const r of rects) for (let y = r.y; y < r.y + r.h; y++) {
    if (!rows.has(y)) rows.set(y, []); rows.get(y).push([r.x, r.x + r.w]);
  }
  const output = []; let totalPixels = 0, eligiblePixels = 0, previous = new Map(), previousY = -2;
  for (const [y, intervals] of [...rows].sort((a, b) => a[0] - b[0])) {
    intervals.sort((a, b) => a[0] - b[0]); const union = [];
    for (const span of intervals) { const last = union.at(-1); if (last && span[0] <= last[1]) last[1] = Math.max(last[1], span[1]); else union.push(span.slice()); }
    const next = new Map(); if (y !== previousY + 1) previous = new Map();
    for (const [lo, hi] of union) {
      totalPixels += hi - lo;
      for (let x = lo; x < hi;) {
        if (!certificate.eligible(x, y)) { x++; continue; }
        const start = x++; while (x < hi && certificate.eligible(x, y)) x++;
        const w = x - start, id = start + ':' + w; eligiblePixels += w;
        let rect = previous.get(id); if (rect) rect.h++; else { rect = {x: start, y, w, h: 1}; output.push(rect); }
        next.set(id, rect);
      }
    }
    previous = next; previousY = y;
  }
  return {rects: output, totalPixels, queriedPixels: totalPixels, eligiblePixels, excludedPixels: totalPixels - eligiblePixels};
}

// Pure math hooks for counterexample/rounding tests; never GPU evidence.
export const SHED_CERTIFICATE_TESTING = Object.freeze({I, add, sub, mul, div, dot, inverseSqrt, normalized, lengthOf, certifyMiss,
  rayIntervalsAt(options, x, y) {
    const inverse = Array.from(options.inverseProjection, n => I(Math.fround(n)));
    const camera = Array.from(options.cameraToLocal, n => I(Math.fround(n)));
    return rayIntervals({...options, inverse, camera, combined: matrixProduct(camera, inverse)}, x, y);
  },
});
