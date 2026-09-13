# R59 bounded learning cycle — actual SPZ/GaussianSplat accumulation precision

## Question

Does Three.js r186's default `HalfFloatType` output buffer remain within the one-write R58 envelope when a deterministic low-alpha, high-overlap SPZ is parsed by the actual `SPZLoader` and blended by the actual `GaussianSplat` object?

## Why this question

The dedicated R58 expert review corrected an overreach: R58 wrote one CPU-precomposited array with `NoBlending`, so it did not test iterative splat accumulation. That review supplied a candidate failure mechanism, not executable evidence. R59 therefore tests only that missing path and does not repeat an expert meeting.

## Locked method

- `three@0.186.0`, tag commit `148ef33ecb6d2502ff796d4554abd1549c95d519`.
- Playwright `1.57.0`, Headless Chromium `143.0.7499.4`, software WebGL through Google SwiftShader.
- Deterministic legacy gzip SPZ v3: 4,096 identical SH0 splats, raw SHA-256 `2ba8db733eafb8342a25f179ff4c406b68a289fb24880a7275858a95cf388f00`, gzip SHA-256 `c0f12177fe9880dca2d26b4c90718027c02d743678a31eea7ca11794c06df70b`.
- The file is parsed by the public r186 `SPZLoader`; the returned geometry is passed to the actual `GaussianSplat` with `autoSort=true`. All splats have identical centers and attributes, so sort order cannot change this fixture's result.
- Fixed r186 kernel, cutoff, NormalBlending, camera, transparent clear, sRGB output and `3x3` viewport. The only paired change is omitted/default `HalfFloatType` versus explicit `FloatType`.
- The rendered instance count is sampled at `1, 2, 4, 16, 64, 256, 512, 1024, 2048, 4096`. Each sample reads the revision-pinned internal linear target; the final 4,096-layer opaque-black canvas is captured separately.
- Machine gate passed in workflow run `34755499053`; artifact `10317930498`, digest `472941ecd7e4c446c1cfa9eeb9baadc645eb71d54d557f6c165b3d360196e0a3`.

## Observations

1. Both pages parsed the same locked SPZ into 4,096-position, covariance and normalized RGBA attributes, instantiated `GaussianSplat`, used NormalBlending and completed the layer gradient.
2. The one-layer Half/Float maximum difference was only `0.0000011939555406570435`, but the maximum over the full `3x3 RGBA` target grew to `0.06053948402404785` at 4,096 layers.
3. At the center pixel, Half and Float were `0.96337890625` and `0.9673188328742981` at 512 layers. Half then remained exactly `0.96337890625` at the sampled 1,024, 2,048 and 4,096 counts, while Float reached `0.9989320039749146` at 1,024 and `0.9999955296516418` at 2,048.
4. The complete Half `3x3` internal target hash was unchanged from 1,024 through 4,096 layers. The Float target still changed outside the center between 2,048 and 4,096; therefore the two formats do not merely reach the same result at different sampled steps.
5. On the final opaque-black sRGB canvas, Half versus Float differed in 27 of 36 RGBA channels, with maximum difference `15` 8-bit codes and RMSE `11.39078575` codes.
6. The first workflow attempt used identical raw SPZ bytes but non-identical gzip wrapper timestamps. The gate correctly failed source identity. Fixing the container timestamp produced identical raw and gzip hashes and the same numerical outcome.

## Interpretation and counterexample

R59 supplies executable evidence for the failure mode proposed in the R58 review: repeated low-alpha source-over writes can accumulate a much larger Half-versus-Float difference than a single stored value suggests, and the Half target can reach a finite-precision fixed point before the Float counterfactual.

This rejects extending R58's one-write maximum of one final sRGB code to iterative `GaussianSplat` accumulation. It also rejects treating the r186 default as evidence that HalfFloat is already the better delivery choice. It does **not** reject the original R58 observation within its one-write fixture, prove a general HalfFloat defect, or establish Float as the production answer.

The fixture deliberately maximizes overlap, uses identical synthetic splats, one software browser lineage and a tiny viewport. Its `0.06054` linear difference and 15-code display difference are stress observations, not real-asset or perceptual thresholds.

## Status ledger

- **Observation:** fixed r186 `SPZLoader` and `GaussianSplat` execute the locked 4,096-splat SPZ through NormalBlending on software WebGL.
- **Observation:** paired Half/Float divergence grows beyond the single-layer difference; Half center and then the full sampled target reach fixed values earlier.
- **Rejected:** R58's one-write error/code envelope can be reused as an iterative-splat accumulation bound.
- **Rejected:** the renderer default by itself is evidence of delivery superiority.
- **Candidate / Current Best View:** omitted/default Half is only the unmodified validation start; explicit Float is the paired counterfactual. Delivery choice is conditioned on actual overlap-domain image error and target-runtime cost.
- **Unknown:** whether a real reconstruction reaches this overlap/alpha regime; a useful risk predictor; WebGPU numeric behavior; hardware GPU, Safari/iPhone, performance, energy and human acceptance.
- **Frozen:** Canonical Truth, source observations, uncompressed reconstruction checkpoints, Object DNA responsibilities, user freezes and formal R1 are unchanged.

## Transferable method

- Test precision where blending occurs, not only by storing a precomposited result once.
- Sweep accumulation depth and retain per-step hashes so growth, cancellation and stagnation remain distinguishable.
- Pair formats with identical asset bytes, view, kernel, sort semantics and output transform; hash the uncompressed source separately from its container.
- Keep internal linear-target error, final display codes, resource cost and human acceptance as independent gates.
- A precision override is domain-specific: Half must fail a predeclared criterion while the same-domain Float path passes. If both fail, Float is not automatically accepted.

## Routing and next gap

Three.js Delivery Mothers should replace the earlier preference wording with a neutral validation contract: begin from the pinned default, always keep a paired Float counterfactual for overlap-sensitive tests, and do not choose globally from this stress fixture. Photo Reconstruction Tool Mother should add an overlap-conditioned precision check before any real-photo pilot; source floats and uncompressed reconstruction remain canonical evidence.

Next bounded question: across an actual r186 SPZ/`GaussianSplat` path, does a deterministic grid of source alpha and overlap count admit a useful risk indicator such as effective optical depth, or do spatial/kernel effects require a richer metric? The grid may define a regression method, but not a production threshold without real assets and target-device acceptance.

Routing is prepared only; no Mother acknowledgment or adoption is claimed. Production Mother branches were not modified. First-tier expert AI was not called in this learning cycle; the already-recorded dedicated R58 review was inherited as candidate guidance.
