# N153 — Motion handoff object custody and continuity

## Bounded question

Does Motion R03 prove that one object is transferred causally and continuously from giver to receiver, rather than only showing contact-distance checks, owner event labels and a final receiver-held frame?

Decision: current R03 remains a valid scoped kinematic candidate, but the reusable handoff gate is `HOLD_HANDOFF_TRANSFER_INVARIANTS_UNBOUND`. This is an evidence hold, not a finding that the visible R03 object currently teleports or duplicates.

## Existing real production evidence

- Motion R03 exact reviewed subject is `fde66f8246cc49f604e5deb24fcc4128d8c9772b` in draft PR #268.
- `InteractionRig.pose('give-object')` authors one object path, computes giver/receiver grips, and assigns `GIVER -> SHARED -> RECEIVER` from fixed time thresholds plus `receiverReady`.
- `verify.cjs` samples the sequence, records owner-change events, checks hand-surface metrics, checks one final `owner==='RECEIVER'` frame and checks one not-ready endpoint.
- The preserved QA does not assert: stable object identity/count on every frame; contact-valid custody transitions; object translation/rotation continuity at transition frames; or the full not-ready counterfactual.

The missing proof matters because all existing endpoint checks can remain green while a future implementation releases early, duplicates an object for a shared phase, or snaps transforms when changing the controlling hand.

## Comparison with current KAOPU controls

R03 already does several important things correctly: it uses a full second R04, keeps one authored prop in the scene, reports explicit custody states, retains a receiver-not-ready mode, samples contact metrics, and does not claim force simulation. N153 does not replace those checks.

No existing regression case in the learning branch covers per-frame object custody and transform continuity for a two-actor handoff. Generic transfer, handoff-inventory and freshness cases do not bind motion-state causality, so this is not a duplicate.

Teacher decision: `NO_NOVELTY`. This bounded delta comes directly from exact production implementation and QA evidence; no external teacher is needed to establish the missing invariant.

## Falsifiable hypothesis

For an exact sampled handoff, binding one stable object identity/count, a monotonic custody state machine, contact-valid custody transitions, task-declared per-frame transform bounds, and a full not-ready counterfactual—plus injected early-transfer, transform-jump and duplicate-object controls—will reject endpoint-valid but causally invalid handoffs.

The hypothesis is falsified if any injected control passes, or if a valid exact R03 sequence cannot satisfy declared task-local bounds without changing the visible motion.

## Minimal replay

`CANDIDATE-MOTION-OBJECT-CUSTODY-CONTINUITY-001` replays eight fixtures:

1. current R03-style QA with events and final-frame evidence only;
2. a final receiver frame without an exact frame timeline;
3. owner events without contact-bound transitions;
4. receiver ownership before receiver contact;
5. a transform jump at the shared-to-receiver boundary;
6. duplicate object instances in the shared phase;
7. release when the recipient is not ready;
8. a complete scoped receipt with all three positive controls detected.

Classifier result: `8/8`. See `PROBES/motion_object_custody_continuity_result_n153.json`.

## Candidate executable object

For Motion handoff tasks only, add a verifier receipt with the exact subject/action and per-frame timeline digest; one stable object ID/count; object-transform digest and declared step limits; custody/contact/readiness arrays; transition frames; full not-ready counterfactual; and three test-only controls. Promotion remains fail-closed until all are bound and the controls are detected.

## Scope and adoption

- Candidate for Motion R03-style two-actor kinematic handoffs; not a global OS rule.
- Does not change PR #268, its code, visuals, thresholds, branch, or parent lineage.
- Does not certify force closure, friction, mass, soft tissue, arbitrary objects, performance, artistic naturalness or user acceptance.
- Motion Mother chooses task-local transform-step limits; N153 introduces no universal numeric threshold.
- Route only to Motion PR #268. Lifecycle before routing: `POSTED=false`; `CLASSIFICATION-GATE-RUN=true (8/8)`; `ACKNOWLEDGED / IMPLEMENTED / MOTION-PRODUCTION-GATE-RUN / ADOPTED / USER-ACCEPTED=false`.
- Effect KPIs: all comparative rates, user-correction counts and time-to-legal-candidate remain `unknown`.
