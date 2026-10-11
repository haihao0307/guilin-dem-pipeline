'use strict';
// CI-only actual WebKit scene/Worker smoke. The original app owns every state,
// camera, clock, Worker and native output. Only real pointer/keyboard input is used.
// No source injection, route substitution, synthetic game commands, or fallback engine.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const {pathToFileURL} = require('node:url');
const {execFileSync} = require('node:child_process');
const SOURCE_COMMIT = '03ae7767710ee91aa6e6da5efcd2aac37ca1f553';
const GAME_PATH = 'kaopu-minigame-workbench/voxel-train-study/game/r20-plants-r03';
const STUDY_PATH = 'kaopu-minigame-workbench/voxel-train-study/';
const SOURCE_ROOT = path.resolve(process.env.MUSA_SCENE_SOURCE_ROOT || 'runtime-source');
const GAME_ROOT = path.join(SOURCE_ROOT, GAME_PATH);
const OUT = path.resolve(process.env.MUSA_SCENE_OUT || 'train-plants-r03-results/webkit-scene');
const ORIGIN = 'http://127.0.0.1:8765/';
const BASE = ORIGIN + GAME_PATH + '/';
const CONTAINER = 'plants/native-codec/objects/establishing-musa.KaoPu';
const MANIFEST = 'plants/native-codec/dependency-manifest.json';
const RECIPE = 'plants/native-codec/objects/establishing-musa.expected.json';
const SOURCE_HEAD = 'd5f6ed0f41bdd6a4e4d1163190d3cd2135e8b122';
const SOURCE_CLOSURE = '50e4e4c3393417704f95be660c20e6bf15f7efe715ea8b8074a090e7003cd706';
const WEBKIT_GEOMETRY = '90ee8e44193b450aecf7c437e45717634010f2d8f87e908dadfcca68eaa0dac9';
const WEBKIT_CONTENT = '983c3905c2adfe36079eb29369d37f70ac66bfadbe75fa7e188100be87f0a8a9';
const POSITIONS = [[10.05, .081, -4.273963513064663], [405.24741793906245, .081, -10.5]];
const YAWS = [0.6981317007977318, 0];
const IDS = ['station-front-establishing-musa', 'street-rear-establishing-musa'];
const PINS = Object.freeze({
  "actor-scale.mjs": {
    "bytes": 4957,
    "sha256": "663412818203fb02419254477883840a6ff168488942e71cfdad90d40261dc1b"
  },
  "anchored-zoom.mjs": {
    "bytes": 3247,
    "sha256": "28eeea06da47c68e72d2622c074453a4e6f7a04cbd92a6412030dd6dac1401ae"
  },
  "app.mjs": {
    "bytes": 31244,
    "sha256": "6b41c9de5f50982c8105e522b4b574cdbcdd6611bec95fe2006fc66d2e8bc548"
  },
  "audio-spatial.mjs": {
    "bytes": 8995,
    "sha256": "27823f6755de1313fca62a1887ef5240029363b1b54469708071180ab778f625"
  },
  "audio.mjs": {
    "bytes": 16598,
    "sha256": "9c590a6dfbced8cbd20c557c26ff52eacbe57a4e1be203bb5ba9d9eaa7efb5dd"
  },
  "body-motion.mjs": {
    "bytes": 6164,
    "sha256": "741029e65a43052d38c1a1a4606e7d0a66784251f27b05bea5164fc36d7d223c"
  },
  "bounds-zoom.mjs": {
    "bytes": 3068,
    "sha256": "a497394fe9c9c1b0f84f9a1f79b969eaf206d635937f5176f2e1de1137c38fd5"
  },
  "brake-effects.mjs": {
    "bytes": 15332,
    "sha256": "45f0abc704a34e15f1054e6b506d60e4e1de957a9c5b0976be8de9c57f690f9a"
  },
  "brake-effort.mjs": {
    "bytes": 766,
    "sha256": "3a025c6018397839f393a7d083ccfe63f072b4ac22f01d61898b7e2547f3e4b7"
  },
  "camera-presets.mjs": {
    "bytes": 5217,
    "sha256": "10c80d1412f80f83c852ae7da1ed8d5a8b1ac465140dee0505d788ac0e17cd5c"
  },
  "characters.mjs": {
    "bytes": 7165,
    "sha256": "9c219a5de8e64ce11ba4771873d0440556de4db599ff161bd0dfbba56ee8cd7b"
  },
  "coach-model.mjs": {
    "bytes": 15879,
    "sha256": "8a479dcbe3244780289c140865c17ef7e3366b4834dfec45e08cfc15bacf0aa3"
  },
  "crew-state.mjs": {
    "bytes": 2296,
    "sha256": "6633c5fca7008018f321cb6cb67d254545e558a903a7b30ab0fdf69373cc915a"
  },
  "driver-input.mjs": {
    "bytes": 4643,
    "sha256": "fca0c7568286f5ca5a4bbff4571b498f199f442d1d80f21c2f39b76f5e2174c4"
  },
  "flat-terrain.mjs": {
    "bytes": 15272,
    "sha256": "5caef1252afa5184e4e31903bc01efe948e361f6ac0d9d6dcab31b8df00c8155"
  },
  "game.css": {
    "bytes": 60883,
    "sha256": "4a30aa07aeeccebd42a68c2bac2c11cbffcb4483ad5da4abfd6dfee8f8456073"
  },
  "heritage.mjs": {
    "bytes": 10455,
    "sha256": "b426d536771b23b0ec0eefdd93c3b0e4451eceb8e13874ddba95ef157d1f1d3c"
  },
  "index.html": {
    "bytes": 17510,
    "sha256": "d197805754a395fc7f1633543c78e53840a4355918c37d207e1ad1fa61c6384b"
  },
  "metre-scale.mjs": {
    "bytes": 3077,
    "sha256": "2cf1f3f395d607475840608936885beb209f5da0faa32014476831653ee8dcc2"
  },
  "morning-atmosphere.mjs": {
    "bytes": 2324,
    "sha256": "7302c311ebf956e037111330230f963a028747efd9c25e8512ab0eceece538c7"
  },
  "music.mjs": {
    "bytes": 13728,
    "sha256": "040351a9505efbb07a64a2c1b9c2a85075e52f3675ae4f0e08983f8317d74c9b"
  },
  "recommended-fit.mjs": {
    "bytes": 8735,
    "sha256": "e097202ba5f95c7ff40095e324c360a07cd099edf6d2565cbe243951079e54fd"
  },
  "render-quality.mjs": {
    "bytes": 980,
    "sha256": "d926651453e7c6d8cc949349bfd970b872b2e34a0b50fd35bccdd1e32d95f296"
  },
  "route-map.mjs": {
    "bytes": 3428,
    "sha256": "fab7b09e4f4e34c01cb2b9a7fd0f5291c7293424305d4a46d3c5e34334c780f9"
  },
  "session.mjs": {
    "bytes": 20495,
    "sha256": "e3659ee56774f0cdd343ba5f14e59a7801d826837437b39b82f0a9152ad07d5f"
  },
  "settings-ui.mjs": {
    "bytes": 7303,
    "sha256": "af0eff75867d536429e20a81b34df0d744b2c705bc3074bff0ab6869a0b17b5b"
  },
  "smoke-profile.mjs": {
    "bytes": 2732,
    "sha256": "adee7055b2fd185a0543db0a567475d8da8a7b825f1b2755ee582877f8be1be9"
  },
  "smoke-texture.mjs": {
    "bytes": 1277,
    "sha256": "aabe94b28eddfa33cd9f431349e3fc88e09aa174f7fc99e1a374d391cf10ac33"
  },
  "smoke.mjs": {
    "bytes": 5621,
    "sha256": "575e0c1db8b5155443f846fe2e1901b261e138b26bef4bf6113feb8915641921"
  },
  "station-nameboard.mjs": {
    "bytes": 3067,
    "sha256": "231a8812327481f1be79a1facdb6aac38d40eeaaac984ed7a33825640d8b8304"
  },
  "station-platform.mjs": {
    "bytes": 31034,
    "sha256": "9d9d380b61d54fad20bffee20b904b094cc9140fb89d542278d97f1f2bbfa8d9"
  },
  "station-room.mjs": {
    "bytes": 10083,
    "sha256": "0b9687b42b2484d4e50c84497e6b238ac2a39e436b4b697b4a37788fe5a3ddf5"
  },
  "station-streaming.mjs": {
    "bytes": 8429,
    "sha256": "5f46256337046b433e681e5f5cb82e6257467b5a23df47051b4f2e828be3ac17"
  },
  "steam-dynamics.mjs": {
    "bytes": 26592,
    "sha256": "b95a452ac8e5c467975107d0cb1352cc404cb72f6b7c8527adc8027ce98e3518"
  },
  "steam-model.mjs": {
    "bytes": 28779,
    "sha256": "ff436f7d2dd75adf2571424cd2b8b04eda35d192d416e9baa19e5badc093d452"
  },
  "steam-scale.mjs": {
    "bytes": 5097,
    "sha256": "38e4fda89dd2ec9c938348d87594a8f48689b9d5f9e6fa15d5b35aa5f6550d7c"
  },
  "street-district.mjs": {
    "bytes": 12718,
    "sha256": "cc42901a95147caa978b6861bd1a5743162c25d757fab7eef47b8cc081a185d3"
  },
  "timetable.mjs": {
    "bytes": 2523,
    "sha256": "eb32f92b389f51b9bf618cb3c104a08ab4c174664d4d1f5f885d3e659f1c199c"
  },
  "train-model.mjs": {
    "bytes": 4102,
    "sha256": "47ad00499e3803e5a6bf0c33faa6023e90e845529867aa2674affb614f55ff7e"
  },
  "view-controls.mjs": {
    "bytes": 6871,
    "sha256": "06faed2b43a841b598b94526124d482174a9276bdfe3be70f1acde40cb95b2a8"
  },
  "view-profile-storage.mjs": {
    "bytes": 3648,
    "sha256": "c23306890e84a03781044040bf18442110d3802c2c61c50529a3f433d4074977"
  },
  "world.mjs": {
    "bytes": 12799,
    "sha256": "01a393e3f460c0baa9173f99df8cbb6e70aa7f96a1b7568454d72098abb6e142"
  },
  "plants/segment.mjs": {
    "bytes": 8482,
    "sha256": "92c770275bbfdff421ab9fbd937de9cdfa08bb986c3785eb152ede13fa51226f"
  },
  "plants/load-status.mjs": {
    "bytes": 408,
    "sha256": "99f00d39e08821f65b53c7b91b501a8abc71fbd5c58153c8db163ad07f830e96"
  },
  "plants/rules/plant-operator.mjs": {
    "bytes": 12271,
    "sha256": "082557267472bcf65ac1a8634172aea7c7665be36fef8d09362dd32fdda3286f"
  },
  "plants/rules/native78-musa-author.mjs": {
    "bytes": 469608,
    "sha256": "591a55da33fccaad7da0211bc4fce44313b9a5cb1f7af5ecb57a7b13d99bfc6f"
  },
  "plants/rules/native78-runtime.mjs": {
    "bytes": 187669,
    "sha256": "5cf8b6d78b5bc36e10ba7574f93d3de6ed71410ef0fa5ec5ade96d710c271850"
  },
  "plants/vendor/three.module.min.js": {
    "bytes": 338836,
    "sha256": "06552c54e4071fbc7305117aafe6765d92c5d2a2a83507d4f05b9bf4f3d4d463"
  },
  "plants/vendor/three.core.min.js": {
    "bytes": 380374,
    "sha256": "79f2b4f58d3e99a9948a4d3b7f6d5c2daf705bdefe9fb82ebec715623966551c"
  },
  "plants/rules/native78-equivalence.mjs": {
    "bytes": 1531,
    "sha256": "4bbf0ff029270014e43ad03e5b2cd3aed09099958f40b80671ac8aad19460af1"
  },
  "plants/rules/native78-generation-worker.mjs": {
    "bytes": 13675,
    "sha256": "afc56663fca4e544c1919f3c6fcf50154001450701e7aff3f8760974fda0431b"
  },
  "plants/native-codec/codec.mjs": {
    "bytes": 11189,
    "sha256": "89f1ae51e5c781b8c4b3ce096bcc9b46cff9ba2bfa71b3860384d0bc200c1e9e"
  },
  "plants/native-codec/template-data.mjs": {
    "bytes": 108725,
    "sha256": "7901516d7ae306c2f9d2ab7962ef2be5ae7b53d677260c744544e44d5df7de1a"
  },
  "plants/native-codec/dependency-manifest.json": {
    "bytes": 5129,
    "sha256": "3e70600eff2ddc2a266f86d902ab119e4282cbb701ab67e9486a1e73161c90ed"
  },
  "plants/native-codec/objects/establishing-musa.KaoPu": {
    "bytes": 77824,
    "sha256": "95116d0aa78446bf0122fb6877fd6de8732036337f338ed21f295819421cd90e"
  },
  "plants/native-codec/objects/establishing-musa.expected.json": {
    "bytes": 5431,
    "sha256": "9dc90b1b1a39b1db1cc0721525394faaeb2eaf7d808d1780fc840efe895bea3e"
  }
});
const DEPENDENCY_PATHS = Object.freeze({
  'plant-operator': 'plants/rules/plant-operator.mjs',
  'mother-author': 'plants/rules/native78-musa-author.mjs',
  'mother-runtime': 'plants/rules/native78-runtime.mjs',
  'three-module': 'plants/vendor/three.module.min.js',
  'three-core': 'plants/vendor/three.core.min.js',
  'native-equivalence': 'plants/rules/native78-equivalence.mjs',
  'generation-worker': 'plants/rules/native78-generation-worker.mjs'
});
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const canonical = v => v && typeof v === 'object' ? Array.isArray(v) ? v.map(canonical) : Object.fromEntries(Object.keys(v).sort().map(k => [k, canonical(v[k])])) : v;
const equal = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
const report = {
  schema: 'native78-musa-webkit-scene-smoke/1', automatedPass: false,
  sourceCommit: SOURCE_COMMIT, harnessCommit: process.env.GITHUB_SHA || null,
  sourceURL: BASE, stage: 'not-started', firstFailure: null,
  scope: 'Actual unchanged game startup, original module Worker, real Start/Pause/Resume and first-stop door input, initial/default/overview/city pixels. Short departure under 50 metres. No complete-journey or FPS acceptance.',
  environment: 'Official Playwright 1.57.0 WebKit on Ubuntu 24.04 with headed Xvfb and Mesa software-rendering request. Not a physical iPhone or Safari hardware test.',
  sourceQualification: {runId: '38105688421', commit: '8bc11d9cb484d8315868082b8b97d05e796095f6', engine: 'WebKit 26.0 / Playwright 1.57.0 Linux', geometryHash: WEBKIT_GEOMETRY, contentHash: WEBKIT_CONTENT, runtimeHashPolicyChanged: false},
  renderingConfiguration: {headless: false, xvfb: true, LIBGL_ALWAYS_SOFTWARE: 'true', GALLIUM_DRIVER: 'llvmpipe', documentation: ['https://playwright.dev/docs/ci#running-headed', 'https://docs.mesa3d.org/envvars.html']},
  visualReview: {status: 'pending-actual-PNG-inspection', required: ['unchanged-default-first-screen.png', 'existing-overview-camera.png', 'existing-city-camera.png']},
  stages: [], states: [], screenshots: [], sources: [], workers: [], inputs: [],
  errors: [], networkErrors: [], sourceReadErrors: [], screenshotErrors: [],
  totalBudgetMs: 420000, maximumDepartureMetres: 50
};
fs.mkdirSync(OUT, {recursive: true});
const write = () => fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify(report, null, 2) + '\n');
const safeError = error => String(error?.stack || error).split(SOURCE_ROOT).join('<source>').split(OUT).join('<artifacts>').split(path.resolve(__dirname, '..')).join('<harness>');
function mark(stage, detail = null) {
  report.stage = stage;
  report.stages.push({stage, at: new Date().toISOString(), detail});
  write();
}
function failure(kind, detail) {
  const record = {stage: report.stage, kind, at: new Date().toISOString(), detail};
  if (!report.firstFailure) report.firstFailure = record;
  return record;
}
async function verifySource() {
  assert.equal(process.env.GITHUB_ACTIONS, 'true', 'Scene browser execution is limited to the separately authorized GitHub Actions workflow');
  assert.equal(Number(process.versions.node.split('.')[0]), 22);
  const actual = execFileSync('git', ['-C', SOURCE_ROOT, 'rev-parse', 'HEAD'], {encoding: 'utf8'}).trim();
  assert.equal(actual, SOURCE_COMMIT, 'Wrong runtime source commit');
  assert.equal(execFileSync('git', ['-C', SOURCE_ROOT, 'status', '--porcelain', '--untracked-files=no'], {encoding: 'utf8'}).trim(), '', 'Runtime tracked source changed');
  const harnessRoot = path.resolve(__dirname, '..');
  assert.equal(execFileSync('git', ['-C', harnessRoot, 'rev-parse', 'HEAD'], {encoding: 'utf8'}).trim(), process.env.GITHUB_SHA, 'Wrong harness commit');
  report.verifiedSourceCommit = actual;
  report.sourcePins = PINS;
  for (const [file, pin] of Object.entries(PINS)) {
    const bytes = fs.readFileSync(path.join(GAME_ROOT, file));
    assert.equal(bytes.length, pin.bytes, 'Pinned source size changed: ' + file);
    assert.equal(sha(bytes), pin.sha256, 'Pinned source bytes changed: ' + file);
  }
  const manifest = JSON.parse(fs.readFileSync(path.join(GAME_ROOT, MANIFEST)));
  const expected = JSON.parse(fs.readFileSync(path.join(GAME_ROOT, RECIPE)));
  const codec = await import(pathToFileURL(path.join(GAME_ROOT, 'plants/native-codec/codec.mjs')).href);
  const equivalence = await import(pathToFileURL(path.join(GAME_ROOT, 'plants/rules/native78-equivalence.mjs')).href);
  const container = new Uint8Array(fs.readFileSync(path.join(GAME_ROOT, CONTAINER)));
  const recipe = await codec.decode(container);
  assert(equal(recipe, expected), 'Decoded source recipe changed');
  assert.equal(container.length, 77824);
  assert.equal(Buffer.from(container.subarray(0, 16)).toString('ascii'), 'SQLite format 3\0');
  assert.equal(recipe.source.head, SOURCE_HEAD);
  assert.equal(recipe.source.closureSha256, SOURCE_CLOSURE);
  assert.equal(recipe.profile.species, 'musa-balbisiana');
  assert.equal(recipe.profile.seed, 761014);
  assert.equal(recipe.profile.stage, 'establishing');
  assert.equal(recipe.profile.productionSystemVersion, 78);
  assert(equal(recipe.profile, manifest.profile76));
  assert.deepEqual(recipe.instance.positionM, POSITIONS[0]);
  assert.equal(recipe.instance.yawRadians, YAWS[0]);
  assert.equal(recipe.instance.id, IDS[0]);
  assert(equal(codec.pinnedDependencies(), manifest.dependencies));
  assert(equal(codec.pinnedResources(), manifest.resources));
  assert.equal(manifest.dependencies.length, 7);
  assert.equal(manifest.resources.length, 6);
  assert.equal(manifest.resources.reduce((sum, r) => sum + r.bytes, 0), 835584);
  const dependencyBytes = {};
  for (const dep of manifest.dependencies) {
    const file = DEPENDENCY_PATHS[dep.id];
    assert(file, 'Unknown source dependency: ' + dep.id);
    const bytes = new Uint8Array(fs.readFileSync(path.join(GAME_ROOT, file)));
    assert.equal(bytes.length, dep.bytes);
    assert.equal(sha(bytes), dep.sha256);
    dependencyBytes[dep.id] = bytes;
  }
  await codec.verifyDependencyBytes(dependencyBytes);
  // The measured WebKit raw pair is already present; do not rewrite its engine labels.
  const existingPair = equivalence.KNOWN_NATIVE_HASH_PAIRS.find(p => p.geometry === WEBKIT_GEOMETRY && p.content === WEBKIT_CONTENT);
  assert(existingPair, 'Measured exact WebKit pair is not admitted by the unchanged runtime');
  const expectedEquivalence = equivalence.assertKnownNativeHashes({geometryHash: WEBKIT_GEOMETRY, contentHash: WEBKIT_CONTENT});
  report.existingRuntimePair = existingPair;
  report.input = {bytes: container.length, sha256: sha(container), profile: recipe.profile, source: recipe.source, dependencies: manifest.dependencies, resources: manifest.resources};
  return {manifest, recipe, expectedEquivalence};
}
async function run() {
  let browser, page, context;
  const pending = [];
  let observedStageKey = null;
  write();
  const watchdog = setTimeout(() => {
    report.failure = 'WebKit scene smoke exceeded its 420-second runtime budget.';
    failure('timeout', report.failure); write();
    Promise.resolve(browser?.close()).finally(() => process.exit(1));
    setTimeout(() => process.exit(1), 3000).unref();
  }, report.totalBudgetMs);
  try {
    mark('source-verification');
    const {manifest, recipe, expectedEquivalence} = await verifySource();
    report.nodeVersion = process.version;
    report.playwrightVersion = require('playwright/package.json').version;
    assert.equal(report.playwrightVersion, '1.57.0');
    assert.equal(process.env.LIBGL_ALWAYS_SOFTWARE, 'true');
    assert.equal(process.env.GALLIUM_DRIVER, 'llvmpipe');
    assert(process.env.DISPLAY, 'Headed WebKit requires the declared Xvfb display');
    mark('webkit-launch');
    const {webkit} = require('playwright');
    browser = await webkit.launch({headless: false});
    report.webkitVersion = browser.version();
    assert.equal(report.webkitVersion, '26.0', 'This smoke is scoped to the actually source-qualified WebKit 26.0');
    context = await browser.newContext({viewport: {width: 1280, height: 720}, deviceScaleFactor: 1, serviceWorkers: 'block'});
    page = await context.newPage();
    page.setDefaultTimeout(30000); page.setDefaultNavigationTimeout(60000);
    page.on('pageerror', error => {report.errors.push(failure('pageerror', safeError(error))); write();});
    page.on('console', message => {if (message.type() === 'error') {report.errors.push(failure('console-error', message.text())); write();}});
    page.on('crash', () => {report.errors.push(failure('page-crash', 'WebKit page crashed')); write();});
    page.on('worker', worker => {
      const entry = {url: worker.url(), createdAt: new Date().toISOString(), createdStage: report.stage, closedAt: null};
      report.workers.push(entry); write();
      worker.once('close', () => {entry.closedAt = new Date().toISOString(); write();});
    });
    context.on('requestfailed', request => {report.networkErrors.push(failure('requestfailed', {url: request.url(), error: request.failure()?.errorText || null})); write();});
    context.on('response', response => {
      const observedStage = report.stage;
      pending.push((async () => {
        const url = new URL(response.url());
        assert.equal(url.origin + '/', ORIGIN, 'Unexpected non-local network response: ' + response.url());
        let relative = decodeURIComponent(url.pathname.slice(1));
        if (relative.endsWith('/')) relative += 'index.html';
        assert(relative.startsWith(STUDY_PATH), 'Response is outside the exact study checkout');
        const local = path.resolve(SOURCE_ROOT, relative);
        assert(local.startsWith(SOURCE_ROOT + path.sep), 'Source path escaped the runtime checkout');
        const body = await response.body(), bytes = fs.readFileSync(local);
        const entry = {stage: observedStage, url: response.url(), path: relative, status: response.status(), resourceType: response.request().resourceType(), contentType: response.headers()['content-type'] || null, bytes: body.length, responseSha256: sha(body), sourceSha256: sha(bytes), exact: body.equals(bytes), sqliteHeader: relative.endsWith('.KaoPu') ? body.subarray(0, 16).toString('ascii') : undefined};
        report.sources.push(entry);
        assert.equal(entry.status, 200, 'Unexpected response status: ' + relative);
        assert(entry.exact, 'Observed network bytes differ from pinned source: ' + relative);
      })().catch(error => {report.sourceReadErrors.push(failure('response-provenance', {url: response.url(), observedStage, error: safeError(error)})); write();}));
    });
    async function settledSources() {
      for (let count = -1; count !== pending.length;) {count = pending.length; await Promise.all(pending);}
    }
    const state = () => page.evaluate(() => window.__trainDriver?.ready ? window.__trainDriver.getState() : null);
    function healthy(current, label) {
      if (current) {
        const native = current.nativePlants;
        const key = JSON.stringify([native?.status, native?.stage, native?.generationProgress?.stage, native?.error]);
        if (key !== observedStageKey) {
          observedStageKey = key;
          report.states.push({label: 'natural-load-progress', at: new Date().toISOString(), stage: report.stage, state: current}); write();
        }
        if (native?.error || native?.failure || native?.status === 'error') {
          failure('native-initialization', {label, stage: native.failure?.stage || native.stage, error: native.error, failure: native.failure});
          throw Error(label + ': original native initialization failed at ' + (native.failure?.stage || native.stage) + ': ' + native.error);
        }
        assert.notEqual(current.streetDistrict?.status, 'error', 'Original district failed');
      }
      assert.deepEqual(report.errors, [], label + ': browser error');
      assert.deepEqual(report.networkErrors, [], label + ': request failed');
      assert.deepEqual(report.sourceReadErrors, [], label + ': source provenance failed');
    }
    async function until(predicate, label, timeout = 30000) {
      const deadline = Date.now() + timeout;
      while (Date.now() < deadline) {
        const current = await state(); healthy(current, label);
        if (current && predicate(current)) return current;
        await page.waitForTimeout(100);
      }
      throw Error(label + ': timed out after ' + timeout + ' ms');
    }
    async function click(selector) {
      await page.locator(selector).waitFor({state: 'visible'});
      await page.waitForFunction(selector => {
        const e = document.querySelector(selector); return e && !e.matches(':disabled') && !e.closest('[inert],[aria-disabled="true"]');
      }, selector, {polling: 100});
      const target = await page.locator(selector).evaluate(e => {
        const r = e.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2, hit = document.elementFromPoint(x, y);
        return {x, y, width: r.width, height: r.height, inViewport: r.left >= -1 && r.top >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1, hit: hit === e || e.contains(hit)};
      });
      assert(target.width > 0 && target.height > 0 && target.inViewport && target.hit, 'Real pointer target is not reachable: ' + selector);
      report.inputs.push({stage: report.stage, type: 'pointer-click', selector, x: target.x, y: target.y}); write();
      await page.mouse.click(target.x, target.y);
    }
    function checkPlant(s) {
      healthy(s, 'native scene');
      const n = s.nativePlants;
      assert.equal(n.status, 'ready'); assert.equal(n.stage, 'ready');
      assert.equal(n.error, null); assert.equal(n.failure, null); assert.equal(n.buildPending, false);
      assert.equal(n.count, 2); assert.equal(n.active, 1); assert.equal(n.generationCount, 1);
      assert.equal(n.worldGeometryScale, 1); assert(n.sharedGeometry && n.sharedMaterials);
      assert.equal(n.ownAnimationLoop, false); assert.equal(n.externalMeshes, false);
      assert.equal(n.timeSource, 'host.elapsed'); assert.equal(n.elapsed, s.elapsed); assert.equal(n.distance, s.distance);
      const load = n.loadProof;
      assert.equal(load.actualKaoPuByteLength, 77824); assert.equal(load.profile, manifest.profile);
      assert.equal(load.containerFormat, 'SQLite KAOPU prototype envelope');
      assert.equal(load.replacementRevision, 1); assert.equal(load.generationCount, 1); assert.equal(load.instanceCount, 2);
      assert(load.sharedGeometry && load.sharedMaterials && load.sharedWindUniforms);
      assert.equal(load.dependencyBytes, manifest.dependencies.reduce((sum, d) => sum + d.bytes, 0));
      assert.equal(n.plants.length, 2);
      for (const [i, plant] of n.plants.entries()) {
        const p = plant.proof;
        assert.equal(plant.id, IDS[i]); assert.equal(plant.seed, 761014); assert.equal(plant.sharedSourceInstance, IDS[0]);
        assert.deepEqual(plant.position, [POSITIONS[i][0] - s.distance, POSITIONS[i][1], POSITIONS[i][2]]);
        const actualRecipe = structuredClone(plant.recipe);
        assert.equal(actualRecipe.instance.instanceId, IDS[i]); delete actualRecipe.instance.instanceId;
        assert(equal(actualRecipe, {...recipe, instance: {...recipe.instance, positionM: POSITIONS[i], yawRadians: YAWS[i]}}));
        assert.equal(p.operator, 'PLANT_FUNCTION_MUSA_R04'); assert.equal(p.sourceHead, SOURCE_HEAD); assert.equal(p.sourceClosureSha256, SOURCE_CLOSURE);
        assert.equal(p.species, 'musa-balbisiana'); assert.equal(p.seed, 761014); assert.equal(p.developmentStage, 'establishing');
        assert.deepEqual(p.rootScale, [1, 1, 1]); assert.equal(p.bounds.max[1], 5.031538486480713);
        assert.equal(p.triangles, 36330); assert.equal(p.leafCount, 28); assert.equal(p.shootCount, 4); assert.equal(p.axisCount, 64);
        assert.equal(p.sourceGeometryHash, WEBKIT_GEOMETRY); assert.equal(p.sourceContentHash, WEBKIT_CONTENT); assert.equal(p.sourceEquivalent, true);
        assert.deepEqual(p.equivalence, expectedEquivalence);
        assert.equal(p.generation.mode, 'module-worker'); assert.equal(p.generation.singleUseWorker, true);
        assert.equal(p.generation.zeroCopyGeometryAndPixels, true); assert.equal(p.generation.sourceAndInputVerifiedBeforeWorker, true);
        assert.equal(p.generation.fullOriginalValidationBeforeTransfer, true); assert.equal(p.timing.mainThreadGenerationMs, 0);
        assert.equal(p.renderResources.geometries, 1); assert.equal(p.renderResources.materials, 2); assert.equal(p.renderResources.textures, 6);
        assert.equal(p.renderResources.texturePixelBytes, 835584); assert.equal(p.instanceCopy, i);
        assert(p.sharedGeometry && p.sharedMaterials); assert.equal(p.elapsed, s.elapsed);
        assert.equal(p.wind.timeSource, 'host.elapsed'); assert.equal(p.wind.strength, .25); assert.equal(p.wind.shadowUsesSameWind, true);
        assert.deepEqual([...p.resourceIds].sort(), manifest.resources.map(r => r.id).sort());
        assert.equal(p.visualAcceptance, false); assert.equal(p.hardwareMeasured, false);
      }
      assert(s.frames > 0 && s.drawCalls > 0 && s.triangles > 0, 'Original game has not rendered actual geometry');
      assert(s.canvasPixels.every(v => Number.isFinite(v) && v > 0));
    }
    async function capture(file, note) {
      const before = await state(); checkPlant(before);
      const bytes = await page.screenshot({path: path.join(OUT, file), timeout: 45000});
      report.screenshots.push({file, bytes: bytes.length, sha256: sha(bytes), note, before, after: await state()}); write();
    }
    mark('natural-game-navigation');
    const started = Date.now();
    const navigation = await page.goto(BASE, {waitUntil: 'domcontentloaded'});
    assert.equal(navigation.status(), 200); assert.equal(page.url(), BASE);
    report.browserEnvironment = await page.evaluate(() => ({userAgent: navigator.userAgent, platform: navigator.platform, vendor: navigator.vendor, secureContext: isSecureContext}));
    mark('natural-game-and-worker-initialization');
    const ready = await until(s => s.nativePlants?.status === 'ready' && s.streetDistrict?.status === 'active' && !s.streetDistrict.pending, 'Natural original startup', 180000);
    checkPlant(ready);
    assert.equal(await page.evaluate(() => window.__trainDriver.version), 'kcr-kst1-r20-plants-r03');
    assert.equal(ready.started, false); assert.equal(ready.distance, 0); assert.equal(ready.cameraMode, 'platform');
    report.readyMs = Date.now() - started;
    report.renderer = await page.evaluate(() => {
      const canvas = document.getElementById('gameScene'), gl = canvas.getContext('webgl2');
      if (!gl) return {webgl2: false};
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      return {webgl2: true, contextLost: gl.isContextLost(), renderer: gl.getParameter(gl.RENDERER), vendor: gl.getParameter(gl.VENDOR), version: gl.getParameter(gl.VERSION), shadingLanguageVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION), unmaskedRenderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : null, attributes: gl.getContextAttributes(), driverStateName: window.__trainDriver.getState().rendererName};
    });
    assert(report.renderer.webgl2 && !report.renderer.contextLost);
    report.states.push({label: 'original-ready-before-input', state: ready});
    await capture('unchanged-initial-before-start.png', 'Untouched natural initial screen. Existing start overlay and all default UI are retained.');

    mark('real-start-and-default-camera');
    await click('#startGame');
    const first = await until(s => s.started && !s.paused && s.frames > ready.frames, 'Real Start and next rendered frame');
    assert.equal(first.distance, 0); assert.deepEqual(first.camera, ready.camera);
    await capture('unchanged-default-first-screen.png', 'Actual first screen after real Start, before any camera input. No UI or scene alteration.');
    mark('real-pause-resume');
    await click('#pause');
    const paused = await until(s => s.paused, 'Real Pause'); checkPlant(paused);
    await page.waitForTimeout(700);
    const still = await state(); checkPlant(still);
    for (const key of ['elapsed', 'distance', 'door', 'phase']) assert.deepEqual(still[key], paused[key], 'Pause changed ' + key);
    assert.deepEqual(still.nativePlants, paused.nativePlants, 'Paused native host/wind state changed');
    report.pauseStable = {intervalMs: 700, hostClock: true, plantClock: true, nativeState: true};
    await click('#resume');
    await until(s => !s.paused && s.elapsed > paused.elapsed, 'Real Resume');

    for (const camera of ['overview', 'city', 'platform']) {
      mark('existing-camera-' + camera);
      const before = await state(); checkPlant(before);
      await click('#openCameraMenu');
      await page.locator('#settingsScreen').waitFor({state: 'visible'});
      const menuPaused = await until(s => s.paused, 'Camera menu naturally pauses');
      await click(`[data-camera="${camera}"]`);
      await page.locator('#settingsScreen').waitFor({state: 'hidden'});
      const changed = await until(s => s.cameraMode === camera && !s.paused && s.frames > menuPaused.frames, 'Existing ' + camera + ' preset rendered');
      checkPlant(changed); assert.equal(changed.distance, 0);
      report.states.push({label: 'real-camera-preset-' + camera, state: changed});
      if (camera !== 'platform') await capture('existing-' + camera + '-camera.png', 'Existing ' + camera + ' camera selected through actual camera-menu pointer input. Original native scene and normal UI retained.');
    }

    mark('real-first-stop-doors');
    await until(s => s.station.canOpen, 'First stop ready for real door input');
    await click('#stationAction');
    await until(s => s.door > 0 && ['doors-opening', 'unloading', 'boarding', 'ready-depart'].includes(s.phase), 'Real door-open input');
    report.inputs.push({stage: report.stage, type: 'keyboard', key: 'w'});
    await page.keyboard.press('w');
    const interlock = await state(); checkPlant(interlock);
    assert.equal(interlock.throttle, 0); assert.equal(interlock.velocity, 0);
    report.doorInterlock = {throttle: interlock.throttle, velocity: interlock.velocity, actualKeyboardInput: 'w'};
    const served = await until(s => s.phase === 'ready-depart', 'Natural first-stop passenger service', 150000);
    checkPlant(served); assert.equal(served.door, 1); assert.equal(served.stats.stops, 1);
    assert.equal(served.station.boarded, 3); assert.equal(served.station.alighted, 2);
    report.states.push({label: 'original-doors-open-service-complete', state: served});
    await capture('first-stop-doors-open.png', 'Actual original doors fully open after normal first-stop passenger service.');
    await click('#stationAction');
    const departure = await until(s => s.phase === 'running' && s.station.index === 1 && s.door === 0 && s.velocity > 0 && s.distance > .01, 'Real close-door input and short departure', 45000);
    checkPlant(departure); assert(departure.distance < report.maximumDepartureMetres);
    await click('#pause');
    const finalPaused = await until(s => s.paused, 'Final real Pause'); checkPlant(finalPaused);
    assert(finalPaused.distance < report.maximumDepartureMetres);
    report.states.push({label: 'final-paused-short-departure', state: finalPaused});

    mark('final-source-and-worker-provenance');
    await page.waitForLoadState('networkidle', {timeout: 15000});
    await settledSources(); healthy(await state(), 'Final audit');
    assert(report.sources.length && report.sources.every(s => s.status === 200 && s.exact));
    const required = ['index.html', 'game.css', 'app.mjs', 'world.mjs', 'session.mjs', 'settings-ui.mjs', 'camera-presets.mjs', 'view-controls.mjs', 'plants/segment.mjs', 'plants/load-status.mjs', 'plants/native-codec/codec.mjs', 'plants/native-codec/template-data.mjs', CONTAINER, ...Object.values(DEPENDENCY_PATHS)];
    for (const file of required) {
      const observed = report.sources.filter(s => s.path === GAME_PATH + '/' + file);
      assert(observed.length, 'Required original app file was not observed: ' + file);
      assert(observed.every(s => s.responseSha256 === PINS[file].sha256), 'Required source pin differs: ' + file);
    }
    report.actualContainerDownloads = report.sources.filter(s => s.path === GAME_PATH + '/' + CONTAINER);
    assert(report.actualContainerDownloads.length > 0 && report.actualContainerDownloads.every(s => s.bytes === 77824 && s.sqliteHeader === 'SQLite format 3\0'));
    assert.equal(report.workers.length, 1, 'Original app must use exactly one observed generation Worker');
    assert.equal(report.workers[0].url, BASE + 'plants/rules/native78-generation-worker.mjs');
    assert(report.workers[0].closedAt, 'Original single-use Worker did not terminate');
    assert.deepEqual(page.workers().map(worker => worker.url()), []);
    assert(report.visualReview.required.every(file => report.screenshots.some(s => s.file === file)));
    assert.equal(execFileSync('git', ['-C', SOURCE_ROOT, 'status', '--porcelain', '--untracked-files=no'], {encoding: 'utf8'}).trim(), '', 'Source changed during scene smoke');
    report.automatedPass = true; report.elapsedWallMs = Date.now() - started;
    mark('automated-smoke-complete-visual-review-pending');
  } catch (error) {
    report.failure = safeError(error); failure('smoke-failure', report.failure); console.error(report.failure);
    if (page) {
      report.lastState = await page.evaluate(() => window.__trainDriver?.getState?.() || null).catch(error => ({readError: String(error)}));
      if (report.lastState?.nativePlants?.failure) report.originalNativeFailure = report.lastState.nativePlants.failure;
      try {
        const bytes = await page.screenshot({path: path.join(OUT, 'failure.png'), timeout: 15000});
        report.screenshots.push({file: 'failure.png', bytes: bytes.length, sha256: sha(bytes), note: 'Actual unchanged scene at the first blocking stage.'});
      } catch (screenshotError) {report.screenshotErrors.push(safeError(screenshotError));}
      for (let count = -1; count !== pending.length;) {count = pending.length; await Promise.all(pending);}
    }
  } finally {
    write();
    fs.writeFileSync(path.join(OUT, 'REVIEW.txt'), 'Inspect actual unchanged-default-first-screen.png, existing-overview-camera.png and existing-city-camera.png. Automated smoke does not establish pixel visibility or visual acceptance. This is WebKit 26.0 on Linux CI with requested Mesa software WebGL, not a physical iPhone or hardware-FPS test. Source and hashes were not modified. First blocking stage and actual Worker errors remain in result.json.\n');
    clearTimeout(watchdog);
    if (browser) await browser.close().catch(error => {report.closeError = safeError(error); report.automatedPass = false;});
    if (report.errors.length || report.networkErrors.length || report.sourceReadErrors.length) report.automatedPass = false;
    write();
  }
  if (!report.automatedPass) process.exitCode = 1;
}
run().catch(error => {report.failure = safeError(error); failure('unhandled-harness-error', report.failure); write(); process.exitCode = 1;});
