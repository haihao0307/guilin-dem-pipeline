# KAOPU Learning Log — R73 Gaussian view-cache invalidation

Date: 2026-09-14  
Question: Can R72/R66 summaries be reused after changing only camera `z` while source bytes and draw order stay fixed?  
Overall status: **Candidate partial**

## Inherited state

R72 demonstrated that exact draw order is a mandatory invalidation dimension for checkpointed Half-error summaries. It left view/effective-alpha invalidation untested. No newer coordinator commit, Mother acknowledgement or independent target-device evidence was present before execution. R73 advances only the registered camera boundary; Canonical Truth, Frozen R1, production branches and tool prohibitions remain unchanged.

## Preregistered method

- Three.js `0.186.0`, tag commit `148ef33ecb6d2502ff796d4554abd1549c95d519`.
- Actual `SPZLoader -> GaussianSplat -> NormalBlending` through the WebGL fallback of `WebGPURenderer` in Chromium/ANGLE Vulkan SwiftShader.
- The R72 source bytes, 1,941-record draw order, covariance, Half target, projection parameters and block size `128` were held fixed.
- Only camera position `z` changed: baseline `2.0`, near `1.5`, far `2.5`.
- Each view separately measured three Float calibration alpha maps for source alpha bytes `1/2/8`, then rendered the full Half target.
- Weak key: renderer/source context without camera or effective-alpha-map identity.
- Candidate strong key: weak-key fields plus exact camera position and all calibrated effective-alpha-map hashes.
- Negative control: reuse the baseline `z=2.0` bound. Positive control: recalibrate alpha maps and recompute blocks sequentially from true prior Half endpoints.

## Observation

Workflow run `34864217097` passed all twelve machine gates.

- Source raw hash, alpha sequence and RGB sequence were identical across all three views; identity draw order remained locked.
- Half replay was bit-exact in all views; local Half-gap violations were `0`. Maximum block-composition deviation was `4.996003610813204e-16`.
- Both changed views produced different effective-alpha-map hashes, candidate strong keys and recomputed summary digests. The view-insensitive weak key collided by design.
- Recomputed summaries underestimated `0` channels in every view.
- Reusing the baseline summary at near `z=1.5` underestimated `32` channels; worst stale slack was `-0.08109634109349051`.
- First counterexample: pixel `(15,14)`, red channel, actual error `0.020912228388062115`, stale baseline bound `0`, equal shortfall.
- Far `z=2.5` had no stale underestimation in this fixture, but its alpha maps and summaries changed. Accidental conservatism does not establish valid reuse.

## Candidate, Rejected and Current Best View

**Candidate:** bind exact camera/view state and calibrated effective-alpha maps in the summary-cache identity. Recompute summaries sequentially from true boundary Half states when either changes.

**Rejected:** stable source bytes, stable draw order, or a renderer/source-only key is sufficient authority to reuse summaries across camera changes. The near-view counterexample materially underestimates error.

**Current Best View:** R66-R73 summaries are evidence for one exact rendering condition, not asset-global certificates. Exact ordered stream and view-dependent effective-alpha footprint are now demonstrated invalidation dimensions. The broader candidate key remains not-yet-proven sufficient across covariance, renderer, blend or output-format changes.

## Boundaries and Unknowns

- This remains the R55-R66/R72-R73 Chromium/SwiftShader lineage, not an independent physical Observation Root.
- Only camera `z` changed. Camera orientation/FOV, covariance, renderer, blend implementation and format changes were not tested here.
- The fixture uses repeated centered DC-color splats; SH appearance, learned assets and dynamic real scenes remain **Unknown**.
- WebGPU, hardware GPU, Safari/iPhone, target performance/energy, real reconstruction and human acceptance remain **Unknown**.
- Mother routing is prepared only; acknowledged adoption is false.
- First-tier expert AI was not called; this was not an expert meeting.

## Next bounded gap

Hold camera and order fixed while changing one covariance scale. Verify footprint/summary invalidation and recomputed conservatism, with stale covariance summaries as the negative control. This does not authorize a real-photo pilot without user imagery and target runtime evidence.

