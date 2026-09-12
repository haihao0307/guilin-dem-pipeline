# KAOPU Learning Cycle — Gaussian sorting precision R39

Date: 2026-09-12  
Queue item: LQ-GAUSSIAN-001  
Status: Candidate partial. Not Frozen. Not formal KAOPU R2.  
Production Mother mutation: none.

## Bounded question

Can Three.js r186's native Gaussian-splat sorting guarantee exact back-to-front order for translucent splats, or do its fixed depth bins and update threshold require a separate visual acceptance gate?

This cycle executes the fixed CPU fallback and sort-decision code. It does not execute GPU sorting or rasterization.

## Observation root

### O-R39-THREE — fixed r186 viewer implementation

At Three.js r186 commit `148ef33ecb6d2502ff796d4554abd1549c95d519`:

- `GaussianSplat` fixes `BIN_COUNT=4096` and maps normalized depth into one of those bins;
- the depth range is derived from the transformed splat bounding sphere, so nominal precision is `(farDepth-nearDepth)/4095`, not a constant world-unit tolerance;
- `CountingSort` documents that it is approximate and elements in the same bin have unspecified relative order;
- its WebGL fallback executes `computeCPU`, whose sequential scatter preserves source index order within a bin;
- the GPU scatter uses atomics, so same-bin relative order is not specified;
- automatic resort occurs only when the new view-direction dot product with the last sorted direction is below `0.9995`, corresponding to about `1.811927°`.

This is one software root. The fixture and compositing arithmetic are derived tests, not independent physical observations.

## Executed evidence

Five checks passed in `PROBES/gaussian_sorting_precision_result_r39.json`.

### Same-bin counterexample

For a declared depth range `0–100`, the nominal bin step is `0.02442002442`. Depths `50` and `50.000001` both mapped to bin `2047`.

The actual r186 CPU `CountingSort` returned source order `[0,1]`, while exact back-to-front order was `[1,0]`. This proves exact order is not guaranteed even though both depths are finite and distinct.

A simple two-layer transparency control using red/blue at alpha `0.5` produced:

- exact order RGBA: `[0.5,0,0.25,0.75]`;
- collided source order RGBA: `[0.25,0,0.5,0.75]`;
- maximum RGB difference: `0.25`.

That number only illustrates order sensitivity. It is not a measured Three pixel error or acceptance threshold.

### Stale-sort counterexample

The actual `GaussianSplat.updateSort` WebGL-fallback decision path was executed on two synthetic splats:

- identity-view depths were `[1.001,1]`, so source order `[0,1]` was correct;
- after a `1°` yaw, depths became approximately `[0.9991023,1.0015929]`, reversing the exact order;
- because `cos(1°) > 0.9995`, r186 did not dispatch a new sort and retained `[0,1]`;
- at `2°`, `cos(2°) < 0.9995`, a new sort was dispatched and order became `[1,0]`.

This demonstrates a possible stale order below the angular threshold. It does not establish that a real asset produces a visible artifact.

## Candidate method

Keep three checks separate:

1. **Sort-policy declaration** — viewer/version, bin count, depth-range derivation, same-bin policy and angular update threshold.
2. **Deterministic risk scan** — for fixed validation cameras, report non-equal-depth collisions and small camera steps that invert exact order without crossing the resort threshold.
3. **Actual acceptance** — compare fixed-view and small-angle-sweep GPU images on the target renderer/device, then obtain human acceptance.

Do not promote a generic exact-sort replacement yet. More bins or more frequent sorting can increase cost; the trade-off must be measured on a real pilot and target hardware.

## Status ledger

- Observation: fixed Three r186 approximate-sort source and actual CPU fallback/sort-decision execution.
- Candidate: `ADAPTERS/gaussian_sorting_gate_r39.mjs` and the three-layer sorting acceptance method.
- Current Best View: native r186 sorting is a performance-oriented approximate presentation policy; it is not a truth-preserving ordering guarantee.
- Frozen: KAOPU R1 and all user-approved Mother freezes unchanged.
- Rejected: 4096 bins imply exact order; distinct depths imply distinct bins; successful stationary image implies camera-motion stability; the synthetic RGB difference is a real-asset threshold.
- Unknown: real-asset collision frequency, GPU same-bin realization, visible artifact magnitude, sorting cost, target macOS/iPhone/Safari behavior and human acceptance.

## Routing

Prepared only. No R38 Mother feedback or acknowledged adoption was observed. See `MOTHER_ROUTING_R39_GAUSSIAN_SORTING_PRECISION.json`.

No routine cross-AI meeting or independent external-AI review was performed; no unavailable access is claimed.

