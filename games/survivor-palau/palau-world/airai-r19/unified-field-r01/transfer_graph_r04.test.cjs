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
const sourceGraph = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'R19_TRANSFER_GRAPH_R04.json'), 'utf8'),
);

function copy(value) {
  return JSON.parse(JSON.stringify(value));
}

function edge(graph, id) {
  const found = graph.edges.find((item) => item.id === id);
  assert.ok(found, `edge ${id} not found`);
  return found;
}

function expectValidationFailure(mutator, code) {
  const graph = copy(sourceGraph);
  mutator(graph);
  const result = validateGraph(graph, schema);
  assert.equal(result.ok, false, `expected ${code}, received PASS`);
  assert.equal(result.code, code, JSON.stringify(result));
}

// A blocked transfer cannot smuggle a numeric zero default into the world.
expectValidationFailure((graph) => {
  edge(graph, 'EDGE_MALAKAL_TIDE_TO_AIRAI_LOCAL_TIDE').defaultValue = 0;
}, 'DEFAULT_VALUE');

// A verified edge without evidence is not verified.
expectValidationFailure((graph) => {
  edge(graph, 'EDGE_AIRAI_PIXELS_TO_PALAU_PIXELS').evidence = [];
}, 'VERIFIED_EVIDENCE');

// A verified edge without a passing receipt is not verified.
expectValidationFailure((graph) => {
  edge(graph, 'EDGE_ASF_ELLIPSOID_TO_EGM96').tests.passed = false;
}, 'VERIFIED_TEST');

// Candidate transfer cannot be marked applied.
expectValidationFailure((graph) => {
  edge(graph, 'EDGE_DEM_TO_WAVE_BASIS').applied = true;
}, 'CANDIDATE_APPLIED');

// Candidate transfer cannot expose an applied operation before approval.
expectValidationFailure((graph) => {
  edge(graph, 'EDGE_PALAU_PIXELS_TO_WGS84').operation = {
    id: 'UNAPPROVED_OPERATION',
    deterministic: true,
  };
}, 'CANDIDATE_OPERATION');

// Blocked datum bridge cannot acquire an operation by assertion.
expectValidationFailure((graph) => {
  edge(graph, 'EDGE_NOAA_DATUM24_TO_EGM96').operation = {
    id: 'GUESSED_OFFSET',
    deterministic: true,
  };
}, 'BLOCKED_OPERATION');

// Promoting a candidate status still fails if the verified operation is absent.
expectValidationFailure((graph) => {
  const promoted = edge(graph, 'EDGE_DEM_TO_WAVE_BASIS');
  promoted.status = 'VERIFIED';
  promoted.applied = true;
  promoted.validRange = { description: 'test fixture only' };
  promoted.tests = { passed: true, receipt: 'test fixture' };
  // operation deliberately remains null.
}, 'VERIFIED_OPERATION');

// Missing node references are rejected.
expectValidationFailure((graph) => {
  edge(graph, 'EDGE_AIRAI_PIXELS_TO_PALAU_PIXELS').to = 'MISSING_NODE';
}, 'EDGE_NODE');

// Duplicate node identities are rejected.
expectValidationFailure((graph) => {
  graph.nodes.push(copy(graph.nodes[0]));
}, 'DUPLICATE_NODE');

// Inverse transformations are not implied.
{
  const result = resolveCanonicalTransfer(
    sourceGraph,
    schema,
    'USER_COMPLETE_PALAU_PIXEL_FRAME',
    'USER_AIRAI_ZOOM_PIXEL_FRAME',
    {},
  );
  assert.equal(result.ok, false);
  assert.equal(result.code, 'NO_DECLARED_PATH');
}

// A verified scoped edge cannot be traversed without its source identity.
{
  const result = findVerifiedPath(
    sourceGraph,
    schema,
    'ASF_RTC_ELLIPSOID_HEIGHT',
    'EGM96_ORTHOMETRIC_HEIGHT',
    {},
  );
  assert.equal(result.ok, false);
  assert.equal(result.code, 'NO_VERIFIED_PATH');
  assert.ok(result.meta.scopeFailures.length > 0);
}

// Candidate image-to-geography transfer never enters a canonical path.
{
  const result = findVerifiedPath(
    sourceGraph,
    schema,
    'USER_AIRAI_ZOOM_PIXEL_FRAME',
    'WGS84_GEOGRAPHIC',
    {},
  );
  assert.equal(result.ok, false);
  assert.equal(result.code, 'NO_VERIFIED_PATH');
}

// The graph itself is still valid after all attack fixtures are isolated.
{
  const result = validateGraph(sourceGraph, schema);
  assert.equal(result.ok, true, JSON.stringify(result));
}

console.log('R19 transfer graph R04 adversarial tests: PASS');
