# R60 bounded learning cycle — optical depth is not a sole precision-risk predictor

## Question

Across the actual Three.js r186 `SPZLoader` -> `GaussianSplat` path, can effective optical depth alone predict default-HalfFloat versus Float accumulation divergence when source alpha and overlap count change?

## Why this question

R59 proved that a single low-alpha, 4,096-layer stress fixture can drive the default Half target to a finite-precision fixed point. It did not show whether a scalar summary could route future validation. R60 therefore holds renderer, splat geometry, color, view, kernel and sort semantics fixed, varies only encoded alpha and overlap count, and tests effective optical depth as the sole candidate predictor.

## Locked method

- `three@0.186.0`, tag commit `148ef33ecb6d2502ff796d4554abd1549c95d519`.
- Playwright `1.57.0`, Headless Chromium `143.0.7499.4`, software WebGL through Google SwiftShader.
- Seven deterministic legacy gzip SPZ v3 fixtures with alpha bytes `1, 2, 4, 8, 16, 32, 64`; each contains 4,096 otherwise-identical SH0 splats.
- Each alpha fixture is parsed independently by the public r186 `SPZLoader`, passed to the actual `GaussianSplat` with `autoSort=true`, and rendered into paired omitted/default Half and explicit Float internal targets.
- Float one-layer center alpha is measured first. The effective optical-depth step is `-log(1-alpha)`; layer counts are rounded to target `tau = 1, 2, 4, 8` and are identical in the paired Half/Float run.
- Fixed r186 kernel, cutoff, NormalBlending, camera, transparent clear, sRGB output and `3x3` viewport. Identical splats make sort order irrelevant to this fixture.
- Internal linear targets and final PNG bytes are retained. Successful workflow run `34761069876`; artifact `10318284891`, digest `6132897a6290aaf8bf6fb98fab4070d8dcc5e6df59325fc52d6d0a4abcd61060`.

## Observations

1. All seven SPZ source pairs had identical raw and gzip hashes between Half and Float. All 28 alpha-by-target-tau cells completed; the actual loader, object, NormalBlending path, internal target readback and presentation capture passed the machine gate.
2. In the target-`tau=8` group, actual tau ranged only from `7.9084411116` to `8.0045891779`, a `1.2018508%` span. Yet center Half/Float error ranged from `0.0006089211` to `0.0729071498`, a `119.7317x` ratio; final `3x3` sRGB code difference ranged from `0` to `29`.
3. The largest target-`tau=8` error used alpha byte `1`, 2,399 layers and actual tau `8.0011191330`. The smallest used alpha byte `64`, 33 layers and actual tau `7.9084411116`.
4. Target-`tau=4` was an even stronger parameter-space counterexample: actual-tau span `1.9613711%`, center-error range `0.0000814199` to `0.0549062490`, ratio `674.3587x`, and presentation difference `0` to `14` codes.
5. Across all cells, Float center alpha tracked the ideal repeated source-over expression within `3.95974e-7`. The maximum Half-versus-ideal center error was `0.0729071001`. This supports Float as the numerical counterfactual in this fixture, not as physical truth or a production choice.
6. Target-`tau=1` and `2` groups exceeded the pre-recorded 5% actual-tau matching band because integer layer counts are coarse at the largest alpha. Their measurements remain observations, but they are not used as the decisive matched-tau gate.

## Interpretation and counterexample

Effective optical depth predicts the ideal accumulated opacity for a fixed repeated source-over sequence, but it is rejected as a **sole** predictor of Half-versus-Float precision risk in this fixture. Nearly equal tau can be decomposed into many small writes or fewer large writes, and those decompositions encounter different Half rounding and fixed-point behavior.

This does not reject tau as a useful descriptive variable. It rejects collapsing precision validation to tau alone. At minimum the validation record also needs the per-write alpha distribution, overlap/write count and target format; real assets additionally require spatial footprint, view, sort/color sequence and output conditions.

The `119.7x`, `674.4x`, 14-code and 29-code values are stress-fixture observations, not universal error bounds, perceptual thresholds or evidence that every low-alpha reconstruction requires Float.

## Status ledger

- **Observation:** fixed r186 actual loader/object execution produced matched-tau groups with large Half/Float risk spread as described above.
- **Observation:** paired Float closely matched the analytic repeated-source-over reference in this synthetic fixture.
- **Rejected:** effective optical depth alone is sufficient to predict accumulation precision risk.
- **Rejected:** equal ideal accumulated opacity implies equal finite-target behavior.
- **Candidate / Current Best View:** use a multidimensional validation tuple: effective optical depth, per-write alpha distribution, overlap count, target precision and spatial/view/order conditions. Keep default Half as the unmodified validation start and Float as a paired counterfactual.
- **Unknown:** which compact second statistic predicts mixed-alpha real splats; WebGPU numerical behavior; hardware GPU, Safari/iPhone, performance, energy, real-photo reconstruction and human acceptance.
- **Frozen:** Canonical Truth, source observations, uncompressed reconstruction checkpoints, Object DNA responsibilities, user freezes and formal R1 remain unchanged.

## Transferable method

- Calibrate the renderer's actual one-write alpha before constructing an optical-depth grid; encoded alpha alone is not the final fragment alpha.
- Match aggregate summaries, then deliberately vary their decomposition to test whether the summary is sufficient.
- Preserve the failed matching bands rather than hiding them; classify which groups meet the declared comparison gate.
- Compare internal linear values, final display codes and analytical references separately.
- A paired higher-precision path is a diagnostic counterfactual. Production promotion still requires the lower-precision path to fail a declared domain gate, the higher-precision path to pass, and target-device cost to be measured.

## Routing and next gap

Three.js Delivery Mothers should not route precision risk from tau alone. Photo Reconstruction Mother should capture at least per-view alpha/overlap distributions before any real-photo pilot and retain paired Half/Float fixed-view comparisons without copying R60 stress values as acceptance thresholds.

Next bounded question: for controlled mixed-alpha sequences with matched tau and fixed order, does adding one second statistic such as `sum(alpha^2)`, maximum alpha, or a Half-ULP margin predict divergence materially better? Test one predeclared metric against counterexamples before routing it; do not turn the next cycle into a broad threshold search.

Routing is prepared only; no Mother acknowledgment or adoption is claimed. Production Mother branches were not modified. First-tier expert AI was not called in this learning cycle.

