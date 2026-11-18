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

const payloadType = 'application/vnd.in-toto+json';
const statementType = 'https://in-toto.io/Statement/v1';
const predicateType = 'https://kaopu.example/ContextObservation/v1';
const anchorId = 'garment/front-shell-v7';
const subjectDigest = sha256({ component: anchorId, build: 'candidate-17' });
const expectedContextDigest = sha256({ renderer: 'webgl2-swiftshader', args: ['--use-angle=swiftshader'] });
const policy = {
  policyId: 'kaopu-verifier-authority/browser-context',
  version: '1.0.0',
  authorizedFunctionaries: [{
    identity: 'verifier/browser-harness-3',
    keyId: verifierKey.keyId,
    publicKey: verifierKey.publicKey,
    roles: ['context-observer'],
    allowedPredicateTypes: [predicateType]
  }]
};

const oldDispatch = {
  taskId: 'N313-KAOPUGRAM-VERIFIER-AUTHORITY',
  verificationRequestId: 'vrq:20261118-1540-a',
  dispatchSequence: 313,
  dispatchTime: '2026-11-18T15:40:00+08:00',
  maxAttestationAgeSeconds: 600
};
const currentDispatch = {
  taskId: 'N314-KAOPUGRAM-VERIFIER-FRESHNESS',
  verificationRequestId: 'vrq:20261118-1940-b',
  dispatchSequence: 314,
  dispatchTime: '2026-11-18T19:40:00+08:00',
  maxAttestationAgeSeconds: 300
};
const trustedState = { highestAcceptedDispatchSequence: 313 };
const trustedNow = '2026-11-18T19:48:00+08:00';

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

function envelope(statement) {
  const payload = stable(statement);
  return {
    payloadType,
    payload,
    signatures: [{
      keyId: verifierKey.keyId,
      sig: sign(null, pae(payloadType, payload), createPrivateKey(verifierKey.privateKey)).toString('base64')
    }]
  };
}

function verifyN313(attestation) {
  if (!attestation?.signatures?.length) return { status: 'HOLD_VERIFIER_ATTESTATION_MISSING' };
  const signature = attestation.signatures[0];
  const functionary = policy.authorizedFunctionaries.find((entry) => entry.keyId === signature.keyId);
  if (!functionary) return { status: 'HOLD_UNAUTHORIZED_VERIFIER' };
  const signatureOk = verify(
    null,
    pae(attestation.payloadType, attestation.payload),
    createPublicKey(functionary.publicKey),
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

function verifyFreshnessBound({ dispatch, attestation, state = trustedState, now = trustedNow, maxFutureSkewSeconds = 60 }) {
  const authenticated = verifyN313(attestation);
  if (authenticated.status !== 'DEPENDENCY_CLOSURE_VERIFIED') return authenticated;
  if (dispatch.dispatchSequence <= state.highestAcceptedDispatchSequence) {
    return { status: 'HOLD_VERIFIER_DISPATCH_SEQUENCE_ROLLBACK' };
  }
  const predicate = authenticated.statement.predicate;
  if (predicate.verificationRequestId !== dispatch.verificationRequestId) {
    return { status: 'HOLD_VERIFIER_CHALLENGE_MISMATCH' };
  }
  if (predicate.dispatchSequence !== dispatch.dispatchSequence) {
    return { status: 'HOLD_VERIFIER_DISPATCH_SEQUENCE_ROLLBACK' };
  }
  const observedAt = Date.parse(predicate.observedAt);
  const dispatchTime = Date.parse(dispatch.dispatchTime);
  const nowTime = Date.parse(now);
  if (![observedAt, dispatchTime, nowTime].every(Number.isFinite) || observedAt > nowTime + maxFutureSkewSeconds * 1000) {
    return { status: 'HOLD_VERIFIER_TIME_INVALID' };
  }
  if (observedAt < dispatchTime || nowTime - observedAt > dispatch.maxAttestationAgeSeconds * 1000) {
    return { status: 'HOLD_STALE_VERIFIER_ATTESTATION' };
  }
  return {
    status: 'DEPENDENCY_CLOSURE_VERIFIED',
    acceptedDispatchSequence: dispatch.dispatchSequence,
    verificationRequestId: dispatch.verificationRequestId
  };
}

const oldValidAttestation = envelope(makeStatement({ dispatch: oldDispatch, observedAt: '2026-11-18T15:45:00+08:00' }));
const currentChallengeOldSequence = envelope(makeStatement({
  dispatch: { ...currentDispatch, dispatchSequence: 313 },
  observedAt: '2026-11-18T19:44:00+08:00'
}));
const currentChallengePreDispatch = envelope(makeStatement({ dispatch: currentDispatch, observedAt: '2026-11-18T19:30:00+08:00' }));
const currentChallengeExpired = envelope(makeStatement({ dispatch: currentDispatch, observedAt: '2026-11-18T19:41:00+08:00' }));
const currentChallengeFuture = envelope(makeStatement({ dispatch: currentDispatch, observedAt: '2026-11-18T20:00:00+08:00' }));
const currentFreshAttestation = envelope(makeStatement({ dispatch: currentDispatch, observedAt: '2026-11-18T19:45:00+08:00' }));
const rolledBackDispatch = { ...currentDispatch, dispatchSequence: 313 };

assert.equal(verifyN313(oldValidAttestation).status, 'DEPENDENCY_CLOSURE_VERIFIED');
assert.equal(verifyFreshnessBound({ dispatch: currentDispatch, attestation: oldValidAttestation }).status, 'HOLD_VERIFIER_CHALLENGE_MISMATCH');
assert.equal(verifyFreshnessBound({ dispatch: currentDispatch, attestation: currentChallengeOldSequence }).status, 'HOLD_VERIFIER_DISPATCH_SEQUENCE_ROLLBACK');
assert.equal(verifyFreshnessBound({ dispatch: currentDispatch, attestation: currentChallengePreDispatch }).status, 'HOLD_STALE_VERIFIER_ATTESTATION');
assert.equal(verifyFreshnessBound({ dispatch: currentDispatch, attestation: currentChallengeExpired }).status, 'HOLD_STALE_VERIFIER_ATTESTATION');
assert.equal(verifyFreshnessBound({ dispatch: currentDispatch, attestation: currentChallengeFuture }).status, 'HOLD_VERIFIER_TIME_INVALID');
assert.equal(verifyFreshnessBound({ dispatch: currentDispatch, attestation: currentFreshAttestation }).status, 'DEPENDENCY_CLOSURE_VERIFIED');
assert.equal(verifyFreshnessBound({ dispatch: rolledBackDispatch, attestation: currentChallengeOldSequence }).status, 'HOLD_VERIFIER_DISPATCH_SEQUENCE_ROLLBACK');

console.log(JSON.stringify({
  probe: 'n314_verifier_freshness_probe',
  boundedQuestion: 'Can a previously valid authorized verifier attestation be replayed after a later dispatch when the content subject is unchanged?',
  vulnerableReplay: {
    sameSubjectDigest: subjectDigest,
    oldVerificationRequestId: oldDispatch.verificationRequestId,
    currentVerificationRequestId: currentDispatch.verificationRequestId,
    n313Status: verifyN313(oldValidAttestation).status,
    defect: 'N313 authenticates authority, subject, predicate type, and context but does not bind the signed observation to the current dispatch or a freshness window.'
  },
  freshnessBoundPrototype: {
    oldSignedAttestationOnNewDispatch: verifyFreshnessBound({ dispatch: currentDispatch, attestation: oldValidAttestation }),
    oldDispatchSequence: verifyFreshnessBound({ dispatch: currentDispatch, attestation: currentChallengeOldSequence }),
    observationBeforeDispatch: verifyFreshnessBound({ dispatch: currentDispatch, attestation: currentChallengePreDispatch }),
    observationPastMaxAge: verifyFreshnessBound({ dispatch: currentDispatch, attestation: currentChallengeExpired }),
    futureObservationTime: verifyFreshnessBound({ dispatch: currentDispatch, attestation: currentChallengeFuture }),
    freshCurrentChallenge: verifyFreshnessBound({ dispatch: currentDispatch, attestation: currentFreshAttestation }),
    rolledBackDispatchAnchor: verifyFreshnessBound({ dispatch: rolledBackDispatch, attestation: currentChallengeOldSequence })
  },
  teacherDecision: {
    source: 'The Update Framework rollback/freeze protections',
    status: 'TEACHER_CANDIDATE',
    novelty: 'A valid authorized signature can still be obsolete. TUF requires monotonic trusted versions, expiry checks against a fixed trusted time, and persisted client state to detect rollback and freeze attacks.'
  },
  decision: 'HOLD_GATE_FAIL',
  boundary: 'Synthetic protocol replay only. Trusted clock, persistent sequence state, challenge generation, and one real Mother observer remain unverified.'
}, null, 2));
