'use strict';
/* R04, phase 1: inspect the immutable R02 native person. This is a diagnostic
 * harness, not a production patch and not an aesthetic acceptance test.
 * Temporary hooks are local to existing objects and restored in finally.
 * No prototype, source text, canonical triangle, shader or DNA is rewritten.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { PNG } = require('pngjs');

const SOURCE = '01cfde47476b7be6764e9c6a79d925462511539b';
const BUILD = 'ba0c4eb337e03997878aecaf477d8ec3fe8b7231';
const PREVIEW_SHA256 = 'ccc7af8e97969667bf63ab8bbc61e845d95e7b5e7f70adb167a662a63c0cb571';
const RAW = 'https://raw.githubusercontent.com/haihao0307/guilin-dem-pipeline/' + BUILD + '/kaopu-unified-human-workbench/lip-realism-r02/preview.html';
const URL = 'https://htmlpreview.github.io/?' + RAW;
if (process.env.MODE) assert.equal(process.env.MODE, 'diagnose', 'This script only diagnoses the fixed baseline');
if (process.env.BASELINE_SOURCE_SHA) assert.equal(process.env.BASELINE_SOURCE_SHA, SOURCE);
if (process.env.PUBLIC_URL) assert.equal(process.env.PUBLIC_URL, URL);
if (process.env.SOURCE_SHA && process.env.GITHUB_SHA) assert.equal(process.env.SOURCE_SHA, process.env.GITHUB_SHA, 'Diagnostic commit differs from runner checkout');
const width = 640, height = 512;
const out = path.resolve(process.env.QA_OUT || path.join(__dirname, 'evidence'));
const budgetMS = Number(process.env.QA_BUDGET_MS || 600000);
assert(Number.isFinite(budgetMS) && budgetMS >= 120000 && budgetMS <= 900000, 'Invalid bounded deadline');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
fs.mkdirSync(out, { recursive: true });
const q = {
  schema: 'kaopu/lip-inner-diagnosis@1', phase: 'R04 diagnostic only', mode: 'diagnose',
  sourceSHA: SOURCE, buildSHA: BUILD, previewSHA256: PREVIEW_SHA256,
  publicURL: URL, diagnosticCommit: process.env.SOURCE_SHA || process.env.GITHUB_SHA || null,
  verifierSHA256: sha(fs.readFileSync(__filename)), startedAt: new Date().toISOString(),
  budgetMS, framebuffer: { width, height, pixelRatio: 1 },
  browserViewport: { width: 1280, height: 900 },
  tests: [], frames: [], stages: [], pageErrors: [], consoleErrors: [], failedRequests: [], resourceErrors: [],
  generatedImageUsed: false, staticImageSubstitute: false, productionSourceModified: false,
  visualAcceptance: false, productionReady: false, completed: false,
  interventions: [
    'Pause native idle and lip playback; one normal native-person initialization only.',
    'Suppress only the viewer object render method during synchronous pose/update/view setup; restore its original own descriptor in finally before every measured frame.',
    'Local, descriptor-restored hooks observe the existing lip subdivision update and native solver. Their algorithms and input parameters are not replaced.',
    'All numerical groups and neighbor edges are selected from the original native rest topology, before observing pose results.',
    'A material-attribution experiment reassigns only fully oral skin triangles in the current cached draw geometry to the retained native material; indices and groups are restored exactly.',
    'Numerical transitions establish where measured displacement occurs; no magnitude threshold is called an anatomical or visual pass.'
  ],
  limitations: [
    'One frozen person, one Chromium SwiftShader runner, fixed native R02 lighting.',
    'Six diagnostic images do not constitute a new public workbench or user acceptance.',
    'Projected sample vertices are not a proof of the material owning an arbitrary screenshot pixel.',
    'Dental/gum/tongue statistics are separate from oral-return skin; their average is never used to describe inner lips.',
    'The material ablation changes an existing material path, not just its colour. It is an attribution experiment, not a recommended production correction.',
    'The numerical direct native-update route and actual frame route are recorded separately; extra GPU submissions are suppressed but every measured frame is rendered normally.'
  ]
};
let browser, context, page, fatalTimer, sequence = 0, restored = false;
const active = [];
function writeJSON(name, value) {
  const target = path.join(out, name), temporary = target + '.tmp';
  fs.writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n'); fs.renameSync(temporary, target);
}
function checkpoint() { q.updatedAt = new Date().toISOString(); q.activeStages = active.map(x => ({ ...x })); writeJSON('qa.partial.json', q); }
function progress(name, event, detail = {}) {
  const entry = { sequence: ++sequence, at: new Date().toISOString(), name, event, ...detail };
  q.lastProgress = entry; fs.appendFileSync(path.join(out, 'progress.jsonl'), JSON.stringify(entry) + '\n'); checkpoint();
  console.log(event.toUpperCase() + ' ' + name);
}
async function bounded(name, operation, milliseconds = 90000) {
  let timer;
  try { return await Promise.race([Promise.resolve().then(operation), new Promise((_, reject) => { timer = setTimeout(() => reject(Error(name + ' exceeded ' + milliseconds + ' ms; pending work is not a pass')), milliseconds); })]); }
  finally { clearTimeout(timer); }
}
async function stage(name, operation) {
  const item = { name, startedAt: new Date().toISOString() }, start = Date.now(); active.push(item); progress(name, 'start');
  try { const result = await operation(); progress(name, 'end', { elapsedMS: Date.now() - start }); return result; }
  catch (error) { progress(name, 'failure', { elapsedMS: Date.now() - start, error: String(error) }); throw error; }
  finally { active.splice(active.indexOf(item), 1); checkpoint(); }
}
async function test(name, operation) {
  return stage(name, async () => {
    const started = Date.now();
    try { const result = await operation(); q.tests.push({ name, passed: true, elapsedMS: Date.now() - started, result }); checkpoint(); return result; }
    catch (error) { q.tests.push({ name, passed: false, elapsedMS: Date.now() - started, error: String(error) }); checkpoint(); throw error; }
  });
}
function terminated(reason, code) {
  q.completed = false; q.failure = reason; q.finishedAt = new Date().toISOString();
  progress('process', 'terminated', { reason }); writeJSON('qa.json', q); process.exit(code);
}
for (const [signal, code] of [['SIGTERM', 143], ['SIGINT', 130]]) process.once(signal, () => terminated('Interrupted by ' + signal, code));

async function load() {
  const response = await context.request.get(RAW, { timeout: 60000 });
  const bytes = await response.body();
  q.rawPublicCheck = { url: RAW, httpStatus: response.status(), bytes: bytes.length, sha256: sha(bytes) }; checkpoint();
  assert.equal(response.status(), 200); assert.equal(sha(bytes), PREVIEW_SHA256, 'Immutable R02 public bytes differ');
  page = await context.newPage(); page.setDefaultTimeout(30000);
  const evaluate = page.evaluate.bind(page);
  page.evaluate = (...args) => bounded('browser evaluate', () => evaluate(...args), 120000);
  page.on('pageerror', error => { q.pageErrors.push(String(error)); checkpoint(); });
  page.on('console', message => { if (message.type() === 'error' && !/favicon/i.test(message.text())) { q.consoleErrors.push(message.text()); checkpoint(); } });
  page.on('requestfailed', request => { if (!/favicon/i.test(request.url())) { q.failedRequests.push({ url: request.url(), error: request.failure()?.errorText }); checkpoint(); } });
  page.on('response', value => { if (value.status() >= 400 && !/favicon/i.test(value.url())) { q.resourceErrors.push({ url: value.url(), status: value.status() }); checkpoint(); } });
  const started = Date.now(), documentResponse = await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
  assert.equal(documentResponse.status(), 200);
  await page.waitForFunction(() => window.__HEAD_PROC__?.ready || window.__HEAD_PROC__?.errors?.length, null, { timeout: 300000 });
  assert.equal(await page.evaluate(() => window.__HEAD_PROC__?.errors?.length || 0), 0);
  await page.waitForFunction(() => (window.__R05_PRESET_READY__ === true && window.lipRealism?.ready === true) || window.__LIP_REALISM__?.errors?.length, null, { timeout: 180000 });
  q.startup = await page.evaluate(() => {
    const viewer = __IDENTITY_QA__.viewer();
    window.lifelikeIdle?.pause?.(); window.lipWorkbench?.stop?.();
    viewer.orbit.autoRotate = false; viewer.orbit.enableDamping = false;
    return { title: document.title, domVersion: document.documentElement.dataset.lipRealism,
      domSource: document.documentElement.dataset.lipSource, appSource: __LIP_REALISM__.source,
      version: lipRealism.version, ready: lipRealism.ready, finalFrame: viewer.startupFinalFrame,
      headReady: __HEAD_PROC__.ready, headErrors: __HEAD_PROC__.errors,
      lipErrors: __LIP_REALISM__.errors, nativeLipErrors: window.__LIP_P3__?.errors || [],
      pose: lipWorkbench.pose(), lipReport: lipRealism.report() };
  });
  q.startup.elapsedMS = Date.now() - started; checkpoint();
  assert.equal(q.startup.domSource, SOURCE); assert.equal(q.startup.appSource.sourceCommit, SOURCE);
  assert.equal(q.startup.version, 'LIP-REALISM-R02'); assert.equal(q.startup.domVersion, 'LIP-REALISM-R02');
  assert(q.startup.ready && q.startup.finalFrame && q.startup.headReady, 'Native startup incomplete');
  for (const k of ['headErrors', 'lipErrors', 'nativeLipErrors']) assert.equal(q.startup[k]?.length || 0, 0, k);
  for (const [key, value] of Object.entries(q.startup.pose)) if (key !== 'schema') assert.equal(value, 0, 'Frozen reference must start in its recorded neutral pose: ' + key);
  await stage('drain native startup GPU queue', () => page.evaluate(() => {
    const gl = __IDENTITY_QA__.viewer().renderer.getContext(); gl.finish();
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
    if (gl.getError() !== 0 || gl.isContextLost()) throw Error('Native startup GPU queue failed');
  }));
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.evaluate(({ width, height }) => {
    const v = __IDENTITY_QA__.viewer(), previous = Object.getOwnPropertyDescriptor(v, 'render');
    try {
      Object.defineProperty(v, 'render', { configurable: true, writable: true, value() {} });
      v.renderer.setPixelRatio(1); v.renderer.setSize(width, height, false);
      v.camera.aspect = width / height; v.camera.updateProjectionMatrix(); lipRealism.view('macro');
    } finally { if (previous) Object.defineProperty(v, 'render', previous); else delete v.render; }
  }, { width, height });
}

/* Runs in the page. Methods remain private to this diagnostic object. */
function installHarness() {
  if (window.__LIP_R04_DIAG__) throw Error('Diagnostic already installed');
  const v = __IDENTITY_QA__.viewer(), model = __IDENTITY_QA__.model(), controller = __IDENTITY_QA__.controller();
  const ls = model.lipStructure, lip = v.currentLip, solver = ls.mother.surfaces.get(lip?.geometry), top = solver?.topology;
  if (!lip || !solver || !top || top.geometry !== lip.geometry) throw Error('Original native lip solver/topology unavailable');
  const clone = value => structuredClone(value);
  const digest = async array => array ? Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(array.buffer, array.byteOffset, array.byteLength))), x => x.toString(16).padStart(2, '0')).join('') : null;
  const own = (object, key) => Object.getOwnPropertyDescriptor(object, key);
  const restore = (object, key, descriptor) => { if (descriptor) Object.defineProperty(object, key, descriptor); else if (!Reflect.deleteProperty(object, key)) throw Error('Could not restore inherited member ' + String(key)); };
  const replace = (object, key, value) => { const descriptor = own(object, key); Object.defineProperty(object, key, { configurable: true, writable: true, enumerable: descriptor?.enumerable || false, value }); return descriptor; };
  const sameDescriptor = (a, b) => a === undefined ? b === undefined : b !== undefined && ['value', 'get', 'set', 'writable', 'enumerable', 'configurable'].every(k => a[k] === b[k]);
  const refs = { render: v.render, rendererRender: v.renderer.render, viewerUpdate: v.update, lipUpdate: lip.update, solverApply: solver.apply, motherUpdate: ls.mother.update };
  const descriptors = { render: own(v, 'render'), rendererRender: own(v.renderer, 'render'), viewerUpdate: own(v, 'update'), lipUpdate: own(lip, 'update'), solverApply: own(solver, 'apply'), motherUpdate: own(ls.mother, 'update') };
  const saveCamera = () => ({ position: v.camera.position.toArray(), quaternion: v.camera.quaternion.toArray(), target: v.orbit.target.toArray(), aspect: v.camera.aspect, fov: v.camera.fov, zoom: v.camera.zoom, near: v.camera.near, far: v.camera.far });
  const saved = {
    state: clone(model.state), performance: clone(ls.performance.settings), ownerBeforeJaw: ls.performance.ownerBeforeJaw,
    dna: clone(ls.anatomy.settings), lipSettings: clone(ls.settings), realism: lipRealism.settings(),
    referenceObject: solver.reference, reference: solver.reference?.slice() || null,
    horizontalObject: solver.referenceHorizontal, horizontal: solver.referenceHorizontal?.slice() || null,
    lastKey: solver.lastKey, camera: saveCamera()
  };
  if (!saved.reference || !saved.horizontal) throw Error('Frozen R02 native neutral calibration is missing');
  const ids = [...new Set([...top.active, ...top.oralSurface])].sort((a, b) => a - b);
  const domain = new Set(ids), idToOffset = new Map(ids.map((id, offset) => [id, offset]));
  const edges = [];
  for (const i of ids) for (const j of top.neighbors[i]) if (j > i && domain.has(j)) edges.push([i, j]);
  const groups = {
    activeAndOral: ids,
    lipRed: ids.filter(id => top.samples[id].red > .025),
    oralReturnSkin: ids.filter(id => top.samples[id].type < .5 && top.samples[id].inner > .25),
    cornerSkin: ids.filter(id => top.samples[id].type < .5 && top.samples[id].skin && Math.abs(top.samples[id].u) > .75),
    nativeRim: ids.filter(id => top.samples[id].rim),
    teethGumsTongue: ids.filter(id => top.samples[id].type > .5 && top.samples[id].type < 3.5)
  };
  for (const key of ['lipRed', 'oralReturnSkin', 'cornerSkin', 'nativeRim', 'teethGumsTongue']) if (!groups[key].length) throw Error('Expected native diagnostic group absent: ' + key);
  const groupEdges = Object.fromEntries(Object.entries(groups).map(([name, group]) => { const set = new Set(group); return [name, edges.filter(([a, b]) => set.has(a) && set.has(b))]; }));
  const initialSemantics = Object.fromEntries(['fRest', 'csType', 'l19Oral'].map(name => {
    const a = top.geometry.attributes[name]; if (!a) throw Error('Missing native semantic ' + name);
    const buffer = new Float32Array(ids.length * a.itemSize);
    for (let j = 0; j < ids.length; j++) for (let k = 0; k < a.itemSize; k++) buffer[j * a.itemSize + k] = a.array[ids[j] * a.itemSize + k];
    return [name, { itemSize: a.itemSize, buffer }];
  }));
  const interventions = [], traces = [];
  let activeAblation = null, restoreCompleted = false;
  function withoutRender(label, fn) {
    const before = v.render, descriptor = own(v, 'render'), frameBefore = v.renderer.info.render.frame;
    let suppressed = 0;
    try { replace(v, 'render', function () { suppressed++; }); return fn(); }
    finally {
      restore(v, 'render', descriptor);
      const record = { label, suppressedCalls: suppressed, frameBefore, frameAfter: v.renderer.info.render.frame, functionRestored: v.render === before, descriptorRestored: sameDescriptor(own(v, 'render'), descriptor) };
      interventions.push(record);
      if (!record.functionRestored || !record.descriptorRestored || record.frameAfter !== record.frameBefore) throw Error('Render suppression leaked or another GPU render was submitted');
    }
  }
  function checkSemantics(geometry) {
    if (geometry.attributes.position.count < top.count) throw Error('Final geometry discarded original lip vertex IDs');
    for (const [name, value] of Object.entries(initialSemantics)) {
      const a = geometry.attributes[name]; if (!a || a.itemSize !== value.itemSize) throw Error('Lost original semantic attribute ' + name);
      for (let j = 0; j < ids.length; j++) for (let k = 0; k < a.itemSize; k++) if (a.array[ids[j] * a.itemSize + k] !== value.buffer[j * a.itemSize + k]) throw Error('Same-ID native semantic changed: ' + name + '[' + ids[j] + ']');
    }
  }
  function snapshot(name, geometry, trace) {
    checkSemantics(geometry);
    const array = geometry.attributes.position.array, sample = new Float32Array(ids.length * 3);
    for (let j = 0; j < ids.length; j++) for (let k = 0; k < 3; k++) sample[j * 3 + k] = array[ids[j] * 3 + k];
    if (!sample.every(Number.isFinite)) throw Error('Non-finite measured stage ' + name);
    trace.snapshots.push({ name, count: geometry.attributes.position.count, array: sample });
  }
  function describeVertex(id) {
    const s = top.samples[id];
    return { id, u: s.u, v: s.v, upper: s.upper, depth: s.depth, type: s.type, inner: s.inner, skin: s.skin, weight: s.weight, red: s.red, rim: s.rim, front: s.front, roi: s.roi };
  }
  const statistics = values => {
    if (!values.length) return { count: 0, nonzero: 0, min: null, median: null, p95: null, max: null, mean: null };
    const sorted = [...values].sort((a, b) => a - b);
    return { count: values.length, nonzero: values.filter(x => x > 0).length, min: sorted[0], median: sorted[Math.floor((sorted.length - 1) * .5)], p95: sorted[Math.floor((sorted.length - 1) * .95)], max: sorted.at(-1), mean: values.reduce((a, b) => a + b, 0) / values.length };
  };
  function transition(before, after) {
    const delta = new Float64Array(ids.length * 3), length = new Float64Array(ids.length);
    for (let k = 0; k < delta.length; k++) delta[k] = after.array[k] - before.array[k];
    for (let j = 0; j < ids.length; j++) length[j] = Math.hypot(delta[j * 3], delta[j * 3 + 1], delta[j * 3 + 2]) * 1000;
    const result = {};
    for (const [name, group] of Object.entries(groups)) {
      const changed = group.map(id => ({ id, mm: length[idToOffset.get(id)] }));
      const edgeChanges = [], edgeGradients = []; let zeroLengthEdges = 0;
      for (const [a, b] of groupEdges[name]) {
        const x = idToOffset.get(a) * 3, y = idToOffset.get(b) * 3;
        const beforeLength = Math.hypot(before.array[x] - before.array[y], before.array[x + 1] - before.array[y + 1], before.array[x + 2] - before.array[y + 2]);
        const gradient = Math.hypot(delta[x] - delta[y], delta[x + 1] - delta[y + 1], delta[x + 2] - delta[y + 2]);
        edgeChanges.push(gradient * 1000);
        if (beforeLength > 0) edgeGradients.push(gradient / beforeLength); else zeroLengthEdges++;
      }
      result[name] = { displacementMM: statistics(changed.map(x => x.mm)), edgeDeltaDifferenceMM: statistics(edgeChanges), edgeDeltaPerPreviousEdgeLength: statistics(edgeGradients), zeroLengthEdges,
        largest: changed.sort((a, b) => b.mm - a.mm || a.id - b.id).slice(0, 20).map(x => {
          const k = idToOffset.get(x.id) * 3;
          return { ...describeVertex(x.id), displacementMM: x.mm, before: Array.from(before.array.slice(k, k + 3)), after: Array.from(after.array.slice(k, k + 3)), deltaMM: Array.from(delta.slice(k, k + 3), v => v * 1000) };
        }) };
    }
    return { from: before.name, to: after.name, groups: result };
  }
  function setNativePose(name, fullUI) {
    const neutral = { ...saved.performance, jawOpen: 0 };
    for (const key of Object.keys(neutral)) if (key !== 'schema') neutral[key] = 0;
    const desired = name === 'neutral' ? neutral : name === 'jaw' ? { ...neutral, jawOpen: .36 }
      : name === 'speak' ? { ...neutral, jawOpen: .36, upperRaise: .2, lowerDepress: .12 }
      : name === 'pucker' ? { ...neutral, jawOpen: .06, pucker: .82, seal: .24 } : null;
    if (!desired) throw Error('Unknown diagnostic pose');
    if (fullUI) lipWorkbench.setPose(desired);
    else { ls.performance.set(desired); ls.update(); v.update(); }
    const actual = lipWorkbench.pose();
    if (JSON.stringify(actual) !== JSON.stringify(desired)) {
      for (const key of Object.keys(desired)) if (actual[key] !== desired[key]) throw Error('Native pose differs at ' + key);
    }
    return actual;
  }
  async function numerical(name) {
    const trace = { poseName: name, route: 'native performance.set → lipStructure.update → original viewer.update; no controller UI refresh', snapshots: [], counts: { lipUpdate: 0, lipNormals: 0, solverApply: 0, pairsMap: 0, lipsIterator: 0, solverNormals: 0 }, hooksRestored: false };
    traces.push(trace);
    const priorLip = lip.update, priorSolver = solver.apply;
    const lipDescriptor = own(lip, 'update'), solverDescriptor = own(solver, 'apply');
    try {
      replace(lip, 'update', function (...args) {
        trace.counts.lipUpdate++;
        const g = this.layers.at(-1).geometry, old = g.computeVertexNormals, descriptor = own(g, 'computeVertexNormals');
        try {
          replace(g, 'computeVertexNormals', function (...normalArgs) {
            const result = Reflect.apply(old, this, normalArgs); trace.counts.lipNormals++;
            if (trace.counts.lipNormals === 1) snapshot('after_subdivision', g, trace);
            else if (trace.counts.lipNormals === 2) snapshot('after_native_lip_shape', g, trace);
            return result;
          });
          return Reflect.apply(priorLip, this, args);
        } finally {
          restore(g, 'computeVertexNormals', descriptor);
          if (g.computeVertexNormals !== old || !sameDescriptor(own(g, 'computeVertexNormals'), descriptor)) throw Error('Native lip normals hook was not restored');
        }
      });
      replace(solver, 'apply', function (...args) {
        trace.counts.solverApply++; snapshot('before_local', top.geometry, trace);
        trace.executedMicroGeometry = args[1].anatomy.settings.microGeometry;
        trace.authoredMicroGeometry = saved.dna.microGeometry;
        const pairsMap = top.pairs.map, lipsIterator = top.lips[Symbol.iterator], normals = top.geometry.computeVertexNormals;
        const mapD = own(top.pairs, 'map'), iteratorD = own(top.lips, Symbol.iterator), normalD = own(top.geometry, 'computeVertexNormals');
        try {
          replace(top.pairs, 'map', function (...mapArgs) { trace.counts.pairsMap++; snapshot('after_local', top.geometry, trace); return Reflect.apply(pairsMap, this, mapArgs); });
          replace(top.lips, Symbol.iterator, function (...iteratorArgs) { trace.counts.lipsIterator++; snapshot('after_closure', top.geometry, trace); return Reflect.apply(lipsIterator, this, iteratorArgs); });
          replace(top.geometry, 'computeVertexNormals', function (...normalArgs) {
            const result = Reflect.apply(normals, this, normalArgs); trace.counts.solverNormals++;
            if (trace.counts.solverNormals === 1) snapshot('after_envelope', top.geometry, trace);
            else if (trace.counts.solverNormals === 2) snapshot('after_micro', top.geometry, trace);
            return result;
          });
          return Reflect.apply(priorSolver, this, args);
        } finally {
          restore(top.pairs, 'map', mapD); restore(top.lips, Symbol.iterator, iteratorD); restore(top.geometry, 'computeVertexNormals', normalD);
          if (top.pairs.map !== pairsMap || top.lips[Symbol.iterator] !== lipsIterator || top.geometry.computeVertexNormals !== normals
            || !sameDescriptor(own(top.pairs, 'map'), mapD) || !sameDescriptor(own(top.lips, Symbol.iterator), iteratorD) || !sameDescriptor(own(top.geometry, 'computeVertexNormals'), normalD)) throw Error('Native solver hook was not restored');
        }
      });
      trace.actualPose = withoutRender('numerical ' + name, () => setNativePose(name, false));
      snapshot('final', v.geometry, trace);
      trace.biomechanics = clone(ls.biomechanicsReport);
    } finally {
      restore(lip, 'update', lipDescriptor); restore(solver, 'apply', solverDescriptor);
      trace.hooksRestored = lip.update === priorLip && solver.apply === priorSolver && sameDescriptor(own(lip, 'update'), lipDescriptor) && sameDescriptor(own(solver, 'apply'), solverDescriptor);
      if (!trace.hooksRestored) throw Error('Outer native diagnostic hooks were not restored');
    }
    const expected = { lipUpdate: 1, lipNormals: 2, solverApply: 1, pairsMap: 1, lipsIterator: 1, solverNormals: 2 };
    for (const [key, value] of Object.entries(expected)) if (trace.counts[key] !== value) throw Error('Unrecognized original stage call count ' + key + ': ' + trace.counts[key]);
    const order = ['after_subdivision', 'after_native_lip_shape', 'before_local', 'after_local', 'after_closure', 'after_envelope', 'after_micro', 'final'];
    if (trace.snapshots.map(x => x.name).join('|') !== order.join('|')) throw Error('Unrecognized native stage order');
    const summaries = [];
    for (const s of trace.snapshots) summaries.push({ name: s.name, actualGeometryVertexCount: s.count, sampledVertices: ids.length, positionsSHA256: await digest(s.array) });
    const transitions = [];
    for (let i = 1; i < trace.snapshots.length; i++) transitions.push(transition(trace.snapshots[i - 1], trace.snapshots[i]));
    const pairedRim = top.pairs.map(pair => ({ ...pair, stages: trace.snapshots.map(s => {
      const upper = idToOffset.get(pair.upper), lower = idToOffset.get(pair.lower);
      if (upper === undefined || lower === undefined) throw Error('Native rim pair outside fixed domain');
      const a = Array.from(s.array.slice(upper * 3, upper * 3 + 3)), b = Array.from(s.array.slice(lower * 3, lower * 3 + 3));
      return { stage: s.name, upper: a, lower: b, worldDistanceMM: Math.hypot(...a.map((x, k) => x - b[k])) * 1000 };
    }) }));
    return { poseName: name, route: trace.route, actualPose: trace.actualPose, counts: trace.counts, hooksRestored: trace.hooksRestored,
      authoredMicroGeometry: trace.authoredMicroGeometry, executedMicroGeometry: trace.executedMicroGeometry,
      stageOrder: order, stageSummaries: summaries, transitions, pairedRim, biomechanics: trace.biomechanics,
      calibration: { referenceSHA256: await digest(solver.reference), referenceHorizontalSHA256: await digest(solver.referenceHorizontal), lastKey: solver.lastKey,
        unchanged: await digest(solver.reference) === await digest(saved.reference) && await digest(solver.referenceHorizontal) === await digest(saved.horizontal) && solver.lastKey === saved.lastKey } };
  }
  function camera(kind) {
    if (!['macro', 'oblique'].includes(kind)) throw Error('Unsupported camera');
    return withoutRender('frame camera ' + kind, () => {
      const c = saved.camera; v.camera.position.fromArray(c.position); v.camera.quaternion.fromArray(c.quaternion); v.orbit.target.fromArray(c.target);
      v.camera.aspect = c.aspect; v.camera.fov = c.fov; v.camera.zoom = c.zoom;
      if (kind === 'oblique') {
        const t = v.orbit.target, d = v.camera.position.distanceTo(t), angle = .32;
        v.camera.position.set(t.x + Math.sin(angle) * d, t.y, t.z + Math.cos(angle) * d);
      }
      v.camera.updateProjectionMatrix(); v.orbit.update(); return saveCamera();
    });
  }
  function poseForFrame(name) {
    if (activeAblation) throw Error('Pose update would invalidate the active material-attribution geometry');
    return withoutRender('actual UI pose ' + name, () => setNativePose(name, true));
  }
  async function state() {
    const g = v.geometry, attributes = {};
    for (const name of ['position', 'normal', 'fRest', 'csType', 'l19Oral', 'l19State', 'l19Detail']) attributes[name] = await digest(g.attributes[name]?.array);
    const lights = []; v.scene.updateMatrixWorld(true);
    v.scene.traverse(object => {
      if (!object.isLight) return;
      const item = { type: object.type, name: object.name, color: object.color.toArray(), intensity: object.intensity, matrix: object.matrixWorld.toArray(), visible: object.visible };
      if (object.groundColor) item.ground = object.groundColor.toArray();
      if (object.target) item.target = object.target.matrixWorld.toArray(); lights.push(item);
    });
    return { modelState: clone(model.state), canonicalPositions: await digest(model.positions), canonicalFaces: await digest(model.faces),
      geometry: { attributes, index: await digest(g.index.array), vertices: g.attributes.position.count },
      pose: lipWorkbench.pose(), ownerBeforeJaw: ls.performance.ownerBeforeJaw, dna: clone(ls.anatomy.settings), nativeLip: clone(ls.settings),
      realism: lipRealism.settings(), head: headProceduralSkin.settings(), body: bodyProceduralSkin.settings(),
      calibration: { reference: await digest(solver.reference), horizontal: await digest(solver.referenceHorizontal), lastKey: solver.lastKey },
      camera: saveCamera(), lights, exposure: v.renderer.toneMappingExposure,
      functionsOriginal: v.render === refs.render && v.renderer.render === refs.rendererRender && v.update === refs.viewerUpdate && lip.update === refs.lipUpdate && solver.apply === refs.solverApply && ls.mother.update === refs.motherUpdate };
  }
  async function beginNativeMaterialAblation() {
    if (activeAblation) throw Error('Ablation already active');
    const g = v.mesh.geometry, mats = Array.isArray(v.mesh.material) ? v.mesh.material : [v.mesh.material];
    const nativeSlot = mats.indexOf(v.skin.material), skinSlot = mats.indexOf(headProceduralSkin.material());
    if (nativeSlot < 0 || skinSlot < 0 || nativeSlot === skinSlot) throw Error('Actual native and procedural material slots are not distinct');
    const oldIndex = g.index, oldGroups = g.groups.map(group => ({ ...group })), a = g.attributes;
    const beforeAttributes = {};
    for (const [name, attribute] of Object.entries(a)) beforeAttributes[name] = await digest(attribute.array);
    const buckets = new Map(mats.map((_, id) => [id, []]));
    let movedTriangles = 0, mixedOralPreserved = 0;
    const examples = [];
    for (const group of oldGroups) {
      if (group.start % 3 || group.count % 3 || group.start + group.count > oldIndex.count) throw Error('Unknown indexed material group layout');
      for (let off = group.start; off < group.start + group.count; off += 3) {
        const tri = [oldIndex.array[off], oldIndex.array[off + 1], oldIndex.array[off + 2]];
        const onlyInner = group.materialIndex === skinSlot && tri.every(id => a.csType.getX(id) < .5 && a.l19State.getX(id) >= .999);
        const anyInner = tri.some(id => a.csType.getX(id) < .5 && a.l19State.getX(id) > .001);
        const target = onlyInner ? nativeSlot : group.materialIndex;
        if (!buckets.has(target)) throw Error('Unknown actual material slot');
        buckets.get(target).push(...tri);
        if (onlyInner) { movedTriangles++; if (examples.length < 12) examples.push({ oldRenderedTriangle: off / 3, ids: tri, oral: tri.map(id => a.l19State.getX(id)) }); }
        else if (group.materialIndex === skinSlot && anyInner) mixedOralPreserved++;
      }
    }
    if (!movedTriangles) throw Error('No fully oral native skin triangles exist in the procedural skin material slot');
    const reordered = new oldIndex.array.constructor(oldIndex.array.length), groups = [];
    let start = 0;
    for (const [materialIndex, indices] of buckets) {
      if (!indices.length) continue; reordered.set(indices, start); groups.push({ start, count: indices.length, materialIndex }); start += indices.length;
    }
    if (start !== oldIndex.count) throw Error('Ablation changed the indexed triangle count');
    const triangleMultiset = array => {
      const keys = [];
      for (let i = 0; i < array.length; i += 3) keys.push(array[i] + ',' + array[i + 1] + ',' + array[i + 2]);
      keys.sort(); return keys.join(';');
    };
    if (triangleMultiset(oldIndex.array) !== triangleMultiset(reordered)) throw Error('Ablation changed an oriented native triangle');
    const record = { geometryUUID: g.uuid, nativeSlot, skinSlot, threshold: 'all three csType<0.5 AND l19State.x>=0.999',
      movedTriangles, mixedOralPreserved, totalTriangles: oldIndex.count / 3, examples, originalGroups: oldGroups,
      mixedOralPreservedDefinition: 'Procedural-skin triangles with any skin oral>0.001 that did not meet the all-three oral>=0.999 rule; includes mixed and fully fractional triangles.',
      originalIndexSHA256: await digest(oldIndex.array), ablatedIndexSHA256: await digest(reordered), orientedTriangleMultisetUnchanged: true,
      attributesBefore: beforeAttributes, intervention: 'existing native material ownership only, full original index object and groups retained for restoration' };
    activeAblation = { g, oldIndex, oldGroups, record };
    try {
      g.setIndex(new oldIndex.constructor(reordered, 1, oldIndex.normalized)); g.clearGroups(); for (const group of groups) g.addGroup(group.start, group.count, group.materialIndex);
      record.ablatedGroups = g.groups.map(group => ({ ...group }));
      for (const [name, attribute] of Object.entries(a)) if (await digest(attribute.array) !== beforeAttributes[name]) throw Error('Ablation modified native attribute ' + name);
      return record;
    } catch (error) { await endNativeMaterialAblation(); throw error; }
  }
  async function endNativeMaterialAblation() {
    if (!activeAblation) return { active: false, restored: true };
    const { g, oldIndex, oldGroups, record } = activeAblation;
    g.setIndex(oldIndex); g.clearGroups(); for (const group of oldGroups) g.addGroup(group.start, group.count, group.materialIndex);
    const result = { geometryUUID: g.uuid, indexObjectRestored: g.index === oldIndex, indexSHA256: await digest(g.index.array), groupsRestored: JSON.stringify(g.groups) === JSON.stringify(oldGroups), attributesRestored: true };
    for (const [name, attribute] of Object.entries(g.attributes)) if (await digest(attribute.array) !== record.attributesBefore[name]) result.attributesRestored = false;
    activeAblation = null;
    if (!result.indexObjectRestored || result.indexSHA256 !== record.originalIndexSHA256 || !result.groupsRestored || !result.attributesRestored) throw Error('Material experiment failed exact restoration');
    return result;
  }
  async function restoreScene() {
    const material = await endNativeMaterialAblation();
    withoutRender('restore original native state', () => {
      ls.performance.settings = clone(saved.performance); ls.performance.ownerBeforeJaw = saved.ownerBeforeJaw;
      saved.referenceObject.set(saved.reference); saved.horizontalObject.set(saved.horizontal);
      solver.reference = saved.referenceObject; solver.referenceHorizontal = saved.horizontalObject; solver.lastKey = saved.lastKey;
      model.compute(clone(saved.state)); ls.update(); controller.changed();
      const c = saved.camera; v.camera.position.fromArray(c.position); v.camera.quaternion.fromArray(c.quaternion); v.orbit.target.fromArray(c.target);
      for (const key of ['aspect', 'fov', 'zoom', 'near', 'far']) v.camera[key] = c[key];
      v.camera.updateProjectionMatrix(); v.orbit.update();
    });
    restoreCompleted = true;
    return { material, state: await state(), interventions: clone(interventions), restored: true };
  }
  const api = { numerical, camera, poseForFrame, state, beginNativeMaterialAblation, endNativeMaterialAblation, restoreScene,
    ablationGeometryIsCurrent: () => !activeAblation || activeAblation.g === v.mesh.geometry,
    report: () => ({ interventions: clone(interventions), restoreCompleted, activeAblation: !!activeAblation,
      traces: traces.map(t => ({ poseName: t.poseName, counts: t.counts, hooksRestored: t.hooksRestored, capturedStages: t.snapshots.map(s => s.name) })) }),
    domainReport: async () => ({ source: 'unchanged native solver.topology, fixed before measured perturbations',
      nativeTopologyCount: top.count, selectedVertices: ids.length, selectedVertexIDsSHA256: await digest(new Uint32Array(ids)),
      neighborEdges: edges.length, neighborEdgesSHA256: await digest(new Uint32Array(edges.flat())),
      pairedSections: top.pairs.length, uniqueUpperRimVertices: new Set(top.pairs.map(pair => pair.upper)).size,
      uniqueLowerRimVertices: new Set(top.pairs.map(pair => pair.lower)).size,
      groups: Object.fromEntries(Object.entries(groups).map(([name, group]) => [name, { vertices: group.length, neighborEdges: groupEdges[name].length }])),
      thresholds: { lipRed: 'native red>.025', oralReturnSkin: 'native type<.5 && inner>.25', cornerSkin: 'native type<.5 && skin && abs(u)>.75', nativeRim: 'native sample.rim', teethGumsTongue: '.5<csType<3.5' },
      semanticSHA256: Object.fromEntries(await Promise.all(Object.entries(initialSemantics).map(async ([name, value]) => [name, await digest(value.buffer)]))),
      calibration: { referenceSHA256: await digest(saved.reference), referenceHorizontalSHA256: await digest(saved.horizontal), lastKey: saved.lastKey },
      measurementUnits: { positions: 'metres', displacement: 'millimetres', edgeDeltaDifference: 'millimetres', edgeDeltaPerPreviousEdgeLength: 'dimensionless' } }) };
  Object.defineProperty(window, '__LIP_R04_DIAG__', { configurable: true, value: api });
  return { nativeTopologyCount: top.count, selectedVertices: ids.length, neighborEdges: edges.length, originalFunctionsSaved: Object.keys(refs), originalDescriptorsSaved: Object.keys(descriptors) };
}

// The independent material auditor's read-only collectOralAttribution function
// is included below so this file remains a self-contained CI diagnostic.
function collectOralAttribution() {
  const v = window.__IDENTITY_QA__?.viewer?.(), m = window.__IDENTITY_QA__?.model?.(), g = v?.mesh?.geometry;
  if (!v || !m || !g?.index) throw Error('Rendered native indexed person unavailable');
  const a = g.attributes;
  for (const k of ['position', 'normal', 'fRest', 'csRegion', 'csType', 'l19Oral', 'l19State', 'l19Detail']) if (!a[k] || a[k].count !== a.position.count) throw Error('Oral attribution attribute missing or wrong count: ' + k);
  const mats = Array.isArray(v.mesh.material) ? v.mesh.material : [v.mesh.material];
  const types = { 0: 'skin', 1: 'teeth', 2: 'gums', 3: 'tongue', 4: 'scleras', 5: 'irises', 6: 'pupils' };
  const typeLabel = id => types[Math.round(a.csType.getX(id))] || 'unclassified';
  const oral = id => Math.max(0, Math.min(1, a.l19State.getX(id))), skin = id => a.csType.getX(id) < .5;
  const identity = id => !skin(id) ? typeLabel(id) : oral(id) > .001 ? 'oralSkin' : a.l19State.getZ(id) > .025 ? 'vermilion' : 'externalSkin';
  const stat = () => ({ vertices: 0, coverMin: Infinity, coverMax: -Infinity, oralMin: Infinity, oralMax: -Infinity, depthMinM: Infinity, depthMaxM: -Infinity, representativeIDs: [] });
  const vertexStats = {}, rawTypes = {}, pickSets = {}; let rawSemanticVsStateMax = 0;
  for (let id = 0; id < a.position.count; id++) {
    const label = identity(id), t = a.csType.getX(id), x = oral(id), s = vertexStats[label] ||= stat(); s.vertices++;
    s.coverMin = Math.min(s.coverMin, a.csRegion.getX(id)); s.coverMax = Math.max(s.coverMax, a.csRegion.getX(id));
    s.oralMin = Math.min(s.oralMin, x); s.oralMax = Math.max(s.oralMax, x);
    s.depthMinM = Math.min(s.depthMinM, a.l19Detail.getW(id)); s.depthMaxM = Math.max(s.depthMaxM, a.l19Detail.getW(id));
    rawTypes[String(t)] = (rawTypes[String(t)] || 0) + 1;
    if (s.representativeIDs.length < 8) s.representativeIDs.push(id);
    rawSemanticVsStateMax = Math.max(rawSemanticVsStateMax, Math.abs(x - (skin(id) ? Math.max(0, Math.min(1, a.l19Oral.getX(id))) : 0)));
    if (label !== 'externalSkin') {
      const p = pickSets[label] ||= {};
      if (p.first === undefined) p.first = id;
      for (const [key, component, sign] of [['minX', 'X', -1], ['maxX', 'X', 1], ['minY', 'Y', -1], ['maxY', 'Y', 1]]) if (p[key] === undefined || (a.fRest['get' + component](id) - a.fRest['get' + component](p[key])) * sign > 0) p[key] = id;
      if (p.maxOral === undefined || x > oral(p.maxOral)) p.maxOral = id;
      if (p.maxDepth === undefined || a.l19Detail.getW(id) > a.l19Detail.getW(p.maxDepth)) p.maxDepth = id;
    }
  }
  const groupStats = [], renderedIndex = g.index.array;
  for (const group of g.groups.length ? g.groups : [{ start: 0, count: renderedIndex.length, materialIndex: 0 }]) {
    const s = { materialIndex: group.materialIndex, materialName: mats[group.materialIndex]?.name || '', start: group.start, indexCount: group.count, triangles: 0,
      externalSkinOnly: 0, oralSkinOnly: 0, oralSkinAllAboveHalf: 0, oralSkinMixed: 0, oralSkinAny: 0, teethOnly: 0, gumsOnly: 0, tongueOnly: 0, other: 0, examples: {} };
    for (let off = group.start; off < Math.min(renderedIndex.length, group.start + group.count); off += 3) {
      const ids = [renderedIndex[off], renderedIndex[off + 1], renderedIndex[off + 2]], xs = ids.map(oral), allSkin = ids.every(skin), anyOral = ids.some(id => skin(id) && oral(id) > .001);
      let key = 'other'; s.triangles++;
      if (allSkin && xs.every(x => x > .001)) { key = 'oralSkinOnly'; s.oralSkinOnly++; }
      else if (allSkin && xs.every(x => x <= .001)) { key = 'externalSkinOnly'; s.externalSkinOnly++; }
      else if (anyOral) { key = 'oralSkinMixed'; s.oralSkinMixed++; }
      else if (ids.every(id => a.csType.getX(id) > .5 && a.csType.getX(id) < 1.5)) { key = 'teethOnly'; s.teethOnly++; }
      else if (ids.every(id => a.csType.getX(id) > 1.5 && a.csType.getX(id) < 2.5)) { key = 'gumsOnly'; s.gumsOnly++; }
      else if (ids.every(id => a.csType.getX(id) > 2.5 && a.csType.getX(id) < 3.5)) { key = 'tongueOnly'; s.tongueOnly++; }
      else s.other++;
      if (anyOral) s.oralSkinAny++; if (allSkin && xs.every(x => x > .5)) s.oralSkinAllAboveHalf++;
      const examples = s.examples[key] ||= [];
      if (examples.length < 4) examples.push({ renderedTriangle: off / 3, ids, oral: xs, rawOral: ids.map(id => a.l19Oral.getX(id)), csType: ids.map(id => a.csType.getX(id)), cover: ids.map(id => a.csRegion.getX(id)) });
    }
    groupStats.push(s);
  }
  const representatives = {};
  v.scene.updateMatrixWorld(true);
  for (const [label, ids] of Object.entries(pickSets)) representatives[label] = [...new Set(Object.values(ids))].map(id => {
    const rest = [a.fRest.getX(id), a.fRest.getY(id), a.fRest.getZ(id)], position = [a.position.getX(id), a.position.getY(id), a.position.getZ(id)];
    const p = v.camera.position.clone().set(...position).applyMatrix4(v.mesh.matrixWorld).project(v.camera);
    return { id, label: identity(id), csType: a.csType.getX(id), rawOral: a.l19Oral.getX(id), stateOral: oral(id), red: a.l19State.getZ(id), cover: a.csRegion.getX(id), nativeDepthM: a.l19Detail.getW(id), rest, position, ndc: p.toArray(), railSample: m.lipStructure.rails.sample(rest, a.csType.getX(id)) };
  });
  return { schema: 'kaopu/oral-material-attribution@1', measuredAt: new Date().toISOString(), source: __LIP_REALISM__.source,
    materialSlots: mats.map((mat, materialIndex) => ({ materialIndex, name: mat.name || '', type: mat.type, uuid: mat.uuid, nativeMaterial: mat === v.skin.material, proceduralSkinMaterial: mat === headProceduralSkin.material() })),
    geometry: { uuid: g.uuid, renderedVertices: a.position.count, renderedTriangles: renderedIndex.length / 3, sharedPositionWithNative: a.position === v.geometry.attributes.position, canonicalVertices: m.vertexCount, canonicalOralSkinIDs: m.headTransfer?.d?.oral_skin_ids?.length ?? null },
    rawTypes, rawSemanticVsStateMax, vertexStats, groupStats, representatives,
    proofLimits: ['No material constant is measured physiology.', 'Projected vertices do not establish per-pixel ray ownership.', 'Attribution alone does not prove visual improvement or a geometry defect.'] };
}

async function capture(name, { save = true } = {}) {
  return stage('actual GPU frame ' + name, async () => {
    const result = await page.evaluate(({ width, height }) => {
      const viewer = __IDENTITY_QA__.viewer(), renderer = viewer.renderer, gl = renderer.getContext();
      if (viewer.camera.aspect !== width / height || gl.drawingBufferWidth !== width || gl.drawingBufferHeight !== height) throw Error('Framing changed before measured frame');
      const previous = renderer.render, ownDescriptor = Object.getOwnPropertyDescriptor(renderer, 'render'), passes = [], errorBefore = gl.getError(), start = performance.now();
      Object.defineProperty(renderer, 'render', { configurable: true, writable: true, value: function (scene, camera, ...rest) {
        const before = this.info.render.frame, result = Reflect.apply(previous, this, [scene, camera, ...rest]);
        passes.push({ nativeScene: scene === viewer.scene, nativeCamera: camera === viewer.camera, frameDelta: this.info.render.frame - before, drawCalls: this.info.render.calls, triangles: this.info.render.triangles }); return result;
      } });
      try { viewer.render(); } finally { if (ownDescriptor) Object.defineProperty(renderer, 'render', ownDescriptor); else delete renderer.render; }
      gl.finish(); const bytes = new Uint8Array(width * height * 4); gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
      if (!__LIP_R04_DIAG__.ablationGeometryIsCurrent()) throw Error('Render replaced the material-attribution draw geometry');
      let binary = ''; for (let i = 0; i < bytes.length; i += 16384) binary += String.fromCharCode(...bytes.subarray(i, i + 16384));
      const extension = gl.getExtension('WEBGL_debug_renderer_info');
      return { width: gl.drawingBufferWidth, height: gl.drawingBufferHeight, bytes: btoa(binary), errorBefore, error: gl.getError(), contextLost: gl.isContextLost(),
        defaultFramebuffer: gl.getParameter(gl.FRAMEBUFFER_BINDING) === null, elapsedMS: performance.now() - start, passes,
        rendererFunctionRestored: renderer.render === previous,
        programs: renderer.info.programs.map(program => ({ id: program.id, linked: !!gl.getProgramParameter(program.program, gl.LINK_STATUS), log: gl.getProgramInfoLog(program.program) })),
        renderer: extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) };
    }, { width, height });
    assert.equal(result.width, width); assert.equal(result.height, height); assert.equal(result.errorBefore, 0); assert.equal(result.error, 0);
    assert.equal(result.contextLost, false); assert.equal(result.defaultFramebuffer, true); assert.equal(result.rendererFunctionRestored, true);
    assert(result.passes.some(pass => pass.nativeScene && pass.nativeCamera && pass.frameDelta > 0 && pass.drawCalls > 0 && pass.triangles > 0), 'Frame did not draw the actual original native person');
    assert(result.programs.length && result.programs.every(program => program.linked), 'Unlinked original shader');
    const pixels = Buffer.from(result.bytes, 'base64'); let nonUniformPixels = 0;
    for (let i = 4; i < pixels.length; i += 4) if (pixels[i] !== pixels[0] || pixels[i + 1] !== pixels[1] || pixels[i + 2] !== pixels[2]) nonUniformPixels++;
    assert(nonUniformPixels > width * height * .01, 'Blank measured framebuffer');
    const record = { name, width, height, sha256: sha(pixels), nonUniformPixels, saved: save, gpu: { ...result, bytes: undefined } };
    if (save) {
      const png = new PNG({ width, height });
      for (let y = 0; y < height; y++) pixels.copy(png.data, y * width * 4, (height - 1 - y) * width * 4, (height - y) * width * 4);
      const bytes = PNG.sync.write(png); record.pngSHA256 = sha(bytes); fs.writeFileSync(path.join(out, name + '.png'), bytes);
    }
    q.frames.push(record); checkpoint(); return { pixels, ...record };
  });
}
function frameDelta(before, after) {
  let changed = 0, maximum = 0, total = 0; const examples = [];
  for (let i = 0; i < before.pixels.length; i += 4) {
    const d = Math.max(...[0, 1, 2].map(k => Math.abs(before.pixels[i + k] - after.pixels[i + k])));
    if (d) { changed++; if (examples.length < 16) examples.push({ x: (i / 4) % width, yBottom: Math.floor(i / 4 / width), maxChannelDN: d }); }
    maximum = Math.max(maximum, d); total += d;
  }
  return { changedPixels: changed, totalPixels: width * height, maximumChannelDN: maximum, meanMaxChannelDN: total / (width * height), firstChangedPixels: examples,
    interpretation: 'Measured visual response to material ownership only; magnitude is not a beauty score.' };
}
async function restoreScene() {
  if (!page || page.isClosed()) return;
  const available = await page.evaluate(() => !!window.__LIP_R04_DIAG__);
  if (!available) return;
  q.restoration = await stage('restore every temporary diagnostic intervention', () => page.evaluate(() => __LIP_R04_DIAG__.restoreScene()));
  restored = true; checkpoint();
}
async function cleanupBrowser() {
  const errors = [], started = Date.now(), tabs = context?.pages() || [];
  q.cleanup = { startedAt: new Date().toISOString(), pages: [], errors, completed: false }; checkpoint();
  for (const [index, tab] of tabs.entries()) {
    const record = { index, url: tab.url(), alreadyClosed: tab.isClosed() }; q.cleanup.pages.push(record); if (record.alreadyClosed) continue;
    try {
      record.gpu = await bounded('cleanup GPU drain', () => tab.evaluate(() => {
        window.lifelikeIdle?.pause?.(); window.lipWorkbench?.stop?.();
        const renderer = window.__IDENTITY_QA__?.viewer?.()?.renderer;
        if (!renderer) return { available: false };
        const gl = renderer.getContext(), start = performance.now(), frameBefore = renderer.info.render.frame, errorBefore = gl.getError(), lostBefore = gl.isContextLost();
        gl.finish(); if (gl.drawingBufferWidth && gl.drawingBufferHeight) gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
        return { available: true, errorBefore, errorAfter: gl.getError(), lostBefore, lostAfter: gl.isContextLost(), frameBefore, frameAfter: renderer.info.render.frame, elapsedMS: performance.now() - start };
      }), 90000);
      if (record.gpu.available) { assert.equal(record.gpu.errorBefore, 0); assert.equal(record.gpu.errorAfter, 0); assert.equal(record.gpu.lostBefore, false); assert.equal(record.gpu.lostAfter, false); assert.equal(record.gpu.frameBefore, record.gpu.frameAfter); }
    } catch (error) { errors.push({ index, stage: 'GPU drain', error: String(error) }); }
    try { await bounded('close diagnostic page', () => tab.close({ runBeforeUnload: false }), 15000); record.closed = tab.isClosed(); assert(record.closed); }
    catch (error) { errors.push({ index, stage: 'page close', error: String(error) }); }
  }
  try { if (browser) await bounded('close diagnostic browser', () => browser.close(), 15000); q.cleanup.browserDisconnected = !browser || !browser.isConnected(); assert(q.cleanup.browserDisconnected); }
  catch (error) { errors.push({ stage: 'browser close', error: String(error) }); }
  q.cleanup.completed = errors.length === 0; q.cleanup.elapsedMS = Date.now() - started; q.cleanup.finishedAt = new Date().toISOString(); checkpoint();
  if (errors.length) throw Error('Diagnostic cleanup failed: ' + JSON.stringify(errors));
}

(async () => {
  fatalTimer = setTimeout(() => terminated('Bounded diagnosis deadline exceeded; completed raw stages retained', 124), budgetMS);
  try {
    const options = { headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] };
    if (process.env.CHROMIUM_EXECUTABLE) options.executablePath = process.env.CHROMIUM_EXECUTABLE;
    browser = await chromium.launch(options); context = await browser.newContext({ viewport: q.browserViewport, deviceScaleFactor: 1 });
    await test('immutable R02 bytes and native neutral startup', load);
    q.installation = await page.evaluate(installHarness); q.domain = await page.evaluate(() => __LIP_R04_DIAG__.domainReport());
    q.initialState = await page.evaluate(() => __LIP_R04_DIAG__.state()); checkpoint();
    const neutral = await capture('neutral-macro-r02');
    q.attribution = await page.evaluate(collectOralAttribution); writeJSON('material-attribution.json', q.attribution); checkpoint();
    for (const pose of ['neutral', 'jaw', 'speak', 'pucker']) {
      await test('trace original native stages: ' + pose, async () => {
        const result = await page.evaluate(pose => __LIP_R04_DIAG__.numerical(pose), pose);
        q.stages.push(result); writeJSON('stages-' + pose + '.json', result); checkpoint();
        assert(result.hooksRestored && result.calibration.unchanged, 'Numerical hook or calibration was not preserved');
        return { counts: result.counts, stageOrder: result.stageOrder, calibrationUnchanged: result.calibration.unchanged };
      });
    }
    await page.evaluate(() => __LIP_R04_DIAG__.poseForFrame('pucker'));
    await page.evaluate(() => __LIP_R04_DIAG__.camera('oblique'));
    await capture('pucker-oblique-r02');
    await page.evaluate(() => __LIP_R04_DIAG__.poseForFrame('jaw'));
    await page.evaluate(() => __LIP_R04_DIAG__.camera('macro'));
    const jawMacro = await capture('jaw-macro-r02');
    q.jawBeforeAblation = await page.evaluate(() => __LIP_R04_DIAG__.state());
    q.jawAttribution = await page.evaluate(collectOralAttribution); writeJSON('material-attribution-jaw.json', q.jawAttribution);
    await page.evaluate(() => __LIP_R04_DIAG__.camera('oblique'));
    const jawOblique = await capture('jaw-oblique-r02');
    await test('bounded native oral-material attribution experiment', async () => {
      try {
        q.materialAblation = await page.evaluate(() => __LIP_R04_DIAG__.beginNativeMaterialAblation()); checkpoint();
        const ablatedOblique = await capture('jaw-oblique-native-material-experiment');
        q.materialAblation.obliqueResponse = frameDelta(jawOblique, ablatedOblique);
        await page.evaluate(() => __LIP_R04_DIAG__.camera('macro'));
        const ablatedMacro = await capture('jaw-macro-native-material-experiment');
        q.materialAblation.macroResponse = frameDelta(jawMacro, ablatedMacro);
        q.materialAblation.sceneAfter = await page.evaluate(() => __LIP_R04_DIAG__.state());
        assert.deepEqual(q.materialAblation.sceneAfter, q.jawBeforeAblation, 'Material experiment changed protected geometry, pose, colour controls, camera or lighting');
        return { movedTriangles: q.materialAblation.movedTriangles, mixedOralPreserved: q.materialAblation.mixedOralPreserved,
          changedPixelsMacro: q.materialAblation.macroResponse.changedPixels, changedPixelsOblique: q.materialAblation.obliqueResponse.changedPixels };
      } finally { q.materialAblationRestoration = await page.evaluate(() => __LIP_R04_DIAG__.endNativeMaterialAblation()); checkpoint(); }
    });
    await test('exact original scene and framebuffer restoration', async () => {
      await restoreScene();
      assert.deepEqual(q.restoration.state, q.initialState, 'Final native scene differs from the saved controlled R02 baseline');
      const frame = await capture('restored-neutral-macro-r02', { save: false });
      assert.equal(frame.sha256, neutral.sha256, 'Restored native neutral framebuffer differs');
      return { stateExact: true, frameExact: true, frameSHA256: frame.sha256 };
    });
    q.diagnosticInterventions = await page.evaluate(() => __LIP_R04_DIAG__.report());
    for (const key of ['pageErrors', 'consoleErrors', 'failedRequests', 'resourceErrors']) assert.equal(q[key].length, 0, key);
    q.completed = true;
  } catch (error) {
    q.failure = String(error); q.stack = error.stack; q.completed = false; process.exitCode = 1; console.error(error);
    if (page && !page.isClosed()) {
      try { q.failureInterventions = await page.evaluate(() => window.__LIP_R04_DIAG__?.report?.() || null); } catch (_) {}
    }
  } finally {
    q.verificationFinishedAt = new Date().toISOString(); writeJSON('qa.json', q); checkpoint();
    if (!restored) try { await restoreScene(); } catch (error) { q.restorationError = String(error); q.completed = false; process.exitCode = 1; }
    try { await cleanupBrowser(); } catch (error) { q.cleanupError = String(error); q.completed = false; process.exitCode = 1; }
    clearTimeout(fatalTimer); q.finishedAt = new Date().toISOString(); writeJSON('qa.json', q);
    console.log(JSON.stringify({ completed: q.completed, sourceSHA: SOURCE, buildSHA: BUILD, tests: q.tests.length, savedFrames: q.frames.filter(x => x.saved).length, output: out, failure: q.failure || q.restorationError || q.cleanupError || null }));
    if (q.cleanupError) process.exit(1);
  }
})();
