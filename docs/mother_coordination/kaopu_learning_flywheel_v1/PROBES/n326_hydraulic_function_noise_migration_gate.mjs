import assert from 'node:assert/strict';

const DIRECT = ['boom_direct_1', 'boom_direct_2', 'boom_direct_3', 'boom_direct_4'];
const REQUIRED = [...DIRECT, 'side_left', 'side_right'];

function hose(id, startPortId, endPortId) {
  return {
    hoseId: id,
    previousMeshDigest: `sha256:previous-${id}`,
    currentMeshDigest: `sha256:current-${id}`,
    generatorRoute: 'FUNCTION_NOISE_EXTRUSION',
    generatorModuleDigest: 'sha256:generator-module-v1',
    invocationDigest: `sha256:invocation-${id}`,
    centerlineFunctionDigest: `sha256:centerline-${id}`,
    crossSectionFunctionDigest: 'sha256:round-cross-section-v1',
    noiseProfile: {
      family: 'seeded-band-limited-noise',
      seed: 1000 + REQUIRED.indexOf(id),
      amplitude: 0.001,
      frequency: 2.5,
      octaves: 3
    },
    endpointPinning: {
      enabled: true,
      startPortId,
      endPortId,
      startDrift: 0.0004,
      endDrift: 0.0005
    },
    topologyEdgeObserved: true,
    sampledCenterlineMaxDeviation: 0.0015,
    radiusProfileMaxDeviation: 0.0008,
    deterministicReplayDigest: `sha256:current-${id}`
  };
}

export function validReceipt() {
  return {
    schema: 'kaopu.candidate.hydraulic-function-noise-migration/1',
    taskMode: 'USER_AUTHORIZED_METHOD_MIGRATION',
    userDirectiveDigest: 'sha256:fixture-user-directive-n326',
    sourceHead: 'fixture-head-n326',
    priorCaseId: 'CANDIDATE_GEOMETRY_TIME_NOT_RELATION_GRAPH_001',
    requiredHoseIds: REQUIRED,
    protectedDirectHoseIds: DIRECT,
    topologyVerdict: 'PASS',
    endpointTolerance: 0.002,
    centerlineShapeTolerance: 0.003,
    radiusProfileTolerance: 0.001,
    hoses: [
      hose('boom_direct_1', 'valve_A1', 'boom_upper_A1'),
      hose('boom_direct_2', 'valve_A2', 'boom_upper_A2'),
      hose('boom_direct_3', 'valve_B1', 'boom_upper_B1'),
      hose('boom_direct_4', 'valve_B2', 'boom_upper_B2'),
      hose('side_left', 'side_left_source', 'upper_pipe_left'),
      hose('side_right', 'side_right_source', 'upper_pipe_right')
    ]
  };
}

export function evaluate(receipt) {
  const holds = [];
  if (!receipt) return ['HOLD_HYDRAULIC_MIGRATION_RECEIPT_MISSING'];
  if (!receipt.sourceHead) holds.push('HOLD_HYDRAULIC_SOURCE_HEAD_MISSING');
  if (receipt.taskMode !== 'USER_AUTHORIZED_METHOD_MIGRATION' || !receipt.userDirectiveDigest) {
    holds.push('HOLD_HYDRAULIC_METHOD_MIGRATION_UNAUTHORIZED');
  }
  const hoses = new Map((receipt.hoses || []).map(h => [h.hoseId, h]));
  if (!(receipt.requiredHoseIds || []).every(id => hoses.has(id))) {
    holds.push('HOLD_HYDRAULIC_FUNCTION_ROUTE_COVERAGE_INCOMPLETE');
  }
  if (JSON.stringify(receipt.protectedDirectHoseIds) !== JSON.stringify(DIRECT)) {
    holds.push('HOLD_HYDRAULIC_PROTECTED_SET_CHANGED');
  }
  if (receipt.topologyVerdict !== 'PASS') holds.push('HOLD_HYDRAULIC_TOPOLOGY_NOT_PASSED');

  for (const id of REQUIRED) {
    const h = hoses.get(id);
    if (!h) continue;
    if (h.generatorRoute !== 'FUNCTION_NOISE_EXTRUSION') {
      holds.push('HOLD_HYDRAULIC_SPECIFIED_FUNCTION_ROUTE_UNPROVEN');
    }
    if (!h.generatorModuleDigest || !h.invocationDigest || !h.centerlineFunctionDigest || !h.crossSectionFunctionDigest) {
      holds.push('HOLD_HYDRAULIC_GENERATOR_PROVENANCE_INCOMPLETE');
    }
    const n = h.noiseProfile || {};
    if (!n.family || !Number.isInteger(n.seed) || !Number.isFinite(n.amplitude) || !Number.isFinite(n.frequency) || !Number.isInteger(n.octaves)) {
      holds.push('HOLD_HYDRAULIC_NOISE_PARAMETERS_UNBOUND');
    }
    if (!h.endpointPinning?.enabled || !h.endpointPinning.startPortId || !h.endpointPinning.endPortId) {
      holds.push('HOLD_HYDRAULIC_ENDPOINT_PINNING_UNPROVEN');
    }
    if (!h.topologyEdgeObserved) holds.push('HOLD_HYDRAULIC_ENDPOINT_TOPOLOGY_UNOBSERVED');
    if (Math.max(h.endpointPinning?.startDrift ?? Infinity, h.endpointPinning?.endDrift ?? Infinity) > receipt.endpointTolerance) {
      holds.push('HOLD_HYDRAULIC_ENDPOINT_DRIFT_EXCEEDS_TOLERANCE');
    }
    if (h.sampledCenterlineMaxDeviation > receipt.centerlineShapeTolerance || h.radiusProfileMaxDeviation > receipt.radiusProfileTolerance) {
      holds.push('HOLD_HYDRAULIC_ACCEPTED_SHAPE_REGRESSION');
    }
    if (h.deterministicReplayDigest !== h.currentMeshDigest) {
      holds.push('HOLD_HYDRAULIC_FUNCTION_REPLAY_NONDETERMINISTIC');
    }
    if (h.previousMeshDigest === h.currentMeshDigest) {
      holds.push('HOLD_HYDRAULIC_SPECIFIED_ROUTE_NO_IMPLEMENTATION_DELTA');
    }
  }
  return [...new Set(holds)].sort();
}

const cases = [
  ['authorized migration changes bytes while preserving topology and shape', r => r, []],
  ['missing receipt', () => null, ['HOLD_HYDRAULIC_MIGRATION_RECEIPT_MISSING']],
  ['missing source head', r => { delete r.sourceHead; return r; }, ['HOLD_HYDRAULIC_SOURCE_HEAD_MISSING']],
  ['migration not authorized', r => { r.taskMode = 'ORDINARY_REPAIR'; return r; }, ['HOLD_HYDRAULIC_METHOD_MIGRATION_UNAUTHORIZED']],
  ['one hose omitted from route coverage', r => { r.hoses = r.hoses.filter(h => h.hoseId !== 'side_right'); return r; }, ['HOLD_HYDRAULIC_FUNCTION_ROUTE_COVERAGE_INCOMPLETE']],
  ['baked mesh mislabeled as acceptable route', r => { r.hoses[0].generatorRoute = 'BAKED_MESH'; return r; }, ['HOLD_HYDRAULIC_SPECIFIED_FUNCTION_ROUTE_UNPROVEN']],
  ['generator invocation provenance missing', r => { delete r.hoses[0].invocationDigest; return r; }, ['HOLD_HYDRAULIC_GENERATOR_PROVENANCE_INCOMPLETE']],
  ['noise seed unbound', r => { delete r.hoses[1].noiseProfile.seed; return r; }, ['HOLD_HYDRAULIC_NOISE_PARAMETERS_UNBOUND']],
  ['noise moves endpoint beyond tolerance', r => { r.hoses[2].endpointPinning.endDrift = 0.02; return r; }, ['HOLD_HYDRAULIC_ENDPOINT_DRIFT_EXCEEDS_TOLERANCE']],
  ['accepted direct-hose shape regresses', r => { r.hoses[3].sampledCenterlineMaxDeviation = 0.05; return r; }, ['HOLD_HYDRAULIC_ACCEPTED_SHAPE_REGRESSION']],
  ['function replay changes output', r => { r.hoses[4].deterministicReplayDigest = 'sha256:different'; return r; }, ['HOLD_HYDRAULIC_FUNCTION_REPLAY_NONDETERMINISTIC']],
  ['claimed migration has no implementation delta', r => { r.hoses[5].currentMeshDigest = r.hoses[5].previousMeshDigest; r.hoses[5].deterministicReplayDigest = r.hoses[5].currentMeshDigest; return r; }, ['HOLD_HYDRAULIC_SPECIFIED_ROUTE_NO_IMPLEMENTATION_DELTA']]
];

const results = cases.map(([name, mutate, expected]) => {
  const actual = evaluate(mutate(validReceipt()));
  const exp = [...expected].sort();
  return { name, expected: exp, actual, passed: JSON.stringify(actual) === JSON.stringify(exp) };
});

for (const result of results) assert.equal(result.passed, true, `${result.name}: ${JSON.stringify(result)}`);

const output = {
  schema: 'kaopu.candidate.hydraulic-function-noise-migration-result/1',
  caseId: 'CANDIDATE_GEOMETRY_TIME_NOT_RELATION_GRAPH_001',
  refinementId: 'N326_HYDRAULIC_FUNCTION_NOISE_MIGRATION',
  passed: results.filter(r => r.passed).length,
  total: results.length,
  fixtureOnly: true,
  productionReplay: 'NOT_RUN',
  decision: 'CANDIDATE_REPLACE_BYTE_FREEZE_WITH_AUTHORIZED_ROUTE_PLUS_OBSERVABLE_INVARIANTS',
  results
};

console.log(JSON.stringify(output, null, 2));
