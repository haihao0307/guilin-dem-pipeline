/**
 * Full-count, exact-runtime teacher editor invariants. No installed packages.
 * Run from the R9 directory: node tests/teacher-editor-invariants.mjs
 * Optional: GNM_ASSETS_DIR=/path/to/pinned/assets node tests/teacher-editor-invariants.mjs
 *
 * This verifies source-triangle subset safety, not global freedom from the
 * already documented R8 skin/radius contacts. GPU rendering is a separate test.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from '../vendor/three.module.js';
import {GNMHeadModel, parseContainer} from '../src/GNMModel.js';
import {GNMSamplers} from '../src/SemanticSampler.js';
import {createSourceExpression} from '../src/ExpressionSources.js';
import {TeacherGroomBinding} from '../src/TeacherGroomBinding.js';
import teacherData from '../data/teacher-groom.js';
import {createTeacherGroomEditor, TEACHER_GROOM_STYLES} from '../src/TeacherGroomEditor.js';

const root = new URL('../', import.meta.url);
const assets = process.env.GNM_ASSETS_DIR ? path.resolve(process.env.GNM_ASSETS_DIR) : new URL('../../gnm-head-study/assets/', import.meta.url);
const expected = {
  'gnm_head_web.bin': 'fd19f46eef6f8bfb725fceab581e1bc8837209997ca3fd43f3c1735003c86961',
  'gnm_samplers_web.bin': '827fc7850022cbc62d4401c6f6782b876c4dfa48f2a6f446d9644b0ba2b8122b',
};
const sha = array => createHash('sha256').update(Buffer.from(array.buffer, array.byteOffset, array.byteLength)).digest('hex');
const read = name => {
  const buffer = fs.readFileSync(typeof assets === 'string' ? path.join(assets, name) : new URL(name, assets));
  assert.equal(sha(buffer), expected[name], 'Pinned original asset hash: ' + name);
  return parseContainer(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
};
const h = read('gnm_head_web.bin'), s = read('gnm_samplers_web.bin');
const model = new GNMHeadModel(h.meta, h.sections), samplers = new GNMSamplers(s.meta, s.sections);
const positions = new Float32Array(model.numVertices * 3);
const headGeometry = new THREE.BufferGeometry();
headGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
headGeometry.setIndex(new THREE.BufferAttribute(model.triangles, 1));
let normals;
function setCase(name) {
  model.resetIdentity(); model.resetExpression(); model.resetPose(); samplers.seed(42);
  if (name === 'identity') model.setIdentityVector(samplers.sampleIdentity([0, 1], [0, 1, 0, 0], .8));
  if (name === 'smile' || name === 'surprise') model.setExpressionVector(createSourceExpression('maya-semantic', name === 'smile' ? 'smile_wide' : 'surprise'));
  model.computeVertices(positions);
  headGeometry.computeVertexNormals();
  normals = headGeometry.attributes.normal.array;
}

// Same attribute duplication and source triangles as experiment.js.
function geometryFromBinding(binding) {
  const count = binding.count, segments = binding.segments, per = segments + 1;
  const points = count * per, geometry = new THREE.BufferGeometry();
  const attrs = {
    position: new Float32Array(points * 6), tangent: new Float32Array(points * 6), scalpNormal: new Float32Array(points * 6),
    strandSide: new Float32Array(points * 2), along: new Float32Array(points * 2),
    strandRandom: new Float32Array(points * 2), strandRadius: new Float32Array(points * 2),
  };
  const index = new Uint32Array(count * segments * 6);
  for (let i = 0; i < count; i++) for (let j = 0; j < per; j++) {
    const q = i * per + j;
    for (let side = 0; side < 2; side++) {
      const v = q * 2 + side;
      attrs.position.set(binding.positions.subarray(q * 3, q * 3 + 3), v * 3);
      attrs.tangent.set(binding.tangents.subarray(q * 3, q * 3 + 3), v * 3);
      attrs.scalpNormal.set(binding.rootNormals.subarray(q * 3, q * 3 + 3), v * 3);
      attrs.strandSide[v] = side ? 1 : -1; attrs.along[v] = j / segments;
      attrs.strandRandom[v] = binding.strandRandom[q]; attrs.strandRadius[v] = binding.radii[q];
    }
    if (j < segments) {
      const a = q * 2;
      index.set([a, a + 1, a + 2, a + 1, a + 3, a + 2], (i * segments + j) * 6);
    }
  }
  for (const [name, array] of Object.entries(attrs)) geometry.setAttribute(name, new THREE.BufferAttribute(array, ['position', 'tangent', 'scalpNormal'].includes(name) ? 3 : 1));
  geometry.setIndex(new THREE.BufferAttribute(index, 1));
  geometry.userData.binding = binding;
  return geometry;
}

function refreshBoundGeometry(record) {
  const {binding, mesh} = record;
  binding.update(positions, normals);
  for (const [name, source] of [['position', binding.positions], ['tangent', binding.tangents], ['scalpNormal', binding.rootNormals]]) {
    const attribute = mesh.geometry.attributes[name];
    for (let q = 0; q < binding.count * binding.per; q++) {
      attribute.array.set(source.subarray(q * 3, q * 3 + 3), q * 6);
      attribute.array.set(source.subarray(q * 3, q * 3 + 3), q * 6 + 3);
    }
    attribute.needsUpdate = true;
  }
  mesh.geometry.computeBoundingSphere();
}

function snapshot(record) {
  return {
    arrays: Object.fromEntries(Object.entries(record.mesh.geometry.attributes).map(([name, value]) => [name, value.array.slice()])),
    binding: Object.fromEntries(['positions', 'tangents', 'rootNormals', 'radii', 'roots', 'rootTriangles', 'rootBarycentrics', 'templateRoots', 'sourceGuideIds', 'guideWeights', 'islands', 'strandRandom'].map(name => [name, record.binding[name].slice()])),
  };
}
function equalBytes(a, b, message) {
  assert.equal(a.byteLength, b.byteLength, message + ' length');
  assert.equal(Buffer.compare(Buffer.from(a.buffer, a.byteOffset, a.byteLength), Buffer.from(b.buffer, b.byteOffset, b.byteLength)), 0, message);
}
function unchanged(record, baseline, label) {
  for (const [name, array] of Object.entries(baseline.arrays)) equalBytes(record.mesh.geometry.attributes[name].array, array, label + ' exact geometry ' + name);
  for (const [name, array] of Object.entries(baseline.binding)) equalBytes(record.binding[name], array, label + ' exact binding ' + name);
}

/** Exhaustively verify each drawn triangle has all the exact source vertices
 * and belongs to a consecutive prefix, with no hidden chord or reindexing. */
function checkSubset(record, baseline, label) {
  unchanged(record, baseline, label);
  const {editor, mesh, binding} = record, diagnostics = editor.diagnostics();
  assert.equal(diagnostics.rootsExact, true); assert.equal(diagnostics.partingPreserved, true);
  assert.equal(diagnostics.rootBindingsPreserved, true); assert.equal(diagnostics.attributesExact, true);
  assert.equal(diagnostics.newSegmentsCreated, 0); assert.equal(diagnostics.addedTriangleCount, 0);
  assert.deepEqual(diagnostics.errors, []);
  const index = mesh.geometry.index.array, endSegments = editor.strandEndSegments;
  const active = new Set(editor.activeStrandIds), per = binding.per;
  const visibleBounds = [[Infinity, -Infinity], [Infinity, -Infinity], [Infinity, -Infinity]];
  let cursor = 0, segmentCount = 0;
  for (let i = 0; i < binding.count; i++) {
    assert.ok(endSegments[i] >= Math.min(2, binding.segments));
    if (!active.has(i)) continue;
    for (let j = 0; j < endSegments[i]; j++) {
      const a = (i * per + j) * 2;
      for (const expectedIndex of [a, a + 1, a + 2, a + 1, a + 3, a + 2]) assert.equal(index[cursor++], expectedIndex, label + ' source triangle subset');
      segmentCount++;
    }
    for (let j = 0; j <= endSegments[i]; j++) for (let axis = 0; axis < 3; axis++) {
      const value = baseline.arrays.position[(i * per + j) * 6 + axis];
      visibleBounds[axis][0] = Math.min(visibleBounds[axis][0], value);
      visibleBounds[axis][1] = Math.max(visibleBounds[axis][1], value);
    }
  }
  assert.equal(cursor, diagnostics.drawIndexCount);
  assert.equal(segmentCount, diagnostics.drawnSegments);
  assert.equal(active.size, Math.round(binding.count * editor.options.density));
  const rangeCount = Number.isFinite(mesh.geometry.drawRange.count) ? mesh.geometry.drawRange.count : index.length;
  assert.equal(cursor, rangeCount);
  return {...diagnostics, visibleBounds: active.size ? visibleBounds : null};
}

setCase('neutral');
const started = performance.now(), records = [];
for (const [region, count, segments] of [['scalp', 14000, 24], ['brows', 1000, 10]]) {
  const binding = new TeacherGroomBinding(model, teacherData, {region, count, segments, seed: 724});
  binding.update(positions, normals);
  const mesh = new THREE.Mesh(geometryFromBinding(binding));
  const originalIndex = mesh.geometry.index.array.slice(), initial = snapshot({binding, mesh});
  const editor = createTeacherGroomEditor(mesh, binding);
  const record = {region, binding, mesh, editor, originalIndex, originalDrawRange: {...mesh.geometry.drawRange}};
  unchanged(record, initial, region + ' default initialization');
  equalBytes(mesh.geometry.index.array, originalIndex, region + ' default exact index');
  records.push(record);
}
const constructionMs = performance.now() - started;
console.error('Constructed full seed-724 teacher grooms in', Math.round(constructionMs), 'ms');

const caseResults = [], neutralHashes = {};
for (const name of ['neutral', 'smile', 'surprise', 'identity']) {
  setCase(name);
  const headHash = sha(positions), row = {case: name, headPositionSha256: headHash, regions: {}};
  for (const record of records) {
    // Refresh while a trim is active. updateSource must not capture that trim's
    // shortened index as its new full source or accumulate previous edits.
    record.editor.apply({style: record.region === 'scalp' ? 'cropped-trim' : 'original', length: .67, density: .43});
    const previousOptions = record.editor.options;
    refreshBoundGeometry(record);
    const baseline = snapshot(record);
    record.editor.updateSource();
    assert.deepEqual(record.editor.options, previousOptions, 'Source update retains editor options');
    checkSubset(record, baseline, name + ' ' + record.region + ' source update');
    const presets = record.region === 'scalp' ? Object.keys(TEACHER_GROOM_STYLES) : ['original'];
    const variants = [];
    for (const style of presets) {
      record.editor.apply({style, length: 1, density: 1});
      variants.push(checkSubset(record, baseline, name + ' ' + record.region + ' ' + style));
    }
    if (record.region === 'scalp') {
      assert.ok(variants[0].drawnSegments > variants[1].drawnSegments && variants[1].drawnSegments > variants[2].drawnSegments, 'Three distinct source-prefix silhouettes');
      assert.ok(variants[0].lengthSummary.mean > variants[1].lengthSummary.mean && variants[1].lengthSummary.mean > variants[2].lengthSummary.mean);
      assert.equal(new Set(variants.map(value => value.drawIndexHash)).size, 3, 'Each style has a distinct draw index');
      assert.ok(variants[2].visibleBounds[1][0] > variants[0].visibleBounds[1][0] + .03, 'Short trim materially raises the lowest visible tip');
    }

    const lengthSweep = [];
    let previousEnds = null;
    for (const length of [.45, .57, .73, .91, 1]) {
      record.editor.apply({style: 'original', length, density: 1});
      const ends = record.editor.strandEndSegments;
      if (previousEnds) for (let i = 0; i < ends.length; i++) assert.ok(ends[i] >= previousEnds[i], 'Length prefixes are monotonic');
      previousEnds = ends;
      const diagnostic = checkSubset(record, baseline, name + ' length ' + length);
      lengthSweep.push({length, drawnSegments: diagnostic.drawnSegments, meanLength: diagnostic.lengthSummary.mean, drawIndexHash: diagnostic.drawIndexHash});
    }

    const densitySweep = [];
    let previousActive = new Set();
    for (const density of [0, .1, .25, .5, .75, 1]) {
      record.editor.apply({density, length: .73});
      const active = new Set(record.editor.activeStrandIds);
      for (const strand of previousActive) assert.ok(active.has(strand), 'Density selections are nested');
      previousActive = active;
      const diagnostic = checkSubset(record, baseline, name + ' density ' + density);
      densitySweep.push({density, activeStrands: diagnostic.activeStrands, drawnSegments: diagnostic.drawnSegments, drawIndexHash: diagnostic.drawIndexHash});
    }

    // Repeated alternating edits and source refreshes remain reversible.
    for (let i = 0; i < 10; i++) {
      record.editor.apply({style: presets[i % presets.length], length: .45 + (i % 4) * .16, density: (i % 5) / 4});
      record.editor.updateSource();
    }
    record.editor.reset();
    const restored = checkSubset(record, baseline, name + ' restored');
    equalBytes(record.mesh.geometry.index.array, record.originalIndex, name + ' full draw index restored');
    assert.deepEqual(record.mesh.geometry.drawRange, record.originalDrawRange);
    assert.equal(restored.drawIndexCount, record.binding.count * record.binding.segments * 6);
    if (name === 'neutral') neutralHashes[record.region] = Object.fromEntries(Object.entries(baseline.arrays).map(([key, value]) => [key, sha(value)]));
    for (const array of Object.values(baseline.arrays)) assert.ok(array.every(Number.isFinite), name + ' finite source');
    const bindingDiagnostics = record.binding.diagnostics();
    assert.equal(bindingDiagnostics.invalidRoots, 0); assert.equal(bindingDiagnostics.invalidTriangles, 0);
    row.regions[record.region] = {variants, lengthSweep, densitySweep, restored, bindingDiagnostics};
  }
  assert.equal(sha(positions), headHash, 'Editor never alters original head geometry');
  caseResults.push(row);
  console.error('PASS', name, 'full scalp + brow editor invariants');
}

// Returning to the original neutral model also restores the exact initial R8
// buffers, not just the roots or a tolerance-based approximation.
setCase('neutral');
for (const record of records) {
  refreshBoundGeometry(record); record.editor.updateSource(); record.editor.reset();
  for (const [name, attribute] of Object.entries(record.mesh.geometry.attributes)) assert.equal(sha(attribute.array), neutralHashes[record.region][name], 'Neutral reset exact ' + record.region + ' ' + name);
  equalBytes(record.mesh.geometry.index.array, record.originalIndex, 'Neutral reset exact index');
  const before = record.editor.options;
  for (const patch of [{length: NaN}, {density: Infinity}, {style: 'guessed-new-part'}]) {
    assert.throws(() => record.editor.apply(patch));
    assert.deepEqual(record.editor.options, before, 'Invalid edit is atomic');
  }
  record.editor.apply({length: -2, density: 2});
  assert.equal(record.editor.options.length, .45); assert.equal(record.editor.options.density, 1);
  record.editor.reset();
}

// A second editor with deliberately different shading randomness makes the
// same density selection: no material random sequence is re-used or mutated.
const brow = records.find(record => record.region === 'brows');
const alteredGeometry = brow.mesh.geometry.clone();
alteredGeometry.attributes.strandRandom.array.fill(.12345);
const second = createTeacherGroomEditor(new THREE.Mesh(alteredGeometry), brow.binding);
brow.editor.apply({density: .37}); second.apply({density: .37});
equalBytes(brow.editor.activeStrandIds, second.activeStrandIds, 'Density is independent of strandRandom');
brow.editor.reset();

const sourceFiles = ['src/TeacherGroomBinding.js', 'data/teacher-groom.js', 'src/FiberMaterial.js', 'src/GNMModel.js', 'vendor/three.module.js'];
const unchangedR8 = {};
for (const name of sourceFiles) {
  const current = fs.readFileSync(new URL(name, root)), original = fs.readFileSync(new URL('../../gnm-head-study-r8-opacity-experiment/' + name, import.meta.url));
  equalBytes(current, original, 'R8 untouched ' + name); unchangedR8[name] = sha(current);
}
const report = {
  passed: true, schema: 'teacher-groom-editor-invariants-v1', seed: 724,
  modelVertices: model.numVertices, modelTriangles: model.triangles.length / 3,
  pinnedAssets: expected, unchangedR8, constructionMs, totalMs: performance.now() - started,
  coverage: {
    fullScalp14000Strands24Segments: true, fullBrows1000Strands10Segments: true,
    exactDefaultAndResetAllAttributes: true, exactNeutralResetAfterFourCases: true,
    rootBindingsAndSourcePartingUnchanged: true, allDrawnTrianglesExactSourceSubset: true,
    noNewChordOrCenterlineGeometry: true, densityNestedAndIndependentOfShadingRandom: true,
    preservesControlsAcrossSourceRefresh: true, repeatedEditsDoNotAccumulate: true,
    invalidInputsRejectedAtomically: true, headAndR8RendererUnchanged: true,
  },
  limits: [
    'Numerical tests, not GPU appearance or performance acceptance.',
    'Styles are source-curve trims, not newly authored chin/bob guide sets.',
    'Whole source segments give quantized trim positions; source cut-tip radii are preserved.',
    'Original R8 contacts and radius-clearance failures are not fixed or recertified.',
    'The source-triangle subset guarantee excludes independent width, shader, pose, and new geometry changes.',
  ],
  cases: caseResults,
};
fs.writeFileSync(new URL('teacher-editor-numerical.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({passed: true, constructionMs, totalMs: report.totalMs, cases: caseResults.map(row => ({case: row.case, scalp: row.regions.scalp.variants.map(value => ({style: value.style, activeStrands: value.activeStrands, drawnSegments: value.drawnSegments, meanLength: value.lengthSummary.mean, lowestVisibleY: value.visibleBounds[1][0], drawIndexHash: value.drawIndexHash})), brows: row.regions.brows.densitySweep})), limits: report.limits}, null, 2));
