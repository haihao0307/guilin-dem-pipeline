#!/usr/bin/env node

import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const subjects = {
  before: 'c1a75170',
  candidate: '21e4a025',
  browserQa: 'kaopu-hair-workbench/qa/full-cluster-source/tests/browser-qa.cjs',
  aggregate: 'kaopu-hair-workbench/qa/full-cluster-source/tests/aggregate-groups.cjs'
};

const show = (revision, path) => execFileSync(
  'git', ['show', `${revision}:${path}`], { encoding: 'utf8' }
);
const sha256 = text => crypto.createHash('sha256').update(text).digest('hex');
const before = show(subjects.before, subjects.browserQa);
const candidate = show(subjects.candidate, subjects.browserQa);
const aggregate = show(subjects.candidate, subjects.aggregate);

const sourceChecks = [
  ['before has no nonfatal recorder', !before.includes('const recordCheck=')],
  ['before passes fatal check into lighting helper', before.includes("require('./lighting-geometry.cjs')(browser,startupUrl,path.join(OUT,'lighting-geometry'),check)")],
  ['candidate declares nonfatal recorder', candidate.includes('const recordCheck=')],
  ['candidate passes recorder into lighting helper', candidate.includes("require('./lighting-geometry.cjs')(browser,startupUrl,path.join(OUT,'lighting-geometry'),recordCheck)")],
  ['candidate passes recorder into first-entry helper', candidate.includes("require('./first-entry.cjs')(browser,startupUrl,path.join(OUT,'first-entry'),recordCheck)")],
  ['candidate retains hard lighting verdict', candidate.includes("check('next-stage lighting and safe geometry evidence passes',result.lightingGeometry.passed)")],
  ['candidate retains hard first-entry verdict', candidate.includes("check('real first Rabbit startup and visible Anemone controls pass',result.firstEntry.passed")],
  ['aggregate rejects every recorded failed test', aggregate.includes('r.tests.every(t=>t.pass===true)')]
].map(([name, pass]) => ({ name, pass }));

function runCell({
  prerequisite = true,
  directional = true,
  laterDiagnostic = true,
  lightingHelper = true,
  firstEntryHelper = true,
  forceProducerPassed = false,
  omitFirstEntry = false,
  staged = true
} = {}) {
  const result = {
    tests: [],
    evidence: [],
    lightingGeometry: { passed: lightingHelper },
    firstEntry: omitFirstEntry ? undefined : { passed: firstEntryHelper },
    passed: false,
    error: null
  };
  const record = (name, pass) => result.tests.push({ name, pass: !!pass });
  const hard = (name, pass) => {
    record(name, pass);
    if (!pass) throw new Error(name);
  };
  const soft = (name, pass) => record(name, pass);

  try {
    hard('safe prerequisite', prerequisite);
    if (staged) {
      soft('directional separation', directional);
      result.evidence.push('directional separation');
      soft('later material diagnostic', laterDiagnostic);
      result.evidence.push('later material diagnostic');
    } else {
      hard('directional separation', directional);
      result.evidence.push('directional separation');
      hard('later material diagnostic', laterDiagnostic);
      result.evidence.push('later material diagnostic');
    }
    hard('lighting helper final verdict', lightingHelper);
    hard('first-entry helper final verdict', !!result.firstEntry?.passed);
    result.passed = true;
  } catch (error) {
    result.error = error.message;
  }
  if (forceProducerPassed) result.passed = true;
  result.aggregatePass = result.passed === true &&
    result.tests.length > 0 &&
    result.tests.every(test => test.pass === true) &&
    result.lightingGeometry?.passed === true &&
    result.firstEntry?.passed === true;
  return result;
}

const definitions = [
  {
    id: 'old-fatal-negative-starves-later-evidence',
    input: { staged: false, directional: false },
    expectedAggregate: false,
    expectedLaterEvidence: false
  },
  {
    id: 'staged-negative-collects-later-evidence-but-rejects',
    input: { staged: true, directional: false },
    expectedAggregate: false,
    expectedLaterEvidence: true
  },
  {
    id: 'all-independent-checks-pass',
    input: { staged: true },
    expectedAggregate: true,
    expectedLaterEvidence: true
  },
  {
    id: 'unsafe-prerequisite-remains-fatal',
    input: { staged: true, prerequisite: false },
    expectedAggregate: false,
    expectedLaterEvidence: false
  },
  {
    id: 'producer-pass-flag-cannot-hide-recorded-failure',
    input: { staged: true, directional: false, forceProducerPassed: true },
    expectedAggregate: false,
    expectedLaterEvidence: true
  },
  {
    id: 'missing-first-entry-helper-rejects',
    input: { staged: true, omitFirstEntry: true },
    expectedAggregate: false,
    expectedLaterEvidence: true
  },
  {
    id: 'failed-lighting-helper-rejects',
    input: { staged: true, lightingHelper: false },
    expectedAggregate: false,
    expectedLaterEvidence: true
  }
];

const cases = definitions.map(definition => {
  const observed = runCell(definition.input);
  const laterEvidence = observed.evidence.includes('later material diagnostic');
  const pass = observed.aggregatePass === definition.expectedAggregate &&
    laterEvidence === definition.expectedLaterEvidence;
  return {
    id: definition.id,
    expectedAggregate: definition.expectedAggregate ? 'PASS' : 'REJECT',
    observedAggregate: observed.aggregatePass ? 'PASS' : 'REJECT',
    expectedLaterEvidence: definition.expectedLaterEvidence,
    observedLaterEvidence: laterEvidence,
    recordedFailures: observed.tests.filter(test => !test.pass).map(test => test.name),
    pass
  };
});

const result = {
  schema: 'kaopu.diagnostic-assertion-staging-replay/1',
  trialId: 'KUKO-DIAGNOSTIC-ASSERTION-STAGING-N70',
  status: 'CANDIDATE_LOCAL_REPLAY',
  subjects: {
    ...subjects,
    beforeBrowserQaSha256: sha256(before),
    candidateBrowserQaSha256: sha256(candidate),
    candidateAggregateSha256: sha256(aggregate)
  },
  hypothesis: 'Independent diagnostic failures may continue collecting evidence, but every recorded failure and every failed or missing required helper must still reject the cell and aggregate.',
  sourceVerification: {
    total: sourceChecks.length,
    passed: sourceChecks.filter(check => check.pass).length,
    checks: sourceChecks
  },
  replay: {
    total: cases.length,
    passed: cases.filter(test => test.pass).length,
    cases
  }
};

const ok = result.sourceVerification.passed === result.sourceVerification.total &&
  result.replay.passed === result.replay.total;
result.status = ok ? 'CANDIDATE_LOCAL_REPLAY_PASSED' : 'CANDIDATE_LOCAL_REPLAY_FAILED';
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
process.exitCode = ok ? 0 : 1;
