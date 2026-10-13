import fs from 'node:fs';

const fixturePath = process.argv[2];
if (!fixturePath) throw new Error('fixture path is required');
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

export function classify(input) {
  if (!input.sameSubjectIdentity) return 'HOLD_FOLD_SUBJECT_IDENTITY_UNBOUND';
  if (!input.textureFreeGeometryDelta) return 'HOLD_FOLD_GEOMETRY_NOT_PROVEN';
  if (!input.expressionDriverBound) {
    return 'SCOPED_GEOMETRIC_FOLD_PROVEN__HOLD_FOLD_DRIVER_IDENTITY_UNBOUND';
  }
  if (!input.localCompressionMeasured) {
    return 'SCOPED_GEOMETRIC_FOLD_PROVEN__HOLD_FOLD_LOCAL_STRAIN_MEASUREMENT_MISSING';
  }
  if (!input.stateResponseMonotonic) {
    return 'SCOPED_GEOMETRIC_FOLD_PROVEN__HOLD_FOLD_CAUSAL_STATE_RESPONSE_MISSING';
  }
  if (input.wrongRegionResponse) return 'HOLD_FOLD_WRONG_REGION_RESPONSE';
  if (!input.restRestored) return 'HOLD_FOLD_REST_RESTORATION_FAILED';
  return 'SCOPED_COMPRESSION_DRIVEN_FOLD_VALIDATED';
}

const assertions = fixture.fixtures.map((test) => {
  const actual = classify(test.input);
  return {id: test.id, expected: test.expect, actual, passed: actual === test.expect};
});

const result = {
  schema: 'kaopu.probe-result/1',
  probeId: 'HUMAN-SKIN-FOLD-CAUSAL-STATE-001-N148-CLASSIFICATION-REPLAY',
  boundedQuestion: 'Does ET21 R02 prove that its real geometric folds are causally driven by local expression compression, or only that static texture-free geometry exists?',
  executionLayer: 'isolated-node-classification-replay',
  assertions,
  summary: {
    passed: assertions.filter((x) => x.passed).length,
    total: assertions.length,
    allPassed: assertions.every((x) => x.passed)
  },
  productionChanged: false,
  productionGateRun: false,
  globalR2Changed: false,
  productionThresholds: 'UNKNOWN'
};

console.log(JSON.stringify(result, null, 2));
if (!result.summary.allPassed) process.exitCode = 1;
