# Current Best View — Gaussian full-covariance quantization R44 candidate

1. SPZ stores each log-scale on a 1/16 grid and each rotation with the R43 smallest-three codec. These losses act together on the covariance `C=R diag(exp(2s)) R^T`.
2. Ideal real arithmetic gives a 0.03125 log-scale half-step, 3.174341% semiaxis envelope and 6.449446% covariance-eigenvalue envelope. The fixed source's float arithmetic observed a slightly larger 0.0312504768 step, so the executable implementation envelopes are 0.031251, 3.174444% and 6.449659%.
3. Adding the inherited R43 rotation-only spectral bound gives a conservative implementation full-covariance envelope of 7.410361% relative to the largest source eigenvalue, provided the source quaternion is finite and normalized and every log-scale is inside [-10, 5.9375].
4. In 1,000,000 deterministic cases, observed maxima were 6.449547% scale-only, 0.348038% rotation-only and 6.457397% combined. The random combined maximum is not a tighter universal proof.
5. Scale quantization can dominate rotation quantization. A small angular error is therefore insufficient evidence for splat-shape fidelity.
6. The R44 envelope is a codec regression ceiling, not a pixel, physical, device or human-acceptance threshold. Each real asset still needs float-to-decoded covariance and fixed-view image comparison with its own acceptance budget.
7. Canonical Truth, Frozen R1 and production Mothers remain unchanged.
