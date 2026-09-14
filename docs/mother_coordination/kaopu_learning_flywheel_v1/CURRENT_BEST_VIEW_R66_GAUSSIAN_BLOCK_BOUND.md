# Current Best View R66 — block summaries reduce diagnostic history, not causal inputs

Status: **Candidate partial**.

For the fixed Three.js r186 Chromium/SwiftShader fixture, checkpoint summaries `(four-channel Half endpoint, four-channel block bound contribution, scalar transmittance)` reproduced R65's conservative bound at preregistered block sizes `32, 64, 128, 256, 512`. Maximum composition deviation was `3.89e-16`; no formal scheme underestimated any locked channel.

The true boundary Half state is mandatory. Restarting every block from zero underestimated `20–51` visible channels. At block size 128, one cutoff-inside red-channel case had actual error `0.02819163` but an invalid reset bound of only `0.00484956`.

For declared trace accounting, block size 128 reduced persisted numeric diagnostic state from `15,528` to `144` values per pixel (`99.0726%`). This excludes source draws and calibrated alpha maps, which remain required. It is not an asset-size, GPU-memory or runtime reduction claim.

Larger blocks trade localization for storage. No optimal block size is established, and summaries cannot yet be reused across camera, covariance, order or renderer changes. WebGPU, hardware GPU, Safari/iPhone, real reconstruction, performance and human acceptance remain **Unknown**. Mother adoption is unacknowledged; Canonical Truth and Frozen R1 are unchanged.

Next: test cache-key invalidation by reusing summaries across a changed view/order, with recomputation as the positive control.

