// Execute the actual main.mjs scheduling functions against deferred worker
// boundaries. These are transaction/control-flow tests, not physics or GPU FPS.
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as THREE from '../cloth/upstream/vendor/three.module.js';

const mainSource = await readFile(new URL('../main.mjs', import.meta.url), 'utf8');
const bootTail = mainSource.indexOf('\nboot().catch(');
assert.ok(bootTail > 0);
const gateStart = mainSource.indexOf('  const nativeViewerRender=viewer.render.bind(viewer);');
const gateEnd = mainSource.indexOf('  viewer.renderer.info.autoReset=false;', gateStart);
assert.ok(gateStart > 0 && gateEnd > gateStart);
const renderGateSource = mainSource.slice(gateStart, gateEnd);
const executable = mainSource.slice(0, bootTail).replace(/^import[^\n]*\n/gm, '');
const yieldMicrotasks = async () => {for (let i = 0; i < 12; i++) await Promise.resolve();};
function deferred() {let resolve, reject; const promise = new Promise((a, b) => {resolve = a; reject = b;}); return {promise, resolve, reject};}
function environment() {
  const logs = [], context = vm.createContext({THREE, performance, setTimeout, clearTimeout,
    console: {error: (...args) => logs.push(['error', ...args]), log() {}},
    document: {getElementById: () => null, querySelectorAll: () => []}});
  vm.runInContext(executable + `\nglobalThis.api={state,actors,setAction,step,fail,renderScene,moveActor,metric,
    configure(v,a){viewer=v;actors.splice(0,actors.length,...a);},
    get pendingTick(){return pendingTick;},installGate(){${renderGateSource}}};`, context);
  const api = context.api, workers = [deferred(), deferred()];
  const actors = workers.map((worker, index) => {
    const actor = {id: String(index + 1), worldRoot: new THREE.Group(), timeSeconds: 0, frameSequence: -1,
      finalSkinMatrices: [Float32Array.from([1, 0, 0, 0])], advances: 0, publications: 0,
      async setMotion(mode, options) {logs.push(['selected', this.id, mode, options.phaseSeconds]); this.mode = mode;},
      advance(dt, tick) {this.advances++; this.timeSeconds += dt; this.frameSequence = tick; logs.push(['advance', this.id, tick]);},
      publishPose(tick) {this.publications++; this.frameSequence = tick; logs.push(['publish', this.id, tick]);},
      prepareRender() {logs.push(['pose-bake', this.id]); viewer.renderer.info.render.calls++;},
      shoes: {update() {logs.push(['shoe-update', String(index + 1)]);}},
      hair: {reset() {logs.push(['hair-reset', String(index + 1)]);},
        update(dt, tick) {logs.push(['hair-update', String(index + 1), dt, tick]);}},
    };
    actor.cloth = {frame: {frameSequence: -1},
      async reset() {logs.push(['cloth-reset', actor.id]); this.frame = {frameSequence: -1};},
      update(input) {logs.push(['cloth-input', actor.id, input]);
        return worker.promise.then(() => {this.frame = {frameSequence: input.frameSequence}; return this.frame;});},
      pause() {logs.push(['cloth-pause', actor.id]);},
      renderUpdate() {logs.push(['cloth-render', actor.id]);},
    };
    return actor;
  });
  const viewer = {scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), renders: 0,
    renderer: {info: {render: {calls: 0, triangles: 0}, reset() {logs.push(['info-reset']); this.render.calls = 0;}}, shadowMap: {}},
    render() {logs.push(['native-render']); this.renders++; this.renderer.info.render.calls++;}};
  api.configure(viewer, actors); api.installGate();
  Object.assign(api.state, {ready: true, busy: false, count: 2, selected: '1'});
  return {api, workers, actors, viewer, logs};
}

const checks = [];
async function check(name, run) {await run(); checks.push({name, passed: true});}
await check('selected motion stays unpublished until all cloth actors accept the exact final pose', async () => {
  const {api, workers, actors, viewer, logs} = environment(); api.state.busy = true;
  let done = false; const task = api.setAction('walk').then(() => {done = true;});
  await yieldMicrotasks();
  assert.equal(logs.filter(row => row[0] === 'cloth-input').length, 2);
  for (const row of logs.filter(row => row[0] === 'cloth-input')) {
    assert.equal(row[2].skinMatrices, actors[Number(row[1]) - 1].finalSkinMatrices);
    assert.equal(row[2].timeSeconds, 0);
  }
  assert.equal(actors.reduce((n, a) => n + a.publications + a.advances, 0), 0);
  api.renderScene(); viewer.render(); assert.equal(viewer.renders, 0);
  workers[0].resolve(); await yieldMicrotasks(); assert.equal(done, false);
  workers[1].resolve(); await task;
  assert.ok(actors.every(a => a.publications === 1 && a.advances === 0));
  assert.ok(actors.every(a => a.frameSequence === a.cloth.frame.frameSequence));
  assert.ok(logs.filter(row => row[0] === 'hair-update').every(row => row[2] === 0));
  assert.equal(api.state.poseSynchronizations.length, 1);
  assert.equal(api.state.poseSynchronizations[0].countsAsMeasuredStep, false);
  assert.equal(viewer.renders, 0);
  api.state.busy = false; api.renderScene(); assert.equal(viewer.renders, 1);
});

await check('one rejected cloth actor waits for all workers, then freezes every rendering and movement entry', async () => {
  const {api, workers, actors, viewer} = environment();
  const submitted = {tick: 0, label: 'previous complete submitted frame'};
  api.state.lastSubmittedFrame = submitted;
  let completed = false, error;
  const task = api.step().then(() => {completed = true;}, e => {completed = true; error = e; api.fail(e);});
  await yieldMicrotasks(); assert.ok(api.pendingTick);
  workers[0].reject(Error('Injected native safety rejection')); await yieldMicrotasks();
  assert.equal(completed, false); assert.equal(viewer.renders, 0); assert.ok(api.pendingTick);
  workers[1].resolve(); await task;
  assert.equal(error.frameTransaction.allWorkerResponsesSettled, true);
  assert.equal(error.frameTransaction.published, false);
  assert.equal(api.pendingTick, null); assert.equal(api.state.renderFrozen, true);
  assert.equal(api.state.lastSubmittedFrame, submitted);
  const before = actors[0].worldRoot.position.toArray(), advances = actors[0].advances;
  api.renderScene(); viewer.render(); api.moveActor('left'); await api.step();
  assert.equal(viewer.renders, 0); assert.deepEqual(actors[0].worldRoot.position.toArray(), before);
  assert.equal(actors[0].advances, advances);
});

await check('hair errors also drain already-started cloth workers before freezing the scene', async () => {
  const {api, workers, actors, viewer} = environment();
  actors[0].hair.update = () => {throw Error('Injected hair failure');};
  let completed = false, error;
  const task = api.step().catch(e => {completed = true; error = e; api.fail(e);});
  await yieldMicrotasks(); assert.equal(completed, false);
  workers[0].resolve(); await yieldMicrotasks(); assert.equal(completed, false);
  workers[1].resolve(); await task;
  assert.equal(error.message, 'Injected hair failure');
  assert.equal(error.frameTransaction.allWorkerResponsesSettled, true); assert.equal(viewer.renders, 0);
});

await check('successful unified tick advances once and counts native pose-bake draw submissions', async () => {
  const {api, workers, actors, viewer, logs} = environment();
  const task = api.step(); await yieldMicrotasks();
  assert.ok(actors.every(a => a.advances === 1)); assert.equal(viewer.renders, 0);
  workers.forEach(w => w.resolve()); await task;
  assert.equal(viewer.renders, 1); assert.equal(api.state.samples.length, 1);
  assert.equal(api.state.samples[0].drawCalls, 3); // 2 test pose bakes + 1 test scene submission
  assert.ok(logs.findIndex(row => row[0] === 'info-reset') < logs.findIndex(row => row[0] === 'pose-bake'));
  assert.ok(actors.every(a => a.frameSequence === a.cloth.frame.frameSequence));
  assert.ok(api.state.samples[0].submissionCompletedAt > 0);
  assert.match(api.metric(api.state.samples).frameRateBasis, /not measured GPU completion or display presentation/);
});

const evidence = {schema: 'unified-scheduler-control-flow-verification/1', atUTC: new Date().toISOString(),
  mainSHA256: createHash('sha256').update(mainSource).digest('hex'),
  scope: 'actual main.mjs scheduling functions with deferred worker and renderer interfaces; no native solver timings, GPU execution, browser appearance or FPS claim',
  tests: checks, remainingBrowserChecks: ['complete reset/rebuild through actual DOM and workers',
    'render routing and native face optics on actual GPU', 'initial selected-pose solver acceptance for the actual P01']};
await writeFile(new URL('./scheduler-verification.json', import.meta.url), JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify({passed: checks.length, total: checks.length, scope: evidence.scope}));
