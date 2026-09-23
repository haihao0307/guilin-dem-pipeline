'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {
  validateGraph,
  findVerifiedPath,
  resolveCanonicalTransfer,
} = require('./transfer_graph_r04.cjs');

const schema = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'R19_TRANSFER_GRAPH_SCHEMA_R04.json'), 'utf8'),
);
const graph = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'R19_TRANSFER_GRAPH_R04.json'), 'utf8'),
);

const validation = validateGraph(graph, schema);
assert.equal(validation.ok, true, JSON.stringify(validation));
assert.equal(validation.value.nodeCount, 30);
assert.equal(validation.value.edgeCount, 21);
assert.match(validation.value.fingerprint, /^[a-f0-9]{64}$/);

function expectVerified(from, to, context, expectedEdgeIds) {
  const result = findVerifiedPath(graph, schema, from, to, context);
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.value.status, 'VERIFIED_PATH');
  assert.deepEqual(
    result.value.edges.map((edge) => edge.id),
    expectedEdgeIds,
  );
}

function expectUnresolved(from, to, context, expectedBlockerStatus, expectedEdgeId) {
  const result = resolveCanonicalTransfer(graph, schema, from, to, context);
  assert.equal(result.ok, false, JSON.stringify(result));
  assert.equal(result.code, 'UNRESOLVED_TRANSFER');
  assert.equal(result.meta.status, 'UNRESOLVED_PATH');
  assert.ok(
    result.meta.blockers.some(
      (blocker) => blocker.status === expectedBlockerStatus && blocker.edgeId === expectedEdgeId,
    ),
    JSON.stringify(result.meta.blockers),
  );
}

expectVerified(
  'USER_AIRAI_ZOOM_PIXEL_FRAME',
  'USER_COMPLETE_PALAU_PIXEL_FRAME',
  {},
  ['EDGE_AIRAI_PIXELS_TO_PALAU_PIXELS'],
);
expectVerified(
  'USER_AIRAI_ZOOM_PIXEL_FRAME',
  'STORY_CORE_SEMANTIC',
  {},
  ['EDGE_YELLOW_PIXELS_TO_STORY_SEMANTIC'],
);
expectVerified(
  'WGS84_GEOGRAPHIC',
  'PALAU_UTM53N',
  { pointWgs84: [134.53, 7.33] },
  ['EDGE_WGS84_TO_UTM53N'],
);
expectVerified(
  'PALAU_UTM53N',
  'WGS84_GEOGRAPHIC',
  { projectRegion: 'PALAU' },
  ['EDGE_UTM53N_TO_WGS84'],
);
expectVerified(
  'ASF_RTC_ELLIPSOID_HEIGHT',
  'EGM96_ORTHOMETRIC_HEIGHT',
  { sourceSha256: '51f67338ed23d2e30570fc41ee720f664d8dc0e5ed3300595fcaf7ff9940abf6' },
  ['EDGE_ASF_ELLIPSOID_TO_EGM96'],
);
expectVerified(
  'MALAKAL_B_STATION_DATUM',
  'MALAKAL_B_MSL',
  { stationId: 'MALAKAL_B' },
  ['EDGE_MALAKAL_STATION_DATUM_TO_MSL'],
);

expectUnresolved(
  'USER_AIRAI_ZOOM_PIXEL_FRAME',
  'WGS84_GEOGRAPHIC',
  {},
  'CANDIDATE',
  'EDGE_PALAU_PIXELS_TO_WGS84',
);
expectUnresolved(
  'STORY_CORE_SEMANTIC',
  'STORY_CORE_GEOGRAPHIC_CANDIDATE',
  {},
  'CANDIDATE',
  'EDGE_STORY_SEMANTIC_TO_GEOGRAPHIC_CANDIDATE',
);
expectUnresolved(
  'WGS84_GEOGRAPHIC',
  'PALAU_UTM53N',
  { pointWgs84: [120, 30] },
  'SCOPE_MISMATCH',
  'EDGE_WGS84_TO_UTM53N',
);
expectUnresolved(
  'ASF_RTC_ELLIPSOID_HEIGHT',
  'EGM96_ORTHOMETRIC_HEIGHT',
  { sourceSha256: '0'.repeat(64) },
  'SCOPE_MISMATCH',
  'EDGE_ASF_ELLIPSOID_TO_EGM96',
);
expectUnresolved(
  'NOAA_ENC_LOCAL_SOUNDING_DATUM_CODE_24',
  'EGM96_ORTHOMETRIC_HEIGHT',
  {},
  'BLOCKED',
  'EDGE_NOAA_DATUM24_TO_EGM96',
);
expectUnresolved(
  'MALAKAL_B_STATION_DATUM',
  'MALAKAL_B_MSL',
  { stationId: 'OTHER_STATION' },
  'SCOPE_MISMATCH',
  'EDGE_MALAKAL_STATION_DATUM_TO_MSL',
);
expectUnresolved(
  'MALAKAL_REGIONAL_TIDE',
  'AIRAI_LOCAL_TIDE',
  {},
  'BLOCKED',
  'EDGE_MALAKAL_TIDE_TO_AIRAI_LOCAL_TIDE',
);
expectUnresolved(
  'MODERN_SHORELINE_EVIDENCE',
  'STORY_1944_SHORELINE_STATE',
  {},
  'BLOCKED',
  'EDGE_MODERN_SHORELINE_TO_1944_SHORELINE',
);
expectUnresolved(
  'MODERN_BATHYMETRY_EVIDENCE',
  'STORY_1944_BATHYMETRY_STATE',
  {},
  'BLOCKED',
  'EDGE_MODERN_BATHY_TO_1944_BATHY',
);
expectUnresolved(
  'PALAU_R19_EGM96_CANONICAL_DEM',
  'PALAU_DEM_WAVE_BASIS_R01',
  {},
  'CANDIDATE',
  'EDGE_DEM_TO_WAVE_BASIS',
);
expectUnresolved(
  'R19_AOI_BATHYMETRY_CANDIDATE',
  'AIRAI_BATHY_WAVE_BASIS_R01',
  {},
  'CANDIDATE',
  'EDGE_BATHY_CANDIDATE_TO_WAVE_BASIS',
);
expectUnresolved(
  'OCEAN_MOTHER_SURFACE_STATE',
  'INSTANTANEOUS_FREE_SURFACE',
  {},
  'CANDIDATE',
  'EDGE_OCEAN_STATE_TO_FINAL_FREE_SURFACE',
);

console.log(
  `R19 transfer graph R04 validation: PASS (${validation.value.nodeCount} nodes, ` +
    `${validation.value.edgeCount} edges, verified-only canonical traversal)`,
);
