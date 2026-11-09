import {
  createHash,
  generateKeyPairSync,
  sign as cryptoSign,
  verify as cryptoVerify,
} from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

const bytes = (value) => Buffer.from(canonical(value));
const sha256 = (value) => createHash('sha256').update(Buffer.isBuffer(value) ? value : bytes(value)).digest('hex');

function identity(name) {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const spki = publicKey.export({ type: 'spki', format: 'der' });
  return { name, keyId: sha256(spki), publicKey, privateKey };
}

function envelope(statement, signer) {
  return {
    statement,
    signerKeyId: signer.keyId,
    signature: cryptoSign(null, bytes(statement), signer.privateKey).toString('base64'),
  };
}

function signaturePass(envelopeObject, trustedIdentity) {
  if (!trustedIdentity || envelopeObject.signerKeyId !== trustedIdentity.keyId) return false;
  return cryptoVerify(
    null,
    bytes(envelopeObject.statement),
    trustedIdentity.publicKey,
    Buffer.from(envelopeObject.signature, 'base64'),
  );
}

const coordinator = identity('coordinator');
const producer = identity('producer');
const verifier = identity('verifier');
const attacker = identity('attacker');

const subject = {
  name: 'CAR_RECOVERY_R136_BOUNDED_GPU_ADMISSION_PRIVATE_DELTA.zip',
  digest: { sha256: '970367f8ea22aeed8517b5a86e33c4207526b941ef9e3a9e9a2ddb693597ef9e' },
};

function signedLayout(producerKeyId = producer.keyId, verifierKeyId = verifier.keyId) {
  const layout = {
    schema: 'kaopu.role-separated-verification-layout.v1',
    taskId: 'CAR-R136-PORTABLE-VERIFIER',
    subject,
    roles: {
      producer: { authorizedKeyIds: [producerKeyId], threshold: 1 },
      verifier: { authorizedKeyIds: [verifierKeyId], threshold: 1 },
    },
    constraints: { producerVerifierKeyIdsMustBeDistinct: true },
  };
  return envelope(layout, coordinator);
}

function producerEnvelope(signer = producer) {
  return envelope({
    schema: 'kaopu.production-attestation.v1',
    role: 'producer',
    taskId: 'CAR-R136-PORTABLE-VERIFIER',
    subject,
    outputDigest: { sha256: 'a'.repeat(64) },
  }, signer);
}

function verifierEnvelope(production, signer = verifier, subjectOverride = subject) {
  return envelope({
    schema: 'kaopu.verification-attestation.v1',
    role: 'verifier',
    taskId: 'CAR-R136-PORTABLE-VERIFIER',
    subject: subjectOverride,
    reviewedProducerEnvelopeDigest: sha256(production),
    verdict: 'HOLD_GATE_FAIL',
  }, signer);
}

const identities = new Map([
  [coordinator.keyId, coordinator],
  [producer.keyId, producer],
  [verifier.keyId, verifier],
  [attacker.keyId, attacker],
]);

function gate({ layoutEnvelope, productionEnvelope, verificationEnvelope }) {
  if (!signaturePass(layoutEnvelope, coordinator)) return 'HOLD_LAYOUT_SIGNATURE_INVALID';
  const layout = layoutEnvelope.statement;
  const producerIds = layout.roles?.producer?.authorizedKeyIds ?? [];
  const verifierIds = layout.roles?.verifier?.authorizedKeyIds ?? [];
  if (layout.constraints?.producerVerifierKeyIdsMustBeDistinct && producerIds.some((id) => verifierIds.includes(id))) {
    return 'HOLD_ROLE_IDENTITY_NOT_DISTINCT';
  }
  if (!producerIds.includes(productionEnvelope.signerKeyId) || !signaturePass(productionEnvelope, identities.get(productionEnvelope.signerKeyId))) {
    return 'HOLD_PRODUCER_ATTESTATION_INVALID';
  }
  if (!verifierIds.includes(verificationEnvelope.signerKeyId) || !signaturePass(verificationEnvelope, identities.get(verificationEnvelope.signerKeyId))) {
    return 'HOLD_VERIFIER_ATTESTATION_INVALID';
  }
  if (canonical(productionEnvelope.statement.subject) !== canonical(layout.subject)
      || canonical(verificationEnvelope.statement.subject) !== canonical(layout.subject)) {
    return 'HOLD_SUBJECT_IDENTITY_MISMATCH';
  }
  if (verificationEnvelope.statement.reviewedProducerEnvelopeDigest !== sha256(productionEnvelope)) {
    return 'HOLD_REVIEW_CHAIN_MISMATCH';
  }
  return 'PASS_ROLE_SEPARATED_ATTESTATION_CHAIN';
}

const validProduction = producerEnvelope();
const validVerification = verifierEnvelope(validProduction);
const validLayout = signedLayout();

const sameKeyProduction = producerEnvelope(producer);
const sameKeyVerification = verifierEnvelope(sameKeyProduction, producer);
const sameKeyLayout = signedLayout(producer.keyId, producer.keyId);

const forgedLayout = structuredClone(validLayout);
forgedLayout.statement.roles.verifier.authorizedKeyIds = [attacker.keyId];

const differentSubject = {
  ...subject,
  digest: { sha256: 'b'.repeat(64) },
};

const tamperedProduction = structuredClone(validProduction);
tamperedProduction.statement.outputDigest.sha256 = 'c'.repeat(64);

const staleProduction = producerEnvelope();
const staleVerification = verifierEnvelope(staleProduction);
const replacementProduction = producerEnvelope();
replacementProduction.statement.outputDigest.sha256 = 'd'.repeat(64);
replacementProduction.signature = cryptoSign(null, bytes(replacementProduction.statement), producer.privateKey).toString('base64');

const cases = [
  {
    id: 'valid-distinct-chain',
    expected: 'PASS_ROLE_SEPARATED_ATTESTATION_CHAIN',
    actual: gate({ layoutEnvelope: validLayout, productionEnvelope: validProduction, verificationEnvelope: validVerification }),
  },
  {
    id: 'same-key-authorized-for-both-roles',
    expected: 'HOLD_ROLE_IDENTITY_NOT_DISTINCT',
    actual: gate({ layoutEnvelope: sameKeyLayout, productionEnvelope: sameKeyProduction, verificationEnvelope: sameKeyVerification }),
  },
  {
    id: 'layout-role-key-forged-after-coordinator-signature',
    expected: 'HOLD_LAYOUT_SIGNATURE_INVALID',
    actual: gate({ layoutEnvelope: forgedLayout, productionEnvelope: validProduction, verificationEnvelope: validVerification }),
  },
  {
    id: 'verifier-attests-different-subject',
    expected: 'HOLD_SUBJECT_IDENTITY_MISMATCH',
    actual: gate({ layoutEnvelope: validLayout, productionEnvelope: validProduction, verificationEnvelope: verifierEnvelope(validProduction, verifier, differentSubject) }),
  },
  {
    id: 'producer-statement-tampered-after-signature',
    expected: 'HOLD_PRODUCER_ATTESTATION_INVALID',
    actual: gate({ layoutEnvelope: validLayout, productionEnvelope: tamperedProduction, verificationEnvelope: validVerification }),
  },
  {
    id: 'verifier-receipt-bound-to-replaced-producer-envelope',
    expected: 'HOLD_REVIEW_CHAIN_MISMATCH',
    actual: gate({ layoutEnvelope: validLayout, productionEnvelope: replacementProduction, verificationEnvelope: staleVerification }),
  },
];

for (const test of cases) test.pass = test.actual === test.expected;

const result = {
  probe: 'N262_PRODUCER_VERIFIER_IDENTITY_SEPARATION',
  boundedQuestion: 'Can an independent-review receipt prove that an authorized verifier distinct from the producer reviewed the exact same subject and producer attestation?',
  teacher: {
    name: 'in-toto layout + signed link metadata',
    status: 'TEACHER_CANDIDATE',
    lifecycle: 'AUDITION',
    exactNovelty: 'R2 states that Producer cannot approve itself; in-toto adds signed, layout-authorized functionary identities and artifact-chain binding that can make the separation executable rather than self-declared.',
  },
  cases,
  summary: {
    total: cases.length,
    passed: cases.filter((test) => test.pass).length,
    allPassed: cases.every((test) => test.pass),
  },
  decision: cases.every((test) => test.pass)
    ? 'CANDIDATE_ROLE_SEPARATED_ATTESTATION_GATE_PASSES_SYNTHETIC_REPLAY'
    : 'REJECT_CANDIDATE_REPLAY_FAILED',
  limits: [
    'Distinct keys prove cryptographic identities, not distinct humans; key issuance and custody remain operational requirements.',
    'A valid verifier signature does not prove technical correctness, browser/GPU execution, competence, or user acceptance.',
    'The probe uses generated local keys and a synthetic subject; it does not sign or approve R136.',
  ],
  lifecycle: {
    POSTED: false,
    ACKNOWLEDGED: false,
    IMPLEMENTED: 'candidate probe only',
    'GATE-RUN': 'synthetic replay only',
    ADOPTED: false,
    'USER-ACCEPTED': false,
  },
};

await writeFile(join(here, 'producer_verifier_identity_probe_result_n262.json'), `${JSON.stringify(result, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(result.summary)}\n`);
if (!result.summary.allPassed) process.exitCode = 1;
