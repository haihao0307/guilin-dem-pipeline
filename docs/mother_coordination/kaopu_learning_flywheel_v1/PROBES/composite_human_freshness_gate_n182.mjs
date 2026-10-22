import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.join(here, 'composite_human_freshness_fixture_n182.json');
const resultPath = path.join(here, 'composite_human_freshness_result_n182.json');
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

function classify(testCase) {
  const required = fixture.requiredComponents;
  const expected = testCase.expectedResolution;
  const actual = testCase.actualRuntime;
  if (!expected || !expected.resolvedAtDispatch) {
    return {state: 'HOLD_EXPECTED_COMPONENT_SET_UNRESOLVED', missing: required};
  }
  const expectedComponents = expected.components || {};
  const missingExpected = required.filter(name => !expectedComponents[name]);
  if (missingExpected.length) {
    return {state: 'HOLD_EXPECTED_COMPONENT_SET_INCOMPLETE', missing: missingExpected};
  }
  const actualComponents = actual?.components || {};
  const missingActual = required.filter(name => !actualComponents[name]);
  if (missingActual.length) {
    return {state: 'HOLD_ACTUAL_COMPONENT_INVENTORY_INCOMPLETE', missing: missingActual};
  }
  const mismatched = required.filter(name => actualComponents[name] !== expectedComponents[name]);
  if (mismatched.length) {
    return {state: 'HOLD_COMPOSITE_SUBJECT_COMPONENT_MISMATCH', mismatched};
  }
  return {state: 'COMPOSITE_SUBJECT_VERIFIED', mismatched: []};
}

const results = fixture.cases.map(testCase => {
  const actual = classify(testCase);
  return {
    name: testCase.name,
    expected: testCase.expect,
    actual: actual.state,
    detail: actual,
    pass: actual.state === testCase.expect
  };
});

const output = {
  schema: 'kaopu/composite-subject-freshness-result@1',
  fixture: path.basename(fixturePath),
  passed: results.filter(result => result.pass).length,
  total: results.length,
  currentProductionEventState: results[0].actual,
  results
};

fs.writeFileSync(resultPath, JSON.stringify(output, null, 2) + '\n');
console.log(`${output.passed}/${output.total} composite-subject cases passed`);
if (output.passed !== output.total) process.exitCode = 1;
