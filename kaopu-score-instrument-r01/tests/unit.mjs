import assert from 'node:assert/strict';
import { Box3 } from 'three';
import { buildScore, parseScore, snapshot, equalSnapshots, measure, dispose } from '../src/instrument.js';
let checks = 0;
function test(name, fn) { fn(); checks++; console.log(`PASS ${name}`); }
function using(score, fn) { const x = buildScore(score); try { fn(x); } finally { dispose(x.root); } }
for (const s of ['b', 's', 'c', 'n', 't', 'p']) test(`4-byte ${s}`, () => using(`K1|${s}`, (x) => { const m = measure(x.root, x.score); assert.equal(m.bytes, 4); assert.equal(m.objects, 1); assert.ok(m.vertices > 0); }));
test('box analytical bounds', () => using('K1|b', ({root}) => { const b = new Box3().setFromObject(root); assert.deepEqual(b.min.toArray(), [-0.5, 0, -0.5]); assert.deepEqual(b.max.toArray(), [0.5, 1, 0.5]); }));
test('transformed box analytical bounds', () => using('K1|b1,2,.5@3,0,0', ({root}) => { const b = new Box3().setFromObject(root); assert.deepEqual(b.min.toArray(), [2.5, 0, -0.25]); assert.deepEqual(b.max.toArray(), [3.5, 2, 0.25]); }));
for (const score of ['K1|b', 'K1|A12,1.2{s.15}', 'K1|L9,.28{s.11}', 'K1|A8,1.1{A5,.26{s.07#eb5}}']) test(`output replay ${score}`, () => using(score, (a) => using(score, (b) => { assert.ok(equalSnapshots(snapshot(a.root), snapshot(b.root))); assert.notEqual(a.root, b.root); })));
test('equivalent scores compare equal output', () => using('K1|b', (a) => using('K1|b1,1,1', (b) => assert.ok(equalSnapshots(snapshot(a.root), snapshot(b.root))))));
test('actual vertex mutation detected', () => using('K1|b', ({root}) => { const before = snapshot(root); root.children[0].geometry.attributes.position.array[0] += 0.25; assert.equal(equalSnapshots(before, snapshot(root)), false); }));
test('material mutation detected', () => using('K1|b', ({root}) => { const before = snapshot(root); root.children[0].material.roughness = 0.2; assert.equal(equalSnapshots(before, snapshot(root)), false); }));
test('transform mutation detected', () => using('K1|b', ({root}) => { const before = snapshot(root); root.children[0].position.x = 3; assert.equal(equalSnapshots(before, snapshot(root)), false); }));
test('nested count 40', () => assert.equal(parseScore('K1|A8,1.1{A5,.26{s.07}}').count, 40));
for (const bad of ['', 'K2|b', 'K1|', 'K1|b;;s', 'K1|s@', 'K1|s#zzz', 'K1|A0,1{s}', 'K1|A2.5,1{s}', 'K1|A2,1,3{s}', 'K1|A2,,1{s}', 'K1|A256,1{L256,1{s}}', 'K1|b1e308', 'K1|b0', 'K1|t.2,.3', 'K1|b%0', 'K1|s!2', 'K1|s@1#fff', 'K1|' + 'A1,1{'.repeat(9) + 's' + '}'.repeat(9), 'K1|b' + ' '.repeat(4097) + ';s']) test(`reject ${bad.slice(0,70)}`, () => assert.throws(() => parseScore(bad)));
console.log(`UNIT_CHECKS ${checks}`);
