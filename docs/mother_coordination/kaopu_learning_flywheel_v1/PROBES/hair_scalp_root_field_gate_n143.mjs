import fs from 'node:fs';

const fixtures = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')).fixtures;

export function decide(f) {
  if (f.directExternalArtifactImport && !f.commercialPermissionBound) {
    return 'REJECT_EXTERNAL_ARTIFACT_LICENSE_UNBOUND';
  }
  if (!f.sourceBound || !f.scalpMeshBound || !f.uvBound ||
      !f.densityFieldBound || !f.directionFieldBound || !f.allowedPartMaskBound) {
    return 'HOLD_ROOT_FIELD_RECEIPT_UNBOUND';
  }
  if (!f.samplingSeedBound) return 'HOLD_ROOT_SAMPLING_NOT_REPLAYABLE';
  if (!f.positiveControlsDetected) return 'HOLD_ROOT_FIELD_POSITIVE_CONTROL_FAILED';
  if (!Number.isFinite(f.largestForbiddenUnderdensityFraction) ||
      !Number.isFinite(f.directionDiscontinuityP95Degrees)) {
    return 'HOLD_ROOT_FIELD_MEASUREMENT_MISSING';
  }
  if (f.largestForbiddenUnderdensityFraction > f.largestForbiddenUnderdensityMax) {
    return 'REJECT_LOCAL_ROOT_UNDERDENSITY';
  }
  if (f.directionDiscontinuityP95Degrees > f.directionDiscontinuityMaxDegrees) {
    return 'REJECT_ROOT_FLOW_DISCONTINUITY';
  }
  return 'SCOPED_ROOT_FIELD_RECEIPT_PASS';
}

let passed = 0;
const results = fixtures.map((f) => {
  const actual = decide(f);
  const pass = actual === f.expected;
  if (pass) passed += 1;
  return {id: f.id, expected: f.expected, actual, pass};
});

const report = {success: passed === fixtures.length, passed, total: fixtures.length, results};
console.log(JSON.stringify(report, null, 2));
if (!report.success) process.exitCode = 1;
