import fs from 'node:fs';
import crypto from 'node:crypto';

const stable = value => {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stable(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
};

const digest = value => `sha256:${crypto.createHash('sha256').update(stable(value)).digest('hex')}`;
const sameSet = (a = [], b = []) => JSON.stringify([...new Set(a)].sort()) === JSON.stringify([...new Set(b)].sort());

function evaluate(anchor, observed) {
  if (!anchor?.taskId || !anchor?.authorizationId || !anchor?.authorizedScope || !anchor?.scopeDigest) {
    return {verdict: 'UNKNOWN_TASK_ANCHOR_MISSING', reasons: ['formal scope anchor is incomplete']};
  }
  const computedScopeDigest = digest(anchor.authorizedScope);
  if (anchor.scopeDigest !== computedScopeDigest || observed.scopeDigest !== anchor.scopeDigest) {
    return {verdict: 'HOLD_SCOPE_CONTRACT_MUTATED', reasons: ['scope digest is not the frozen dispatch digest'], computedScopeDigest};
  }
  if (observed.taskId !== anchor.taskId) {
    return {verdict: 'HOLD_TASK_ID_MISMATCH', reasons: ['candidate taskId does not match the frozen anchor']};
  }
  if (!sameSet(observed.referenceSetDigests, anchor.referenceSetDigests)) {
    return {verdict: 'HOLD_REFERENCE_TARGET_CHANGED', reasons: ['reference digest set changed']};
  }
  if (observed.candidateClass !== anchor.candidateClass) {
    return {verdict: 'HOLD_CANDIDATE_CLASS_ESCALATION', reasons: ['candidate class changed without separate authorization']};
  }

  const scope = anchor.authorizedScope;
  const forbidden = new Set(scope.forbiddenVisibleFeatureTypes || []);
  const allowed = new Set(scope.allowedVisibleFeatureTypes || []);
  const features = [...new Set(observed.visibleFeatureTypes || [])];
  const violations = [];
  if (!Number.isInteger(observed.targetObjectCount) || observed.targetObjectCount < scope.objectCount.min || observed.targetObjectCount > scope.objectCount.max) {
    violations.push(`objectCount=${observed.targetObjectCount} outside ${scope.objectCount.min}..${scope.objectCount.max}`);
  }
  const forbiddenObserved = features.filter(f => forbidden.has(f));
  if (forbiddenObserved.length) violations.push(`forbidden features: ${forbiddenObserved.join(',')}`);
  const unlistedObserved = features.filter(f => !allowed.has(f));
  if (unlistedObserved.length) violations.push(`unlisted features: ${unlistedObserved.join(',')}`);
  if (violations.length) {
    return {verdict: 'HOLD_SCOPE_EXPANSION_REQUIRES_REAUTHORIZATION', reasons: violations, computedScopeDigest};
  }
  return {verdict: 'SCOPE_AUTHORIZED', reasons: [], computedScopeDigest};
}

const fixturePath = process.argv[2] || new URL('./visible_scope_fixture_n41.json', import.meta.url);
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
const byId = new Map(fixture.cases.map(c => [c.id, c]));
const results = fixture.cases.map(c => {
  const anchor = c.anchorRef ? byId.get(c.anchorRef)?.anchor : c.anchor;
  const actual = evaluate(anchor, c.observed);
  return {id: c.id, expectedVerdict: c.expectedVerdict, actualVerdict: actual.verdict, passed: actual.verdict === c.expectedVerdict, reasons: actual.reasons, computedScopeDigest: actual.computedScopeDigest || null};
});
const output = {
  schema: 'kaopu.visible-scope-replay-result/1.0',
  candidateCaseId: fixture.candidateCaseId,
  total: results.length,
  passed: results.filter(r => r.passed).length,
  failed: results.filter(r => !r.passed).length,
  allPassed: results.every(r => r.passed),
  results
};
process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
if (!output.allPassed) process.exitCode = 1;
