#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function evaluateReal3DClaim(input) {
  if (!input.taskRequiresReal3D) return { status: 'NOT_APPLICABLE', reasons: [] };
  const reasons = [];
  if (input.declares3D && !input.runtime3DContextObserved) {
    reasons.push('DECLARED_3D_WITHOUT_3D_RUNTIME');
  }
  if (input.canvas2DOnly) reasons.push('CANVAS_2D_ONLY_RENDERER');
  if (input.ciSuccess && !input.ciAssertsRuntime3D) {
    reasons.push('CI_GREEN_NON_3D_SCOPE_ONLY');
  }
  if (input.screenshotExists && !input.criticalInteractionVerified) {
    reasons.push('SCREENSHOT_NOT_INTERACTION_EVIDENCE');
  }
  return {
    status: reasons.length
      ? 'REJECTED_2D_CANVAS_SUBSTITUTE'
      : 'PASS_REAL_3D_RUNTIME_EVIDENCE',
    reasons
  };
}

const here = path.dirname(fileURLToPath(import.meta.url));
const defaultCase = path.resolve(
  here,
  '../REGRESSION_CASES/CANDIDATE_REAL_3D_CLAIM_RUNTIME_EVIDENCE_001.json'
);
const casePath = process.argv[2] ? path.resolve(process.argv[2]) : defaultCase;
const contract = JSON.parse(fs.readFileSync(casePath, 'utf8'));
const outcomes = contract.cases.map(test => {
  const actual = evaluateReal3DClaim(test.input);
  return { ...test, actual, passed: actual.status === test.expect };
});
const result = {
  schema: 'kaopu.real-3d-claim-runtime-gate/1',
  checkedAt: new Date().toISOString(),
  caseId: contract.caseId,
  outcomes,
  summary: {
    passed: outcomes.filter(item => item.passed).length,
    total: outcomes.length,
    allPassed: outcomes.every(item => item.passed)
  }
};
process.stdout.write(JSON.stringify(result, null, 2) + '\n');
if (!result.summary.allPassed) process.exitCode = 1;
