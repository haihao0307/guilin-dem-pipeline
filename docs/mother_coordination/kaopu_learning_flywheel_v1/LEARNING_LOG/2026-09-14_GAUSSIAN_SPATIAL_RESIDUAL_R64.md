# KAOPU Learning Log — R64 Gaussian spatial residual and cutoff

Date: 2026-09-14  
Question: Does the per-channel signed propagated Half residual remain an exact diagnostic across the spatial Gaussian footprint and the fixed Three.js r186 hard-cutoff neighborhood?  
Overall status: **Candidate partial**

## Inherited state

R63 showed exact nearest-even Half replay at one center pixel, while identical alpha evidence could not certify mixed RGB precision. R64 advances only the declared spatial gap. No Mother feedback or adoption receipt was present before execution. Canonical Truth, Frozen R1, production branches and existing tool prohibitions remain unchanged.

## Fixed executable condition

- Three.js package `0.186.0`, tag commit `148ef33ecb6d2502ff796d4554abd1549c95d519`.
- Actual `SPZLoader -> GaussianSplat -> NormalBlending` through the WebGL fallback of `WebGPURenderer` in Chromium/SwiftShader.
- One deterministic 1,941-splat alpha and cyclic RGB sequence; identity order initialized and then locked.
- `33 x 33` internal Half/Float targets, perspective camera and scale byte `116` (`log-scale -0.75`).
- Three one-splat Float calibrations measure effective alpha for source alpha bytes `1`, `2` and `8` at every pixel. The calibration therefore includes the fixed r186 projection, `0.3` screen kernel and `r² > 4` cutoff instead of substituting a separate footprint equation.
- Pixels are classified from measured coverage into stable-inside, cutoff-inside, cutoff-outside and stable-outside.

## Observation

The measured footprint contained `1 / 12 / 24 / 1052` pixels in those four classes. Across all `1,089` pixels and `4,356` RGBA channels:

- nearest-even ordered Half replay matched the actual Half framebuffer bit-for-bit (`maxAbs=0`);
- the signed local residual propagated by later transmittance reproduced Half-minus-ideal within `1.11e-15`;
- the accumulated Half and Float coverage masks exactly matched the independently measured cutoff topology;
- cutoff-outside and stable-outside remained exactly zero.

The center pixel's maximum RGB Half/Float difference was `0.00940910`. The cutoff-inside maximum was `0.03287943`, about `3.49x` larger. Its alpha difference reached `0.12773615`, versus `0.02635527` at center. Final sRGB presentation differed by at most `18` eight-bit codes across `38` channels. These are fixture observations, not perceptual limits.

## Rejected and corrected

The first machine gate preregistered a `1e-6` tolerance for a generic stepwise JavaScript Float replay. It failed honestly: the actual maximum was `9.2983e-6` over `52` channels. The final gate does not inflate the original tolerance. It instead records and rejects the claim that single-splat measured alpha plus a generic JavaScript Float recurrence is a bit-exact oracle for renderer Float blending.

Also rejected: a center-pixel residual trace certifies the full footprint. The cutoff-inside RGB error was materially larger even though source, draw order and framebuffer format were unchanged.

## Current best view

**Candidate:** for this locked software-WebGL condition, a full ordered per-pixel/per-channel Half residual trace is an exact diagnostic oracle across the observed footprint and cutoff topology. It is not a compact delivery metric, hardware-independent rule, physical truth or automatic reason to switch output formats.

The paired Float framebuffer remains a useful counterfactual, but its arithmetic must be observed from the renderer rather than treated as bit-equivalent to a generic JavaScript recurrence.

## Boundaries and Unknowns

- This adds a new executable condition inside the existing R55-R64 Chromium/SwiftShader lineage; it is not an independent physical Observation Root.
- Only repeated centered DC-color splats were tested. Multiple centers, anisotropic overlaps, SH appearance and dynamic sorting remain Unknown.
- WebGPU, hardware GPU, Safari/iPhone, target performance and energy remain Unknown.
- No user photo set, COLMAP/Brush training, learned asset, real reconstruction or human acceptance was used.
- Mother routing is prepared only; acknowledged adoption is false.
- First-tier expert AI was not called; this was not an expert meeting.

## Next bounded gap

Test a preregistered conservative error bound based on per-step Half ULP and downstream transmittance against this spatial fixture. The goal is to determine whether a cheaper bound can safely dominate the exact residual without preserving signed residuals; no universal asset or device threshold may be inferred.

