// Exercise actual main.mjs UI and measurement control flow with deferred
// worker boundaries. No numerical solver, browser rendering or FPS is tested.
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as THREE from '../cloth/upstream/vendor/three.module.js';

const source = await readFile(new URL('../main.mjs', import.meta.url), 'utf8');
const tail = source.indexOf('\nboot().catch(');
assert.ok(tail > 0);
const executable = source.slice(0, tail).replace(/^import[^\n]*\n/gm, '');
const microtasks = async () => {for (let i = 0; i < 16; i++) await Promise.resolve();};
function deferred() {let resolve, reject; const promise = new Promise((a, b) => {resolve = a; reject = b;}); return {promise, resolve, reject};}

function environment() {
  const nodes = new Map(), events = new Map(), queues = [[], []], log = [];
  const element = (id, dataset = {}) => ({id, dataset, disabled: false, value: '', checked: false,
    textContent: '', style: {}, classList: {toggle() {}}});
  for (const id of ['runtime-status', 'runtime-evidence', 'fps-stat', 'step-stat', 'time-stat', 'draw-stat',
    'timing-note', 'scene-caption', 'ready-badge', 'play-button', 'step-button', 'reset-button',
    'motion-select', 'speed-select', 'hair-physics', 'wind', 'actor-select', 'home-button',
    'focus-button', 'benchmark-button', 'copy-button', 'benchmark-result', 'load-progress']) nodes.set(id, element(id));
  const countButtons = [1, 2, 4].map(n => element('count-' + n, {count: String(n)}));
  const moveButtons = ['left', 'right', 'forward', 'back', 'turn-left', 'turn-right'].map(move => element(move, {move}));
  const controls = [...nodes.values()].filter(n => /button|select|hair-physics|^wind$/.test(n.id)).concat(countButtons, moveButtons);
  const gl = {getExtension: () => null};
  const viewer = {canvas: {width: 1280, height: 720}, camera: new THREE.PerspectiveCamera(45, 1280 / 720),
    orbit: {enabled: true, autoRotate: true, target: new THREE.Vector3(0, 1, 0), update() {}}, renders: 0,
    renderer: {getContext: () => gl, info: {render: {calls: 0, triangles: 0}, reset() {this.render.calls = 0;}}, shadowMap: {},
      setSize(w, h) {viewer.canvas.width = w; viewer.canvas.height = h; log.push(['resize', w, h]);}},
    render() {this.renders++; this.renderer.info.render.calls++;}};
  const stage = {getBoundingClientRect: () => ({width: 900, height: 650})};
  const document = {getElementById: id => nodes.get(id) || null, querySelectorAll(selector) {
    if (selector === '[data-count]') return countButtons;
    if (selector === '[data-move]') return moveButtons;
    if (selector === '#crowd-stage canvas') return [viewer.canvas];
    if (selector === '#crowd-app button,#crowd-app select,#crowd-app input') return controls;
    return [];
  }};
  const context = vm.createContext({THREE, performance, setTimeout, clearTimeout, document,
    window: {addEventListener: (name, fn) => events.set(name, fn)}, navigator: {},
    console: {error: (...args) => log.push(['error', ...args])}});
  vm.runInContext(executable + `\nglobalThis.api={state,actors,startBenchmark,abortBenchmark,step,fail,resize,cameraHome,moveActor,changeCount,
    get benchmark(){return benchmark;},get pendingTick(){return pendingTick;},
    configure(v,s,a){viewer=v;stage=s;actors.splice(0,actors.length,...a);
      actorFactory={};hairFactory={report:()=>({})};shoeFactory={report:()=>({})};bindControls();updateHUD(true);}};`, context);
  const api = context.api;
  const actors = [0, 1].map(index => {
    const actor = {id: String(index + 1), worldRoot: new THREE.Group(), timeSeconds: 0, frameSequence: -1, advances: 0,
      finalSkinMatrices: [new Float32Array(16)], finalSkinMatrixData: new Float32Array(16),
      async setMotion(mode) {this.mode = mode; log.push(['mode', this.id, mode]);},
      advance(dt, tick) {this.advances++; this.frameSequence = tick; this.timeSeconds += dt;},
      publishPose(tick) {this.frameSequence = tick;}, prepareRender() {}, report() {return {id: this.id, tick: this.frameSequence};},
      shoes: {update() {}}, hair: {update() {}, reset() {}, setPhysics(v) {log.push(['hair', v]);}, setWind(v) {log.push(['wind', v]);}},
    };
    actor.cloth = {frame: {frameSequence: -1}, async reset() {this.frame.frameSequence = -1;},
      update(frame) {const next = queues[index].shift(); return (next?.promise || Promise.resolve()).then(() => {
        this.frame = {frameSequence: frame.frameSequence}; return this.frame;
      });}, pause() {log.push(['pause-cloth', actor.id]);}, renderUpdate() {}, audit() {return {frame: this.frame};}};
    return actor;
  });
  Object.assign(api.state, {ready: true, busy: false, count: 2, selected: '1'});
  api.configure(viewer, stage, actors);
  return {api, actors, viewer, nodes, controls, countButtons, moveButtons, events, log,
    deferFrame() {const pair = [deferred(), deferred()]; pair.forEach((item, i) => queues[i].push(item)); return pair;}};
}

const checks = [];
async function check(name, fn) {await fn(); checks.push({name, passed: true});}

await check('new measurement drains an old tick and clears previous records before collecting its own samples', async () => {
  const {api, deferFrame, viewer, nodes} = environment();
  api.state.lastBenchmark = {status: 'completed', samples: ['old record']};
  const pair = deferFrame(), oldStep = api.step(); await microtasks();
  const starting = api.startBenchmark();
  assert.equal(api.benchmark.status, 'starting'); assert.equal(api.state.lastBenchmark, null);
  assert.equal(viewer.orbit.enabled, false); assert.equal(nodes.get('motion-select').disabled, true);
  pair[0].resolve(); await microtasks(); assert.equal(api.benchmark.status, 'starting');
  pair[1].resolve(); await oldStep; await starting;
  assert.equal(api.benchmark.status, 'running'); assert.equal(api.benchmark.samples.length, 0);
  assert.equal(api.state.samples.length, 0); assert.equal(api.benchmark.startedTick, 1);
  await api.step(); assert.equal(api.benchmark.samples.length, 1); assert.equal(api.benchmark.samples[0].tick, 2);
  await api.abortBenchmark('test-end');
});

await check('measurement locks configuration, movement, step and camera entries including direct control callbacks', async () => {
  const {api, nodes, actors, viewer, controls, countButtons, moveButtons, events, log} = environment();
  await api.startBenchmark(); const run = api.benchmark;
  assert.equal(nodes.get('play-button').disabled, false); assert.equal(nodes.get('reset-button').disabled, true);
  assert.equal(nodes.get('benchmark-button').disabled, true); assert.equal(viewer.orbit.enabled, false);
  assert.ok(controls.filter(node => node.id !== 'play-button').every(node => node.disabled));
  assert.equal(viewer.orbit.autoRotate, false);
  const camera = viewer.camera.position.toArray(), positions = actors.map(a => a.worldRoot.position.toArray());
  await countButtons[2].onclick(); await nodes.get('motion-select').onchange({target: {value: 'jump'}});
  nodes.get('speed-select').onchange({target: {value: '.25'}});
  nodes.get('hair-physics').onchange({target: {checked: false}}); nodes.get('wind').onchange({target: {checked: true}});
  nodes.get('actor-select').onchange({target: {value: '2'}});
  nodes.get('home-button').onclick(); nodes.get('focus-button').onclick();
  moveButtons.forEach(button => button.onclick());
  events.get('keydown')({key: 'w', target: null, preventDefault() {}});
  nodes.get('step-button').onclick(); await nodes.get('benchmark-button').onclick();
  assert.equal(api.benchmark, run); assert.equal(api.state.count, 2); assert.equal(api.state.mode, 'walk');
  assert.equal(api.state.speed, 1); assert.equal(api.state.hairPhysics, true); assert.equal(api.state.wind, false);
  assert.equal(api.state.selected, '1'); assert.equal(actors[0].advances, 0);
  assert.deepEqual(viewer.camera.position.toArray(), camera);
  assert.deepEqual(actors.map(a => a.worldRoot.position.toArray()), positions);
  assert.equal(log.filter(row => ['mode', 'hair', 'wind'].includes(row[0])).length, 0);
  await api.abortBenchmark('test-end');
});

await check('pause aborts a partial run only after all in-flight workers settle, with no late sample or false completion', async () => {
  const {api, nodes, viewer, deferFrame, actors} = environment();
  await api.startBenchmark(); for (let i = 0; i < 3; i++) await api.step();
  const pair = deferFrame(), pending = api.step(); await microtasks();
  const stopped = nodes.get('play-button').onclick();
  assert.equal(api.benchmark.status, 'aborting'); assert.equal(api.state.playing, false);
  assert.equal(viewer.orbit.enabled, false); assert.equal(nodes.get('motion-select').disabled, true);
  pair[0].resolve(); await microtasks(); assert.equal(api.benchmark.status, 'aborting');
  pair[1].resolve(); await pending; await stopped;
  assert.equal(api.benchmark, null); assert.equal(api.state.lastBenchmark.status, 'aborted');
  assert.equal(api.state.lastBenchmark.abortReason, 'paused-by-user'); assert.equal(api.state.lastBenchmark.completedSteps, 3);
  assert.equal(api.state.lastBenchmark.samples.length, 3); assert.equal(api.state.lastBenchmark.requestedSteps, 60);
  assert.doesNotMatch(api.state.phase, /60 步测量完成/); assert.equal(api.pendingTick, null);
  assert.equal(viewer.orbit.enabled, true); assert.equal(viewer.orbit.autoRotate, true);
  assert.equal(nodes.get('motion-select').disabled, false);
  assert.ok(actors.every(a => a.frameSequence === a.cloth.frame.frameSequence));
});

await check('a new completed run contains exactly 60 fresh accepted steps and restores all controls', async () => {
  const {api, nodes, viewer} = environment();
  await api.startBenchmark(); await api.step(); await api.abortBenchmark('paused-by-user');
  await api.startBenchmark(); assert.equal(api.state.lastBenchmark, null);
  const start = api.benchmark.startedTick;
  for (let i = 0; i < 60; i++) await api.step();
  const result = api.state.lastBenchmark;
  assert.equal(api.benchmark, null); assert.equal(result.status, 'completed');
  assert.equal(result.completedSteps, 60); assert.equal(result.samples.length, 60);
  assert.equal(result.metrics.sampleCount, 60); assert.equal(result.samples[0].tick, start + 1);
  assert.equal(result.samples.at(-1).tick, start + 60); assert.equal(result.configuration.mode, 'walk');
  assert.ok(result.samples.every(s => s.actors === 2 && s.speed === 1 && s.fullHair));
  assert.equal(api.state.playing, false); assert.equal(viewer.orbit.enabled, true);
  assert.equal(nodes.get('benchmark-button').disabled, false); assert.equal(nodes.get('reset-button').disabled, false);
  assert.equal(api.state.phase, '60 步测量完成，已暂停');
});

await check('explicit reset ends a live benchmark and drains its pending step before pose reset', async () => {
  const {api, nodes, deferFrame, actors, log} = environment();
  await api.startBenchmark(); await api.step();
  const pair = deferFrame(), pending = api.step(); await microtasks();
  const resetting = nodes.get('reset-button').onclick();
  assert.equal(api.benchmark.status, 'aborting'); assert.equal(log.filter(row => row[0] === 'mode').length, 0);
  pair.forEach(item => item.resolve()); await pending; await resetting;
  assert.equal(api.benchmark, null); assert.equal(api.state.lastBenchmark.status, 'aborted');
  assert.equal(api.state.lastBenchmark.abortReason, 'reset'); assert.equal(api.state.lastBenchmark.completedSteps, 1);
  assert.equal(api.state.busy, false); assert.equal(api.state.simulationSeconds, 0);
  assert.ok(actors.every(a => a.frameSequence === a.cloth.frame.frameSequence));
});

await check('native worker failure clears the active benchmark and preserves failure freeze/capture evidence', async () => {
  const {api, nodes, deferFrame} = environment();
  await api.startBenchmark(); await api.step();
  const pair = deferFrame(), error = Error('Injected native worker failure'); error.capture = {sentinel: 'root capture retained'};
  const pending = api.step().catch(api.fail); await microtasks();
  pair[0].reject(error); await microtasks(); assert.notEqual(api.benchmark, null);
  pair[1].resolve(); await pending;
  assert.equal(api.benchmark, null); assert.equal(api.state.lastBenchmark.status, 'aborted');
  assert.equal(api.state.lastBenchmark.abortReason, 'runtime-failure'); assert.equal(api.state.lastBenchmark.completedSteps, 1);
  assert.equal(api.state.renderFrozen, true); assert.equal(api.state.errors[0].capture.sentinel, 'root capture retained');
  assert.equal(api.state.errors[0].frameTransaction.allWorkerResponsesSettled, true);
  assert.equal(nodes.get('reset-button').disabled, false); assert.equal(nodes.get('play-button').disabled, true);
});

await check('viewport resize aborts measurement before changing its recorded camera or canvas dimensions', async () => {
  const {api, viewer} = environment();
  await api.startBenchmark(); await api.step(); api.resize(); await microtasks();
  assert.equal(api.benchmark, null); assert.equal(api.state.lastBenchmark.status, 'aborted');
  assert.equal(api.state.lastBenchmark.abortReason, 'viewport-resized');
  assert.equal(api.state.lastBenchmark.configuration.viewport[0], 1280);
  assert.equal(viewer.canvas.width, 900); assert.equal(viewer.canvas.height, 650);
});

const evidence = {schema: 'unified-benchmark-control-flow-verification/1', atUTC: new Date().toISOString(),
  mainSHA256: createHash('sha256').update(source).digest('hex'), tests: checks,
  scope: 'actual main.mjs handlers and measurement lifecycle with deferred worker/DOM/renderer interfaces; no native solver timings, browser rendering or FPS claim',
  browserCheckRemaining: 'click Pause during a real measurement, confirm aborted record and restored input, then complete a new 60-step run'};
await writeFile(new URL('./benchmark-verification.json', import.meta.url), JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify({passed: checks.length, total: checks.length, scope: evidence.scope}));
