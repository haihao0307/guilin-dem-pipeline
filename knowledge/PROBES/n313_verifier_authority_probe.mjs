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

const fixtureKeys = {
  producer: {
    keyId: 'ed25519:producer-fixture',
    privateKey: `-----BEGIN PRIVATE KEY-----\nMC4CAQAwBQYDK2VwBCIEINkq1x1fs6rVAVMYHL16n6LyH/eLQitqG4FuoWHWqiIF\n-----END PRIVATE KEY-----\n`,
    publicKey: `-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEAkSAQXMVJ+ECXInFcRY1wSXZrnJyVU/SCtbcIVVmlGN0=\n-----END PUBLIC KEY-----\n`
  },
  verifier: {
    keyId: 'ed25519:browser-harness-3-fixture',
    privateKey: `-----BEGIN PRIVATE KEY-----\nMC4CAQAwBQYDK2VwBCIEIJpfgBmS6+vfdiA44XPqRgYfBEVhwthN1mQqPAdCtbAX\n-----END PRIVATE KEY-----\n`,
    publicKey: `-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEAQbwgiRaumHyMzI3tYFytwOGLuIv2CZ/dt1oZP9vvXD4=\n-----END PUBLIC KEY-----\n`
  },
  fake: {
    keyId: 'ed25519:fake-observer-fixture',
    privateKey: `-----BEGIN PRIVATE KEY-----\nMC4CAQAwBQYDK2VwBCIEIPbLBlbSZbl5iyx6lGE0MALtJEA/sWnWicyt0PokJAxh\n-----END PRIVATE KEY-----\n`,
    publicKey: `-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEAbU7daylHL/FGzI8iLa4VUB809sbA4v4DE9pd04z7nJU=\n-----END PUBLIC KEY-----\n`
  }
};

const payloadType = 'application/vnd.in-toto+json';
const statementType = 'https://in-toto.io/Statement/v1';
const predicateType = 'https://kaopu.example/ContextObservation/v1';
const anchorId = 'garment/front-shell-v7';
const subjectDigest = sha256({ component: anchorId, build: 'candidate-17' });
const producerIdentity = 'producer/garment-17';
const expectedContextDigest = sha256({ renderer: 'webgl2-swiftshader', args: ['--use-angle=swiftshader'] });

const authorityPolicy = {
  policyId: 'kaopu-verifier-authority/browser-context',
  version: '1.0.0',
  threshold: 1,
  authorizedFunctionaries: [{
    identity: 'verifier/browser-harness-3',
    keyId: fixtureKeys.verifier.keyId,
    publicKey: fixtureKeys.verifier.publicKey,
    roles: ['context-observer'],
    allowedPredicateTypes: [predicateType]
  }]
};
const authorityPolicyDigest = sha256(authorityPolicy);

function makeStatement({ digest = subjectDigest, observedContextDigest = expectedContextDigest } = {}) {
  return {
    _type: statementType,
    subject: [{ name: `${anchorId}@candidate-17`, digest: { sha256: digest.replace('sha256:', '') } }],
    predicateType,
    predicate: {
      anchorId,
      observedContextDigest,
      observationMethod: 'browser-process-and-canvas-inspection-v1',
      rawEvidenceDigest: sha256({ processArgs: ['--use-angle=swiftshader'], canvasContext: 'WebGL2RenderingContext' })
    }
  };
}

function envelope(statement, key) {
  const payload = stable(statement);
  return {
    payloadType,
    payload,
    signatures: [{
      keyId: key.keyId,
      sig: sign(null, pae(payloadType, payload), createPrivateKey(key.privateKey)).toString('base64')
    }]
  };
}

function n312StringOnlyVerify(observation) {
  if (!observation) return { status: 'HOLD_INDEPENDENT_CONTEXT_OBSERVATION_MISSING' };
  if (observation.observerIdentity === producerIdentity) return { status: 'HOLD_PRODUCER_SELF_ATTESTATION' };
  if (observation.anchorId !== anchorId || observation.subjectDigest !== subjectDigest) return { status: 'HOLD_CONTEXT_OBSERVATION_SUBJECT_MISMATCH' };
  if (!observation.rawEvidenceDigest || !observation.observationMethod) return { status: 'HOLD_CONTEXT_OBSERVATION_EVIDENCE_INCOMPLETE' };
  if (observation.observedContextDigest !== expectedContextDigest) return { status: 'HOLD_EXECUTION_CONTEXT_CHANGED' };
  return { status: 'DEPENDENCY_CLOSURE_VERIFIED' };
}

function verifyAuthorityBound({ attestation, policy = authorityPolicy, policyDigest = authorityPolicyDigest }) {
  if (!attestation?.signatures?.length) return { status: 'HOLD_VERIFIER_ATTESTATION_MISSING' };
  if (sha256(policy) !== policyDigest) return { status: 'HOLD_VERIFIER_AUTHORITY_POLICY_CHANGED' };
  const signature = attestation.signatures[0];
  if (signature.keyId === fixtureKeys.producer.keyId) return { status: 'HOLD_PRODUCER_SELF_ATTESTATION' };
  const functionary = policy.authorizedFunctionaries.find((entry) => entry.keyId === signature.keyId);
  if (!functionary) return { status: 'HOLD_UNAUTHORIZED_VERIFIER' };
  if (!functionary.roles.includes('context-observer')) return { status: 'HOLD_UNAUTHORIZED_VERIFIER_ROLE' };
  let signatureOk = false;
  try {
    signatureOk = verify(
      null,
      pae(attestation.payloadType, attestation.payload),
      createPublicKey(functionary.publicKey),
      Buffer.from(signature.sig, 'base64')
    );
  } catch {}
  if (!signatureOk) return { status: 'HOLD_VERIFIER_SIGNATURE_INVALID' };
  let statement;
  try { statement = JSON.parse(attestation.payload); } catch { return { status: 'HOLD_VERIFIER_ATTESTATION_INVALID' }; }
  if (statement._type !== statementType || statement.predicateType !== predicateType) return { status: 'HOLD_VERIFIER_PREDICATE_TYPE_MISMATCH' };
  if (!functionary.allowedPredicateTypes.includes(statement.predicateType)) return { status: 'HOLD_UNAUTHORIZED_VERIFIER_ROLE' };
  const boundDigest = `sha256:${statement.subject?.[0]?.digest?.sha256 || ''}`;
  if (boundDigest !== subjectDigest || statement.predicate?.anchorId !== anchorId) return { status: 'HOLD_CONTEXT_OBSERVATION_SUBJECT_MISMATCH' };
  if (!statement.predicate?.observationMethod || !statement.predicate?.rawEvidenceDigest) return { status: 'HOLD_CONTEXT_OBSERVATION_EVIDENCE_INCOMPLETE' };
  if (statement.predicate.observedContextDigest !== expectedContextDigest) return { status: 'HOLD_EXECUTION_CONTEXT_CHANGED' };
  return { status: 'DEPENDENCY_CLOSURE_VERIFIED', functionary: functionary.identity, authorityPolicyDigest };
}

const fabricatedStringObservation = {
  anchorId,
  subjectDigest,
  observerIdentity: 'verifier/not-the-producer-string',
  observationMethod: 'fabricated-browser-report',
  observedContextDigest: expectedContextDigest,
  rawEvidenceDigest: sha256({ fabricated: true })
};
const fakeSigned = envelope(makeStatement(), fixtureKeys.fake);
const authorizedSigned = envelope(makeStatement(), fixtureKeys.verifier);
const producerSigned = envelope(makeStatement(), fixtureKeys.producer);
const wrongSubjectSigned = envelope(makeStatement({ digest: sha256({ component: anchorId, build: 'candidate-16' }) }), fixtureKeys.verifier);
const forgedAuthorizedKeyId = structuredClone(fakeSigned);
forgedAuthorizedKeyId.signatures[0].keyId = fixtureKeys.verifier.keyId;
const tamperedAfterSigning = structuredClone(authorizedSigned);
const tamperedStatement = JSON.parse(tamperedAfterSigning.payload);
tamperedStatement.predicate.observedContextDigest = sha256({ renderer: 'webgl1-hardware', args: [] });
tamperedAfterSigning.payload = stable(tamperedStatement);

assert.equal(n312StringOnlyVerify(fabricatedStringObservation).status, 'DEPENDENCY_CLOSURE_VERIFIED');
assert.equal(verifyAuthorityBound({ attestation: null }).status, 'HOLD_VERIFIER_ATTESTATION_MISSING');
assert.equal(verifyAuthorityBound({ attestation: fakeSigned }).status, 'HOLD_UNAUTHORIZED_VERIFIER');
assert.equal(verifyAuthorityBound({ attestation: forgedAuthorizedKeyId }).status, 'HOLD_VERIFIER_SIGNATURE_INVALID');
assert.equal(verifyAuthorityBound({ attestation: producerSigned }).status, 'HOLD_PRODUCER_SELF_ATTESTATION');
assert.equal(verifyAuthorityBound({ attestation: wrongSubjectSigned }).status, 'HOLD_CONTEXT_OBSERVATION_SUBJECT_MISMATCH');
assert.equal(verifyAuthorityBound({ attestation: tamperedAfterSigning }).status, 'HOLD_VERIFIER_SIGNATURE_INVALID');
assert.equal(verifyAuthorityBound({ attestation: authorizedSigned }).status, 'DEPENDENCY_CLOSURE_VERIFIED');
assert.equal(verifyAuthorityBound({ attestation: authorizedSigned, policyDigest: sha256({ changed: true }) }).status, 'HOLD_VERIFIER_AUTHORITY_POLICY_CHANGED');

console.log(JSON.stringify({
  probe: 'n313_verifier_authority_probe',
  boundedQuestion: 'Can a Producer bypass N312 by choosing a different observerIdentity string and fabricating matching raw evidence?',
  vulnerableReplay: {
    n312Status: n312StringOnlyVerify(fabricatedStringObservation),
    defect: 'N312 treats any observerIdentity string different from producerIdentity as independent and authentic.'
  },
  authorityBoundPrototype: {
    unsignedObservation: verifyAuthorityBound({ attestation: null }),
    signedByUnlistedKey: verifyAuthorityBound({ attestation: fakeSigned }),
    fakeSignatureUnderAuthorizedKeyId: verifyAuthorityBound({ attestation: forgedAuthorizedKeyId }),
    producerSignedObservation: verifyAuthorityBound({ attestation: producerSigned }),
    authorizedWrongSubject: verifyAuthorityBound({ attestation: wrongSubjectSigned }),
    tamperedAfterSigning: verifyAuthorityBound({ attestation: tamperedAfterSigning }),
    authorizedExactStatement: verifyAuthorityBound({ attestation: authorizedSigned }),
    changedAuthorityPolicy: verifyAuthorityBound({ attestation: authorizedSigned, policyDigest: sha256({ changed: true }) })
  },
  teacherDecision: {
    source: 'in-toto Attestation Framework plus layout-authorized functionaries',
    status: 'TEACHER_CANDIDATE',
    novelty: 'N312 names an observer; in-toto binds a typed statement to a subject, authenticates it with a signature, and checks the signing key against coordinator-authorized functionaries.'
  },
  decision: 'HOLD_GATE_FAIL',
  boundary: 'Fixture signatures prove only protocol behavior. Key custody, revocation, threshold policy, real observer independence, and evidence truth remain unverified.'
}, null, 2));
