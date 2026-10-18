import fs from 'node:fs';

const fixturePath = new URL('./lip_session_takeover_n172.json', import.meta.url);
const fixtures = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

export function classifyTakeover(x) {
  const reasons = [];
  if (!x.taskId || !x.branch || !x.observedHead || !x.nextConcreteCommand) {
    reasons.push('TAKEOVER_RECEIPT_INCOMPLETE');
  }
  if (x.boundHead && x.observedHead && x.boundHead !== x.observedHead) {
    reasons.push('STALE_HEAD');
  }
  if (x.priorRunClaim === 'running' && !x.liveRunReceipt) {
    reasons.push('EXECUTION_LIVENESS_UNBOUND');
  }
  if (x.attemptedMutation && x.mutationOutcome === 'UNKNOWN') {
    reasons.push('MUTATION_RECEIPT_UNKNOWN');
  }
  if ((x.sameBlockerAttempts ?? 0) >= 2) {
    reasons.push('ESCALATE_COMMON_CAUSE');
  }

  if (reasons.includes('STALE_HEAD')) {
    return { state: 'REJECT_STALE_TAKEOVER', writeAllowed: false, reasons };
  }
  if (reasons.includes('TAKEOVER_RECEIPT_INCOMPLETE')) {
    return { state: 'HOLD_TAKEOVER_RECEIPT_INCOMPLETE', writeAllowed: false, reasons };
  }
  if (reasons.includes('MUTATION_RECEIPT_UNKNOWN')) {
    return { state: 'HOLD_MUTATION_RECEIPT_UNKNOWN', writeAllowed: false, readOnlyDiagnosticsAllowed: true, reasons };
  }
  if (reasons.includes('EXECUTION_LIVENESS_UNBOUND')) {
    return { state: 'HOLD_EXECUTION_LIVENESS_UNBOUND', writeAllowed: false, readOnlyDiagnosticsAllowed: true, reasons };
  }
  return { state: 'SAFE_TO_RESUME_EXACT_CHECKPOINT', writeAllowed: true, reasons };
}

let passed = 0;
for (const fixture of fixtures) {
  const actual = classifyTakeover(fixture.input);
  const ok = actual.state === fixture.expectedState && actual.writeAllowed === fixture.expectedWriteAllowed;
  if (!ok) {
    console.error(JSON.stringify({ id: fixture.id, expected: fixture.expectedState, actual }));
    process.exitCode = 1;
  } else {
    passed += 1;
  }
}

console.log(JSON.stringify({ passed, total: fixtures.length }));
