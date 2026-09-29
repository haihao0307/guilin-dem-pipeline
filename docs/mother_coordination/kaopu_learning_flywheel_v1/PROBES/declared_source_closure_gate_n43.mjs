import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const fixturePath = new URL('./declared_source_closure_fixture_n43.json', import.meta.url);
const fixture = JSON.parse(await readFile(fixturePath, 'utf8'));

function insideProject(path) {
  return typeof path === 'string' && path.length > 0 && !path.startsWith('/') && !path.split('/').includes('..');
}

function evaluate(subject) {
  if (subject.subjectHeadSha !== subject.observedHeadSha) {
    return { verdict: 'HOLD_SUBJECT_HEAD_MISMATCH' };
  }

  const declared = [...subject.scriptTargets, ...subject.localSourceInputs];
  const escapedPaths = declared.filter((path) => !insideProject(path));
  if (escapedPaths.length) {
    return { verdict: 'HOLD_PROJECT_PATH_ESCAPE', escapedPaths };
  }

  const files = new Set(subject.files);
  const missingScriptTargets = subject.scriptTargets.filter((path) => !files.has(path));
  const missingLocalSourceInputs = subject.localSourceInputs.filter((path) => !files.has(path));
  if (missingScriptTargets.length || missingLocalSourceInputs.length) {
    return {
      verdict: 'HOLD_DECLARED_SOURCE_CLOSURE_INCOMPLETE',
      missingScriptTargets,
      missingLocalSourceInputs
    };
  }

  if (subject.dynamicSourceClosureKnown === false) {
    return { verdict: 'UNKNOWN_DYNAMIC_SOURCE_CLOSURE' };
  }

  return { verdict: 'SOURCE_CLOSURE_VERIFIED_ONLY' };
}

const checks = fixture.cases.map((testCase, index) => {
  const actual = evaluate(testCase.subject);
  const pass = JSON.stringify(actual) === JSON.stringify(testCase.expected);
  return {
    id: String(index + 1).padStart(2, '0') + '-' + testCase.id,
    actual,
    expected: testCase.expected,
    pass
  };
});

for (const check of checks) assert.equal(check.pass, true, check.id);

const result = {
  studyId: 'N43',
  candidateId: 'DECLARED-RUNNABLE-SOURCE-CLOSURE-001',
  historicalSubjectHeadSha: fixture.historicalSubjectHeadSha,
  historicalDecision: checks[0].actual.verdict,
  checksPassed: checks.filter((check) => check.pass).length,
  checksTotal: checks.length,
  allPassed: checks.every((check) => check.pass),
  checks,
  generatedAt: '2026-09-29T04:14:00Z'
};

process.stdout.write(JSON.stringify(result, null, 2) + '\n');
