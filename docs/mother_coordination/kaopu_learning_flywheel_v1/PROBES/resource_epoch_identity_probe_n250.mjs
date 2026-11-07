import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const n249SourceUrl = new URL('./webgpu_device_loss_epoch_probe_n249.mjs', import.meta.url);
const n249Source = await readFile(n249SourceUrl, 'utf8');

const sourceAudit = {
  subjectSha256: '442416e3ea591f0c40c92ae6f09e71c6bec1acd53d1574fe790f24f77ad8dba3',
  incrementsEpochLocally: n249Source.includes('this.epoch += 1;'),
  reissuesUsingIncrementedEpoch: n249Source.includes("this.events.push(['reissued', superseding.revision, this.epoch]);"),
  callsRequestAdapter: /requestAdapter\s*\(/.test(n249Source),
  callsRequestDevice: /requestDevice\s*\(/.test(n249Source),
  consumesAcquisitionReceipt: /acquisitionReceipt|resourceAcquisitionReceipt/.test(n249Source),
  bindsDeviceIdentity: /deviceIdentity|deviceToken|newDevice\s*!==\s*oldDevice/.test(n249Source),
  provesResourcesRebuilt: /resourcesRebuilt/.test(n249Source),
};

assert.equal(sourceAudit.incrementsEpochLocally, true);
assert.equal(sourceAudit.reissuesUsingIncrementedEpoch, true);
assert.equal(sourceAudit.callsRequestAdapter, false);
assert.equal(sourceAudit.callsRequestDevice, false);
assert.equal(sourceAudit.consumesAcquisitionReceipt, false);
assert.equal(sourceAudit.bindsDeviceIdentity, false);
assert.equal(sourceAudit.provesResourcesRebuilt, false);

function n249EpochOnlyRecovery(prior) {
  const next = {
    ...prior,
    resourceEpoch: prior.resourceEpoch + 1,
    epochMigrationCount: prior.epochMigrationCount + 1,
  };
  return {
    state: 'ACCEPTED_BY_EPOCH_ONLY_MODEL',
    prior,
    next,
    sameDeviceIdentity: prior.deviceToken === next.deviceToken,
  };
}

function verifyResourceEpochMigration({ prior, acquisitionReceipt }) {
  if (!acquisitionReceipt) {
    return { state: 'HOLD_RESOURCE_ACQUISITION_RECEIPT_MISSING' };
  }
  if (acquisitionReceipt.failure) {
    return {
      state: 'HOLD_RESOURCE_ACQUISITION_FAILED',
      failure: acquisitionReceipt.failure,
    };
  }
  if (acquisitionReceipt.deviceToken === prior.deviceToken) {
    return { state: 'HOLD_DEVICE_IDENTITY_UNCHANGED' };
  }
  if (acquisitionReceipt.deviceLostAlreadyResolved === true) {
    return { state: 'HOLD_NEW_DEVICE_ALREADY_LOST' };
  }
  if (acquisitionReceipt.resourcesRebuilt !== true) {
    return { state: 'HOLD_RESOURCE_REBUILD_UNPROVEN' };
  }
  if (acquisitionReceipt.latestIntentRevision !== prior.latestIntentRevision) {
    return { state: 'HOLD_LATEST_INTENT_IDENTITY_CHANGED' };
  }
  return {
    state: 'PASS_RESOURCE_EPOCH_MIGRATION_RECEIPT',
    next: {
      ...prior,
      deviceToken: acquisitionReceipt.deviceToken,
      resourceEpoch: prior.resourceEpoch + 1,
      epochMigrationCount: prior.epochMigrationCount + 1,
    },
  };
}

const prior = {
  latestIntentRevision: 2,
  resourceEpoch: 7,
  epochMigrationCount: 0,
  deviceToken: 'lost-device-A',
};

const epochOnlyFalsePass = n249EpochOnlyRecovery(prior);
assert.equal(epochOnlyFalsePass.state, 'ACCEPTED_BY_EPOCH_ONLY_MODEL');
assert.equal(epochOnlyFalsePass.next.resourceEpoch, 8);
assert.equal(epochOnlyFalsePass.sameDeviceIdentity, true);

const cases = {
  epoch_counter_with_same_lost_device: {
    expected: 'HOLD_DEVICE_IDENTITY_UNCHANGED',
    actual: verifyResourceEpochMigration({
      prior,
      acquisitionReceipt: {
        latestIntentRevision: 2,
        deviceToken: 'lost-device-A',
        resourcesRebuilt: true,
        deviceLostAlreadyResolved: false,
      },
    }),
  },
  no_acquisition_receipt: {
    expected: 'HOLD_RESOURCE_ACQUISITION_RECEIPT_MISSING',
    actual: verifyResourceEpochMigration({ prior, acquisitionReceipt: null }),
  },
  replacement_device_without_resource_rebuild: {
    expected: 'HOLD_RESOURCE_REBUILD_UNPROVEN',
    actual: verifyResourceEpochMigration({
      prior,
      acquisitionReceipt: {
        latestIntentRevision: 2,
        deviceToken: 'device-B',
        resourcesRebuilt: false,
        deviceLostAlreadyResolved: false,
      },
    }),
  },
  replacement_device_already_lost: {
    expected: 'HOLD_NEW_DEVICE_ALREADY_LOST',
    actual: verifyResourceEpochMigration({
      prior,
      acquisitionReceipt: {
        latestIntentRevision: 2,
        deviceToken: 'device-B',
        resourcesRebuilt: true,
        deviceLostAlreadyResolved: true,
      },
    }),
  },
  latest_intent_revision_changed: {
    expected: 'HOLD_LATEST_INTENT_IDENTITY_CHANGED',
    actual: verifyResourceEpochMigration({
      prior,
      acquisitionReceipt: {
        latestIntentRevision: 3,
        deviceToken: 'device-B',
        resourcesRebuilt: true,
        deviceLostAlreadyResolved: false,
      },
    }),
  },
  replacement_device_and_resources_with_same_intent: {
    expected: 'PASS_RESOURCE_EPOCH_MIGRATION_RECEIPT',
    actual: verifyResourceEpochMigration({
      prior,
      acquisitionReceipt: {
        latestIntentRevision: 2,
        deviceToken: 'device-B',
        resourcesRebuilt: true,
        deviceLostAlreadyResolved: false,
      },
    }),
  },
};

for (const entry of Object.values(cases)) {
  assert.equal(entry.actual.state, entry.expected);
}
assert.equal(cases.replacement_device_and_resources_with_same_intent.actual.next.resourceEpoch, 8);
assert.equal(cases.replacement_device_and_resources_with_same_intent.actual.next.deviceToken, 'device-B');

const result = {
  probe: 'resource_epoch_identity_probe_n250',
  status: 'PASS',
  decision: 'HOLD_N249_RESOURCE_EPOCH_RECOVERY_PROOF_INCOMPLETE',
  sourceAudit,
  counterexample: {
    description: 'The N249 epoch-only model increments 7 to 8 and reissues revision 2 while retaining the same lost device identity.',
    epochOnlyFalsePass,
  },
  cases,
  candidateDelta: {
    requiredReceiptFields: [
      'latestIntentRevision',
      'priorResourceEpoch',
      'newResourceEpoch',
      'priorDeviceIdentity',
      'newDeviceIdentity',
      'deviceLostAlreadyResolved',
      'resourcesRebuilt',
      'acquisitionFailure',
    ],
    invariant: 'A numeric resourceEpoch increment is a claim, not recovery evidence; PASS requires a distinct non-lost device identity, recreated resources, and unchanged latest-intent identity.',
    boundary: 'CPU tokens model identity only. Browser/WebGPU acquisition, device.lost timing, resource recreation, rendering, and user acceptance remain unproven.',
  },
};

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
