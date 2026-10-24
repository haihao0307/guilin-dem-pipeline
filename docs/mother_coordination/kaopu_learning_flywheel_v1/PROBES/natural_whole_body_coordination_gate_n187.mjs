import fs from 'node:fs';

const fixturePath = process.argv[2];
if (!fixturePath) throw new Error('usage: node natural_whole_body_coordination_gate_n187.mjs <fixture.json>');
const data = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
const p = data.policy;

function evaluate(c) {
  const reasons = [];
  for (const [name, ok] of Object.entries(c.prerequisites || {})) {
    if (ok !== true) reasons.push(`PREREQUISITE_${name.toUpperCase()}_FAIL`);
  }
  if (p.requireActionSpecificEnvelope && c.actionSpecificEnvelope !== true) reasons.push('NO_ACTION_SPECIFIC_ENVELOPE');
  if (p.requireIndependentVerifier && c.independentVerifier !== true) reasons.push('NO_INDEPENDENT_VERIFIER');
  const m = c.metrics || {};
  if (m.footSkateRatio > p.maxFootSkateRatio) reasons.push('FOOT_SKATE');
  if (m.groundPenetrationCm > p.maxGroundPenetrationCm) reasons.push('GROUND_PENETRATION');
  if (m.floatingFrames > p.maxFloatingFrames) reasons.push('FLOATING');
  if (m.peakNormalizedJerk > p.maxPeakNormalizedJerk) reasons.push('JERK_SPIKE');
  if (m.jointLimitViolationFrames > p.maxJointLimitViolationFrames) reasons.push('JOINT_LIMIT_VIOLATION');
  if (m.contactTimingOffsetFrames > p.maxContactTimingOffsetFrames) reasons.push('CONTACT_TIMING_MISMATCH');
  if (m.wholeBodyParticipation < p.minWholeBodyParticipation) reasons.push('WHOLE_BODY_PARTICIPATION_LOW');
  return {id: c.id, verdict: reasons.length ? 'REJECT' : 'CANDIDATE_PASS', reasons};
}

const results = data.cases.map(evaluate);
const mismatches = results.filter((r, i) => r.verdict !== data.cases[i].expected);
const out = {
  schemaVersion: data.schemaVersion,
  fixtureCount: results.length,
  expectedMatches: results.length - mismatches.length,
  mismatches,
  results
};
process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
process.exitCode = mismatches.length ? 1 : 0;
