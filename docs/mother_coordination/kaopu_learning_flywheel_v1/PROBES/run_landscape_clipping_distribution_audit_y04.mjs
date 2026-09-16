import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';

const HEAD = '21861af63591d42bb84b9a88e00ef645ffc55b76';
const BASE = `https://raw.githubusercontent.com/haihao0307/guilin-dem-pipeline/${HEAD}`;
const SOURCE_URL = `${BASE}/workbenches/landscape-surface-r5-k2-geometry-r1/index.html`;
const QA_URL = `${BASE}/workbenches/landscape-surface-r5-k2-geometry-r1/runtime-qa.json`;
const EXPECTED_SOURCE_SHA256 = '36ca41019aaa9f05b027a9129d7a531750254b29625ec2b896cd29ec2cb8f7ec';
const EXPECTED_QA_SHA256 = 'b7d16e5d56913875d6cd124a3968bf6c211cdf20625823332c9fdf2cf4eced43';

const [sourceResponse, qaResponse] = await Promise.all([fetch(SOURCE_URL), fetch(QA_URL)]);
if (!sourceResponse.ok) throw new Error(`source fetch failed: ${sourceResponse.status}`);
if (!qaResponse.ok) throw new Error(`QA fetch failed: ${qaResponse.status}`);
const source = await sourceResponse.text();
const qaText = await qaResponse.text();
const qa = JSON.parse(qaText);
const sourceSha256 = createHash('sha256').update(source).digest('hex');
const qaSha256 = createHash('sha256').update(qaText).digest('hex');

function textScript(id) {
  const marker = `<script id="${id}" type="text/plain">`;
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`${id} start not found`);
  const bodyStart = start + marker.length;
  const end = source.indexOf('</script>', bodyStart);
  if (end < 0) throw new Error(`${id} end not found`);
  return source.slice(bodyStart, end);
}

const worldSource = textScript('worldSource');
let generateSource = textScript('generateSource');

const replacements = [
  [
    'function mapped(x,y,z,f,mean){let th=Math.atan2(z,x),',
    'function mapped(x,y,z,f,mean,thetaShift=0){let th=Math.atan2(z,x)+thetaShift,'
  ],
  [
    'function detailAt(i){let k=i*3,x=P0[k],y=P0[k+1],z=P0[k+2],sum=0,f=1;for(let j=0;j<layers;j++,f*=2)sum+=.5*mapped(x,y,z,f,means[j])/f;return sum}',
    'function detailAt(i,thetaShift=0){let k=i*3,x=P0[k],y=P0[k+1],z=P0[k+2],sum=0,f=1;for(let j=0;j<layers;j++,f*=2)sum+=.5*mapped(x,y,z,f,means[j],thetaShift)/f;return sum}'
  ],
  [
    'function build(A){let P=new Float32Array(P0),disp=new Float32Array(count),sum2=0,maxD=0,protectedCount=0,protectedDrift=0,clippedVertexCount=0,minAppliedCap=Infinity,maxAppliedCap=0;',
    'function build(A){let P=new Float32Array(P0),disp=new Float32Array(count),rawDisp=new Float64Array(count),caps=new Float64Array(count),gates=new Float64Array(count),details=new Float64Array(count),sum2=0,maxD=0,protectedCount=0,protectedDrift=0,clippedVertexCount=0,minAppliedCap=Infinity,maxAppliedCap=0;'
  ],
  [
    'let d=detailAt(i),eroded=d-bias*Math.max(0,d)*Math.max(0,d),rawOff=A*g*eroded,cap=Math.max(1e-6,localScale[i]*meshSafetyFraction),off=clamp(rawOff,-cap,cap);',
    'let d=detailAt(i),eroded=d-bias*Math.max(0,d)*Math.max(0,d),rawOff=A*g*eroded,cap=Math.max(1e-6,localScale[i]*meshSafetyFraction),off=clamp(rawOff,-cap,cap);rawDisp[i]=rawOff;caps[i]=cap;gates[i]=g;details[i]=d;'
  ],
  [
    'return{P,disp,maxD,rms:Math.sqrt(sum2/count),protectedCount,protectedDrift,flips,clippedVertexCount,minAppliedCap:Number.isFinite(minAppliedCap)?minAppliedCap:0,maxAppliedCap}}',
    'return{P,disp,rawDisp,caps,gates,details,maxD,rms:Math.sqrt(sum2/count),protectedCount,protectedDrift,flips,clippedVertexCount,minAppliedCap:Number.isFinite(minAppliedCap)?minAppliedCap:0,maxAppliedCap}}'
  ],
  [
    "mesh.positions=chosen.P;mesh.N=N;mesh.microscopeGeometry={schema:'LANDSCAPE_MICROSCOPE_GEOMETRY_R1'",
    "mesh.__y04={P0,N0,I,chosen,localScale,means,detailAt,gateAt,requestedAmp,effectiveAmp,layers,bias,meshSafetyFraction};mesh.positions=chosen.P;mesh.N=N;mesh.microscopeGeometry={schema:'LANDSCAPE_MICROSCOPE_GEOMETRY_R1'"
  ]
];
for (const [before, after] of replacements) {
  if (!generateSource.includes(before)) throw new Error(`instrumentation target missing: ${before.slice(0, 80)}`);
  generateSource = generateSource.replace(before, after);
}

const { World, TerrainSupport } = new Function(`${worldSource};return {World,TerrainSupport};`)();
const { microscopeGeometryR1 } = new Function('World', 'TerrainSupport', 'performance', `${generateSource};return {microscopeGeometryR1};`)(World, TerrainSupport, performance);

const config = { schema: 'landscape-function-world/1', core: 'limestone-water-2', seed: 83, stage: 4, fracture: 1, relief: 1 };
const world = World.create(config);
const fullMain = World.mesh(world.rock, world.bounds[0], world.bounds[1], .5);
const mainGroups = World.splitComponents(fullMain);
for (const mesh of mainGroups) TerrainSupport.orient(mesh);
const main = mainGroups[0];
main.rest = main.positions.slice();
main.N = World.normals(main.positions, main.indices);
const report = microscopeGeometryR1(main, { amp: .22, scale: 2.6, layers: 6, gridStep: .5, meshSafetyFraction: .08, directionDeg: 18, warp: .42, bias: .32 });
const audit = main.__y04;
const { P0, I, chosen, detailAt, bias, effectiveAmp } = audit;
const { gates, caps, details } = chosen;
const count = P0.length / 3;

function quantile(values, q) {
  const a = Array.from(values).sort((x, y) => x - y);
  if (!a.length) return null;
  const p = (a.length - 1) * q, lo = Math.floor(p), hi = Math.ceil(p), t = p - lo;
  return a[lo] * (1 - t) + a[hi] * t;
}
function summary(values) {
  let sum = 0, sum2 = 0, min = Infinity, max = -Infinity;
  for (const x of values) { sum += x; sum2 += x * x; min = Math.min(min, x); max = Math.max(max, x); }
  return { count: values.length, min, p05: quantile(values, .05), p50: quantile(values, .5), p95: quantile(values, .95), max, mean: sum / values.length, rms: Math.sqrt(sum2 / values.length) };
}
function weighted(values, weights, ids) {
  let w = 0, sum = 0, sumAbs = 0, sum2 = 0;
  for (const i of ids) { const wi = weights[i], x = values[i]; w += wi; sum += wi * x; sumAbs += wi * Math.abs(x); sum2 += wi * x * x; }
  return { weight: w, mean: sum / w, meanAbs: sumAbs / w, rms: Math.sqrt(sum2 / w) };
}

const vertexArea = new Float64Array(count);
const edgeSet = new Set();
for (let q = 0; q < I.length; q += 3) {
  const a = I[q], b = I[q + 1], c = I[q + 2], A = a * 3, B = b * 3, C = c * 3;
  const ux = P0[B] - P0[A], uy = P0[B + 1] - P0[A + 1], uz = P0[B + 2] - P0[A + 2];
  const vx = P0[C] - P0[A], vy = P0[C + 1] - P0[A + 1], vz = P0[C + 2] - P0[A + 2];
  const area = .5 * Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
  vertexArea[a] += area / 3; vertexArea[b] += area / 3; vertexArea[c] += area / 3;
  for (const [u0, v0] of [[a, b], [b, c], [c, a]]) { const u = Math.min(u0, v0), v = Math.max(u0, v0); edgeSet.add(`${u},${v}`); }
}

const active = [], clipped = [], raw = chosen.rawDisp, applied = chosen.disp;
const rawActive = [], appliedActive = [], capActive = [], retention = [];
let rawAbsSum = 0, appliedAbsSum = 0, rawSqSum = 0, appliedSqSum = 0;
for (let i = 0; i < count; i++) {
  if (gates[i] <= 1e-7) continue;
  active.push(i); rawActive.push(raw[i]); appliedActive.push(applied[i]); capActive.push(caps[i]);
  const ar = Math.abs(raw[i]), aa = Math.abs(applied[i]);
  rawAbsSum += ar; appliedAbsSum += aa; rawSqSum += raw[i] ** 2; appliedSqSum += applied[i] ** 2;
  if (Math.abs(raw[i]) > caps[i] + 1e-12) clipped.push(i);
  if (ar > 1e-15) retention.push(aa / ar);
}

const activeArea = active.reduce((s, i) => s + vertexArea[i], 0);
const clippedArea = clipped.reduce((s, i) => s + vertexArea[i], 0);
const clippedSet = new Set(clipped);

let minY = Infinity, maxY = -Infinity;
for (let i = 0; i < count; i++) { minY = Math.min(minY, P0[i * 3 + 1]); maxY = Math.max(maxY, P0[i * 3 + 1]); }
const heightBands = Array.from({ length: 10 }, (_, band) => {
  const ids = active.filter(i => Math.min(9, Math.floor((P0[i * 3 + 1] - minY) / (maxY - minY) * 10)) === band);
  const clipIds = ids.filter(i => clippedSet.has(i));
  const area = ids.reduce((s, i) => s + vertexArea[i], 0), clipArea = clipIds.reduce((s, i) => s + vertexArea[i], 0);
  return {
    band,
    normalizedY: [band / 10, (band + 1) / 10],
    activeVertices: ids.length,
    clippedVertices: clipIds.length,
    clippedVertexFraction: clipIds.length / ids.length,
    clippedAreaFraction: clipArea / area,
    areaWeightedRaw: weighted(raw, vertexArea, ids),
    areaWeightedApplied: weighted(applied, vertexArea, ids)
  };
});

const periodicRawDiff = [], periodicAppliedDiff = [];
let periodicDefectVertices = 0, defectMaskedByClipping = 0, periodicRawAreaSum = 0, periodicAppliedAreaSum = 0;
for (const i of active) {
  const shiftedDetail = detailAt(i, Math.PI * 2);
  const shiftedEroded = shiftedDetail - bias * Math.max(0, shiftedDetail) ** 2;
  const shiftedRaw = effectiveAmp * gates[i] * shiftedEroded;
  const shiftedApplied = Math.fround(Math.max(-caps[i], Math.min(caps[i], shiftedRaw)));
  const dr = Math.abs(shiftedRaw - raw[i]), da = Math.abs(shiftedApplied - applied[i]);
  periodicRawDiff.push(dr); periodicAppliedDiff.push(da);
  periodicRawAreaSum += vertexArea[i] * dr; periodicAppliedAreaSum += vertexArea[i] * da;
  if (dr > 1e-12) { periodicDefectVertices++; if (da <= 1e-12) defectMaskedByClipping++; }
}

const seamRawSlopes = [], seamAppliedSlopes = [], ordinaryRawSlopes = [], ordinaryAppliedSlopes = [];
for (const key of edgeSet) {
  const [a, b] = key.split(',').map(Number);
  if (gates[a] <= 1e-7 || gates[b] <= 1e-7) continue;
  const A = a * 3, B = b * 3;
  const len = Math.hypot(P0[A] - P0[B], P0[A + 1] - P0[B + 1], P0[A + 2] - P0[B + 2]);
  if (!len) continue;
  const ta = Math.atan2(P0[A + 2], P0[A]), tb = Math.atan2(P0[B + 2], P0[B]);
  const seam = Math.abs(ta - tb) > Math.PI;
  (seam ? seamRawSlopes : ordinaryRawSlopes).push(Math.abs(raw[a] - raw[b]) / len);
  (seam ? seamAppliedSlopes : ordinaryAppliedSlopes).push(Math.abs(applied[a] - applied[b]) / len);
}
const periodicRawSummary = summary(periodicRawDiff);
const periodicAppliedSummary = summary(periodicAppliedDiff);

const result = {
  schema: 'kaopu-landscape-y04-clipping-distribution-audit/1',
  date: '2026-09-16',
  question: 'How does the current per-vertex safety clamp change displacement distribution and periodic-domain error in PR #79 head?',
  source: {
    head: HEAD,
    source: { url: SOURCE_URL, httpStatus: sourceResponse.status, sha256: sourceSha256, expectedSha256: EXPECTED_SOURCE_SHA256 },
    runtimeQa: { url: QA_URL, httpStatus: qaResponse.status, sha256: qaSha256, expectedSha256: EXPECTED_QA_SHA256 }
  },
  replay: {
    vertices: count,
    triangles: I.length / 3,
    activeVertices: active.length,
    protectedVertices: report.protectedVertexCount,
    clippedVertices: clipped.length,
    clippedVertexFractionActive: clipped.length / active.length,
    clippedVertexFractionTotal: clipped.length / count,
    clippedAreaFractionActive: clippedArea / activeArea,
    requestedAmplitudeM: report.requestedAmplitudeM,
    effectiveAmplitudeM: report.effectiveAmplitudeM,
    requestedLayers: report.requestedLayers,
    effectiveLayers: report.effectiveLayers,
    rawOffsetM: summary(rawActive),
    appliedOffsetM: summary(appliedActive),
    capM: summary(capActive),
    magnitudeRetention: summary(retention),
    vertexL1MagnitudeRetention: appliedAbsSum / rawAbsSum,
    vertexL2EnergyRetention: appliedSqSum / rawSqSum,
    areaWeightedRaw: weighted(raw, vertexArea, active),
    areaWeightedApplied: weighted(applied, vertexArea, active),
    heightBands
  },
  periodicity: {
    definition: 'same physical x/y/z and field inputs, with angular coordinate shifted by exactly 2pi',
    rawOffsetDifferenceM: periodicRawSummary,
    appliedOffsetDifferenceM: periodicAppliedSummary,
    areaWeightedMeanRawDifferenceM: periodicRawAreaSum / activeArea,
    areaWeightedMeanAppliedDifferenceM: periodicAppliedAreaSum / activeArea,
    defectVertices: periodicDefectVertices,
    defectVerticesMaskedToZeroByClamp: defectMaskedByClipping,
    branchCutEdgeSlope: { raw: summary(seamRawSlopes), applied: summary(seamAppliedSlopes) },
    ordinaryEdgeSlope: { raw: summary(ordinaryRawSlopes), applied: summary(ordinaryAppliedSlopes) }
  },
  checks: {
    sourceLocksPass: sourceSha256 === EXPECTED_SOURCE_SHA256 && qaSha256 === EXPECTED_QA_SHA256,
    vertexCountMatchesQa: count === qa.mainVertices,
    triangleCountMatchesQa: I.length / 3 === qa.mainTriangles,
    protectedCountMatchesQa: report.protectedVertexCount === qa.microscopeGeometry.protectedVertexCount,
    protectedDriftMatchesQa: report.protectedDriftCount === qa.microscopeGeometry.protectedDriftCount,
    flipCountMatchesQa: report.triangleFlipCount === qa.microscopeGeometry.triangleFlipCount,
    clippedCountMatchesQa: clipped.length === qa.microscopeGeometry.clippedVertexCount,
    maxDisplacementMatchesQa: Math.abs(report.maxDisplacementM - qa.microscopeGeometry.maxDisplacementM) < 1e-12,
    rmsDisplacementMatchesQa: Math.abs(report.rmsDisplacementM - qa.microscopeGeometry.rmsDisplacementM) < 1e-12,
    clippingChangesDistribution: appliedAbsSum < rawAbsSum && appliedSqSum < rawSqSum,
    periodicDefectReproduced: periodicDefectVertices > 0 && periodicRawSummary.max > 0,
    clampDoesNotProvePeriodicity: periodicAppliedSummary.max > 0
  },
  classification: {
    replay: 'Observation: exact CPU replay of the locked current source and QA contract',
    clamp: 'Candidate partial: topology safety improves, but clipping materially changes the field distribution',
    mean: 'Candidate measurement: area- and vertex-weighted pre/post-clamp means are recorded; physical acceptance remains Unknown',
    periodicity: 'Rejected as a closure: symmetric clamping may attenuate or mask some defects but does not make the 2.3-harmonic field periodic',
    topology: 'Observation pass in this replay: protected drift and triangle flips remain zero',
    physicalValidity: 'Unknown: no approved derivative, mean, or morphology threshold and no collision/SDF coupling',
    visualAcceptance: 'Unknown',
    production: 'Frozen/unchanged'
  },
  limitations: [
    'This is a CPU replay of the same source lineage, not a new browser or hardware Observation Root.',
    'One-third triangle area assigned to each incident vertex is a reproducible area-weighting approximation, not a volume-conservation proof.',
    'Branch-cut edge slope is a mesh diagnostic; it is not a physically approved curvature threshold.',
    'No Mother code, production branch, Canonical Truth, collision field or visual approval was modified.'
  ]
};
result.passed = Object.values(result.checks).every(Boolean);
await writeFile(process.argv[2] ?? 'landscape_clipping_distribution_result_y04.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
if (!result.passed) process.exitCode = 1;
