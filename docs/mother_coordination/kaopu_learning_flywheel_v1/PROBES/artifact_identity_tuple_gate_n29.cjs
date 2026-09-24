#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const fixturePath = process.argv[2] || path.join(__dirname, 'artifact_identity_tuple_fixture_n29.json');
const outputPath = process.argv[3] || path.join(__dirname, 'artifact_identity_tuple_result_n29.json');
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

const fields = ['artifactRole', 'canonicalPath', 'mediaType', 'bytes', 'digest', 'producerStep'];

function legacyScalarGate(subject, manifest) {
  const bytesSeen = manifest.some((entry) => entry.bytes === subject.bytes);
  const digestSeen = manifest.some((entry) => entry.digest === subject.digest);
  return bytesSeen && digestSeen ? 'LEGACY_SCALAR_FIELDS_SEEN' : 'LEGACY_SCALAR_FIELD_MISSING';
}

function tupleGate(subject, manifest) {
  const exact = manifest.find((entry) => fields.every((field) => entry[field] === subject[field]));
  return exact ? 'SUBJECT_DESCRIPTOR_VERIFIED' : 'HOLD_SUBJECT_DESCRIPTOR_MISMATCH';
}

const cases = fixture.claims.map((claim) => {
  const legacyState = legacyScalarGate(claim.subject, fixture.evidenceManifest);
  const tupleState = tupleGate(claim.subject, fixture.evidenceManifest);
  return {
    id: claim.id,
    legacyState,
    tupleState,
    expectedTupleState: claim.expectedTupleState,
    passed: tupleState === claim.expectedTupleState
  };
});

const assertions = [
  {
    id: 'historical-mixed-fields-pass-weak-gate',
    passed: cases.find((x) => x.id === 'historical-mixed-identity').legacyState === 'LEGACY_SCALAR_FIELDS_SEEN'
  },
  {
    id: 'historical-mixed-tuple-held',
    passed: cases.find((x) => x.id === 'historical-mixed-identity').tupleState === 'HOLD_SUBJECT_DESCRIPTOR_MISMATCH'
  },
  {
    id: 'corrected-tuple-verified',
    passed: cases.find((x) => x.id === 'corrected-r0153-html').tupleState === 'SUBJECT_DESCRIPTOR_VERIFIED'
  },
  {
    id: 'wrong-role-held',
    passed: cases.find((x) => x.id === 'right-size-wrong-role').tupleState === 'HOLD_SUBJECT_DESCRIPTOR_MISMATCH'
  },
  {
    id: 'wrong-producer-step-held',
    passed: cases.find((x) => x.id === 'right-fields-wrong-producer-step').tupleState === 'HOLD_SUBJECT_DESCRIPTOR_MISMATCH'
  },
  {
    id: 'all-case-expectations-met',
    passed: cases.every((x) => x.passed)
  }
];

const result = {
  schema: 'kaopu.artifact-identity-tuple-probe/1.0',
  caseId: fixture.caseId,
  sourceObservation: fixture.observation,
  currentBestView: 'Artifact identity fields are an atomic descriptor tuple; scalar values found on different objects cannot be recombined into a valid subject.',
  cases,
  assertions,
  passed: assertions.every((x) => x.passed),
  status: 'CANDIDATE_HISTORY_REPLAY_PASSED_NOT_ADOPTED',
  unknown: [
    'Mother implementation',
    'independent verifier receipt',
    'effect on correction recurrence or first-pass acceptance',
    'global applicability outside multi-artifact delivery claims'
  ]
};

fs.writeFileSync(outputPath, JSON.stringify(result, null, 2) + '\n');
if (!result.passed) process.exitCode = 1;
