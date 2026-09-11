// Node >=24. Imports the fixed upstream TS files directly; no browser or GPU claim.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { RevisionCache } from '../ADAPTERS/revision_cache_r30.mjs';
const repo = resolve(process.argv[2] || 'tellux-reference');
const expected = '72a1c38b62b5f067720d629da55cf6062b1e1f10';
assert.equal(execFileSync('git', ['-C', repo, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), expected);
const load = async (p) => {
  const disk = readFileSync(resolve(repo, p));
  const locked = execFileSync('git', ['-C', repo, 'show', `${expected}:${p}`]);
  assert.equal(createHash('sha256').update(disk).digest('hex'), createHash('sha256').update(locked).digest('hex'));
  return import(pathToFileURL(resolve(repo, p)));
};
const { AsyncLruCache } = await load('src/sampling/AsyncLruCache.ts');
const { cartographicOffsetMeters, resolveClusterReference, createClusterCellKey } = await load('src/hism/spatial/clusterGrid.ts');
const { cloudAltitudeFade, shouldRenderCloudPass } = await load('src/rendering/cloudAltitudeFade.ts');
const { ResourceScope } = await load('src/lifecycle/ResourceLifecycle.ts');
const { resolveLodLevel } = await load('src/hism/lod/resolveLodLevel.ts');
const checks = [];
const check = async (name, fn) => { await fn(); checks.push(name); };
const deferred = () => { let done; const promise = new Promise(r => done = r); return { promise, done }; };
const identity = queryKey => ({ sourceId: 'synthetic-probe', sourceRevision: 'r1', queryKey });
let upstreamSize;
await check('upstream pending-head capacity counterexample reproduced', async () => {
  const c = new AsyncLruCache(2), d = deferred();
  const first = c.getOrCreate('old', () => d.promise);
  for (let i = 0; i < 10; i++) await c.getOrCreate(`k${i}`, () => i);
  upstreamSize = c.size; assert.equal(upstreamSize, 11); d.done(0); await first;
});
const dateline = cartographicOffsetMeters(179.9, 0, -179.9, 0).east;
await check('upstream local longitude approximation is not a global address', () => {
  assert.ok(Math.abs(dateline) > 40000000);
  assert.equal(resolveClusterReference([179.9, -179.9], [0, 0]).longitude, 0);
});
await check('local meter cell boundaries', () => assert.equal(createClusterCellKey(600, -50, 512), '1:-1'));
await check('LOD changes renderer choice only in upstream resolver', () => {
  const levels = [{ maxDistanceMeters: 600 }, { maxDistanceMeters: Infinity }];
  assert.equal(resolveLodLevel(600, levels), 0); assert.equal(resolveLodLevel(601, levels), 1);
});
await check('cloud fade and hysteresis decisions', () => {
  assert.equal(cloudAltitudeFade(30000), 0.5);
  assert.equal(shouldRenderCloudPass(39000, true), true);
  assert.equal(shouldRenderCloudPass(39000, false), false);
  assert.equal(shouldRenderCloudPass(37999, false), true);
  assert.equal(shouldRenderCloudPass(null, true), false);
});
await check('construction rollback survives cleanup error', () => {
  const s = new ResourceScope(), order = [];
  s.defer(() => order.push(1)); s.defer(() => { order.push(2); throw Error('cleanup'); });
  assert.equal(s.rollback().length, 1); assert.deepEqual(order, [2, 1]); assert.deepEqual(s.rollback(), []);
});
await check('candidate bounded settled cache despite oldest pending', async () => {
  const c = new RevisionCache({ maxPending: 2, maxSettled: 2, maxBytes: 4 }), d = deferred();
  const first = c.get(identity('old'), () => d.promise);
  for (let i = 0; i < 10; i++) { await c.get(identity(`${i}`), () => ({ value: i, bytes: 2 }));
    assert.ok(c.stats.settled <= 2 && c.stats.declaredBytes <= 4); }
  d.done({ value: 0, bytes: 2 }); await first; assert.equal(c.stats.settled, 2);
});
await check('candidate deduplicates same revision', async () => {
  const c = new RevisionCache(); let calls = 0;
  const loader = () => { calls++; return { value: 1, bytes: 1 }; };
  const a = c.get(identity('a'), loader), b = c.get(identity('a'), loader);
  assert.equal(a, b); await a; assert.equal(calls, 1);
});
await check('candidate failure permits retry', async () => {
  const c = new RevisionCache();
  await assert.rejects(c.get(identity('a'), () => { throw Error('network'); }), /network/);
  assert.equal(await c.get(identity('a'), () => ({ value: 2, bytes: 1 })), 2);
});
await check('candidate source revision prevents stale reuse', async () => {
  const c = new RevisionCache(); await c.get(identity('a'), () => ({ value: 1, bytes: 1 }));
  assert.equal(await c.get({ ...identity('a'), sourceRevision: 'r2' }, () => ({ value: 2, bytes: 1 })), 2);
});
await check('candidate late response rejected after invalidation', async () => {
  const c = new RevisionCache(), d = deferred();
  const old = c.get(identity('a'), () => d.promise); await Promise.resolve(); c.invalidate();
  const rejected = assert.rejects(old, /stale-generation/);
  assert.equal(await c.get(identity('a'), () => ({ value: 'new', bytes: 1 })), 'new');
  d.done({ value: 'old', bytes: 1 }); await rejected; assert.equal(c.stats.settled, 1);
});
await check('candidate pending budget retains ignored-abort work', async () => {
  const c = new RevisionCache({ maxPending: 1 }), d = deferred();
  const a = c.get(identity('a'), () => d.promise); await Promise.resolve(); c.invalidate();
  const rejected = assert.rejects(a, /stale-generation/);
  await assert.rejects(c.get(identity('b'), () => ({ value: 1, bytes: 1 })), /pending-budget/);
  d.done({ value: 0, bytes: 1 }); await rejected; assert.equal(c.stats.pending, 0);
});
await check('candidate oversized payload not retained', async () => {
  const c = new RevisionCache({ maxBytes: 1 });
  assert.equal(await c.get(identity('a'), () => ({ value: 3, bytes: 2 })), 3);
  assert.equal(c.stats.settled, 0);
});
await check('candidate invalidate does not abort reentrant new-generation request', async () => {
  const c = new RevisionCache({ maxPending: 2 }), d = deferred(); let replacement;
  const old = c.get(identity('old'), signal => {
    signal.addEventListener('abort', () => {
      replacement = c.get(identity('new'), () => ({ value: 'new', bytes: 1 }));
    });
    return d.promise;
  });
  await Promise.resolve(); const rejected = assert.rejects(old, /stale-generation/);
  c.invalidate(); assert.equal(await replacement, 'new');
  d.done({ value: 'old', bytes: 1 }); await rejected;
});
await check('candidate rejects invalid identity and byte metadata', async () => {
  const c = new RevisionCache(); assert.throws(() => c.get({ ...identity('x'), sourceRevision: '' }, () => 0));
  await assert.rejects(c.get(identity('x'), () => ({ value: 0, bytes: NaN })), /declared bytes/);
});
console.log(JSON.stringify({ sourceCommit: expected, checkCount: checks.length, checks,
  reproduced: { upstreamCapacityTwoObservedSize: upstreamSize, datelineEastMeters: dateline },
  evidenceScope: 'CPU source functions and synthetic candidate cache; not full upstream tests',
  browserPassed: false, gpuPerformanceMeasured: false, productionMotherModified: false,
  formalR2Frozen: false }, null, 2));
