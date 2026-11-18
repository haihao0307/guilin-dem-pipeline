import assert from 'node:assert/strict';
import { createHash, createPrivateKey, createPublicKey, sign, verify } from 'node:crypto';

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return `sha256:${createHash('sha256').update(typeof value === 'string' ? value : stable(value)).digest('hex')}`;
}

function pae(payloadType, payload) {
  const typeBytes = Buffer.from(payloadType);
  const payloadBytes = Buffer.from(payload);
  return Buffer.concat([
    Buffer.from(`DSSEv1 ${typeBytes.length} `), typeBytes,
    Buffer.from(` ${payloadBytes.length} `), payloadBytes
  ]);
}

const verifierKey = {
  keyId: 'ed25519:browser-harness-3-fixture',
  privateKey: `-----BEGIN PRIVATE KEY-----\nMC4CAQAwBQYDK2VwBCIEIJpfgBmS6+vfdiA44XPqRgYfBEVhwthN1mQqPAdCtbAX\n-----END PRIVATE KEY-----\n`,
  publicKey: `-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEAQbwgiRaumHyMzI3tYFytwOGLuIv2CZ/dt1oZP9vvXD4=\n-----END PUBLIC KEY-----\n`
};

const coordinatorKey = {
  keyId: 'ed25519:coordinator-freshness-root-fixture',
  privateKey: `-----BEGIN PRIVATE KEY-----\nMC4CAQAwBQYDK2VwBCIEIBWgJS1wV2+tsQiE1ZST3Un94ln1lfSrkwCvx9Xhh5ZM\n-----END PRIVATE KEY-----\n`,
  publicKey: `-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEAsGZ4bkdIXqok1yNPPccSfff/JMfPmqJHna1TwnDlz5o=\n-----END PUBLIC KEY-----\n`
};

const producerKey = {
  keyId: 'ed25519:producer-fixture',
  privateKey: `-----BEGIN PRIVATE KEY-----\nMC4CAQAwBQYDK2VwBCIEIMDzaHxIKniTnvu6xixL3Z4Rq+lbL8fDP6Kem3X5ZwKU\n-----END PRIVATE KEY-----\n`,
  publicKey: `-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEA3p4pYyjvcL23MavOrCNWvRgRUoV+4do6Qv/UpALiJyw=\n-----END PUBLIC KEY-----\n`
};

const attestationPayloadType = 'application/vnd.in-toto+json';
const checkpointPayloadType = 'application/vnd.kaopu.freshness-checkpoint+json';
const statementType = 'https://in-toto.io/Statement/v1';
const predicateType = 'https://kaopu.example/ContextObservation/v1';
const anchorId = 'garment/front-shell-v7';
const scopeId = 'kaopu/verifier-freshness/garment-front-shell';
const subjectDigest = sha256({ component: anchorId, build: 'candidate-17' });
const expectedContextDigest = sha256({ renderer: 'webgl2-swiftshader', args: ['--use-angle=swiftshader'] });

const oldDispatch = {
  taskId: 'N313-KAOPUGRAM-VERIFIER-AUTHORITY',
  verificationRequestId: 'vrq:20261118-1540-a',
  dispatchSequence: 313,
  dispatchTime: '2026-11-18T15:40:00+08:00',
  maxAttestationAgeSeconds: 600
};
const currentDispatch = {
  taskId: 'N315-KAOPUGRAM-FRESHNESS-ROOT',
  verificationRequestId: 'vrq:20261118-2352-c',
  dispatchSequence: 315,
  dispatchTime: '2026-11-18T23:52:00+08:00',
  maxAttestationAgeSeconds: 300
};

function makeStatement({ dispatch, observedAt }) {
  return {
    _type: statementType,
    subject: [{ name: `${anchorId}@candidate-17`, digest: { sha256: subjectDigest.replace('sha256:', '') } }],
    predicateType,
    predicate: {
      anchorId,
      observedContextDigest: expectedContextDigest,
      observationMethod: 'browser-process-and-canvas-inspection-v1',
      rawEvidenceDigest: sha256({ processArgs: ['--use-angle=swiftshader'], canvasContext: 'WebGL2RenderingContext' }),
      verificationRequestId: dispatch.verificationRequestId,
      dispatchSequence: dispatch.dispatchSequence,
      observedAt
    }
  };
}

function envelope(payloadType, value, key) {
  const payload = stable(value);
  return {
    payloadType,
    payload,
    signatures: [{
      keyId: key.keyId,
      sig: sign(null, pae(payloadType, payload), createPrivateKey(key.privateKey)).toString('base64')
    }]
  };
}

function verifyAttestation(attestation) {
  const signature = attestation?.signatures?.[0];
  if (!signature || signature.keyId !== verifierKey.keyId) return { status: 'HOLD_UNAUTHORIZED_VERIFIER' };
  const signatureOk = verify(
    null,
    pae(attestation.payloadType, attestation.payload),
    createPublicKey(verifierKey.publicKey),
    Buffer.from(signature.sig, 'base64')
  );
  if (!signatureOk) return { status: 'HOLD_VERIFIER_SIGNATURE_INVALID' };
  const statement = JSON.parse(attestation.payload);
  const boundDigest = `sha256:${statement.subject?.[0]?.digest?.sha256 || ''}`;
  if (statement._type !== statementType || statement.predicateType !== predicateType) return { status: 'HOLD_VERIFIER_PREDICATE_TYPE_MISMATCH' };
  if (boundDigest !== subjectDigest || statement.predicate?.anchorId !== anchorId) return { status: 'HOLD_CONTEXT_OBSERVATION_SUBJECT_MISMATCH' };
  if (statement.predicate.observedContextDigest !== expectedContextDigest) return { status: 'HOLD_EXECUTION_CONTEXT_CHANGED' };
  return { status: 'DEPENDENCY_CLOSURE_VERIFIED', statement };
}

// N314 behavior: both state and now are ordinary caller inputs.
function verifyN314({ dispatch, attestation, state, now, maxFutureSkewSeconds = 60 }) {
  const authenticated = verifyAttestation(attestation);
  if (authenticated.status !== 'DEPENDENCY_CLOSURE_VERIFIED') return authenticated;
  if (dispatch.dispatchSequence <= state.highestAcceptedDispatchSequence) return { status: 'HOLD_VERIFIER_DISPATCH_SEQUENCE_ROLLBACK' };
  const predicate = authenticated.statement.predicate;
  if (predicate.verificationRequestId !== dispatch.verificationRequestId) return { status: 'HOLD_VERIFIER_CHALLENGE_MISMATCH' };
  if (predicate.dispatchSequence !== dispatch.dispatchSequence) return { status: 'HOLD_VERIFIER_DISPATCH_SEQUENCE_ROLLBACK' };
  const observedAt = Date.parse(predicate.observedAt);
  const dispatchTime = Date.parse(dispatch.dispatchTime);
  const nowTime = Date.parse(now);
  if (![observedAt, dispatchTime, nowTime].every(Number.isFinite) || observedAt > nowTime + maxFutureSkewSeconds * 1000) {
    return { status: 'HOLD_VERIFIER_TIME_INVALID' };
  }
  if (observedAt < dispatchTime || nowTime - observedAt > dispatch.maxAttestationAgeSeconds * 1000) {
    return { status: 'HOLD_STALE_VERIFIER_ATTESTATION' };
  }
  return { status: 'DEPENDENCY_CLOSURE_VERIFIED' };
}

const priorCheckpointPayload = {
  scopeId,
  checkpointSequence: 313,
  highestAcceptedDispatchSequence: 313,
  trustedTime: '2026-11-18T19:48:00+08:00',
  previousCheckpointDigest: 'GENESIS'
};
const priorCheckpointDigest = sha256(priorCheckpointPayload);
const currentCheckpointPayload = {
  scopeId,
  checkpointSequence: 314,
  highestAcceptedDispatchSequence: 314,
  trustedTime: '2026-11-18T23:57:00+08:00',
  previousCheckpointDigest: priorCheckpointDigest
};

// This pin is deliberately not a function argument. It represents an independently persisted root.
const pinnedRoot = Object.freeze({
  scopeId,
  coordinatorKeyId: coordinatorKey.keyId,
  expectedCheckpointSequence: 314,
  expectedPreviousCheckpointDigest: priorCheckpointDigest
});

function verifyFreshnessCheckpoint(checkpointEnvelope) {
  if (!checkpointEnvelope?.signatures?.length) return { status: 'HOLD_FRESHNESS_ROOT_MISSING' };
  const signature = checkpointEnvelope.signatures[0];
  if (signature.keyId === producerKey.keyId) return { status: 'HOLD_PRODUCER_FRESHNESS_ROOT' };
  if (signature.keyId !== pinnedRoot.coordinatorKeyId) return { status: 'HOLD_UNAUTHORIZED_FRESHNESS_ROOT' };
  const signatureOk = verify(
    null,
    pae(checkpointEnvelope.payloadType, checkpointEnvelope.payload),
    createPublicKey(coordinatorKey.publicKey),
    Buffer.from(signature.sig, 'base64')
  );
  if (!signatureOk) return { status: 'HOLD_FRESHNESS_CHECKPOINT_SIGNATURE_INVALID' };
  const checkpoint = JSON.parse(checkpointEnvelope.payload);
  if (checkpoint.scopeId !== pinnedRoot.scopeId) return { status: 'HOLD_FRESHNESS_SCOPE_MISMATCH' };
  if (checkpoint.checkpointSequence < pinnedRoot.expectedCheckpointSequence) return { status: 'HOLD_FRESHNESS_CHECKPOINT_ROLLBACK' };
  if (checkpoint.checkpointSequence !== pinnedRoot.expectedCheckpointSequence) return { status: 'HOLD_FRESHNESS_CHECKPOINT_UNPINNED' };
  if (checkpoint.previousCheckpointDigest !== pinnedRoot.expectedPreviousCheckpointDigest) {
    return { status: 'HOLD_FRESHNESS_CHECKPOINT_LINEAGE_MISMATCH' };
  }
  return { status: 'FRESHNESS_ROOT_VERIFIED', checkpoint };
}

function verifyWithPinnedRoot({ dispatch, attestation, checkpointEnvelope }) {
  const root = verifyFreshnessCheckpoint(checkpointEnvelope);
  if (root.status !== 'FRESHNESS_ROOT_VERIFIED') return root;
  return verifyN314({
    dispatch,
    attestation,
    state: { highestAcceptedDispatchSequence: root.checkpoint.highestAcceptedDispatchSequence },
    now: root.checkpoint.trustedTime
  });
}

const oldAttestation = envelope(
  attestationPayloadType,
  makeStatement({ dispatch: oldDispatch, observedAt: '2026-11-18T15:45:00+08:00' }),
  verifierKey
);
const currentAttestation = envelope(
  attestationPayloadType,
  makeStatement({ dispatch: currentDispatch, observedAt: '2026-11-18T23:55:00+08:00' }),
  verifierKey
);
const priorCheckpoint = envelope(checkpointPayloadType, priorCheckpointPayload, coordinatorKey);
const currentCheckpoint = envelope(checkpointPayloadType, currentCheckpointPayload, coordinatorKey);
const producerCheckpoint = envelope(checkpointPayloadType, currentCheckpointPayload, producerKey);
const wrongLineageCheckpoint = envelope(checkpointPayloadType, {
  ...currentCheckpointPayload,
  previousCheckpointDigest: sha256({ fork: true })
}, coordinatorKey);

const vulnerableReplay = verifyN314({
  dispatch: oldDispatch,
  attestation: oldAttestation,
  state: { highestAcceptedDispatchSequence: 0 },
  now: '2026-11-18T15:48:00+08:00'
});

assert.equal(vulnerableReplay.status, 'DEPENDENCY_CLOSURE_VERIFIED');
assert.equal(verifyWithPinnedRoot({ dispatch: oldDispatch, attestation: oldAttestation }).status, 'HOLD_FRESHNESS_ROOT_MISSING');
assert.equal(verifyWithPinnedRoot({ dispatch: oldDispatch, attestation: oldAttestation, checkpointEnvelope: priorCheckpoint }).status, 'HOLD_FRESHNESS_CHECKPOINT_ROLLBACK');
assert.equal(verifyWithPinnedRoot({ dispatch: oldDispatch, attestation: oldAttestation, checkpointEnvelope: producerCheckpoint }).status, 'HOLD_PRODUCER_FRESHNESS_ROOT');
assert.equal(verifyWithPinnedRoot({ dispatch: oldDispatch, attestation: oldAttestation, checkpointEnvelope: wrongLineageCheckpoint }).status, 'HOLD_FRESHNESS_CHECKPOINT_LINEAGE_MISMATCH');
assert.equal(verifyWithPinnedRoot({ dispatch: oldDispatch, attestation: oldAttestation, checkpointEnvelope: currentCheckpoint }).status, 'HOLD_VERIFIER_DISPATCH_SEQUENCE_ROLLBACK');
assert.equal(verifyWithPinnedRoot({ dispatch: currentDispatch, attestation: currentAttestation, checkpointEnvelope: currentCheckpoint }).status, 'DEPENDENCY_CLOSURE_VERIFIED');

console.log(JSON.stringify({
  probe: 'n315_freshness_root_integrity_probe',
  boundedQuestion: 'Can N314 be bypassed after restart by resetting its trusted sequence state and rewinding its trusted clock, then replaying the entire old dispatch and attestation bundle?',
  vulnerableReplay: {
    resetState: { highestAcceptedDispatchSequence: 0 },
    rewoundNow: '2026-11-18T15:48:00+08:00',
    replayedDispatchSequence: oldDispatch.dispatchSequence,
    status: vulnerableReplay.status,
    defect: 'N314 accepts state and now as ordinary caller inputs, so its freshness root can be reset and rewound by the same party presenting the replay.'
  },
  pinnedRootCandidate: {
    missingCheckpoint: verifyWithPinnedRoot({ dispatch: oldDispatch, attestation: oldAttestation }),
    oldValidCheckpoint: verifyWithPinnedRoot({ dispatch: oldDispatch, attestation: oldAttestation, checkpointEnvelope: priorCheckpoint }),
    producerSignedCheckpoint: verifyWithPinnedRoot({ dispatch: oldDispatch, attestation: oldAttestation, checkpointEnvelope: producerCheckpoint }),
    forkedCheckpointLineage: verifyWithPinnedRoot({ dispatch: oldDispatch, attestation: oldAttestation, checkpointEnvelope: wrongLineageCheckpoint }),
    oldBundleAgainstCurrentCheckpoint: verifyWithPinnedRoot({ dispatch: oldDispatch, attestation: oldAttestation, checkpointEnvelope: currentCheckpoint }),
    freshBundleAgainstCurrentCheckpoint: verifyWithPinnedRoot({ dispatch: currentDispatch, attestation: currentAttestation, checkpointEnvelope: currentCheckpoint })
  },
  teacherDecision: {
    source: 'The Update Framework rollback/freeze protections already audited in N314',
    status: 'NO_NOVELTY',
    novelty: 'None. N314 already states that trusted time and persisted version state must not be Producer-controlled. N315 is a transfer regression proving the prototype still accepts both as caller inputs.'
  },
  decision: 'HOLD_GATE_FAIL',
  boundary: 'Synthetic replay and signed-checkpoint prototype only. Real non-volatile pin storage, coordinator availability, crash recovery, checkpoint equivocation detection, key rotation, and one live Mother route remain UNKNOWN.'
}, null, 2));
