'use strict';
/* Independent renderer checks for the bounded R02 colour-composition change.
 * The tested R01/R02 paths live in one candidate, so this suite verifies their
 * measured difference; source review separately binds the retained R01 path.
 * No production shader, geometry, or reference file is rewritten by this file.
 */
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { PNG } = require('pngjs');

const VERSION = 'LIP-REALISM-R02';
const MODE = process.env.LIP_COLOUR_QA_MODE || process.env.LIP_QA_MODE || process.env.MODE || 'core';
assert(['core', 'public'].includes(MODE), 'Use MODE=core or MODE=public');
const candidatePath = path.resolve(process.env.CANDIDATE_PATH || path.join(__dirname, 'preview.html'));
const baselinePath = path.resolve(process.env.BASELINE_PATH || path.join(path.dirname(candidatePath), 'baseline-r01.html'));
const baselineSHA256 = '4d11c5a8c7b9a0573e37e68ce93eaa9a1657c6b49da6c386a6aa6488ff45f231';
const publicURL = process.env.CANDIDATE_URL || process.env.PUBLIC_URL;
const localQAPath = process.env.LOCAL_QA_PATH;
const out = path.resolve(process.env.QA_OUT || process.env.LIP_QA_OUT || path.join(__dirname, 'evidence', MODE));
const width = 640, height = 512;
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const budgetMS = Number(process.env.QA_BUDGET_MS || (MODE === 'public' ? 480000 : 900000));
assert(Number.isFinite(budgetMS) && budgetMS >= 60000 && budgetMS <= 1440000, 'Invalid bounded QA deadline');
fs.mkdirSync(out, { recursive: true });
const q = {
  schema: 'kaopu/lip-colour-composition-qa@1', version: VERSION, mode: MODE,
  sourceSHA: process.env.SOURCE_SHA || process.env.GITHUB_SHA || null,
  verifierSHA256: sha(fs.readFileSync(__filename)), startedAt: new Date().toISOString(),
  tests: [], frames: [], pageErrors: [], consoleErrors: [], failedRequests: [], resourceErrors: [],
  framebuffer: { width, height, pixelRatio: 1 }, browserViewport: { width: 1280, height: 900 },
  softwareRenderer: true, physicalPhone: false, completed: false, necessityEstablished: false,
  publicHttpsPassed: false, browserPassed: false, interactive3D: false, shareAllowed: false,
  generatedImageUsed: false, staticImageSubstitute: false, sourceModified: true,
  userVisualAccepted: false, visualAcceptance: false, productionReady: false,
  budgetMS,
  candidateScope: 'Legacy lip-tint composition correction only; extra spatial colour and outer-edge transition were withdrawn after independent visual review.',
  priorFailureEvidence: {
    runURL: 'https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/39096551073',
    sourceSHA: 'bf235cbb741de1eb21f469c9e020b95a65f24040',
    verifierSHA256: '6f5bd3941b1c9e6ec828fb46507efba3fd2f677dc4036f2d547625042ebfa2b5',
    artifactID: 12124738959,
    artifactSHA256: '9562ffc044854dc1833bba7f96cca26ad1fdd143771d6f3770a52c08242f9be0',
    classification: 'The fixed 10% old-feather sampling premise failed before either skin-layer perturbation was executed; this was not a measured skin response failure.',
    observedMacroProbes: { total: 6392, nonzeroOldFeather: 515, maximumOldFeather: 0.045756502743540255, visibleR01OldTintResponse: 64 },
    cleanup: 'The original 15-second browser close also timed out after pending native renders; cleanup now explicitly drains each page before closing it, with bounded failure handling.'
  },
  priorParameterSamplingFailureEvidence: {
    runURL: 'https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/39098058680',
    sourceSHA: '331b5c469ce822d989a10193d2292c17b94e346a',
    verifierSHA256: '7e5328286a4d5662a0e7aa7a895b9edd197e59609b99074fa050a2c76b930bb0',
    artifactID: 12125727373,
    artifactSHA256: 'a7764a58a8bae00bbefc521ccc4baffff206825369254ae2281e812e34376d34',
    observedRegionalResponses: { nativeBand: 109, nativeBandSamples: 6392, oldTintPositiveControl: 3, oldTintPositiveControlSamples: 64 },
    classification: 'regionalColor had nonzero responses but did not meet four responses in the old lipColor positive-control subset. That subset did not establish regionalColor observability; its own published-R01 positive control now runs before candidate startup.'
  },
  priorRegionalObservabilityFailureEvidence: {
    runURL: 'https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/39100007306',
    sourceSHA: '3fe2aa9329b75b44c13c61b8df8cd94a5fc6b54e',
    verifierSHA256: 'efd77963bedbb8639fbfc581c9dc92d3181660a8981240723c1a30b9667236c3',
    artifactID: 12126411431,
    artifactSHA256: 'dfc4a62bb76ba65c1830c65a99b49724f0c3db47045aa0e3b959a0de0060da94',
    qaSHA256: 'f62e124699f40c084b080eba1b6d44b73b09425a183aec255b9df3b263eacf8d',
    observedPublishedR01RegionalOverlap: { nativeBandSamples: 6392, nonzeroOldFeatherSamples: 515, visibleResponses: 4, upper: 3, lower: 1, maximumChannelDeltaDN: 1 },
    candidateStarted: false, completed: false,
    classification: 'The published R01 baseline itself had fewer than eight visible regionalColor responses in the thin old-feather intersection. This was a preflight observability failure, not a candidate pass or failure; quantitative preservation in that intersection is not claimed by this scoped suite.'
  },
  skinResponseScope: {
    beardShadow: 'Nonzero responses in the unchanged native near-mouth skin band and its independently selected R01 old-tint-positive old-feather overlap.',
    regionalColor: 'Nonzero responses in the unchanged native near-mouth skin band and at its independently visible published-R01 regionalColor positive-control pixels.',
    regionalColorThinOldFeatherPreservationEstablished: false,
    fullResponseAmplitudePreservationEstablished: false
  },
  limitations: [
    'One frozen person, neutral pose, three existing views, one real Chromium SwiftShader runner.',
    'Native LipRails projected ROI is a conservative mouth rectangle, not a pixel-perfect anatomical segmentation.',
    'The retained R01 path is checked against one macro base-colour frame from the byte-identical published R01 page; the remaining views compare paths in the same candidate.',
    'Near-mouth probes use projected native skin vertices 1.5–7 mm outside the outer lip rails in the inherited rest frame; no physiological measurement is claimed.',
    'beardShadow uses the R01 lipColor-positive old-feather overlap. regionalColor uses its own visible positive control across the unchanged native near-mouth band in the byte-identical published R01 page, without an old-feather restriction. Neither set is selected from candidate responses.',
    'regionalColor preservation in the thin old-feather intersection is not quantified: the original baseline had only four visible one-DN responses there. Skin checks establish nonzero observable responses, not exact preservation of their full magnitude.',
    'The tests establish composition and preservation properties, not photorealism or user aesthetic approval.',
    'The inherited remote loader is retained; offline operation and real-phone performance are not certified.'
  ]
};
let browser, context, page, server, sequence = 0, fatalTimer;
const active = [];
function writeJSON(name, value) {
  const target = path.join(out, name), temporary = target + '.tmp';
  fs.writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n'); fs.renameSync(temporary, target);
}
function checkpoint() { q.updatedAt = new Date().toISOString(); q.activeStages = active.map(x => ({ ...x })); writeJSON('qa.partial.json', q); }
function progress(name, event, details = {}) {
  const record = { sequence: ++sequence, at: new Date().toISOString(), name, event, ...details };
  fs.appendFileSync(path.join(out, 'progress.jsonl'), JSON.stringify(record) + '\n');
  q.lastProgress = record; checkpoint(); console.log(event.toUpperCase() + ' ' + name);
}
async function bounded(name, operation, milliseconds = 90000) {
  let timer;
  try { return await Promise.race([Promise.resolve().then(operation), new Promise((_, reject) => { timer = setTimeout(() => reject(Error(name + ' exceeded ' + milliseconds + ' ms; pending work is not a pass')), milliseconds); })]); }
  finally { clearTimeout(timer); }
}
async function stage(name, operation) {
  const entry = { name, startedAt: new Date().toISOString() }, start = Date.now(); active.push(entry); progress(name, 'start');
  try { const value = await operation(); progress(name, 'end', { elapsedMS: Date.now() - start }); return value; }
  catch (error) { progress(name, 'failure', { elapsedMS: Date.now() - start, error: String(error) }); throw error; }
  finally { active.splice(active.indexOf(entry), 1); checkpoint(); }
}
async function test(name, operation) {
  return stage(name, async () => {
    const start = Date.now();
    try { const result = await operation(); q.tests.push({ name, passed: true, elapsedMS: Date.now() - start, result }); checkpoint(); return result; }
    catch (error) { q.tests.push({ name, passed: false, elapsedMS: Date.now() - start, error: String(error), stack: error.stack }); checkpoint(); throw error; }
  });
}
function stopImmediately(reason, code) {
  q.completed = false; q.shareAllowed = false; q.failure = reason; q.finishedAt = new Date().toISOString();
  progress('process', 'terminated', { reason }); writeJSON('qa.json', q); process.exit(code);
}
for (const [signal, code] of [['SIGTERM', 143], ['SIGINT', 130]]) process.once(signal, () => stopImmediately('Interrupted by ' + signal, code));
const small = frame => ({ width, height, sha256: frame.sha256, nonUniformPixels: frame.nonUniformPixels });

async function serve() {
  const bytes = fs.readFileSync(candidatePath);
  const baseline = fs.readFileSync(baselinePath);
  assert.equal(sha(baseline), baselineSHA256, 'The input R01 page is not byte-identical to the published reference');
  assert(bytes.includes(Buffer.from(VERSION)), 'Candidate R02 version marker is absent');
  q.previewSHA256 = sha(bytes); q.previewBytes = bytes.length;
  server = http.createServer((request, response) => {
    const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
    if (pathname === '/favicon.ico') { response.writeHead(204).end(); return; }
    const body = pathname === '/candidate.html' ? bytes : pathname === '/baseline-r01.html' ? baseline : null;
    if (!body) { response.writeHead(404).end('Unknown QA route'); return; }
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }); response.end(body);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  return { candidate: base + '/candidate.html', baseline: base + '/baseline-r01.html' };
}
async function load(url, expectedVersion = VERSION, label = 'candidate') {
  page = await context.newPage(); page.setDefaultTimeout(30000);
  const evaluate = page.evaluate.bind(page);
  page.evaluate = (...args) => bounded('browser evaluate', () => evaluate(...args));
  page.on('pageerror', error => { q.pageErrors.push(String(error)); checkpoint(); });
  page.on('console', message => { if (message.type() === 'error' && !/favicon/i.test(message.text())) { q.consoleErrors.push(message.text()); checkpoint(); } });
  page.on('requestfailed', request => { if (!/favicon/i.test(request.url())) { q.failedRequests.push({ url: request.url(), error: request.failure()?.errorText }); checkpoint(); } });
  page.on('response', response => { if (response.status() >= 400 && !/favicon/i.test(response.url())) { q.resourceErrors.push({ url: response.url(), status: response.status() }); checkpoint(); } });
  const start = Date.now(), response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
  assert.equal(response.status(), 200, 'Candidate document must return HTTP 200');
  await page.waitForFunction(() => window.__HEAD_PROC__?.ready || window.__HEAD_PROC__?.errors?.length, null, { timeout: 300000 });
  assert.equal(await page.evaluate(() => window.__HEAD_PROC__?.errors?.length || 0), 0, 'The host failed before lip startup');
  await page.waitForFunction(() => (window.__R05_PRESET_READY__ === true && window.lipRealism?.ready === true) || window.__LIP_REALISM__?.errors?.length, null, { timeout: 180000 });
  const host = await page.evaluate(() => {
    const viewer = __IDENTITY_QA__.viewer();
    window.lifelikeIdle?.pause?.(); window.lipWorkbench?.stop?.();
    viewer.orbit.autoRotate = false; viewer.orbit.enableDamping = false;
    return { version: lipRealism.version, finalFrame: viewer.startupFinalFrame, ready: __HEAD_PROC__.ready, headErrors: __HEAD_PROC__.errors, lipErrors: window.__LIP_REALISM__?.errors, nativeLipErrors: window.__LIP_P3__?.errors, compare: typeof lipRealism.compare, ablation: typeof lipRealism.ablation, spatialColour: lipRealism.report?.().ablation?.spatialColour, withdrawnTransitionControls: document.querySelectorAll('#lr-spatial-colour').length };
  });
  assert.equal(host.version, expectedVersion); assert(host.finalFrame && host.ready, 'Complete native person startup did not finish');
  for (const key of ['headErrors', 'lipErrors', 'nativeLipErrors']) assert.equal(host[key]?.length || 0, 0, key);
  if (expectedVersion === VERSION) {
    assert.equal(host.compare, 'function'); assert.equal(host.ablation, 'function');
    assert.equal(host.spatialColour, false, 'The withdrawn colour/edge transition must be disabled by default');
    assert.equal(host.withdrawnTransitionControls, 0, 'The withdrawn transition control remains in the candidate UI');
  }
  q[label + 'Startup'] = { url, httpStatus: response.status(), elapsedMS: Date.now() - start, host }; checkpoint();
  await stage('finish native startup GPU queue', () => page.evaluate(() => {
    const renderer = __IDENTITY_QA__.viewer().renderer, gl = renderer.getContext(), pixel = new Uint8Array(4);
    gl.finish(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    if (gl.getError() !== 0 || gl.isContextLost()) throw Error('Native startup GPU queue failed');
  }));
  return page;
}
async function prepareFrame() {
  // Let any native ResizeObserver from a prior layout operation settle first.
  // Framing must see this aspect; no size or camera mutation is allowed later
  // between protected-state capture and framebuffer measurement.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  return page.evaluate(({ width, height }) => {
    const viewer = __IDENTITY_QA__.viewer(); viewer.renderer.setPixelRatio(1); viewer.renderer.setSize(width, height, false);
    viewer.camera.aspect = width / height; viewer.camera.updateProjectionMatrix();
  }, { width, height });
}
async function setView(kind) {
  return stage('view ' + kind, async () => {
    await prepareFrame();
    return page.evaluate(kind => {
      const viewer = __IDENTITY_QA__.viewer(); lipRealism.view(kind);
      return { kind, position: viewer.camera.position.toArray(), target: viewer.orbit.target.toArray(), fov: viewer.camera.fov, zoom: viewer.camera.zoom, aspect: viewer.camera.aspect };
    }, kind);
  });
}
async function selectVariant(kind, diagnostic = null) {
  return stage('variant ' + kind + (diagnostic === null ? '' : ' channel ' + diagnostic), () => page.evaluate(({ kind, diagnostic }) => {
    const result = lipRealism.compare(kind);
    if (diagnostic !== null) lipRealism.set({ diagnostic });
    return { result, settings: lipRealism.settings() };
  }, { kind, diagnostic })).then(result => { assert.equal(result.settings.enabled, kind !== 'r07', 'Comparison selected the wrong enabled state'); return result; });
}
async function state() {
  return page.evaluate(async () => {
    const viewer = __IDENTITY_QA__.viewer(), model = __IDENTITY_QA__.model(), geometry = viewer.geometry;
    const digest = async array => array ? Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(array.buffer, array.byteOffset, array.byteLength))), value => value.toString(16).padStart(2, '0')).join('') : null;
    const attributes = {};
    for (const name of ['position', 'normal', 'csRest', 'fRest', 'skinIndex', 'skinWeight']) attributes[name] = await digest(geometry.attributes[name]?.array);
    const lights = []; viewer.scene.updateMatrixWorld(true);
    viewer.scene.traverse(object => {
      if (!object.isLight) return;
      let visible = true; for (let current = object; current; current = current.parent) visible = visible && current.visible;
      const light = { type: object.type, name: object.name, color: object.color.toArray(), ground: object.groundColor?.toArray(), intensity: object.intensity, matrix: object.matrixWorld.toArray(), target: object.target?.matrixWorld.toArray(), visible };
      // Match the existing JSON evidence representation without normalizing
      // any real number or array: absent optional properties stay absent.
      if (light.ground === undefined) delete light.ground;
      if (light.target === undefined) delete light.target;
      lights.push(light);
    });
    return {
      geometry: { attributes, index: await digest(geometry.index?.array), canonicalPositions: await digest(model.positions), canonicalFaces: await digest(model.faces), vertices: geometry.attributes.position.count, triangles: geometry.index.count / 3 },
      camera: { position: viewer.camera.position.toArray(), quaternion: viewer.camera.quaternion.toArray(), projection: viewer.camera.projectionMatrix.toArray(), target: viewer.orbit.target.toArray(), fov: viewer.camera.fov, zoom: viewer.camera.zoom },
      lighting: { lights, exposure: viewer.renderer.toneMappingExposure, toneMapping: viewer.renderer.toneMapping, outputColorSpace: viewer.renderer.outputColorSpace },
      head: headProceduralSkin.settings(), body: bodyProceduralSkin.settings(), lip: lipRealism.settings(),
      nativeLipDNA: lipWorkbench.dna(), nativeLipShape: lipWorkbench.settings(), nativeLipPose: lipWorkbench.pose()
    };
  });
}
function protectedState(value, omitted = []) {
  const result = structuredClone(value);
  for (const field of omitted) { const parts = field.split('.'); let owner = result; for (let i = 0; i < parts.length - 1; i++) owner = owner[parts[i]]; delete owner[parts.at(-1)]; }
  return result;
}
function sameExcept(before, after, omitted, message) { assert.deepEqual(protectedState(after, omitted), protectedState(before, omitted), message); }
async function capture(name) {
  return stage('frame ' + name, async () => {
    const result = await page.evaluate(({ width, height }) => {
      const viewer = __IDENTITY_QA__.viewer(), renderer = viewer.renderer, gl = renderer.getContext();
      if (viewer.camera.aspect !== width / height || gl.drawingBufferWidth !== width || gl.drawingBufferHeight !== height) throw Error('Controlled dimensions/aspect drifted after framing; capture will not silently repair them');
      const previous = renderer.render, passes = [], errorBefore = gl.getError(), start = performance.now();
      renderer.render = function (scene, camera, ...rest) {
        const before = this.info.render.frame, result = previous.call(this, scene, camera, ...rest);
        passes.push({ nativeScene: scene === viewer.scene, nativeCamera: camera === viewer.camera, frameDelta: this.info.render.frame - before, drawCalls: this.info.render.calls, triangles: this.info.render.triangles }); return result;
      };
      try { viewer.render(); } finally { renderer.render = previous; }
      gl.finish(); const bytes = new Uint8Array(width * height * 4); gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
      let binary = ''; for (let i = 0; i < bytes.length; i += 16384) binary += String.fromCharCode(...bytes.subarray(i, i + 16384));
      const extension = gl.getExtension('WEBGL_debug_renderer_info');
      return {
        width: gl.drawingBufferWidth, height: gl.drawingBufferHeight, bytes: btoa(binary),
        errorBefore, error: gl.getError(), contextLost: gl.isContextLost(), defaultFramebuffer: gl.getParameter(gl.FRAMEBUFFER_BINDING) === null,
        elapsedMS: performance.now() - start, passes,
        programs: renderer.info.programs.map(program => ({ id: program.id, linked: !!gl.getProgramParameter(program.program, gl.LINK_STATUS), log: gl.getProgramInfoLog(program.program) })),
        renderer: extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)
      };
    }, { width, height });
    assert.equal(result.width, width); assert.equal(result.height, height); assert.equal(result.errorBefore, 0); assert.equal(result.error, 0);
    assert.equal(result.contextLost, false); assert.equal(result.defaultFramebuffer, true);
    assert(result.passes.some(pass => pass.nativeScene && pass.nativeCamera && pass.frameDelta > 0 && pass.drawCalls > 0 && pass.triangles > 0), 'The final frame did not draw the actual native person');
    assert(result.programs.length > 0 && result.programs.every(program => program.linked), 'Unlinked shader program');
    const pixels = Buffer.from(result.bytes, 'base64'); let nonUniformPixels = 0;
    for (let i = 4; i < pixels.length; i += 4) if (pixels[i] !== pixels[0] || pixels[i + 1] !== pixels[1] || pixels[i + 2] !== pixels[2]) nonUniformPixels++;
    assert(nonUniformPixels > width * height * .01, 'Blank or uniform framebuffer');
    const frame = { pixels, sha256: sha(pixels), nonUniformPixels };
    const png = new PNG({ width, height });
    for (let y = 0; y < height; y++) pixels.copy(png.data, y * width * 4, (height - 1 - y) * width * 4, (height - y) * width * 4);
    const image = PNG.sync.write(png); fs.writeFileSync(path.join(out, name + '.png'), image);
    q.frames.push({ name, ...small(frame), pngSHA256: sha(image), elapsedMS: result.elapsedMS, gpu: { ...result, bytes: undefined } }); checkpoint(); return frame;
  });
}
async function nativeDomain() {
  return page.evaluate(({ width, height }) => {
    const viewer = __IDENTITY_QA__.viewer(), model = __IDENTITY_QA__.model(), rails = model.lipStructure.rails;
    const attributes = viewer.geometry.attributes, rest = attributes.fRest, type = attributes.csType, positions = attributes.position;
    const vector = viewer.camera.position.clone(); let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, vertices = 0;
    const probes = new Map();
    function railAt(points, x) {
      if (x <= points[0][0]) return points[0][1];
      for (let i = 0; i < points.length - 1; i++) {
        const p = points[i], n = points[i + 1]; if (x > n[0]) continue;
        const a = points[Math.max(0, i - 1)], b = points[Math.min(points.length - 1, i + 2)], span = n[0] - p[0], t = (x - p[0]) / span;
        const ma = (n[1] - a[1]) / (n[0] - a[0]), mb = (b[1] - p[1]) / (b[0] - p[0]);
        return (2 * t ** 3 - 3 * t ** 2 + 1) * p[1] + (t ** 3 - 2 * t ** 2 + t) * span * ma + (-2 * t ** 3 + 3 * t ** 2) * n[1] + (t ** 3 - t ** 2) * span * mb;
      }
      return points.at(-1)[1];
    }
    viewer.scene.updateMatrixWorld(true);
    for (let i = 0; i < rest.count; i++) {
      const x = rest.getX(i), y = rest.getY(i), z = rest.getZ(i), sample = rails.sample([x, y, z], type.getX(i));
      if (!sample.roi) continue;
      vector.set(positions.getX(i), positions.getY(i), positions.getZ(i)).applyMatrix4(viewer.mesh.matrixWorld).project(viewer.camera);
      if (vector.z < -1 || vector.z > 1) continue;
      const px = (vector.x + 1) * width / 2, py = (vector.y + 1) * height / 2;
      minX = Math.min(minX, px); maxX = Math.max(maxX, px); minY = Math.min(minY, py); maxY = Math.max(maxY, py); vertices++;
      const u = (x - rails.cx) / rails.half, top = railAt(rails.top, x), bottom = railAt(rails.bottom, x);
      const outsideDistance = y > top ? y - top : y < bottom ? bottom - y : -1;
      const red = attributes.l19State?.getZ(i);
      // Existing native outline, independent of the candidate's lrMask/report.
      // The guard band is wider than R01's maximum authored 1.05 mm edge blend.
      if (Math.abs(u) > .85 || z <= rails.front + .006 || !(outsideDistance >= .0015 && outsideDistance <= .007) || !(red === 0)) continue;
      if (!attributes.csRegion || !attributes.fA) throw Error('The inherited lip tint fields required for the feather probe are missing');
      const lipWeight = Math.max(0, Math.min(1, Math.max(attributes.csRegion.getY(i), attributes.fA.getY(i))));
      const featherT = Math.max(0, Math.min(1, (lipWeight - .02) / (.94 - .02))), oldFeather = featherT * featherT * (3 - 2 * featherT);
      const ix = Math.round(px), iy = Math.round(py);
      if (ix < 1 || ix >= width - 1 || iy < 1 || iy >= height - 1) continue;
      probes.set(ix + ',' + iy, { x: ix, yBottom: iy, yTop: height - 1 - iy, vertex: i, outsideDistanceMM: outsideDistance * 1000, oldFeather, side: y > top ? 'upper-skin' : 'lower-skin' });
    }
    if (!vertices) throw Error('No native mouth domain was projected');
    return {
      roi: { minX: Math.max(0, Math.floor(minX) - 6), maxX: Math.min(width - 1, Math.ceil(maxX) + 6), minY: Math.max(0, Math.floor(minY) - 6), maxY: Math.min(height - 1, Math.ceil(maxY) + 6), nativeVertices: vertices, paddingPixels: 6, yOrigin: 'bottom', source: 'existing native LipRails.sample().roi' },
      skinProbes: [...probes.values()], probeSource: 'projected native vertices with l19State.z=0, |u|<=0.85, 1.5–7 mm outside native outer rails in fRest; original feather reconstructed from csRegion.y and fA.y'
    };
  }, { width, height });
}
function difference(a, b, roi = null) {
  let changedInside = 0, changedOutside = 0, maximumInside = 0, maximumOutside = 0, sumInside = 0, insidePixels = 0, outsidePixels = 0;
  const outsideExamples = [];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const index = (y * width + x) * 4;
    const delta = Math.max(Math.abs(a.pixels[index] - b.pixels[index]), Math.abs(a.pixels[index + 1] - b.pixels[index + 1]), Math.abs(a.pixels[index + 2] - b.pixels[index + 2]));
    const inside = !roi || (x >= roi.minX && x <= roi.maxX && y >= roi.minY && y <= roi.maxY);
    if (inside) { insidePixels++; sumInside += delta; maximumInside = Math.max(maximumInside, delta); if (delta) changedInside++; }
    else { outsidePixels++; maximumOutside = Math.max(maximumOutside, delta); if (delta) { changedOutside++; if (outsideExamples.length < 32) outsideExamples.push({ x, yBottom: y, maxDelta: delta }); } }
  }
  return { changedInside, changedOutside, maximumInside, maximumOutside, insidePixels, outsidePixels, meanMaxChannelDeltaInside: sumInside / Math.max(1, insidePixels), outsideExamples, threshold: 'exact RGB equality; no tolerance outside native ROI' };
}
function localResponse(a, b, roi, message) {
  const delta = difference(a, b, roi); assert(delta.outsidePixels > 128, 'The chosen view leaves no meaningful outside region to protect');
  assert(delta.changedInside > 10, message + ': no measurable mouth response'); assert.equal(delta.changedOutside, 0, message + ': response escaped the independent mouth ROI'); return delta;
}
function skinResponse(a, b, probes) {
  const changed = [], perSide = {};
  for (const probe of probes) {
    const index = (probe.yBottom * width + probe.x) * 4;
    const before = [...a.pixels.subarray(index, index + 3)], after = [...b.pixels.subarray(index, index + 3)], delta = Math.max(...before.map((value, c) => Math.abs(value - after[c])));
    const bucket = perSide[probe.side] ||= { sampled: 0, changed: 0, maximum: 0 }; bucket.sampled++;
    if (delta) { bucket.changed++; bucket.maximum = Math.max(bucket.maximum, delta); changed.push({ ...probe, before, after, maxDelta: delta }); }
  }
  return { sampled: probes.length, changed: changed.length, perSide, examples: changed.slice(0, 48) };
}
function visibleNativeProbes(low, high, candidates, { requireOldFeather = true } = {}) {
  const probes = [];
  for (const probe of candidates) {
    if (requireOldFeather && !(probe.oldFeather > 0)) continue;
    const index = (probe.yBottom * width + probe.x) * 4;
    const before = [...low.pixels.subarray(index, index + 3)], after = [...high.pixels.subarray(index, index + 3)];
    const maxDelta = Math.max(...before.map((value, channel) => Math.abs(value - after[channel])));
    if (maxDelta > 0) probes.push({ ...probe, positiveControl: { before, after, maxDelta } });
  }
  return probes;
}
async function baselineRegionalPositiveControl() {
  return test('published R01 regionalColor establishes observable native near-mouth skin probes before candidate startup', async () => {
    const domain = await nativeDomain();
    assert(domain.skinProbes.length >= 12, 'Published R01 has no adequate independent native near-mouth skin band');
    // This is the byte-identical published R01 page. Do not call candidate-only
    // compare/ablation APIs or select probes from any candidate response.
    await page.evaluate(() => bodyProceduralSkin.set({ regionalColor: 0 }));
    const lowState = await state(), low = await capture('published-r01-regional-colour-0');
    await page.evaluate(() => bodyProceduralSkin.set({ regionalColor: 1 }));
    const high = await capture('published-r01-regional-colour-1'), highState = await state();
    assert.equal(lowState.body.regionalColor, 0); assert.equal(highState.body.regionalColor, 1);
    sameExcept(lowState, highState, ['body.regionalColor'], 'Published R01 regionalColor positive control changed another scene property');
    sameExcept(lowState, q.baseline.state, ['body.regionalColor'], 'Published R01 regionalColor positive control drifted from the retained reference scene');
    const probes = visibleNativeProbes(low, high, domain.skinProbes, { requireOldFeather: false });
    q.regionalColorPositiveControl = {
      parameter: 'regionalColor', referencePreviewSHA256: baselineSHA256,
      scope: 'unchanged native near-mouth skin band; thin old-feather preservation is not quantified',
      selection: 'published R01 native near-mouth skin band AND the same pixel visibly responds to regionalColor 0 to 1; no old-feather restriction and no candidate response is used for selection',
      sourceFrames: { low: { file: 'published-r01-regional-colour-0.png', ...small(low) }, high: { file: 'published-r01-regional-colour-1.png', ...small(high) } },
      protectedLowState: lowState, nativeProbeCount: domain.skinProbes.length, observedProbeCount: probes.length, probes,
      interpretation: 'Parameter-specific observability across the unchanged native near-mouth skin band in this fixed 8-bit framebuffer; fewer than eight visible baseline probes blocks candidate execution. This establishes no quantitative preservation in the thin old-feather intersection.'
    };
    writeJSON('published-r01-regional-positive-control.json', q.regionalColorPositiveControl); checkpoint();
    assert(probes.length >= 8, 'Published R01 regionalColor has fewer than eight observable native near-mouth skin probes in this 8-bit frame; candidate response cannot be tested with this gate');
    return q.regionalColorPositiveControl;
  });
}
async function resetSettings(initial) {
  await page.evaluate(initial => {
    headProceduralSkin.set(initial.head); bodyProceduralSkin.set(initial.body);
    lipRealism.set(initial.lip); lipRealism.compare('r02'); lipRealism.ablation({ spatialColour: false });
  }, initial);
}

async function compareViews(initial) {
  const views = {};
  for (const kind of ['front', 'macro', 'oblique']) {
    await test('R01/R02 ' + kind + ' beauty and base colour preserve geometry and the outside mouth', async () => {
      await setView(kind); const domain = await nativeDomain(); views[kind] = { domain, channels: {} };
      for (const [diagnostic, channel] of [[0, 'beauty'], [2, 'colour']]) {
        await selectVariant('r01', diagnostic); const beforeState = await state(), before = await capture('r01-' + kind + '-' + channel);
        await selectVariant('r02', diagnostic); const after = await capture('r02-' + kind + '-' + channel), afterState = await state();
        assert.deepEqual(afterState, beforeState, 'R01/R02 changed geometry, native DNA, pose, lighting, camera, wetness, roughness, or fine-fold settings');
        const delta = localResponse(before, after, domain.roi, kind + ' ' + channel);
        if (kind === 'macro' && channel === 'colour') {
          assert.equal(before.sha256, q.baseline.frame.sha256, 'Candidate R01 comparison does not recover the actual published R01 image');
          assert.deepEqual(beforeState, q.baseline.state, 'Candidate R01 comparison changed the reference person, camera, light or parameters');
          q.baselineMatched = true;
        }
        views[kind].channels[channel] = { before: small(before), after: small(after), delta };
        writeJSON('comparison-' + kind + '-' + channel + '.json', { domain, before: small(before), after: small(after), delta, protectedState: beforeState });
      }
      return views[kind];
    });
  }
  await resetSettings(initial); q.comparisons = views; checkpoint(); return views;
}
async function residualCheck(initial, domain) {
  return test('old psLip colour visibly leaks in R01 and has zero base-colour effect in R02', async () => {
    const result = {};
    for (const variant of ['r01', 'r02']) {
      await selectVariant(variant, 2);
      const originalInput = page.locator('input[data-ps="lipColor"]'); assert.equal(await originalInput.count(), 1);
      assert.equal(await originalInput.isDisabled(), variant === 'r02', 'Old lip colour affordance is misleading for ' + variant);
      await page.evaluate(() => headProceduralSkin.set({ lipColor: 0 })); const lowState = await state(), low = await capture(variant + '-old-lip-colour-0');
      await page.evaluate(() => headProceduralSkin.set({ lipColor: 1 })); const high = await capture(variant + '-old-lip-colour-1'), highState = await state();
      assert.equal(lowState.head.lipColor, 0); assert.equal(highState.head.lipColor, 1);
      sameExcept(lowState, highState, ['head.lipColor'], 'The old lip colour probe altered another production property');
      const delta = difference(low, high, domain.roi);
      if (variant === 'r01') {
        localResponse(low, high, domain.roi, 'R01 residual positive control');
        // Select the overlap from the unchanged R01 render, before measuring
        // any R02 skin response. A fixed feather amplitude is not a spatial
        // guarantee: run 39096551073 observed max 0.0458 in this native band.
        const probes = visibleNativeProbes(low, high, domain.skinProbes);
        q.skinProbePositiveControl = {
          selection: 'unchanged native near-mouth skin band AND oldFeather > 0 AND the same pixel visibly responds to R01 lipColor 0 to 1; no R02 response is used for selection',
          sourceFrames: { low: { file: 'r01-old-lip-colour-0.png', ...small(low) }, high: { file: 'r01-old-lip-colour-1.png', ...small(high) } },
          nativeProbeCount: domain.skinProbes.length, observedProbeCount: probes.length, probes
        };
        writeJSON('native-old-feather-positive-control.json', q.skinProbePositiveControl); checkpoint();
        assert(probes.length >= 8, 'Fewer than eight native near-mouth pixels visibly respond to the independent R01 old-tint positive control');
      } else assert.equal(low.sha256, high.sha256, 'R02 still depends on the old psLip tint');
      result[variant] = { before: small(low), after: small(high), delta };
    }
    q.necessityEstablished = true; await resetSettings(initial); return result;
  });
}
async function preservedChannels(initial) {
  return test('R01/R02 roughness and normal diagnostics are byte-identical', async () => {
    const result = [];
    for (const [diagnostic, channel] of [[3, 'roughness'], [4, 'normals']]) {
      await selectVariant('r01', diagnostic); const beforeState = await state(), before = await capture('r01-' + channel);
      await selectVariant('r02', diagnostic); const after = await capture('r02-' + channel);
      assert.equal(after.sha256, before.sha256, 'Colour revision changed the actual ' + channel + ' channel');
      assert.deepEqual(await state(), beforeState, 'Channel comparison changed protected scene state');
      result.push({ channel, before: small(before), after: small(after) });
    }
    await resetSettings(initial); return result;
  });
}
async function wetnessIndependent(initial) {
  return test('wetness 0 to 1 changes no R02 base-colour pixel', async () => {
    await selectVariant('r02', 2); await page.evaluate(() => lipRealism.set({ wetness: 0 }));
    const lowState = await state(), low = await capture('r02-wetness-0-colour');
    await page.evaluate(() => lipRealism.set({ wetness: 1 })); const high = await capture('r02-wetness-1-colour'), highState = await state();
    assert.equal(lowState.lip.wetness, 0); assert.equal(highState.lip.wetness, 1);
    sameExcept(lowState, highState, ['lip.wetness'], 'Wetness probe changed another production property');
    assert.equal(low.sha256, high.sha256, 'Saliva-film wetness changed intrinsic base colour');
    await resetSettings(initial); return { before: small(low), after: small(high), measuredChannel: 'final psBase via existing diagnostic 2' };
  });
}
async function skinLayers(initial, domain) {
  return test('native near-mouth skin retains observable regional responses and beard responses in the independent old-feather overlap', async () => {
    assert(domain.skinProbes.length >= 12, 'No adequate independent near-mouth skin probe set; do not replace this with whole-face counts');
    const result = [];
    for (const key of ['beardShadow', 'regionalColor']) {
      const positiveControl = key === 'regionalColor' ? q.regionalColorPositiveControl : q.skinProbePositiveControl;
      const positiveControlProbes = positiveControl?.probes || [];
      const positiveControlScope = key === 'regionalColor' ? 'native near-mouth skin band' : 'old-feather overlap outside the new lip outline';
      assert(positiveControlProbes.length >= 8, key + ' requires at least eight independently selected R01 positive-control probes');
      await resetSettings(initial); await selectVariant('r02', 2);
      await page.evaluate(key => bodyProceduralSkin.set({ [key]: 0 }), key); const lowState = await state(), low = await capture('r02-skin-' + key + '-0');
      if (key === 'regionalColor') assert.deepEqual(lowState, positiveControl.protectedLowState, 'R02 regionalColor probes no longer share the published R01 geometry, camera, lighting and low-parameter scene');
      await page.evaluate(key => bodyProceduralSkin.set({ [key]: 1 }), key); const high = await capture('r02-skin-' + key + '-1'), highState = await state();
      assert.equal(lowState.body[key], 0); assert.equal(highState.body[key], 1);
      sameExcept(lowState, highState, ['body.' + key], key + ' probe changed another property');
      const response = skinResponse(low, high, domain.skinProbes);
      assert(response.changed >= 8, key + ' no longer affects the measured skin just outside the native lip outline');
      const positiveControlResponse = skinResponse(low, high, positiveControlProbes);
      assert(positiveControlResponse.changed >= 4, key + ' no longer affects the independently measured ' + positiveControlScope);
      result.push({ key, response, positiveControlScope, positiveControlResponse, positiveControlSourceFrames: positiveControl.sourceFrames, before: small(low), after: small(high) });
    }
    writeJSON('near-mouth-skin-responses.json', { source: domain.probeSource, probes: domain.skinProbes, positiveControls: { beardShadow: q.skinProbePositiveControl, regionalColor: q.regionalColorPositiveControl }, scope: q.skinResponseScope, interpretation: 'nonzero observable skin-layer responses are retained in their declared domains; regionalColor preservation in the thin old-feather intersection and exact preservation of response amplitude are not established', result });
    await resetSettings(initial); return result;
  });
}
async function colourArchive(initial, comparisons) {
  return test('one colour-review archive round trip restores its exact base colour and reset restores R02 defaults', async () => {
    await resetSettings(initial); await selectVariant('r02', 2);
    await page.evaluate(() => lipRealism.ablation({ spatialColour: false }));
    const beforeState = await state(), before = await capture('colour-review-archive-before');
    const saved = await page.evaluate(() => {
      window.__INDEPENDENT_COLOUR_ARCHIVE__ = lipRealism.archive();
      const lip = window.__INDEPENDENT_COLOUR_ARCHIVE__.lipRealism;
      return { schema: lip.schema, version: lip.version, colourReview: lip.colourReview, settings: lip.settings, calibration: { schema: lip.calibration?.schema, count: lip.calibration?.count, byteOrder: lip.calibration?.byteOrder, lastKey: lip.calibration?.lastKey } };
    });
    assert.deepEqual(saved.colourReview, { schema: 'kaopu/lip-colour-review@1', comparison: 'r02', spatialColour: false });
    assert.equal(saved.version, VERSION); assert(saved.calibration.count > 0, 'Existing native calibration is missing from the colour-review archive');
    const alternate = await page.evaluate(() => {
      lipRealism.compare('r01'); lipRealism.set({ redness: .91 });
      const report = lipRealism.report(); return { comparison: report.comparison, spatialColour: report.ablation.spatialColour, redness: lipRealism.settings().redness };
    });
    assert.equal(alternate.comparison, 'r01'); assert.equal(alternate.spatialColour, false); assert.equal(alternate.redness, .91);
    await stage('restore the on-page colour-review archive once', () => page.evaluate(async () => {
      await lipRealism.restore(structuredClone(window.__INDEPENDENT_COLOUR_ARCHIVE__));
      window.lifelikeIdle?.pause?.(); lipWorkbench.stop?.();
    }));
    const restored = await page.evaluate(() => { const report = lipRealism.report(); return { comparison: report.comparison, spatialColour: report.ablation.spatialColour }; });
    assert.deepEqual(restored, { comparison: 'r02', spatialColour: false });
    assert.deepEqual(await state(), beforeState, 'The colour-review archive changed geometry, camera, lighting or retained settings');
    const after = await capture('colour-review-archive-after'); assert.equal(after.sha256, before.sha256, 'Restored colour-review framebuffer differs');
    await page.evaluate(() => { lipRealism.compare('r01'); lipRealism.ablation({ spatialColour: false }); lipRealism.set({ redness: .91, diagnostic: 2 }); });
    const reset = page.locator('[data-lr-action="reset"]'); assert.equal(await reset.count(), 1); await reset.click();
    const defaults = await page.evaluate(() => { const report = lipRealism.report(); return { comparison: report.comparison, spatialColour: report.ablation.spatialColour, settings: lipRealism.settings(), defaults: lipRealism.defaults() }; });
    assert.equal(defaults.comparison, 'r02'); assert.equal(defaults.spatialColour, false); assert.deepEqual(defaults.settings, defaults.defaults);
    const resetFrame = await capture('colour-review-reset'); assert.equal(resetFrame.sha256, comparisons.macro.channels.beauty.after.sha256, 'Reset did not restore the recorded default R02 image');
    await page.evaluate(() => { delete window.__INDEPENDENT_COLOUR_ARCHIVE__; }); await resetSettings(initial);
    return { saved, alternate, restored, before: small(before), after: small(after), reset: { comparison: defaults.comparison, spatialColour: defaults.spatialColour, frame: small(resetFrame) }, scope: 'one same-page colourReview round trip; unrelated cold-load or multi-portrait archives were not rerun' };
  });
}
async function actualUI(initial, comparisons, publicRun = false) {
  return test('real UI comparison and view buttons select measured frames and preserve the same person', async () => {
    await resetSettings(initial); await page.locator('#lr-diagnostic').selectOption('0');
    await page.evaluate(() => {
      window.__INDEPENDENT_LIP_UI_EVENTS__ = [];
      const panel = document.querySelector('#lr-controls');
      panel.addEventListener('click', event => {
        const button = event.target.closest('[data-lr-comparison],[data-lr-view]');
        if (button) window.__INDEPENDENT_LIP_UI_EVENTS__.push({ trusted: event.isTrusted, mode: button.dataset.lrComparison || null, view: button.dataset.lrView || null });
      });
    });
    const records = [], checkFrame = async (name, expected) => {
      const measured = await capture(name); assert.equal(measured.sha256, expected.sha256, 'UI path differs from the measured direct comparison/view path'); return small(measured);
    };
    async function click(selector) { if (selector.startsWith('[data-lr-view=')) await prepareFrame(); const element = page.locator(selector); assert.equal(await element.count(), 1, 'Expected one UI target: ' + selector); assert(await element.isVisible(), 'UI target is hidden: ' + selector); await element.click(); }
    await click('[data-lr-view="front"]');
    const frontState = await state();
    await click('[data-lr-comparison="r01"]');
    assert.equal(await page.locator('[data-lr-comparison="r01"]').getAttribute('aria-pressed'), 'true');
    assert.deepEqual(await state(), frontState, 'UI R01 comparison changed geometry or camera');
    records.push({ action: 'front / R01', frame: await checkFrame((publicRun ? 'public-' : '') + 'ui-r01-front', comparisons.front.channels.beauty.before) });
    await click('[data-lr-comparison="r02"]'); await click('[data-lr-view="oblique"]');
    records.push({ action: 'R02 / oblique', frame: await checkFrame((publicRun ? 'public-' : '') + 'ui-r02-oblique', comparisons.oblique.channels.beauty.after) });
    await click('[data-lr-view="macro"]');
    records.push({ action: 'R02 / macro', frame: await checkFrame((publicRun ? 'public-' : '') + 'ui-r02-macro', comparisons.macro.channels.beauty.after) });
    const beforeR07 = await state();
    if (!publicRun) {
      await click('[data-lr-comparison="r07"]'); assert.equal(await page.evaluate(() => lipRealism.settings().enabled), false);
      const r07 = await capture('ui-r07-reference');
      await click('[data-lr-comparison="r02"]'); assert.deepEqual(await state(), beforeR07, 'Returning from R07 did not restore the current R02 person exactly');
      records.push({ action: 'R07 then R02', r07: small(r07), restored: await checkFrame('ui-return-r02', comparisons.macro.channels.beauty.after) });
    }
    const events = await page.evaluate(() => window.__INDEPENDENT_LIP_UI_EVENTS__);
    assert(events.length >= 5 && events.every(event => event.trusted), 'Expected actual browser-generated UI events');
    for (const key of ['geometry', 'lighting', 'head', 'body', 'nativeLipDNA', 'nativeLipShape', 'nativeLipPose']) assert.deepEqual((await state())[key], initial[key], 'UI changed protected ' + key);
    q.interactive3D = true; return { method: 'Playwright clicks on visible native buttons; final WebGL readback', records, events };
  });
}
async function viewportImage(name) {
  return stage('UI viewport ' + name, async () => {
    const session = await context.newCDPSession(page);
    try {
      const result = await bounded('browser viewport screenshot', () => session.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }), 30000);
      const bytes = Buffer.from(result.data, 'base64'); fs.writeFileSync(path.join(out, name + '.png'), bytes);
      q.uiViewport = { name, bytes: bytes.length, sha256: sha(bytes), viewport: page.viewportSize(), role: 'internal actual UI evidence; not a deliverable substitute' };
      (q.uiViewports ||= []).push(q.uiViewport); checkpoint();
    } finally { await bounded('detach screenshot session', () => session.detach(), 5000).catch(() => {}); }
  });
}
async function mobileViewport() {
  return test('public 390 by 844 viewport keeps comparison and view controls usable without horizontal overflow', async () => {
    const beforeGeometry = (await state()).geometry, records = [];
    const mobile = { width: 390, height: 844 };
    try {
      await page.setViewportSize(mobile);
      await page.waitForFunction(() => window.innerWidth === 390 && window.innerHeight === 844);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const layout = await page.evaluate(() => {
        const panel = document.querySelector('#lr-controls'), box = panel.getBoundingClientRect();
        return { innerWidth, innerHeight, clientWidth: document.documentElement.clientWidth, documentScrollWidth: document.documentElement.scrollWidth, bodyScrollWidth: document.body.scrollWidth, panel: { x: box.x, width: box.width, left: box.left, right: box.right } };
      });
      assert(layout.documentScrollWidth <= layout.clientWidth + 1, 'Mobile document has horizontal overflow');
      assert(layout.bodyScrollWidth <= layout.clientWidth + 1, 'Mobile body has horizontal overflow');
      assert(layout.panel.left >= -1 && layout.panel.right <= mobile.width + 1, 'R02 panel extends beyond the mobile viewport');
      async function press(selector, expected) {
        const button = page.locator(selector); assert.equal(await button.count(), 1); assert(await button.isVisible(), 'Mobile target hidden: ' + selector);
        await button.scrollIntoViewIfNeeded(); const box = await button.boundingBox(); assert(box && box.x >= -1 && box.x + box.width <= mobile.width + 1, 'Mobile button overflows horizontally');
        await button.click(); const observed = await page.evaluate(() => { const r = lipRealism.report(); return { comparison: r.comparison, view: r.view, enabled: lipRealism.settings().enabled }; });
        for (const [key, value] of Object.entries(expected)) assert.equal(observed[key], value, 'Mobile action failed for ' + key);
        records.push({ selector, box, observed });
      }
      await press('[data-lr-comparison="r01"]', { comparison: 'r01', enabled: true });
      await press('[data-lr-comparison="r02"]', { comparison: 'r02', enabled: true });
      await press('[data-lr-view="front"]', { view: 'front' }); const frontCamera = (await state()).camera;
      await press('[data-lr-view="macro"]', { view: 'macro' }); const macroCamera = (await state()).camera;
      assert.notDeepEqual(macroCamera, frontCamera, 'Mobile view buttons did not move the actual camera');
      assert.deepEqual((await state()).geometry, beforeGeometry, 'Mobile layout or comparison changed the person geometry');
      // Observe the app's own resized canvas; the 640x512 comparison framebuffer
      // is deliberately not imposed on this responsive-layout check.
      const canvas = await page.evaluate(() => {
        const viewer = __IDENTITY_QA__.viewer(), renderer = viewer.renderer, gl = renderer.getContext(); viewer.render(); gl.finish();
        const width = gl.drawingBufferWidth, height = gl.drawingBufferHeight;
        if (!(width > 0 && height > 0 && width * height <= 4000000)) throw Error('Unexpected native mobile drawing buffer');
        const pixels = new Uint8Array(width * height * 4); gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        let nonUniformPixels = 0; for (let i = 4; i < pixels.length; i += 4) if (pixels[i] !== pixels[0] || pixels[i + 1] !== pixels[1] || pixels[i + 2] !== pixels[2]) nonUniformPixels++;
        const rect = renderer.domElement.getBoundingClientRect();
        return { width, height, nonUniformPixels, error: gl.getError(), contextLost: gl.isContextLost(), programs: renderer.info.programs.map(program => !!gl.getProgramParameter(program.program, gl.LINK_STATUS)), cssBounds: { left: rect.left, top: rect.top, width: rect.width, height: rect.height } };
      });
      assert.equal(canvas.error, 0); assert.equal(canvas.contextLost, false); assert(canvas.programs.length && canvas.programs.every(Boolean));
      assert(canvas.nonUniformPixels > canvas.width * canvas.height * .01, 'Native mobile canvas is blank');
      await viewportImage('public-mobile-390x844');
      const events = await page.evaluate(() => window.__INDEPENDENT_LIP_UI_EVENTS__.slice(-4));
      assert.equal(events.length, 4); assert(events.every(event => event.trusted), 'Mobile actions were not browser-generated');
      q.mobileViewport = { tested: true, physicalDevice: false, viewport: mobile, layout, records, events, canvas, performanceClaimed: false };
      return q.mobileViewport;
    } finally {
      await page.setViewportSize(q.browserViewport);
      await prepareFrame(); await page.locator('[data-lr-view="front"]').click();
      q.desktopViewportRestored = true; checkpoint();
    }
  });
}
async function core() {
  const urls = await serve();
  await stage('load byte-identical published R01 baseline', () => load(urls.baseline, 'LIP-REALISM-R01', 'baseline'));
  await page.evaluate(() => lipRealism.set({ enabled: true, diagnostic: 2 })); await setView('macro');
  const baselineFrame = await capture('published-r01-macro-colour');
  q.baseline = { previewSHA256: baselineSHA256, bytes: fs.statSync(baselinePath).size, frame: small(baselineFrame), state: await state(), role: 'actual published R01 bytes, independently loaded before candidate' }; checkpoint();
  await baselineRegionalPositiveControl();
  await stage('close reference before candidate startup', () => bounded('close reference page', () => page.close(), 15000));
  await stage('load candidate', () => load(urls.candidate));
  await selectVariant('r02', 0); await page.evaluate(() => lipRealism.ablation({ spatialColour: false })); await setView('front');
  const initial = await state(); q.initialState = initial;
  assert.equal(initial.head.enabled, true); assert.equal(initial.lip.enabled, true);
  const comparisons = await compareViews(initial);
  assert.equal(q.baselineMatched, true, 'The published R01 baseline was not matched');
  await setView('macro'); const domain = await nativeDomain(); q.macroDomain = domain; checkpoint();
  await residualCheck(initial, domain);
  await preservedChannels(initial);
  await wetnessIndependent(initial);
  await skinLayers(initial, domain);
  await colourArchive(initial, comparisons);
  await actualUI(initial, comparisons);
  await resetSettings(initial); await setView('front');
  await test('return to the recorded R02 scene and image exactly', async () => {
    assert.deepEqual(await state(), initial, 'The test sequence did not restore the original candidate state');
    const restored = await capture('r02-final-front'); assert.equal(restored.sha256, comparisons.front.channels.beauty.after.sha256, 'The restored initial frame drifted');
    q.signature = { initialState: initial, front: small(restored), comparisons, previewSHA256: q.previewSHA256 };
    return { restored: small(restored) };
  });
  await viewportImage('candidate-ui');
}
async function publicSmoke() {
  assert(publicURL && /^https:\/\//.test(publicURL), 'Public mode requires an exact HTTPS URL');
  assert(localQAPath, 'Public mode requires completed frozen LOCAL_QA_PATH');
  const coreBytes = fs.readFileSync(localQAPath), local = JSON.parse(coreBytes), candidate = fs.readFileSync(candidatePath);
  assert.equal(local.schema, q.schema); assert(local.completed && local.necessityEstablished && local.signature, 'Core comparison was not completed');
  assert.equal(local.baselineMatched, true, 'Core evidence did not bind the R01 comparison to the real published page');
  assert.equal(sha(candidate), local.previewSHA256, 'Candidate bytes changed after core tests');
  assert.deepEqual(local.framebuffer, q.framebuffer);
  if (process.env.SOURCE_SHA) assert.equal(process.env.SOURCE_SHA, local.sourceSHA, 'Source identity changed since core');
  let rawURL = process.env.CANDIDATE_RAW_URL || process.env.PUBLIC_RAW_URL;
  if (!rawURL) { const parsed = new URL(publicURL); rawURL = parsed.hostname === 'raw.githubusercontent.com' ? publicURL : parsed.hostname === 'htmlpreview.github.io' ? decodeURIComponent(parsed.search.slice(1)) : null; }
  assert(rawURL, 'Explicit raw URL is required for this public host');
  const match = rawURL.match(/^https:\/\/raw\.githubusercontent\.com\/haihao0307\/guilin-dem-pipeline\/([0-9a-f]{40})\/kaopu-unified-human-workbench\/lip-realism-r02\/preview\.html$/);
  assert(match, 'Public readback must identify an immutable R02 build commit');
  if (local.verifierSHA256 !== q.verifierSHA256) {
    assert.equal(MODE, 'public', 'Only public verification may reuse the pinned original core verifier');
    // One audited recovery only: the successful original core remains intact.
    // Its public attempt failed on own undefined light keys versus JSON-omitted
    // keys, before framebuffer/UI checks. No general old-verifier fallback.
    const fixed = {
      coreSHA256: '9bce2614509d18e394547297da7b00a89c20b93ee4a0c433da8644372300c769',
      sourceSHA: '01cfde47476b7be6764e9c6a79d925462511539b',
      buildSHA: 'ba0c4eb337e03997878aecaf477d8ec3fe8b7231',
      previewSHA256: 'ccc7af8e97969667bf63ab8bbc61e845d95e7b5e7f70adb167a662a63c0cb571',
      moduleSHA256: '692fba84f258990b1f7c80ab15d1c628b228821fce45d30f81dafba2e53aefe8',
      coreVerifierSHA256: '35be7f4e420427e69841755380bc0999ba949af288884e4357b16ffc6cb95503'
    };
    assert.equal(sha(coreBytes), fixed.coreSHA256, 'Public recovery core evidence bytes changed');
    assert.equal(local.sourceSHA, fixed.sourceSHA, 'Public recovery core source changed');
    assert.equal(local.verifierSHA256, fixed.coreVerifierSHA256, 'Public recovery core verifier changed');
    assert.equal(match[1], fixed.buildSHA, 'Public recovery build changed');
    assert.equal(local.previewSHA256, fixed.previewSHA256, 'Public recovery core preview changed');
    assert.equal(sha(candidate), fixed.previewSHA256, 'Public recovery candidate bytes changed');
    const manifest = JSON.parse(fs.readFileSync(path.join(path.dirname(candidatePath), 'BUILD_MANIFEST.json')));
    assert.equal(manifest.sourceCommit, fixed.sourceSHA, 'Public recovery manifest source changed');
    assert.equal(manifest.previewSHA256, fixed.previewSHA256, 'Public recovery manifest preview changed');
    assert.equal(manifest.moduleSHA256, fixed.moduleSHA256, 'Public recovery manifest module changed');
    assert.equal(sha(fs.readFileSync(path.join(path.dirname(candidatePath), 'LipSurface.js'))), fixed.moduleSHA256, 'Public recovery module bytes changed');
    assert(/^[0-9a-f]{40}$/.test(process.env.RECOVERY_SHA || ''), 'Public recovery requires its own explicit RECOVERY_SHA');
    q.coreVerifierCompatibility = {
      schema: 'kaopu/lip-public-verifier-recovery@1', ...fixed,
      publicVerifierSHA256: q.verifierSHA256, recoverySourceSHA: process.env.RECOVERY_SHA,
      originalCoreUnmodified: true,
      rendererRelation: 'This public-only recovery is a new CI run; exact pixel equality against the original core frames is still required.',
      reason: 'Only absent light ground/target properties are omitted to match the existing JSON evidence shape; real values remain strictly compared. Original core frames and evidence are reused unchanged; this run verifies the fixed public page.',
      priorPublicFailure: { runId: 39100909391, artifactID: 12127080792, qaSHA256: '6ded12f6184cd7922a9c064c40669b03da26a2d62b115cffcab48c388dc445a5', completed: false }
    };
    checkpoint();
  }
  q.publicURL = publicURL; q.publicRawURL = rawURL; q.publicBuildSHA = match[1]; q.previewSHA256 = local.previewSHA256;
  q.sourceSHA = local.sourceSHA; q.localEvidence = { path: localQAPath, sha256: sha(coreBytes), sourceSHA: local.sourceSHA, previewSHA256: local.previewSHA256 };
  await test('immutable public bytes exactly match the locally verified candidate', async () => {
    const response = await context.request.get(rawURL, { timeout: 90000 }), bytes = await response.body();
    assert.equal(response.status(), 200); assert.equal(sha(bytes), sha(candidate));
    return { url: rawURL, httpStatus: response.status(), bytes: bytes.length, sha256: sha(bytes), buildSHA: match[1] };
  });
  await stage('load fixed public candidate', () => load(publicURL));
  await selectVariant('r02', 0); await page.evaluate(() => lipRealism.ablation({ spatialColour: false })); await setView('front');
  const initial = await state();
  q.publicInitialState = initial; checkpoint();
  await test('public startup matches the retained measured person and R02 frame', async () => {
    assert.deepEqual(initial, local.signature.initialState, 'Public startup scene differs from core');
    const frame = await capture('public-r02-front'); assert.equal(frame.sha256, local.signature.front.sha256, 'Public renderer differs from the exact core frame');
    return { frame: small(frame), protectedSceneMatched: true };
  });
  await actualUI(initial, local.signature.comparisons, true); await viewportImage('public-ui');
  await mobileViewport();
  q.necessityEstablished = local.necessityEstablished; q.publicSmokePassed = true;
}

async function cleanupBrowser() {
  const errors = [], started = Date.now();
  const tabs = context?.pages() || [];
  q.cleanup = { startedAt: new Date().toISOString(), pageCount: tabs.length, pages: [], errors, completed: false };
  checkpoint();
  for (const [index, tab] of tabs.entries()) {
    const record = { index, url: tab.url(), alreadyClosed: tab.isClosed() }; q.cleanup.pages.push(record); checkpoint();
    if (record.alreadyClosed) continue;
    try {
      record.gpu = await stage('cleanup drain native GPU queue for page ' + index, () => bounded('cleanup GPU queue', () => tab.evaluate(() => {
        // Setters can submit several native renders without waiting for GPU
        // completion. Drain that existing work before asking Chromium to close.
        // No extra frame is drawn and no completed test is reclassified here.
        window.lifelikeIdle?.pause?.(); window.lipWorkbench?.stop?.();
        const viewer = window.__IDENTITY_QA__?.viewer?.(), renderer = viewer?.renderer;
        if (!renderer) return { available: false, reason: 'No native renderer was created on this page' };
        const gl = renderer.getContext(), start = performance.now(), submittedFrame = renderer.info.render.frame;
        const errorBefore = gl.getError(), contextLostBefore = gl.isContextLost();
        gl.finish();
        if (gl.drawingBufferWidth > 0 && gl.drawingBufferHeight > 0) gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
        return { available: true, errorBefore, errorAfter: gl.getError(), contextLostBefore, contextLostAfter: gl.isContextLost(), submittedFrame, frameAfterDrain: renderer.info.render.frame, drawingBuffer: [gl.drawingBufferWidth, gl.drawingBufferHeight], elapsedMS: performance.now() - start };
      }), 90000));
      if (record.gpu.available) {
        assert.equal(record.gpu.errorBefore, 0, 'Native GPU error before cleanup drain');
        assert.equal(record.gpu.errorAfter, 0, 'Native GPU error after cleanup drain');
        assert.equal(record.gpu.contextLostBefore, false, 'Native context was lost before cleanup');
        assert.equal(record.gpu.contextLostAfter, false, 'Native context was lost during cleanup');
      }
    } catch (error) { record.drainError = String(error); errors.push({ page: index, stage: 'GPU drain', error: String(error) }); checkpoint(); }
    try {
      await stage('cleanup close page ' + index, () => bounded('cleanup close page', () => tab.close({ runBeforeUnload: false }), 15000));
      record.closed = tab.isClosed(); assert.equal(record.closed, true, 'Native page remained open after close');
    } catch (error) { record.closeError = String(error); errors.push({ page: index, stage: 'page close', error: String(error) }); checkpoint(); }
  }
  try {
    if (browser) await stage('cleanup close browser after pages', () => bounded('close browser after pages', () => browser.close(), 15000));
    q.cleanup.browserDisconnected = !browser || !browser.isConnected();
    assert.equal(q.cleanup.browserDisconnected, true, 'Browser remained connected after cleanup');
  } catch (error) { errors.push({ stage: 'browser close', error: String(error) }); }
  q.cleanup.finishedAt = new Date().toISOString(); q.cleanup.elapsedMS = Date.now() - started;
  q.cleanup.completed = errors.length === 0; checkpoint();
  if (errors.length) throw Error('Bounded cleanup failed: ' + errors.map(item => item.stage + ': ' + item.error).join(' | '));
}

(async () => {
  fatalTimer = setTimeout(() => stopImmediately('Bounded QA deadline exceeded; latest completed stage and raw evidence retained', 124), budgetMS);
  try {
    progress('process', 'start', { mode: MODE, budgetMS });
    const options = { headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] };
    if (process.env.CHROMIUM_EXECUTABLE) options.executablePath = process.env.CHROMIUM_EXECUTABLE;
    browser = await chromium.launch(options); context = await browser.newContext({ viewport: q.browserViewport, deviceScaleFactor: 1 });
    if (MODE === 'public') await publicSmoke(); else await core();
    assert.equal(q.pageErrors.length, 0, 'Browser page exceptions'); assert.equal(q.consoleErrors.length, 0, 'Browser console errors');
    assert.equal(q.failedRequests.length, 0, 'Resource request failures'); assert.equal(q.resourceErrors.length, 0, 'Resource HTTP failures');
    q.browserPassed = true; q.completed = true;
    if (MODE === 'public') { q.publicHttpsPassed = true; q.shareAllowed = true; }
  } catch (error) { q.failure = String(error); q.stack = error.stack; q.completed = false; q.shareAllowed = false; process.exitCode = 1; console.error(error); }
  finally {
    q.verificationFinishedAt = new Date().toISOString(); writeJSON('qa.json', q); checkpoint();
    try { await cleanupBrowser(); }
    catch (error) { q.cleanupError = String(error); q.completed = false; q.shareAllowed = false; process.exitCode = 1; }
    if (server) { server.closeAllConnections?.(); server.close(); }
    clearTimeout(fatalTimer); q.finishedAt = new Date().toISOString(); writeJSON('qa.json', q);
    if (MODE === 'public') writeJSON('PUBLICATION_PROOF.json', { version: VERSION, sourceSHA: q.sourceSHA, buildSHA: q.publicBuildSHA, publicURL: q.publicURL, sourceModified: q.sourceModified, interactive3D: q.interactive3D, staticImageSubstitute: false, publicHttpsPassed: q.completed && q.publicHttpsPassed, browserPassed: q.completed && q.browserPassed, shareAllowed: q.completed && q.shareAllowed, visualAcceptance: false, productionReady: false, checkedAt: q.finishedAt, evidence: 'qa.json', failure: q.failure || q.cleanupError || null });
    console.log(JSON.stringify({ mode: MODE, completed: q.completed, tests: q.tests.length, necessityEstablished: q.necessityEstablished, shareAllowed: q.shareAllowed, output: out, failure: q.failure || q.cleanupError || null }));
    if (q.cleanupError) process.exit(1);
  }
})();
