# KAOPU Learning Flywheel N179 — mobile gesture clarity evidence boundary

Date: 2026-10-21

## One bounded question

Does PR #336 prove that mobile rotation no longer becomes visibly blurry, or only that its configured gesture and settled sampling widths are equal?

## Current Best View

`SAMPLING_POLICY_VERIFIED__VISIBLE_MOTION_CLARITY_UNPROVEN`

PR #336 removes the explicit 128/192-to-640 sampling switch and its unit test proves `gestureWidth == settledWidth`. That is a real fix for one plausible mechanism. The present browser test, however, does not yet observe the user-visible interval that motivated the correction:

1. It captures screenshots only before the drag and after one later completed frame.
2. It dispatches 12 pointer moves, but it does not timestamp or capture any frame actually presented while those moves are in progress.
3. `requestFrame` coalesces work into one `pending` request and the renderer presents only after every tile completes. A drag may therefore show an old sharp frame for much of the gesture, cancel intermediate work, then present one sharp final frame. The current assertion can pass that trace even though motion continuity remains untested.
4. `releaseToCompleteMs` is recorded but has no acceptance bound. A constant high-resolution grid can remove a resolution jump while replacing it with long stale-frame or release latency.
5. The run is Chromium mobile emulation with SwiftShader, not a physical phone GPU/device observation.

Therefore equal configured widths must not be promoted to visible motion-clarity equivalence, responsiveness, or phone acceptance.

## Real production facts

- Target candidate: PR #336, branch `trial/kowloon-mobile-clarity-r01-20261021`, head `4077023776f5e59a26e840bd89075f0655e3c6aa`.
- The PR explicitly keeps R02 frozen and labels the mobile candidate isolated.
- `whole-building-mobile-r01/app.mjs` increments `presentedFrames` only after `renderer.render` returns; the renderer presents once after the complete tile loop.
- During an active render, new camera intents overwrite one `pending` slot; cancellation is revision-based. This is request coalescing, not proof of visible intermediate frames.
- `mobile-field-browser.py` waits only for `presentedFrames > before` after pointer release, checks every retained frame width, and captures `mobile-before.png` plus `mobile-after-drag.png`.
- No workflow run exists yet for commit `4077023`; claimed local CPU tests are not a GitHub production CI receipt.
- Default-branch searches found no existing regression matching mobile gesture blur, motion clarity, presented-frame continuity or same-camera settled replay.

## Candidate regression and executable receipt rule

Candidate `MOBILE-GESTURE-CLARITY-TRANSITION-001` is added but remains inactive. A valid receipt must bind source commit, CSS viewport, DPR, physical device or emulation, the pointer trace, each actual present timestamp, camera-at-present and sampling-grid-at-present.

For sampled intermediate cameras, replay a settled render at the exact same camera and grid. Compare the motion frame with that settled reference under an explicitly declared equality or image-difference rule. This removes camera motion as a confounder: the question becomes whether motion mode degraded the image for the same view.

Report inter-present gaps and release-to-complete latency separately. Do not invent a global latency threshold in this learning branch; the affected Mother must bind a local limit from an accepted baseline or explicit user acceptance.

## Minimal falsifiable next experiment

On the existing 390x844, DPR 3 trace:

1. instrument the actual final presentation call, not request dispatch;
2. retain at least the first, middle and last frames actually presented before pointer-up, with timestamps and camera states;
3. after the gesture, replay each retained camera in settled mode with identical source and sampling grid;
4. compare each motion frame to its same-camera settled reference and record the first differing pixel/metric;
5. report inter-present gaps and release latency, then repeat the same receipt on one named physical phone.

The hypothesis is falsified if no frame is presented during the gesture, any same-camera pair violates the declared clarity rule, or the physical-device run fails its bound.

## Routing decision

This is a local verification candidate for the Kowloon building Mother, not a global OS or gate change. Targeted Mother questions:

1. Is visible motion clarity the current real problem, rather than only removal of the width switch?
2. Does an existing test already bind actual presentation timestamps and camera-at-present?
3. Are same-camera settled replays the smallest useful comparison for this renderer?
4. What local inter-present and release-latency bounds should be tied to the accepted mobile baseline?

Lifecycle after routing: `POSTED` only. `ACKNOWLEDGED / IMPLEMENTED / GATE-RUN / ADOPTED / USER-ACCEPTED` remain false for this learning increment. PR #336 remains an isolated implementation candidate with its own current evidence. No production Mother branch, `main`, R2 or global gate is modified.
