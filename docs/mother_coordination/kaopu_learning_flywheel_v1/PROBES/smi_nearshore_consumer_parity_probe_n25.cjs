'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const candidatePath = path.resolve(process.argv[2] || path.resolve(__dirname, '../../release/index.bed-parity-r01.html'));
const adapterPath = path.resolve(process.argv[3] || path.resolve(__dirname, 'shoreline_gpu_adapter.cjs'));
const fixturePath = path.resolve(process.argv[4] || path.resolve(__dirname, 'legacy_v0230_fixture.cjs'));
const Adapter = require(adapterPath);
const Fixture = require(fixturePath);
const html = fs.readFileSync(candidatePath, 'utf8');

function count(source, token) {
  return source.split(token).length - 1;
}

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

assert.equal(count(html, '// Generated from ../shoreline_profile.cjs (SMI_WAKE_BAY_R01);'), 1);
assert.equal(count(html, 'float bed=smiAuthoritativeBedG(p)'), 1);
assert.equal(count(html, 'float bed=bedH(p)'), 0);

const vertexLegacyDepth = 'float d0=uSeaLevel-bedH(p)';
const vertexLegacyThickness = 'vThickness=max(0.0,y-bedH(p))';
const fragmentLegacyDistance = 'float shoreDistance=smiShoreDistance(vWorld.xz)';
assert.equal(count(html, vertexLegacyDepth), 1);
assert.equal(count(html, vertexLegacyThickness), 1);
assert.equal(count(html, fragmentLegacyDistance), 1);

const S = Adapter.authoritative;
const theta = S.BAY.center;
const seaLevel = 0.18;
const shorelineRadius = Fixture.islandRadius(theta);
const signedDistance = S.waterlineSignedDistance(seaLevel);
const radius = shorelineRadius + signedDistance;
const x = Math.cos(theta) * radius;
const z = Math.sin(theta) * radius;
const legacyBed = Fixture.legacyBed(x, z);
const authoritativeBed = Adapter.cpuBedAt(x, z, Fixture.legacyBed, Fixture.islandRadius);

assert(Math.abs(authoritativeBed - seaLevel) < 1e-9);
assert(Math.abs(legacyBed - seaLevel) > 0.05);

// At zero wave displacement, waveSurface now places the surface at the authoritative
// mean-water contact, but the unpatched vertex varying still measures thickness
// against the legacy bed. This isolates the consumer mismatch without claiming a
// full-scene visual result.
const surfaceY = seaLevel;
const legacyThickness = Math.max(0, surfaceY - legacyBed);
const authoritativeThickness = Math.max(0, surfaceY - authoritativeBed);
const legacyFoamVisibilityGate = smoothstep(0.008, 0.07, legacyThickness);
const authoritativeFoamVisibilityGate = smoothstep(0.008, 0.07, authoritativeThickness);

assert(legacyFoamVisibilityGate > 0.999999);
assert(authoritativeFoamVisibilityGate < 1e-9);

const result = {
  suite: 'SMI nearshore GPU consumer-parity probe N25',
  passed: true,
  profileId: Adapter.PROFILE_ID,
  candidate: {
    relativePath: 'games/survivor-palau/releases/v0.2.3.0/index.bed-parity-r01.html',
    generatedAdapterMarkers: count(html, '// Generated from ../shoreline_profile.cjs (SMI_WAKE_BAY_R01);'),
    waveSurfaceAuthoritativeBedReads: count(html, 'float bed=smiAuthoritativeBedG(p)'),
    waveSurfaceLegacyBedReads: count(html, 'float bed=bedH(p)')
  },
  remainingGpuConsumers: {
    vertexShallowDepthLegacyBedReads: count(html, vertexLegacyDepth),
    vertexThicknessLegacyBedReads: count(html, vertexLegacyThickness),
    fragmentShoreDistanceLegacyReads: count(html, fragmentLegacyDistance)
  },
  meanWaterCounterexample: {
    units: 'metre',
    x,
    z,
    seaLevel,
    signedDistance,
    legacyBed,
    authoritativeBed,
    legacyThickness,
    authoritativeThickness,
    foamVisibilityGate: {
      expression: 'smoothstep(0.008, 0.07, thickness)',
      legacy: legacyFoamVisibilityGate,
      authoritative: authoritativeFoamVisibilityGate
    }
  },
  interpretation: {
    observation: 'The candidate couples waveSurface to SMI_WAKE_BAY_R01 but leaves vertex shallow/thickness and fragment shoreline-distance consumers on legacy functions.',
    candidate: 'A shared authoritative-bed/distance adapter should be evaluated for every nearshore consumer before claiming full CPU/GPU parity.',
    unknown: ['full-scene visual effect', 'desktop hardware GPU', '390x844 device result', 'performance cost', 'user acceptance']
  }
};

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
