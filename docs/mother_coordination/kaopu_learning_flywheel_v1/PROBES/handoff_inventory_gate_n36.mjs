import fs from 'node:fs';

const fixture = JSON.parse(fs.readFileSync(new URL('./handoff_inventory_fixture_n36.json', import.meta.url), 'utf8'));
const checks = [];
function check(id, actual, expected) {
  const passed = JSON.stringify(actual) === JSON.stringify(expected);
  checks.push({id, actual, expected, passed});
  if (!passed) throw new Error(`${id}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

function evaluateProfile(profile, inventory) {
  const missing = profile.requiredRoles.filter(role => inventory[role] !== 'INCLUDED_VERIFIED');
  return {
    claim: profile.claim,
    requiredRoleCount: profile.requiredRoles.length,
    missing,
    decision: missing.length ? 'HOLD_REQUIRED_ROLE_MISSING' : 'HANDOFF_CONTRACT_COMPLETE'
  };
}

const h = fixture.historicalObservation;
const subset = evaluateProfile(fixture.profiles.PUBLIC_RUNNABLE_SUBSET_V1, fixture.observedInventory);
const full = evaluateProfile(fixture.profiles.FULL_TAKEOVER_SOURCE_VAULT_V1, fixture.observedInventory);

check('archive-integrity-evidence-is-valid', h.zipCrcPass && h.archiveBytes > 0 && h.archiveSha256.length === 64, true);
check('fresh-unzip-runtime-evidence-is-valid', h.freshUnzipBrowserPass, true);
check('public-runnable-subset-complete', subset.decision, 'HANDOFF_CONTRACT_COMPLETE');
check('public-runnable-subset-has-no-missing-role', subset.missing, []);
check('full-source-vault-is-held', full.decision, 'HOLD_REQUIRED_ROLE_MISSING');
check('full-source-vault-missing-roles-are-explicit', full.missing.sort(), ['originalFbxGltfUploadZip','privateContinuousInstructionLog'].sort());
check('file-count-cannot-overrule-missing-required-role', h.verifiedFileCount === 181 && full.decision === 'HOLD_REQUIRED_ROLE_MISSING', true);
check('historical-manifest-does-not-claim-private-vault', h.entirePrivateSourceVault, false);
check('known-exclusion-does-not-become-inclusion', fixture.observedInventory.originalFbxGltfUploadZip, 'KNOWN_NOT_INCLUDED');
check('scope-matched-runnable-claim-remains-valid', h.fullRunnableProject && subset.decision === 'HANDOFF_CONTRACT_COMPLETE', true);
check('task-contract-completeness-remains-unknown-without-pinned-profile', h.userAcceptance, 'UNKNOWN');
check('integrity-and-contract-completeness-are-independent', h.zipCrcPass && full.decision !== 'HANDOFF_CONTRACT_COMPLETE', true);

const result = {
  schema: 'kaopu.handoff-inventory-probe/1.0',
  round: 'N36',
  historicalDecision: {
    archiveIntegrity: 'ARCHIVE_INTEGRITY_VERIFIED',
    runnableSubsetProfile: subset.decision,
    fullTakeoverSourceVaultProfile: full.decision,
    actualTaskProfile: 'UNKNOWN_NOT_PINNED_IN_MACHINE_READABLE_TASK_ANCHOR',
    userAcceptance: h.userAcceptance
  },
  profileResults: {
    PUBLIC_RUNNABLE_SUBSET_V1: subset,
    FULL_TAKEOVER_SOURCE_VAULT_V1: full
  },
  candidateMethod: {
    expectedInventorySource: 'Task Anchor profile fixed before packaging and independent of observed archive traversal',
    observedInventorySource: 'archive traversal plus per-role identity verification',
    decisionRule: 'every required role must be INCLUDED_VERIFIED or satisfy an explicitly authorized external-delivery mode',
    preservedClaims: ['archive integrity','download identity','fresh-unzip runtime'],
    forbiddenShortcut: 'verified file count or self-generated manifest implies task-contract completeness'
  },
  checks,
  summary: {
    passed: checks.filter(x => x.passed).length,
    total: checks.length,
    allPassed: checks.every(x => x.passed)
  }
};
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
