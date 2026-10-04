'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const lift = require('../src/axis-lift.js');

function close(a, b, tolerance = 1e-8, label = '') {
  assert.ok(Math.abs(a - b) <= tolerance, `${label}: ${a} != ${b}`);
}
function pointClose(a, b, tolerance, label) { for (let i = 0; i < 3; i++) close(a[i], b[i], tolerance, label); }
function dot(a, b) { return a.reduce((s, x, i) => s + x * b[i], 0); }
function subtract(a, b) { return a.map((x, i) => x - b[i]); }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function sourceReference(stage, i, t) {
  const y = i / 598, e = y / 5 - 11, k = (5 + Math.sin(y)) * Math.cos(i / 7);
  const d = Math.sqrt(k * k + e * e) / 0.6 - 6;
  const q = 99 + d * Math.sin(t - d) + y / 23 * k * (3 * Math.sin(e) + e * Math.sin(2 * e) + Math.sin(4 * d));
  const c = d / 4 - t / 8 + (stage === 5 ? Math.cos(t + e) / 9 : 0);
  return [q * Math.sin(c) + 200, q * Math.cos(c) + 200, 0];
}
function checkMesh(mesh, positive) {
  assert.ok(mesh.positions.length <= 8000, 'vertex budget');
  assert.equal(mesh.faces.length, mesh.faceKinds.length);
  for (const p of mesh.positions) { assert.equal(p.length, 3); assert.ok(p.every(Number.isFinite), 'finite vertex'); }
  const edges = new Map();
  for (const face of mesh.faces) {
    assert.equal(new Set(face).size, 3);
    for (const index of face) assert.ok(Number.isInteger(index) && index >= 0 && index < mesh.positions.length, 'valid face index');
    for (let i = 0; i < 3; i++) {
      const a = face[i], b = face[(i + 1) % 3], key = Math.min(a, b) + ':' + Math.max(a, b);
      const edge = edges.get(key) || { count: 0, orientation: 0 };
      edge.count++; edge.orientation += a < b ? 1 : -1; edges.set(key, edge);
    }
  }
  for (const edge of edges.values()) { assert.equal(edge.count, 2, 'closed two-manifold shell'); assert.equal(edge.orientation, 0, 'consistent face winding'); }
  for (const [row, section] of mesh.sections.entries()) {
    if (row) assert.ok(section.center[1] > mesh.sections[row - 1].center[1], 'strict monotonic material axis');
    pointClose(section.frame.tangent, [0, 1, 0], 1e-12, 'fixed material-axis tangent');
    for (const p of section.points) close(p[1], section.center[1], 1e-12, 'distinct axis-normal ring plane');
    for (const v of Object.values(section.frame)) { assert.ok(v.every(Number.isFinite)); close(dot(v, v), 1, 1e-10, 'unit frame'); }
    close(dot(section.frame.tangent, section.frame.normal), 0, 1e-10);
    close(dot(section.frame.tangent, section.frame.binormal), 0, 1e-10);
    close(dot(section.frame.normal, section.frame.binormal), 0, 1e-10);
    if (positive) { assert.ok(section.area > 0, 'positive cross-section area'); assert.ok(section.bilateralSeparation > 0, 'outward bilateral span'); }
  }
  if (positive) {
    assert.ok(mesh.diagnostics.columnVolume > 0, 'finite volume central column');
    assert.ok(mesh.diagnostics.fieldVolume > 0, 'finite volume bilateral field');
    assert.ok(mesh.diagnostics.columnSignedVolume > 0 && mesh.diagnostics.fieldSignedVolume > 0, 'positive outward signed volumes');
    assert.ok(mesh.diagnostics.maxDepth > 0, 'actual nonzero Z thickness');
    assert.ok(mesh.faceKinds.includes('spine') && mesh.faceKinds.includes('fin') && mesh.faceKinds.includes('tail'));
    assert.ok(mesh.diagnostics.bounds.min[2] < 0 && mesh.diagnostics.bounds.max[2] > 0, 'two depth sides');
    for (const caps of [mesh.diagnostics.fieldCaps, mesh.diagnostics.columnCaps]) {
      for (const end of ['start', 'end']) {
        const section = mesh.sections[end === 'start' ? 0 : mesh.sections.length - 1];
        for (const index of caps[end]) {
          const [a, b, c] = mesh.faces[index].map(i => mesh.positions[i]);
          const projection = dot(cross(subtract(b, a), subtract(c, a)), section.frame.tangent) * (end === 'start' ? -1 : 1);
          assert.ok(projection >= -1e-10, 'ear-clipped cap never crosses source concavity');
        }
      }
    }
  }
}

// Every author sample is recoverable, not just a vaguely similar silhouette.
for (const [kind, stage] of [['multifrequency', 4], ['biomotion', 5]]) {
  for (const t of [0, Math.PI / 30, 2.93, 17.73, 43.01]) {
    for (let i = 0; i < 20000; i += 31) pointClose(lift.sourcePointByIndex(kind, i, t), sourceReference(stage, i, t), 2e-10, 'original scalar equations');
    pointClose(lift.sourcePointByIndex(kind, 19999, t), sourceReference(stage, 19999, t), 2e-10);
  }
}
console.log('PASS: original 04/05 equations and source-index projection');
const actualCorePath = path.resolve(__dirname, '../../haiyu-r18-repair-20261004/extracted/R18/core.js');
if (fs.existsSync(actualCorePath)) {
  const actualCore = require(actualCorePath);
  for (const [kind, stage] of [['multifrequency', 4], ['biomotion', 5]]) {
    for (const t of [0, 7.1, 19.2, 42.8]) {
      for (let i = 0; i < 20000; i += 17) {
        const expected = actualCore.point(stage, i, t);
        pointClose(lift.sourcePointByIndex(kind, i, t), [expected[0], expected[1], 0], 2e-10, 'actual R18 core.js');
      }
    }
  }
  console.log('PASS: cross-check against actual supplied R18/core.js');
}

// 04 and 05 differ only in the explicitly supplied c phase correction.
for (let j = 0; j < 100; j++) {
  const y = lift.SOURCE_MAX_Y * j / 99, u = Math.sin(j), t = j * 0.43;
  const a = lift.sourceSample('multifrequency', y, u, t), b = lift.sourceSample('biomotion', y, u, t);
  for (const key of ['e', 'k', 'd', 'harmonic', 'qEven', 'qOdd', 'q', 'basePhase']) assert.equal(a[key], b[key], key);
  close(b.c - a.c, Math.cos(t + a.e) / 9, 2e-15, 'only phase changes');
}
console.log('PASS: 04 vs 05 sole scalar difference is cos(t+e)/9');

// Standalone global use, with no DOM or renderer dependency.
const sandbox = {};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/axis-lift.js'), 'utf8'), sandbox);
assert.equal(typeof sandbox.HaiyuAxisLift.evaluate, 'function');
assert.equal(globalThis.HaiyuAxisLift, lift);
console.log('PASS: browser-global and CommonJS isolated API');

for (const kind of ['multifrequency', 'biomotion']) {
  const params = { thickness: 0.65, depth: 0.6, detail: 0.5, motion: 0.8 };
  const a = lift.evaluate(kind, 3.17, params);
  checkMesh(a, true);
  assert.deepEqual(a, lift.evaluate(kind, 3.17, params), 'deterministic');
  assert.deepEqual(a, lift.evaluate(kind, 3.17, { ...params, camera: { yaw: 17, pitch: 99 }, view: 'back' }), 'camera independence');
  const next = lift.evaluate(kind, 3.17 + lift.AUTHOR_STEP, params);
  assert.ok(a.positions.some((p, i) => Math.hypot(...p.map((x, k) => x - next.positions[i][k])) > 0.01), 'material geometry changes over time');
  const repeat = lift.evaluate(kind, 3.17 + lift.AUTHOR_PERIOD, params);
  for (let i = 0; i < a.positions.length; i++) pointClose(a.positions[i], repeat.positions[i], 1e-9, '480-frame exact loop');
  const noMotion = lift.evaluate(kind, 3.17, { ...params, motion: 0 });
  for (let j = 0; j < a.sections.length; j++) {
    const section = a.sections[j], still = noMotion.sections[j];
    for (let i = 0; i < section.points.length; i++) close(dot(subtract(section.points[i], section.center), section.frame.normal), dot(subtract(still.points[i], still.center), still.frame.normal), 1e-10, 'motion preserves lateral scalar width');
    assert.equal(section.halfWidth, still.halfWidth);
  }
  assert.ok(a.positions.some((p, i) => Math.abs(p[2] - noMotion.positions[i][2]) > 1e-3), 'motion only articulates inferred depth');
  const thicker = lift.evaluate(kind, 3.17, { ...params, thickness: 1 });
  assert.ok(thicker.diagnostics.columnVolume > a.diagnostics.columnVolume);
  assert.ok(thicker.sections[20].fieldDepth > a.sections[20].fieldDepth);
}
console.log('PASS: finite closed meshes, deterministic camera independence, temporal geometry, loop, thickness controls');

// Zero thickness collapses section area but intentionally does not reproduce
// the old XY projection. Original source functions are tested separately above.
for (const kind of ['multifrequency', 'biomotion']) {
  for (const depth of [0, 0.5, 1]) {
    const mesh = lift.evaluate(kind, 7.21, { thickness: 0, depth, detail: 0.5, motion: 0.7 });
    checkMesh(mesh, false);
    for (const section of mesh.sections) {
      for (const index of section.columnIndices) pointClose(mesh.positions[index], section.center, 1e-12, 'zero-thickness material column');
      for (const p of section.points) close(dot(subtract(p, section.center), section.frame.binormal), 0, 1e-12, 'zero section depth');
      close(section.area, 0, 1e-10, 'zero cross-section area');
    }
    close(mesh.diagnostics.columnVolume, 0, 1e-12);
    close(mesh.diagnostics.fieldVolume, 0, 1e-8);
    assert.ok(mesh.diagnostics.depthMeaning.includes('not the original XY projection'));
  }
}
console.log('PASS: zero thickness gives zero-area material sections; original XY reference stays separate');

// All 480 source frames, including harmonic nodes and the narrow endpoints.
for (const kind of ['multifrequency', 'biomotion']) {
  for (let frame = 0; frame < 480; frame++) {
    const mesh = lift.evaluate(kind, frame * lift.AUTHOR_STEP, { thickness: 0.01, depth: frame % 2, detail: 0 });
    assert.ok(mesh.positions.every(p => p.every(Number.isFinite)), 'finite full loop');
    assert.ok(mesh.diagnostics.minSectionArea > 0, 'positive section through full loop');
    assert.ok(mesh.diagnostics.minBilateralSeparation > 0, 'outward sides through full loop');
    assert.ok(mesh.diagnostics.columnSignedVolume > 0 && mesh.diagnostics.fieldSignedVolume > 0, 'positive outward signed volume through full loop');
  }
  checkMesh(lift.evaluate(kind, 0, { detail: 1, thickness: 1, depth: 1 }), true);
}
console.log('PASS: 960 loop states, positive sections, finite frames, maximum detail below 8000 vertices');

assert.throws(() => lift.evaluate('fish', 0), /kind/);
assert.throws(() => lift.evaluate('biomotion', NaN), /finite/);
assert.throws(() => lift.sourcePointByIndex('biomotion', 20000, 0), /index/);
const clamped = lift.evaluate('multifrequency', 0, { thickness: 99, depth: -2, detail: NaN, motion: -1 });
assert.deepEqual(clamped.diagnostics.params, { thickness: 1, depth: 0, detail: 0.5, motion: 0 });
console.log('PASS: invalid inputs and bounded candidate parameters');
console.log('ALL AXIS-LIFT TESTS PASSED');
