import assert from 'node:assert/strict';

const requiredSchemaDigest = 'kaopu.specialist-handoff/1.0';
const allowedContextIds = ['task-anchor', 'accepted-artifact', 'delivery-receipt'];

function evaluate(x) {
  if (!x.handoffObserved) return 'HOLD_HANDOFF_NOT_OBSERVED';
  if (x.schemaDigest !== requiredSchemaDigest) return 'HOLD_HANDOFF_SCHEMA_MISMATCH';
  if (x.forwardedContextIds.some((id) => !allowedContextIds.includes(id)))
    return 'HOLD_HANDOFF_CONTEXT_SCOPE_LEAK';
  if (x.outputArtifactDigest !== x.verifiedArtifactDigest)
    return 'HOLD_HANDOFF_ARTIFACT_SUBJECT_MISMATCH';
  if (!x.independentVerifierPassed) return 'HOLD_SPECIALIST_OUTPUT_UNVERIFIED';
  if (!x.targetAcknowledged) return 'HOLD_HANDOFF_NOT_ACKNOWLEDGED';
  if (!x.retirementReceipt || !x.lastWriteFenceInstalled || !x.runClosed)
    return 'HOLD_SPECIALIST_RETIREMENT_UNPROVEN';
  if (x.sourceOnEndObserved === false && x.retirementDerivedFromOnEnd)
    return 'HOLD_RETIREMENT_DERIVED_FROM_MISSING_ON_END';
  if (x.postRetirementCapabilities.length !== 0)
    return 'HOLD_RETIRED_SPECIALIST_CAPABILITIES_STILL_ACTIVE';
  return 'CANDIDATE_SPECIALIST_HANDOFF_ANCHORED_AND_RETIRED';
}

const base = {
  handoffObserved: true,
  schemaDigest: requiredSchemaDigest,
  forwardedContextIds: allowedContextIds,
  outputArtifactDigest: 'artifact-sha256-a',
  verifiedArtifactDigest: 'artifact-sha256-a',
  independentVerifierPassed: true,
  targetAcknowledged: true,
  retirementReceipt: true,
  lastWriteFenceInstalled: true,
  runClosed: true,
  sourceOnEndObserved: false,
  retirementDerivedFromOnEnd: false,
  postRetirementCapabilities: [],
};

const fixtures = [
  {
    id: 'handoff-event-without-verifier',
    input: { ...base, independentVerifierPassed: false },
    expected: 'HOLD_SPECIALIST_OUTPUT_UNVERIFIED',
  },
  {
    id: 'whole-history-forwarded',
    input: { ...base, forwardedContextIds: [...allowedContextIds, 'rejected-candidate-history'] },
    expected: 'HOLD_HANDOFF_CONTEXT_SCOPE_LEAK',
  },
  {
    id: 'typed-envelope-schema-drift',
    input: { ...base, schemaDigest: 'unversioned-free-text' },
    expected: 'HOLD_HANDOFF_SCHEMA_MISMATCH',
  },
  {
    id: 'handoff-subject-differs-from-verified-artifact',
    input: { ...base, verifiedArtifactDigest: 'artifact-sha256-b' },
    expected: 'HOLD_HANDOFF_ARTIFACT_SUBJECT_MISMATCH',
  },
  {
    id: 'handoff-posted-but-target-not-acknowledged',
    input: { ...base, targetAcknowledged: false },
    expected: 'HOLD_HANDOFF_NOT_ACKNOWLEDGED',
  },
  {
    id: 'handoff-mistaken-for-retirement',
    input: { ...base, retirementReceipt: false, lastWriteFenceInstalled: false, runClosed: false },
    expected: 'HOLD_SPECIALIST_RETIREMENT_UNPROVEN',
  },
  {
    id: 'retirement-inferred-from-source-on-end',
    input: { ...base, retirementDerivedFromOnEnd: true },
    expected: 'HOLD_RETIREMENT_DERIVED_FROM_MISSING_ON_END',
  },
  {
    id: 'retired-specialist-can-still-write',
    input: { ...base, postRetirementCapabilities: ['write-production-branch'] },
    expected: 'HOLD_RETIRED_SPECIALIST_CAPABILITIES_STILL_ACTIVE',
  },
  {
    id: 'typed-filtered-verified-acknowledged-fenced-handoff',
    input: base,
    expected: 'CANDIDATE_SPECIALIST_HANDOFF_ANCHORED_AND_RETIRED',
  },
];

const results = fixtures.map(({ id, input, expected }) => {
  const actual = evaluate(input);
  assert.equal(actual, expected, id);
  return { id, expected, actual, passed: actual === expected };
});

const output = {
  probeId: 'N337-SPECIALIST-HANDOFF-ANCHOR-AND-RETIREMENT',
  boundedQuestion: 'Can a specialist H exit after a verified anchor without forwarding mutable full history or confusing handoff events with acceptance and retirement?',
  decision: 'CANDIDATE_SYNTHETIC_REPLAY_PASSED_NOT_PRODUCTION_VALIDATED',
  teacher: {
    name: 'OpenAI Agents SDK Python handoff and lifecycle semantics',
    status: 'TEACHER_CANDIDATE',
    lifecycle: 'AUDITION',
    exactCommit: '6c4e4a29cd08eef454db6980d74da6afc8939d24',
    release: 'v0.25.0',
    license: 'MIT',
  },
  results,
  passed: results.every((result) => result.passed),
  limitations: [
    'This is a KAOPU contract replay derived from official SDK semantics, not an execution of the SDK package.',
    'OpenAI Agents SDK handoffs stay within one run and do not supply KAOPU authority, artifact acceptance, write fencing, or cross-process termination.',
    'Server-managed conversations do not support handoff input filters; a separate explicitly selected-input run is required when history must not be inherited.',
    'Input guardrails apply only to the first agent and output guardrails only to the final agent; intermediate specialist output still needs an independent verifier gate.',
  ],
};

console.log(JSON.stringify(output, null, 2));
