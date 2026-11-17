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

function policyBundle({ revision, roots, rules, authorizedBy }) {
  const normalized = {
    schema: 'kaopu.exclusion-policy-bundle/0.1-candidate',
    revision,
    roots: [...roots].sort(),
    rules: [...rules].map((rule) => ({
      inputId: rule.inputId,
      role: rule.role,
      reason: rule.reason
    })).sort((a, b) => a.inputId.localeCompare(b.inputId)),
    authorizedBy
  };
  return { ...normalized, digest: sha256(normalized) };
}

function ruleMap(bundle) {
  return new Map(bundle.rules.map((rule) => [rule.inputId, sha256(rule)]));
}

function symmetricDifference(a, b) {
  return [...new Set([...a, ...b])].filter((value) => a.has(value) !== b.has(value)).sort();
}

function policyDiff(fromBundle, toBundle) {
  const fromRoots = new Set(fromBundle.roots);
  const toRoots = new Set(toBundle.roots);
  const fromRules = ruleMap(fromBundle);
  const toRules = ruleMap(toBundle);
  const changedRuleIds = [...new Set([...fromRules.keys(), ...toRules.keys()])]
    .filter((id) => fromRules.get(id) !== toRules.get(id))
    .sort();
  return {
    changedRoots: symmetricDifference(fromRoots, toRoots),
    changedRuleIds,
    scopeChanged: symmetricDifference(fromRoots, toRoots).length > 0
  };
}

function impactedAnchors(anchors, diff) {
  const changed = new Set(diff.changedRuleIds);
  return anchors
    .filter((anchor) => anchor.knownInputIds.some((id) => changed.has(id)))
    .map((anchor) => anchor.anchorId)
    .sort();
}

function evaluateMigration({ fromBundle, toBundle, mode, anchors, replayReceipts, activateRequested }) {
  const diff = policyDiff(fromBundle, toBundle);
  const impacted = impactedAnchors(anchors, diff);
  if (mode === 'PATCH' && diff.scopeChanged) {
    return {
      status: 'HOLD_POLICY_SCOPE_CHANGE_REQUIRES_SNAPSHOT',
      activeRevision: fromBundle.revision,
      impactedAnchorIds: impacted,
      diff
    };
  }
  const receipts = new Map(replayReceipts.map((receipt) => [receipt.anchorId, receipt]));
  const missing = impacted.filter((id) => !receipts.has(id));
  if (missing.length) {
    return {
      status: 'HOLD_POLICY_MIGRATION_UNREPLAYED',
      activeRevision: fromBundle.revision,
      impactedAnchorIds: impacted,
      missingReplayAnchorIds: missing,
      diff
    };
  }
  const failed = impacted.filter((id) => receipts.get(id).status !== 'PASS' || receipts.get(id).policyRevision !== toBundle.revision || receipts.get(id).policyDigest !== toBundle.digest);
  if (failed.length || !activateRequested) {
    return {
      status: 'HOLD_POLICY_ACTIVATION_FAILED',
      activeRevision: fromBundle.revision,
      impactedAnchorIds: impacted,
      failedReplayAnchorIds: failed,
      diff
    };
  }
  return {
    status: 'POLICY_REVISION_ACTIVATED',
    activeRevision: toBundle.revision,
    activePolicyDigest: toBundle.digest,
    impactedAnchorIds: impacted,
    unaffectedAnchorIds: anchors.map((anchor) => anchor.anchorId).filter((id) => !impacted.includes(id)).sort(),
    diff
  };
}

const policyV1 = policyBundle({
  revision: 'garment-exclusions/v1',
  roots: ['workbench/weather'],
  rules: [{ inputId: 'workbench/weather', role: 'unrelated-state', reason: 'separate workbench state' }],
  authorizedBy: 'task-anchor/N309'
});
const policyV2SameScope = policyBundle({
  revision: 'garment-exclusions/v2',
  roots: ['workbench/weather'],
  rules: [{ inputId: 'workbench/weather', role: 'unrelated-state', reason: 'separate Weather workbench; no garment semantic edge' }],
  authorizedBy: 'coordinator-candidate/N310'
});
const policyV2Expanded = policyBundle({
  revision: 'garment-exclusions/v2-expanded',
  roots: ['runtime/material-override', 'workbench/weather'],
  rules: [
    { inputId: 'workbench/weather', role: 'unrelated-state', reason: 'separate workbench state' },
    { inputId: 'runtime/material-override', role: 'runtime-input', reason: 'proposed adapter exclusion' }
  ],
  authorizedBy: 'producer-adapter-upgrade'
});

const anchors = [
  {
    anchorId: 'garment/front-shell-v7',
    policyRevision: policyV1.revision,
    policyDigest: policyV1.digest,
    knownInputIds: ['material/heavy-coat', 'runtime/material-override', 'workbench/weather']
  },
  {
    anchorId: 'terrain/tile-42',
    policyRevision: policyV1.revision,
    policyDigest: policyV1.digest,
    knownInputIds: ['terrain/dem-42', 'terrain/crs']
  }
];

const sameScopeReplay = [{
  anchorId: 'garment/front-shell-v7',
  policyRevision: policyV2SameScope.revision,
  policyDigest: policyV2SameScope.digest,
  status: 'PASS'
}];

const sameScopeActivated = evaluateMigration({
  fromBundle: policyV1,
  toBundle: policyV2SameScope,
  mode: 'PATCH',
  anchors,
  replayReceipts: sameScopeReplay,
  activateRequested: true
});
const expandedAsPatch = evaluateMigration({
  fromBundle: policyV1,
  toBundle: policyV2Expanded,
  mode: 'PATCH',
  anchors,
  replayReceipts: [],
  activateRequested: true
});
const expandedSnapshotWithoutReplay = evaluateMigration({
  fromBundle: policyV1,
  toBundle: policyV2Expanded,
  mode: 'SNAPSHOT',
  anchors,
  replayReceipts: [],
  activateRequested: true
});
const expandedSnapshotFailedReplay = evaluateMigration({
  fromBundle: policyV1,
  toBundle: policyV2Expanded,
  mode: 'SNAPSHOT',
  anchors,
  replayReceipts: [{ anchorId: 'garment/front-shell-v7', policyRevision: policyV2Expanded.revision, policyDigest: policyV2Expanded.digest, status: 'FAIL_UNAUTHORIZED_EXCLUSION' }],
  activateRequested: true
});

assert.equal(sameScopeActivated.status, 'POLICY_REVISION_ACTIVATED');
assert.deepEqual(sameScopeActivated.impactedAnchorIds, ['garment/front-shell-v7']);
assert.deepEqual(sameScopeActivated.unaffectedAnchorIds, ['terrain/tile-42']);
assert.equal(expandedAsPatch.status, 'HOLD_POLICY_SCOPE_CHANGE_REQUIRES_SNAPSHOT');
assert.equal(expandedAsPatch.activeRevision, policyV1.revision);
assert.equal(expandedSnapshotWithoutReplay.status, 'HOLD_POLICY_MIGRATION_UNREPLAYED');
assert.equal(expandedSnapshotFailedReplay.status, 'HOLD_POLICY_ACTIVATION_FAILED');
assert.equal(expandedSnapshotFailedReplay.activeRevision, policyV1.revision);

console.log(JSON.stringify({
  probe: 'n310_exclusion_policy_migration_probe',
  boundedQuestion: 'How can an adapter exclusion-policy upgrade avoid silent permission inheritance without forcing unrelated anchors to migrate?',
  controls: {
    oldPolicyRevision: policyV1.revision,
    oldPolicyDigest: policyV1.digest,
    legacyAnchorReceiptRemainsBoundToOldRevision: true
  },
  cases: {
    sameScopeVersionWithAffectedReplay: sameScopeActivated,
    scopeExpansionDisguisedAsPatch: expandedAsPatch,
    scopeExpansionSnapshotWithoutReplay: expandedSnapshotWithoutReplay,
    failedReplayKeepsLastSuccessfulRevision: expandedSnapshotFailedReplay
  },
  finding: 'Only anchors intersecting changed policy rules require replay; unrelated anchors remain pinned to their original immutable policy revision. Scope expansion cannot be a patch.',
  boundary: 'Candidate protocol replay only. It does not authorize any exclusion, migrate a production anchor, or implement OPA in KAOPU.'
}, null, 2));
