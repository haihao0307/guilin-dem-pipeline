import assert from 'node:assert/strict';
import fs from 'node:fs';
import process from 'node:process';

const fixturePath = process.argv[2];
if (!fixturePath) throw new Error('usage: node material_r06_composite_coverage_probe_n168.mjs <fixture.json>');
const input = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
const required = new Set(input.declared_coverage);

function decide(fixture) {
  const current = new Set(fixture.current_atoms);
  const missingFromCurrent = [...required].filter((claim) => !current.has(claim));
  if (missingFromCurrent.length === 0) {
    return { state: 'CURRENT_RUN_COVERAGE_VERIFIED', missing: [] };
  }
  if (fixture.prior_atoms.length === 0) {
    return { state: 'HOLD_DECLARED_COVERAGE_UNBOUND', missing: missingFromCurrent };
  }
  if (!fixture.prior_binding_complete) {
    return { state: 'HOLD_PRIOR_EVIDENCE_BINDING_INCOMPLETE', missing: missingFromCurrent };
  }
  if (!fixture.prior_subject_matches) {
    return { state: 'HOLD_PRIOR_EVIDENCE_SUBJECT_MISMATCH', missing: missingFromCurrent };
  }
  const prior = new Set(fixture.prior_atoms);
  const missing = missingFromCurrent.filter((claim) => !prior.has(claim));
  return missing.length
    ? { state: 'HOLD_DECLARED_COVERAGE_UNBOUND', missing }
    : { state: 'COMPOSITE_COVERAGE_VERIFIED', missing: [] };
}

const results = input.fixtures.map((fixture) => {
  const decision = decide(fixture);
  assert.equal(decision.state, fixture.expected, fixture.id);
  return { id: fixture.id, expected: fixture.expected, ...decision };
});

const output = {
  probe_id: input.probe_id,
  current_run_id: input.current_subject.run_id,
  required_claims: [...required],
  results,
  summary: {
    total: results.length,
    expected_matched: results.length,
    current_receipt_state: results[0].state,
    current_receipt_unbound_claims: results[0].missing
  },
  rule: 'A prior run contributes only named evidence atoms bound to exact tested subject, run, artifact digest and evidence path/digest. A bare run ID does not close coverage.'
};

process.stdout.write(JSON.stringify(output, null, 2) + '\n');
