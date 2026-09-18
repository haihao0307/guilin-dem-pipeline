# Landscape Mother Formation Event Field V1

This is an additive diagnostic candidate on top of the existing Landscape Mother R5/K2 line. It does not replace the accepted macro shape or claim a final karst scene.

## Implemented kernel

- Domain-warped fBm coordinates
- ridged fBm and turbulence fracture field
- Worley cellular cavity candidates
- geology/slope/cliff/curvature/drainage gates
- fracture, cavity, sinkhole, collapse, wet-flow, deposition, rock-exposure and oxidation channels
- correlated geometry and material channels
- exact `heightDelta = 0` when `protectedTruthMask > 0.5`
- exact neutral-geometry diagnostic with event masks still visible
- integer-harmonic periodic angular field, so theta 0 and 2π are identical

## Browser workbench

`index.html` is a WebGL2 diagnostic workbench. It shows a synthetic karst-like height field only to verify event-channel behavior. It is not DEM truth and must not be promoted as a final Guilin scene.

## Test

```bash
node formation-event-field.test.mjs
```

The test checks periodic continuity, determinism, truth protection, neutral geometry, bounded outputs, event gating and a generated grid.
