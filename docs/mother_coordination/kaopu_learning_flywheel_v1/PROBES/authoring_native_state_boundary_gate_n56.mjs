import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = process.argv[2] ?? path.join(here, 'authoring_native_state_boundary_fixture_n56.json');
const outputPath = process.argv[3] ?? path.join(here, 'authoring_native_state_boundary_result_n56.json');
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

function classify(c, toleranceM) {
  if (!['AUTHORING_INITIALIZATION', 'NATIVE_STEP'].includes(c.phaseKind)) {
    return 'HOLD_STATE_PHASE_UNDECLARED';
  }
  const expectedPurpose = c.phaseKind === 'AUTHORING_INITIALIZATION'
    ? 'AUTHORING_BOUNDARY_CONTINUITY'
    : 'NATIVE_SUBSTEP_CONTINUITY';
  if (c.requirePreviousClosurePurpose !== expectedPurpose) {
    return 'HOLD_STATE_PHASE_PURPOSE_MISMATCH';
  }
  if (c.phaseKind === 'AUTHORING_INITIALIZATION') {
    if (c.claimedNativeContinuity) return 'HOLD_NATIVE_EVIDENCE_FROM_AUTHORING_RESET';
    if (c.stateSyncPerformed && (
      c.physicsTimeBefore !== c.physicsTimeAfter ||
      c.substepIdBefore !== c.substepIdAfter
    )) return 'HOLD_AUTHORING_SYNC_CHANGED_CLOCK';
    if (c.currentGapM > toleranceM) return 'HOLD_CURRENT_CLOSURE_OPEN';
    if (c.previousGapAfterSyncM > toleranceM) return 'HOLD_AUTHORING_PREVIOUS_STALE';
    return c.stateSyncPerformed
      ? 'PASS_AUTHORING_STATE_SYNC_NOT_NATIVE_EVIDENCE'
      : 'PASS_AUTHORING_BOUNDARY_ALREADY_COHERENT';
  }
  if (c.stateSyncPerformed) return 'HOLD_NATIVE_HISTORY_RESET';
  if (c.substepIdAfter !== c.substepIdBefore + 1 || c.physicsTimeAfter <= c.physicsTimeBefore) {
    return 'HOLD_NATIVE_STEP_SEQUENCE_INVALID';
  }
  if (c.currentGapM > toleranceM || c.previousGapAfterSyncM > toleranceM) {
    return 'HOLD_NATIVE_PREVIOUS_CLOSURE_OPEN';
  }
  return 'PASS_NATIVE_PREVIOUS_CLOSURE';
}

const cases = fixture.cases.map(c => {
  const actual = classify(c, fixture.toleranceM);
  return { id: c.id, expected: c.expected, actual, passed: actual === c.expected };
});
const result = {
  caseId: fixture.caseId,
  generatedAt: '2026-10-01T09:45:22Z',
  passed: cases.filter(c => c.passed).length,
  total: cases.length,
  allPassed: cases.every(c => c.passed),
  cases
};
fs.writeFileSync(outputPath, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
if (!result.allPassed) process.exitCode = 1;
