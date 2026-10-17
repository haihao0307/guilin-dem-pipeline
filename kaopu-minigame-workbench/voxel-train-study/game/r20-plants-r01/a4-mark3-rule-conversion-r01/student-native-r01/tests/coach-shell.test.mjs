import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildMark3Shell, generateCoachShell, MARK3_DEFAULTS, MARK3_DIMENSION_EVIDENCE, sampleMark3Section } from '../src/coach-shell.mjs';

const coach = buildMark3Shell();
const find = (result, name) => result.parts.find(p => p.name === name);
const maxDifference = (a, b) => Math.max(...a.map((v, i) => Math.abs(v - b[i])));
function projectedTriangleHits(part, y, z) {
  let count = 0;
  for (let i = 0; i < part.indices.length; i += 3) {
    const [a, b, c] = [0, 1, 2].map(j => part.indices[i + j] * 3);
    const ay = part.positions[a + 1], az = part.positions[a + 2], by = part.positions[b + 1], bz = part.positions[b + 2], cy = part.positions[c + 1], cz = part.positions[c + 2];
    const d = (bz - cz) * (ay - cy) + (cy - by) * (az - cz);
    if (Math.abs(d) < 1e-11) continue;
    const u = ((bz - cz) * (y - cy) + (cy - by) * (z - cz)) / d;
    const v = ((cz - az) * (y - cy) + (ay - cy) * (z - cz)) / d;
    if (u > -1e-7 && v > -1e-7 && u + v < 1 + 1e-7) count++;
  }
  return count;
}
function geometryHealth(result) {
  for (const part of result.parts) {
    assert.equal(part.positions.length, part.normals.length, part.name);
    assert.equal(part.positions.length / 3 * 2, part.uvs.length, part.name);
    assert.equal(part.indices.length % 3, 0);
    for (const key of ['positions', 'normals', 'uvs']) assert.ok(part[key].every(Number.isFinite), `${part.name}: finite ${key}`);
    for (let i = 0; i < part.normals.length; i += 3) assert.ok(Math.abs(Math.hypot(...part.normals.slice(i, i + 3)) - 1) < 2e-5, `${part.name}: unit normal`);
    assert.ok(part.indices.every(i => i >= 0 && i < part.positions.length / 3), part.name);
    assert.equal(part.materialGroups.reduce((n, g) => n + g.count, 0), part.indices.length);
  }
}

test('plain deterministic typed-array interface with no Three dependency', () => {
  assert.equal(generateCoachShell, buildMark3Shell);
  assert.equal(coach.schema, 'kaopu.student-native-mark3-shell/1.0');
  assert.ok(coach.parts.length > 60);
  assert.deepEqual(buildMark3Shell().parts.map(p => [p.name, p.positions, p.normals, p.uvs, p.indices]), coach.parts.map(p => [p.name, p.positions, p.normals, p.uvs, p.indices]));
  assert.ok(coach.parts.every(p => p.positions instanceof Float32Array && p.indices instanceof Uint32Array));
});

test('all emitted attributes finite, indexed correctly, and normals unit length', () => geometryHealth(coach));

test('all non-degenerate triangles agree with their vertex normal orientation', () => {
  for (const part of coach.parts) for (let i = 0; i < part.indices.length; i += 3) {
    const [ia, ib, ic] = [0, 1, 2].map(j => part.indices[i + j] * 3);
    const a = part.positions.slice(ia, ia + 3), b = part.positions.slice(ib, ib + 3), c = part.positions.slice(ic, ic + 3);
    const ab = b.map((v, k) => v - a[k]), ac = c.map((v, k) => v - a[k]);
    const cross = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
    const n = [0, 1, 2].map(k => part.normals[ia + k] + part.normals[ib + k] + part.normals[ic + k]);
    assert.ok(cross.reduce((sum, v, k) => sum + v * n[k], 0) > -1e-8, `${part.name}: reversed face`);
  }
});

test('24 actual apertures remain absent from the body skin and inner lining', () => {
  assert.equal(coach.openings.length, 24);
  for (const aperture of coach.openings) {
    const side = aperture.side < 0 ? 'left' : 'right';
    assert.equal(projectedTriangleHits(find(coach, `shell-side-${side}`), aperture.actualCenter[1], aperture.cx), 0, aperture.id);
    assert.equal(projectedTriangleHits(find(coach, `lining-side-${side}`), aperture.actualCenter[1], aperture.cx), 0, `${aperture.id} inner lining`);
  }
  const right = find(coach, 'shell-side-right');
  assert.ok(projectedTriangleHits(right, 1.70, 0) > 0, 'opaque waist below windows');
  assert.ok(projectedTriangleHits(right, 2.5, 0) > 0, 'central pillar is retained');
});

test('rounded corners are real cut geometry, not a rectangular black patch', () => {
  const a = coach.openings.find(a => a.side === 1 && a.id === 'saloon-4');
  const side = find(coach, 'shell-side-right');
  assert.ok(projectedTriangleHits(side, a.bottom + 0.005, a.left + 0.005) > 0, 'corner outside rounded cut is filled');
  assert.equal(projectedTriangleHits(side, a.bottom + a.radius + 0.04, a.left + 0.02), 0, 'inside rounded cut remains empty');
  assert.ok(coach.parts.some(p => p.name === 'right-saloon-4-reveal'));
});

test('glass and door removal exposes holes without regenerating a solid body', () => {
  const open = buildMark3Shell({ includeGlass: false, includeDoors: false });
  assert.ok(open.parts.every(p => p.material !== 'glass' && !p.metadata.editableDoor));
  assert.deepEqual(find(open, 'shell-side-right').positions, find(coach, 'shell-side-right').positions);
  assert.deepEqual(find(open, 'shell-side-right').indices, find(coach, 'shell-side-right').indices);
});

test('independent editable width and roof crown regenerate geometry and normals', () => {
  const edited = buildMark3Shell({ bodyWidth: 2.92, roofTop: 3.58 });
  assert.ok(edited.bounds.size[0] > coach.bounds.size[0] + 0.17);
  assert.ok(edited.bounds.max[1] < coach.bounds.max[1] - 0.22);
  const a = find(coach, 'shell-roof'), b = find(edited, 'shell-roof');
  assert.ok(a.positions.some((v, i) => Math.abs(v - b.positions[i]) > 0.1));
  assert.ok(a.normals.some((v, i) => Math.abs(v - b.normals[i]) > 0.05));
  assert.ok(a.uvs.some((v, i) => Math.abs(v - b.uvs[i]) > 0.04));
  assert.deepEqual(edited.evidence.editedPublishedAnchors, ['bodyWidth']);
  geometryHealth(edited);
});

test('window width and count are rules: apertures and glazing regenerate together', () => {
  const edited = buildMark3Shell({ windowCount: 7, windowWidth: 1.45, windowHeight: 0.76 });
  assert.equal(edited.openings.filter(o => o.kind === 'saloon-window').length, 14);
  for (const a of edited.openings) assert.equal(projectedTriangleHits(find(edited, `shell-side-${a.side < 0 ? 'left' : 'right'}`), a.actualCenter[1], a.cx), 0, a.id);
  assert.equal(edited.parts.filter(p => /^right-saloon-\d+-glass$/.test(p.name)).length, 7);
});

test('door leaf and its glass move together around their own native hinge', () => {
  const open = buildMark3Shell({ doorOpenAngleDeg: 38 });
  const before = find(coach, 'right-vestibule-door-rear-leaf'), after = find(open, 'right-vestibule-door-rear-leaf');
  assert.ok(after.positions.some((v, i) => i % 3 === 0 && v > before.positions[i] + 0.1), 'right door swings outwards');
  assert.equal(after.metadata.hinge.angleDeg, 38);
  assert.deepEqual(find(open, 'right-vestibule-door-rear-window-glass').metadata.hinge, after.metadata.hinge);
  assert.deepEqual(find(open, 'shell-side-right').positions, find(coach, 'shell-side-right').positions);
});

test('continuous shoulder meets roof with matching positions and tangent normals', () => {
  const roof = find(coach, 'shell-roof');
  for (const sign of [-1, 1]) {
    const side = find(coach, `shell-side-${sign < 0 ? 'left' : 'right'}`);
    const sideVerts = [];
    for (let i = 0; i < side.positions.length; i += 3) if (Math.abs(side.positions[i + 1] - MARK3_DEFAULTS.sideTop) < 1e-6 && Math.abs(side.positions[i + 2]) < 8) sideVerts.push(i);
    assert.ok(sideVerts.length > 0);
    const si = sideVerts[0], x = side.positions[si];
    const ri = Array.from({ length: roof.positions.length / 3 }, (_, j) => j * 3).find(i => Math.abs(roof.positions[i] - x) < 1e-6 && Math.abs(roof.positions[i + 1] - MARK3_DEFAULTS.sideTop) < 1e-6 && Math.abs(roof.positions[i + 2]) < 8);
    assert.ok(ri !== undefined);
    assert.ok(maxDifference(side.normals.slice(si, si + 3), roof.normals.slice(ri, ri + 3)) < 1e-5);
  }
  const section = sampleMark3Section();
  assert.ok(section.some(v => v[1] > 3.79));
  assert.ok(section.some(v => v[1] > 3.3 && Math.abs(v[0]) > 0.8));
});

test('bare body, coupled length and authoritative overall height remain distinct', () => {
  assert.equal(coach.parameters.bodyLength, 22.57);
  assert.equal(MARK3_DIMENSION_EVIDENCE.nominalCoupledLength.value, 23);
  assert.equal(MARK3_DIMENSION_EVIDENCE.overallHeight.value, 3.9);
  assert.equal(coach.parameters.roofTop, 3.81);
  assert.ok(MARK3_DIMENSION_EVIDENCE.provisional.includes('bodyLength'));
  assert.ok(MARK3_DIMENSION_EVIDENCE.provisional.includes('roofTop'));
  assert.equal(coach.envelopeCheck.status, 'not-calibrated-with-trim');
  assert.ok(coach.envelopeCheck.generatedWidth > coach.envelopeCheck.publishedWidth);
});

test('chassis is reserved only by explicit provisional floor and bogie interfaces', () => {
  assert.equal(coach.completion.chassis, 'not-in-this-generator');
  assert.equal(coach.interfaces.bogies.length, 2);
  for (const b of coach.interfaces.bogies) assert.ok(b.envelope.max[1] < coach.interfaces.floor.undersideY);
  assert.ok(coach.parts.every(p => !/bogie|wheel|brake|coupler/.test(p.name)));
});

test('invalid or silent-no-op edits fail with useful diagnostics', () => {
  assert.throws(() => buildMark3Shell({ roofRise: 0.5 }), /Unknown Mark3 parameter/);
  assert.throws(() => buildMark3Shell({ roofTop: NaN }), /finite/);
  assert.throws(() => buildMark3Shell({ roofTop: 2.5 }), /bodyBottom/);
  assert.throws(() => buildMark3Shell({ windowCount: 15 }), /Windows overlap/);
  assert.throws(() => buildMark3Shell({ bogieClearanceTop: 1.23 }), /below the floor/);
  assert.throws(() => buildMark3Shell({ bodyLength: 24 }), /nominalCoupledLength/);
  assert.throws(() => buildMark3Shell({ doorOpenAngleDeg: 100 }), /0..90/);
});

test('runtime generator is isolated: no imports, file loads, compressed fields or network', async () => {
  const source = await readFile(new URL('../src/coach-shell.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /^\s*import\s/m);
  assert.doesNotMatch(source, /\b(?:fetch|XMLHttpRequest|require|readFile|DecompressionStream)\s*\(/);
  assert.doesNotMatch(source, /fields\.bin|object\.json|source-assets|geometryResidual|vertexResidual|base64/);
  assert.ok(source.length < 45000, 'small native rules, not hidden geometry payload');
});
