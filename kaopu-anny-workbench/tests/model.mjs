import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { gunzipSync } from 'node:zlib';
import { AnnyModel, specialProcrustes, interpolationWeights, eulerXYZDegrees, identity4, multiply4, rigidInverse4, PHENOTYPE_VARIATIONS } from '../src/AnnyModel.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const maxError = (a, b) => {
  assert.equal(a.length, b.length);
  let max = 0, squared = 0;
  for (let i = 0; i < a.length; i++) {
    assert(Number.isFinite(a[i]), `Non-finite value at ${i}`);
    const error = Math.abs(a[i] - b[i]);
    max = Math.max(max, error); squared += error * error;
  }
  return { max, rms: Math.sqrt(squared / a.length) };
};
const near = (actual, expected, tolerance, name) => {
  const error = maxError(actual, expected);
  assert(error.max <= tolerance, `${name}: max ${error.max} > ${tolerance}`);
  return error;
};
const det3 = a => a[0] * (a[4] * a[8] - a[5] * a[7]) - a[1] * (a[3] * a[8] - a[5] * a[6]) + a[2] * (a[3] * a[7] - a[4] * a[6]);

// Anchor order, exact boundary, clamping, extrapolation, and newborn range.
near(interpolationWeights(0.25, [0, 0.5, 1]), [0.5, 0.5, 0], 0, 'linear interpolation');
near(interpolationWeights(0.5, [0, 0.5, 1]), [0, 1, 0], 0, 'exact anchor');
near(interpolationWeights(-5, [0, 0.5, 1]), [1, 0, 0], 0, 'clamp lower');
near(interpolationWeights(5, [0, 0.5, 1]), [0, 0, 1], 0, 'clamp upper');
near(interpolationWeights(-0.5, [0, 0.5, 1], true), [2, -1, 0], 0, 'extrapolate');
near(interpolationWeights(-1 / 3, [-1 / 3, 0, 1 / 3, 2 / 3, 1]), [1, 0, 0, 0, 0], 0, 'newborn');
for (const euler of [[0, 0, 0], [90, 0, 0], [0, -90, 0], [0, 0, 180], [23, -61, 129]]) {
  const pose = eulerXYZDegrees(euler, [0.4, -0.2, 2]);
  near(multiply4(pose, rigidInverse4(pose)), identity4(), 1e-14, 'rigid inverse');
}
near(eulerXYZDegrees([90, 0, 0]), [1, 0, 0, 0, 0, 0, -1, 0, 0, 1, 0, 0, 0, 0, 0, 1], 1e-15, 'Rx convention');

const mathFixtures = JSON.parse(fs.readFileSync(path.join(root, 'tests/procrustes-fixtures.json')));
let maxRotationError = 0, maxObjectiveError = 0;
for (const fixture of mathFixtures.cases) {
  const r = specialProcrustes(fixture.matrix);
  assert(Math.abs(det3(r) - 1) < 5e-14, `${fixture.name}: det != +1`);
  const orthogonality = Array.from({ length: 9 }, (_, i) => {
    const row = Math.floor(i / 3), col = i % 3;
    return r[row] * r[col] + r[3 + row] * r[3 + col] + r[6 + row] * r[6 + col];
  });
  near(orthogonality, [1, 0, 0, 0, 1, 0, 0, 0, 1], 5e-14, `${fixture.name}: orthogonal`);
  const objective = fixture.matrix.reduce((sum, m, i) => sum + m * r[i], 0);
  maxObjectiveError = Math.max(maxObjectiveError, Math.abs(objective - fixture.objective));
  assert(Math.abs(objective - fixture.objective) < 1e-12, `${fixture.name}: objective mismatch`);
  if (!fixture.name.includes('nonunique')) {
    const tolerance = fixture.name.startsWith('random-') && Number(fixture.name.split('-')[1]) >= 96 ? 1e-4 : 1e-12;
    const error = near(r, fixture.rotation, tolerance, `${fixture.name}: roma rotation`);
    maxRotationError = Math.max(maxRotationError, error.max);
  }
}
console.log(`Math: ${mathFixtures.cases.length} Procrustes cases; max rotation error ${maxRotationError}, objective error ${maxObjectiveError}`);

function syntheticModel() {
  const arrays = {}, chunks = []; let offset = 0;
  const put = (name, values, shape, dtype = 'float64') => {
    const Type = dtype === 'float64' ? Float64Array : Uint32Array;
    const data = new Type(values);
    while (offset % 8) { chunks.push(new Uint8Array(4)); offset += 4; }
    arrays[name] = { dtype, shape, byteOffset: offset, byteLength: data.byteLength };
    chunks.push(new Uint8Array(data.buffer)); offset += data.byteLength;
  };
  const names = Object.values(PHENOTYPE_VARIATIONS).flat(), mask = new Float64Array(names.length * 3);
  [['male', 'newborn'], ['female', 'old'], ['asian', 'maxweight']].forEach((labels, row) => labels.forEach(label => { mask[row * names.length + names.indexOf(label)] = 1; }));
  put('template_vertices', [1, 0, 0, 0, 1, 0], [2, 3]);
  put('template_bone_heads', [.2, .3, .4, .2, .3, 1.4], [2, 3]);
  put('bone_heads_blendshapes', new Float64Array(30), [5, 2, 3]);
  put('bone_template_orientation_matrices', [1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 0, 0, 0, 1, 0, 0, 0, 1], [2, 3, 3]);
  put('bone_orientation_blendshapes', new Float64Array(90), [5, 2, 3, 3]);
  const rz = eulerXYZDegrees([0, 0, 30]);
  put('reference_bone_orientations', [rz[0], rz[1], rz[2], rz[4], rz[5], rz[6], rz[8], rz[9], rz[10], 1, 0, 0, 0, 1, 0, 0, 0, 1], [2, 3, 3]);
  put('vertex_bone_indices', [0, 1], [2, 1], 'uint32');
  put('vertex_bone_weights', [1, 1], [2, 1]);
  put('stacked_phenotype_blend_shapes_mask', mask, [3, names.length]);
  put('blendshape_offsets', [0, 0, 0, 0, 1, 2], [6], 'uint32');
  put('blendshape_indices', [0, 0], [2], 'uint32');
  put('blendshape_values', [2, -3], [2]);
  const buffer = new Uint8Array(offset); let start = 0;
  for (const chunk of chunks) { buffer.set(chunk, start); start += chunk.byteLength; }
  return new AnnyModel({ arrays, bone_labels: ['root', 'child'], bone_parents: [-1, 0], phenotype_labels: ['gender', 'age', 'muscle', 'weight', 'height', 'proportions', 'cupsize', 'firmness', 'african', 'asian', 'caucasian'], local_change_labels: ['test-incr'], pose_parameterization: 'local-ref', root_identity_orientation: false }, buffer.buffer);
}
const synthetic = syntheticModel();
near(synthetic.coefficients({ gender: 0, age: -1 / 3 }), [1, 0, 0, 0, 0], 0, 'joint macro factors');
near(synthetic.coefficients({ gender: 1, age: 1, weight: 1, african: 0, asian: 0, caucasian: 0 }, { 'test-incr': -.65 }), [0, 1, 1 / 3, 0, .65], 0, 'zero race and negative local');
near(synthetic.coefficients({}, { 'test-incr': .75 }), [0, 0, 0, .75, 0], 0, 'positive local');
const baseline = synthetic.forward();
near(baseline.vertices64.slice(0, 3), [.8, -.3, -.4], 2e-15, 'literal reference FK root');
const c30 = Math.cos(Math.PI / 6), s30 = Math.sin(Math.PI / 6);
near(baseline.vertices64.slice(3), [c30 * -.2 + s30 * .7, -s30 * -.2 + c30 * .7, -.4], 2e-15, 'literal reference FK child');
near(synthetic.forward({ localChanges: { 'test-incr': .75 } }).restVertices, [2.5, 0, 0, 0, 1, 0], 0, 'CSR positive local');
near(synthetic.forward({ localChanges: { 'test-incr': -.65 } }).restVertices, [-.95, 0, 0, 0, 1, 0], 5e-16, 'CSR negative local');
synthetic.forward({ phenotypes: { age: -1 / 3 }, pose: { child: [35, 12, -6] }, localChanges: { 'test-incr': -.2 } });
near(synthetic.forward().vertices, baseline.vertices, 0, 'deterministic reset');
assert.throws(() => synthetic.forward({ phenotypes: { age: NaN } }), /Invalid/);
assert.throws(() => synthetic.forward({ phenotypes: { unknown: 1 } }), /Unknown/);
console.log('Synthetic: phenotype/local/CSR/rest/reference FK/root/reset cases passed');

const fixturePath = path.join(root, 'tests/official-fixtures.json');
if (!fs.existsSync(fixturePath)) {
  console.log('Official model fixtures not present yet; math-only tests passed');
  process.exit(0);
}
const meta = JSON.parse(fs.readFileSync(path.join(root, 'assets/anny-model.json')));
const rawPath = path.join(root, 'assets/anny-model.bin');
let modelBuffer = fs.existsSync(rawPath) ? fs.readFileSync(rawPath) : gunzipSync(Buffer.concat(meta.binary.compressed.parts.map(p=>fs.readFileSync(path.join(root,p.url)))));
const model = new AnnyModel(meta, modelBuffer.buffer.slice(modelBuffer.byteOffset, modelBuffer.byteOffset + modelBuffer.byteLength));
const fixtures = JSON.parse(fs.readFileSync(fixturePath));
const fixtureBytes = fs.readFileSync(path.join(root, 'tests/official-fixtures.bin'));
const referenceBuffer = fixtureBytes.buffer.slice(fixtureBytes.byteOffset, fixtureBytes.byteOffset + fixtureBytes.byteLength);
const summary = { sourceVersion: meta.source_version, sourceCommit: meta.source_commit, cases: 0, vertices: { max: 0, rms: 0 }, intermediateMax: {}, elapsedMs: 0 };
const start = performance.now();
function runFixture(fixture, buffer, tolerance = 2e-5) {
  const actual = model.forward(fixture.inputs);
  for (const key of ['coefficients', 'restVertices', 'restBoneHeads', 'restBonePoses', 'bonePoses', 'vertices']) {
    const spec = fixture[key];
    if (!spec) continue;
    const expected = new Float32Array(buffer, spec.byteOffset, spec.length);
    const error = near(actual[key], expected, key === 'coefficients' ? 2e-6 : tolerance, `${fixture.name}: ${key}`);
    summary.intermediateMax[key] = Math.max(summary.intermediateMax[key] || 0, error.max);
    if (key === 'vertices') {
      summary.vertices.max = Math.max(summary.vertices.max, error.max);
      summary.vertices.rms = Math.max(summary.vertices.rms, error.rms);
    }
  }
  summary.cases++;
}
for (const fixture of fixtures.cases) runFixture(fixture, referenceBuffer, fixtures.tolerance_max_metres ?? 2e-5);
const extendedPath = path.join(root, 'tests/extended-fixtures.json');
if (fs.existsSync(extendedPath)) {
  const extended = JSON.parse(fs.readFileSync(extendedPath));
  const bytes = fs.readFileSync(path.join(root, 'tests/extended-fixtures.bin'));
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  for (const fixture of extended.cases) runFixture(fixture, buffer, extended.tolerance_max_metres ?? 2e-5);
}
summary.elapsedMs = performance.now() - start;
// Changing shape and pose never changes topology or accumulates deformations.
const reset = model.forward();
const baselineFixture = fixtures.cases.find(x => x.name === 'baseline');
if (baselineFixture) {
  const spec = baselineFixture.vertices;
  near(reset.vertices, new Float32Array(referenceBuffer, spec.byteOffset, spec.length), fixtures.tolerance_max_metres ?? 2e-5, 'official reset');
}
console.log('Official Anny parity:', JSON.stringify(summary, null, 2));
fs.writeFileSync(path.join(root, 'tests/parity-report.json'), JSON.stringify({
  passed: true,
  sourceVersion: summary.sourceVersion,
  sourceCommit: summary.sourceCommit,
  model: { vertices: model.vertexCount, bones: model.boneCount, blendshapes: model.shapeCount },
  officialFixtures: summary.cases,
  allVerticesCompared: true,
  maxVertexErrorMetres: summary.vertices.max,
  worstCaseRmsVertexErrorMetres: summary.vertices.rms,
  maxIntermediateErrors: summary.intermediateMax,
  maxAllowedErrorMetres: fixtures.tolerance_max_metres ?? 2e-5,
  procrustesCases: mathFixtures.cases.length,
  maxProcrustesObjectiveError: maxObjectiveError,
  notes: ['Arrays exported from official Anny v0.6.1, float32 source tensors and outputs', 'Browser calculation uses float64 arithmetic, with float32 display positions', 'Proper-rotation Procrustes uses mathematically equivalent quaternion eigenproblem', 'Nonunique Procrustes optima compare objective values', 'Tests cover phenotype anchors, signed local changes, poses, root translation, reset, and all five pose parameterizations'],
}, null, 2) + '\n');
