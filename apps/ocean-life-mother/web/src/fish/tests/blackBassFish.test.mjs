import assert from 'node:assert/strict';
import {
  BLACK_BASS_R1_CARD,
  resampleProfile,
  buildLowerJawMesh,
  transformJawPoint,
  buildMouthCavityMesh,
  buildMaxillaryMeshes,
  buildLipMeshes,
  buildEyeMeshes,
  buildBlackBassHeadMouth
} from '../renderers/blackBassFish.js';

const finite = a => a.every(Number.isFinite);
assert.equal(BLACK_BASS_R1_CARD.source.sha256, 'c1b964b34e80e8534b7801c496576d6a594938d217b4f763b35d04a922b3ee64');
assert.equal(BLACK_BASS_R1_CARD.source.sourceMeshRuntimeDependency, false);
assert.equal(BLACK_BASS_R1_CARD.species.habitatIdentity, 'freshwater');

const sampled = resampleProfile(BLACK_BASS_R1_CARD.jaw.envelope, 4);
assert(sampled.length > BLACK_BASS_R1_CARD.jaw.envelope.length);
for (let i = 1; i < sampled.length; i++) assert(sampled[i][0] > sampled[i - 1][0]);

const rest = buildLowerJawMesh({ mouthOpenRad: 0, radialSegments: 24 });
const open = buildLowerJawMesh({ mouthOpenRad: 0.20, radialSegments: 24 });
assert(rest.positions.length > 0 && rest.indices.length > 0);
assert(open.positions.length === rest.positions.length);
assert(finite(rest.positions) && finite(open.positions));

assert.deepEqual(transformJawPoint(BLACK_BASS_R1_CARD.jaw.hinge, 0.20), [...BLACK_BASS_R1_CARD.jaw.hinge]);
const rs = rest.radialSegments;
const ringCentroid = (mesh, ring) => {
  const out = [0, 0, 0];
  for (let k = 0; k < rs; k++) {
    const o = 3 * (ring * rs + k);
    out[0] += mesh.positions[o]; out[1] += mesh.positions[o + 1]; out[2] += mesh.positions[o + 2];
  }
  return out.map(v => v / rs);
};
const last = rest.ringCount - 1;
const tip0 = ringCentroid(rest, last);
const tip1 = ringCentroid(open, last);
assert(tip1[1] < tip0[1]);
const h = BLACK_BASS_R1_CARD.jaw.hinge;
const d0 = Math.hypot(tip0[1] - h[1], tip0[2] - h[2]);
const d1 = Math.hypot(tip1[1] - h[1], tip1[2] - h[2]);
assert(Math.abs(d0 - d1) < 1e-10);

const eyeRear = BLACK_BASS_R1_CARD.eyes.leftCenter[2] - BLACK_BASS_R1_CARD.eyes.observedExtents[2] / 2;
assert(BLACK_BASS_R1_CARD.maxillary.rearAnchor[2] < eyeRear);

const cavity = buildMouthCavityMesh();
assert(cavity.positions.length > 0 && cavity.indices.length > 0);
for (const mesh of Object.values(buildMaxillaryMeshes())) assert(mesh.positions.length > 0 && finite(mesh.positions));
for (const mesh of Object.values(buildLipMeshes())) assert(mesh.positions.length > 0 && finite(mesh.positions));
for (const mesh of Object.values(buildEyeMeshes())) assert(mesh.positions.length > 0 && finite(mesh.positions));

const built = buildBlackBassHeadMouth({ jaw: { mouthOpenRad: 99 } });
assert.equal(built.parts.lowerJaw.mouthOpenRad, BLACK_BASS_R1_CARD.jaw.safeOpenRangeRad[1]);
assert.equal(built.sourceMeshRuntimeDependency, false);
assert.deepEqual(Object.keys(built.parts), [
  'cranium', 'lowerJaw', 'mouthCavity', 'eyeLeft', 'eyeRight',
  'maxillaryLeft', 'maxillaryRight', 'upperLipLeft', 'upperLipRight', 'lowerLipLeft', 'lowerLipRight'
]);
assert.equal(built.acceptance.visual, false);

console.log('FISH-R1-T01 black-bass head/mouth kernel v0.2: 27 assertions passed');
