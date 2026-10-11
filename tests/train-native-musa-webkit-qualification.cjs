'use strict';
// CI-only collection of original native78 Musa output in Node22 and WebKit.
// This does not render a plant, modify source, admit an engine, or test a phone.
// Every original typed-array byte and the complete materialized graph are saved.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const {pathToFileURL} = require('node:url');
const {execFileSync} = require('node:child_process');

const GAME_PATH = 'kaopu-minigame-workbench/voxel-train-study/game/r20-plants-r03';
const REPO_ROOT = path.resolve(__dirname, '..');
// CANDIDATE is a repository-relative game path, never the top-level tests folder.
const CANDIDATE = process.env.CANDIDATE || GAME_PATH;
assert.equal(CANDIDATE, GAME_PATH, 'Unexpected source target');
const ROOT = path.join(REPO_ROOT, CANDIDATE, 'plants');
const OUT = path.resolve(process.env.MUSA_WEBKIT_OUT || 'train-plants-r03-results/webkit-qualification');
const ORIGIN = process.env.PLANTS_QA_ORIGIN || 'http://127.0.0.1:8765/';
assert.equal(ORIGIN, 'http://127.0.0.1:8765/', 'Only the isolated CI localhost source is allowed');
const BASE = new URL(CANDIDATE + '/plants/', ORIGIN).href;
const PLAYWRIGHT_VERSION = '1.57.0';
const SOURCE_BASELINE = '4e999e5de6503d6a09339054a2d8336ba67a7d78';
const SOURCE_HEAD = 'd5f6ed0f41bdd6a4e4d1163190d3cd2135e8b122';
const SOURCE_CLOSURE = '50e4e4c3393417704f95be660c20e6bf15f7efe715ea8b8074a090e7003cd706';
const KNOWN_GEOMETRY = '90ee8e44193b450aecf7c437e45717634010f2d8f87e908dadfcca68eaa0dac9';
const NODE_CONTENT = 'd29345d6d95a25c849930af1cbf4556486bbf1f302a131a9090639a29ee66b2c';
const CHROMIUM_CONTENT = '983c3905c2adfe36079eb29369d37f70ac66bfadbe75fa7e188100be87f0a8a9';
const PROFILE = Object.freeze({condition76: 'normal', habitatForm: 'sheltered', leafNaturalismVersion: 73, material: 'wild-reference', productionSystemVersion: 78, profileVersion: 8, reproductive76: false, seed: 761014, species: 'musa-balbisiana', stage: 'establishing', treeLeafVersion: 75, tropicalLibraryVersion: 76});
const DEPENDENCY_PATHS = Object.freeze({
  'plant-operator': 'rules/plant-operator.mjs',
  'mother-author': 'rules/native78-musa-author.mjs',
  'mother-runtime': 'rules/native78-runtime.mjs',
  'three-module': 'vendor/three.module.min.js',
  'three-core': 'vendor/three.core.min.js',
  'native-equivalence': 'rules/native78-equivalence.mjs',
  'generation-worker': 'rules/native78-generation-worker.mjs'
});
const SOURCE_PINS = Object.freeze({
  "rules/plant-operator.mjs": {
    "bytes": 12271,
    "sha256": "082557267472bcf65ac1a8634172aea7c7665be36fef8d09362dd32fdda3286f"
  },
  "rules/native78-musa-author.mjs": {
    "bytes": 469608,
    "sha256": "591a55da33fccaad7da0211bc4fce44313b9a5cb1f7af5ecb57a7b13d99bfc6f"
  },
  "rules/native78-runtime.mjs": {
    "bytes": 187669,
    "sha256": "5cf8b6d78b5bc36e10ba7574f93d3de6ed71410ef0fa5ec5ade96d710c271850"
  },
  "vendor/three.module.min.js": {
    "bytes": 338836,
    "sha256": "06552c54e4071fbc7305117aafe6765d92c5d2a2a83507d4f05b9bf4f3d4d463"
  },
  "vendor/three.core.min.js": {
    "bytes": 380374,
    "sha256": "79f2b4f58d3e99a9948a4d3b7f6d5c2daf705bdefe9fb82ebec715623966551c"
  },
  "rules/native78-equivalence.mjs": {
    "bytes": 1531,
    "sha256": "4bbf0ff029270014e43ad03e5b2cd3aed09099958f40b80671ac8aad19460af1"
  },
  "rules/native78-generation-worker.mjs": {
    "bytes": 13675,
    "sha256": "afc56663fca4e544c1919f3c6fcf50154001450701e7aff3f8760974fda0431b"
  },
  "native-codec/codec.mjs": {
    "bytes": 11189,
    "sha256": "89f1ae51e5c781b8c4b3ce096bcc9b46cff9ba2bfa71b3860384d0bc200c1e9e"
  },
  "native-codec/template-data.mjs": {
    "bytes": 108725,
    "sha256": "7901516d7ae306c2f9d2ab7962ef2be5ae7b53d677260c744544e44d5df7de1a"
  },
  "native-codec/dependency-manifest.json": {
    "bytes": 5129,
    "sha256": "3e70600eff2ddc2a266f86d902ab119e4282cbb701ab67e9486a1e73161c90ed"
  },
  "native-codec/objects/establishing-musa.KaoPu": {
    "bytes": 77824,
    "sha256": "95116d0aa78446bf0122fb6877fd6de8732036337f338ed21f295819421cd90e"
  },
  "native-codec/objects/establishing-musa.expected.json": {
    "bytes": 5431,
    "sha256": "9dc90b1b1a39b1db1cc0721525394faaeb2eaf7d808d1780fc840efe895bea3e"
  },
  "native78-qualification-snapshot.mjs": {
    "bytes": 9421,
    "sha256": "7fb7d667fad1627bd3075a313097bd18a269c0921df7cec0da759c7b2a442160"
  },
  "rules/native78-source-closure.json": {
    "bytes": 18912,
    "sha256": "50e4e4c3393417704f95be660c20e6bf15f7efe715ea8b8074a090e7003cd706"
  },
  "rules/native78-source-proof.json": {
    "bytes": 11756,
    "sha256": "ee491375feb401a3ee70193a0152ec40af0a119c750a7292f1a3976358dc0516"
  }
});
const GEOMETRY_FIELDS = [
  ['positions', 'Float32Array', 61896], ['normals', 'Float32Array', 61896],
  ['colors', 'Float32Array', 61896], ['uvs', 'Float32Array', 41264],
  ['indices', 'Uint32Array', 108990], ['windWeights', 'Float32Array', 20632],
  ['windChannels', 'Float32Array', 82528], ['windAnchors', 'Float32Array', 61896],
  ['windLeafAxes', 'Float32Array', 61896], ['windLeafNormals', 'Float32Array', 61896],
  ['bladeRanges77', 'Uint32Array', 112]
];
const ARRAY_MANIFEST = [
  ...GEOMETRY_FIELDS.map(([key, type, length]) => ({path: 'specimen.geometry.' + key, type, length, bytes: length * 4})),
  ...[16384, 16384, 16384, 262144, 262144, 262144].map((length, i) => ({path: `specimen.surfaces.resources[${i}].bytes`, type: 'Uint8Array', length, bytes: length})),
  {path: 'specimen.growth.bladeStorage[0]', type: 'Float64Array', length: 1232, bytes: 9856}
];
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const canonical = v => v && typeof v === 'object' ? Array.isArray(v) ? v.map(canonical) : Object.fromEntries(Object.keys(v).sort().map(k => [k, canonical(v[k])])) : v;
const equal = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
const encodeNumber = v => Object.is(v, -0) ? '-0' : Number.isFinite(v) ? v : String(v);
const littleEndian = new Uint8Array(new Uint16Array([1]).buffer)[0] === 1;
const rawBytes = a => Buffer.from(a.buffer, a.byteOffset, a.byteLength);
const shape = item => ({path: item.path, type: item.type, length: item.length, bytes: item.bytes});
const report = {
  schema: 'native78-musa-webkit-collection/1', pass: false, measurementComplete: false,
  releaseQualified: false, mode: 'collection-only', engineAdmitted: false,
  startedAt: new Date().toISOString(), commit: process.env.GITHUB_SHA || null,
  sourceBaselineCommit: SOURCE_BASELINE, sourcePath: CANDIDATE,
  scope: 'Original profile78 -> generateTropical78(compactBlades76:true) -> fixedAsset76. Exact source/input bytes, all 18 typed arrays and complete materialized production/organ graph. No renderer, runtime rewrite, quantization or tolerance.',
  deviceScope: 'Official Playwright WebKit on Ubuntu CI. This is not Safari on an actual iPhone, a physical-device test, or a graphics/FPS test.',
  admission: 'No WebKit hash pair is automatically admitted, including when it equals a known Node or Chromium pair. Every new engine/output requires separate evidence review and an explicitly pinned release change.',
  knownReference: {geometryHash: KNOWN_GEOMETRY, node22And24ContentHash: NODE_CONTENT, chromium143ContentHash: CHROMIUM_CONTENT},
  sourceFiles: [], arrays: [], rawArtifacts: [], errors: [], networkErrors: []
};
fs.mkdirSync(OUT, {recursive: true});
function saveJSON(relative, value) {
  const bytes = Buffer.from(JSON.stringify(value, null, 2) + '\n');
  fs.mkdirSync(path.dirname(path.join(OUT, relative)), {recursive: true});
  fs.writeFileSync(path.join(OUT, relative), bytes);
  return {file: relative, bytes: bytes.length, sha256: sha(bytes)};
}
const write = () => saveJSON('result.json', report);
function saveCapture(engine, capture) {
  const graphArtifact = saveJSON(engine + '/graph.json', capture.graph);
  report.rawArtifacts.push(graphArtifact);
  const index = capture.arrays.map(({array, ...meta}, i) => {
    const file = `${engine}/arrays/${String(i).padStart(2, '0')}-${meta.type}.bin`;
    const bytes = rawBytes(array);
    fs.mkdirSync(path.dirname(path.join(OUT, file)), {recursive: true});
    fs.writeFileSync(path.join(OUT, file), bytes);
    const entry = {...meta, file, sha256: sha(bytes), byteOffset: array.byteOffset, backingBufferBytes: array.buffer.byteLength, elementBytes: array.BYTES_PER_ELEMENT};
    report.rawArtifacts.push({file, bytes: bytes.length, sha256: entry.sha256});
    return entry;
  });
  report.rawArtifacts.push(saveJSON(engine + '/arrays.json', index));
  return {graphArtifact, index};
}
function numericStats(array) {
  const result = {nanCount: 0, infinityCount: 0, positiveZeroCount: 0, negativeZeroCount: 0};
  for (const value of array) {
    if (Number.isNaN(value)) result.nanCount++;
    else if (!Number.isFinite(value)) result.infinityCount++;
    else if (value === 0) result[Object.is(value, -0) ? 'negativeZeroCount' : 'positiveZeroCount']++;
  }
  return result;
}
function compareArray(nodeItem, browserMeta, browserBytes) {
  const meta = shape(nodeItem), actual = shape(browserMeta);
  const result = {...meta, browserShape: actual, shapeExact: equal(meta, actual), nodeSha256: sha(rawBytes(nodeItem.array)), browserSha256: sha(browserBytes), byteEqual: rawBytes(nodeItem.array).equals(browserBytes), nodeStats: numericStats(nodeItem.array)};
  if (!result.shapeExact || report.node.littleEndian !== report.browser.littleEndian) return {...result, comparable: false};
  const copied = Uint8Array.from(browserBytes);
  const other = new nodeItem.array.constructor(copied.buffer);
  Object.assign(result, {comparable: true, differentValues: 0, maxAbs: 0, maxRel: 0, signedZeroDifferences: 0, browserStats: numericStats(other), examples: []});
  const differencesFile = `differences/array-${String(report.arrays.length).padStart(2, '0')}.ndjson`;
  const handle = fs.openSync(path.join(OUT, differencesFile), 'w');
  try {
    for (let i = 0; i < nodeItem.array.length; i++) {
      const x = nodeItem.array[i], y = other[i];
      if (Object.is(x, y)) continue;
      result.differentValues++;
      if (x === 0 && y === 0) result.signedZeroDifferences++;
      const abs = Math.abs(x - y);
      if (Number.isFinite(abs)) {
        result.maxAbs = Math.max(result.maxAbs, abs);
        result.maxRel = Math.max(result.maxRel, abs / Math.max(Math.abs(x), Math.abs(y), Number.MIN_VALUE));
      }
      const record = {index: i, node: encodeNumber(x), webkit: encodeNumber(y), abs: encodeNumber(abs)};
      if (result.examples.length < 32) result.examples.push(record);
      fs.writeSync(handle, JSON.stringify(record) + '\n');
    }
  } finally {fs.closeSync(handle);}
  const differencesBytes = fs.readFileSync(path.join(OUT, differencesFile));
  result.completeDifferences = {file: differencesFile, bytes: differencesBytes.length, sha256: sha(differencesBytes)};
  report.rawArtifacts.push(result.completeDifferences);
  return result;
}
function describe(specimen, asset, capture, calls, elapsedMs, resourceVerification) {
  return {
    elapsedMs, randomCalls: calls, geometryHash: asset?.geometryHash || null,
    contentHash: asset?.contentHash || null, assetId: asset?.assetId || null,
    fixedAssetMetadata: asset ? Object.fromEntries(Object.entries(asset).filter(([key]) => key !== 'specimen')) : null,
    triangleCount: specimen.geometry.indices.length / 3, vertices: specimen.geometry.positions.length / 3,
    axes: specimen.growth.axes.length, pseudostems: specimen.growth.axes.filter(a => a.role === 'pseudostem').length,
    leaves: specimen.growth.blades.length, production: specimen.production.status,
    profile: specimen.growth.profile, graphSha256: sha(JSON.stringify(capture.graph)),
    arrayFields: capture.arrays.map(shape), resourceVerification,
    resourceHashes: specimen.surfaces.resources.map(r => ({id: r.id, width: r.width, height: r.height, colorSpace: r.colorSpace, source: r.source, bytes: r.bytes.length, sha256: sha(r.bytes)}))
  };
}
function safeError(error) {
  // Keep artifact failure context without publishing machine-specific absolute paths.
  return String(error?.stack || error).split(REPO_ROOT).join('<repo>').split(OUT).join('<artifacts>');
}
async function verifySource() {
  const checkout = execFileSync('git', ['-C', REPO_ROOT, 'rev-parse', 'HEAD'], {encoding: 'utf8'}).trim();
  assert.equal(checkout, process.env.GITHUB_SHA, 'Harness must run from this exact CI checkout');
  report.checkout = checkout;
  for (const [file, pin] of Object.entries(SOURCE_PINS)) {
    const bytes = fs.readFileSync(path.join(ROOT, file));
    const actual = {file, bytes: bytes.length, sha256: sha(bytes), expected: pin};
    report.sourceFiles.push(actual);
    assert.equal(actual.bytes, pin.bytes, 'Source size changed: ' + file);
    assert.equal(actual.sha256, pin.sha256, 'Source hash changed: ' + file);
  }
  const helper = await import(pathToFileURL(path.join(ROOT, 'native78-qualification-snapshot.mjs')).href);
  const codec = await import(pathToFileURL(path.join(ROOT, 'native-codec/codec.mjs')).href);
  const author = await import(pathToFileURL(path.join(ROOT, DEPENDENCY_PATHS['mother-author'])).href);
  const bytes = new Uint8Array(fs.readFileSync(path.join(ROOT, 'native-codec/objects/establishing-musa.KaoPu')));
  assert.equal(bytes.byteLength, 77824);
  assert.equal(Buffer.from(bytes.subarray(0, 16)).toString('ascii'), 'SQLite format 3\0');
  const recipe = await codec.decode(bytes);
  const expected = JSON.parse(fs.readFileSync(path.join(ROOT, 'native-codec/objects/establishing-musa.expected.json')));
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'native-codec/dependency-manifest.json')));
  const closure = JSON.parse(fs.readFileSync(path.join(ROOT, 'rules/native78-source-closure.json')));
  assert.deepEqual(canonical(recipe), canonical(expected));
  assert.deepEqual(canonical(recipe.profile), canonical(PROFILE));
  assert.deepEqual(recipe.source, {closureSha256: SOURCE_CLOSURE, head: SOURCE_HEAD});
  assert.equal(closure.sourceHead, SOURCE_HEAD);
  assert.equal(closure.bundle.sha256, SOURCE_PINS[DEPENDENCY_PATHS['mother-author']].sha256);
  assert.deepEqual(canonical(codec.pinnedDependencies()), canonical(manifest.dependencies));
  assert.deepEqual(canonical(recipe.dependencies), canonical(manifest.dependencies));
  assert.deepEqual(canonical(codec.pinnedResources()), canonical(manifest.resources));
  assert.deepEqual(canonical(recipe.resources), canonical(manifest.resources));
  assert.deepEqual(manifest.dependencies.map(d => d.id).sort(), Object.keys(DEPENDENCY_PATHS).sort());
  assert.equal(manifest.dependencies.length, 7);
  assert.equal(manifest.resources.length, 6);
  assert.equal(manifest.resources.reduce((sum, r) => sum + r.bytes, 0), 835584);
  const deps = {};
  for (const dep of manifest.dependencies) {
    const file = DEPENDENCY_PATHS[dep.id], data = new Uint8Array(fs.readFileSync(path.join(ROOT, file)));
    assert.equal(data.byteLength, dep.bytes);
    assert.equal(sha(data), dep.sha256);
    deps[dep.id] = data;
  }
  await codec.verifyDependencyBytes(deps);
  assert(Buffer.from(await codec.encode(recipe)).equals(Buffer.from(bytes)), 'Exact SQLite roundtrip differs');
  report.input = {bytes: bytes.length, sha256: sha(bytes), profile: recipe.profile, source: recipe.source, dependencies: manifest.dependencies, resources: manifest.resources, sqliteRoundtripExact: true};
  report.rawArtifacts.push(saveJSON('source/decoded-recipe.json', recipe));
  report.rawArtifacts.push(saveJSON('source/pinned-files.json', SOURCE_PINS));
  return {helper, codec, author, recipe, manifest};
}
async function run() {
  let browser;
  write();
  const watchdog = setTimeout(() => {
    report.failure = 'The CI-only collection exceeded its 420-second runtime budget.';
    write();
    Promise.resolve(browser?.close()).finally(() => process.exit(1));
    setTimeout(() => process.exit(1), 3000).unref();
  }, 420000);
  try {
    assert.equal(process.env.GITHUB_ACTIONS, 'true', 'Browser execution is limited to the separately authorized GitHub Actions workflow');
    assert.equal(Number(process.versions.node.split('.')[0]), 22, 'Actual Node22 is required');
    report.nodeRuntime = {version: process.version, versions: process.versions, platform: process.platform, arch: process.arch};
    const {helper, codec, author, recipe, manifest} = await verifySource();
    const start = performance.now(), random = Math.random;
    let calls = 0, specimen, asset, resourceVerification = {pass: false};
    try {
      Math.random = () => {calls++; return random();};
      specimen = author.generateTropical78(author.profile78(recipe.profile.species, recipe.profile), {compactBlades76: true});
      try {asset = await author.fixedAsset76(specimen);} catch (error) {report.errors.push({phase: 'node-fixed-asset', error: safeError(error)});}
    } finally {Math.random = random;}
    const capture = helper.captureNativeSpecimen(specimen);
    const nodeSaved = saveCapture('node', capture);
    try {await codec.verifyResourceBytes(Object.fromEntries(specimen.surfaces.resources.map(r => [r.id, r.bytes]))); resourceVerification = {pass: true};}
    catch (error) {resourceVerification.error = safeError(error);}
    report.node = {runtime: process.version, littleEndian, ...describe(specimen, asset, capture, calls, performance.now() - start, resourceVerification), raw: nodeSaved};
    report.node.graphSelf = helper.compareNativeGraphs(capture.graph, capture.graph);
    write();

    report.playwrightVersion = require('playwright/package.json').version;
    assert.equal(report.playwrightVersion, PLAYWRIGHT_VERSION, 'Official pinned Playwright version required');
    const {webkit} = require('playwright');
    browser = await webkit.launch({headless: true});
    report.webkitVersion = browser.version();
    const context = await browser.newContext({serviceWorkers: 'block'});
    const page = await context.newPage();
    page.setDefaultTimeout(120000);
    page.setDefaultNavigationTimeout(30000);
    page.on('pageerror', error => report.errors.push({phase: 'webkit-page', error: safeError(error)}));
    page.on('requestfailed', request => report.networkErrors.push({url: request.url(), error: request.failure()?.errorText || null}));
    await page.goto(BASE + 'native-codec/README.md', {waitUntil: 'load'});
    report.browserEnvironment = await page.evaluate(() => ({userAgent: navigator.userAgent, platform: navigator.platform, vendor: navigator.vendor, secureContext: isSecureContext, hardwareConcurrency: navigator.hardwareConcurrency}));
    write();
    report.httpBytes = [];
    for (const file of Object.keys(SOURCE_PINS)) {
      const response = await page.request.get(BASE + file), data = await response.body();
      const check = {file, status: response.status(), bytes: data.length, sha256: sha(data), exact: response.ok() && data.length === SOURCE_PINS[file].bytes && sha(data) === SOURCE_PINS[file].sha256};
      report.httpBytes.push(check);
      assert(check.exact, 'CI HTTP source bytes changed: ' + file);
    }
    report.browser = await page.evaluate(async ({base, paths}) => {
      const hex = async bytes => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), value => value.toString(16).padStart(2, '0')).join('');
      const helper = await import(base + 'native78-qualification-snapshot.mjs');
      const codec = await import(base + 'native-codec/codec.mjs');
      const author = await import(base + paths['mother-author']);
      const input = new Uint8Array(await (await fetch(base + 'native-codec/objects/establishing-musa.KaoPu')).arrayBuffer());
      const recipe = await codec.decode(input), deps = {}, dependencyBytes = [];
      for (const dep of codec.pinnedDependencies()) {
        const bytes = new Uint8Array(await (await fetch(base + paths[dep.id])).arrayBuffer());
        deps[dep.id] = bytes;
        dependencyBytes.push({id: dep.id, bytes: bytes.length, sha256: await hex(bytes)});
      }
      await codec.verifyDependencyBytes(deps);
      const started = performance.now(), random = Math.random;
      let calls = 0, specimen, asset, fixedAssetError = null;
      try {
        Math.random = () => {calls++; return random();};
        specimen = author.generateTropical78(author.profile78(recipe.profile.species, recipe.profile), {compactBlades76: true});
        try {asset = await author.fixedAsset76(specimen);} catch (error) {fixedAssetError = String(error.stack || error);}
      } finally {Math.random = random;}
      const capture = helper.captureNativeSpecimen(specimen);
      window.__musaWebkitCapture = capture;
      let resourceVerification = {pass: false};
      try {await codec.verifyResourceBytes(Object.fromEntries(specimen.surfaces.resources.map(r => [r.id, r.bytes]))); resourceVerification = {pass: true};}
      catch (error) {resourceVerification.error = String(error.stack || error);}
      return {
        engine: 'webkit', userAgent: navigator.userAgent, platform: navigator.platform,
        vendor: navigator.vendor, language: navigator.language,
        littleEndian: new Uint8Array(new Uint16Array([1]).buffer)[0] === 1,
        elapsedMs: performance.now() - started, randomCalls: calls,
        geometryHash: asset?.geometryHash || null, contentHash: asset?.contentHash || null,
        assetId: asset?.assetId || null, fixedAssetError,
        fixedAssetMetadata: asset ? Object.fromEntries(Object.entries(asset).filter(([key]) => key !== 'specimen')) : null,
        triangleCount: specimen.geometry.indices.length / 3, vertices: specimen.geometry.positions.length / 3,
        axes: specimen.growth.axes.length, pseudostems: specimen.growth.axes.filter(a => a.role === 'pseudostem').length,
        leaves: specimen.growth.blades.length, production: specimen.production.status,
        profile: specimen.growth.profile, inputSha256: await hex(input), decodedRecipe: recipe,
        dependencyBytes, resourceVerification,
        graphSha256: await hex(new TextEncoder().encode(JSON.stringify(capture.graph))),
        arrayFields: capture.arrays.map(({array, ...meta}) => meta),
        arrayStorage: capture.arrays.map(({array}) => ({byteOffset: array.byteOffset, backingBufferBytes: array.buffer.byteLength, elementBytes: array.BYTES_PER_ELEMENT})),
        arrayHashes: await Promise.all(capture.arrays.map(({array}) => hex(new Uint8Array(array.buffer, array.byteOffset, array.byteLength)))),
        arrayStats: capture.arrays.map(({array}) => {
          const stats = {nanCount: 0, infinityCount: 0, positiveZeroCount: 0, negativeZeroCount: 0};
          for (const value of array) {
            if (Number.isNaN(value)) stats.nanCount++;
            else if (!Number.isFinite(value)) stats.infinityCount++;
            else if (value === 0) stats[Object.is(value, -0) ? 'negativeZeroCount' : 'positiveZeroCount']++;
          }
          return stats;
        }),
        resourceHashes: await Promise.all(specimen.surfaces.resources.map(async r => ({id: r.id, width: r.width, height: r.height, colorSpace: r.colorSpace, source: r.source, bytes: r.bytes.length, sha256: await hex(r.bytes)})))
      };
    }, {base: BASE, paths: DEPENDENCY_PATHS});
    report.browser.runtime = report.webkitVersion;
    write();
    const graph = await page.evaluate(() => window.__musaWebkitCapture.graph);
    const graphArtifact = saveJSON('webkit/graph.json', graph);
    report.rawArtifacts.push(graphArtifact);
    report.rawArtifacts.push(saveJSON('webkit/decoded-recipe.json', report.browser.decodedRecipe));
    report.browser.graphSelf = helper.compareNativeGraphs(graph, graph);
    const browserArrays = [], received = [];
    fs.mkdirSync(path.join(OUT, 'webkit/arrays'), {recursive: true});
    fs.mkdirSync(path.join(OUT, 'differences'), {recursive: true});
    // Save every actual WebKit array before deciding whether any shape/hash is valid.
    for (let index = 0; index < report.browser.arrayFields.length; index++) {
      const meta = report.browser.arrayFields[index];
      assert(Number.isSafeInteger(meta.bytes) && meta.bytes >= 0 && meta.bytes <= 67108864, 'Unexpected raw-array size');
      const bytes = Buffer.alloc(meta.bytes);
      for (let off = 0; off < meta.bytes; off += 1048576) {
        const part = await page.evaluate(({index, off}) => {
          const a = window.__musaWebkitCapture.arrays[index].array;
          const bytes = new Uint8Array(a.buffer, a.byteOffset + off, Math.min(1048576, a.byteLength - off)), parts = [];
          for (let i = 0; i < bytes.length; i += 16384) parts.push(String.fromCharCode(...bytes.subarray(i, i + 16384)));
          return btoa(parts.join(''));
        }, {index, off});
        const decoded = Buffer.from(part, 'base64');
        assert.equal(decoded.length, Math.min(1048576, meta.bytes - off), 'Incomplete raw-array transfer');
        bytes.set(decoded, off);
      }
      const file = `webkit/arrays/${String(index).padStart(2, '0')}-${meta.type}.bin`;
      assert(/^(?:Float32Array|Float64Array|Uint8Array|Uint16Array|Uint32Array|Int8Array|Int16Array|Int32Array)$/.test(meta.type), 'Unexpected native typed array type');
      fs.writeFileSync(path.join(OUT, file), bytes);
      const entry = {...meta, ...report.browser.arrayStorage[index], file, sha256: sha(bytes), browserComputedSha256: report.browser.arrayHashes[index], stats: report.browser.arrayStats[index]};
      browserArrays.push(entry); received.push(bytes);
      report.rawArtifacts.push({file, bytes: bytes.length, sha256: entry.sha256});
      write();
    }
    report.rawArtifacts.push(saveJSON('webkit/arrays.json', browserArrays));
    report.browser.raw = {graphArtifact, index: browserArrays};
    for (const item of capture.arrays) {
      const index = report.browser.arrayFields.findIndex(meta => meta.path === item.path);
      if (index === -1) report.arrays.push({...shape(item), missingInWebkit: true, shapeExact: false, comparable: false, byteEqual: false});
      else report.arrays.push(compareArray(item, report.browser.arrayFields[index], received[index]));
      write();
    }
    report.graph = helper.compareNativeGraphs(capture.graph, graph);
    report.rawArtifacts.push(saveJSON('differences/graph-summary.json', report.graph));
    report.rawArtifacts.push(saveJSON('expected-array-manifest.json', ARRAY_MANIFEST));
    const numericFinite = s => s && s.nanCount === 0 && s.infinityCount === 0;
    const graphFinite = g => ['nodeNaNs', 'browserNaNs', 'nodeInfinities', 'browserInfinities'].every(key => g[key] === 0);
    const all = predicate => ['node', 'browser'].every(engine => predicate(report[engine]));
    const topology = s => s.triangleCount === 36330 && s.vertices === 20632 && s.axes === 64 && s.pseudostems === 4 && s.leaves === 28 && s.production === 'passed';
    report.observedPairMatches = Object.fromEntries(['node', 'browser'].map(engine => {
      const s = report[engine];
      return [engine, s.geometryHash !== KNOWN_GEOMETRY ? null : s.contentHash === NODE_CONTENT ? 'known-node-pair-bytes-only' : s.contentHash === CHROMIUM_CONTENT ? 'known-chromium-pair-bytes-only' : null];
    }));
    report.gates = {
      exactSourcePins: report.sourceFiles.length === Object.keys(SOURCE_PINS).length && report.httpBytes.every(item => item.exact),
      exactSevenDependencies: equal(report.browser.dependencyBytes, manifest.dependencies.map(({id, bytes, sha256}) => ({id, bytes, sha256}))),
      sameActualSQLiteAndRecipe: report.input.sha256 === report.browser.inputSha256 && equal(recipe, report.browser.decodedRecipe),
      exactOriginalScope: equal(report.input.profile, PROFILE) && report.input.source.head === SOURCE_HEAD && report.input.source.closureSha256 === SOURCE_CLOSURE,
      exactNodeReferencePair: report.node.geometryHash === KNOWN_GEOMETRY && report.node.contentHash === NODE_CONTENT,
      sameByteOrder: report.node.littleEndian === report.browser.littleEndian,
      exactEighteenArrayManifest: all(s => equal(s.arrayFields, ARRAY_MANIFEST)) && report.arrays.length === 18 && report.arrays.every(item => item.shapeExact),
      exactElevenGeometryArrays: report.arrays.filter(item => item.path.startsWith('specimen.geometry.')).length === 11 && report.arrays.filter(item => item.path.startsWith('specimen.geometry.')).every(item => item.byteEqual && item.differentValues === 0 && item.maxAbs === 0 && item.signedZeroDifferences === 0),
      exactKnownGeometryHash: all(s => s.geometryHash === KNOWN_GEOMETRY),
      exactIndexAndRangeBytes: report.arrays.filter(item => /specimen\.geometry\.(indices|bladeRanges77)$/.test(item.path)).length === 2 && report.arrays.filter(item => /specimen\.geometry\.(indices|bladeRanges77)$/.test(item.path)).every(item => item.byteEqual),
      exactSixResources: all(s => s.resourceVerification.pass && equal(s.resourceHashes, manifest.resources)) && report.arrays.filter(item => item.path.startsWith('specimen.surfaces.resources')).length === 6 && report.arrays.filter(item => item.path.startsWith('specimen.surfaces.resources')).every(item => item.byteEqual),
      finiteAllArrayValues: report.arrays.every(item => item.comparable && numericFinite(item.nodeStats) && numericFinite(item.browserStats)),
      noArraySignedZeroDifferences: report.arrays.every(item => item.comparable && item.signedZeroDifferences === 0),
      complete5914NumberGraphs: all(s => s.graphSelf.numbers === 5914) && report.graph.numbers === 5914 && report.graph.nonNumericDifferences === 0,
      finiteGraphs: all(s => graphFinite(s.graphSelf)) && graphFinite(report.graph),
      noGraphSignedZeroDifferences: report.graph.signedZeroDifferences === 0,
      exactTopologyAndCounts: all(topology),
      noUnseededRandom: all(s => s.randomCalls === 0),
      bothOriginalFixedAssets: !!report.node.geometryHash && !!report.node.contentHash && !!report.browser.geometryHash && !!report.browser.contentHash && !report.browser.fixedAssetError,
      noRuntimeOrNetworkErrors: report.errors.length === 0 && report.networkErrors.length === 0,
      all18RawArraysPreserved: nodeSaved.index.length === 18 && browserArrays.length === 18,
      graphTransportExact: sha(JSON.stringify(graph)) === report.browser.graphSha256,
      allRawArrayTransfersExact: browserArrays.every(item => item.sha256 === item.browserComputedSha256)
    };
    report.observations = {
      allArraysByteExact: report.arrays.every(item => item.byteEqual),
      completeGraphExact: report.graph.exact,
      completeContentHashExact: report.node.contentHash === report.browser.contentHash,
      // These are measurements only. There is deliberately no numeric envelope.
      bladeStorage: report.arrays.find(item => item.path === 'specimen.growth.bladeStorage[0]'),
      graph: report.graph,
      rawEvidence: 'Both graph.json files are complete materialized captures; arrays.json identifies every exact binary file. Per-array NDJSON records include every differing numeric index, without a truncated difference list.'
    };
    report.measurementComplete = true;
    report.pass = Object.values(report.gates).every(Boolean);
    report.collectionStatus = report.pass ? 'complete-integrity-and-exact-geometry-validated-awaiting-engine-review' : 'complete-with-failed-integrity-or-exact-geometry-gates';
    report.finishedAt = new Date().toISOString();
    if (!report.pass) throw Error('WebKit collection completed with failed strict gates; actual raw output is preserved.');
  } catch (error) {
    report.pass = false;
    report.failure = safeError(error);
    console.error(report.failure);
  } finally {
    clearTimeout(watchdog);
    write();
    if (browser) await browser.close().catch(error => {report.closeError = safeError(error); write();});
  }
  if (!report.pass) process.exitCode = 1;
}
run().catch(error => {report.failure = safeError(error); write(); process.exitCode = 1;});
