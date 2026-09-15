# Current Best View R78 — Gaussian Half replay arithmetic

Status: **Candidate partial**.

## Observation

- A preregistered two-record Three.js r186 counterexample made `f32-final` and `f32-staged` predict different Half values at exactly one channel.
- The independent Half target and its duplicate control selected `f32-staged`: all 4,356 channels matched it exactly, while `f32-final` missed the center red channel by one Half ULP (`0.0001220703125`).
- Target rendering occurred only after actual independent Float calibration demonstrated the predicted divergence.

## Current Best View

For the locked Chromium/ANGLE Vulkan SwiftShader `NormalBlending` fixture, replay the blend by rounding the complement, each product and the sum to Float32 before nearest-even Half storage. This is an input/output-equivalent diagnostic model for one counterexample and observation root, not a statement about hidden driver instructions or a cross-backend rule.

A model-selection fixture must force candidate models to different stored results before target observation. Prediction-equivalent fixtures can validate closure but cannot identify arithmetic order.

## Rejected

- Use `f32-final` as bit-exact authority for the locked counterexample.
- Infer operation order from fixtures whose candidate Half states coincide.
- Promote one software counterexample to general fixed-function, hardware or production authority.

## Unknown

Generality across other blend inputs, footprints, renderers and formats; fixed-function fusion/instructions; hardware GPU; WebGPU; Safari/iPhone; real assets; performance; visual acceptance; and Mother adoption.

Canonical Truth, production Mothers and Frozen R1 remain unchanged.
