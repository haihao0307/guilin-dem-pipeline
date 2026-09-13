# KAOPU Learning Log — R65 propagated Half-gap bound

Date: 2026-09-14  
Question: Can a preregistered unsigned per-step Half-gap bound, propagated by later transmittance, conservatively dominate the exact spatial Half residual without storing signed residuals?  
Overall status: **Candidate partial**

## Inherited state

R64 established a bit-exact nearest-even Half replay over the locked `33 x 33` footprint, but its exact signed trace is expensive and center pixels do not certify the cutoff neighborhood. R65 advances only the declared bound question. The concurrent Microscope coordinate/surface note at commit `0897df9b8c0dfb9be7df27b261787e573392688b` was inherited before this probe; it is a separate Candidate observation and does not alter this Gaussian evidence root. No Mother feedback or adoption receipt was present. Canonical Truth, Frozen R1, production branches and tool prohibitions remain unchanged.

## Preregistered bound and executable condition

- Three.js package `0.186.0`, tag commit `148ef33ecb6d2502ff796d4554abd1549c95d519`.
- Actual `SPZLoader -> GaussianSplat -> NormalBlending` through the WebGL fallback of `WebGPURenderer` in Chromium/SwiftShader.
- The R64 deterministic 1,941-splat alpha sequence, cyclic RGB sequence, initialized identity order, perspective camera, scale byte `116`, and `33 x 33` Half target were retained.
- Three one-splat Float calibrations measured effective per-pixel alpha for source alpha bytes `1`, `2` and `8`, including projection, the `0.3` screen kernel and `r^2 > 4` cutoff.
- For unrounded step `u_i = source_i * alpha_i + H_(i-1) * (1-alpha_i)`, the local unsigned allowance is zero when `u_i` is exactly binary16; otherwise it is half the gap between the adjacent bracketing binary16 values.
- The preregistered recurrence is `B_i = B_(i-1)*(1-alpha_i) + localBound_i`. The obligation is `abs(H_i - ideal_i) <= B_i` for every final pixel/channel.
- The bound uses the ordered Half state and measured effective alpha. It does not use the signed rounding residual.

## Observation

All eight machine checks passed in workflow run `34790686740`. Across `1,089` pixels and `4,356` RGBA channels:

- nearest-even ordered Half replay remained bit-exact (`maxReplayAbs=0`);
- the signed residual identity closed within `1.11e-15`;
- every local Half-gap check passed;
- the propagated unsigned bound underestimated no channel;
- maximum actual absolute Half-minus-ideal error was `0.12773165063845437`;
- maximum propagated bound was `0.18712705453127046`;
- the endpoint-only Half-ULP shortcut underestimated `52` channels: all 4 stable-inside channels and all 48 cutoff-inside channels.

The footprint classes remained `1 / 12 / 24 / 1052` pixels for stable-inside, cutoff-inside, cutoff-outside and stable-outside. Zero-coverage classes had zero error and zero bound. For nontrivial errors, the propagated bound can be loose: the largest reported bound/error ratio was `26.4842`. This is a regression-safety observation, not a quality score.

## Candidate, Rejected and Current Best View

**Candidate:** in this locked software-WebGL fixture, the unsigned Half-gap recurrence is a conservative deterministic guard when retaining signed residuals is undesirable.

**Rejected:** a single Half-ULP evaluated only at the endpoint certifies accumulated blending error. It failed in 52 visible channels.

**Current Best View:** the propagated bound reduces signed-residual storage but does not create a compact asset summary. It still requires the full draw order, per-step Half state, source channels and per-pixel effective alpha. Therefore `tau`, `sum(alpha^2)`, stagnation counts, alpha-only traces, center pixels and endpoint ULP remain screening features, not certification.

## Boundaries and Unknowns

- This is another executable condition in the R55-R65 Chromium/SwiftShader lineage, not an independent physical Observation Root.
- Only repeated centered DC-color splats were tested; multiple centers, anisotropic overlaps, SH appearance and dynamic sorting remain Unknown.
- The local binary16 allowance assumes round-to-nearest-even, verified here by replay. Other hardware/backend rounding behavior must be measured.
- WebGPU, hardware GPU, Safari/iPhone, target performance/energy, real reconstruction and human acceptance remain Unknown.
- No user photos, COLMAP/Brush training or learned asset were used.
- Mother routing is prepared only; acknowledged adoption is false.
- First-tier expert AI was not called; this was not an expert meeting.

## Next bounded gap

Test whether a blockwise checkpoint scheme can conservatively compose the same bound while storing substantially less ordered state, with an adversarial cross-block counterexample. Do not infer a universal asset or perceptual threshold.

