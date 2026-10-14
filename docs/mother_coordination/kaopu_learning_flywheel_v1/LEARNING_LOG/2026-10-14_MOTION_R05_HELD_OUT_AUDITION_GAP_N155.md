# N155 — Motion R05 is not yet a held-out transition audition

## Bounded question

Does Motion R05 PR #270 implement the N154 LaFAN1 teacher audition by proving transition quality against a held-out exact motion window, or does it only verify the analytic generator's self-consistency?

Decision: R05 contains a real, scoped continuity implementation and stronger transition QA, but it does not yet satisfy `CANDIDATE-MOTION-HELD-OUT-TRANSITION-BENCHMARK-001`. Current state is `MOTION_CONTINUITY_SELF_CHECK_VERIFIED__HOLD_TRANSITION_GROUND_TRUTH_WINDOW_UNBOUND`. LaFAN1 remains `TEACHER_CANDIDATE`; N154 does not advance to `AUDITION`.

## Existing real production evidence

Exact production lineage inspected:

- PR #270 head/handoff: `8d0860881f34cd6d459b1099028f56dfc7b70a2c`;
- R05 source subject: `c95e49718bf6fbe9989eba5743a731c488b5de49`;
- immutable tested build: `bd1dbbf16ef98dd9e5f24400db1ab96e2d9d610f`;
- runtime HTML SHA-256: `84ad854e00457d175813ec5fc68382cd1185e871ea72acf47fe66ef7b437258c`.

Observed positive evidence:

- `Continuity.mjs` independently implements root placement, phase search, velocity-aware inertial offsets, fixed-bone FK and temporary foot support; it explicitly does not claim Ubisoft's trained network.
- `continuity-qa.cjs` exercises 18 exact transitions. It checks initial/final root and velocity continuity, angular velocity, bone error, maximum per-frame joint step, backwards motion, sole-floor proxy, deterministic seek, mesh/material preservation and a baseline start-velocity error.
- `phase-sweep.mjs` exercises 96 walk/run/idle phase choices on the extracted native person fixture and checks maximum joint step plus sole-floor proxy.
- Public R05 evidence records about 58.54 FPS and 36.5 ms P95 for that browser run, with the documented environment boundary retained.

These are meaningful improvements over R03. They support a scoped engineering claim that R05 preserves continuity invariants on the tested switch set.

## Exact missing proof

R05 does not:

1. choose one legally usable exact source sequence and hide a known middle window;
2. preserve the hidden middle frames as ground truth;
3. reconstruct that same interval and compare the whole window to truth;
4. compute held-out L2 rotation, held-out L2 global position or NPSS;
5. compare full-window Zero-Velocity / interpolation / R05 ordering;
6. inject a frame jump and stance-foot slide to prove the verifier rejects them.

The existing `baselineStartVelocityErrorMPS` compares only the switch-start velocity of the ordinary blend against the inertial method. It is not a full-window held-out baseline. The current `phaseCost` and thresholds are also used by the generator when selecting phases, so passing them is not independent evidence of reference-motion naturalness.

## Comparison with N154 and current OS

N154 deliberately separated two claims:

- generator self-consistency and contact invariants;
- resemblance to a known natural transition over time.

R05 materially improves the first. It does not yet test the second. Treating the LaFAN citation or successful R05 QA as automatic teacher audition would violate R2 claim scope and Producer/verifier separation.

No new regression case is created. The existing `CANDIDATE-MOTION-HELD-OUT-TRANSITION-BENCHMARK-001` is updated with one exact R05 fixture.

## Falsifiable hypothesis and minimal next test

Hypothesis: an independent verifier can take one existing KAOPU-owned/legally usable CMU-derived continuous clip, hide 5/15/30 middle frames, reconstruct them with Zero-Velocity, interpolation and the R05 method, and obtain a stable ordering on held-out L2 rotation/position and NPSS while also rejecting injected frame-jump and stance-foot-slide controls.

It is falsified if the ordering is unstable across exact skeleton/rate normalization, if either injected control passes, or if R05 cannot beat at least one declared weak baseline on the predeclared clip/window without changing thresholds after seeing results.

This is an evaluation-only audition. It must not change the R05 generator during the run, import LaFAN bytes/code, invent universal realism thresholds, or use the Producer's phase-selection cost as the verifier verdict.

## Historical replay

Updated Candidate fixtures now include the exact R05 self-consistency receipt without a held-out reference window. Classification replay: `9/9`.

## Scope and lifecycle

- Does not reject R05 or undo its 18-switch / 96-phase continuity evidence.
- Does not claim R05 is visually unnatural; it limits the stronger naturalness/reference claim.
- Does not modify PR #270, Motion source, thresholds, main, R2 or production lineage.
- Lifecycle before routing: `POSTED=false`; `CLASSIFICATION-GATE-RUN=true (9/9)`; `ACKNOWLEDGED / AUDITION / PROBATION / ACTIVE_TEACHER / IMPLEMENTED-N154 / MOTION-PRODUCTION-GATE-RUN / ADOPTED / USER-ACCEPTED=false`.
- Effect KPIs remain `unknown`; no N154-compliant production audition has run.
