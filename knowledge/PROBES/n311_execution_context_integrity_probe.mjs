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

function descriptor(input) {
  return { id: input.id, role: input.role, digest: sha256(input.payload) };
}

function vulnerableAnchor({ component, declaredInputs, exclusionPolicy, adapter, executionContext }) {
  const declared = declaredInputs.map(descriptor).sort((a, b) => a.id.localeCompare(b.id));
  const exclusions = exclusionPolicy.map((x) => ({
    id: x.id,
    role: x.role,
    reason: x.reason,
    authorizedBy: x.authorizedBy,
    policyDigest: sha256(x.policy)
  })).sort((a, b) => a.id.localeCompare(b.id));
  const adapterDescriptor = { id: adapter.id, version: adapter.version, digest: sha256(adapter.contract) };
  const componentDigest = sha256(component);
  return {
    componentDigest,
    closureRootDigest: sha256({
      schema: 'kaopu.anchor-dependency-closure/0.2-candidate',
      componentDigest,
      declaredInputs: declared,
      exclusionPolicy: exclusions,
      adapter: adapterDescriptor
    }),
    executionContext,
    declaredInputs: declared,
    exclusionPolicy: exclusions,
    adapter: adapterDescriptor
  };
}

function verifyVulnerable(expected, observed) {
  if (expected.closureRootDigest !== observed.closureRootDigest) return { status: 'HOLD_CLOSURE_CHANGED' };
  return { status: 'DEPENDENCY_CLOSURE_VERIFIED' };
}

function selectPath(object, path) {
  return path.split('.').reduce((value, key) => value?.[key], object);
}

function contextDescriptor(profile, observedContext) {
  const missing = profile.identityPaths.filter((path) => selectPath(observedContext, path) === undefined);
  if (missing.length) return { missing, descriptor: null };
  const identity = Object.fromEntries(profile.identityPaths.map((path) => [path, selectPath(observedContext, path)]));
  return {
    missing: [],
    descriptor: {
      profileId: profile.id,
      profileVersion: profile.version,
      profileDigest: sha256(profile),
      identity,
      identityDigest: sha256(identity)
    }
  };
}

function correctedAnchor({ component, declaredInputs, exclusionPolicy, adapter, contextProfile, executionContext }) {
  const vulnerable = vulnerableAnchor({ component, declaredInputs, exclusionPolicy, adapter, executionContext });
  const context = contextDescriptor(contextProfile, executionContext);
  return {
    ...vulnerable,
    contextProfile,
    executionContextDescriptor: context.descriptor,
    missingExecutionContextPaths: context.missing,
    closureRootDigest: context.descriptor ? sha256({
      schema: 'kaopu.anchor-dependency-closure/0.3-candidate',
      componentDigest: vulnerable.componentDigest,
      declaredInputs: vulnerable.declaredInputs,
      exclusionPolicy: vulnerable.exclusionPolicy,
      adapter: vulnerable.adapter,
      executionContext: context.descriptor
    }) : null
  };
}

function verifyCorrected(expected, observed) {
  if (observed.missingExecutionContextPaths.length) {
    return { status: 'HOLD_EXECUTION_CONTEXT_INCOMPLETE', detail: observed.missingExecutionContextPaths };
  }
  if (expected.executionContextDescriptor.profileDigest !== observed.executionContextDescriptor.profileDigest) {
    return { status: 'HOLD_EXECUTION_CONTEXT_PROFILE_CHANGED' };
  }
  if (expected.executionContextDescriptor.identityDigest !== observed.executionContextDescriptor.identityDigest) {
    return { status: 'HOLD_EXECUTION_CONTEXT_CHANGED' };
  }
  if (expected.closureRootDigest !== observed.closureRootDigest) return { status: 'HOLD_CLOSURE_CHANGED' };
  return { status: 'DEPENDENCY_CLOSURE_VERIFIED' };
}

const component = { id: 'coat/front-shell-v7', controlPoints: [0, 3, 8, 13] };
const material = { id: 'material/heavy-coat', role: 'simulation-input', payload: { density: 420, bend: 0.18 } };
const seam = { id: 'contract/seam-v3', role: 'geometry-input', payload: { unit: 'mm', winding: 'clockwise' } };
const weatherPolicy = {
  id: 'workbench/weather',
  role: 'unrelated-state',
  reason: 'separate workbench state',
  authorizedBy: 'task-anchor/N311',
  policy: { adapterRule: 'exclude-weather-v1' }
};
const adapter = { id: 'garment-anchor-adapter', version: '1.0.0', contract: { order: 'piece-id', float: 'decimal-v1' } };
const contextProfile = {
  id: 'garment-browser-context',
  version: '1.0.0',
  identityPaths: [
    'runtime.name',
    'runtime.version',
    'locale',
    'timezone',
    'browser.engine',
    'browser.revision',
    'browser.launchArgs',
    'renderer.requestedRoute'
  ],
  observationOnlyPaths: ['receipt.runId', 'receipt.startedAt']
};
const baselineContext = {
  runtime: { name: 'node', version: '22.15.0' },
  locale: 'en-US',
  timezone: 'UTC',
  browser: { engine: 'chromium', revision: '141.0.0', launchArgs: ['--use-angle=swiftshader'] },
  renderer: { requestedRoute: 'webgl2' },
  receipt: { runId: 'run-001', startedAt: '2026-11-18T07:40:00+08:00' }
};
const changedBrowserRouteContext = {
  ...baselineContext,
  browser: { ...baselineContext.browser, launchArgs: [] },
  receipt: { runId: 'run-002', startedAt: '2026-11-18T07:41:00+08:00' }
};
const changedReceiptOnlyContext = {
  ...baselineContext,
  receipt: { runId: 'run-003', startedAt: '2026-11-18T07:42:00+08:00' }
};
const missingTimezoneContext = { ...baselineContext };
delete missingTimezoneContext.timezone;

const common = { component, declaredInputs: [material, seam], exclusionPolicy: [weatherPolicy], adapter };
const vulnerableBaseline = vulnerableAnchor({ ...common, executionContext: baselineContext });
const vulnerableChangedContext = vulnerableAnchor({ ...common, executionContext: changedBrowserRouteContext });
const correctedBaseline = correctedAnchor({ ...common, contextProfile, executionContext: baselineContext });
const correctedChangedContext = correctedAnchor({ ...common, contextProfile, executionContext: changedBrowserRouteContext });
const correctedReceiptOnly = correctedAnchor({ ...common, contextProfile, executionContext: changedReceiptOnlyContext });
const correctedMissing = correctedAnchor({ ...common, contextProfile, executionContext: missingTimezoneContext });

assert.equal(vulnerableBaseline.closureRootDigest, vulnerableChangedContext.closureRootDigest);
assert.equal(verifyVulnerable(vulnerableBaseline, vulnerableChangedContext).status, 'DEPENDENCY_CLOSURE_VERIFIED');
assert.equal(verifyCorrected(correctedBaseline, correctedChangedContext).status, 'HOLD_EXECUTION_CONTEXT_CHANGED');
assert.equal(verifyCorrected(correctedBaseline, correctedReceiptOnly).status, 'DEPENDENCY_CLOSURE_VERIFIED');
assert.equal(verifyCorrected(correctedBaseline, correctedMissing).status, 'HOLD_EXECUTION_CONTEXT_INCOMPLETE');

console.log(JSON.stringify({
  probe: 'n311_execution_context_integrity_probe',
  subject: 'N308/N309 KaoPuGram dependency-closure Candidates',
  boundedQuestion: 'Can an anchor remain verified when a declared execution-context constraint changes outside the closure digest?',
  vulnerableReplay: {
    baselineClosureRootDigest: vulnerableBaseline.closureRootDigest,
    changedContextClosureRootDigest: vulnerableChangedContext.closureRootDigest,
    status: verifyVulnerable(vulnerableBaseline, vulnerableChangedContext),
    defect: 'environmentConstraints are required by N308 prose but omitted from the executable closure root and verifier'
  },
  correctedPrototype: {
    changedIdentityContext: verifyCorrected(correctedBaseline, correctedChangedContext),
    changedObservationOnlyReceiptMetadata: verifyCorrected(correctedBaseline, correctedReceiptOnly),
    missingRequiredContext: verifyCorrected(correctedBaseline, correctedMissing),
    baselineContextRootDigest: correctedBaseline.executionContextDescriptor.identityDigest,
    changedContextRootDigest: correctedChangedContext.executionContextDescriptor.identityDigest
  },
  teacherDecision: {
    source: 'Bazel Remote Execution API command environment and platform identity',
    status: 'NO_NOVELTY',
    reason: 'N308 already recorded this external principle; N311 exposes a local transfer-to-gate failure rather than new teacher knowledge.'
  },
  decision: 'HOLD_GATE_FAIL',
  boundary: 'Candidate regression only. The profile must remain bounded and versioned; network inputs, secrets, physical-device acceptance, and semantic relevance need separate policy or receipts.'
}, null, 2));
