// Coordinate, serialization and atlas scheduling regressions using retained
// native implementations. These are CPU tests, not GPU/visual gates.
import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath, pathToFileURL} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const upstream = path.join(root, 'reference/mp05-studio-r10');
const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'kaopu-mid-surface-test-'));
after(() => fs.rm(temporary, {recursive: true, force: true}));
// Run tools/build.py first, as in CI. Inspect exactly the deliverable modules
// and their recorded transformations, without spawning a hidden build here.
const adaptation = JSON.parse(await fs.readFile(path.join(root, 'dist/SOURCE_PROVENANCE.json'), 'utf8')).coordinateAdaptation;
assert.ok(adaptation, 'Build the mid-surface deliverable before running this regression.');
await fs.mkdir(path.join(temporary, 'coordinate-adapter'), {recursive: true});
for (const item of adaptation.generatedFiles) await fs.copyFile(path.join(root, 'dist', item.path), path.join(temporary, item.path));
for (const name of ['sewn-trims.mjs', 'gpu-seam-frames.mjs', 'material-settings.mjs', 'native/knit-r11.mjs', 'native/leather-seam-r13.mjs',
  'yarn-frame-atlas.mjs', 'material-shaders.mjs', 'surface-binding.mjs', 'panel-grain.mjs', 'geometry-core.mjs',
  'native/cotton-surface.js', 'native/noise-kernel.js']) {
  const destination = path.join(temporary, 'upstream', name);
  await fs.mkdir(path.dirname(destination), {recursive: true});
  await fs.copyFile(path.join(upstream, name), destination);
}
// Use the exact retained library, without installing a second Three.js version.
await fs.mkdir(path.join(temporary, 'node_modules/three'), {recursive: true});
await fs.copyFile(path.join(upstream, 'vendor/three.module.js'), path.join(temporary, 'node_modules/three/index.mjs'));
await fs.writeFile(path.join(temporary, 'node_modules/three/package.json'), JSON.stringify({type: 'module', exports: './index.mjs'}));
const T = await import(pathToFileURL(path.join(temporary, 'node_modules/three/index.mjs')));
const {sewnTrims: originalTrims} = await import(pathToFileURL(path.join(temporary, 'upstream/sewn-trims.mjs')));
const {sewnTrims: adaptedTrims} = await import(pathToFileURL(path.join(temporary, 'coordinate-adapter/sewn-trims-mid-surface.mjs')));
const {withSettings, layerLayout} = await import(pathToFileURL(path.join(temporary, 'upstream/material-settings.mjs')));
const {YarnFrameAtlas} = await import(pathToFileURL(path.join(temporary, 'upstream/yarn-frame-atlas.mjs')));
const catalog = JSON.parse(await fs.readFile(path.join(upstream, 'materials.json'), 'utf8'));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const norm = v => {const l = Math.hypot(...v); return v.map(x => x / Math.max(l, 1e-20));};
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const mix = (a, b, f) => a.map((v, k) => v * (1 - f) + b[k] * f);

test('every derived edit is reversible to the pinned source, with no yarn shader or sampler replacement', async () => {
  assert.equal(adaptation.upstreamFilesModified, false);
  assert.equal(adaptation.generatedFiles.length, 2);
  for (const item of adaptation.generatedFiles) {
    const original = await fs.readFile(path.join(upstream, item.sourcePath.replace('upstream/', '')));
    const derived = await fs.readFile(path.join(temporary, item.path));
    assert.equal(sha(original), item.source.sha256);
    assert.equal(sha(derived), item.derived.sha256);
    let reconstructed = derived.toString('utf8');
    for (const patch of [...item.patches].reverse()) {
      assert.equal(reconstructed.split(patch.after).length - 1, 1);
      reconstructed = reconstructed.replace(patch.after, patch.before);
    }
    assert.deepEqual(Buffer.from(reconstructed), original);
  }
  const source = await fs.readFile(path.join(temporary, 'coordinate-adapter/continuous-solid.mjs'), 'utf8');
  assert.match(source, /uOffset:0,/);
  assert.match(source, /new YarnFrameAtlas\(renderer,base,/);
  assert.match(source, /\.\.\.base,/);
  assert.match(source, /yarnShader}from'\.\.\/upstream\/material-shaders\.mjs'/);
  assert.match(source, /stableSampling} from '\.\.\/upstream\/sampling-stability\.mjs'/);
  for (const name of adaptation.untouchedShaderSources) {
    assert.ok(!adaptation.generatedFiles.some(item => item.sourcePath === 'upstream/' + name));
  }
});

test('curved carrier regression: direct physical middle positions remove the normalized-normal placement bias', () => {
  const normals = [[0, 0, 1], [.8, 0, .6], [0, .8, .6]];
  const positions = [[0, 0, 0], [.05, 0, .01], [0, .05, .02]];
  const sourceOffset = .00392205641708664;
  for (const weights of [[1 / 3, 1 / 3, 1 / 3], [.5, .5, 0], [.2, .3, .5], [-.1, .4, .7]]) {
    const bary = values => [0, 1, 2].map(k => values.reduce((s, v, i) => s + weights[i] * v[k], 0));
    const midpoint = bary(positions), interpolated = bary(normals), n = norm(interpolated);
    const legacyCarrier = positions.map((p, i) => p.map((v, k) => v - normals[i][k] * sourceOffset));
    const legacyCenter = bary(legacyCarrier).map((v, k) => v + n[k] * sourceOffset);
    const oldError = Math.hypot(...legacyCenter.map((v, k) => v - midpoint[k]));
    assert.ok(oldError > .000175, 'The fixture must reproduce error beyond the existing half-side safety amount.');
    const physicalCarrier = positions.map(p => [...p]);
    const center = bary(physicalCarrier).map((v, k) => v + n[k] * 0);
    assert.deepEqual(center, midpoint);
  }
});

// Execute the exact original/derived update statements recorded by build.py,
// with the original YarnFrameAtlas class. The capture renderer observes native
// submission calls; it does not execute GLSL or claim GPU timing/visual coverage.
const continuousItem = adaptation.generatedFiles.find(item => item.sourcePath === 'upstream/continuous-solid.mjs');
const orderingPatch = continuousItem.patches.find(patch => patch.reason.startsWith('Dispose an expired previous atlas'));
assert.ok(orderingPatch, 'The deliverable must contain the audited expired-atlas scheduling patch.');
const continuousSource = await fs.readFile(path.join(temporary, continuousItem.path), 'utf8');
const originalContinuous = await fs.readFile(path.join(upstream, 'continuous-solid.mjs'), 'utf8');
assert.equal(continuousSource.split(orderingPatch.after).length - 1, 1);
assert.equal(originalContinuous.split(orderingPatch.before).length - 1, 1);
const originalOrdering = new Function('c', 'revision', 'now', 'cached', 'release', 'assignUniforms', orderingPatch.before);
const derivedOrdering = new Function('c', 'revision', 'now', 'cached', 'release', 'assignUniforms', orderingPatch.after);
const nativeHelper = name => {
  const line = continuousSource.split(/\r?\n/).find(line => line.trim().startsWith(`function ${name}(`));
  assert.ok(line, `The original ${name} helper must remain present.`);
  return new Function(`return (${line.trim()});`)();
};
const releaseNativeRecord = nativeHelper('release'), assignNativeUniforms = nativeHelper('assignUniforms');

function runAtlasOrdering(order, elapsed, dirty = true) {
  const events = [], memoryBefore = YarnFrameAtlas.memory().residentBytes;
  const existingTarget = {name: 'original-view-target'};
  let target = existingTarget;
  const renderer = {
    capabilities: {maxTextureSize: 2048}, shadowMap: {enabled: true, needsUpdate: true},
    getRenderTarget: () => target, setRenderTarget(value) {target = value;},
    render(scene) {
      assert.equal(this.shadowMap.enabled, false, 'The original atlas pass must still disable shadow rendering.');
      assert.doesNotMatch(scene.children[0].material.fragmentShader, /\buMorph\b/,
        'Morph is applied in the yarn draw; changing its uniform before atlas generation must not alter atlas samples.');
      events.push(`${scene.userData.recordName}:submit`);
    },
  };
  const uniforms = {uMorph: {value: 0}, uCrimp: {value: 1}};
  const interval = new T.DataTexture(new Float32Array([0, 1, 0, 0]), 1, 1, T.RGBAFormat, T.FloatType);
  const record = name => {
    const atlas = new YarnFrameAtlas(renderer, uniforms, interval, 1, 4, 3);
    atlas.scene.userData.recordName = name;
    atlas.revision = 7;
    atlas.target.addEventListener('dispose', () => events.push(`${name}:dispose-atlas`));
    const geometry = new T.BufferGeometry();
    geometry.addEventListener('dispose', () => events.push(`${name}:dispose-geometry`));
    return {atlas, geometry, sides: name === 'current' ? 8 : 6};
  };
  const current = record('current'), previous = record('previous');
  const c = {current, previous, uniforms: {...uniforms, ...current.atlas.uniforms(), ...previous.atlas.uniforms('Previous')}, transitionStart: 1000};
  try {
    order(c, dirty ? 8 : 7, 1000 + elapsed, true, releaseNativeRecord, assignNativeUniforms);
    assert.equal(target, existingTarget, 'Atlas updates must restore the actual previous render target.');
    assert.deepEqual(renderer.shadowMap, {enabled: true, needsUpdate: true});
    return {
      events: [...events], currentSubmissions: current.atlas.submissions, previousSubmissions: previous.atlas.submissions,
      final: {morph: c.uniforms.uMorph.value, previousPresent: c.previous !== null,
        previousTextureIsCurrent: c.uniforms.uPreviousP.value === current.atlas.target.textures[0],
        currentDisposed: current.atlas.disposed, previousDisposed: previous.atlas.disposed},
    };
  } finally {
    releaseNativeRecord(current);
    if (!previous.atlas.disposed) releaseNativeRecord(previous);
    interval.dispose();
    assert.equal(YarnFrameAtlas.memory().residentBytes, memoryBefore);
  }
}

test('expired native atlas is disposed before current deformation update, without changing final morph/uniforms', () => {
  assert.equal(adaptation.expiredAtlasUpdateOrdering.originalMorphDurationMS, 180);
  assert.equal(adaptation.expiredAtlasUpdateOrdering.steadyStateSpeedupClaimed, false);
  for (const elapsed of [180, 720]) {
    const original = runAtlasOrdering(originalOrdering, elapsed), derived = runAtlasOrdering(derivedOrdering, elapsed);
    assert.deepEqual(original.events, ['current:submit', 'previous:submit', 'previous:dispose-atlas', 'previous:dispose-geometry'],
      'The original fixture must reproduce the otherwise unused previous-atlas submission.');
    assert.deepEqual(derived.events, ['previous:dispose-atlas', 'previous:dispose-geometry', 'current:submit']);
    assert.equal(derived.currentSubmissions, 1);
    assert.equal(derived.previousSubmissions, 0);
    assert.deepEqual(derived.final, original.final);
    assert.deepEqual(derived.final, {morph: 1, previousPresent: false, previousTextureIsCurrent: true,
      currentDisposed: false, previousDisposed: true});
  }
});

test('active native morph retains and updates both atlases at the original interpolation value', () => {
  for (const elapsed of [0, 90, 179.9]) {
    const original = runAtlasOrdering(originalOrdering, elapsed), derived = runAtlasOrdering(derivedOrdering, elapsed);
    assert.deepEqual(derived.events, ['current:submit', 'previous:submit']);
    assert.deepEqual(derived, original);
    assert.ok(Math.abs(derived.final.morph - elapsed / 180) < 1e-12);
    assert.equal(derived.final.previousPresent, true);
    assert.equal(derived.final.previousTextureIsCurrent, false);
  }
});

test('unchanged atlas revisions still submit no work; expiry alone is not reported as GPU savings', () => {
  for (const elapsed of [90, 180]) {
    const original = runAtlasOrdering(originalOrdering, elapsed, false), derived = runAtlasOrdering(derivedOrdering, elapsed, false);
    assert.deepEqual(derived, original);
    assert.equal(derived.currentSubmissions, 0);
    assert.equal(derived.previousSubmissions, 0);
  }
});

function fixture() {
  const positions = new Float32Array([0, 0, 0, .08, 0, .01, .08, .08, .03, 0, .08, .02,
    .08, 0, .01, .16, 0, .025, .16, .08, .055, .08, .08, .03]);
  const normals = new Float32Array([[0, 0, 1], [.8, 0, .6], [0, .8, .6], [-.8, 0, .6],
    [.8, 0, .6], [.6, 0, .8], [0, .6, .8], [0, .8, .6]].flat());
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new T.BufferAttribute(normals, 3));
  const native = {geometry};
  const packet = {spec: {panels: ['a', 'b'].map(id => ({id, uvMm: [[0, 0], [80, 0], [80, 80], [0, 80]], boundary: [0, 1, 2, 3]})),
    seams: [{id: 'join', a: {panelId: 'a'}, b: {panelId: 'b'}, stitchVertexPairs: [[1, 0], [2, 3]]}]},
    record: {activeSeams: ['join']}};
  const controls = array => {
    const data = new Float32Array(256 * 4);
    for (let i = 0; i < array.length / 3; i++) data.set([...array.slice(i * 3, i * 3 + 3), 1], i * 4);
    return new T.DataTexture(data, 256, 1, T.RGBAFormat, T.FloatType);
  };
  const uniforms = {uControlPos: {value: controls(positions)}, uControlNorm: {value: controls(normals)}};
  return {native, packet, uniforms};
}

// Capture the real native module's GPU input serialization without a WebGL
// context. This transport never executes or claims to test a GPU draw.
function captureSeamInput() {
  let captured;
  const gl = {MAX_DRAW_BUFFERS: 0x8824, getParameter: () => 8};
  const renderer = {extensions: {has: name => name === 'EXT_color_buffer_float'}, getContext: () => gl,
    getRenderTarget: () => null, setRenderTarget() {}, shadowMap: {enabled: true, needsUpdate: false},
    domElement: {addEventListener() {}, removeEventListener() {}},
    render(scene) {captured = scene.children[0].material.uniforms;}};
  return {renderer, read: () => {assert.ok(captured); return captured;}};
}

function serializedVertex(uniforms, attribute, vertex) {
  const data = uniforms.uTrimSamples.value.image.data;
  const p = uniforms.uControlPos.value.image.data, n = uniforms.uControlNorm.value.image.data;
  const read = (array, i) => Array.from(array.slice(i * 4, i * 4 + 3));
  const center = i => {
    const at = i * 8, a = data[at], b = data[at + 1], f = data[at + 2], height = data[at + 3], lateral = data[at + 4];
    const N = norm(mix(read(n, a), read(n, b), f)), pa = read(p, a), pb = read(p, b);
    const T = norm(pb.map((v, k) => v - pa[k])), B = norm(cross(T, N));
    return {P: mix(pa, pb, f).map((v, k) => v + N[k] * height + B[k] * lateral), N};
  };
  const a = vertex * 4, id = attribute[a], theta = attribute[a + 1], rw = attribute[a + 2], rh = attribute[a + 3];
  const {P, N} = center(id), prev = center(data[id * 8 + 5]).P, next = center(data[id * 8 + 6]).P;
  const T = norm(next.map((v, k) => v - prev[k])), B = norm(cross(T, N)), W = cross(B, T);
  return P.map((v, k) => v + B[k] * Math.cos(theta) * rw + W[k] * Math.sin(theta) * rh);
}

for (const materialID of ['knit-fine-0', 'knit-soft-0', 'denim-raw']) {
  test(`${materialID}: seam sample heights shift once and CPU/GPU input paths remain consistent on a curved carrier`, () => {
    const info = withSettings(catalog.find(row => row.id === materialID));
    const offset = info.family === 'knit' ? layerLayout(info).outer * .001 : (info.geometry.thickness * .6 + .25) * .001;
    const {native, packet, uniforms} = fixture();
    const oldTransport = captureSeamInput(), newTransport = captureSeamInput();
    const source = originalTrims(native, packet, info, {renderer: oldTransport.renderer, uniforms});
    const derived = adaptedTrims(native, packet, info, {renderer: newTransport.renderer, uniforms, carrierOffsetMeters: offset});
    const cpu = adaptedTrims(native, packet, info, {carrierOffsetMeters: offset});
    source.prepare(); derived.prepare();
    const originalInput = oldTransport.read(), derivedInput = newTransport.read();
    const oldData = originalInput.uTrimSamples.value.image.data, newData = derivedInput.uTrimSamples.value.image.data;
    const samples = derivedInput.uTrimCount.value;
    assert.equal(originalInput.uTrimCount.value, samples);
    assert.ok(samples > 10);
    for (let i = 0; i < samples * 8; i++) {
      if (i % 8 === 3) assert.ok(Math.abs(newData[i] - (oldData[i] - offset)) < 6e-10);
      else assert.equal(newData[i], oldData[i], 'Coordinate adaptation must preserve indices, route fractions, lateral values and neighbours.');
    }
    const mesh = derived.group.getObjectByName('native-continuous-thread');
    const cpuMesh = cpu.group.getObjectByName('native-continuous-thread');
    const attributes = mesh.geometry.attributes.aTrim.array;
    const compare = () => {
      const positions = cpuMesh.geometry.attributes.position.array;
      let maxError = 0;
      for (let vertex = 0; vertex < positions.length / 3; vertex++) {
        const gpuInputPoint = serializedVertex(derivedInput, attributes, vertex);
        maxError = Math.max(maxError, ...gpuInputPoint.map((v, k) => Math.abs(v - positions[vertex * 3 + k])));
      }
      assert.ok(maxError < 1e-7, `Native CPU route and serialized GPU route differ by ${maxError} metres.`);
    };
    compare();
    // Exercise the native update path after a nonuniform carrier deformation.
    for (let i = 0; i < native.geometry.attributes.position.count; i++) {
      native.geometry.attributes.position.array[i * 3 + 2] += .003 * Math.sin(i);
      uniforms.uControlPos.value.image.data[i * 4 + 2] = native.geometry.attributes.position.array[i * 3 + 2];
    }
    cpu.update(); derived.update(); derived.prepare(); compare();
    source.dispose(); derived.dispose(); cpu.dispose(); native.geometry.dispose();
    uniforms.uControlPos.value.dispose(); uniforms.uControlNorm.value.dispose();
  });
}
