# Learning Flywheel N329 — ZX85 uninterrupted causal demo trace

## Bounded question

Can the existing N321 source-bound control regression reject a stitched or causally disconnected cab demonstration even when every individual control, motion, engine sound and vibration appears somewhere?

## Real unresolved failure

Fresh user production feedback requires one complete, uninterrupted demonstration from start to finish, including cab controls, pedals/levers, boom/arm/bucket actions, and engine vibration/sound after ignition. N319 verifies the pilot shut-off interlock; N321 verifies individual control mappings. Neither proves that the visible and audible outcomes came from one fresh live run without cuts, reloads, loop resets, independent animations or prerecorded substitution.

## Dedup decision

N321 is refined in place. N319 remains an applicable prerequisite and is not duplicated. N324 contributes event-to-observable timing semantics without reopening the LCD latency problem. N328 contributes the authority-owned expected inventory pattern so the Producer cannot pass by deleting an action from both its declaration and trace.

Teacher status: `NO_NOVELTY`. Existing KAOPU Current Best View already contains the required causal, freshness, authority/receipt separation and provenance principles; the novelty is making their missing composition executable for the user's new uninterrupted-demo correction.

## Candidate contract

The Task Anchor or independent verifier owns the exact action inventory and digest. The receipt must bind:

- one `sourceHead`, `artifactDigest`, `runId` and `segmentId`;
- monotonic command, observable and event-time coordinates without cut/reload/loop/reset;
- `LIVE_3D_RUNTIME` and `mediaSubstitute=false`;
- ignition before engine-running feedback; engine sound and vibration only after the engine-running transition;
- pilot unlock after engine start and before any motion;
- every control input to a later same-run observable with source-bound target and semantic delta;
- neutral stop before pilot lock and engine stop;
- exact authority-owned action coverage, with missing and extra IDs rejected separately.

## Minimal falsifiable replay

The probe retains the ten N321 mapping fixtures and adds nine uninterrupted-trace suites: valid same-run trace; Producer scope shrink; unanchored action; stitched segment; clock reset; video substitution; engine feedback before ignition; missing input-to-observable lineage; and inventory-subject substitution.

Production replay is `NOT_RUN`. The current production source head, action IDs, artifact digest, real event trace, browser/device and user acceptance remain `UNKNOWN`.

## Boundary

Radio channel/recording and rights, air-conditioning implementation, sound fidelity, production geometry and asset changes are outside this round. No main, R2 OS, production Mother branch, public Site or production asset is changed.

## Decision

`CANDIDATE_N321_REFINED_WITH_SINGLE_RUN_CAUSAL_TRACE_HOLD_PRODUCTION_REPLAY_UNVERIFIED`

Lifecycle after targeted routing: `POSTED=true` — #91 comment `7053424000`; `ACKNOWLEDGED=false`; `IMPLEMENTED=candidate regression refinement only`; `GATE-RUN=true (fixture only)`; `ADOPTED=false`; `USER-ACCEPTED=false`.
