import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from '../../../vendor/three.module.js';
import { buildArchitecture } from './architecture.mjs';
import { createMaterialLibrary } from './materials.mjs';
import { createWordFactory } from './glyphs.mjs';

const original = JSON.parse(readFileSync(new URL('./first-street.score.json', import.meta.url)));
function build(change = () => {}) {
  const score = structuredClone(original); change(score);
  const materialLibrary = createMaterialLibrary(THREE, score), glyphs = createWordFactory(THREE);
  const a = buildArchitecture(score, { THREE, materials: materialLibrary, makeWord: glyphs.makeWord });
  a.dispose = () => { for (const g of a.resources.geometries) g.dispose(); materialLibrary.dispose(); glyphs.dispose({ resources: false }); };
  return a;
}
function fingerprint(a) {
  // Numerical fingerprint includes every runtime vertex and every instance transform.
  let hash = 2166136261;
  const number = n => { hash = Math.imul(hash ^ Math.round(n * 100000), 16777619); };
  a.root.traverse(o => {
    if (!o.isMesh) return;
    for (const v of o.geometry.attributes.position.array) number(v);
    if (o.isInstancedMesh) for (const v of o.instanceMatrix.array) number(v);
    number(o.position.x); number(o.position.y); number(o.position.z);
  });
  return hash >>> 0;
}

test('original first-street geometry is detailed, bounded and camera-side open', () => {
  const a = build();
  assert.equal(a.stats.windows, 33);
  assert.equal(a.stats.piercedOpenings.length, 33);
  assert.deepEqual(a.stats.facadeFamilies, ['brick_shophouse', 'timber_verandah']);
  assert.equal(a.stats.shops, 4);
  assert.ok(a.stats.cages >= 20);
  assert.ok(a.stats.openCasements >= 10);
  assert.ok(a.stats.shutters >= 15);
  assert.ok(a.stats.balconies >= 18);
  assert.ok(a.stats.signs >= 8);
  assert.ok(a.stats.signSupports >= 12);
  assert.ok(a.stats.railClearanceVerified);
  assert.ok(a.stats.expandedTriangles <= 180000, String(a.stats.expandedTriangles));
  assert.ok(a.stats.instances <= 12000);
  assert.ok(a.stats.materials <= 48);
  assert.ok(a.stats.buildingBounds[0].min[0] < -15);
  assert.ok(a.stats.buildingBounds[1].max[0] < 2.5);
  const uniqueTitles = new Set();
  a.root.traverse(o => { if (o.userData.text?.length === 4) uniqueTitles.add(o.userData.text); });
  assert.deepEqual([...uniqueTitles].sort(), ['麗華戲院', '同豐藥房', '金禾冰室', '海峰鐘錶'].sort());
  a.dispose();
});

test('shared instancing owns complete, bounded geometries with explicit normals', () => {
  const a = build(); const primitives = new Set(), geometrySet = new Set(a.resources.geometries);
  let instanced = 0;
  a.root.traverse(o => {
    if (!o.isMesh) return;
    assert.ok(geometrySet.has(o.geometry));
    assert.ok(o.geometry.attributes.normal);
    assert.ok(o.geometry.boundingBox && o.geometry.boundingSphere);
    assert.ok([...o.geometry.attributes.normal.array].every(Number.isFinite));
    if (o.isInstancedMesh) { instanced += o.count; primitives.add(o.geometry); }
  });
  assert.ok(instanced > 4000);
  assert.equal(primitives.size, 5);
  assert.equal(geometrySet.size, a.resources.geometries.length);
  assert.equal(new Set(a.resources.materials).size, a.resources.materials.length);
  a.dispose();
});

test('analytic cloth has immutable rest copies and explicit attachment masks', () => {
  const a = build();
  assert.equal(a.cloth.length, 20);
  assert.equal(a.stats.laundry, 12);
  for (const c of a.cloth) {
    assert.ok(c.rest instanceof Float32Array);
    assert.ok(c.pinned instanceof Uint8Array);
    assert.notEqual(c.rest, c.mesh.geometry.attributes.position.array);
    assert.equal(c.rest.length, c.pinned.length * 3);
    assert.ok(c.pinned.some(v => v === 1)); assert.ok(c.pinned.some(v => v === 0));
    assert.ok(Number.isFinite(c.seed));
    assert.deepEqual(c.rest, c.mesh.geometry.attributes.position.array);
  }
  a.dispose();
});

test('the score genuinely controls floors, bays, cage/sign density and ageing', () => {
  const a = build(s => {
    s.construction.buildings[0].floors = 2; s.construction.buildings[1].floors = 3;
    for (const b of s.construction.buildings) { b.bays = 4; b.age = 0.15; b.repair = 0.80; }
    s.construction.windowCageDensity = 0; s.construction.signDensity = 0;
  });
  assert.equal(a.stats.windows, 20);
  assert.equal(a.stats.cages, 0); assert.equal(a.stats.signs, 0);
  assert.ok(a.resources.materials.some(m => m.userData.street?.config.age === 0.15));
  assert.ok(a.resources.materials.some(m => m.userData.street?.config.repair === 0.80));
  assert.ok(a.stats.expandedTriangles < 100000);
  a.dispose();
});

test('same seed is deterministic while seed changes generated details', () => {
  const a = build(), b = build(), c = build(s => { s.object.seed += 1; });
  assert.equal(fingerprint(a), fingerprint(b));
  assert.notEqual(fingerprint(a), fingerprint(c));
  assert.deepEqual(a.stats, b.stats);
  a.dispose(); b.dispose(); c.dispose();
});

test('one added floor remains inside the original runtime budget', () => {
  const a = build(s => { s.construction.buildings[0].floors += 1; });
  assert.equal(a.stats.windows, 36);
  assert.ok(a.stats.expandedTriangles < 180000, String(a.stats.expandedTriangles));
  a.dispose();
});

test('architecture source contains no network, images, fonts or texture loaders', () => {
  const source = readFileSync(new URL('./architecture.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /\bfetch\s*\(|TextureLoader|CanvasTexture|DataTexture|ImageBitmap|FontLoader|\.png|\.jpg|\.glb/);
});

test('closed shops keep jointed shutters, and open lamps provide bounded illumination', () => {
  const a = build(s => { s.construction.buildings[0].shops[0].open = false; });
  assert.equal(a.stats.shopsClosed, 1); assert.equal(a.stats.shopsOpen, 3);
  assert.equal(a.stats.shopLights, 2);
  let closedPanels = false, lights = 0;
  a.root.traverse(o => {
    if (o.userData.parts?.includes('closed-timber-shop-leaf')) closedPanels = true;
    if (o.isPointLight) { lights++; assert.ok(o.distance <= 4); assert.equal(o.castShadow, false); }
  });
  assert.ok(closedPanels); assert.equal(lights, 2);
  const signAges = a.resources.materials.filter(m => m.userData.street?.family === 'sign').map(m => m.userData.street.config.age);
  for (const b of original.construction.buildings) for (const shop of b.shops) assert.ok(signAges.includes(shop.signAge));
  a.dispose();
});

test('seed zero remains a genuine deterministic seed', () => {
  const zero = build(s => { s.object.seed = 0; }), standard = build();
  assert.notEqual(fingerprint(zero), fingerprint(standard));
  zero.dispose(); standard.dispose();
});
