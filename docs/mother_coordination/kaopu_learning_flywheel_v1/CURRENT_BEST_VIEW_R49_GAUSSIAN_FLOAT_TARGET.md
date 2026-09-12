# Current Best View R49 — Gaussian float-target separation

Status: **Candidate partial**.

For the fixed R47 two-splat fixture on Mesa llvmpipe, the independent shader rendered into `RGBA32F` agrees with the continuous CPU compositor within `9.95e-8` for the reference and `6.49e-8` for the candidate, with no coverage-mask mismatch. The combined reference/candidate maximum was `0.0851303041`, only `1.82e-8` from the continuous CPU maximum.

The same software backend's final `RGBA8` target differed from `RGBA32F` by as much as `0.00497459` and `0.00537919`, and reduced the reported combined maximum to `0.0823529`. Thus R48's observed gap is dominated by the final target's storage/blending behavior in this fixture, rather than by the analytic shader equations. A smaller final-pixel difference can be quantization masking, not improved fidelity.

This separation is specific to one independent shader, one llvmpipe version and one fixture. It is not direct Three.js TSL, WebGL/WebGPU, hardware GPU, browser, Safari/iPhone, real-photo or human-acceptance evidence. No numerical envelope is promoted to a production threshold.

Frozen R1, Canonical Truth and production Mother branches are unchanged.
