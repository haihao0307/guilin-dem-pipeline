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

function vulnerableAnchor({ component, declaredInputs, adapter, observedInputs, excludedInputs }) {
  const declared = declaredInputs.map(descriptor).sort((a, b) => a.id.localeCompare(b.id));
  const declaredIds = new Set(declared.map((x) => x.id));
  const excludedIds = new Set(excludedInputs.map((x) => x.id));
  const undeclared = observedInputs.map((x) => x.id).filter((id) => !declaredIds.has(id) && !excludedIds.has(id)).sort();
  const adapterDescriptor = { id: adapter.id, version: adapter.version, digest: sha256(adapter.contract) };
  return {
    componentDigest: sha256(component),
    closureRootDigest: sha256({ componentDigest: sha256(component), declaredInputs: declared, adapter: adapterDescriptor }),
    excludedInputIds: [...excludedIds].sort(),
    undeclaredObservedInputIds: undeclared,
    adapter: adapterDescriptor
  };
}

function verifyVulnerable(expected, observed) {
  if (observed.undeclaredObservedInputIds.length) return 'HOLD_UNDECLARED_DEPENDENCY';
  if (expected.closureRootDigest !== observed.closureRootDigest) return 'HOLD_DEPENDENCY_DIGEST_CHANGED';
  return 'DEPENDENCY_CLOSURE_VERIFIED';
}

function correctedAnchor({ component, declaredInputs, adapter, observedInputs, exclusionPolicy }) {
  const declared = declaredInputs.map(descriptor).sort((a, b) => a.id.localeCompare(b.id));
  const exclusions = exclusionPolicy
    .map((x) => ({
      id: x.id,
      role: x.role,
      reason: x.reason,
      authorizedBy: x.authorizedBy,
      policyDigest: sha256(x.policy)
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
  const declaredIds = new Set(declared.map((x) => x.id));
  const excludedIds = new Set(exclusions.map((x) => x.id));
  const undeclared = observedInputs.map((x) => x.id).filter((id) => !declaredIds.has(id) && !excludedIds.has(id)).sort();
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
    exclusionPolicy: exclusions,
    undeclaredObservedInputIds: undeclared,
    adapter: adapterDescriptor
  };
}

function verifyCorrected(expected, observed) {
  const authorized = new Set(expected.exclusionPolicy.map((x) => x.id));
  const introduced = observed.exclusionPolicy.map((x) => x.id).filter((id) => !authorized.has(id)).sort();
  if (introduced.length) return { status: 'HOLD_UNAUTHORIZED_EXCLUSION', detail: introduced };
  if (observed.undeclaredObservedInputIds.length) return { status: 'HOLD_UNDECLARED_DEPENDENCY', detail: observed.undeclaredObservedInputIds };
  if (expected.closureRootDigest !== observed.closureRootDigest) return { status: 'HOLD_EXCLUSION_OR_DEPENDENCY_SET_CHANGED' };
  return { status: 'DEPENDENCY_CLOSURE_VERIFIED' };
}

const component = { id: 'coat/front-shell-v7', controlPoints: [0, 3, 8, 13] };
const materialV1 = { id: 'material/heavy-coat', role: 'simulation-input', payload: { density: 420, bend: 0.18 } };
const materialV2 = { id: 'material/heavy-coat', role: 'simulation-input', payload: { density: 510, bend: 0.18 } };
const seam = { id: 'contract/seam-v3', role: 'geometry-input', payload: { unit: 'mm', winding: 'clockwise' } };
const weather = { id: 'workbench/weather', role: 'unrelated-state', payload: { rain: 80 } };
const override = { id: 'runtime/material-override', role: 'runtime-input', payload: { url: 'https://example.invalid/override.json' } };
const adapter = { id: 'garment-anchor-adapter', version: '1.0.0', contract: { order: 'piece-id', float: 'decimal-v1' } };
const weatherPolicy = { id: weather.id, role: weather.role, reason: 'separate workbench state', authorizedBy: 'task-anchor/N309', policy: { adapterRule: 'exclude-weather-v1' } };
const overrideAfterRun = { id: override.id, role: override.role, reason: 'producer reclassification', authorizedBy: 'producer-after-run', policy: { adapterRule: 'none' } };

const vulnerableBaseline = vulnerableAnchor({
  component,
  declaredInputs: [materialV1, seam],
  adapter,
  observedInputs: [materialV1, seam, weather],
  excludedInputs: [weather]
});
const vulnerableBypass = vulnerableAnchor({
  component,
  declaredInputs: [materialV1, seam],
  adapter,
  observedInputs: [materialV1, seam, override],
  excludedInputs: [override]
});
const correctedBaseline = correctedAnchor({
  component,
  declaredInputs: [materialV1, seam],
  adapter,
  observedInputs: [materialV1, seam, weather],
  exclusionPolicy: [weatherPolicy]
});
const correctedUnchanged = correctedAnchor({
  component,
  declaredInputs: [materialV1, seam],
  adapter,
  observedInputs: [materialV1, seam, weather],
  exclusionPolicy: [weatherPolicy]
});
const correctedBypass = correctedAnchor({
  component,
  declaredInputs: [materialV1, seam],
  adapter,
  observedInputs: [materialV1, seam, override],
  exclusionPolicy: [weatherPolicy, overrideAfterRun]
});
const correctedDependencyChange = correctedAnchor({
  component,
  declaredInputs: [materialV2, seam],
  adapter,
  observedInputs: [materialV2, seam, weather],
  exclusionPolicy: [weatherPolicy]
});

assert.equal(vulnerableBaseline.closureRootDigest, vulnerableBypass.closureRootDigest);
assert.equal(verifyVulnerable(vulnerableBaseline, vulnerableBypass), 'DEPENDENCY_CLOSURE_VERIFIED');
assert.equal(verifyCorrected(correctedBaseline, correctedUnchanged).status, 'DEPENDENCY_CLOSURE_VERIFIED');
assert.equal(verifyCorrected(correctedBaseline, correctedBypass).status, 'HOLD_UNAUTHORIZED_EXCLUSION');
assert.equal(verifyCorrected(correctedBaseline, correctedDependencyChange).status, 'HOLD_EXCLUSION_OR_DEPENDENCY_SET_CHANGED');

console.log(JSON.stringify({
  probe: 'n309_anchor_exclusion_integrity_probe',
  subject: 'N308 KaoPuGram declared dependency closure Candidate',
  vulnerableReplay: {
    baselineClosureRootDigest: vulnerableBaseline.closureRootDigest,
    bypassClosureRootDigest: vulnerableBypass.closureRootDigest,
    status: verifyVulnerable(vulnerableBaseline, vulnerableBypass),
    defect: 'excludedInputIds are outside the closure digest and verifier comparison'
  },
  correctedPrototype: {
    unchangedAuthorizedExclusion: verifyCorrected(correctedBaseline, correctedUnchanged),
    afterRunReclassification: verifyCorrected(correctedBaseline, correctedBypass),
    semanticDependencyChanged: verifyCorrected(correctedBaseline, correctedDependencyChange)
  },
  decision: 'HOLD_GATE_FAIL',
  boundary: 'Candidate regression only; no production Mother, main, R2 OS, or universal KaoPuGram service is modified.'
}, null, 2));
