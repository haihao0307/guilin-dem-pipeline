import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Box3 } from 'three';
import {
  VERSION,
  byteLength,
  buildScore,
  parseScore,
  snapshot,
  equalSnapshots,
  measure,
  dispose
} from '../src/instrument.js';
import { FULL_SCORE, SCORES } from '../src/scores.js';

let checks = 0;
function test(name, fn) {
  fn();
  checks += 1;
  console.log(`PASS ${name}`);
}
function using(score, fn) {
  const built = buildScore(score);
  try { fn(built); } finally { dispose(built.root); }
}

assert.equal(VERSION, 'K2.0.0');
for (const shape of ['b', 's', 'c', 'n', 't', 'p']) {
  test(`4-byte primitive ${shape}`, () => using(`K2|${shape}`, ({ root, score }) => {
    const metrics = measure(root, score);
    assert.equal(metrics.bytes, 4);
    assert.equal(metrics.objects, 1);
    assert.ok(metrics.vertices > 0);
  }));
}

test('default box analytical bounds', () => using('K2|b', ({ root }) => {
  const box = new Box3().setFromObject(root);
  assert.deepEqual(box.min.toArray(), [-0.5, 0, -0.5]);
  assert.deepEqual(box.max.toArray(), [0.5, 1, 0.5]);
}));

test('horizontal torus keeps Y-up ground convention', () => using('K2|t1,.1', ({ root }) => {
  const box = new Box3().setFromObject(root);
  assert.ok(Math.abs(box.min.y) < 1e-6);
  assert.ok(Math.abs(box.max.y - 0.2) < 1e-5);
  assert.ok(box.max.x > 1.09 && box.max.z > 1.09);
}));

test('G group transforms all children', () => using('K2|G@2,0,0/0,90,0%2{b.5,1,.5}', ({ root }) => {
  const box = new Box3().setFromObject(root);
  assert.ok(box.min.x > 1.49 && box.max.x < 2.51);
  assert.ok(box.max.y > 1.99 && box.max.y < 2.01);
}));

test('vector L array expands along Z', () => using('K2|L5,0,0,.5{s.1}', ({ root, score }) => {
  const metrics = measure(root, score);
  const box = new Box3().setFromObject(root);
  assert.equal(metrics.objects, 5);
  assert.ok(box.min.z < -1.09 && box.max.z > 1.09);
}));

test('X grid expands 5x2x5', () => assert.equal(parseScore('K2|X5,2,5,.7,.5,.7{s.05}').count, 50));
test('H helix expands 64', () => assert.equal(parseScore('K2|H64,1.4,4.8,3.25,15{s.065}').count, 64));
test('zero-radius A performs rotation-only replication', () => assert.equal(parseScore('K2|A4,0,45,0{L8,0,0,.48{b}}').count, 32));

test('full score byte budget', () => assert.equal(byteLength(FULL_SCORE), 1012));
test('full score expands to 259 primitives', () => assert.equal(parseScore(FULL_SCORE).count, 259));
test('all named score fixtures parse', () => {
  for (const entry of Object.values(SCORES)) assert.ok(parseScore(entry.score).count > 0);
});

test('full score produces wide and tall spatial bounds', () => using(FULL_SCORE, ({ root, score }) => {
  const metrics = measure(root, score);
  const box = new Box3().setFromObject(root);
  assert.equal(metrics.objects, 259);
  assert.ok(box.max.x - box.min.x > 12);
  assert.ok(box.max.z - box.min.z > 12);
  assert.ok(box.max.y - box.min.y > 5);
  assert.ok(metrics.triangles > 200000);
}));

for (const score of [
  'K2|G@1,0,0{b;s@0,1,0}',
  'K2|A12,2,0,90{b.1,1,.1}',
  'K2|X3,2,3,.5,.5,.5{s.05}',
  'K2|H24,1,3,2{s.05}',
  FULL_SCORE
]) {
  test(`independent replay ${score === FULL_SCORE ? 'FULL_SCORE' : score}`, () => using(score, (left) => using(score, (right) => {
    assert.notEqual(left.root, right.root);
    assert.ok(equalSnapshots(snapshot(left.root), snapshot(right.root)));
  })));
}

test('equivalent explicit defaults produce equal output', () => using('K2|b', (left) => using('K2|b1,1,1', (right) => {
  assert.ok(equalSnapshots(snapshot(left.root), snapshot(right.root)));
})));

test('actual vertex mutation is detected', () => using('K2|b', ({ root }) => {
  const before = snapshot(root);
  root.children[0].geometry.attributes.position.array[0] += 0.25;
  assert.equal(equalSnapshots(before, snapshot(root)), false);
}));

test('instrument source has no workbench dependencies', async () => {
  const source = await readFile(new URL('../src/instrument.js', import.meta.url), 'utf8');
  for (const forbidden of ['document.', 'window.', 'OrbitControls', 'PerspectiveCamera', "from './scores", 'FULL_SCORE']) {
    assert.equal(source.includes(forbidden), false, `instrument source unexpectedly contains ${forbidden}`);
  }
});

const badScores = [
  '',
  'K1|b',
  'K2|',
  'K2|b;;s',
  'K2|G#fff{b}',
  'K2|G@{b}',
  'K2|A0,1{s}',
  'K2|A2.5,1{s}',
  'K2|A2,-1{s}',
  'K2|L2,0,0,0{s}',
  'K2|L2,1,2{s}',
  'K2|X2,2,2,1,0,1{s}',
  'K2|X2.5,2,2,1,1,1{s}',
  'K2|H2,0,0,1{s}',
  'K2|H2,1,2{s}',
  'K2|s#zzz',
  'K2|b%0',
  'K2|s!2',
  'K2|s@1#fff',
  'K2|' + 'G{'.repeat(12) + 's' + '}'.repeat(12),
  'K2|X20,20,20,1,1,1{s}'
];
for (const score of badScores) test(`reject ${score.slice(0, 70)}`, () => assert.throws(() => parseScore(score)));

console.log(`UNIT_CHECKS ${checks}`);
