# KAOPU Learning Log — R74 Gaussian covariance-cache invalidation

Date: 2026-09-15  
Question: Can R73/R72/R66 summaries be reused after changing only isotropic covariance scale while camera, positions, colors, alpha sequence and draw order stay fixed?  
Overall status: **Candidate partial**

## Inherited state

R72 demonstrated exact draw-order invalidation; R73 demonstrated view-dependent effective-alpha invalidation. R74 isolates the next declared factor, covariance. No newer coordinator commit, Mother acknowledgement or independent device evidence was present before execution. Canonical Truth, Frozen R1, production branches and tool prohibitions remain unchanged.

## Preregistered method

- Three.js `0.186.0`, tag commit `148ef33ecb6d2502ff796d4554abd1549c95d519`.
- Actual `SPZLoader -> GaussianSplat -> NormalBlending` through the WebGL fallback of `WebGPURenderer` in Chromium/ANGLE Vulkan SwiftShader.
- Camera, positions, rotations, RGB, alpha multiset and exact order, Half target and block size `128` were held fixed.
- Only the uniform isotropic SPZ scale byte changed: `112`, baseline `116`, `120`, decoding to log scales `-1.0`, `-0.75`, `-0.5`.
- Each condition separately measured Float calibration alpha maps for source alpha bytes `1/2/8` and rendered the full Half target.
- Weak key deliberately omitted covariance and effective-alpha identity. Candidate strong key added encoded scale, decoded covariance hash and calibrated alpha-map hashes.
- Negative control reused the baseline `116` bound; positive control recalibrated and recomputed sequential summaries from true Half checkpoints.

## Observation

Workflow run `34876718489` passed all thirteen machine gates.

- Alpha sequence, RGB sequence, positions, camera and identity draw order remained fixed. Raw SPZ and decoded covariance hashes changed only with the scale condition.
- Half replay was bit-exact for all three conditions; local Half-gap violations were `0`. Maximum block-composition deviation was `3.0531133177191805e-16`.
- Both scale changes altered decoded covariance, every calibrated effective-alpha-map digest, candidate strong key and recomputed summary digest. The covariance-insensitive weak key collided by design.
- Recomputed summaries underestimated `0` channels in all conditions.
- Reusing the baseline summary for enlarged covariance `scaleByte=120` underestimated `32` channels; worst stale slack was `-0.08463239124033439`.
- First counterexample: pixel `(15,14)`, red channel, actual error `0.011094549946214838`, stale baseline bound `0`, equal shortfall.
- Reduced covariance `scaleByte=112` produced no stale underestimation in this fixture, but its covariance, alpha maps and summaries changed. Accidental conservatism is not cache authority.

## Candidate, Rejected and Current Best View

**Candidate:** bind decoded covariance identity and view-conditioned effective-alpha maps in the diagnostic-summary cache key. Recompute sequentially from true Half boundary states whenever either changes.

**Rejected:** stable positions, colors, alpha order, draw order and camera—or a key that omits covariance—are sufficient to authorize summary reuse. Enlarged covariance supplies a material counterexample.

**Current Best View:** R66-R74 summaries certify one exact rendering condition only. Exact ordered stream, view footprint and decoded covariance are now demonstrated invalidation dimensions. The combined key remains not-yet-proven sufficient for anisotropic/local covariance, renderer, blend, output-format or device changes.

## Boundaries and Unknowns

- This remains the R55-R66/R72-R74 Chromium/SwiftShader lineage, not an independent physical Observation Root.
- Only a uniform isotropic covariance scale changed. Anisotropy, per-splat variation and quaternion-covariance orientation remain **Unknown**.
- The fixture uses repeated centered DC-color splats; SH appearance, learned assets and dynamic scenes remain **Unknown**.
- WebGPU, hardware GPU, Safari/iPhone, target performance/energy, real reconstruction and human acceptance remain **Unknown**.
- Mother routing is prepared only; acknowledged adoption is false.
- First-tier expert AI was not called; this was not an expert meeting.

## Next bounded gap

Use a fixed small anisotropic covariance pair with one controlled orientation change. Verify decoded covariance/footprint/summary invalidation and recomputed conservatism. Do not promote the cache contract or Gaussian tool without real-asset and target-runtime evidence.

