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

function makeAnchor({ componentPayload, declaredInputs, adapter, observedInputs = [], excludedInputs = [] }) {
  const declared = [...declaredInputs]
    .map((entry) => ({ id: entry.id, role: entry.role, digest: sha256(entry.payload) }))
    .sort((a, b) => a.id.localeCompare(b.id));
  const observedIds = new Set(observedInputs.map((entry) => entry.id));
  const declaredIds = new Set(declared.map((entry) => entry.id));
  const excludedIds = new Set(excludedInputs.map((entry) => entry.id));
  const undeclared = [...observedIds].filter((id) => !declaredIds.has(id) && !excludedIds.has(id)).sort();

  const componentDigest = sha256(componentPayload);
  const closure = {
    schema: 'kaopu.anchor-dependency-closure/0.1-candidate',
    componentDigest,
    declaredInputs: declared,
    adapter: { id: adapter.id, version: adapter.version, digest: sha256(adapter.canonicalizationContract) }
  };
  return {
    componentDigest,
    closureRootDigest: sha256(closure),
    declaredInputs: declared,
    excludedInputIds: [...excludedIds].sort(),
    undeclaredObservedInputIds: undeclared,
    adapter: closure.adapter
  };
}

function verify(expected, observed) {
  if (observed.undeclaredObservedInputIds.length) {
    return { status: 'HOLD_UNDECLARED_DEPENDENCY', detail: observed.undeclaredObservedInputIds };
  }
  if (expected.adapter.id !== observed.adapter.id || expected.adapter.version !== observed.adapter.version || expected.adapter.digest !== observed.adapter.digest) {
    return { status: 'HOLD_ADAPTER_VERSION_CHANGED' };
  }
  if (expected.componentDigest !== observed.componentDigest) {
    return { status: 'HOLD_COMPONENT_PAYLOAD_CHANGED' };
  }
  if (expected.closureRootDigest !== observed.closureRootDigest) {
    return { status: 'HOLD_DEPENDENCY_DIGEST_CHANGED' };
  }
  return { status: 'DEPENDENCY_CLOSURE_VERIFIED' };
}

const garment = { patternPiece: 'front-shell-v7', controlPoints: [0, 3, 8, 13], seamAllowanceMm: 12 };
const materialV1 = { id: 'material-profile/heavy-coat', role: 'simulation-input', payload: { density: 420, bend: 0.18 } };
const materialV2 = { id: 'material-profile/heavy-coat', role: 'simulation-input', payload: { density: 510, bend: 0.18 } };
const seamContract = { id: 'seam-contract/coat-v3', role: 'geometry-input', payload: { unit: 'mm', winding: 'clockwise' } };
const weatherV1 = { id: 'workbench/weather', role: 'unrelated-workbench-state', payload: { rain: 0 } };
const weatherV2 = { id: 'workbench/weather', role: 'unrelated-workbench-state', payload: { rain: 80 } };
const adapterV1 = { id: 'garment-anchor-adapter', version: '1.0.0', canonicalizationContract: { float: 'decimal-string-v1', order: 'piece-id' } };
const adapterV2 = { id: 'garment-anchor-adapter', version: '2.0.0', canonicalizationContract: { float: 'decimal-string-v2', order: 'piece-id' } };

const baseline = makeAnchor({
  componentPayload: garment,
  declaredInputs: [materialV1, seamContract],
  adapter: adapterV1,
  observedInputs: [materialV1, seamContract, weatherV1],
  excludedInputs: [weatherV1]
});

const unrelatedChange = makeAnchor({
  componentPayload: garment,
  declaredInputs: [materialV1, seamContract],
  adapter: adapterV1,
  observedInputs: [materialV1, seamContract, weatherV2],
  excludedInputs: [weatherV2]
});

const dependencyChange = makeAnchor({
  componentPayload: garment,
  declaredInputs: [materialV2, seamContract],
  adapter: adapterV1,
  observedInputs: [materialV2, seamContract, weatherV2],
  excludedInputs: [weatherV2]
});

const undeclaredFetch = makeAnchor({
  componentPayload: garment,
  declaredInputs: [materialV1, seamContract],
  adapter: adapterV1,
  observedInputs: [materialV1, seamContract, { id: 'runtime-fetch/material-override', role: 'runtime-input', payload: { url: 'https://example.invalid/override.json' } }],
  excludedInputs: []
});

const adapterChange = makeAnchor({
  componentPayload: garment,
  declaredInputs: [materialV1, seamContract],
  adapter: adapterV2,
  observedInputs: [materialV1, seamContract],
  excludedInputs: []
});

assert.equal(baseline.componentDigest, dependencyChange.componentDigest, 'component-only digest must miss dependency change');
assert.equal(verify(baseline, unrelatedChange).status, 'DEPENDENCY_CLOSURE_VERIFIED');
assert.equal(verify(baseline, dependencyChange).status, 'HOLD_DEPENDENCY_DIGEST_CHANGED');
assert.equal(verify(baseline, undeclaredFetch).status, 'HOLD_UNDECLARED_DEPENDENCY');
assert.equal(verify(baseline, adapterChange).status, 'HOLD_ADAPTER_VERSION_CHANGED');

const result = {
  probe: 'n308_anchor_dependency_closure_probe',
  boundedQuestion: 'Can a component anchor remain valid when component bytes are unchanged but a semantic dependency changes?',
  baseline,
  cases: {
    unrelatedWorkbenchStateChanged: verify(baseline, unrelatedChange),
    declaredSemanticDependencyChanged: verify(baseline, dependencyChange),
    undeclaredRuntimeInputObserved: verify(baseline, undeclaredFetch),
    canonicalizationAdapterChanged: verify(baseline, adapterChange)
  },
  falsifier: {
    componentOnlyDigestStayedEqualAcrossDependencyChange: baseline.componentDigest === dependencyChange.componentDigest,
    dependencyClosureDigestChanged: baseline.closureRootDigest !== dependencyChange.closureRootDigest
  },
  boundary: 'This probe checks declared closure identity. It cannot discover all semantic dependencies automatically or prove visual/physical correctness.'
};

console.log(JSON.stringify(result, null, 2));
