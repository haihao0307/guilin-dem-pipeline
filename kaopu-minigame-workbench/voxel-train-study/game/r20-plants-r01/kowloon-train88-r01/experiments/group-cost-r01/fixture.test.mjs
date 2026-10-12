// This suite reads only the published fixture and Node standard libraries.
// It deliberately has no dependency on downloaded evidence or station sources.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const file = readFileSync(new URL('./fixture.json', import.meta.url));
const fixture = JSON.parse(file);
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const lockedHashes = {
  trace: '014f45b35ef1af18f0cdde5f607e2fe750a5eab54637a02c08def857b0077aea',
  qSeed: '7b56f2379328ff8ae025560c8ce52bfa73cbe3d20e541d4ada7794c6ebbb7bba',
  extentSourceSeed: 'b01939ff17cb6865f5b3253e7873c6546fc8bd55f1170e9d25f38260f26a3475',
  normalBaseDistance: '3660f85256896647eadd3eea474a31373bc0e89996e0fc0940f37181b6b8381e',
  frameProvenance: 'c638029b18426bd40899897351ee51f14fcecf6441bb207555e2ae5ffad5693e',
};
const arrays = { trace: fixture.traceBits, ...fixture.expected };
function decode(bits) {
  const bytes = Buffer.alloc(bits.length * 4);
  bits.forEach((value, i) => {
    assert.ok(Number.isInteger(value) && value >= 0 && value <= 0xffffffff, `uint32 at ${i}`);
    bytes.writeUInt32LE(value, i * 4);
  });
  return { bytes, floats: Array.from({ length: bits.length }, (_, i) => bytes.readFloatLE(i * 4)) };
}
const decoded = Object.fromEntries(Object.entries(arrays).map(([name, bits]) => [name, decode(bits)]));
const closeArray = (actual, expected, tolerance = 2e-12) => {
  assert.equal(actual.length, expected.length);
  actual.forEach((value, i) => {
    assert.ok(Number.isFinite(value));
    assert.ok(Math.abs(value - expected[i]) <= tolerance, `element ${i}: ${value} != ${expected[i]}`);
  });
};

test('fixture locks the actual frozen 582 whole-station GPU run, sources and binary attachments', () => {
  assert.ok(file.length <= 200_000);
  assert.equal(fixture.schema, 'kowloon-group-cost-fixture/1');
  assert.match(fixture.encoding, /uint32 little-endian RGBA32F bits; rows bottom to top/);
  assert.deepEqual([fixture.width, fixture.height], [32, 24]);
  assert.equal(fixture.referenceCommit, '582ed63702f4f44e79ca6299326717bf86b57710');
  assert.equal(fixture.referenceRun, 38301469129);
  assert.equal(fixture.referenceArtifact, 11771451161);
  assert.equal(fixture.artifactSHA256, '3813e803a74cea78f04e686bf2c0b8300f3f7695c4f21147e66f2cc6c90f70e1');
  assert.equal(fixture.sourceSHA256, '588042e14707b2dcab1e890c18fca2afdd20104eaecb7a5d3b25baa71c6a8d36');
  assert.equal(fixture.executionSHA256, '30627a5280f8c78998812fc10fc544629a88f0d0844ff997eac1a6d7e9ca21da');
  assert.deepEqual(fixture.hashes, lockedHashes);
  assert.deepEqual(Object.keys(fixture.expected).sort(), ['extentSourceSeed', 'normalBaseDistance', 'qSeed']);
  for (const [name, data] of Object.entries(decoded)) {
    assert.equal(arrays[name].length, 3072, name);
    assert.equal(data.bytes.length, 12288, name);
    assert.equal(sha256(data.bytes), lockedHashes[name], name);
    assert.ok(data.floats.every(Number.isFinite), `${name}: finite actual GPU values`);
    data.floats.forEach((value, i) => {
      const back = Buffer.alloc(4);
      back.writeFloatLE(value);
      assert.equal(back.readUInt32LE(), arrays[name][i], `${name}: lossless float-bit roundtrip ${i}`);
    });
  }
});

test('all 768 trace records retain actual terminal t, IDs and statuses with 276 hits including roof 55/floor 98', () => {
  const trace = decoded.trace.floats;
  const counts = {};
  let hits = 0, misses = 0, maxSteps = 0;
  for (let i = 0; i < trace.length; i += 4) {
    const [distance, id, steps, status] = trace.slice(i, i + 4);
    assert.ok(distance >= 0);
    assert.ok(Number.isInteger(id) && id >= 0);
    assert.ok(Number.isInteger(steps) && steps >= 0 && steps <= 210);
    assert.ok(status === 1 || status === 2, 'no unresolved or fabricated trace status');
    maxSteps = Math.max(maxSteps, steps);
    if (status === 1) {
      hits++;
      assert.ok(distance > 0 && distance <= fixture.frame.far);
      assert.ok(id > 0);
      counts[id] = (counts[id] || 0) + 1;
      const q = decoded.qSeed.floats.slice(i, i + 4);
      const extent = decoded.extentSourceSeed.floats.slice(i, i + 4);
      assert.ok(Number.isInteger(q[3]) && q[3] >= 0, 'actual q seed');
      assert.ok(Number.isInteger(extent[3]) && extent[3] >= 0, 'actual source seed');
      assert.ok(extent.slice(0, 3).every(value => value > 0), 'actual positive source extents');
    } else {
      misses++;
      for (const name of Object.keys(fixture.expected)) {
        assert.deepEqual(decoded[name].floats.slice(i, i + 4), [0, 0, 0, 0], `${name}: miss sentinel remains unchanged`);
      }
    }
  }
  assert.equal(maxSteps, 210);
  assert.equal(hits, 276);
  assert.equal(misses, 492);
  assert.equal(fixture.hitCount, hits);
  assert.equal(fixture.missCount, misses);
  assert.equal(fixture.unresolvedCount, 0);
  assert.deepEqual(counts, { 1:13, 2:24, 3:46, 4:8, 7:2, 12:11, 13:16, 15:55, 17:98, 18:3 });
  assert.deepEqual(fixture.hitClassCounts, counts);
  assert.equal(counts[15], 55);
  assert.equal(counts[17], 98);
});

test('published frame provenance proves matching frozen camera, projection, state and origin before footprint reuse', () => {
  const p = fixture.frameProvenance;
  assert.equal(sha256(JSON.stringify(p)), lockedHashes.frameProvenance);
  assert.deepEqual(p.referenceState, p.footprintState);
  assert.deepEqual(p.matchedStatePaths, ['tick', 'distance', 'camera', 'cameraProjection', 'viewSettings', 'stationSiting', 'kowloonFunction.shared.state']);
  assert.equal(p.matrixConvention, 'column-major');
  assert.equal(p.footprintCommit, '25c460991397665e2ad9068e79a93b2b16b80484');
  assert.equal(p.footprintRun, 38303969480);
  assert.equal(p.footprintArtifact, 11771469726);
  assert.equal(p.originalCameraFixtureSHA256, p.peerOriginalCameraFixtureSHA256);
  assert.deepEqual(p.hostViewport, [640, 426]);
  assert.deepEqual(p.diagnosticViewport, [32, 24]);
  const state = p.referenceState;
  assert.equal(state.tick, 240);
  assert.equal(state.clock, 380.1999999999998);
  assert.equal(state.age, 0.58);
  assert.equal(state.paused, true);
  assert.equal(state.distance, 6.24175061245628);
  assert.deepEqual(state.origin, [-81.24175061245629, 0.2500000000000001, -5]);
  assert.deepEqual(p.origin, state.origin);
  assert.deepEqual(state.camera, [-130, 48.25, 91]);
  assert.deepEqual(state.viewSettings.target, [-17, 2.3, 1.2]);
  assert.equal(fixture.frame.clock, state.clock);
  assert.notEqual(fixture.frame.clock, state.simulationSeconds, 'shader clock is timetable minutes, not elapsed seconds');
  assert.equal(fixture.frame.age, state.age);
  assert.equal(fixture.frame.tick, state.tick);
  assert.equal(fixture.frame.far, 320);
  assert.equal(fixture.frame.flipY, 0);
  for (const key of ['referenceReceiptSHA256', 'footprintReceiptSHA256', 'footprintAttachmentSHA256', 'originalCameraFixtureSHA256', 'peerOriginalCameraFixtureSHA256']) {
    assert.match(p[key], /^[0-9a-f]{64}$/);
  }
});

test('reused matrices satisfy the original column-major projection and world-to-local transform', () => {
  const frame = fixture.frame, provenance = fixture.frameProvenance;
  const p = provenance.projection, c = provenance.cameraToWorld;
  assert.equal(frame.inverseProjection.length, 16);
  assert.equal(frame.cameraToLocal.length, 16);
  assert.equal(p.length, 16);
  assert.equal(c.length, 16);
  const inverse = [1/p[0],0,0,0, 0,1/p[5],0,0, 0,0,0,1/p[14], 0,0,-1,p[10]/p[14]];
  closeArray(frame.inverseProjection, inverse);
  // Verify P * P^-1 rather than merely trusting copied matrix values.
  const product = Array.from({ length: 16 }, (_, i) => {
    const row = i % 4, column = Math.floor(i / 4);
    return [0,1,2,3].reduce((sum, k) => sum + p[k*4 + row] * frame.inverseProjection[column*4 + k], 0);
  });
  closeArray(product, [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
  const [ox, oy, oz] = provenance.origin;
  const local = Array.from({ length: 4 }, (_, column) => {
    const k = column * 4, w = c[k + 3];
    return [c[k + 2] - oz*w, c[k + 1] - oy*w, ox*w - c[k], w];
  }).flat();
  closeArray(frame.cameraToLocal, local);
  closeArray(frame.cameraToLocal.slice(12, 15), [96, 48, 48.758249387543714]);
  closeArray(c.slice(12, 15), provenance.referenceState.camera);
  assert.equal(frame.fovTan, 0.4350197091640035);
  assert.ok(Math.abs(frame.fovTan - 1 / Math.abs(p[5])) <= 2e-15);
  const cameraProjection = provenance.referenceState.cameraProjection;
  assert.ok(Math.abs(p[5] / p[0] - 640/426) <= 2e-15, 'retain actual host aspect, not diagnostic 32/24 aspect');
  assert.equal(cameraProjection.aspect, 640/426);
  assert.ok(Math.abs(Math.tan(cameraProjection.fov * Math.PI / 360) / cameraProjection.zoom - frame.fovTan) <= 2e-15);
  assert.ok(Math.abs(p[10] - -(320 + 0.08)/(320 - 0.08)) <= 2e-15);
  assert.ok(Math.abs(p[14] - -(2 * 320 * 0.08)/(320 - 0.08)) <= 2e-15);

  // Validate the recorded orientation without rebuilding it from UI settings.
  // The receipt's viewSettings.target is not the measured diagnostic look-at.
  const cross = (a,b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
  const x = c.slice(0, 3), y = c.slice(4, 7), z = c.slice(8, 11);
  closeArray(cross(x, y), z);
  closeArray(cross(y, z), x);
  closeArray(cross(z, x), y);
  for (const axis of [x, y, z]) assert.ok(Math.abs(Math.hypot(...axis) - 1) <= 2e-15);
  assert.match(provenance.orientationSource, /Recorded original cameraToWorld/);
});
