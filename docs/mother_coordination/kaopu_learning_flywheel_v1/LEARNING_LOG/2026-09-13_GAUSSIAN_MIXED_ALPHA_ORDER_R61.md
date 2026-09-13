# R61 bounded learning cycle — order defeats unordered tau plus sum-alpha-squared risk metrics

## Question

Does adding `sum(alpha^2)` to effective optical depth make a sufficient default-HalfFloat versus Float accumulation-risk predictor when an actual Three.js r186 mixed-alpha splat sequence changes order?

## Why this question

R60 rejected effective optical depth as a sole predictor and left one bounded next step: test one predeclared second statistic on controlled mixed-alpha sequences. R61 chooses `sum(alpha^2)` because it distinguishes some alpha decompositions while remaining inexpensive to compute. It tests sufficiency by holding the complete alpha multiset fixed and permuting only its deterministic draw order.

## Locked method

- `three@0.186.0`, tag commit `148ef33ecb6d2502ff796d4554abd1549c95d519`.
- Playwright `1.57.0`, Headless Chromium `143.0.7499.4`, software WebGL through Google SwiftShader.
- One multiset of 1,941 identical-centered SH0 splats: 1,779 with alpha byte 1, 114 with byte 2 and 48 with byte 8. Geometry, color, scale, rotation, view, kernel and output are unchanged.
- Four deterministic permutations: ascending, descending, interleaved and seeded shuffle. Their multiset hash is identical and their sequence hashes are distinct.
- Each ordered SPZ is parsed by the public r186 `SPZLoader` and rendered by the actual `GaussianSplat` into paired omitted/default Half and explicit Float targets.
- Order initialization is explicit: run `updateSort()` once while every center occupies the same depth bin, verify that the stable CPU counting-sort order is identity, then set `autoSort=false` for the measured render.
- One-write Float calibration gives aggregate `tau=7.9909139785`, `sum(alpha^2)=0.0588358475` and ideal repeated-source-over opacity `0.9996614755`; these values are exactly shared by all permutations.
- Successful workflow run `34766945485`; artifact `10320768039`, digest `8c281263c3ebc33ca0c85c87a4596b2dcb9ccaa6b7e2c069617bb8a9f7d68750`.

## Observations

1. All pages passed source, loader, object, NormalBlending, explicit order-initialization and finite-readback checks. Half/Float pairs used byte-identical ordered SPZ files.
2. All four permutations have exactly the same alpha multiset, calibrated tau and `sum(alpha^2)`, yet their center Half/Float error ranges from `0.0084507465` to `0.0729035139`, a spread of `0.0644527674`.
3. Ascending order produced Half `0.9912109375` and Float `0.9996616840`; descending order produced Half `0.9267578125` and Float `0.9996613264`. Thus Half changed by `0.064453125`, while Float changed by only `3.57628e-7`.
4. Interleaved matched the descending Half result `0.9267578125`; seeded order produced `0.97900390625`. The paired final sRGB maximum difference ranged from 6 to 29 codes.
5. Across all permutations, Float differed from the analytical repeated-source-over reference by at most `2.08574e-7`; Half differed by as much as `0.0729036630`.
6. The first workflow attempt set `autoSort=false` before the WebGL order buffer was initialized. It produced a wrong one-write calibration and a `0.00154227` Float order spread; the gate failed. This failure was not reused as evidence for the metric claim.

## Source-level failure mode discovered

The r186 material always indexes splat storage through `CountingSort.orderRead`. In the WebGL route, `GaussianSplat.updateSort()` is also where the sort and storage buffers are enabled for the PBO path and the CPU order is written. `autoSort=false` only suppresses the `onBeforeRender` call to `updateSort()`; it does not itself establish a usable fixed-order WebGL buffer.

Therefore a fixed-order test must initialize and verify the order buffer before disabling automatic sorting. The successful R61 run does this and verifies identity order for every page.

## Interpretation and counterexample

The exact-multiset permutation result rejects the unordered pair `(tau, sum(alpha^2))` as a sufficient precision-risk predictor in this fixture. Both statistics are identical, but the default-Half divergence changes substantially with order. The Float counterfactual remains essentially order-stable and analytical-reference-stable at this scale, so the observed spread is not explained by materially different ideal opacity.

This does not reject tau or `sum(alpha^2)` as useful features in a richer model. It shows that an order-sensitive state variable is required. A likely mechanism is whether the next source-over increment falls below the current Half representable spacing as accumulated opacity approaches one; R61 has not yet promoted that mechanism beyond Candidate.

The numerical spreads and display-code differences are synthetic stress observations, not universal bounds, visual thresholds or a production mandate to use Float.

## Status ledger

- **Observation:** actual fixed r186 loader/object execution produced identical-multiset, distinct-order Half results with the values above.
- **Observation:** paired Float order spread was only `3.57628e-7` and analytical error at most `2.08574e-7` in this fixture.
- **Observation:** fixed-order WebGL use requires explicit r186 order-buffer initialization and verification when automatic sorting is disabled.
- **Rejected:** `(effective optical depth, sum(alpha^2))` without order/state information is a sufficient precision-risk predictor.
- **Rejected:** constructing `GaussianSplat(..., {autoSort:false})` alone is enough to establish a validated fixed source order on the r186 WebGL fallback.
- **Candidate / Current Best View:** precision validation must be sequence/state aware; unordered aggregate statistics can screen domains but cannot certify them.
- **Unknown:** whether a running increment-to-Half-ULP margin predicts the observed stalls; behavior with real spatial/depth sorting, mixed color, WebGPU, hardware GPU, Safari/iPhone, performance, energy, real reconstruction and human acceptance.
- **Frozen:** Canonical Truth, source observations, uncompressed reconstruction checkpoints, Object DNA responsibilities, user freezes and formal R1 remain unchanged.

## Transferable method

- To test an aggregate metric's sufficiency, hold its entire input multiset constant and permute only sequence order.
- Verify the renderer's actual indirection/order buffer, not just a public option flag.
- Keep Half/Float pair differences, order-to-order differences and analytical-reference differences separate.
- Failed harness initialization is a tool observation, not evidence for the domain claim; correct it and rerun against the same source revision.
- Treat higher precision as a diagnostic counterfactual until real-domain quality and target-device cost gates both pass.

## Routing and next gap

Three.js Delivery Mothers should add explicit order-buffer initialization/identity checks to any r186 fixed-order WebGL diagnostic and must not route precision from unordered tau or `sum(alpha^2)` alone. Photo Reconstruction Mother should retain actual per-view sorted order or an equivalent order-sensitive trace when investigating precision failures.

Next bounded question: can a predeclared running risk statistic—counting writes whose ideal source-over increment is at or below one-half of the current Half ULP—predict the four R61 order outcomes and resist a targeted counterexample? This tests the proposed finite-precision mechanism, not a production threshold.

Routing is prepared only; no Mother acknowledgment or adoption is claimed. Production Mother branches were not modified. First-tier expert AI was not called in this learning cycle.

