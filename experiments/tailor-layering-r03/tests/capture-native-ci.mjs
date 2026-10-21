// Read-only capture of the actual native browser-to-cloth-worker init message.
// Runs only in GitHub Actions; the probe does not step or render the scene.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {verifyReferenceBodyLoading} from './reference-body-observation.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const EVIDENCE = path.join(ROOT, 'evidence');
const BASE = 'http://127.0.0.1:8765/';
const CAPTURE_TIMEOUT_MS = 300_000;
const started = Date.now();
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const canonical = value => Array.isArray(value) ? value.map(canonical)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
const stable = value => JSON.stringify(canonical(value));
const summary = {schema: 'kaopu-native-world-capture@1', startedUTC: new Date().toISOString(),
  passed: false, purpose: 'Capture the current native world input for numerical reproduction',
  execution: 'GitHub Actions, fresh real Chromium, software WebGL',
  visualAcceptancePerformed: false, simulationPerformedByProbe: false,
  rendererOrReadinessModifiedByProbe: false, publicationPerformed: false};
const consoleMessages = [], pageErrors = [], requests = [], requestStarts = [], forbiddenRequests = [];
let browser, context, page, timeout, heartbeat, failure, source;
let resolveCapture, rejectCapture;
const captured = new Promise((resolve, reject) => {resolveCapture = resolve; rejectCapture = reject;});
captured.catch(() => {});

async function writeJSON(name, value) {
  const destination = path.join(EVIDENCE, name), temporary = destination + '.tmp';
  const text = JSON.stringify(value) + '\n';
  await fs.writeFile(temporary, text);
  await fs.rename(temporary, destination);
  return {file: name, bytes: Buffer.byteLength(text), sha256: sha256(text)};
}

function typedValue(value, pointer) {
  const descriptor = value.typedArrays.find(row => row.path === pointer);
  assert.ok(descriptor, 'Missing lossless typed-array descriptor: ' + pointer);
  const constructors = {Float32Array, Float64Array, Uint32Array, Int32Array, Uint16Array,
    Int16Array, Uint8Array, Int8Array, Uint8ClampedArray};
  const Constructor = constructors[descriptor.type];
  assert.ok(Constructor, 'Unsupported captured typed-array type: ' + descriptor.type);
  const bytes = Buffer.from(descriptor.base64, 'base64');
  assert.equal(bytes.length, descriptor.byteLength);
  assert.equal(bytes.length, descriptor.length * Constructor.BYTES_PER_ELEMENT);
  const array = new Constructor(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  return {array, bytes, descriptor};
}

function verifyInput(value) {
  assert.equal(value.type, 'init');
  assert.equal(value.observer.originalMethodInvoked, true);
  assert.equal(value.observer.originalMethodThrew, false);
  assert.equal(value.observer.inputMutated, false);
  assert.equal(value.nativeProbe.platformReady, true);
  assert.equal(value.nativeProbe.sameNativeCanvasInStage, true);
  assert.equal(value.nativeProbe.iframeCount, 0);
  const body = typedValue(value, '/body/positions');
  const faces = typedValue(value, '/body/faces');
  const native = typedValue(value, '/nativeProbe/positions');
  const nativeFaces = typedValue(value, '/nativeProbe/faces');
  assert.equal(body.descriptor.type, 'Float32Array');
  assert.equal(faces.descriptor.type, 'Uint32Array');
  assert.equal(body.array.length % 3, 0);
  assert.equal(faces.array.length % 3, 0);
  assert.equal(body.array.length, native.array.length);
  const expected = new Float32Array(native.array.length);
  for (let i = 0; i < native.array.length; i += 3) {
    expected[i] = native.array[i]; expected[i + 1] = native.array[i + 2]; expected[i + 2] = -native.array[i + 1];
  }
  assert.ok(Buffer.from(expected.buffer).equals(body.bytes), 'Worker body differs from the actual QA model transformed to Y-up');
  assert.deepEqual(Array.from(faces.array), Array.from(nativeFaces.array), 'Worker topology differs from the actual QA model');
  assert.ok(value.body.positions.length === body.array.length && value.body.positions.every((n, i) => n === body.array[i]));
  assert.deepEqual(value.body.faces, Array.from(faces.array));
  assert.ok(body.array.length > 3000 && faces.array.length > 3000, 'Captured body must be the full native mesh');
  assert.ok(body.array.every(Number.isFinite));
  assert.ok(faces.array.every(index => Number.isInteger(index) && index >= 0 && index < body.array.length / 3));
  assert.deepEqual(value.rows.map(row => row.id), ['pants', 'inner', 'outer']);
  const garments = value.rows.map((row, i) => {
    const positions = typedValue(value, `/rows/${i}/positions`);
    assert.ok(row.positions.length === positions.array.length && row.positions.every((n, j) => n === positions.array[j]));
    assert.ok(positions.array.every(Number.isFinite));
    assert.ok(row.packet?.spec?.panels?.length && row.packet?.record && row.packet?.binding);
    assert.equal(positions.array.length, row.packet.spec.panels.reduce((n, panel) => n + panel.uvMm.length * 3, 0));
    assert.ok(Number.isFinite(row.thickness) && row.thickness > 0);
    return {id: row.id, presetId: row.packet.binding.presetId, vertices: positions.array.length / 3,
      panels: row.packet.spec.panels.length, thicknessM: row.thickness,
      positionsSHA256: sha256(positions.bytes), packetSHA256: sha256(stable(row.packet))};
  });
  const identity = {
    personRevision: source.provenance.personRevision,
    geometrySHA256: sha256(Buffer.from(native.descriptor.backingBase64 ?? native.descriptor.base64, 'base64')),
    topologySHA256: sha256(Buffer.from(nativeFaces.descriptor.backingBase64 ?? nativeFaces.descriptor.base64, 'base64')),
    stateSHA256: sha256(stable(value.nativeProbe.state)),
    adapterFingerprint: value.nativeProbe.adapterFingerprint,
    bodyYUpSHA256: sha256(body.bytes),
    workerBodyMatchesCurrentNativeModel: true, workerFacesMatchCurrentNativeModel: true,
    sameNativeCanvasInStage: true, frozenFixtureUsedAsCurrentBody: false,
  };
  assert.match(identity.adapterFingerprint, /^[0-9a-f]{64}$/i);
  assert.equal(identity.personRevision, source.buildManifest.personRevision);
  const referenceBodyLoading = verifyReferenceBodyLoading({baseURL: BASE, provenance: source.provenance,
    allocation: value.nativeProbe.referenceBodyAllocation, requestStarts,
    responses: requests.filter(row => row.kind !== 'request-start')});
  return {identity, bodyVertices: body.array.length / 3, bodyTriangles: faces.array.length / 3, garments, referenceBodyLoading};
}

try {
  assert.equal(process.env.GITHUB_ACTIONS, 'true', 'Native capture is restricted to GitHub Actions; do not launch a local browser.');
  await fs.mkdir(EVIDENCE, {recursive: true});
  const [provenanceBytes, manifestBytes, lockBytes] = await Promise.all([
    fs.readFile(path.join(ROOT, 'dist/SOURCE_PROVENANCE.json')),
    fs.readFile(path.join(ROOT, 'dist/BUILD_MANIFEST.json')),
    fs.readFile(path.join(ROOT, 'dist/upstream/SOURCE_LOCK.json')),
  ]);
  source = {repository: process.env.GITHUB_REPOSITORY, checkoutCommit: process.env.LAYERING_SOURCE_SHA || process.env.GITHUB_SHA, workflowEventCommit: process.env.GITHUB_SHA,
    workflowRunID: process.env.GITHUB_RUN_ID, workflowRunAttempt: process.env.GITHUB_RUN_ATTEMPT,
    provenance: JSON.parse(provenanceBytes), provenanceSHA256: sha256(provenanceBytes),
    buildManifest: JSON.parse(manifestBytes), buildManifestSHA256: sha256(manifestBytes),
    sourceLock: JSON.parse(lockBytes), sourceLockSHA256: sha256(lockBytes)};
  assert.equal(source.provenance.sameDocumentNativeHost, true);
  assert.equal(source.provenance.iframeRequired, false);
  await Promise.all([
    fs.writeFile(path.join(EVIDENCE, 'SOURCE_PROVENANCE.json'), provenanceBytes),
    fs.writeFile(path.join(EVIDENCE, 'BUILD_MANIFEST.json'), manifestBytes),
  ]);
  const require = createRequire(path.join(ROOT, '.ci-runtime/package.json'));
  const {chromium} = require('playwright');
  summary.playwrightVersion = require('playwright/package.json').version;
  assert.equal(summary.playwrightVersion, '1.64.0');
  browser = await chromium.launch({headless: true, channel: 'chromium', timeout: 60_000,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
      '--ignore-gpu-blocklist', '--disable-dev-shm-usage']});
  summary.browserVersion = browser.version();
  context = await browser.newContext({viewport: {width: 1440, height: 1000}, deviceScaleFactor: 1,
    colorScheme: 'light', locale: 'zh-CN', reducedMotion: 'reduce'});
  await context.exposeBinding('__KAOPU_ACCEPT_NATIVE_CAPTURE__', async (_binding, text) => {
    try {
      const value = JSON.parse(text);
      value.schema = 'kaopu-native-world-input@1';
      value.source = source;
      value.coordinateSystem = {units: 'metres', up: 'Y',
        nativeToWorld: '[x, y, z] -> [x, z, -y]',
        groundShiftM: source.sourceLock.person.groundShiftM,
        bodyGroundShiftAppliedAgain: false,
        garmentPositions: 'Exact prepared yarn-envelope middle-surface inputs sent before LayerWorld.create',
        packetCoordinates: 'Prepared packet fields retained with their own units; UV paper uses millimetres'};
      value.capture = {capturedUTC: new Date().toISOString(), wallMS: Date.now() - started,
        phase: 'Original init input before worker LayerWorld.create; not the solver output or a completed render',
        originalMessageAndTransferArgumentsPreserved: true, applicationMutationCalls: false,
        visualOrContinuousSimulationAcceptance: false};
      // Checkpoint before verification: a failed identity assertion must not
      // discard the geometry needed to diagnose the mismatch.
      value.validation = {passed: false, status: 'verification pending'};
      await writeJSON('native-world-input.json', value);
      const checks = verifyInput(value);
      value.identity = checks.identity;
      value.validation = {passed: true, ...checks};
      const artifact = await writeJSON('native-world-input.json', value);
      summary.artifact = artifact;
      summary.identity = checks.identity;
      summary.bodyVertices = checks.bodyVertices;
      summary.bodyTriangles = checks.bodyTriangles;
      summary.garments = checks.garments;
      summary.referenceBodyLoading = checks.referenceBodyLoading;
      console.log('NATIVE_CAPTURE_SAVED ' + JSON.stringify({...artifact,
        bodyVertices: checks.bodyVertices, bodyTriangles: checks.bodyTriangles,
        garments: checks.garments.map(row => ({id: row.id, vertices: row.vertices}))}));
      resolveCapture(value);
    } catch (error) {rejectCapture(error);}
  });
  await context.addInitScript(() => {
    if (globalThis.__KAOPU_NATIVE_CAPTURE_OBSERVER__) return;
    const state = globalThis.__KAOPU_NATIVE_CAPTURE_OBSERVER__ = {installed: true, matched: false};
    const prototype = Worker.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'postMessage');
    const original = descriptor.value;
    function encodeBytes(bytes) {
      let binary = '';
      for (let i = 0; i < bytes.length; i += 16384) binary += String.fromCharCode(...bytes.subarray(i, i + 16384));
      return btoa(binary);
    }
    function serialize(value) {
      const typedArrays = [];
      function visit(item, pointer) {
        if (ArrayBuffer.isView(item)) {
          if (item instanceof DataView) throw new Error('Unexpected DataView in cloth init input');
          const bytes = new Uint8Array(item.buffer, item.byteOffset, item.byteLength);
          const descriptor = {path: pointer, type: item.constructor.name, length: item.length,
            byteLength: item.byteLength, byteOffset: item.byteOffset, bufferByteLength: item.buffer.byteLength,
            base64: encodeBytes(bytes)};
          if (item.byteOffset !== 0 || item.byteLength !== item.buffer.byteLength) {
            descriptor.backingBase64 = encodeBytes(new Uint8Array(item.buffer));
          }
          typedArrays.push(descriptor);
          return Array.from(item);
        }
        if (item instanceof ArrayBuffer) throw new Error('Unexpected bare ArrayBuffer in cloth init input');
        if (Array.isArray(item)) return item.map((entry, i) => visit(entry, pointer + '/' + i));
        if (item && typeof item === 'object') return Object.fromEntries(Object.keys(item).map(key =>
          [key, visit(item[key], pointer + '/' + key.replace(/~/g, '~0').replace(/\//g, '~1'))]));
        return item;
      }
      const plain = visit(value, '');
      plain.typedArrays = typedArrays;
      return JSON.stringify(plain);
    }
    Object.defineProperty(prototype, 'postMessage', {...descriptor, value: function (...args) {
      const message = args[0];
      let observation;
      if (!state.matched && message?.type === 'init' && message.body?.positions && message.body?.faces && Array.isArray(message.rows)) {
        state.matched = true;
        const began = performance.now();
        try {
          const model = window.__IDENTITY_QA__?.model?.();
          const viewer = window.__IDENTITY_QA__?.viewer?.();
          const copy = structuredClone(message);
          copy.nativeProbe = structuredClone({positions: model.positions, faces: model.faces,
            state: model.state, adapterFingerprint: model.archive().adapterFingerprint,
            platformReady: window.platformReview?.ready?.() === true,
            sameNativeCanvasInStage: document.querySelector('#layer-app #layer-stage canvas') === viewer.canvas,
            referenceBodyAllocation: window.__LAYER_NATIVE_TIMINGS__?.referenceBodyAllocation,
            iframeCount: document.querySelectorAll('iframe').length});
          copy.observer = {browserMS: performance.now(), copyMS: performance.now() - began,
            pageURL: location.href, originalMethodInvoked: false, originalMethodThrew: false,
            inputMutated: false, originalMethodRestoredAfterCapture: true};
          observation = copy;
        } catch (error) {state.error = String(error); console.error('NATIVE_CAPTURE_COPY_FAILED ' + state.error);}
      }
      let result;
      try {
        if (observation) observation.observer.originalMethodInvoked = true;
        result = Reflect.apply(original, this, args);
      } catch (error) {
        if (observation) observation.observer.originalMethodThrew = true;
        throw error;
      } finally {
        if (state.matched) Object.defineProperty(prototype, 'postMessage', descriptor);
        if (observation) queueMicrotask(() => {
          try {
            const text = serialize(observation);
            globalThis.__KAOPU_ACCEPT_NATIVE_CAPTURE__(text).catch(error => {
              state.error = String(error); console.error('NATIVE_CAPTURE_DELIVERY_FAILED ' + state.error);
            });
          } catch (error) {state.error = String(error); console.error('NATIVE_CAPTURE_SERIALIZE_FAILED ' + state.error);}
        });
      }
      return result;
    }});
  });
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin === new URL(BASE).origin || ['data:', 'blob:'].includes(url.protocol)) return route.continue();
    forbiddenRequests.push({url: url.href, type: route.request().resourceType()});
    return route.abort('blockedbyclient');
  });
  page = await context.newPage();
  page.on('console', message => {
    const row = {wallMS: Date.now() - started, type: message.type(), text: message.text()};
    consoleMessages.push(row);
    if (/^NATIVE_CAPTURE_(COPY|SERIALIZE|DELIVERY)_FAILED /.test(row.text)) rejectCapture(new Error(row.text));
  });
  page.on('pageerror', error => {pageErrors.push({message: error.message, stack: error.stack}); rejectCapture(error);});
  page.on('request', request => {
    const row = {kind: 'request-start', url: request.url(), wallMS: Date.now() - started};
    requestStarts.push(row); requests.push(row);
  });
  page.on('response', response => requests.push({url: response.url(), status: response.status(), wallMS: Date.now() - started}));
  page.on('requestfailed', request => requests.push({url: request.url(), failure: request.failure()?.errorText, wallMS: Date.now() - started}));
  timeout = setTimeout(() => rejectCapture(new Error('Actual native init capture exceeded 300 seconds')), CAPTURE_TIMEOUT_MS);
  heartbeat = setInterval(() => console.log('NATIVE_CAPTURE_PROGRESS ' + JSON.stringify({wallMS: Date.now() - started,
    browserConnected: browser.isConnected(), requests: requests.length, errors: pageErrors.length})), 15_000);
  await page.goto(BASE, {waitUntil: 'domcontentloaded', timeout: 60_000});
  await captured;
  assert.equal(forbiddenRequests.length, 0, 'Native preparation requested an asset outside the verified local closure');
  assert.equal(pageErrors.length, 0, 'Native preparation raised a browser error');
  summary.passed = true;
} catch (error) {
  failure = error;
  summary.error = {message: error.message, stack: error.stack};
} finally {
  clearTimeout(timeout); clearInterval(heartbeat);
  summary.elapsedMS = Date.now() - started;
  summary.pageErrors = pageErrors;
  summary.forbiddenRequests = forbiddenRequests;
  await fs.mkdir(EVIDENCE, {recursive: true});
  await Promise.all([
    writeJSON('native-capture-summary.json', summary), writeJSON('native-capture-console.json', consoleMessages),
    writeJSON('native-capture-network.json', requests), writeJSON('native-capture-errors.json', pageErrors),
  ]);
  // Normal browser teardown ends this input capture before slow presentation;
  // it is not an application-level render or readiness modification.
  await context?.close().catch(() => {});
  await browser?.close().catch(() => {});
}
console.log(JSON.stringify({passed: summary.passed, elapsedMS: summary.elapsedMS,
  artifact: summary.artifact, error: summary.error?.message}, null, 2));
if (failure) throw failure;
