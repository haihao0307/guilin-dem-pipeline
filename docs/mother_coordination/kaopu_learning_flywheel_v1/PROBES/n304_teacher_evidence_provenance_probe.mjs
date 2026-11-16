#!/usr/bin/env node

import { createHash } from 'node:crypto';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

const locator = {
  name: 'teacher-package.zip',
  uri: 'library://teacher-package',
  releaseTag: 'v1',
};

const auditionedBytes = Buffer.from('teacher evidence bytes at audition time');
const replacedBytes = Buffer.from('different bytes later stored under same locator');

const provenanceReceipt = {
  statementType: 'https://in-toto.io/Statement/v1',
  predicateType: 'https://slsa.dev/provenance/v1',
  subject: {
    ...locator,
    digest: { sha256: sha256(auditionedBytes) },
  },
  resolvedDependencies: [
    {
      uri: 'git+https://github.com/example/teacher@main',
      digest: { gitCommit: '1111111111111111111111111111111111111111' },
    },
  ],
  builder: { id: 'kaopu://learning-flywheel/manual-audition/v1' },
  invocationId: 'N304-probe',
};

function legacyLocatorOnlyGate(candidate) {
  return (
    candidate.name === provenanceReceipt.subject.name &&
    candidate.uri === provenanceReceipt.subject.uri &&
    candidate.releaseTag === provenanceReceipt.subject.releaseTag
  );
}

function provenanceIdentityGate(candidateBytes, candidateDependencyCommit) {
  const subjectDigestMatches = sha256(candidateBytes) === provenanceReceipt.subject.digest.sha256;
  const dependencyMatches =
    candidateDependencyCommit === provenanceReceipt.resolvedDependencies[0].digest.gitCommit;
  let decision = 'IDENTITY_CONFIRMED';
  if (!subjectDigestMatches) decision = 'REJECT_SUBJECT_MISMATCH';
  else if (!dependencyMatches) decision = 'HOLD_SOURCE_LINEAGE_MISMATCH';
  return {
    subjectDigestMatches,
    dependencyMatches,
    builderDeclared: Boolean(provenanceReceipt.builder.id),
    invocationDeclared: Boolean(provenanceReceipt.invocationId),
    decision,
  };
}

const observations = {
  original: {
    locatorGate: legacyLocatorOnlyGate(locator),
    provenanceGate: provenanceIdentityGate(
      auditionedBytes,
      '1111111111111111111111111111111111111111',
    ),
  },
  sameLocatorReplacedBytes: {
    locatorGate: legacyLocatorOnlyGate(locator),
    provenanceGate: provenanceIdentityGate(
      replacedBytes,
      '1111111111111111111111111111111111111111',
    ),
  },
  sameBytesDifferentSourceRevision: {
    locatorGate: legacyLocatorOnlyGate(locator),
    provenanceGate: provenanceIdentityGate(
      auditionedBytes,
      '2222222222222222222222222222222222222222',
    ),
  },
};

const assertions = {
  originalIdentityConfirmed: observations.original.provenanceGate.decision === 'IDENTITY_CONFIRMED',
  locatorFailsToDetectReplacement: observations.sameLocatorReplacedBytes.locatorGate === true,
  subjectDigestRejectsReplacement:
    observations.sameLocatorReplacedBytes.provenanceGate.decision === 'REJECT_SUBJECT_MISMATCH',
  dependencyDigestRejectsSourceDrift:
    observations.sameBytesDifferentSourceRevision.provenanceGate.decision ===
    'HOLD_SOURCE_LINEAGE_MISMATCH',
};

const result = {
  probeId: 'TEACHER_EVIDENCE_PROVENANCE_RECEIPT_001_N304',
  boundedQuestion:
    'How can KAOPU prove that a later teacher audition still refers to the exact artifact and source revision originally evaluated when its name, URL, file ID, or release tag is mutable?',
  falsifiableHypothesis:
    'A receipt that binds subject digest, resolved dependency revision, builder identity, and invocation identity rejects same-locator replacement and source drift that locator-only identity accepts.',
  provenanceReceipt,
  observations,
  assertions,
  decision: Object.values(assertions).every(Boolean) ? 'SUPPORTED' : 'FALSIFIED',
};

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
if (result.decision !== 'SUPPORTED') process.exitCode = 1;
