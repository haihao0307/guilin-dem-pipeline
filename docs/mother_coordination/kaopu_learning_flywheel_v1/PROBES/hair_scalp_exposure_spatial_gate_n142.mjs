import fs from 'node:fs';

const fixtures = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')).fixtures;

export function decide(f) {
  if (!f.subjectBound || !f.cameraBound || !f.maskIdentityBound) {
    return 'HOLD_SPATIAL_EXPOSURE_IDENTITY_UNBOUND';
  }
  if (f.aggregateVisibleFraction > f.aggregateMax) {
    return 'REJECT_GLOBAL_SCALP_EXPOSURE';
  }
  if (!Number.isFinite(f.largestForbiddenComponentFraction)) {
    return 'HOLD_CONNECTED_COMPONENT_MEASUREMENT_MISSING';
  }
  if (f.largestForbiddenComponentFraction > f.largestForbiddenComponentMax) {
    return 'REJECT_LOCALIZED_SCALP_EXPOSURE';
  }
  if (!f.positiveControlDetected) {
    return 'HOLD_EXPOSURE_POSITIVE_CONTROL_FAILED';
  }
  return 'SCOPED_SPATIAL_EXPOSURE_PASS';
}

let passed = 0;
const results = fixtures.map((f) => {
  const actual = decide(f);
  const pass = actual === f.expected;
  if (pass) passed += 1;
  return { id: f.id, expected: f.expected, actual, pass };
});

const report = { success: passed === fixtures.length, passed, total: fixtures.length, results };
console.log(JSON.stringify(report, null, 2));
if (!report.success) process.exitCode = 1;
