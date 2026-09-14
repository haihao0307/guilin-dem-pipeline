# KAOPU Learning Log — R72 Gaussian order-cache invalidation

Date: 2026-09-14  
Question: Can R66 block summaries be reused after draw order changes when the unordered splat multiset and every declared renderer/view condition stay fixed?  
Overall status: **Candidate partial**

## Inherited state

R66 showed that block summaries computed sequentially from the true incoming Half state reproduce the R65 conservative error bound while reducing persisted diagnostic history. It explicitly left camera/order cache invalidation untested. R71's required genuinely different WebGL/GPU runtime was unavailable and no new Mother acknowledgement was present, so this cycle returned to the preserved R66 queue and advanced only draw-order invalidation. Canonical Truth, Frozen R1, production branches and existing tool prohibitions remain unchanged.

## Preregistered method

- Three.js `0.186.0`, tag commit `148ef33ecb6d2502ff796d4554abd1549c95d519`.
- Actual `SPZLoader -> GaussianSplat -> NormalBlending` through the WebGL fallback of `WebGPURenderer` in Chromium/ANGLE Vulkan SwiftShader.
- The R66 `1,941`-splat source multiset, camera, covariance, calibrated alpha maps, Half target and block size `128` were held fixed.
- Six deterministic order changes were fixed before execution: reverse, stable alpha ascending, stable alpha descending, stable RGB group, rotate by 647 records and a seeded shuffle.
- Weak cache key: hash of the sorted alpha+RGB record tokens, deliberately insensitive to order.
- Candidate cache key: exact ordered-record hash plus renderer revision/path, output format, blend mode, block schema, camera and calibrated effective-alpha-map hashes.
- Negative control: use the baseline order's composed bound after an order change. Positive control: recompute each block sequentially from the new order's true prior Half endpoint.

## Observation

Workflow run `34851873465` passed all ten machine gates.

- All seven runs, including baseline, had bit-exact Half replay; local Half-gap violations were `0`. Maximum block-composition deviation was `5.828670879282072e-16`.
- The weak unordered-multiset hash was identical for every order. All six changed orders produced a different exact ordered key and a different recomputed summary digest.
- Recomputed summaries underestimated `0` channels in every variant.
- Reusing the baseline summaries for the stable alpha-descending order underestimated `13` channels. The worst stale slack was `-0.019535977421867107`.
- The first recorded counterexample was pixel `(16,14)`, alpha channel: actual Half error `0.18827843945666556`, stale baseline bound `0.1871270545312703`, shortfall `0.0011513849253952657`.
- The other five changed orders did not underbound in this fixture, but their ordered keys and summary digests still changed. Accidental conservatism in selected variants is not evidence that stale reuse is valid.

## Candidate, Rejected and Current Best View

**Candidate:** invalidate the summary cache when the exact ordered draw stream changes. A reusable key should also bind the effective alpha maps/view state, renderer and blend implementation, output numeric format and block-summary schema; this cycle demonstrates order necessity, not universal sufficiency of that full field set.

**Rejected:** an unordered splat multiset hash, unchanged camera, unchanged block size or unchanged source membership is enough to authorize reuse after sorting changes. The alpha-descending counterexample shows material underestimation.

**Current Best View:** R66 summaries are condition-specific diagnostic evidence. Exact draw order is now a demonstrated invalidation dimension. Recompute summaries sequentially from true boundary Half state after an order-key change; never treat a cache hit on an order-insensitive key as proof of conservatism.

## Boundaries and Unknowns

- This remains the R55-R66/R72 Chromium/SwiftShader evidence lineage, not an independent physical Observation Root.
- Only draw order changed. Camera, covariance, footprint, renderer, blend implementation and output-format invalidation remain untested here.
- The fixture uses repeated centered DC-color splats; SH appearance, dynamic real scenes and learned assets remain **Unknown**.
- WebGPU, hardware GPU, Safari/iPhone, target performance/energy, real reconstruction and human acceptance remain **Unknown**.
- Mother routing is prepared only; acknowledged adoption is false.
- First-tier expert AI was not called; this was not an expert meeting.

## Next bounded gap

Change one locked camera parameter while retaining source order, then test whether effective-alpha-map and summary digests invalidate together. Require stale-view reuse to mismatch or underbound and recomputation to restore the conservative obligation. Do not infer universal asset or perceptual thresholds.

