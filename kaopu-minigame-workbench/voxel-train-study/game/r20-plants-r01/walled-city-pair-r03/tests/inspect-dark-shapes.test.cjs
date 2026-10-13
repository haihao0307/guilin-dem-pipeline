'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { LOCKED_COMMIT, APP_PATH, ORIGINAL_CONDITION, DIAGNOSTIC_CONDITION, MODES, parseOptions, patchReadback, prepare, pixelRecord, validateCrop, compareRGBA } = require('../qa/inspect-dark-shapes.cjs');
const ROOT = path.resolve(__dirname, '..');
const BASELINE = path.join(ROOT, 'qa/public-baseline-22f4ce-overall');
const baseline = JSON.parse(fs.readFileSync(path.join(BASELINE, 'camera-baseline.json')));
const options = () => parseOptions(['--tile', '144,192', '--prepare-only']);
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
function rawRecord(x = 144, y = 192) {
  const h = Array(24).fill(0); h.splice(0, 4, 40, .001, 72, 1); h.splice(4, 4, 1, 2, 3, 77); h.splice(12, 4, 0, 0, -1, 0); h[19] = -1;
  return { pixel: [x, y], hitRecord: h, ids: [2, 1, 77, 6], initial: [2, .1, 14, 0], final: [2, .1, 14, 0], normalAndVisibility: [0, 0, -1, .1] };
}
function frame() {
  const f = structuredClone(baseline); f.rect = [144, 192, 16, 16]; f.inspectionCrop = true; f.tiles = 1;
  f.snapshot.rect = f.rect; f.snapshot.inspectionCrop = true;
  f.rayStatus = { hit: 256, trueMiss: 0, exhausted: 0, visibilityUnresolved: 0, candidateOverflows: 0, activeQueries: 0 };
  f.visibilityContinuations = Array.from({ length: 256 }, (_, i) => rawRecord(144 + i % 16, 192 + Math.floor(i / 16)));
  return f;
}

test('requires one to three explicit 16x16 tiles and caps total time at five minutes', () => {
  const o = options(); assert.deepEqual(o.tiles, [[144, 192, 16, 16]]); assert.equal(o.timeoutMs, 300000); assert.equal(o.prepareOnly, true);
  for (const argv of [[], ['--mode','full'], ['--tile','0,0,480,600'], ['--tile','0,0','--timeout-ms','300001'], ['--tile','0,0','--max-submissions','20001'], ['--tile','0,0','--tile','0,0'], ['--tile','0,0','--tile','16,0','--tile','32,0','--tile','48,0'], ['--tile','../0,0']]) assert.throws(() => parseOptions(argv));
});
test('all five modes are the renderer existing debug values', () => {
  assert.deepEqual(MODES.map(m => m.debug), [0, 1, 2, 3, 4]);
  assert.deepEqual(MODES.map(m => m.name), ['normal', 'macro-normal', 'material-id', 'albedo', 'actual-normal']);
});
test('in-memory patch changes exactly one host readback condition and preserves input bytes', () => {
  const original = fs.readFileSync(path.join(ROOT, APP_PATH)); const before = Buffer.from(original);
  const patch = patchReadback(original);
  assert.deepEqual(original, before);
  assert.equal(patch.record.beforeSha256, hash(original));
  assert.equal(patch.record.replacements, 1);
  const offset = patch.record.offset, source = patch.bytes.toString();
  assert.equal(source.slice(0, offset) + ORIGINAL_CONDITION + source.slice(offset + DIAGNOSTIC_CONDITION.length), original.toString());
  assert.throws(() => patchReadback(Buffer.from(source)), /exactly one/);
  assert.throws(() => patchReadback(Buffer.concat([original, Buffer.from(ORIGINAL_CONDITION)])), /exactly one/);
  assert.throws(() => patchReadback(Buffer.from(`${ORIGINAL_CONDITION}\nasync function readVisibilityTile(){}\nasync function readTraceTile(){}`)), /outside/);
});
test('preparation verifies frozen commit, full image, all source hashes, and nine original mothers', () => {
  const before = hash(fs.readFileSync(path.join(ROOT, APP_PATH)));
  const p = prepare(options());
  assert.equal(p.plan.commit, LOCKED_COMMIT); assert.deepEqual(p.plan.nativePixels, [480, 600]); assert.equal(p.plan.totalRenderCalls, 5);
  assert.equal(p.plan.motherParity.length, 9); assert.ok(p.plan.motherParity.every(m => m.matches));
  assert.equal(p.plan.patch.beforeSha256, p.baselineHashes[APP_PATH.slice(1)].sha256);
  for (const [name, info] of Object.entries(p.baselineHashes)) if (name !== APP_PATH.slice(1)) assert.equal(p.servedHashes[name].sha256, info.sha256, name);
  assert.equal(hash(fs.readFileSync(path.join(ROOT, APP_PATH))), before);
  assert.ok(p.snapshot.bytes.has('/diagnostic-baseline.png'));
});
test('out-of-frame tiles are rejected before launch', () => {
  const o=options(); o.tiles=[[470,590,16,16]]; assert.throws(()=>prepare(o),/outside/);
});
test('changed geometry is rejected instead of silently diagnosing a newer scene', t => {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dark-diagnostic-test-')); t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  fs.cpSync(path.join(ROOT,'runtime'),path.join(dir,'runtime'),{recursive:true});
  fs.cpSync(path.join(ROOT,'whole-frontage-r04/runtime'),path.join(dir,'whole-frontage-r04/runtime'),{recursive:true});
  fs.appendFileSync(path.join(dir,'whole-frontage-r04/runtime/geometry.mjs'),'\n// changed test fixture\n');
  assert.throws(()=>prepare(options(),dir),/differs from frozen 22f4ce source/);
});
test('readback decoding preserves exact IDs, macro/actual normals, visibility, world position', () => {
  const p=pixelRecord(rawRecord(),baseline.snapshot);
  assert.equal(p.materialId,2); assert.equal(p.componentId,77); assert.equal(p.stateId,6); assert.equal(p.objectId,77);
  assert.deepEqual(p.macroNormal,[0,0,-1]); assert.deepEqual(p.actualNormal,[0,0,-1]); assert.equal(p.normalAngleDegrees,0);
  assert.equal(p.visibility,.1); assert.equal(p.visibilityQueried,true); assert.equal(p.throughGlass,false);
  assert.ok(p.worldPoint.every(Number.isFinite)); assert.ok(p.normalLightDot>0);
});
test('backfacing/no-query visibility is distinct from a tested unobstructed ray', () => {
  const r=rawRecord();r.normalAndVisibility=[0,-1,0,1];r.initial=[0,1,0,0];r.final=[0,1,0,0];
  const p=pixelRecord(r,baseline.snapshot);assert.equal(p.visibility,1);assert.equal(p.visibilityQueried,false);assert.ok(p.normalLightDot<0);assert.ok(p.normalAngleDegrees>89);
});
test('miss and nonfinite hit data are not mislabeled as valid surface evidence', () => {
  const r=rawRecord();r.hitRecord[3]=0;const p=pixelRecord(r,baseline.snapshot);assert.equal(p.worldPoint,null);assert.equal(p.hitStatusName,'miss');assert.equal(p.normalAngleDegrees,null);
  r.hitRecord[3]=1;r.normalAndVisibility[0]=NaN;assert.throws(()=>pixelRecord(r,baseline.snapshot),/non-finite/);
});
test('crop contract requires all 256 pixels and identical frozen world/camera', () => {
  const f=frame();assert.doesNotThrow(()=>validateCrop(f,[144,192,16,16],MODES[0],baseline));
  for(const change of [q=>q.visibilityContinuations.pop(),q=>q.visibilityContinuations[0].pixel=[0,0],q=>q.snapshot.snapshotId='new-world',q=>q.snapshot.eye[0]+=1,q=>q.snapshot.debug=4,q=>q.tiles=2,q=>q.inspectionCrop=false,q=>q.rayStatus.visibilityUnresolved=1]) {const q=structuredClone(f);change(q);assert.throws(()=>validateCrop(q,[144,192,16,16],MODES[0],baseline));}
});
test('normal-mode comparison reports raw baseline pixel differences without replacing them', () => {
  const a=Array(1024).fill(0),b=[...a];assert.equal(compareRGBA(a,b).exactMatch,true);b[10]=8;const result=compareRGBA(a,b);assert.equal(result.differingPixels,1);assert.equal(result.maximumChannelDelta,8);assert.equal(a[10],0);assert.throws(()=>compareRGBA(a,[0]));
});
test('crop capture decodes the first native PNG and rejects cleared transparent swap images',()=>{
 const source=fs.readFileSync(path.join(ROOT,'qa/inspect-dark-shapes.cjs'),'utf8');
 assert.ok(source.includes('fetch(nativePNG)'));
 assert.ok(source.includes('ctx.drawImage(captured, tile[0], tile[1]'));
 assert.ok(source.includes("throw Error('Native diagnostic crop is unexpectedly transparent')"));
 assert.ok(!source.includes('ctx.drawImage(canvas,'));
});
