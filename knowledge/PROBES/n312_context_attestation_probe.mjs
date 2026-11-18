import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

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

function selectPath(object, path) {
  return path.split('.').reduce((value, key) => value?.[key], object);
}

function contextDescriptor(profile, context) {
  const missing = profile.identityPaths.filter((path) => selectPath(context, path) === undefined);
  const identity = Object.fromEntries(profile.identityPaths.map((path) => [path, selectPath(context, path)]));
  return {
    missing,
    profileDigest: sha256(profile),
    identity,
    identityDigest: missing.length ? null : sha256(identity)
  };
}

function n311Receipt({ anchorId, subjectDigest, producerIdentity, profile, producerClaimedContext }) {
  const context = contextDescriptor(profile, producerClaimedContext);
  return {
    anchorId,
    subjectDigest,
    producerIdentity,
    profileDigest: context.profileDigest,
    producerClaimedContextDigest: context.identityDigest,
    producerClaimedContext: context.identity,
    missingContextPaths: context.missing
  };
}

function verifyN311(expected, receipt) {
  if (receipt.missingContextPaths.length) return { status: 'HOLD_EXECUTION_CONTEXT_INCOMPLETE' };
  if (expected.profileDigest !== receipt.profileDigest) return { status: 'HOLD_EXECUTION_CONTEXT_PROFILE_CHANGED' };
  if (expected.contextDigest !== receipt.producerClaimedContextDigest) return { status: 'HOLD_EXECUTION_CONTEXT_CHANGED' };
  return { status: 'DEPENDENCY_CLOSURE_VERIFIED' };
}

function independentObservation({ anchorId, subjectDigest, observerIdentity, observationMethod, profile, actualContext, rawEvidence }) {
  const observed = contextDescriptor(profile, actualContext);
  return {
    anchorId,
    subjectDigest,
    observerIdentity,
    observationMethod,
    profileDigest: observed.profileDigest,
    observedContext: observed.identity,
    observedContextDigest: observed.identityDigest,
    missingObservedPaths: observed.missing,
    rawEvidenceDigest: rawEvidence ? sha256(rawEvidence) : null
  };
}

function verifyObserverBound(expected, receipt, observation) {
  if (!observation) return { status: 'HOLD_INDEPENDENT_CONTEXT_OBSERVATION_MISSING' };
  if (observation.observerIdentity === receipt.producerIdentity) return { status: 'HOLD_PRODUCER_SELF_ATTESTATION' };
  if (observation.anchorId !== receipt.anchorId || observation.subjectDigest !== receipt.subjectDigest) {
    return { status: 'HOLD_CONTEXT_OBSERVATION_SUBJECT_MISMATCH' };
  }
  if (!observation.rawEvidenceDigest || !observation.observationMethod) {
    return { status: 'HOLD_CONTEXT_OBSERVATION_EVIDENCE_INCOMPLETE' };
  }
  if (observation.missingObservedPaths.length) {
    return { status: 'HOLD_EXECUTION_CONTEXT_INCOMPLETE', detail: observation.missingObservedPaths };
  }
  if (expected.profileDigest !== receipt.profileDigest || expected.profileDigest !== observation.profileDigest) {
    return { status: 'HOLD_EXECUTION_CONTEXT_PROFILE_CHANGED' };
  }
  if (receipt.producerClaimedContextDigest !== observation.observedContextDigest) {
    return { status: 'HOLD_CONTEXT_SELF_REPORT_CONFLICT' };
  }
  if (expected.contextDigest !== observation.observedContextDigest) {
    return { status: 'HOLD_EXECUTION_CONTEXT_CHANGED' };
  }
  return { status: 'DEPENDENCY_CLOSURE_VERIFIED' };
}

const profile = {
  id: 'garment-browser-context',
  version: '1.0.0',
  identityPaths: [
    'runtime.name',
    'runtime.version',
    'timezone',
    'browser.engine',
    'browser.revision',
    'browser.launchArgs',
    'renderer.observedRoute'
  ]
};
const anchoredContext = {
  runtime: { name: 'node', version: '22.15.0' },
  timezone: 'UTC',
  browser: { engine: 'chromium', revision: '141.0.0', launchArgs: ['--use-angle=swiftshader'] },
  renderer: { observedRoute: 'webgl2-swiftshader' }
};
const actualChangedContext = {
  ...anchoredContext,
  browser: { ...anchoredContext.browser, launchArgs: [] },
  renderer: { observedRoute: 'webgl1-hardware' }
};
const anchorId = 'garment/front-shell-v7';
const subjectDigest = sha256({ component: anchorId, build: 'candidate-17' });
const expected = {
  profileDigest: sha256(profile),
  contextDigest: contextDescriptor(profile, anchoredContext).identityDigest
};

const dishonestReceipt = n311Receipt({
  anchorId,
  subjectDigest,
  producerIdentity: 'producer/garment-17',
  profile,
  producerClaimedContext: anchoredContext
});
const independentChangedObservation = independentObservation({
  anchorId,
  subjectDigest,
  observerIdentity: 'verifier/browser-harness-3',
  observationMethod: 'browser-process-and-canvas-inspection-v1',
  profile,
  actualContext: actualChangedContext,
  rawEvidence: { processArgs: [], canvasContext: 'WebGLRenderingContext' }
});
const independentMatchingObservation = independentObservation({
  anchorId,
  subjectDigest,
  observerIdentity: 'verifier/browser-harness-3',
  observationMethod: 'browser-process-and-canvas-inspection-v1',
  profile,
  actualContext: anchoredContext,
  rawEvidence: { processArgs: ['--use-angle=swiftshader'], canvasContext: 'WebGL2RenderingContext' }
});
const producerSelfObservation = independentObservation({
  anchorId,
  subjectDigest,
  observerIdentity: dishonestReceipt.producerIdentity,
  observationMethod: 'producer-self-report',
  profile,
  actualContext: anchoredContext,
  rawEvidence: { claimed: true }
});
const wrongSubjectObservation = independentObservation({
  anchorId,
  subjectDigest: sha256({ component: anchorId, build: 'candidate-16' }),
  observerIdentity: 'verifier/browser-harness-3',
  observationMethod: 'browser-process-and-canvas-inspection-v1',
  profile,
  actualContext: anchoredContext,
  rawEvidence: { processArgs: ['--use-angle=swiftshader'], canvasContext: 'WebGL2RenderingContext' }
});

assert.equal(verifyN311(expected, dishonestReceipt).status, 'DEPENDENCY_CLOSURE_VERIFIED');
assert.equal(verifyObserverBound(expected, dishonestReceipt, independentChangedObservation).status, 'HOLD_CONTEXT_SELF_REPORT_CONFLICT');
assert.equal(verifyObserverBound(expected, dishonestReceipt, independentMatchingObservation).status, 'DEPENDENCY_CLOSURE_VERIFIED');
assert.equal(verifyObserverBound(expected, dishonestReceipt, null).status, 'HOLD_INDEPENDENT_CONTEXT_OBSERVATION_MISSING');
assert.equal(verifyObserverBound(expected, dishonestReceipt, producerSelfObservation).status, 'HOLD_PRODUCER_SELF_ATTESTATION');
assert.equal(verifyObserverBound(expected, dishonestReceipt, wrongSubjectObservation).status, 'HOLD_CONTEXT_OBSERVATION_SUBJECT_MISMATCH');

console.log(JSON.stringify({
  probe: 'n312_context_attestation_probe',
  subject: 'N311 execution-context integrity Candidate correction',
  boundedQuestion: 'Can a Producer claim the anchored execution context while the independently observed runtime context differs?',
  vulnerableReplay: {
    producerClaimedContextDigest: dishonestReceipt.producerClaimedContextDigest,
    actualObservedContextDigest: independentChangedObservation.observedContextDigest,
    n311Status: verifyN311(expected, dishonestReceipt),
    defect: 'N311 hashes caller-supplied context but has no independent observation, observer identity, raw-evidence digest, or subject binding.'
  },
  observerBoundPrototype: {
    falseProducerClaim: verifyObserverBound(expected, dishonestReceipt, independentChangedObservation),
    matchingIndependentObservation: verifyObserverBound(expected, dishonestReceipt, independentMatchingObservation),
    missingObservation: verifyObserverBound(expected, dishonestReceipt, null),
    producerSelfAttestation: verifyObserverBound(expected, dishonestReceipt, producerSelfObservation),
    wrongSubjectObservation: verifyObserverBound(expected, dishonestReceipt, wrongSubjectObservation)
  },
  teacherDecision: {
    source: 'N307 browser-observed route receipt and its W3C/WPT method teacher',
    status: 'NO_NOVELTY',
    reason: 'Independent observation and self-report conflict handling already exist in KAOPU Current Best View; N312 exposes a missing transfer from N307 into N311.'
  },
  decision: 'HOLD_GATE_FAIL',
  boundary: 'Synthetic protocol replay only. It does not prove a real Mother has a trustworthy observer for every context field, and it does not make browser evidence equivalent to physical-device or user acceptance.'
}, null, 2));
