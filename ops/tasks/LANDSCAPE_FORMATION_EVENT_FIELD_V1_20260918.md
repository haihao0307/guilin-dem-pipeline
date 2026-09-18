# Landscape Mother — Formation Event Field V1 execution order

Date: 2026-09-18
Repository: `haihao0307/guilin-dem-pipeline`
Base branch: `feature/landscape-microscope-geometry-lab-r1-20260916`
Base commit: `a3511d671659f6f00e816b248fb5870d31028050`
Parent Draft PR: #79

## Immediate objective

Add the missing middle layer between the accepted R5/K2 macro form and Microscope surface detail:

```text
R5/K2 macro form
+ Formation Event Field
+ Microscope residual
= next reversible Landscape candidate
```

The Formation Event Field is distilled from Brick Mother V2.6's strong procedural system, but brick scale, brick palette and random damage density must not be copied to terrain.

## Implemented in this first commit

- deterministic 2D/terrain domain warp;
- fBm, ridged fBm, turbulence and Worley cellular primitives;
- periodic angular field using integer harmonics;
- fracture, cavity, sinkhole, collapse, wet-flow, deposition, rock-exposure and oxidation masks;
- correlated geometry/material channels;
- exact `heightDelta = 0` for protected truth masks;
- exact neutral-geometry diagnostic while event masks remain visible;
- WebGL2 diagnostic workbench;
- Node regression tests.

## Next integration gate

The next Landscape executor must connect the kernel to the existing R5/K2 source field without replacing its accepted macro shape. Required comparisons:

1. R5/K2 baseline;
2. baseline + Formation Event Field only;
3. baseline + Microscope only;
4. baseline + Formation Event Field + Microscope.

## Hard constraints

- No replacement of DEM or accepted R5/K2 macro form.
- No random caves everywhere.
- Caves, voids and collapse must be gated by cliff/slope/lithology/fracture/drainage context.
- Protected truth mask requires exact `deltaZ = 0`.
- No claim that the diagnostic synthetic hill is Guilin truth or a final karst scene.
- Prior immutable candidates remain unchanged.
- `visualAcceptance=false`, `productionReady=false` until user review and browser/public delivery gates pass.
