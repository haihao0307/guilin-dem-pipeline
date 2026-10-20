import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createAssetLoader} from './assets.mjs';
import {createClothWorld} from './world.mjs';
import {NativeMotion} from './upstream/native-motion.mjs';
import {sha} from './upstream/source-contract.mjs';

const manifest = JSON.parse(await fs.readFile(new URL('./sources.lock.json', import.meta.url), 'utf8'));
const assets = createAssetLoader({manifest, readBytes: path => fs.readFile(new URL('./upstream/' + path, import.meta.url))});
const [frozen, source] = await Promise.all([assets.gzipJSON('assets/native-person.json.gz'), assets.json('SOURCE_LOCK.json')]);
const actorPacket = {rig: frozen.rig, positions: Float32Array.from(frozen.positions), faces: Uint32Array.from(frozen.faces), bodyCount: frozen.bodyCount,
  boneOrder: frozen.boneOrder, headSkinIndices: frozen.canonical.headSkinIndices, headSkinWeights: frozen.canonical.headSkinWeights,
  sourceRevision: source.person.nativeAnchor};
const report = {schema: 'crowd-cloth-adapter-functional-verification@1', startedUTC: new Date().toISOString(),
  scope: {originalReferenceBodyFixture: true, P01FitVerified: false, renderingVerified: false, performanceBenchmark: false,
    originalJointFitRequired: true, externalMatrixProtocol: true, transactionalRollback: true}, tests: []};
const output = new URL('./verification.json', import.meta.url);
let actor;
const check = (name, ok) => {assert.ok(ok, name); report.tests.push({name, passed: true});};
const hashes = async world => ({body: await sha(world.actor.positions.buffer), skin: await sha(Float64Array.from(world.actor.skin.flatMap(m => Array.from(m))).buffer),
  garments: await Promise.all(world.solvers.map(async s => ({p: await sha(s.p.buffer), output: await sha(s.output.buffer), normals: await sha(s.normals.buffer)}))),
  elapsed: world.elapsed, frameSequence: world.frameSequence, bodyRevision: world.bodyRevision, clothRevision: world.clothRevision});
try {
  actor = await createClothWorld({actorPacket, personIdentity: source.person.person, assets, fitBackend: 'wasm',
    onProgress: p => {if (p.completedFitSteps && p.completedFitSteps % 12 === 0) console.log(JSON.stringify({completedFitSteps: p.completedFitSteps, totalFitSteps: 48}));}});
  report.initialization = actor.initialization;
  check('All 48 native joint-fit steps executed', actor.initialization.completedFitSteps === 48 && !actor.initialization.jointFitSkipped);
  const driver = new NativeMotion(actor.prepared.actor), dt = 1 / 60;
  actor.world.actor.at = () => {throw Error('Clothing attempted to advance its own action');};
  driver.at('step', dt);
  await actor.update({dt, skinMatrices: driver.skin, frameSequence: 1, timeSeconds: dt});
  check('One external pose accepted with no internal action advance', actor.lastFrameSequence === 1 && actor.world.motionTime === dt);
  check('All native skin matrices match the supplied pose', actor.world.actor.skin.every((m, i) => m.every((v, j) => v === driver.skin[i][j])));
  const before = await hashes(actor.world);
  await assert.rejects(actor.update({dt, skinMatrices: driver.skin, frameSequence: 1, timeSeconds: dt}), /strictly increase/);
  check('Duplicate frame cannot advance the solver', JSON.stringify(await hashes(actor.world)) === JSON.stringify(before));
  const bad = driver.skin.map(m => m.slice()); bad[0][0] = NaN;
  await assert.rejects(actor.update({dt, skinMatrices: bad, frameSequence: 2, timeSeconds: dt * 2}), /Nonfinite/);
  check('Invalid external matrix rejected before mutation', JSON.stringify(await hashes(actor.world)) === JSON.stringify(before));
  actor.world.acceleration.config.failAfterSolve = true;
  driver.at('step', dt * 2);
  await assert.rejects(actor.update({dt, skinMatrices: driver.skin, frameSequence: 2, timeSeconds: dt * 2}), /QA/);
  check('Native solve failure restores prior input pose and exact garment outputs', JSON.stringify(await hashes(actor.world)) === JSON.stringify(before));
  actor.world.acceleration.config.failAfterSolve = false;
  actor.reset();
  await actor.update({dt, skinMatrices: driver.skin, frameSequence: 1, timeSeconds: dt});
  check('Reset permits a fresh external sequence', actor.lastFrameSequence === 1 && !actor.lastError);
  report.finalAudit = actor.audit(); report.passed = true;
} catch (error) {
  report.passed = false; report.failure = {message: error.message, details: error.clothFailure || null, stack: error.stack};
  process.exitCode = 1;
} finally {
  actor?.dispose(); report.finishedUTC = new Date().toISOString();
  await fs.writeFile(output, JSON.stringify(report, (_, value) => typeof value === 'number' && !Number.isFinite(value) ? String(value) : value, 2) + '\n');
  console.log(JSON.stringify({passed: report.passed, tests: report.tests.length, failure: report.failure?.message, file: fileURLToPath(output)}));
}
