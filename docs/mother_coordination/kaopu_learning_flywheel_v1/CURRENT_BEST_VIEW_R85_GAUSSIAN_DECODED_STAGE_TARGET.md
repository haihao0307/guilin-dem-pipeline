# Current Best View R85 — Three decode-aware cases select staged replay on the fixed r186 software route

Status: **Candidate partial**.

## Observation

- R80 Float calibration, R82 decoded RGB/Alpha attributes and all three prefix-1 Half planes matched exactly before prefix 2 was permitted.
- Three prefix-2 cases separately rejected missing Float32 rounding at complement, product and sum. Their exact-model intersection is `staged` only.
- The staged replay matched every one of 4,356 Half channels per case; duplicate target frames were bit-identical.
- One failed decoded-attribute gate was preserved. Official r186 parser source showed that color attribute component four is the SPZ Alpha byte, not constant 255; the correction did not change the frozen matrix or predictions.

## Current Best View

For the fixed Three.js r186 `NormalBlending` path on Chromium 143 / ANGLE Vulkan SwiftShader, `f32-staged` is the best input/output-equivalent Half replay model tested so far. R78 remains a compatible narrower target observation; R81 remains a failed semantic test and R83 its negative control.

The result is not an observation of fixed-function instructions and cannot authorize cross-backend cache summaries. Backend and output-format identity remain required routing and cache dimensions.

## Frozen / Rejected / Unknown

- Frozen R1 and Canonical Truth are unchanged.
- Rejected: constant-255 decoded Alpha expectation; retroactive R81 repair; one-case three-stage proof; cross-backend inference.
- Unknown: hardware WebGL, WebGPU, Safari/iPhone, real assets, performance, human acceptance and Mother adoption.
