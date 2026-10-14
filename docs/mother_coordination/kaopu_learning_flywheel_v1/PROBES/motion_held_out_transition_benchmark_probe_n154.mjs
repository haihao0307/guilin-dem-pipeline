import fs from 'node:fs';

const path = process.argv[2];
if (!path) throw new Error('usage: node n154_probe.mjs CASE.json');
const data = JSON.parse(fs.readFileSync(path, 'utf8'));

function classify(f) {
  if (f.teacherAssetsImported) return 'REJECT_TEACHER_ASSET_RIGHTS_VIOLATION';
  if (!f.subjectBound) return 'HOLD_TRANSITION_SUBJECT_UNBOUND';
  if (!f.ownedSourceBound || !f.heldOutTruthBound) {
    if (!f.heldOutTruthBound && f.metricsBound) return 'HOLD_TRANSITION_GROUND_TRUTH_WINDOW_UNBOUND';
    return 'HOLD_TRANSITION_BENCHMARK_AND_CONTACT_BASELINE_UNBOUND';
  }
  if (!f.skeletonAndRateBound) return 'HOLD_TRANSITION_SUBJECT_IDENTITY_UNBOUND';
  if (!f.metricsBound) return 'HOLD_TRANSITION_METRICS_UNBOUND';
  if (!f.contactBound) return 'HOLD_TRANSITION_CONTACT_RETENTION_UNBOUND';
  if (!f.controlsDetected) return 'HOLD_TRANSITION_POSITIVE_CONTROL_MISSING';
  if (f.frameJumpViolation) return 'REJECT_TRANSITION_FRAME_JUMP';
  if (f.footSlideViolation) return 'REJECT_TRANSITION_CONTACT_REGRESSION';
  return 'SCOPED_MOTION_TRANSITION_BENCHMARK_PASS';
}

const results = data.fixtures.map(f => {
  const actual = classify(f);
  return {id: f.id, expected: f.expected, actual, pass: actual === f.expected};
});
const output = {
  caseId: data.caseId,
  passed: results.filter(x => x.pass).length,
  total: results.length,
  success: results.every(x => x.pass),
  results
};
process.stdout.write(JSON.stringify(output, null, 2) + '\n');
if (!output.success) process.exitCode = 1;
