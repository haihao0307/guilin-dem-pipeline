'use strict';
/* Independent checks for the bounded legacy-wetness ownership change.
 * This verifier never edits the reference or compiles product sources.
 * Pixel tests observe the real WebGL framebuffer, not candidate report flags.
 */
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { PNG } = require('pngjs');

const root = path.resolve(__dirname, '..');
const requestedMode = process.env.WETNESS_AUDIT_MODE || process.env.MODE || 'baseline';
assert(['baseline', 'candidate', 'all', 'public'].includes(requestedMode));
const mode = requestedMode === 'baseline' ? 'baseline' : 'candidate';
const baselinePath = process.env.WETNESS_BASELINE_FILE || process.env.BASELINE_PATH || path.join(root, 'reference/kaopu-unified-human-workbench/human-integrated-r07/preview.html');
const candidatePath = process.env.WETNESS_CANDIDATE_FILE || process.env.CANDIDATE_PATH || path.join(root, 'candidate/preview.html');
const publicURL = requestedMode === 'public' ? process.env.CANDIDATE_URL || process.env.PUBLIC_URL : null;
if (requestedMode === 'public') assert(publicURL && /^https:\/\//.test(publicURL), 'Public mode requires an exact HTTPS candidate URL');
const localQAPath = process.env.LOCAL_QA_PATH;
if (requestedMode === 'public') assert(localQAPath, 'Public smoke requires the completed same-runner LOCAL_QA_PATH');
const output = process.env.WETNESS_AUDIT_OUT || process.env.QA_OUT || path.join(root, 'evidence', requestedMode);
const sourceHash = 'd1bd7940b885cb872143bc0e68ce85fd2f663c81be36a18e58fc6086781cf31a';
const width = 640, height = 512;
const keys = ['upperWetness', 'lowerWetness'];
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
assert(['baseline', 'candidate'].includes(mode));
fs.mkdirSync(output, { recursive: true });
const report = {
  schema: 'kaopu/independent-lip-wetness-audit@1', mode: requestedMode,
  startedAt: new Date().toISOString(), tests: [], pageErrors: [], consoleErrors: [], requestFailures: [],
  baselineSHA256: sourceHash, verifierSHA256: hash(fs.readFileSync(__filename)),
  sourceSHA: process.env.SOURCE_SHA || process.env.GITHUB_SHA || null,
  framebuffer: { width, height, pixelRatio: 1 }, completed: false,
  necessityEstablished: false, softwareRenderer: true, physicalPhone: false,
  visualImprovementClaimed: false, upperLowerCapabilityRestored: false,
  limits: 'Frozen R07 default person; two legacy wetness DNA controls; same-machine rendering. This check does not certify photorealism or all-person behavior.'
};
let browser, server;
const save = () => fs.writeFileSync(path.join(output, 'qa.json'), JSON.stringify(report, null, 2) + '\n');
const brief = frame => ({ sha256: frame.sha256, width, height });
async function test(name, operation) {
  console.log('START ' + name);
  try { const result = await operation(); report.tests.push({ name, passed: true, result }); save(); console.log('PASS ' + name); return result; }
  catch (error) { report.tests.push({ name, passed: false, error: String(error), stack: error.stack }); save(); throw error; }
}

async function createServer() {
  const baseline = fs.readFileSync(baselinePath);
  assert.equal(hash(baseline), sourceHash, 'The frozen R07 input changed');
  const routes = new Map([['/baseline.html', baseline]]);
  if (mode === 'candidate') {
    const candidate = fs.readFileSync(candidatePath);
    assert.notEqual(hash(candidate), sourceHash, 'A copied baseline is not a guard candidate');
    report.candidateSHA256 = hash(candidate); routes.set('/candidate.html', candidate);
  }
  server = http.createServer((req, res) => {
    const pathname = new URL(req.url, 'http://127.0.0.1').pathname;
    if (pathname === '/favicon.ico') { res.writeHead(204).end(); return; }
    const body = routes.get(pathname);
    if (!body) { res.writeHead(404).end('Unknown audit route'); return; }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }); res.end(body);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return 'http://127.0.0.1:' + server.address().port;
}

async function loadPage(context, url, label) {
  const page = await context.newPage(); page.setDefaultTimeout(30000);
  page.on('pageerror', error => report.pageErrors.push({ label, error: String(error) }));
  page.on('console', message => { if (message.type() === 'error' && !/favicon/i.test(message.text())) report.consoleErrors.push({ label, error: message.text() }); });
  page.on('requestfailed', request => { if (!/favicon/i.test(request.url())) report.requestFailures.push({ label, url: request.url(), error: request.failure()?.errorText }); });
  const started = Date.now(); const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
  assert.equal(response.status(), 200);
  await page.waitForFunction(() => window.__HEAD_PROC__?.ready || window.__HEAD_PROC__?.errors?.length, null, { timeout: 300000 });
  await page.waitForFunction(() => window.__R05_PRESET_READY__ === true && typeof window.lipWorkbench?.setDNA === 'function', null, { timeout: 180000 });
  const host = await page.evaluate(() => {
    const viewer = __IDENTITY_QA__.viewer();
    window.lifelikeIdle?.pause?.(); window.lipWorkbench.stop?.();
    viewer.orbit.autoRotate = false; viewer.orbit.enableDamping = false;
    return { ready: __HEAD_PROC__.ready, errors: __HEAD_PROC__.errors, finalFrame: viewer.startupFinalFrame };
  });
  assert(host.ready && host.finalFrame, 'The original complete person did not finish loading');
  assert.equal(host.errors?.length || 0, 0);
  if (label === 'candidate') {
    await page.waitForFunction(() => window.lipControlContract?.ready === true, null, { timeout: 90000 });
    assert.equal(await page.evaluate(() => lipControlContract.version), 'LIP-CONTROL-CONTRACT-R01');
  }
  await fixedView(page); report[label] = { url, loadMS: Date.now() - started, host }; save();
  return page;
}

async function fixedView(page) {
  await page.evaluate(({ width, height }) => {
    const viewer = __IDENTITY_QA__.viewer();
    viewer.renderer.setPixelRatio(1); viewer.renderer.setSize(width, height, false);
    lipWorkbench.view('macro');
    viewer.camera.aspect = width / height; viewer.camera.updateProjectionMatrix();
    viewer.orbit.update(); viewer.render();
  }, { width, height });
}

async function frame(page, name) {
  const result = await page.evaluate(({ width, height }) => {
    const viewer = __IDENTITY_QA__.viewer();
    viewer.renderer.setPixelRatio(1); viewer.renderer.setSize(width, height, false);
    viewer.camera.aspect = width / height; viewer.camera.updateProjectionMatrix();
    viewer.render(); const gl = viewer.renderer.getContext(); gl.finish();
    const pixels = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    let binary = ''; for (let i = 0; i < pixels.length; i += 16384) binary += String.fromCharCode(...pixels.subarray(i, i + 16384));
    return { pixels: btoa(binary), error: gl.getError(), width: gl.drawingBufferWidth, height: gl.drawingBufferHeight };
  }, { width, height });
  assert.equal(result.error, 0); assert.equal(result.width, width); assert.equal(result.height, height);
  const pixels = Buffer.from(result.pixels, 'base64');
  let varied = 0; for (let i = 4; i < pixels.length; i += 4) if (pixels[i] !== pixels[0] || pixels[i + 1] !== pixels[1] || pixels[i + 2] !== pixels[2]) varied++;
  assert(varied > width * height / 100, 'Uniform or blank framebuffer cannot establish a control no-op');
  const resultFrame = { pixels, sha256: hash(pixels), varied };
  if (name) {
    const png = new PNG({ width, height });
    for (let y = 0; y < height; y++) pixels.copy(png.data, y * width * 4, (height - 1 - y) * width * 4, (height - y) * width * 4);
    fs.writeFileSync(path.join(output, name + '.png'), PNG.sync.write(png));
  }
  return resultFrame;
}

async function state(page) {
  return page.evaluate(async () => {
    const viewer = __IDENTITY_QA__.viewer(), model = __IDENTITY_QA__.model(), geometry = viewer.geometry;
    const digest = async array => array ? Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(array.buffer, array.byteOffset, array.byteLength))), v => v.toString(16).padStart(2, '0')).join('') : null;
    const attributes = {};
    for (const key of ['position', 'normal', 'fRest', 'csRest', 'skinIndex', 'skinWeight']) attributes[key] = await digest(geometry.attributes[key]?.array);
    const lights = []; viewer.scene.updateMatrixWorld(true);
    viewer.scene.traverse(object => { if (object.isLight) lights.push({ type: object.type, color: object.color.toArray(), intensity: object.intensity, matrix: object.matrixWorld.toArray(), visible: object.visible }); });
    return {
      dna: lipWorkbench.dna(), lipSettings: lipWorkbench.settings(), pose: lipWorkbench.pose(),
      head: headProceduralSkin.settings(), body: bodyProceduralSkin.settings(),
      geometry: { attributes, index: await digest(geometry.index?.array), canonicalPositions: await digest(model.positions), canonicalFaces: await digest(model.faces) },
      lighting: { lights, exposure: viewer.renderer.toneMappingExposure, toneMapping: viewer.renderer.toneMapping },
      camera: { position: viewer.camera.position.toArray(), quaternion: viewer.camera.quaternion.toArray(), projection: viewer.camera.projectionMatrix.toArray(), target: viewer.orbit.target.toArray() }
    };
  });
}

async function mouthROI(page) {
  return page.evaluate(({ width, height }) => {
    const viewer = __IDENTITY_QA__.viewer(), model = __IDENTITY_QA__.model(), geometry = viewer.geometry;
    const rest = geometry.attributes.fRest, type = geometry.attributes.csType, pos = geometry.attributes.position;
    const rails = model.lipStructure.rails, vector = viewer.camera.position.clone();
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, count = 0;
    viewer.scene.updateMatrixWorld(true);
    for (let i = 0; i < rest.count; i++) {
      if (!rails.sample([rest.getX(i), rest.getY(i), rest.getZ(i)], type.getX(i)).roi) continue;
      vector.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(viewer.mesh.matrixWorld).project(viewer.camera);
      if (vector.z < -1 || vector.z > 1) continue;
      const x = (vector.x + 1) * width / 2, y = (vector.y + 1) * height / 2;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); count++;
    }
    if (!count) throw Error('No independently located native mouth vertices');
    return { minX: Math.max(0, Math.floor(minX) - 6), maxX: Math.min(width - 1, Math.ceil(maxX) + 6), minY: Math.max(0, Math.floor(minY) - 6), maxY: Math.min(height - 1, Math.ceil(maxY) + 6), vertexCount: count, source: 'native LipRails ROI; final projected geometry; lower-left framebuffer coordinates' };
  }, { width, height });
}

function delta(before, after, roi) {
  const result = { changedInside: 0, changedOutside: 0, maximumInside: 0, maximumOutside: 0, absoluteInside: 0 };
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const index = (y * width + x) * 4;
    const difference = Math.max(...[0, 1, 2].map(c => Math.abs(before.pixels[index + c] - after.pixels[index + c])));
    const inside = x >= roi.minX && x <= roi.maxX && y >= roi.minY && y <= roi.maxY;
    if (inside) { result.maximumInside = Math.max(result.maximumInside, difference); result.absoluteInside += difference; if (difference) result.changedInside++; }
    else { result.maximumOutside = Math.max(result.maximumOutside, difference); if (difference) result.changedOutside++; }
  }
  return result;
}

function requireMouthResponse(before, after, roi) {
  const difference = delta(before, after, roi);
  assert(difference.changedInside > 10, 'Wetness did not affect the independent mouth ROI');
  return difference;
}

function requireExactForwarding(reference, low, high, roi) {
  const difference = requireMouthResponse(low, high, roi);
  if (reference.difference.changedOutside === 0) {
    assert.equal(difference.changedOutside, 0, 'Current entry added a response outside the mouth ROI');
  } else {
    assert.deepEqual(difference, reference.difference, 'Current entry expanded or changed the inherited direct psWet footprint');
  }
  assert.equal(low.sha256, reference.low.sha256, 'Current entry low value differs from exact direct psWet output');
  assert.equal(high.sha256, reference.high.sha256, 'Current entry high value differs from exact direct psWet output');
  return { difference, protection: reference.difference.changedOutside === 0 ? 'exact-zero-outside-mouth' : 'exact-original-direct-psWet-frames-and-footprint', inheritedOutsidePixels: reference.difference.changedOutside };
}

function syntheticOutsideChange(frame, roi, wholeOutside = false) {
  const pixels = Buffer.from(frame.pixels);
  let changes = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (x >= roi.minX && x <= roi.maxX && y >= roi.minY && y <= roi.maxY) continue;
    const index = (y * width + x) * 4;
    pixels[index] = pixels[index] === 255 ? 254 : pixels[index] + 1;
    changes++;
    if (!wholeOutside) return { pixels, sha256: hash(pixels), injectedOutsidePixels: changes };
  }
  assert(changes > 0, 'The independent ROI leaves no outside region to protect');
  return { pixels, sha256: hash(pixels), injectedOutsidePixels: changes };
}

async function surfaceMode(page, enabled) {
  await page.evaluate(enabled => { lipWorkbench.stop?.(); lipWorkbench.inspect(0); headProceduralSkin.set({ enabled, diagnostic: 0 }); __IDENTITY_QA__.viewer().render(); }, enabled);
  await fixedView(page);
  const selection = await page.evaluate(() => { const viewer = __IDENTITY_QA__.viewer(); viewer.render(); const materials = Array.isArray(viewer.mesh.material) ? viewer.mesh.material : [viewer.mesh.material]; return { programEnabled: headProceduralSkin.settings().enabled, selectedNames: materials.map(material => material.name), usesProceduralMaterial: materials.includes(headProceduralSkin.material()), gray: __IDENTITY_QA__.model().foldProfile?.settings?.gray || false }; });
  assert.equal(selection.usesProceduralMaterial, enabled, 'Requested mode is not the material actually used for rendering');
  return selection;
}

async function restoreInitial(page, initial) {
  await surfaceMode(page, false);
  await page.evaluate(initial => { lipWorkbench.setDNA(initial.dna); lipWorkbench.set(initial.lipSettings); lipWorkbench.setPose(initial.pose); headProceduralSkin.set(initial.head); bodyProceduralSkin.set(initial.body); lipWorkbench.inspect(0); }, initial);
  await fixedView(page);
}

async function exposeLegacyControls(page, key = 'upperWetness') {
  const nativeToggle = page.locator('#hc-native-toggle');
  if (await nativeToggle.count() && await nativeToggle.isVisible()) {
    const entries = page.locator('#workbench-entries');
    if (await entries.count() && await entries.isHidden()) await nativeToggle.click();
  }
  await page.evaluate(() => lipWorkbench.open());
  const input = page.locator(key === 'wetness' ? 'input[data-lip-key="wetness"]' : 'input[data-l19-kind="dna"][data-l19-key="' + key + '"]');
  assert.equal(await input.count(), 1, 'The exact original wetness control must remain discoverable: ' + key);
  const ancestors = input.locator('xpath=ancestor::details');
  for (let i = 0; i < await ancestors.count(); i++) {
    const details = ancestors.nth(i); if (!(await details.getAttribute('open') !== null)) await details.locator(':scope > summary').click();
  }
  await fixedView(page); return input;
}

async function changeThroughUI(page, key, end) {
  const input = page.locator('input[data-l19-kind="dna"][data-l19-key="' + key + '"]');
  await input.scrollIntoViewIfNeeded(); await input.focus(); await input.press(end ? 'End' : 'Home');
  const desired = Number(await input.getAttribute(end ? 'max' : 'min'));
  await page.waitForFunction(({ key, desired }) => lipWorkbench.dna()[key] === desired, { key, desired });
  await fixedView(page); return desired;
}

async function baselineChecks(page) {
  await surfaceMode(page, true); const initial = await state(page); const initialFrame = await frame(page, 'baseline-initial');
  const roi = await mouthROI(page); report.roi = roi;
  report.initialFramebufferSHA256 = initialFrame.sha256;
  report.initialState = initial;
  let directWetness;
  await test('stable renderer and original wetness API are observable', async () => {
    assert.equal((await frame(page)).sha256, initialFrame.sha256, 'Repeating an unchanged state changes pixels');
    assert.deepEqual((await state(page)).geometry, initial.geometry);
    return { initial: brief(initialFrame), state: initial };
  });
  await test('direct current psWet establishes the exact allowed rendering footprint', async () => {
    await page.evaluate(() => headProceduralSkin.set({ diagnostic: 0, lipWetness: 0 }));
    const low = await frame(page, 'baseline-direct-current-low');
    await page.evaluate(() => headProceduralSkin.set({ lipWetness: 1 }));
    const high = await frame(page, 'baseline-direct-current-high');
    const difference = requireMouthResponse(low, high, roi);
    directWetness = { low, high, difference };
    report.baselineDirectWetness = { low: brief(low), high: brief(high), difference, scope: difference.changedOutside === 0 ? 'zero-outside-mouth' : 'observed-inherited-psWet-footprint-not-relaxed' };
    await page.evaluate(initial => headProceduralSkin.set(initial.head), initial);
    assert.equal((await frame(page)).sha256, initialFrame.sha256);
    return report.baselineDirectWetness;
  });
  await test('negative controls reject wholeFrameOnly and an added outside-mouth tint', async () => {
    const wholeFrameOnly = syntheticOutsideChange(directWetness.low, roi, true);
    const outsideOnlyDifference = delta(directWetness.low, wholeFrameOnly, roi);
    assert.equal(outsideOnlyDifference.changedInside, 0); assert(outsideOnlyDifference.changedOutside > 0);
    assert.throws(() => requireMouthResponse(directWetness.low, wholeFrameOnly, roi), /mouth ROI/);
    const lipsPlusOutside = syntheticOutsideChange(directWetness.high, roi);
    assert.throws(() => requireExactForwarding(directWetness, directWetness.low, lipsPlusOutside, roi), /outside|footprint|exact direct psWet/);
    return { wholeFrameOnly: { rejected: true, difference: outsideOnlyDifference }, lipsPlusOutside: { rejected: true, injectedOutsidePixels: lipsPlusOutside.injectedOutsidePixels } };
  });
  await test('R07 accepts each legacy wetness value but its mouth pixels do not respond', async () => {
    const results = [];
    for (const key of keys) {
      await page.evaluate(key => lipWorkbench.setDNA({ [key]: 0 }), key); const lowState = await state(page), low = await frame(page);
      await page.evaluate(key => lipWorkbench.setDNA({ [key]: 1 }), key); const highState = await state(page), high = await frame(page, 'baseline-inactive-' + key);
      assert.equal(lowState.dna[key], 0); assert.equal(highState.dna[key], 1);
      const difference = delta(low, high, roi); assert.equal(difference.changedInside, 0, 'Necessity was disproved: the supposedly inactive control DOES affect lips');
      assert.equal(difference.changedOutside, 0); assert.deepEqual(lowState.geometry, highState.geometry);
      assert.deepEqual(lowState.lighting, highState.lighting); assert.deepEqual(lowState.camera, highState.camera);
      results.push({ key, low: brief(low), high: brief(high), difference });
      await page.evaluate(initial => lipWorkbench.setDNA(initial.dna), initial);
    }
    return results;
  });
  await test('R07 also accepts the original aggregate wetness field without a rendered response', async () => {
    await page.evaluate(() => lipWorkbench.set({ wetness: 0 })); const lowState = await state(page), low = await frame(page);
    await page.evaluate(() => lipWorkbench.set({ wetness: 1 })); const highState = await state(page), high = await frame(page);
    assert.equal(lowState.lipSettings.wetness, 0); assert.equal(highState.lipSettings.wetness, 1);
    const difference = delta(low, high, roi); assert.equal(difference.changedInside, 0); assert.equal(difference.changedOutside, 0);
    assert.deepEqual(lowState.geometry, highState.geometry);
    await page.evaluate(initial => lipWorkbench.set(initial.lipSettings), initial); return { difference, low: brief(low), high: brief(high) };
  });
  await test('original visible UI also silently accepts wetness in R07', async () => {
    await exposeLegacyControls(page);
    await page.evaluate(() => { window.__INDEPENDENT_WETNESS_EVENTS__ = []; document.addEventListener('input', event => { if (event.target.dataset?.l19Key === 'upperWetness') window.__INDEPENDENT_WETNESS_EVENTS__.push({ trusted: event.isTrusted, value: event.target.value }); }, true); });
    await changeThroughUI(page, 'upperWetness', false); const low = await frame(page);
    await changeThroughUI(page, 'upperWetness', true); const high = await frame(page, 'baseline-native-ui-no-effect');
    const events = await page.evaluate(() => window.__INDEPENDENT_WETNESS_EVENTS__);
    assert(events.length >= 2 && events.every(event => event.trusted));
    const difference = delta(low, high, roi); assert.equal(difference.changedInside, 0); assert.equal(difference.changedOutside, 0);
    return { events, difference };
  });
  await test('positive control: the same legacy wetness keys work on the original material', async () => {
    const selected = await surfaceMode(page, false); const results = [];
    for (const key of keys) {
      await page.evaluate(({ initial, key }) => lipWorkbench.setDNA({ ...initial.dna, [key]: 0 }), { initial, key });
      const lowState = await state(page), low = await frame(page);
      await page.evaluate(key => lipWorkbench.setDNA({ [key]: 1 }), key); const highState = await state(page), high = await frame(page, 'baseline-native-active-' + key);
      const difference = delta(low, high, roi); assert(difference.changedInside > 10 && difference.maximumInside > 0, 'The positive control failed; do not infer a dead parameter from a blind probe');
      assert.deepEqual(lowState.geometry, highState.geometry); results.push({ key, difference, low: brief(low), high: brief(high) });
    }
    return { selected, results };
  });
  await restoreInitial(page, initial);
  assert.equal((await frame(page)).sha256, initialFrame.sha256, 'Baseline restoration changed its original image');
  report.necessityEstablished = true; save(); return { initial, initialFrame, roi, directWetness };
}

// Candidate tests use unchanged public model APIs and real DOM state. A product
// report may be recorded as supplementary evidence after its API is finalized.
async function candidateChecks(page, baseline) {
  await surfaceMode(page, true); const initial = await state(page);
  await test('guard installation leaves the original person, parameters, geometry, lighting and image unchanged', async () => {
    assert.deepEqual(initial, baseline.initial);
    const current = await frame(page, 'candidate-initial'); assert.equal(current.sha256, baseline.initialFrame.sha256);
    return { before: brief(baseline.initialFrame), after: brief(current) };
  });
  await test('unsupported changes are rejected before any part of a mixed patch mutates', async () => {
    const before = await state(page), beforeFrame = await frame(page); const results = [];
    for (const key of keys) {
      const result = await page.evaluate(key => {
        const dna = lipWorkbench.dna(); let error = null;
        try { lipWorkbench.setDNA({ [key]: dna[key] === 1 ? 0 : 1, tissueDepth: dna.tissueDepth < 1.4 ? dna.tissueDepth + .05 : dna.tissueDepth - .05 }); }
        catch (caught) { error = { name: caught.name, message: caught.message, code: caught.code || null }; }
        return { error, observed: lipWorkbench.dna() };
      }, key);
      assert(result.error, 'Unsupported ' + key + ' was silently accepted');
      assert.equal(result.error.code, 'LIP_CONTROL_INACTIVE');
      assert(result.error.message.includes(key), 'Rejection must identify the exact unsupported key');
      assert.deepEqual(await state(page), before, 'Rejected mixed patch was not atomic');
      assert.equal((await frame(page)).sha256, beforeFrame.sha256); results.push({ key, ...result });
    }
    const aggregate = await page.evaluate(() => {
      const old = lipWorkbench.settings(); let error = null;
      try { lipWorkbench.set({ wetness: old.wetness === 1 ? 0 : 1, upperVolume: old.upperVolume < 1.4 ? old.upperVolume + .05 : old.upperVolume - .05 }); }
      catch (caught) { error = { name: caught.name, message: caught.message, code: caught.code || null }; }
      return { error, observed: lipWorkbench.settings() };
    });
    assert.equal(aggregate.error?.code, 'LIP_CONTROL_INACTIVE'); assert(aggregate.error.message.includes('wetness'));
    assert.deepEqual(await state(page), before, 'Rejected aggregate wetness patch was not atomic');
    assert.equal((await frame(page)).sha256, beforeFrame.sha256);
    const noChange = await page.evaluate(() => { const dna = lipWorkbench.dna(); try { lipWorkbench.setDNA({ ...dna }); lipWorkbench.set({ ...lipWorkbench.settings() }); return { accepted: true }; } catch (error) { return { accepted: false, error: error.message }; } });
    assert(noChange.accepted, 'Unchanged legacy fields in a full-state patch must not cause false rejection');
    assert.deepEqual(await state(page), before); return { results, aggregate, noChange };
  });
  await test('inactive old sliders are disabled and their authored values remain intact', async () => {
    await exposeLegacyControls(page); const before = await state(page); const observed = [];
    for (const key of keys) {
      const input = page.locator('input[data-l19-kind="dna"][data-l19-key="' + key + '"]');
      assert(await input.isDisabled(), 'Inactive ' + key + ' remains interactively misleading');
      assert.equal(Number(await input.inputValue()), before.dna[key]);
      observed.push({ key, disabled: true, value: await input.inputValue(), title: await input.getAttribute('title'), describedBy: await input.getAttribute('aria-describedby') });
    }
    await exposeLegacyControls(page, 'wetness');
    const aggregate = page.locator('input[data-lip-key="wetness"]');
    assert(await aggregate.isDisabled()); assert.equal(Number(await aggregate.inputValue()), before.lipSettings.wetness);
    const notes = await page.locator('[data-lcc-note]').allTextContents();
    assert(notes.some(text => text.trim().length > 0), 'A disabled slider without an explanation only hides the problem');
    const current = page.locator('[data-lcc-current-wetness]'); assert.equal(await current.count(), 1);
    assert(await current.isVisible(), 'The actually supported current wetness entry is not visible');
    return { observed, aggregate: { disabled: true, value: await aggregate.inputValue() }, notes };
  });
  await test('the current wetness entry changes beauty pixels without changing old DNA or geometry', async () => {
    await page.evaluate(() => { headProceduralSkin.set({ diagnostic: 0 }); lipControlContract.setCurrentWetness(0); });
    const lowState = await state(page), low = await frame(page);
    await page.evaluate(() => lipControlContract.setCurrentWetness(1));
    const highState = await state(page), high = await frame(page, 'candidate-current-wetness-response');
    assert.equal(lowState.head.lipWetness, 0); assert.equal(highState.head.lipWetness, 1);
    const forwarding = requireExactForwarding(baseline.directWetness, low, high, baseline.roi);
    const difference = forwarding.difference;
    assert.deepEqual(lowState.geometry, highState.geometry); assert.deepEqual(lowState.dna, highState.dna);
    const lowHead = { ...lowState.head }, highHead = { ...highState.head };
    delete lowHead.lipWetness; delete highHead.lipWetness;
    assert.deepEqual(lowHead, highHead, 'Current wetness delegation silently recalibrated another skin control');
    assert.deepEqual(lowState.body, highState.body); assert.deepEqual(lowState.lipSettings, highState.lipSettings); assert.deepEqual(lowState.pose, highState.pose);
    assert.deepEqual(lowState.lighting, highState.lighting); assert.deepEqual(lowState.camera, highState.camera);
    const input = page.locator('[data-lcc-current-wetness]');
    await input.scrollIntoViewIfNeeded(); await input.focus(); await input.press('Home');
    await page.waitForFunction(() => headProceduralSkin.settings().lipWetness === 0);
    const uiLow = await frame(page); await input.press('End');
    await page.waitForFunction(() => headProceduralSkin.settings().lipWetness === 1);
    const uiHigh = await frame(page); const uiForwarding = requireExactForwarding(baseline.directWetness, uiLow, uiHigh, baseline.roi);
    await page.evaluate(initial => headProceduralSkin.set(initial.head), initial); return { forwarding, uiForwarding, low: brief(low), high: brief(high) };
  });
  await test('real controller archive and restore preserve all three legacy values and active psWet', async () => {
    await page.evaluate(async () => {
      const controller = __IDENTITY_QA__.controller();
      window.__INDEPENDENT_ORIGINAL_ARCHIVE__ = structuredClone(await controller.archive());
    });
    await surfaceMode(page, false);
    await page.evaluate(() => {
      lipWorkbench.set({ wetness: .24 });
      lipWorkbench.setDNA({ upperWetness: .22, lowerWetness: .73 });
      headProceduralSkin.set({ lipWetness: .61 });
    });
    await surfaceMode(page, true);
    const savedState = await state(page), savedFrame = await frame(page);
    const archiveProof = await page.evaluate(async () => {
      const controller = __IDENTITY_QA__.controller();
      window.__INDEPENDENT_SAVED_ARCHIVE__ = structuredClone(await controller.archive());
      const encoded = new TextEncoder().encode(JSON.stringify(window.__INDEPENDENT_SAVED_ARCHIVE__));
      const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', encoded)), v => v.toString(16).padStart(2, '0')).join('');
      return { sha256: digest, bytes: encoded.byteLength, entry: '__IDENTITY_QA__.controller().archive()' };
    });
    await surfaceMode(page, false);
    await page.evaluate(() => {
      lipWorkbench.set({ wetness: .81 });
      lipWorkbench.setDNA({ upperWetness: .86, lowerWetness: .17 });
      headProceduralSkin.set({ lipWetness: .16 });
    });
    await surfaceMode(page, true);
    const altered = await state(page);
    assert.notEqual(altered.dna.upperWetness, savedState.dna.upperWetness);
    assert.notEqual(altered.dna.lowerWetness, savedState.dna.lowerWetness);
    assert.notEqual(altered.lipSettings.wetness, savedState.lipSettings.wetness);
    assert.notEqual(altered.head.lipWetness, savedState.head.lipWetness);
    // Restore through the full controller while R07 is selected. This must
    // preserve archived inactive values without treating them as live edits.
    await page.evaluate(async () => {
      await __IDENTITY_QA__.controller().restore(structuredClone(window.__INDEPENDENT_SAVED_ARCHIVE__));
      window.lifelikeIdle?.pause?.(); lipWorkbench.stop?.();
    });
    await fixedView(page);
    const restored = await state(page), restoredFrame = await frame(page, 'candidate-archive-restored');
    assert.equal(restored.lipSettings.wetness, .24); assert.equal(restored.dna.upperWetness, .22);
    assert.equal(restored.dna.lowerWetness, .73); assert.equal(restored.head.lipWetness, .61);
    assert.deepEqual(restored, savedState, 'Full archive restoration changed other original person state');
    assert.equal(restoredFrame.sha256, savedFrame.sha256, 'Restored archived person has a different image');
    await page.evaluate(async () => {
      await __IDENTITY_QA__.controller().restore(structuredClone(window.__INDEPENDENT_ORIGINAL_ARCHIVE__));
      window.lifelikeIdle?.pause?.(); lipWorkbench.stop?.();
      delete window.__INDEPENDENT_SAVED_ARCHIVE__; delete window.__INDEPENDENT_ORIGINAL_ARCHIVE__;
    });
    await fixedView(page); assert.deepEqual(await state(page), initial);
    assert.equal((await frame(page)).sha256, baseline.initialFrame.sha256);
    return { archiveProof, restoredValues: { wetness: restored.lipSettings.wetness, upperWetness: restored.dna.upperWetness, lowerWetness: restored.dna.lowerWetness, currentWetness: restored.head.lipWetness }, before: brief(savedFrame), after: brief(restoredFrame), entry: 'await __IDENTITY_QA__.controller().restore(savedArchive)' };
  });
  await test('rejected presets and public reset preserve debug and the first original recipe undo', async () => {
    await page.evaluate(async () => {
      window.__INDEPENDENT_UNDO_ARCHIVE__ = structuredClone(await __IDENTITY_QA__.controller().archive());
      window.__INDEPENDENT_UNDO_DEBUG__ = __IDENTITY_QA__.model().lipStructure.debug;
    });
    await surfaceMode(page, false); await exposeLegacyControls(page, 'wetness');
    const beforeEdit = await state(page);
    const edited = await page.evaluate(() => {
      const previous = lipWorkbench.settings();
      const patch = { upperVolume: previous.upperVolume < 1 ? 1.17 : .53, wetness: .67 };
      lipWorkbench.set(patch); // One actual user edit establishes the last undo entry.
      return patch;
    });
    const afterEdit = await state(page);
    assert.equal(afterEdit.lipSettings.upperVolume, edited.upperVolume);
    assert.equal(afterEdit.lipSettings.wetness, edited.wetness);
    assert.notEqual(afterEdit.geometry.attributes.position, beforeEdit.geometry.attributes.position, 'The history fixture did not make a real geometry edit');
    await surfaceMode(page, true);
    const currentWetness = .59, debugSentinel = 4;
    await page.evaluate(({ currentWetness, debugSentinel }) => {
      lipControlContract.setCurrentWetness(currentWetness);
      // Old ET19 debug is inactive in R07's beauty shader. A nonzero sentinel
      // exposes the dry preset's premature inspect(0) side effect.
      lipWorkbench.inspect(debugSentinel);
    }, { currentWetness, debugSentinel });
    await page.waitForFunction(() => ['dry', 'reset'].every(action => document.querySelector('[data-lip-action="' + action + '"]')?.disabled));
    const blockedState = await state(page), blockedFrame = await frame(page);
    assert.equal(blockedState.head.diagnostic, 0, 'This check must keep the final R07 shader in beauty mode');
    assert.equal(await page.evaluate(() => __IDENTITY_QA__.model().lipStructure.debug), debugSentinel);
    const rejected = [];
    async function assertUntouched(entry) {
      assert.deepEqual(await state(page), blockedState, entry + ' mutated person state');
      assert.equal(await page.evaluate(() => __IDENTITY_QA__.model().lipStructure.debug), debugSentinel, entry + ' changed old inspection state');
      assert.equal((await frame(page)).sha256, blockedFrame.sha256, entry + ' changed the displayed person');
      rejected.push(entry);
    }
    for (const action of ['dry', 'reset']) {
      const button = page.locator('[data-lip-action="' + action + '"]');
      assert(await button.isDisabled()); await button.scrollIntoViewIfNeeded();
      const box = await button.boundingBox(); assert(box, 'Disabled preset must remain visible');
      // A trusted pointer click tests the disabled affordance; dispatchEvent
      // separately reaches the delegated legacy handler despite disabled UI.
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await assertUntouched('trusted disabled ' + action + ' click');
      await button.dispatchEvent('click', { bubbles: true, cancelable: true });
      await assertUntouched('synthetic disabled ' + action + ' click');
    }
    const resetError = await page.evaluate(() => {
      try { lipWorkbench.reset(); return null; }
      catch (error) { return { code: error.code, message: error.message }; }
    });
    assert.equal(resetError?.code, 'LIP_CONTROL_INACTIVE');
    await assertUntouched('public lipWorkbench.reset()');
    const undo = page.locator('[data-lip-action="undo"]');
    assert(!(await undo.isDisabled())); assert.match(await undo.innerText(), /原唇部配方/);
    await undo.click(); // Exactly one click: rejected calls must not add history.
    await page.waitForFunction(previous => {
      const current = lipWorkbench.settings();
      return current.upperVolume === previous.upperVolume && current.wetness === previous.wetness;
    }, beforeEdit.lipSettings);
    await fixedView(page); const restored = await state(page);
    assert.deepEqual(restored.lipSettings, beforeEdit.lipSettings, 'The first undo failed to restore the complete prior lip recipe');
    assert.deepEqual(restored.geometry, beforeEdit.geometry, 'Recipe undo did not restore the prior actual geometry');
    assert.deepEqual(restored.dna, blockedState.dna);
    for (const key of ['head', 'body', 'pose', 'lighting', 'camera']) assert.deepEqual(restored[key], blockedState[key], 'Recipe undo changed ' + key);
    assert.equal(restored.head.lipWetness, currentWetness);
    assert.equal(await page.evaluate(() => __IDENTITY_QA__.model().lipStructure.debug), debugSentinel);
    const message = page.locator('[data-lcc-restore-message]:visible').first();
    await message.waitFor({ state: 'visible' }); const visibleExplanation = await message.innerText();
    assert.match(visibleExplanation, /原唇部配方/); assert.match(visibleExplanation, /当前程序皮肤.*不会/);
    const undoFrame = await frame(page, 'candidate-original-recipe-undo');
    await page.evaluate(async () => {
      await __IDENTITY_QA__.controller().restore(structuredClone(window.__INDEPENDENT_UNDO_ARCHIVE__));
      window.lifelikeIdle?.pause?.(); lipWorkbench.stop?.();
      lipWorkbench.inspect(window.__INDEPENDENT_UNDO_DEBUG__);
      delete window.__INDEPENDENT_UNDO_ARCHIVE__; delete window.__INDEPENDENT_UNDO_DEBUG__;
    });
    await fixedView(page); assert.deepEqual(await state(page), initial);
    assert.equal((await frame(page)).sha256, baseline.initialFrame.sha256);
    return { rejected, resetError, debugSentinel, edit: edited, undoClicks: 1, restoredRecipe: restored.lipSettings, preservedCurrentWetness: currentWetness, visibleExplanation, undoFrame: brief(undoFrame) };
  });
  await test('native material restores both old controls and returning to procedural material restores the guard', async () => {
    const selected = await surfaceMode(page, false); await exposeLegacyControls(page); const results = [];
    for (const key of keys) {
      const input = page.locator('input[data-l19-kind="dna"][data-l19-key="' + key + '"]');
      assert(!(await input.isDisabled()), 'Legacy control stayed disabled on its working native material');
      await page.evaluate(({ initial, key }) => lipWorkbench.setDNA({ ...initial.dna, [key]: 0 }), { initial, key });
      const lowState = await state(page), low = await frame(page);
      await page.evaluate(key => lipWorkbench.setDNA({ [key]: 1 }), key); const highState = await state(page), high = await frame(page);
      const difference = delta(low, high, baseline.roi); assert(difference.changedInside > 10); assert.deepEqual(lowState.geometry, highState.geometry);
      results.push({ key, difference });
    }
    await exposeLegacyControls(page, 'wetness');
    assert(!(await page.locator('input[data-lip-key="wetness"]').isDisabled()), 'Original aggregate wetness was not restored on native material');
    const current = page.locator('[data-lcc-current-wetness]');
    if (await current.count() && await current.isVisible()) assert(await current.isDisabled(), 'Program-material wetness remains misleadingly enabled on native material');
    // Restore authored values while their real native consumer is active.
    await page.evaluate(initial => lipWorkbench.setDNA(initial.dna), initial);
    await surfaceMode(page, true); await exposeLegacyControls(page);
    for (const key of keys) assert(await page.locator('input[data-l19-kind="dna"][data-l19-key="' + key + '"]').isDisabled());
    assert(!(await page.locator('[data-lcc-current-wetness]').isDisabled()));
    await restoreInitial(page, initial); assert.deepEqual(await state(page), initial);
    assert.equal((await frame(page, 'candidate-final-return')).sha256, baseline.initialFrame.sha256);
    return { selected, results, returnImage: baseline.initialFrame.sha256 };
  });
}

async function publicSmoke(context) {
  const localBytes = fs.readFileSync(localQAPath), local = JSON.parse(localBytes);
  assert(local.completed && local.necessityEstablished, 'Local evidence did not establish and verify the bounded change');
  assert(local.tests.some(test => test.name === 'guard installation leaves the original person, parameters, geometry, lighting and image unchanged' && test.passed), 'LOCAL_QA_PATH is not a completed candidate verification');
  assert.equal(local.framebuffer.width, width); assert.equal(local.framebuffer.height, height);
  const expectedBytes = fs.readFileSync(candidatePath), expectedSHA256 = hash(expectedBytes);
  assert.equal(expectedSHA256, local.candidateSHA256, 'The public candidate bytes do not match the completed local run');
  assert(local.initialFramebufferSHA256 && local.baselineDirectWetness && local.initialState && local.roi, 'Local evidence is missing direct-response or initial-image measurements');
  let rawURL = process.env.CANDIDATE_RAW_URL || process.env.PUBLIC_RAW_URL;
  if (!rawURL) {
    const parsed = new URL(publicURL);
    if (parsed.hostname === 'raw.githubusercontent.com') rawURL = publicURL;
    else if (parsed.hostname === 'htmlpreview.github.io') rawURL = decodeURIComponent(parsed.search.slice(1));
  }
  assert(rawURL && /^https:\/\/raw\.githubusercontent\.com\//.test(rawURL), 'Public smoke needs the exact raw GitHub build address');
  const buildMatch = rawURL.match(/\/guilin-dem-pipeline\/([0-9a-f]{40})\//);
  assert(buildMatch, 'Public readback must bind to an immutable commit');
  report.publicURL = publicURL; report.publicRawURL = rawURL; report.publicBuildSHA = buildMatch[1];
  report.sourceSHA = process.env.SOURCE_SHA || local.sourceSHA || null;
  report.localEvidence = { path: localQAPath, sha256: hash(localBytes), sourceSHA: local.sourceSHA, candidateSHA256: local.candidateSHA256, scope: 'same-runner completed candidate checks reused; not rerun as public smoke' };
  report.necessityEstablished = true; report.candidateSHA256 = expectedSHA256;
  report.roi = local.roi; report.initialFramebufferSHA256 = local.initialFramebufferSHA256;
  await test('exact immutable HTTPS bytes match the locally verified candidate', async () => {
    const response = await context.request.get(rawURL, { timeout: 90000 });
    assert.equal(response.status(), 200); const bytes = await response.body();
    assert.equal(hash(bytes), expectedSHA256, 'Published bytes differ from the tested candidate');
    return { rawURL, httpStatus: response.status(), bytes: bytes.length, sha256: hash(bytes), buildSHA: buildMatch[1], sourceSHA: report.sourceSHA };
  });
  const page = await loadPage(context, publicURL, 'candidate');
  await surfaceMode(page, true); const initial = await state(page);
  const original = await frame(page, 'public-initial');
  await test('public startup retains the same measured person and original framebuffer', async () => {
    assert.deepEqual(initial, local.initialState);
    assert.equal(original.sha256, local.initialFramebufferSHA256, 'Public initial image differs from the same-runner local comparison');
    return { before: local.initialFramebufferSHA256, public: brief(original) };
  });
  await test('public old control is disabled and its mixed API change is atomically rejected', async () => {
    await exposeLegacyControls(page);
    const input = page.locator('input[data-l19-kind="dna"][data-l19-key="upperWetness"]');
    assert(await input.isDisabled());
    const notes = await page.locator('[data-lcc-note]').allTextContents(); assert(notes.some(text => text.trim()));
    const before = await state(page), beforeFrame = await frame(page);
    const result = await page.evaluate(() => {
      const dna = lipWorkbench.dna();
      try { lipWorkbench.setDNA({ upperWetness: dna.upperWetness === 1 ? 0 : 1, tissueDepth: dna.tissueDepth < 1.4 ? dna.tissueDepth + .05 : dna.tissueDepth - .05 }); return { rejected: false }; }
      catch (error) { return { rejected: true, code: error.code, message: error.message }; }
    });
    assert.equal(result.code, 'LIP_CONTROL_INACTIVE'); assert(result.message.includes('upperWetness'));
    assert.deepEqual(await state(page), before); assert.equal((await frame(page)).sha256, beforeFrame.sha256);
    return { ...result, disabled: true, notes };
  });
  await test('public current control matches the proven direct footprint and restores the original state', async () => {
    const input = page.locator('[data-lcc-current-wetness]'); assert(await input.isVisible()); assert(!(await input.isDisabled()));
    await page.evaluate(() => lipControlContract.setCurrentWetness(0)); const lowState = await state(page), low = await frame(page);
    await page.evaluate(() => lipControlContract.setCurrentWetness(1)); const highState = await state(page), high = await frame(page, 'public-current-wetness');
    const forwarding = requireExactForwarding(local.baselineDirectWetness, low, high, local.roi);
    assert.deepEqual(lowState.geometry, initial.geometry); assert.deepEqual(highState.geometry, initial.geometry);
    assert.deepEqual(lowState.dna, initial.dna); assert.deepEqual(highState.dna, initial.dna);
    assert.deepEqual(lowState.lipSettings, initial.lipSettings); assert.deepEqual(highState.lipSettings, initial.lipSettings);
    const lowHead = { ...lowState.head }, highHead = { ...highState.head }, initialHead = { ...initial.head };
    delete lowHead.lipWetness; delete highHead.lipWetness; delete initialHead.lipWetness;
    assert.deepEqual(lowHead, initialHead); assert.deepEqual(highHead, initialHead);
    assert.deepEqual(lowState.body, initial.body); assert.deepEqual(highState.body, initial.body);
    await page.evaluate(value => lipControlContract.setCurrentWetness(value), initial.head.lipWetness);
    await fixedView(page); assert.deepEqual(await state(page), initial);
    const restored = await frame(page, 'public-restored'); assert.equal(restored.sha256, original.sha256);
    return { forwarding, restored: brief(restored) };
  });
  report.publicSmokePassed = true;
}

(async () => {
  try {
    const baseURL = requestedMode === 'public' ? null : await createServer();
    const options = { headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] };
    if (process.env.CHROMIUM_EXECUTABLE) options.executablePath = process.env.CHROMIUM_EXECUTABLE;
    browser = await chromium.launch(options);
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
    if (requestedMode === 'public') {
      await publicSmoke(context);
    } else {
      const baselinePage = await loadPage(context, baseURL + '/baseline.html', 'baseline');
      const baseline = await baselineChecks(baselinePage);
      if (mode === 'candidate') {
        const candidatePage = await loadPage(context, baseURL + '/candidate.html', 'candidate');
        await candidateChecks(candidatePage, baseline);
      }
    }
    assert.equal(report.pageErrors.length, 0, 'Browser page exceptions');
    assert.equal(report.consoleErrors.length, 0, 'Browser console errors');
    assert.equal(report.requestFailures.length, 0, 'Resource request failures');
    report.completed = true;
    if (requestedMode === 'public') { report.publicHttpsPassed = true; report.shareAllowed = true; }
  } catch (error) { report.failure = String(error); report.stack = error.stack; process.exitCode = 1; console.error(error); }
  finally { report.finishedAt = new Date().toISOString(); save(); console.log(JSON.stringify({ mode, completed: report.completed, necessityEstablished: report.necessityEstablished, tests: report.tests.length, output, failure: report.failure })); await browser?.close(); server?.close(); }
})();
