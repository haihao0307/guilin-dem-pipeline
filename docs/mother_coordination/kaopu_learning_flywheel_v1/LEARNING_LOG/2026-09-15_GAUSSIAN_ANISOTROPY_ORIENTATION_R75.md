# Learning Log R75 — anisotropic covariance orientation invalidates Gaussian summaries

Status: **Candidate partial**. Date: 2026-09-15.

## Question

Can R74/R73/R72/R66 diagnostic summaries be reused when only a fixed anisotropic covariance is rotated, while camera, positions, RGB, Alpha sequence, exact draw order, scale values, Half target and block size remain fixed?

## Source and executable observation

- Three.js is pinned to `0.186.0`, tag commit `148ef33ecb6d2502ff796d4554abd1549c95d519`.
- Its primary `SPZLoader.js` blob `456aa33e7c6e10bec74b34a5413606bb45bb0c16` decodes each scale byte with `exp(byte / 16 - 10)`, decodes the v3 smallest-three quaternion, then writes the covariance tensor.
- The fixture keeps anisotropic scale bytes `[128,96,96]` (decoded log scales `[-2,-4,-4]`) fixed and changes only the packed quaternion: `0xc0000000`, `0xc0000115`, `0xc00001ff` (nominal 0°, 45°, 90° about view Z).
- All non-orientation source tokens, the camera and the 1,941-item identity draw order remain fixed. Actual Three.js r186 `SPZLoader → GaussianSplat → NormalBlending` is executed in Chromium/ANGLE Vulkan SwiftShader.

## Observation

- Both rotations changed the decoded covariance tensor, every calibrated effective-Alpha-map digest, the strong cache key and the recomputed block-summary digest.
- Relative to the declared Float-calibrated ideal surrogate, per-condition recomputation empirically underestimated zero channels.
- Reusing the 0° summaries at nominal 45° underestimated 16 channels; worst stale slack was `-0.11270411639080968`.
- Reusing the 0° summaries at 90° underestimated 36 channels; worst stale slack was `-0.11089316303607777`. Total stale underestimation count was 52.

## Failed gate retained

The preregistered first workflow run `34889048003` failed `halfReplayBitExact`: maximum actual-Half versus replay mismatch was `0.00048828125`. The fixture and threshold were not changed. The classified run requires this mismatch to remain explicit and passed its weaker evidence contract.

## Candidate

Invalidate diagnostic summaries when the decoded covariance tensor—or an equivalent versioned scale-plus-rotation identity—or the view-conditioned effective Alpha maps change. Recompute from the true condition before using a summary as a regression gate.

The current recomputed bound is only an empirical conservative observation against the Float-calibrated surrogate. It is not a renderer-bit proof until the one-ULP replay mismatch is explained and closed.

## Rejected

1. Fixed positions, RGB, Alpha order, draw order, camera and scale values are sufficient authority to reuse summaries after an anisotropic orientation change.
2. R62–R74 Float-calibrated single-splat Alpha replay automatically remains bit-exact for the more eccentric R75 footprint.

## Unknown and boundaries

- Exact fragment-source precision and the cause of the maximum `0.00048828125` replay mismatch are Unknown.
- Formal conservatism outside the sampled fixture is Unknown.
- WebGPU, hardware GPU, Safari/iPhone, target performance, real photo reconstruction and human acceptance remain Unknown.
- This is the existing Chromium/SwiftShader observation root, not an independent physical or device root.
- Mother adoption remains unacknowledged. Production branches, Canonical Truth and Frozen R1 are unchanged.
- First-tier expert AI was not called in this learning cycle.

## Next gap

Hold the 45° eccentric fixture fixed and isolate the replay mismatch by comparing Float single-splat calibration, Half single-splat readback, analytic shader inputs and selected incremental Half checkpoints. Do not promote the block bound to formal authority until that closes.
