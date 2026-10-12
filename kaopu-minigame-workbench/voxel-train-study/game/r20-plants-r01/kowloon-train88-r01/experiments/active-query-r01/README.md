# Active query domain: isolated candidate

This experiment changes execution coverage only. It is not connected to the retained game or a public entry. The frozen fallback is commit `daa1df0f747e9c4636d027046f84773adec853ee`.

Existing evidence identifies distinct costs:
- First-use grouped shaders and terminal normal pipeline carry large deferred driver/compilation cost. This change does not claim to fix cold compilation.
- The verified moved-state main trace took15.834 seconds; complete terminal normals/material completion then took0.203 seconds. Repeated full+alternate12-group dispatch dominates that warm trace.
- The old32×24/16×16 raw traces prove that a single active pixel bounding rectangle, refreshed at the original16-step checkpoints, would submit33.01%/33.28% of the original query pixel-steps. This is a work estimate, not a timing or higher-resolution prediction.

## Exact execution rule
Only the12+12 group queries and fullField copy use the shrinking region. The original advance shader continues to run on the original coverage. Its first action returns any non-active trace unchanged before reading full/alternate inputs, so both ping-pong buffers keep terminal hit/miss/unresolved states through every subsequent swap. No extra retirement copy is needed. Original viewport/pixel coordinates,1400-step budget, strict winner ordering, source functions, candidates, materials, displacement, id15/17 alternate semantics and final coverage are unchanged. No cross-frame cache is added.

The bounds reduction reuses one completion readback per16 steps and returns original pixel min/max coordinates, not coordinates of the reduced grid. `(0,0)` is valid. Empty rays use the explicit `(large,large,-1,-1)` sentinel. A failed/unresolved ray can leave the active query region but remains a failure in final trace output. New traces reset coverage.

## Validation
CPU tests cover odd dimensions, corners, terminal failures, source advance ordering, immutable coverage and both ping-pong arrays through step1400. The isolated GPU test additionally checks the reduction on odd synthetic grids. It then runs the same actual original station queries/advance in baseline and bounded modes, alternating warm repeats on the same compiled programs. It saves all10 fresh raw traces and compares every float32 bit with the previously verified original reference, whose hash and source/state/matrices are locked in fixture.json. No old bureau round-trip or full game screenshot is rerun.

Cold first-use time is separate from two warm baseline and two bounded draws per view. Draw-count and query-pixel-step measurements are reported along with actual wall cost. A work-count reduction alone is not sufficient to adopt this candidate. Final normals/material coverage remains the original contract; the experiment itself renders no beauty image or normal-resolution view.
