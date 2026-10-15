# R05 thin-ribbon pass audit

The first R05 run 38571715266 passed both candidate and public checks. Its view/material common-subexpression rewrite retained the original full-quality look (foreground sRGB MAE 8.324059810450747e-7, p99 zero, maximum one 8-bit code). On its four-MRT software backend, merged shadow passes plus optical reuse took 10784.4/10812.7 ms versus the original-separated render path 12411.5/12441.3 ms in alternating same-run motion tests. This is NOT a comparison to the old default 21-node approximation, nor a user's hardware FPS result.

The source fur material also set forceSinglePass=true. The hair layer/shadow materials had kept Three's default two-draw behavior for transparent DoubleSide surfaces. Because these are single-fiber ribbons and these passes use additive blending, the extra front/back geometry pass is unnecessary for the intended accumulation. R05's second revision enables single-pass double-sided rasterization on the optimized path; the original-separated comparison keeps the original two-pass behavior. This does NOT make fibers one-sided, opaque, thicker, or fewer. Output equivalence and all native interaction checks must be rerun before delivery.

Official API reference: https://threejs.org/docs/pages/Material.html#forceSinglePass . The pinned Three revision remains r169. This transfers a relevant rendering setting from the user's own fur source rather than only its spring equation.

## Timing honesty

The first probe's per-stage wallMS entries around 0.0–0.9 ms capture JS command-submission cost in that browser, despite gl.finish calls. They do not account for the seconds-long downstream graphics queue and MUST NOT be called GPU stage execution times or used to locate the GPU bottleneck. The revised probe additionally records actual renderer draw-call and triangle counts; these counts describe submitted work, not GPU time. Whole-frame completedFrameWallMS/bench.frameWallMS are measured after explicit GPU fence completion and are the end-to-end latency numbers used for comparisons. No test claims zero GPU cost from a rounded 0.0 ms counter.

Eight-layer MRT coalescing is capability-gated; the tested software backend exposes fewer than eight outputs, so the actual tested path still has two four-layer groups. Do not claim an eight-output hardware path was visually verified on that device. Shadow dual-output and thin-ribbon single-pass changes are testable there. Hardware/driver performance and eight-output execution need separate coverage.

The old R04 and first R05 fixed builds remain immutable. The latest build/evidence/source are recorded in DELIVERY.json after the new workflow finishes.
