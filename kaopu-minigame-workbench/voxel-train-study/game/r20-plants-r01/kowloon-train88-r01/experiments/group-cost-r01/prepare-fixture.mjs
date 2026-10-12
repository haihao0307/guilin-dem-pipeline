// Offline preparation only. Never starts a host, browser, GPU, or upload.
// The published fixture/test are self-contained; the downloaded evidence is
// required only to regenerate this file, not to consume or test it.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('../../', import.meta.url);
const sourceSHA256 = '588042e14707b2dcab1e890c18fca2afdd20104eaecb7a5d3b25baa71c6a8d36';
const executionSHA256 = '30627a5280f8c78998812fc10fc544629a88f0d0844ff997eac1a6d7e9ca21da';
const referenceCommit = '582ed63702f4f44e79ca6299326717bf86b57710';
const referenceRun = 38301469129;
const referenceArtifact = 11771451161;
const artifactSHA256 = '3813e803a74cea78f04e686bf2c0b8300f3f7695c4f21147e66f2cc6c90f70e1';
const sourceDirectory = 'qa/evidence-582ed637/train88-active-domain-host-results/';
const peerDirectory = 'qa/evidence-25c46099/train88-native-focus-results/';
const activeFixtureSuffix = 'kaopu-minigame-workbench/voxel-train-study/game/r20-plants-r01/kowloon-train88-r01/experiments/active-query-r01/fixture.json';
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const bytes = path => readFileSync(new URL(path, root));
const json = path => JSON.parse(bytes(path));
const jsonHash = value => sha256(JSON.stringify(value));
const receipt = json(sourceDirectory + 'receipt.json');
const peerReceipt = json(peerDirectory + 'receipt.json');
const state = receipt.firstFrame;
const peerState = peerReceipt.blocks.find(block => block.name === 'belfry-stone-arch').state;
const sharedState = state.kowloonFunction.shared.state;
const peerSharedState = peerState.kowloonFunction.shared.state;
const footprintPath = peerDirectory + 'belfry-stone-arch-attachments.json';
const footprint = json(footprintPath).footprint;
const activePath = 'qa/evidence-582ed637/' + activeFixtureSuffix;
const peerActivePath = 'qa/evidence-25c46099/' + activeFixtureSuffix;
const active = json(activePath);
const peerActive = json(peerActivePath);
const camera = active.views.find(view => view.name === 'main').camera;
const peerCamera = peerActive.views.find(view => view.name === 'main').camera;

assert.equal(receipt.commit, referenceCommit);
assert.equal(receipt.status, 'small-host-active-domain-full-terminal-equivalence-passed');
assert.deepEqual(receipt.diagnosticMain, [32, 24]);
assert.deepEqual(receipt.viewport, [640, 426]);
assert.equal(sha256(bytes('qa/evidence-582ed637/artifact.zip')), artifactSHA256);
assert.equal(peerReceipt.commit, '25c460991397665e2ad9068e79a93b2b16b80484');
for (const frame of [state, peerState]) {
  assert.equal(frame.tick, 240);
  assert.equal(frame.kowloonFunction.sourceSHA256, sourceSHA256);
  assert.equal(frame.kowloonFunction.executionSourceSHA256, executionSHA256);
}
// Reusing the native footprint is permitted only after the original camera,
// projection, origin and frozen simulation/material state are proved equal.
const checkedStatePaths = ['tick', 'distance', 'camera', 'cameraProjection', 'viewSettings', 'stationSiting'];
for (const key of checkedStatePaths) assert.deepEqual(state[key], peerState[key], key);
assert.deepEqual(sharedState, peerSharedState, 'entire shared station state');
assert.deepEqual(camera, peerCamera, 'original projection and camera-to-world matrices');
for (const input of [active, peerActive]) {
  assert.deepEqual(input.origin, sharedState.origin);
  assert.equal(input.clock, sharedState.timetableMinutes);
  assert.equal(input.age, sharedState.materialAge);
  assert.equal(input.sourceSHA256, sourceSHA256);
  assert.equal(input.executionSourceSHA256, executionSHA256);
}
assert.equal(sharedState.tick, 240);
assert.equal(sharedState.timetableMinutes, 380.1999999999998);
assert.equal(sharedState.materialAge, 0.58);
assert.equal(footprint.materialAge, sharedState.materialAge);

// Independent column-major check of the original transform:
// localToWorld rows = [0,0,-1,ox; 0,1,0,oy; 1,0,0,oz; 0,0,0,1].
// Therefore local XYZ = [worldZ-oz, worldY-oy, ox-worldX].
const [ox, oy, oz] = sharedState.origin;
const p = camera.projection, c = camera.cameraToWorld;
const inverseProjection = [1/p[0],0,0,0, 0,1/p[5],0,0, 0,0,0,1/p[14], 0,0,-1,p[10]/p[14]];
const cameraToLocal = Array.from({ length: 4 }, (_, column) => {
  const k = column * 4, w = c[k + 3];
  return [c[k + 2] - oz*w, c[k + 1] - oy*w, ox*w - c[k], w];
}).flat();
const closeArray = (actual, expected) => {
  assert.equal(actual.length, expected.length);
  actual.forEach((value, i) => assert.ok(Math.abs(value - expected[i]) <= 2e-12, `matrix element ${i}`));
};
closeArray(inverseProjection, footprint.inverseProjection);
closeArray(cameraToLocal, footprint.cameraToLocal);
closeArray(c.slice(12, 15), state.camera);
assert.ok(Math.abs(1 / Math.abs(p[5]) - footprint.fovTan) <= 2e-15);
assert.ok(Math.abs(p[5] / p[0] - state.cameraProjection.aspect) <= 2e-15);
assert.ok(Math.abs(Math.tan(state.cameraProjection.fov * Math.PI / 360) / state.cameraProjection.zoom - footprint.fovTan) <= 2e-15);

const locks = {
  trace: '014f45b35ef1af18f0cdde5f607e2fe750a5eab54637a02c08def857b0077aea',
  qSeed: '7b56f2379328ff8ae025560c8ce52bfa73cbe3d20e541d4ada7794c6ebbb7bba',
  extentSourceSeed: 'b01939ff17cb6865f5b3253e7873c6546fc8bd55f1170e9d25f38260f26a3475',
  normalBaseDistance: '3660f85256896647eadd3eea474a31373bc0e89996e0fc0940f37181b6b8381e',
};
const names = { trace: 'main-trace', qSeed: 'q-seed', extentSourceSeed: 'extent-source-seed', normalBaseDistance: 'normal-base-distance' };
const arrays = {};
for (const [key, name] of Object.entries(names)) {
  const bounded = bytes(sourceDirectory + name + '-bounded.bin');
  const unbounded = bytes(sourceDirectory + name + '-unbounded.bin');
  const record = receipt.comparison.records.find(record => record.name === name);
  assert.equal(bounded.length, 32 * 24 * 4 * 4);
  assert.deepEqual(bounded, unbounded, `${name}: actual bounded/unbounded bytes`);
  assert.equal(sha256(bounded), locks[key]);
  assert.equal(record.boundedSHA256, locks[key]);
  assert.equal(record.unboundedSHA256, locks[key]);
  assert.equal(record.mismatch, 0);
  arrays[key] = Array.from({ length: bounded.length / 4 }, (_, i) => {
    assert.ok(Number.isFinite(bounded.readFloatLE(i * 4)));
    return bounded.readUInt32LE(i * 4);
  });
}
const trace = bytes(sourceDirectory + 'main-trace-bounded.bin');
const hitClassCounts = {};
let hitCount = 0, missCount = 0;
for (let i = 0; i < trace.length; i += 16) {
  const status = trace.readFloatLE(i + 12);
  assert.ok(status === 1 || status === 2, 'only actual terminal rays');
  if (status === 1) {
    hitCount++;
    const id = trace.readFloatLE(i + 4);
    hitClassCounts[id] = (hitClassCounts[id] || 0) + 1;
  } else missCount++;
}
assert.equal(hitCount, 276);
assert.equal(missCount, 492);
assert.deepEqual(hitClassCounts, { 1:13, 2:24, 3:46, 4:8, 7:2, 12:11, 13:16, 15:55, 17:98, 18:3 });
const snapshot = frame => {
  const shared = frame.kowloonFunction.shared.state;
  return {
    tick: frame.tick, clock: shared.timetableMinutes, simulationSeconds: shared.simulationSeconds,
    age: shared.materialAge, paused: shared.paused, distance: frame.distance, origin: shared.origin,
    camera: frame.camera, cameraProjection: frame.cameraProjection, viewSettings: frame.viewSettings,
    stationSiting: frame.stationSiting, sharedStateSHA256: jsonHash(shared),
  };
};
const frameProvenance = {
  method: 'Exact 25c native footprint reused after matching 582 frozen camera/projection/state/origin; independently checked column-major world-to-local transform.',
  orientationSource: 'Recorded original cameraToWorld matrices and measured native GPU footprint; viewSettings.target is retained only as provenance, not used to reconstruct orientation.',
  matchedStatePaths: [...checkedStatePaths, 'kowloonFunction.shared.state'],
  matrixConvention: 'column-major',
  hostViewport: receipt.viewport,
  diagnosticViewport: receipt.diagnosticMain,
  origin: sharedState.origin,
  projection: camera.projection,
  cameraToWorld: camera.cameraToWorld,
  referenceState: snapshot(state),
  footprintState: snapshot(peerState),
  footprintCommit: peerReceipt.commit,
  footprintRun: 38303969480,
  footprintArtifact: 11771469726,
  footprintSource: 'train88-native-focus-results/belfry-stone-arch-attachments.json',
  referenceReceiptSHA256: sha256(bytes(sourceDirectory + 'receipt.json')),
  footprintReceiptSHA256: sha256(bytes(peerDirectory + 'receipt.json')),
  footprintAttachmentSHA256: sha256(bytes(footprintPath)),
  originalCameraFixtureSHA256: sha256(bytes(activePath)),
  peerOriginalCameraFixtureSHA256: sha256(bytes(peerActivePath)),
};
const fixture = {
  schema: 'kowloon-group-cost-fixture/1',
  encoding: 'All attachment arrays contain uint32 little-endian RGBA32F bits; rows bottom to top.',
  width: 32, height: 24,
  referenceCommit, referenceRun, referenceArtifact, artifactSHA256,
  sourceSHA256, executionSHA256,
  frame: {
    inverseProjection: footprint.inverseProjection,
    cameraToLocal: footprint.cameraToLocal,
    clock: sharedState.timetableMinutes,
    age: sharedState.materialAge,
    fovTan: footprint.fovTan,
    tick: sharedState.tick,
    far: 320,
    flipY: 0,
  },
  frameProvenance,
  hashes: { ...locks, frameProvenance: jsonHash(frameProvenance) },
  hitCount, missCount, unresolvedCount: 0, hitClassCounts,
  traceBits: arrays.trace,
  expected: { qSeed: arrays.qSeed, extentSourceSeed: arrays.extentSourceSeed, normalBaseDistance: arrays.normalBaseDistance },
};
const output = JSON.stringify(fixture) + '\n';
assert.ok(Buffer.byteLength(output) <= 200_000, 'published fixture budget');
const target = new URL('./fixture.json', import.meta.url);
writeFileSync(target, output);
console.log(JSON.stringify({ output: fileURLToPath(target), bytes: Buffer.byteLength(output), hitCount, missCount, hitClassCounts, hashes: fixture.hashes }));
