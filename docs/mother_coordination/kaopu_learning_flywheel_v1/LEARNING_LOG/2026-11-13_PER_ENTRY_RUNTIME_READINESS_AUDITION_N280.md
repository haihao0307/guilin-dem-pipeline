# KAOPU Learning Flywheel N280 — Per-entry runtime readiness audition

- Date/time: 2026-11-13 03:44–04:02 Asia/Shanghai
- Current main: `2573fb0b928feabfe528fe4901e88ef8b3a80a13` (unchanged)
- Parent learning head: `1baf7eeaa0d97e02a4218970265a7ccf6ae3784d`
- Selected lane: institutional method / external methodology teacher
- Scope: learning-only; no Site, production Mother, main, R2, public route, access policy or production asset changed.

## One bounded question

How can a machine catalog entry carry machine-verifiable identity and readiness so that a successful site deployment, a visible catalog row, or a sibling machine's success can never be mistaken for this exact machine reaching interactive runtime?

## Real production failure

#91 Mother coordination N280 supplies one real affected-Mother replay:

- Site v169 deployment succeeded.
- The directory shows a ZAXIS 85USB row.
- No canonical asset digest → route → served-version mapping exists for that row.
- Pre-v169 evidence includes bare module resolution failure and a stalled model load, so it cannot prove v169 readiness.
- The public route remains owner-only.
- Decision remains `HOLD_GATE_FAIL`.

This is not a claim that v169 itself reproduced the pre-v169 module failure. It is a freshness-bound gap: v169 has no current per-entry runtime receipt.

## Teacher audition

Candidate: Kubernetes startup/readiness/liveness probe semantics.

Teacher status: `TEACHER_CANDIDATE`

Lifecycle: `AUDITION` only; not PROBATION, ACTIVE_TEACHER, ADOPTED or USER-ACCEPTED.

### What it knows beyond Current Best View

The current N269 whole-machine gate distinguishes a complete machine from parts, static evidence and HTTP-only delivery. Kubernetes contributes one narrower state discipline not yet explicit there:

1. readiness is keyed per workload/container, not inherited from a deployed service or a sibling;
2. startup success and ongoing readiness are distinct;
3. readiness is revocable through the whole lifecycle;
4. `UNKNOWN` does not become success;
5. failed readiness removes only that exact instance from serving endpoints while the process may keep running.

The transferable principle is the state model, not Kubernetes infrastructure or code.

### Screening

1. Provenance: official Kubernetes documentation and `kubernetes/kubernetes` repository.
2. Activity: repository was not archived; observed master commit `c80effaef8c4cf7ce6493a186c8abda5b69fcbed` dated 2026-11-12.
3. Reproducibility: concrete Go manager implementation plus `prober_manager_test.go`; the test creates distinct startup/readiness/liveness workers keyed by workload and container.
4. License: Apache-2.0. No Kubernetes code was copied into KAOPU.
5. Relevance: direct as a state/verification model for per-machine catalog readiness; not a WebGPU or excavator implementation teacher.
6. Novelty: per-entry, revocable, fail-closed readiness and startup gating are a real extension of N269's whole-machine scope gate.
7. Dependencies/cost: independent JSON/state-machine fields are cheap; adopting Kubernetes itself would be irrelevant and excessive.
8. Failure boundary: analogy only. It does not prove module resolution, asset decoding, GPU completion, visual correctness, performance, public access or user acceptance.

## Minimal falsifiable replay

Executed: `node n280_machine_entry_readiness_probe.mjs`

Result: **8/8 assertions PASS**.

| Control | Expected result |
|---|---|
| v169 catalog row only | `HOLD_ENTRY_STARTUP_UNKNOWN` |
| unresolved bare module | `HOLD_ENTRY_STARTUP_FAILED` |
| prior served-version receipt | `HOLD_ENTRY_VERSION_MISMATCH` |
| sibling machine ready | ZAXIS remains `HOLD_ENTRY_STARTUP_UNKNOWN` |
| catalog digest differs from canonical digest | `HOLD_ENTRY_ASSET_IDENTITY_MISMATCH` |
| runtime ready but owner-only | `HOLD_ORIGINAL_WORKBENCH_NOT_PUBLISHED` |
| exact identity + current ready + all capabilities + public | `WHOLE_MACHINE_OBSERVATION_READY_CANDIDATE` |
| later readiness regression | `HOLD_ENTRY_NOT_CURRENTLY_READY` |

## Candidate refinement to N269

Do not create a new regression. Extend `WHOLE-MACHINE-NOT-PARTIAL-DELIVERY-001` with per-entry fields:

- `artifactId`
- `route`
- `assetDigest`
- `servedVersion`
- `startupProbe.result = SUCCESS | FAILURE | UNKNOWN`
- `startupProbe.moduleGraphResolved`
- `startupProbe.fatalConsoleErrors`
- `startupProbe.lastCompletedFrame`
- `startupProbe.currentReadiness = READY | NOT_READY`
- capability results for visible / rotatable / selectable / adjustable
- exact public-access and acceptance-layer states.

State must be keyed by `artifactId + servedVersion + assetDigest`. A site-level boolean and sibling receipt are forbidden substitutes.

## Boundaries

- `lastCompletedFrame` only asserts a recorded completion event. It is not proof of visual correctness, GPU performance or presentation to the user.
- The synthetic probe did not run the ZAXIS route.
- N280 coordination is a historical/receipt replay, not a current browser startup run.
- Thresholds and timing policy remain task-specific.
- No change to Site access policy or production implementation was authorized.

## State

- External method: `TEACHER_CANDIDATE / AUDITION`
- Candidate regression refinement: `IMPLEMENTED`
- Synthetic replay: `GATE-RUN`
- Real affected-Mother historical replay: `GATE-RUN`
- Routing: pending #91 comment
- Mother ACK: `UNKNOWN`
- Production IMPLEMENTED/GATE-RUN: false
- ADOPTED: false
- USER-ACCEPTED: false
