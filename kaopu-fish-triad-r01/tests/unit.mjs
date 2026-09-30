import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { compileSourceScore, compareSectionStations, createReferenceLedgerEntry } from '../src/composer.js';
import { validate, build, update, measure, snapshot, compareSnapshots, dispose, VERSION } from '../src/instrument.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = async (relative) => JSON.parse(await readFile(path.join(root, relative), 'utf8'));
const baseText = await readFile(path.join(root, 'scores/base/FISH_AXIAL_BASE_KF1.json'), 'utf8');
const base = JSON.parse(baseText);
const source = await readJson('scores/source/MUSKELLUNGE_SOURCE_SCORE_R01.json');
const resolved = await readJson('scores/resolved/MUSKELLUNGE_RESOLVED_SCORE_R01.json');
const baseSha = createHash('sha256').update(baseText).digest('hex');

assert.equal(VERSION, 'KF1.0.0');
assert.deepEqual(compileSourceScore(base, source, baseSha), resolved, 'Base + Source must compile exactly to checked-in Resolved Score');
assert.equal(validate(resolved).valid, true, validate(resolved).errors.join('\n'));
assert.equal(resolved.provenance.externalAssetInFormalBuild, false);
assert.equal(JSON.stringify(resolved).includes('modelUrl'), false);
assert.equal(JSON.stringify(resolved).includes('glbUrl'), false);
assert.equal(JSON.stringify(resolved).includes('fbxUrl'), false);

const first = build(resolved);
const firstStats = measure(first);
assert.equal(firstStats.bones, 14, '11 body bones + 3 branch bones expected');
assert.ok(firstStats.vertices > 6500, 'procedural result should have substantial geometry');
assert.ok(firstStats.triangles > 12000, 'procedural result should have substantial topology');
assert.ok(firstStats.meshes > 20, 'eyes, jaws, teeth and fins should be explicit procedural parts');
assert.ok(firstStats.bounds.size[0] > 0.95 && firstStats.bounds.size[0] < 1.05, 'length should remain near measured one metre teacher');

update(first, 1.25, { waterFlowMps: [0, 0, 0] }, { mode: 'CRUISE_DIAGNOSTIC' });
const snapA = snapshot(first);
const second = build(resolved);
update(second, 1.25, { waterFlowMps: [0, 0, 0] }, { mode: 'CRUISE_DIAGNOSTIC' });
const snapB = snapshot(second);
assert.equal(compareSnapshots(snapA, snapB).equal, true, 'same score/time/mode must replay exact geometry and bone matrices');

const renamed = structuredClone(resolved);
renamed.object.label = 'Display name has no geometry semantics';
const renamedHandle = build(renamed);
update(renamedHandle, 1.25, {}, { mode: 'CRUISE_DIAGNOSTIC' });
const renamedSnap = snapshot(renamedHandle);
assert.equal(compareSnapshots(snapA, renamedSnap).equal, true, 'changing only display name must not change result');

const changed = structuredClone(resolved);
changed.construction.sections.stations[9].halfHeightM += 0.008;
const changedHandle = build(changed);
update(changedHandle, 1.25, {}, { mode: 'CRUISE_DIAGNOSTIC' });
const changedSnap = snapshot(changedHandle);
assert.equal(compareSnapshots(snapA, changedSnap).equal, false, 'structural score change must change actual arrays');

const staticHandle = build(resolved);
update(staticHandle, 0.7, {}, { mode: 'STATIC_RIG' });
const staticSnap = snapshot(staticHandle);
update(staticHandle, 0.7, {}, { mode: 'RIG_SERIAL_CHECK' });
const rigSnap = snapshot(staticHandle);
assert.equal(compareSnapshots(staticSnap, rigSnap).equal, false, 'diagnostic motion must alter bone matrices');

const invalid = structuredClone(resolved);
invalid.construction.sections.stations = [];
assert.equal(validate(invalid).valid, false, 'empty score cannot generate a default fish');
assert.throws(() => build(invalid), /8–128/, 'invalid score must fail rather than fall back');
const forbidden = structuredClone(resolved);
forbidden.construction.modelUrl = 'hidden.glb';
assert.equal(validate(forbidden).valid, false, 'runtime model references are forbidden');

const compare = compareSectionStations(resolved.construction.sections.stations, resolved.construction.sections.stations);
assert.deepEqual(compare, { comparable: true, maxAbsolute: 0, rms: 0, count: 90 });
const ledger = createReferenceLedgerEntry({ packageName: 'teacher.zip', sha256: 'abc', vertices: 1, triangles: 1, textureCount: 5, rigged: false });
assert.equal(ledger.allowedInFormalRuntime, false);
assert.ok(ledger.cannotProve.includes('natural motion'));

for (const handle of [first, second, renamedHandle, changedHandle, staticHandle]) dispose(handle);
assert.equal(first.disposed, true);
console.log(JSON.stringify({ passed: true, version: VERSION, firstStats, checks: 25 }, null, 2));
