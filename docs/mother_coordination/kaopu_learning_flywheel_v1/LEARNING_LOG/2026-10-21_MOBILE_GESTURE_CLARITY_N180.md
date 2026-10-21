# KAOPU Learning Flywheel N180 — does the public #336 run close N179?

Date: 2026-10-21

## One bounded question

Does PR #336's new public-browser run close N179's gap by proving clear frames are actually presented during the drag?

## Current Best View

`STALE_RELEASE_PREEMPTION_VERIFIED__ZERO_MOTION_FRAMES_OBSERVED`

No. The new production evidence verifies an important narrower correction, but it also supplies the first direct counterexample to a continuous-motion claim.

## Exact production receipt

- PR #336 current head: `b64d4d3bc385f0759a54c8bfc17371c74a828805`.
- Published runtime: `9c466ef1108225cbe2b56041b9315ce44f5f5693`.
- Public workflow run `39598267624`: completed successfully.
- Artifact `12346075176`, digest `sha256:305da19d5344051cff707dd9b17adda84cb0488f93fc0843a99cb57fc2792b52`.
- Public exact-file readback: 22 files.
- Emulated mobile viewport: 390x844 CSS, DPR 3; gesture and settled sampling are both 585x497.

The artifact's actual frame timeline is decisive:

- last pre-gesture frame presented at 4072.2 ms;
- pointer gesture ran from 4359.1 ms to 5226.5 ms (867.4 ms);
- **frames presented during that gesture: 0**;
- latest intent 13 was requested at 5152.3 ms and presented at 7991.0 ms;
- release-to-complete was 2774.8 ms;
- one superseded render was cancelled and one release preemption occurred.

The new assertions correctly bind the final frame to the latest intent/camera and reject any stale intent presented after release. Thus the release-time stale-camera fix is `IMPLEMENTED + GATE-RUN` for this Chromium ANGLE/SwiftShader trace.

It does not prove motion-frame clarity, because no motion frame existed to compare. It also does not prove responsiveness: the measured latency has no acceptance bound, and the run is not a physical phone.

## Regression decision

Update existing `MOBILE-GESTURE-CLARITY-TRANSITION-001`; do not create a duplicate case. The positive control closes only this subclaim:

`NO_STALE_PRESENTATION_AFTER_RELEASE`

The parent correction stays open for:

`VISIBLE_FRAME_DURING_GESTURE + SAME_CAMERA_SETTLED_EQUIVALENCE + BOUNDED_LATENCY + PHYSICAL_DEVICE`

## Minimal falsifiable next experiment

Keep the same bound source, 390x844/DPR3 trace and fixed grid. Add a renderer mode capable of presenting completed tiles/frames while the pointer is down, then require:

1. at least one actual presented frame between pointer-down and pointer-up;
2. retained presentation timestamp, intent and camera for every sampled motion frame;
3. same-camera settled replay under the same sampling grid;
4. declared clarity comparison and local inter-present/release bounds;
5. one named physical-phone replay kept separate from emulation.

If the renderer intentionally chooses freeze-until-complete instead, it must be described as that policy and accepted on bounded latency; it must not be called continuous motion clarity.

## Routing state

This is a scoped evidence update for the Kowloon building Mother. Production stale-release handling is `IMPLEMENTED + GATE-RUN`; the parent mobile-gesture clarity regression remains inactive and unclosed. Learning state after routing is `POSTED` only. No Mother acknowledgement, adoption or user acceptance is inferred from a production commit. No production branch, main, R2 or global gate is modified.
