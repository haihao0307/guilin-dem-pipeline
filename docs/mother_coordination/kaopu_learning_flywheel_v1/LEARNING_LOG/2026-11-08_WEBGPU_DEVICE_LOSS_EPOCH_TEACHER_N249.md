# KAOPU Learning Flywheel N249 — WebGPU device-loss epoch teacher audition

- Date: 2026-11-08 (Asia/Shanghai)
- Bounded question: when an older frame fails while a newer request is pending, how should `requestRevision × resourceEpoch × failureScope` preserve the latest intent across a draw-local failure versus WebGPU device loss, without creating an unbounded automatic retry loop?
- Trigger: `CANDIDATE_LATEST_PENDING_REQUEST_SURVIVES_INFLIGHT_FAILURE_001`
- Production subject: `haihao0307/KaoPu-Engine@af1ffb7516de642c17ac61f33b9104482394073a`
- Baseline: R2 remains the Current Best View. This record is Candidate evidence only.

## Current failure and gap

The current scheduler clears `pending` and rejects every waiter in its `catch` path. In the deterministic history replay `r1 in-flight → r2 pending → r1 rejects`, the newer intent is silently dropped. Existing KAOPU evidence already establishes that the latest intent must survive or be explicitly reissued. The remaining bounded gap is classifying failure scope and resource lifetime precisely enough to avoid both silent loss and blind retry.

## External teacher audition

Teacher: W3C GPUWeb WebGPU device-loss semantics plus the official GPUWeb CTS.

Primary sources checked on 2026-11-08:

- WebGPU specification, device loss and `GPUDevice.lost`: https://www.w3.org/TR/webgpu/
- GPUWeb specification repository: https://github.com/gpuweb/gpuweb
- GPUWeb CTS repository: https://github.com/gpuweb/cts
- GPUWeb error-handling design history: https://github.com/gpuweb/gpuweb/blob/main/design/ErrorHandling.md
- WebGPU specification license: https://github.com/gpuweb/gpuweb/blob/main/LICENSE.md
- GPUWeb CTS license: https://github.com/gpuweb/cts/blob/main/LICENSE

### What it knows beyond KAOPU Current Best View

On one explicit question—whether an in-flight failure invalidates only one draw or the entire GPU resource generation—the WebGPU model adds a machine-readable boundary:

1. Ordinary scoped operation failures and device loss are not the same failure domain. Device loss is exposed separately through `GPUDevice.lost`; after loss, the device and resources created from it are invalid.
2. `GPUDeviceLostReason` distinguishes intentional `destroyed` loss from `unknown` loss. `destroyed` is terminal for that device by intent; `unknown` may justify application-controlled reacquisition, but the specification does not promise that reacquisition succeeds.
3. Recovery requires a newly acquired device and recreated resources. Therefore a successful recovery is a new `resourceEpoch`; an old-epoch completion cannot be accepted into the new epoch.
4. The specification and CTS do not define KAOPU's retry budget, backoff, or latest-request scheduling policy. Those remain local Candidate design and require falsification.

This is new relative to the current KAOPU evidence because the existing candidate identifies `resourceEpoch/RETRY_REQUIRED` but does not yet bind `destroyed` versus `unknown`, device-wide invalidation, and stale old-epoch completion rejection to explicit state transitions.

### Teacher screening

1. Source/provenance: W3C GPU for the Web Working Group specification and the official `gpuweb` repositories.
2. Maintenance: specification/CTS repositories and device-loss tests show current issue and change activity; checked 2026-11-08.
3. Reproducibility: normative algorithms plus runnable CTS exist. This run did not execute browser/GPU CTS; it executed only an isolated CPU state-machine audition.
4. License/rights: specification repository uses W3C Software and Document licensing; CTS uses a permissive BSD license. Any copied code must retain the applicable notice.
5. Direct relevance: high for distinguishing draw-local failure from resource-generation invalidation in the current Engine scheduler failure.
6. Novelty: the explicit device-loss reason and whole-resource-generation boundary add knowledge described above.
7. Dependencies/cost: full conformance requires a WebGPU implementation, browser/device access, and recreated GPU resources; CPU replay cannot validate driver or browser behavior.
8. Failure risks: not demo-only, but specification/CTS versions evolve; device reacquisition can fail or repeatedly return an unusable device, so the teacher does not justify an unlimited retry loop.

- Candidate status: `TEACHER_CANDIDATE`
- Lifecycle: `AUDITION`
- Mother routing status before issue receipt: `NOT_QUERIED/UNKNOWN`

## Falsifiable Candidate

For a single Engine/Player Mother trial, add these state fields to the Task Anchor or scheduler contract:

- `requestRevision`
- `resourceEpoch`
- `failureScope = draw-local | device-lost`
- `deviceLostReason = destroyed | unknown | null`
- `epochMigrationCount`
- `epochMigrationBudget`

Candidate gate behavior:

1. `draw-local`: reject only waiters covered by the failed revision; preserve and schedule a newer pending revision while the resource epoch remains valid.
2. `device-lost/destroyed`: invalidate the epoch and stop; do not automatically reissue.
3. `device-lost/unknown`: emit an explicit `RETRY_REQUIRED` receipt for the latest still-valid intent. Reissue only after a new device/resources produce a strictly newer `resourceEpoch`.
4. Accept completion only when its `resourceEpoch` equals the current epoch and its revision is not older than the accepted revision.
5. Trial-only loop bound: at most one automatic epoch migration per intent, then emit `RETRY_EXHAUSTED`. This number is a KAOPU Candidate, not a WebGPU fact.

The Candidate is falsified if any of the following occurs: a newer request disappears without a terminal receipt; an old-epoch result becomes accepted; `destroyed` triggers automatic recovery; or repeated `unknown` loss produces an unbounded loop.

## Isolated CPU replay

Probe: `webgpu_device_loss_epoch_probe_n249.mjs`

Result: `PASS` for five deterministic cases:

1. draw-local failure rejects r1 and evaluates r2 in the same epoch;
2. unknown device loss emits `RETRY_REQUIRED`, migrates r2 once from epoch 7 to 8, and accepts r2 only in epoch 8;
3. destroyed device loss is terminal and does not reissue;
4. repeated unknown loss stops at the one-migration trial budget with `RETRY_EXHAUSTED`;
5. a late epoch-7 completion cannot overwrite epoch 8 state.

Probe SHA-256: `442416e3ea591f0c40c92ae6f09e71c6bec1acd53d1574fe790f24f77ad8dba3`

Result SHA-256: `f97f0de0db90b603320edefacad8d1f601b258282035f401e8d03b361309067b`

## Decision and boundary

- Teacher decision: `TEACHER_CANDIDATE`, remain in `AUDITION`.
- Candidate implementation status: isolated `IMPLEMENTED` and `GATE-RUN` only.
- Production status: not implemented, not adopted, not user accepted.
- No global OS or gate change.
- No production Mother branch, production asset, main, or R2 mutation.
- Not proven: browser conformance, real GPU/device recovery, Engine integration, 2K/FPS behavior, production receipt, or user acceptance.
- Next admissible step: route only to the Engine/Player Mother and run the same replay against its real dispatcher/device-loss boundary with a rollback point.
