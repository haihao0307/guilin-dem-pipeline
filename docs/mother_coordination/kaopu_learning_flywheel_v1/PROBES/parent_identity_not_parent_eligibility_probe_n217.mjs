import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const regressionPath = path.join(here, 'CANDIDATE_PARENT_IDENTITY_NOT_PARENT_ELIGIBILITY_001.json');
const regression = JSON.parse(fs.readFileSync(regressionPath, 'utf8'));

function classify(input) {
  if (input.parentDigestMatches === false) return 'HOLD_PARENT_DIGEST_MISMATCH';
  if (!input.parentArtifactDigest || !input.parentSubjectDigest) return 'HOLD_PARENT_IDENTITY_UNBOUND';
  if (!input.parentVerifierVerdict || !input.parentAcceptedScope) return 'HOLD_PARENT_ELIGIBILITY_UNBOUND';
  if (input.rejectedScopeCarriedForward && !input.userReauthorizationForRejectedScope) {
    return 'HOLD_REJECTED_DESCENDANT_PRESENT';
  }
  const required = ['inheritedScope', 'changedScope', 'independentVerifierIdentity', 'childArtifactDigest'];
  if (required.some((key) => input[key] == null)) return 'HOLD_PARENT_ELIGIBILITY_UNBOUND';
  return 'CANDIDATE_LINEAGE_ELIGIBLE_NOT_USER_ACCEPTED';
}

const results = regression.cases.map((fixture) => {
  const actual = classify(fixture.input);
  return { id: fixture.id, expect: fixture.expect, actual, passed: actual === fixture.expect };
});
const output = {
  caseId: regression.caseId,
  total: results.length,
  passed: results.filter((result) => result.passed).length,
  allPassed: results.every((result) => result.passed),
  results
};
console.log(JSON.stringify(output, null, 2));
if (!output.allPassed) process.exitCode = 1;
