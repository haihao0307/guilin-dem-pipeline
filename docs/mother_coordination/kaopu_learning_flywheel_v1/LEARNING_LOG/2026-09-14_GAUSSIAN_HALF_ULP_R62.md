# R62 bounded learning cycle — Half-ULP stalls are real, but their count is insufficient

## Question

Can the predeclared running statistic “number of source-over writes whose increment is at or below one-half of the current upward Half ULP” explain the four locked R61 orders and survive a targeted same-count counterexample?

## Locked method

- `three@0.186.0`, tag commit `148ef33ecb6d2502ff796d4554abd1549c95d519`; actual `SPZLoader -> GaussianSplat -> NormalBlending` on software WebGL through Chromium/SwiftShader.
- Reuse the R61 1,941-splat alpha multiset: 1,779 byte-1, 114 byte-2 and 48 byte-8 splats. Geometry, color, scale, rotation, view, kernel, target and verified identity draw order are held constant.
- Replay each center write sequentially. At state `H`, compute `increment = alpha * (1 - H)` and the upward representable Half spacing. Count writes at or below half that spacing; independently count writes whose rounded result equals `H`.
- Decode Half values with the official r186 `DataUtils.fromHalfFloat`. For the GPU replay, bracket representable values and apply IEEE round-to-nearest-even; do not use the r186 `DataUtils.toHalfFloat` storage packer as a GPU-rounding oracle.
- Re-run the four R61 orders, then execute two deterministic same-multiset xorshift32 permutations, seeds 112 and 545, selected because the predeclared count collides in the corrected nearest-even replay.
- Successful workflow run `34772729110`; artifact `10322173145`, digest `1cdfcfcfdd504024215b5bbdacc7a8167d4cd21b6add26146b15a9a0ef611433`.

## Observations

1. All six actual r186 pages passed loader, object, NormalBlending, fixed-order initialization, source-count and finite-readback checks. The four R61 center results reproduced exactly.
2. Corrected nearest-even replay reproduced all six observed Half center values exactly. The predeclared threshold count also equaled the exact no-change write count for every sequence.
3. R61 order observations were: ascending `1,070` stalls beginning at write 749 and Half `0.9912109375`; descending `1,666` at 275 and Half `0.9267578125`; interleaved `1,640` at 301 and Half `0.9267578125`; seeded `1,228` at 642 and Half `0.97900390625`.
4. The targeted seeds 112 and 545 each produced exactly `1,260` threshold/stall writes, but actual Half centers were `0.97900390625` and `0.97607421875`, a difference of `0.0029296875`. Their first stalls occurred at writes 611 and 618.
5. Float replay remained within `2.9802322388e-7` of observed Float centers. This check is tolerance-based; only the Half replay was bit-exact.
6. The first workflow attempt used r186 `DataUtils.toHalfFloat` directly and failed every Half replay. Source inspection showed that function right-shifts away low mantissa bits without nearest-even rounding. That attempt is retained as a harness failure, not evidence for the predictor.

## Interpretation

- **Observation:** the increment-versus-current-Half-ULP condition identifies exact storage stalls in these six sequences, and a corrected sequential Half replay reproduces the actual renderer center exactly.
- **Rejected:** the total stall/threshold count is a sufficient order-sensitive precision predictor. Equal counts produced different actual Half endpoints.
- **Rejected:** r186 `DataUtils.toHalfFloat()` is an exact numerical model of GPU Half render-target blending. It is suitable as the pinned storage packer it implements, not as a substitute for the target's rounding behavior.
- **Candidate / Current Best View:** precision risk must retain sequential state or an equivalently path-sensitive trace. A stall count may screen risk but cannot certify output or define a universal threshold.
- **Unknown:** whether a compact signed/propagated rounding-residual summary survives mixed-color and spatial-footprint counterexamples; WebGPU, hardware GPU, Safari/iPhone, real assets, performance, energy and human acceptance.
- **Frozen:** Canonical Truth, source observations, uncompressed reconstruction checkpoints, Object DNA responsibilities, user freezes and formal R1 are unchanged.

## Transferable method

- Separate a source library's packing helper from the actual arithmetic/rounding contract of the device path being modeled.
- Validate a step-level mechanism against exact renderer states before compressing it into an aggregate score.
- Challenge an aggregate score with same-score sequences, not only rank correlation on the sequences used to introduce it.
- Preserve failed harness runs when they reveal a tool limitation, but exclude them from the domain conclusion.
- Keep executable browser evidence, mathematical replay, device acceptance and human acceptance as separate gates.

## Routing and next gap

Three.js Delivery Mothers should use the sequential nearest-even replay only as a fixed-r186 diagnostic and keep the actual ordered source stream. They must not infer safety from a total stall count or from `DataUtils.toHalfFloat` output alone. Photo Reconstruction Mother should retain fixed-view sorted order for eventual real-asset Half/Float comparisons; no asset trial is authorized by R62.

Next bounded question: with deterministic mixed colors, can a per-channel signed propagated rounding-residual trace explain RGB divergence that the alpha-only stall count cannot? This remains a synthetic mechanism test until a real reconstruction and target device exist.

Routing is prepared only; no Mother acknowledgment or adoption is claimed. Production Mother branches were not modified. First-tier expert AI was not called in this learning cycle.

