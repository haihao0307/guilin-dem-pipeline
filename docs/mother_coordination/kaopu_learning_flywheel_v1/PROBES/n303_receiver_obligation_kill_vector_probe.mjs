#!/usr/bin/env node

const criticalObligations = [
  { id: 'O_NEG_TARGET_ABSENT', mutantId: 'M_NEG_REENABLE_TARGET' },
  { id: 'O_POS_ADJACENT_LIVE', mutantId: 'M_POS_DISABLE_ADJACENT' },
];

const scenarios = [
  {
    id: 'AGGREGATE_HIGH_BUT_CRITICAL_SURVIVES',
    nonCriticalKilled: 99,
    critical: { M_NEG_REENABLE_TARGET: 'KILLED', M_POS_DISABLE_ADJACENT: 'SURVIVED' },
  },
  {
    id: 'BOTH_CRITICAL_MUTANTS_KILLED',
    nonCriticalKilled: 0,
    critical: { M_NEG_REENABLE_TARGET: 'KILLED', M_POS_DISABLE_ADJACENT: 'KILLED' },
  },
  {
    id: 'CRITICAL_MUTANT_HAS_NO_COVERAGE',
    nonCriticalKilled: 99,
    critical: { M_NEG_REENABLE_TARGET: 'KILLED', M_POS_DISABLE_ADJACENT: 'NO_COVERAGE' },
  },
  {
    id: 'CRITICAL_MUTANT_TIMES_OUT',
    nonCriticalKilled: 99,
    critical: { M_NEG_REENABLE_TARGET: 'KILLED', M_POS_DISABLE_ADJACENT: 'TIMEOUT' },
  },
];

function genericMutationScore(scenario) {
  const states = Object.values(scenario.critical);
  const killed = scenario.nonCriticalKilled + states.filter((state) => state === 'KILLED').length;
  const timeout = states.filter((state) => state === 'TIMEOUT').length;
  const survived = states.filter((state) => state === 'SURVIVED').length;
  const noCoverage = states.filter((state) => state === 'NO_COVERAGE').length;
  const detected = killed + timeout;
  const valid = detected + survived + noCoverage;
  return valid === 0 ? null : Number(((detected / valid) * 100).toFixed(2));
}

function obligationVectorDecision(scenario) {
  const vector = criticalObligations.map(({ id, mutantId }) => ({
    obligationId: id,
    mutantId,
    state: scenario.critical[mutantId] ?? 'NOT_RUN',
  }));
  const pass = vector.every(({ state }) => state === 'KILLED');
  return {
    vector,
    decision: pass ? 'PASS' : 'HOLD',
    reason: pass
      ? 'Every mandatory receiver-specific obligation mutant was killed.'
      : 'At least one mandatory receiver-specific obligation mutant was not conclusively killed.',
  };
}

const results = scenarios.map((scenario) => {
  const score = genericMutationScore(scenario);
  const obligation = obligationVectorDecision(scenario);
  return {
    scenarioId: scenario.id,
    genericMutationScorePercent: score,
    aggregateThreshold95WouldPass: score !== null && score >= 95,
    obligationKillVector: obligation.vector,
    obligationDecision: obligation.decision,
  };
});

const assertions = {
  highAggregateCanHideCriticalSurvivor:
    results[0].aggregateThreshold95WouldPass === true && results[0].obligationDecision === 'HOLD',
  bothCriticalKilledPasses: results[1].obligationDecision === 'PASS',
  noCoverageIsInconclusive: results[2].obligationDecision === 'HOLD',
  timeoutIsInconclusiveForCriticalAcceptance:
    results[3].aggregateThreshold95WouldPass === true && results[3].obligationDecision === 'HOLD',
};

const output = {
  probeId: 'RECEIVER_OBLIGATION_KILL_VECTOR_001_N303',
  question:
    'How can adjacent-function liveness be normalized across Mothers without importing receiver-specific topology, scale, count, or duration constants?',
  method:
    'Normalize semantic obligations and mandatory mutant states, not raw receiver measurements: O- target absent, O+ adjacent function live; both paired mutants must be exactly KILLED.',
  boundary:
    'Aggregate mutation score is descriptive only. SURVIVED, NO_COVERAGE, TIMEOUT, errors, ignored, or not-run are HOLD for a mandatory acceptance mutant.',
  results,
  assertions,
  probeDecision: Object.values(assertions).every(Boolean) ? 'SUPPORTED' : 'FALSIFIED',
};

process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
if (output.probeDecision !== 'SUPPORTED') process.exitCode = 1;
