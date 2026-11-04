import fs from 'node:fs';
import crypto from 'node:crypto';

const inputPath = process.argv[2];
if (!inputPath) throw new Error('usage: node source_rights_gate.mjs rights_cases.json');
const doc = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

function sha256(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function evaluate(entry, intendedUse) {
  const required = [
    entry.sourceUri,
    entry.sourceRetrievedAt,
    entry.sourceEvidence?.licenseExpression,
    entry.artifact?.sha256,
    entry.artifact?.declaredLicenseExpression,
    entry.concludedLicenseExpression
  ];
  if (required.some((value) => !value)) return { status: 'HOLD_RIGHTS_METADATA_INCOMPLETE' };

  const sourceRestrictions = new Set(entry.sourceEvidence.useRestrictions ?? []);
  const embeddedRestrictions = new Set(entry.artifact.embeddedUseRestrictions ?? []);
  const omittedRestrictions = [...sourceRestrictions].filter((item) => !embeddedRestrictions.has(item));
  const conflictingRestrictions = intendedUse.filter((item) => sourceRestrictions.has(item));

  if (conflictingRestrictions.length > 0) {
    return {
      status: 'REJECTED_RIGHTS_CONFLICT',
      conflictingRestrictions,
      omittedRestrictions
    };
  }
  if (entry.sourceEvidence.licenseExpression !== entry.concludedLicenseExpression) {
    return { status: 'HOLD_LICENSE_CONCLUSION_MISMATCH', omittedRestrictions };
  }
  if (omittedRestrictions.length > 0) {
    return { status: 'HOLD_RIGHTS_METADATA_INCOMPLETE', omittedRestrictions };
  }
  return { status: 'PASS_RIGHTS_METADATA_CLOSURE', omittedRestrictions: [] };
}

const results = doc.cases.map((entry) => {
  const gate = evaluate(entry, doc.intendedUse);
  return {
    caseId: entry.caseId,
    sourceEvidenceDigest: `sha256:${sha256(entry.sourceEvidence)}`,
    declaredLicenseExpression: entry.artifact.declaredLicenseExpression,
    concludedLicenseExpression: entry.concludedLicenseExpression,
    ...gate,
    expected: entry.expectedRightsGate,
    matchedExpected: gate.status === entry.expectedRightsGate
  };
});

const output = {
  schema: 'kaopu.source-rights-gate-result/1.0-candidate',
  status: results.every((item) => item.matchedExpected) ? 'GATE_RUN_PASS' : 'GATE_RUN_FAIL',
  results
};

process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
if (output.status !== 'GATE_RUN_PASS') process.exitCode = 1;
