'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = __dirname;
const matrix = JSON.parse(fs.readFileSync(path.join(root, 'R19_TRUTH_CLAIM_MATRIX_R05.json'), 'utf8'));
const state = JSON.parse(
  fs.readFileSync(path.join(root, '..', 'R19_CURRENT_STATE.json'), 'utf8'),
);
const graph = JSON.parse(fs.readFileSync(path.join(root, 'R19_TRANSFER_GRAPH_R04.json'), 'utf8'));

assert.equal(matrix.status, 'AUDIT_INPUT_NOT_SMALL_MOTHER_APPROVED');
assert.equal(matrix.rules.candidateMayBeReportedAsTruth, false);
assert.equal(matrix.rules.blockedMayCarryDefaultZero, false);
assert.equal(matrix.rules.unknownMayCarryNumericValue, false);
assert.equal(matrix.rules.modernEvidenceMayBecome1944ObservationImplicitly, false);
assert.equal(matrix.rules.successfulCiMayProveExternalReality, false);
assert.equal(matrix.rules.selfAuditMayCountAsSmallMotherApproval, false);

const allowed = new Set(matrix.allowedStates);
const claimIds = new Set();
for (const claim of matrix.claims) {
  assert.ok(claim.claimId, 'claimId missing');
  assert.ok(!claimIds.has(claim.claimId), `duplicate claimId ${claim.claimId}`);
  claimIds.add(claim.claimId);
  assert.ok(allowed.has(claim.state), `${claim.claimId}: invalid state ${claim.state}`);
  assert.ok(typeof claim.statement === 'string' && claim.statement.length > 10, `${claim.claimId}: statement missing`);
  assert.ok(Array.isArray(claim.evidence) && claim.evidence.length > 0, `${claim.claimId}: evidence missing`);

  if (claim.state === 'CANDIDATE') {
    assert.equal(claim.mustNotBePromoted, true, `${claim.claimId}: candidate must be explicitly non-promoted`);
  }
  if (claim.state === 'UNKNOWN') {
    assert.equal(claim.numericDefaultForbidden, true, `${claim.claimId}: unknown numeric default must be forbidden`);
    assert.equal(Object.prototype.hasOwnProperty.call(claim, 'value'), false, `${claim.claimId}: unknown claim carries value`);
  }
  if (claim.state === 'BLOCKED') {
    assert.equal(Object.prototype.hasOwnProperty.call(claim, 'value'), false, `${claim.claimId}: blocked claim carries value`);
    assert.equal(Object.prototype.hasOwnProperty.call(claim, 'defaultValue'), false, `${claim.claimId}: blocked claim carries default`);
  }
}

for (const requiredClaim of [
  'C006_FINAL_AOI_GEOGRAPHY',
  'C014_CONTINUOUS_BATHYMETRY',
  'C015_NOAA_DATUM_BRIDGE',
  'C017_AIRAI_LOCAL_TIDE_TRANSFER',
  'C018_1944_NON_TIDAL_RESIDUAL',
  'C022_WAVE_DECOMPOSITION',
  'C023_THREE_DIMENSIONAL_WORKBENCH',
  'C024_PRODUCTION_READY',
]) {
  assert.ok(claimIds.has(requiredClaim), `required unresolved claim missing: ${requiredClaim}`);
}

assert.equal(state.gates.smallMotherValidation, 'REQUESTED_NOT_APPROVED');
assert.equal(state.gates.waveDecompositionAdopted, false);
assert.equal(state.gates.demGeographicOverlayPassed, false);
assert.equal(state.gates.storyAoiFrozen, false);
assert.equal(state.gates.readyForVisualBuild, false);
assert.equal(state.gates.interactive3D, false);
assert.equal(state.gates.visualAcceptance, false);
assert.equal(state.gates.productionReady, false);

for (const edge of graph.edges) {
  if (['BLOCKED', 'CANDIDATE', 'REJECTED'].includes(edge.status)) {
    assert.equal(
      Object.prototype.hasOwnProperty.call(edge, 'defaultValue'),
      false,
      `${edge.id}: unresolved edge carries defaultValue`,
    );
  }
  if (edge.status === 'CANDIDATE') {
    assert.notEqual(edge.applied, true, `${edge.id}: candidate edge marked applied`);
  }
  if (edge.status === 'BLOCKED') {
    assert.ok(edge.operation === null || edge.operation === undefined, `${edge.id}: blocked edge has operation`);
  }
}

console.log(
  `R19 truth claim matrix R05: PASS (${matrix.claims.length} claims; ` +
    'self-audit only, Small Mother judgment still required)',
);
