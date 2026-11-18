import assert from 'node:assert/strict';

const history = [
  { id: 'N309', class: 'TRUST_BOUNDARY_CALLER_CONTROLLED', result: 'HOLD_GATE_FAIL', receiverAck: false },
  { id: 'N311', class: 'TRUST_BOUNDARY_CALLER_CONTROLLED', result: 'HOLD_GATE_FAIL', receiverAck: false },
  { id: 'N312', class: 'TRUST_BOUNDARY_CALLER_CONTROLLED', result: 'HOLD_GATE_FAIL', receiverAck: false },
  { id: 'N313', class: 'TRUST_BOUNDARY_CALLER_CONTROLLED', result: 'HOLD_GATE_FAIL', receiverAck: false },
  { id: 'N314', class: 'TRUST_BOUNDARY_CALLER_CONTROLLED', result: 'HOLD_GATE_FAIL', receiverAck: false },
  { id: 'N315', class: 'TRUST_BOUNDARY_CALLER_CONTROLLED', result: 'HOLD_GATE_FAIL', receiverAck: false }
];

function review({ history, proposedAction, receiverTrial }) {
  const failed = history.filter((x) => x.class === 'TRUST_BOUNDARY_CALLER_CONTROLLED' && x.result === 'HOLD_GATE_FAIL');
  const receiverAcknowledged = history.some((x) => x.receiverAck);
  const trialComplete = Boolean(
    receiverTrial?.actualMotherId &&
    receiverTrial?.taskAnchorDigest &&
    receiverTrial?.producerCommit &&
    receiverTrial?.independentVerifierRoute &&
    receiverTrial?.durableCheckpointRoute &&
    receiverTrial?.restartReplayReceipt &&
    receiverTrial?.currentFreshReceipt
  );

  if (failed.length >= 2 && proposedAction === 'ANOTHER_SYNTHETIC_PATCH') {
    return {
      status: 'REJECT_REPEATED_PATCH_LOOP',
      sameBlockerFailureCount: failed.length,
      failedCandidateIds: failed.map((x) => x.id)
    };
  }
  if (!receiverAcknowledged) return { status: 'HOLD_RECEIVER_ACK_MISSING' };
  if (!trialComplete) return { status: 'HOLD_SINGLE_MOTHER_TRIAL_INCOMPLETE' };
  return { status: 'SINGLE_MOTHER_TRIAL_CONTRACT_COMPLETE_NOT_ADOPTION' };
}

const repeatedPatch = review({ history, proposedAction: 'ANOTHER_SYNTHETIC_PATCH' });
const noReceiver = review({ history, proposedAction: 'REAL_SINGLE_MOTHER_TRIAL' });
const incompleteTrial = review({
  history: history.map((x, i) => ({ ...x, receiverAck: i === 0 })),
  proposedAction: 'REAL_SINGLE_MOTHER_TRIAL',
  receiverTrial: {
    actualMotherId: 'garment-mother',
    taskAnchorDigest: 'sha256:fixture',
    producerCommit: 'fixture-commit'
  }
});
const completeContract = review({
  history: history.map((x, i) => ({ ...x, receiverAck: i === 0 })),
  proposedAction: 'REAL_SINGLE_MOTHER_TRIAL',
  receiverTrial: {
    actualMotherId: 'garment-mother',
    taskAnchorDigest: 'sha256:fixture',
    producerCommit: 'fixture-commit',
    independentVerifierRoute: 'external-verifier-route',
    durableCheckpointRoute: 'independent-nonvolatile-route',
    restartReplayReceipt: 'receipt:restart-old-bundle-rejected',
    currentFreshReceipt: 'receipt:current-bundle-verified'
  }
});

assert.equal(repeatedPatch.status, 'REJECT_REPEATED_PATCH_LOOP');
assert.equal(repeatedPatch.sameBlockerFailureCount, 6);
assert.equal(noReceiver.status, 'HOLD_RECEIVER_ACK_MISSING');
assert.equal(incompleteTrial.status, 'HOLD_SINGLE_MOTHER_TRIAL_INCOMPLETE');
assert.equal(completeContract.status, 'SINGLE_MOTHER_TRIAL_CONTRACT_COMPLETE_NOT_ADOPTION');

console.log(JSON.stringify({
  probe: 'n316_root_cause_review_gate',
  boundedQuestion: 'May the KaoPuGram trust-chain task continue with another synthetic patch after repeated failures share one blocker?',
  rootCause: {
    sharedBlocker: 'Synthetic single-process probes let the candidate choose or embed the authority, observation, time, and persistence roots used to validate itself.',
    sameBlockerFailureCount: repeatedPatch.sameBlockerFailureCount,
    failedCandidateIds: repeatedPatch.failedCandidateIds,
    receiverAcknowledged: false,
    realSingleMotherTrial: false,
    independentDurableTrustRoot: false
  },
  decisions: {
    anotherSyntheticPatch: repeatedPatch,
    realTrialWithoutReceiverAck: noReceiver,
    acknowledgedButIncompleteTrial: incompleteTrial,
    completeTrialContract: completeContract
  },
  currentState: 'BLOCKED_VALID',
  nextAllowedStep: 'One actual Mother trial with an exact Task Anchor, receiver receipt, independent verifier route, durable checkpoint route, restart replay rejection, and fresh-current acceptance.',
  boundary: 'A complete trial contract only permits the trial. It does not mean IMPLEMENTED, ADOPTED, or USER-ACCEPTED.'
}, null, 2));
