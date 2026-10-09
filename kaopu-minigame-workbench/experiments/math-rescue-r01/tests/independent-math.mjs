import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import {
  initial, step, undo, blocked, available, supply, flowWitness,
  ANCHORS, distance, LIMIT, outcome
} from '../core.mjs';
import { POINTS, along } from '../scene.mjs';

// Finite implementation audit only. This neither executes Lean nor verifies a research paper.
const checks = [];
function test(name, run) { run(); checks.push({ name, passed: true }); }
function route(beats) { return beats.reduce((state, ids) => step(state, ids), initial()); }

test('Valid and rejected actions do not mutate the input state', () => {
  const state = initial(), before = structuredClone(state);
  step(state, ['anchor']);
  assert.deepEqual(state, before);
  assert.throws(() => step(state, ['anchor', 'basket']));
  assert.deepEqual(state, before);
});

test('All relevant dependencies are checked at the start of a beat', () => {
  assert.throws(() => step(initial(), ['anchor', 'basket']));
  let state = step(initial(), ['first', 'anchor']);
  assert.throws(() => step(state, ['engineer', 'valve']));
  state = step(state, ['engineer', 'basket']);
  assert.throws(() => step(state, ['valve', 'platform']));
});

test('Waiting does not accumulate supply', () => {
  let state = initial();
  for (let i = 0; i < 4; i++) {
    assert.equal(supply(state), .75);
    state = step(state, []);
  }
  assert.equal(state.status, 'lost');
  assert.equal(supply(state), .75);
  assert.equal(state.saved.length, 0);
});

test('Rescuing all three nearby people does not remove device demand', () => {
  const state = route([['near1', 'near2', 'first'], ['engineer']]);
  assert.equal(state.saved.length, 3);
  assert.equal(supply(state), .75);
  assert(blocked(state, 'platform'));
});

test('Supply depends only on the selected network configuration', () => {
  for (const done of [[], ['widen'], ['valve'], ['widen', 'valve']]) {
    for (let beat = 0; beat <= 4; beat++) {
      for (const saved of [[], ['lin'], ['lin', 'shan', 'engineer']]) {
        assert.equal(supply({ ...initial(), done, beat, saved }),
          done.includes('valve') ? 1 : done.includes('widen') ? .875 : .75);
      }
    }
  }
});

test('A widened-road platform win reports its actual route and expense', () => {
  const state = route([
    ['anchor', 'first', 'widen'], ['basket', 'engineer', 'near1'],
    ['valve', 'near2'], ['platform']
  ]);
  assert.equal(state.status, 'won');
  assert.equal(state.material, 0);
  assert(!state.done.includes('cross'));
  assert(outcome(state).includes('升降台'));
  assert(outcome(state).includes('旧路扩容'));
  assert(!outcome(state).includes('最后缺口'));
});

test('Two available return routes cannot rescue the same person twice', () => {
  const state = route([
    ['anchor', 'first', 'near1'], ['basket', 'engineer', 'near2'], ['cross', 'valve']
  ]);
  assert(!blocked(state, 'pull'));
  assert(!blocked(state, 'platform'));
  assert.throws(() => step(state, ['pull', 'platform']));
  for (const id of ['pull', 'platform']) {
    const lastBeat = step(state, [id]);
    assert.equal(lastBeat.saved.length, 4);
    assert.equal(lastBeat.beat, 4);
    assert.equal(lastBeat.status, 'won');
  }
});

test('Flow witnesses have correct endpoints, commodity totals and edge loads', () => {
  for (const mode of ['base', 'wide', 'bypass']) {
    const witness = flowWitness(mode), totals = {};
    const loads = Object.fromEntries(Object.keys(witness.edges).map(k => [k, 0]));
    for (const { demand, path, amount } of witness.paths) {
      assert(amount > 0);
      assert.equal(path[0] + path.at(-1), demand);
      totals[demand] = (totals[demand] || 0) + amount;
      for (let i = 1; i < path.length; i++) {
        let edge = path[i - 1] + path[i];
        if (!(edge in loads)) edge = path[i] + path[i - 1];
        assert(edge in loads);
        loads[edge] += amount;
      }
    }
    assert.deepEqual(Object.keys(totals).sort(), ['UV', 'XY', 'YZ', 'ZX']);
    for (const amount of Object.values(totals)) assert.equal(amount, witness.rate);
    for (const [edge, load] of Object.entries(loads)) {
      assert.equal(load, witness.edges[edge].load);
      assert(load <= witness.edges[edge].capacity);
    }
  }
});

test('The affine picture uses the declared Gaussian-prime anchor coordinates', () => {
  for (const [id, [a, b]] of Object.entries(ANCHORS)) {
    assert.deepEqual(POINTS[id], [50 * a + 185 * b - 170, 35 * a - 140 * b + 825]);
  }
  for (const edge of ['AB', 'BC', 'CD']) {
    assert(distance(ANCHORS[edge[0]], ANCHORS[edge[1]]) <= LIMIT);
  }
  for (const edge of ['AC', 'AD', 'BD']) {
    assert(distance(ANCHORS[edge[0]], ANCHORS[edge[1]]) > LIMIT);
  }
});

test('Direct return samples remain on the completed relay polyline', () => {
  const points = [POINTS.yao, POINTS.D, POINTS.C, POINTS.B, POINTS.A, [153, 648]];
  assert.deepEqual(along(points, 0), points[0]);
  assert.deepEqual(along(points, 1), points.at(-1));
  for (let i = 0; i <= 1000; i++) {
    const p = along(points, i / 1000);
    assert(points.slice(1).some((b, j) => {
      const a = points[j];
      return Math.abs(Math.hypot(p[0] - a[0], p[1] - a[1])
        + Math.hypot(p[0] - b[0], p[1] - b[1])
        - Math.hypot(b[0] - a[0], b[1] - a[1])) < 1e-6;
    }));
  }
});

let transitions = 0, uniquePrefixStates = 1, winningTransitions = 0;
test('Reachable finite states preserve rescue uniqueness, budgets and exact undo', () => {
  let layer = [initial()];
  for (let beat = 1; beat <= 4; beat++) {
    const next = new Map();
    for (const state of layer) {
      const selections = [[]];
      for (const id of available(state)) {
        for (const old of [...selections]) if (old.length < 3) selections.push([...old, id]);
      }
      for (const ids of selections) {
        let after;
        try { after = step(state, ids); } catch { continue; }
        transitions++;
        assert.equal(after.saved.length, new Set(after.saved).size);
        assert(after.material >= 0);
        assert(after.beat <= 4);
        assert.deepEqual(undo(after), state);
        assert.equal(supply(after), after.done.includes('valve') ? 1
          : after.done.includes('widen') ? .875 : .75);
        if (after.status === 'won') {
          winningTransitions++;
          assert.equal(after.beat, 4);
          assert.equal(after.saved.length, 4);
        } else if (after.status === 'playing') {
          assert(beat < 4);
          next.set([...after.done].sort().join(','), after);
        }
      }
    }
    uniquePrefixStates += next.size;
    layer = [...next.values()];
  }
  assert(winningTransitions > 0);
});

const hashes = Object.fromEntries(['core.mjs', 'scene.mjs', 'app.mjs'].map(name => [name,
  createHash('sha256').update(fs.readFileSync(new URL('../' + name, import.meta.url))).digest('hex')]));
const result = { passed: true, scope: 'Finite core rules and source-level rendering audit; not a Lean or browser certification',
  checks, transitions, uniquePrefixStates, winningTransitions, hashes };
fs.mkdirSync('evidence', { recursive: true });
fs.writeFileSync('evidence/independent-math-audit.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
