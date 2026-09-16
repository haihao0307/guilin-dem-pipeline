# Current Best View R86 — R85 staged replay is empirical, not a normative WebGL bit pattern

Status: **Candidate partial**.

## Observation

- The locked OpenGL ES 3.0.6 contract defines blend equations and a precision floor no lower than the destination components, while leaving otherwise-unspecified floating-point operation details open and allowing pixel variation between implementations.
- The inspected float color-buffer extensions add renderability or blend applicability but do not mandate Float32 intermediates, per-operation rounding, staging order or bitwise RGBA16F identity.
- The locked WebGL conformance fixture tests RGBA16F with a nonzero threshold. This is non-normative execution policy, not permission for bit-exact cross-backend reuse.
- Fourteen R86 source-contract checks passed. Normative documents are one Khronos lineage; the conformance fixture is not an independent standards root.

## Current Best View

R85 `f32-staged` remains the best input/output-equivalent model for locked Three.js r186 / Chromium 143 / ANGLE Vulkan SwiftShader only. R86 shows that WebGL/OpenGL ES conformance does not require that exact staging or bit pattern.

A hardware result must be recorded as a new runtime Observation Root. Bit-exact replay, cache summaries and bound reuse remain keyed to backend, driver/runtime, blend path and output format.

## Frozen / Rejected / Unknown

- Frozen R1, Canonical Truth and production Mother branches are unchanged.
- Rejected: storage precision determines arithmetic staging; float renderability proves bitwise portability; `EXT_float_blend` mandates the R85 stages; algebraic equivalence guarantees identical rounding; conformance tolerance authorizes cache reuse.
- Unknown: hardware WebGL, WebGPU, Safari/iPhone, real assets, performance, human acceptance and Mother adoption.
