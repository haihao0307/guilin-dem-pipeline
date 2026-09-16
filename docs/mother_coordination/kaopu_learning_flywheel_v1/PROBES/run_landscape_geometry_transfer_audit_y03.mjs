import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';

const SOURCE_URL = 'https://raw.githubusercontent.com/haihao0307/guilin-dem-pipeline/83d3649728e1eb2c21c995f42e9bb0026c20a464/workbenches/landscape-microscope-geometry-r1/index.html';
const EXPECTED_SHA256 = '1e7404a272b1887908030743d83eea17f63c491ce4c62211dfb1313882b24c52';
const response = await fetch(SOURCE_URL);
if (!response.ok) throw new Error(`source fetch failed: ${response.status}`);
const source = await response.text();
const sourceSha256 = createHash('sha256').update(source).digest('hex');

const requiredSnippets = [
  'const H=28, NT=196, NY=154',
  'octaveMeans[j]=s/c',
  'function mappedDetail(x,y,z,th,ell,N,dir,warp)',
  'let state={amp:.55,scale:2.6,layers:6,direction:18*Math.PI/180,warp:.42,bias:.32',
  'let eroded=d-state.bias*Math.max(0,d)*Math.max(0,d)',
  'if(gate[id]<1e-7)'
];

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const smooth = (a, b, x) => {
  x = clamp((x - a) / (b - a));
  return x * x * (3 - 2 * x);
};
const H = 28, NT = 196, NY = 154, SIDE = NT * NY, VCOUNT = SIDE + 2;
const TOP = SIDE, BOTTOM = SIDE + 1;
const basePos = new Float64Array(VCOUNT * 3);
const gate = new Float64Array(VCOUNT);
const indices = [];
function mainRadius(th, t) {
  const core = 7.4 * (1 - .23 * t + .10 * Math.sin(Math.PI * t));
  const lobes = .72 * Math.sin(2 * th + .55) * Math.pow(Math.sin(Math.PI * clamp(t, .02, .98)), 1.15)
    + .24 * Math.sin(5 * th + 1.4) * (1 - .45 * t);
  const foot = .72 * Math.exp(-t * 10), top = -2.25 * Math.pow(smooth(.78, 1, t), 1.65);
  return Math.max(2.45, core + lobes + foot + top);
}
for (let j = 0; j < NY; j++) {
  const t = j / (NY - 1), y = H * t;
  for (let i = 0; i < NT; i++) {
    const th = i / NT * Math.PI * 2, r = mainRadius(th, t), k = (j * NT + i) * 3;
    basePos[k] = Math.cos(th) * r;
    basePos[k + 1] = y + .12 * Math.sin(th * 3) * smooth(.86, 1, t);
    basePos[k + 2] = Math.sin(th) * r * .82;
    gate[j * NT + i] = smooth(.055, .14, t) * (1 - smooth(.865, .955, t));
  }
}
basePos[TOP * 3] = 0; basePos[TOP * 3 + 1] = H + .75; basePos[TOP * 3 + 2] = 0;
basePos[BOTTOM * 3] = 0; basePos[BOTTOM * 3 + 1] = -.55; basePos[BOTTOM * 3 + 2] = 0;
gate[TOP] = gate[BOTTOM] = 0;
for (let j = 0; j < NY - 1; j++) for (let i = 0; i < NT; i++) {
  const n = (i + 1) % NT, a = j * NT + i, b = j * NT + n, c = (j + 1) * NT + n, d = (j + 1) * NT + i;
  indices.push(a, c, b, a, d, c);
}
for (let i = 0; i < NT; i++) {
  const n = (i + 1) % NT, ta = (NY - 1) * NT + i, tb = (NY - 1) * NT + n, ba = i, bb = n;
  indices.push(TOP, tb, ta, BOTTOM, ba, bb);
}
function normals(P) {
  const N = new Float64Array(P.length);
  for (let q = 0; q < indices.length; q += 3) {
    const ai = indices[q] * 3, bi = indices[q + 1] * 3, ci = indices[q + 2] * 3;
    const ux = P[bi] - P[ai], uy = P[bi + 1] - P[ai + 1], uz = P[bi + 2] - P[ai + 2];
    const vx = P[ci] - P[ai], vy = P[ci + 1] - P[ai + 1], vz = P[ci + 2] - P[ai + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const k of [ai, bi, ci]) { N[k] += nx; N[k + 1] += ny; N[k + 2] += nz; }
  }
  for (let k = 0; k < N.length; k += 3) {
    const l = Math.hypot(N[k], N[k + 1], N[k + 2]) || 1;
    N[k] /= l; N[k + 1] /= l; N[k + 2] /= l;
  }
  return N;
}
const baseNor = normals(basePos);
function kernel(u, v, w) {
  return Math.cos(Math.cos(w) * Math.cos(u) + Math.cos(v) * Math.cos(v) + Math.cos(v) * Math.cos(u));
}
const octaveMeans = [];
for (let j = 0, f = 1; j < 9; j++, f *= 2) {
  let s = 0, c = 0;
  for (let y = 7; y < NY - 7; y += 3) for (let x = 0; x < NT; x += 3) {
    const k = (y * NT + x) * 3, px = basePos[k] / 2.6, py = basePos[k + 1] / (2.6 * 2.1), pz = basePos[k + 2] / 2.6;
    s += kernel(px * f, py * f, pz * f); c++;
  }
  octaveMeans[j] = s / c;
}
function mappedDetail(x, y, z, th, ell, N, dir, warp) {
  const ang = dir + warp * (.32 * Math.sin(y * .16) + .18 * Math.sin(th * 2.3 + y * .07));
  const ca = Math.cos(ang), sa = Math.sin(ang), qx = (ca * x - sa * z) / ell;
  const qz = (sa * x + ca * z) / ell, qy = y / (ell * 2.1);
  let sum = 0, f = 1;
  for (let j = 0; j < N; j++, f *= 2) sum += .5 * (kernel(qx * f, qy * f, qz * f) - octaveMeans[j]) / f;
  return sum;
}
const edges = new Set();
for (let q = 0; q < indices.length; q += 3) {
  const tri = [indices[q], indices[q + 1], indices[q + 2]];
  for (const [a0, b0] of [[tri[0], tri[1]], [tri[1], tri[2]], [tri[2], tri[0]]]) {
    const a = Math.min(a0, b0), b = Math.max(a0, b0); edges.add(`${a},${b}`);
  }
}
function percentile(values, p) {
  const a = [...values].sort((x, y) => x - y);
  return a[Math.min(a.length - 1, Math.floor((a.length - 1) * p))];
}
function audit(settings) {
  const detail = new Float64Array(VCOUNT), offset = new Float64Array(VCOUNT);
  let sumD = 0, sumDActive = 0, sumO = 0, sumOActive = 0, active = 0, protectedCount = 0, protectedDrift = 0;
  for (let j = 0; j < NY; j++) for (let i = 0; i < NT; i++) {
    const id = j * NT + i, k = id * 3, th = i / NT * Math.PI * 2;
    const d = mappedDetail(basePos[k], basePos[k + 1], basePos[k + 2], th, settings.scale, settings.layers, settings.direction, settings.warp);
    const eroded = d - settings.bias * Math.max(0, d) ** 2;
    const off = settings.amp * gate[id] * eroded;
    detail[id] = d; offset[id] = off; sumD += d; sumO += off;
    if (gate[id] > 1e-7) { active++; sumDActive += d; sumOActive += off; }
    else { protectedCount++; if (off !== 0) protectedDrift++; }
  }
  protectedCount += 2;
  const slopes = [], transitionSlopes = [];
  for (const key of edges) {
    const [a, b] = key.split(',').map(Number);
    const ak = a * 3, bk = b * 3;
    const len = Math.hypot(basePos[ak] - basePos[bk], basePos[ak + 1] - basePos[bk + 1], basePos[ak + 2] - basePos[bk + 2]);
    if (!len) continue;
    const slope = Math.abs(offset[a] - offset[b]) / len;
    slopes.push(slope);
    if (Math.min(gate[a], gate[b]) < .2 && Math.max(gate[a], gate[b]) > 0) transitionSlopes.push(slope);
  }
  return {
    settings,
    meanDetailAll: sumD / VCOUNT,
    meanDetailActive: sumDActive / active,
    meanNormalOffsetAllM: sumO / VCOUNT,
    meanNormalOffsetActiveM: sumOActive / active,
    protectedCount,
    protectedDrift,
    derivativeProxy: {
      definition: 'absolute normal-offset difference divided by base edge length',
      max: Math.max(...slopes), p95: percentile(slopes, .95),
      transitionMax: Math.max(...transitionSlopes), transitionP95: percentile(transitionSlopes, .95)
    }
  };
}
const deg = x => x * Math.PI / 180;
const defaults = { amp: .55, scale: 2.6, layers: 6, direction: deg(18), warp: .42, bias: .32 };
const cases = {
  default: audit(defaults),
  noBias: audit({ ...defaults, bias: 0 }),
  noRotationWarp: audit({ ...defaults, direction: 0, warp: 0 }),
  scaleLow: audit({ ...defaults, scale: .8 }),
  scaleHigh: audit({ ...defaults, scale: 6 }),
  layers1: audit({ ...defaults, layers: 1 }),
  layers3: audit({ ...defaults, layers: 3 }),
  layers9: audit({ ...defaults, layers: 9 })
};
const checks = {
  sourceHttp200: response.status === 200,
  sourceSha256Locked: sourceSha256 === EXPECTED_SHA256,
  sourceContractSnippetsPresent: requiredSnippets.every(s => source.includes(s)),
  exactProtectedAnchorsPass: Object.values(cases).every(x => x.protectedDrift === 0),
  defaultMappedMeanNotNeutral: Math.abs(cases.default.meanDetailActive) > 1e-6,
  nonlinearBiasChangesMean: Math.abs(cases.default.meanNormalOffsetActiveM - cases.noBias.meanNormalOffsetActiveM) > 1e-6,
  transformControlsChangeMean: Math.abs(cases.default.meanDetailActive - cases.noRotationWarp.meanDetailActive) > 1e-6,
  scaleControlsChangeMean: Math.abs(cases.scaleLow.meanDetailActive - cases.scaleHigh.meanDetailActive) > 1e-6,
  derivativeProxyNotMonotoneAttenuatedByLayers: cases.layers9.derivativeProxy.max >= cases.layers1.derivativeProxy.max,
  transitionDerivativeMeasuredNotGatedByExistingQA: cases.default.derivativeProxy.transitionMax > 0
};
const result = {
  schema: 'kaopu-landscape-y03-transfer-audit/1',
  date: '2026-09-16',
  question: 'Does the current isolated Landscape geometry lab satisfy Y01 anchor, mean and derivative constraints?',
  source: { url: SOURCE_URL, httpStatus: response.status, bytes: Buffer.byteLength(source), sha256: sourceSha256, expectedSha256: EXPECTED_SHA256 },
  lockedImplementation: { vertices: VCOUNT, triangles: indices.length / 3, octaveMeans, requiredSnippets },
  cases,
  checks,
  passed: Object.values(checks).every(Boolean),
  classification: {
    anchors: 'Observation pass for exact M=0 vertices in this CPU replay',
    mean: 'Candidate fail for mean-neutral transfer: mapped and biased active-field means are nonzero and control-dependent',
    derivatives: 'Unknown acceptance: derivative proxies are measurable but the implementation defines no physical derivative budget or pass threshold',
    geometry: 'Observation from source/replay that vertex positions are changed; browser visual acceptance remains separate',
    production: 'Frozen/unchanged'
  },
  limitations: [
    'CPU Float64 replay is not a browser WebGL observation root.',
    'Edge displacement slope is a derivative proxy, not full surface curvature or geologic validation.',
    'A nonzero mean may be an intentional uncalibrated erosion bias, but it cannot be called mean-preserving.',
    'No production branch, R5/K2 geometry, DEM, collision, or user acceptance was tested.'
  ]
};
await writeFile(process.argv[2] ?? 'landscape_geometry_transfer_audit_result_y03.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
if (!result.passed) process.exitCode = 1;
