# Ocean Mother R0199B Browser Validation Note

Date: 2026-09-13
Branch: `work/ocean-r0199-field-cache-20260913`

R0199B is an isolated performance candidate derived from the R0198 / R018.11 frozen visual truth. It is not a replacement visual mother and is not production-approved.

## Real browser gate

The candidate was executed in Chromium 144 under Xvfb using ANGLE + Mesa llvmpipe with WebGL2 and `EXT_color_buffer_float` available. The browser gate used a 640x420 viewport, fixed world time, and the six frozen cameras: overview, top, shore, breaker, rocks, and fire.

Observed gate state:

- 1024 terrain field cache was actually active.
- No browser console or page runtime errors were observed.
- The steady-state rendering gain remained material (greater than the 1.5x acceptance floor used for the threshold sweep).
- First-ready time is slower because the 1024 field is baked once before steady-state rendering.
- The candidate is not pixel-identical to R0198. Residual differences are small in magnitude but widespread enough that they must not be silently treated as frozen-visual identity.

## Decision

- `performanceCandidate = true`
- `browserValidated = true`
- `visualApproved = false`
- `productionApproved = false`

R018.11 / R0198 remains the visual authority. R0199B must stay isolated until real mobile/hardware-GPU checks cover startup cost, sustained FPS, thermal behavior, and the six frozen views.

The next visual experiment must branch from the frozen visual truth rather than stacking visual work on top of an unapproved performance approximation. The handoff order remains: reduce blocky foam first, then improve curling-wave lift/lip/fall, while keeping rocks, sand, island, fire/smoke, and controls frozen.

A complete local continuation package was produced as `Ocean_Mother_R0199B_Performance_Candidate_2026-09-13.zip`, containing the exact R0198 baseline, R0199B source, threshold sweep, browser A/B evidence, six-view screenshots, and reproducible test scripts.