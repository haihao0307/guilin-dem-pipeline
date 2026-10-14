import fs from 'node:fs';

const fixture = JSON.parse(fs.readFileSync(new URL('./fabric_first_use_latency_attribution_n159.json', import.meta.url), 'utf8'));

function classify(x) {
  if (!x.exactSubjectBound) return 'HOLD_SUBJECT_OR_RUN_UNBOUND';
  if (!x.schedulerAssertionsPassed) return 'HOLD_SCHEDULING_EVIDENCE_UNBOUND';
  if (!x.visualEquivalencePassed) return 'HOLD_VISUAL_EQUIVALENCE_FAIL';
  if (!x.endToEndStartMark || x.endToEndStartMark === 'UNKNOWN' || !x.phaseCoverageComplete) {
    return 'HOLD_END_TO_END_PHASE_ATTRIBUTION_GAP';
  }
  if (x.performanceDeltaClaimed && !x.controlledPairedComparison) return 'HOLD_UNCONTROLLED_PERFORMANCE_COMPARISON';
  if (!x.phasePositiveControlsPassed) return 'HOLD_PHASE_INSTRUMENT_POSITIVE_CONTROL_MISSING';
  if (!x.longTaskObservationBound) return 'HOLD_INTERACTION_RESPONSIVENESS_UNMEASURED';
  if (!x.targetBudgetFrozen) return 'HOLD_USER_LATENCY_BUDGET_UNFROZEN';
  if (!x.latencyBudgetPassed) return 'USER_LATENCY_BUDGET_EXCEEDED';
  return x.userAccepted ? 'USER_ACCEPTED' : 'END_TO_END_FIRST_USE_LATENCY_VERIFIED_NOT_USER_ACCEPTED';
}

const assertions = fixture.cases.map(test => {
  const observed = classify(test.input);
  return {id: test.id, expected: test.expect, observed, passed: observed === test.expect};
});
const currentState = classify(fixture.observed);
const result = {
  probeId: 'PHASE-LOCAL-TIMER-NOT-END-TO-END-READINESS-001-N159',
  generatedAt: '2026-10-15T07:44:30+08:00',
  boundedQuestion: fixture.boundedQuestion,
  exactSubject: {
    pr: fixture.observed.pr,
    publicHeadSha: fixture.observed.publicHeadSha,
    sourceSha: fixture.observed.sourceSha,
    publicRuntimeSha: fixture.observed.publicRuntimeSha,
    nativeRun: fixture.observed.nativeRun,
    publicBrowserRun: fixture.observed.publicBrowserRun,
    persistenceRun: fixture.observed.persistenceRun
  },
  preservedEvidence: {
    schedulerAssertionsPassed: fixture.observed.schedulerAssertionsPassed,
    visualEquivalencePassed: fixture.observed.visualEquivalencePassed,
    publicDenimReadyMs: fixture.observed.observedPublicDenimReadyMs,
    nativeDenimReadyMs: fixture.observed.observedNativeDenimReadyMs,
    localCompileWaitMs: fixture.observed.reportedLocalCompileWaitMs
  },
  currentState,
  verdict: 'SCHEDULING_CORRECTNESS_AND_VISUAL_EQUIVALENCE_VERIFIED__HOLD_END_TO_END_FIRST_USE_LATENCY_ATTRIBUTION_UNBOUND',
  assertions,
  summary: {passed: assertions.filter(x => x.passed).length, total: assertions.length, allPassed: assertions.every(x => x.passed)},
  productionChanged: false,
  globalR2Changed: false,
  userAcceptance: false
};

fs.writeFileSync(new URL('./fabric_first_use_latency_attribution_result_n159.json', import.meta.url), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({currentState, ...result.summary}));
if (!result.summary.allPassed) process.exitCode = 1;
