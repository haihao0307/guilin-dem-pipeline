# KAOPU Learning Flywheel N250 — resource epoch identity proof

- Date: 2026-11-08 (Asia/Shanghai)
- Question type: technical failure mechanism
- Bounded question: does N249 prove that `resourceEpoch 7 → 8` represents a newly acquired usable device and rebuilt resources, or can a counter increment falsely label the same lost resource as recovered?
- Current production subject remains `haihao0307/KaoPu-Engine@af1ffb7516de642c17ac61f33b9104482394073a`.
- Applicable regression: extend `CANDIDATE_LATEST_PENDING_REQUEST_SURVIVES_INFLIGHT_FAILURE_001`; do not create a duplicate case.

## Baseline read

- Coordination main remains `34553e93d75a427c10dbf5b0077d42f8cdda0a63`.
- Root AGENTS, R2 OS, reference replication gate, and freshness gate remain the authoritative baseline.
- #91 latest before this run was N249 `POSTED`; no Engine/Player `ACKNOWLEDGED`, production correction, adoption, or user acceptance exists.
- #63 has no newer applicable production feedback.
- N249 teacher remains `TEACHER_CANDIDATE / AUDITION`; this run does not promote or replace it.

## Exact evidence audited

N249 probe subject:

- path: `PROBES/webgpu_device_loss_epoch_probe_n249.mjs`
- SHA-256: `442416e3ea591f0c40c92ae6f09e71c6bec1acd53d1574fe790f24f77ad8dba3`

Source audit found that the `device-lost/unknown` path:

1. executes `this.epoch += 1`;
2. reissues the pending revision with that incremented number;
3. does not call `requestAdapter()` or `requestDevice()`;
4. does not consume a resource-acquisition receipt;
5. does not bind old/new device identity;
6. does not prove resources were recreated.

Therefore N249's CPU PASS is valid only as an epoch-state-machine experiment. It is not evidence of resource recovery.

## New deterministic counterexample

Starting state:

- latest intent revision: 2
- resource epoch: 7
- device identity: `lost-device-A`

The N249-style transition increments the number to epoch 8 and accepts reissue while the device identity remains `lost-device-A`. The gate therefore produces a false positive if `resourceEpoch` is treated as recovery evidence rather than a claim.

Decision:

`HOLD_N249_RESOURCE_EPOCH_RECOVERY_PROOF_INCOMPLETE`

This does not invalidate N249's draw-local preservation result or the WebGPU teacher facts. It narrows only the recovery claim.

## Falsifiable Candidate delta

A device-loss recovery transition may reach `PASS_RESOURCE_EPOCH_MIGRATION_RECEIPT` only when one explicit acquisition receipt binds:

- `latestIntentRevision`
- `priorResourceEpoch`
- `newResourceEpoch`
- `priorDeviceIdentity`
- `newDeviceIdentity`
- `deviceLostAlreadyResolved`
- `resourcesRebuilt`
- `acquisitionFailure`

Required invariants:

1. `newDeviceIdentity != priorDeviceIdentity`;
2. the new device is not already known lost;
3. required resources are rebuilt before r2 is submitted;
4. the reissued latest-intent identity is unchanged;
5. the new epoch is derived from a successful receipt, not written first and justified afterward.

The Candidate is falsified if the same device identity, a missing/failed receipt, an already-lost replacement, missing resource rebuild, or changed latest intent can still produce PASS.

## Isolated gate result

Probe: `resource_epoch_identity_probe_n250.mjs`

Result: `PASS` for six deterministic cases:

1. same lost device with incremented epoch → `HOLD_DEVICE_IDENTITY_UNCHANGED`;
2. no acquisition receipt → `HOLD_RESOURCE_ACQUISITION_RECEIPT_MISSING`;
3. replacement device without resource rebuild → `HOLD_RESOURCE_REBUILD_UNPROVEN`;
4. replacement device already lost → `HOLD_NEW_DEVICE_ALREADY_LOST`;
5. changed latest-intent revision → `HOLD_LATEST_INTENT_IDENTITY_CHANGED`;
6. distinct non-lost device, rebuilt resources, same intent → `PASS_RESOURCE_EPOCH_MIGRATION_RECEIPT`.

Probe SHA-256: `f5040f01f637688742ff7ac3d922734752230e9844d930ab319c04faf397ee2a`

Result SHA-256: `b7a79aaa01b9af221714b82716bbb915fd2bf548d742cf3bde0d745565091ac4`

## Boundary and routing

- CPU tokens model identity only; they do not prove WebGPU acquisition, `device.lost` timing, actual resource recreation, rendering, FPS, or user acceptance.
- No automatic retry count is adopted by this result.
- Next admissible trial is Engine/Player only: inject an acquisition authority into the dispatcher, bind its receipt to r2, and replay one failed, one same-device, and one valid-replacement path in a real browser/WebGPU environment.
- Candidate status: isolated `IMPLEMENTED + GATE-RUN`.
- Routing status after issue post: `POSTED`; no `ACKNOWLEDGED` until a real Mother reply exists.
- Production `IMPLEMENTED / ADOPTED / USER-ACCEPTED`: false.
- No change to main, R2, production Mother branch, player source, browser deployment, or production asset.
