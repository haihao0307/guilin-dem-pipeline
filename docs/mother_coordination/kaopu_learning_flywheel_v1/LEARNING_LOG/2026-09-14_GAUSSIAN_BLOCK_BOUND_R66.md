# KAOPU Learning Log — R66 checkpointed Gaussian Half bound

Date: 2026-09-14  
Question: Can checkpointed block summaries compose the R65 conservative Half bound with substantially less persisted diagnostic state, and is the true boundary Half state necessary?  
Overall status: **Candidate partial**

## Inherited state

R65 showed that an unsigned per-step bracketing-Half-gap bound, propagated by later transmittance, dominated all `4,356` locked spatial channels. It still required an ordered replay. R66 advances only the declared block-checkpoint question. No Mother feedback or adoption receipt was present before execution. Canonical Truth, Frozen R1, production branches and existing tool prohibitions remain unchanged.

## Preregistered method

- Three.js package `0.186.0`, tag commit `148ef33ecb6d2502ff796d4554abd1549c95d519`.
- Actual `SPZLoader -> GaussianSplat -> NormalBlending` through the WebGL fallback of `WebGPURenderer` in Chromium/SwiftShader.
- The R65 deterministic 1,941-splat sequence, cyclic RGB, initialized identity order, `33 x 33` target and measured per-pixel alpha maps were retained.
- Block sizes were fixed before execution at `32, 64, 128, 256, 512` draws.
- Each block/pixel summary stores the ending four-channel Half state, four-channel bound contribution `G` produced from zero incoming bound, and one scalar block transmittance `T`.
- Summaries compose as `B_out = B_in * T + G`. The true preceding block's Half endpoint must seed the next block's local-gap calculation.
- Negative control: restart each block's Half calculation from zero while retaining the same draw sequence, then test whether its composed bound underestimates the actual endpoint error.

## Observation

All nine machine gates passed in workflow run `34796801343`.

- At all five block sizes, checkpoint composition matched the per-step R65 bound. The largest absolute composition difference was `3.885780586188048e-16`.
- No formally checkpointed scheme underestimated any of the `4,356` final channels.
- The zero-restarted negative control underestimated `51, 51, 51, 32, 20` channels for block sizes `32, 64, 128, 256, 512` respectively.
- A fixed counterexample at pixel `(16,14)`, cutoff-inside red channel, had actual error `0.02819163316062906`. For block size 128, the invalid reset scheme supplied only `0.004849562106711386`, underestimating by `0.023342071053917675`.
- Actual Half replay remained bit-exact and all local gap checks passed.

For the declared diagnostic-state accounting, a full per-step trace stores `15,528` numeric values per pixel (`4` Half states plus `4` local bounds for each draw). Block size 128 stores `16 x 9 = 144` values, a `99.0726%` reduction; block size 512 stores 36 values, a `99.7682%` reduction.

These percentages exclude the source draw data and calibrated per-pixel alpha maps, which remain required. They quantify only persisted diagnostic trace state, not asset size, GPU memory, network transfer or runtime cost.

## Candidate, Rejected and Current Best View

**Candidate:** compute each block sequentially from the true incoming Half checkpoint, then persist `(Half endpoint, G, T)` summaries. They reproduce the same conservative final bound while allowing later block-level localization with less stored trace state.

**Rejected:** blocks may be evaluated independently from zero Half state and then safely combined. The negative control materially underestimated visible-channel error.

**Current Best View:** block summaries reduce persisted diagnostic history, not the causal inputs. Boundary Half state, exact draw order, source channels and effective alpha remain part of the evidence contract. Larger blocks reduce storage but coarsen localization; R66 does not establish an optimal block size.

## Boundaries and Unknowns

- This remains the R55-R66 Chromium/SwiftShader lineage, not an independent physical Observation Root.
- The fixture uses repeated centered DC-color splats. Multiple centers, anisotropic overlap, SH appearance and dynamic sorting remain Unknown.
- Camera, covariance, order or renderer changes can alter effective alpha and local Half gaps; cross-view reuse was not tested.
- WebGPU, hardware GPU, Safari/iPhone, target-device performance/energy, real reconstruction and human acceptance remain Unknown.
- Mother routing is prepared only; acknowledged adoption is false.
- First-tier expert AI was not called; this was not an expert meeting.

## Next bounded gap

Pre-register a cache-key/invalidation test that reuses one view's block summaries under a changed camera or draw order. Require a negative-control mismatch and verify that recomputing summaries for the new condition restores the conservative obligation. Do not infer universal asset or perceptual thresholds.

