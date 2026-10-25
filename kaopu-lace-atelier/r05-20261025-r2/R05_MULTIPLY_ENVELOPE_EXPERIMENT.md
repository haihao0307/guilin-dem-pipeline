# R05 sub-experiment: twisted multi-ply envelope
Date: 2026-10-25

Hypothesis: a perfectly smooth, elliptical tube reads as a hard manufactured cord. A restrained rotating multi-ply envelope can create small geometric highlight changes without adding vertices or triangles.

Implementation in `dist/lace-display.js`:
- One three-lobe cross-section term, rotated by material-space arc length and stable path seed. The sixth harmonic was removed because the existing eight-sided ring cannot sample it reliably.
- Added a smooth deterministic low-frequency modulation of lobe amplitude and phase in material space. Closed yarns use a periodic noise lattice so the modulation returns to the same state at the seam.
- A bounded strength control (0.25–2.5 in the UI; 0 means off in the geometry API) allows controlled sweeps without adding vertices or indices.
- The duplicated circumferential seam remains periodic. Position and analytic angular derivative use the same profile; A/B OFF normals match the true unlobed ellipse.
- Surface normals use the analytic angular derivative of the same profile.
- Existing vertex/index topology and ring resolution remain unchanged.

Evidence basis: real yarn is constructed from twisted plies/fibers; see NVIDIA's 2025 ray-wave cloth model and Cornell's micron-resolution fabric research. These are woven/knit cloth studies, so this is an informed approximation for lace yarn, not a validated lace BSDF:
- https://research.nvidia.com/labs/rtr/publication/yu2025realistic/
- https://research.cs.cornell.edu/ctcloth/index.htm
- https://kuiwuchn.github.io/rtstitch.html

Risks: current ring has only eight sides (nine vertices including seam), so even the three-lobe profile is a restrained approximation, not actual separate strand geometry. Native EGL comparison is diagnostic only; browser/WebGL and target GPU results may differ. This is deliberately not increased to a denser ring because that would increase geometry cost. CPU tests can prove finite normals and unchanged vertex count, not that the material looks better.

Acceptance: compare R04 and R05 under identical macro/grazing/backlight observations. Reject the change if it looks scalloped, noisy, or too synthetic, even if all tests pass. No browser WebGL, GPU frame-time or visual acceptance is claimed yet.


## Follow-up: phase-correlated yarn irregularity

The same periodic seeded profile modulation is now also written into the existing `threadPhase` attribute. This lets the already-present shader microstructure vary along the yarn in correlation with the geometric ply profile, without allocating a new vertex attribute or changing vertex/index counts. The modulation is zero when A/B is off and periodic at closed-path seams. Regression coverage checks deterministic phase data and a bounded phase delta.

The native A/B contact tool now emits overall and macro difference maps plus normalized pixel-difference metrics. These metrics quantify how much the image changed; they are not a realism score. The comparison must still be visually judged, and a large difference is not automatically an improvement.


## R05.3 amplitude calibration candidate
The 1.2% candidate produced a very small geometry-only image difference (mean absolute RGB delta 0.05/255 overall and 0.25/255 macro). The next isolated candidate uses 1.5% amplitude, still with the original eight-sided ring, no added vertices/indices, deterministic phase modulation, and the existing analytic normal derivative. This is not accepted until the normal/facing regression passes and a fresh same-camera native A/B is inspected. If the normal-quality gate fails, revert the amplitude rather than weakening the test.


## R05.3 calibration result
The 1.5% lobe-amplitude candidate was rejected by the existing swept-face/normal regression: minimum triangle-normal agreement fell to 0.8948, below the 0.90 acceptance floor. The test was not weakened. The geometry amplitude is restored to 1.2%; the next candidate increases only the seeded low-frequency phase wobble from 0.12 to 0.16, aiming to break up the machined twist without increasing the radial lobe amplitude. This candidate remains pending CI and a fresh fixed-camera A/B.


## R05.4 phase-wobble candidate
The R05.3 phase-wobble candidate (0.16) passed all geometry regressions and its geometry-only A/B changed the image more than the original 0.12 setting: mean absolute RGB delta 0.261/255 overall and 0.351/255 macro. This remains subtle, so R05.4 tests a 0.24 phase wobble while retaining 1.2% lobe amplitude and identical topology. The change is a bounded phase rotation, not increased radial bulge. Keep or reject it only after the normal gate and fresh fixed-camera A/B.
