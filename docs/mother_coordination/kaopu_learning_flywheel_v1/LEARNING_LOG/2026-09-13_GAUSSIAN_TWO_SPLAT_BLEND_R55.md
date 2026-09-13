# R55 bounded learning cycle — direct Three.js two-layer source-over accumulation

## Question

After R54 established a stable one-write storage baseline, what additional error appears when two ordered translucent samples are accumulated directly by Three.js r186 into RGBA8 rather than RGBA32F, and do locked software WebGL/WebGPU agree?

## Executable evidence

- Pinned renderer: `three@0.186.0`.
- Browser harness: Playwright `1.57.0`, Headless Chromium `143.0.7499.4`.
- Backends: Three.js WebGLBackend through ANGLE/Vulkan SwiftShader and confirmed WebGPUBackend through Google SwiftShader.
- Fixture: 256 one-pixel columns, two translucent draws per pixel, explicit `renderOrder`, `NormalBlending`, non-premultiplied source colors, depth disabled, no cutoff and no presentation surface.
- Targets: offscreen RGBA32F and RGBA8, `NoToneMapping`, target `NoColorSpace`.
- Accepted workflow: run `34736638886`, head `9448fe01dbafc0d04353560a49c8e9d8cb1eda7f`, artifact `10310898792`, artifact SHA-256 `4d416b597f6d93dea57152de8eefe86e627ced70ac276d2cf68bf29bee776867`.
- Machine gate: `Candidate-pass`, no errors.

## Observations

1. RGBA32F matched the stepwise float32 source-over formula exactly across all 1,024 channels on both backends.
2. RGBA8 versus float maximum absolute error was `0.0033492621253518595` (`0.8540618419647241` 8-bit codes), RMSE `0.0013398207486287322`.
3. 144 channels exceeded half a code; no channel exceeded one code.
4. WebGL and WebGPU produced identical input, float, RGBA8 and reverse-order hashes.
5. Reversing draw order changed all 768 RGB channels, with maximum difference `0.6491359174251556`; alpha remained invariant to float epsilon (`5.960464477539063e-8`).

## Failure and counter-hypothesis record

The first workflow attempt (`34736269295`) produced an undefined WebGL rejection at the float-blend stage while WebGPU completed. The first candidate interpretation was that direct `EXT_float_blend` activation was missing.

That interpretation is **Rejected in the tested condition**. A fresh WebGL context deliberately did not call `getExtension('EXT_float_blend')` directly, but did enable `EXT_color_buffer_float`; it completed and produced hashes identical to the direct-call path. This agrees with the Khronos `EXT_float_blend` specification, which states that supported systems implicitly enable float blending when `EXT_color_buffer_float` is enabled. The exact reason for the first rejection remains **Unknown**.

## Method correction

- A one-write storage envelope cannot be promoted to a multi-draw accumulation envelope.
- Record draw count, draw order, blend factors, premultiplication convention, depth state, target format and color-transform state with every blend comparison.
- Preserve failed runs and provisional explanations. A successful counterexample must demote an attractive explanation even when the final main-path result passes.
- Cross-backend equality under a shared browser and SwiftShader lineage is a portability regression signal, not independent physical evidence.

## Boundaries

The `0.854`-code maximum belongs only to this deterministic two-layer sample set. It is not an error budget for learned Gaussian assets, deeper overlap, hardware GPUs or human vision. Gaussian cutoff, canvas presentation, hardware, Safari/iPhone, real photos, COLMAP/Brush training and human acceptance were not executed.

## Routing

Three.js Delivery Mothers may use R55 as a two-layer accumulation regression fixture, while keeping R54 stable storage and R50-R53 cutoff coverage separate. Photo Reconstruction Tool Mother candidate should later measure actual overlap-depth distributions and locked-camera images rather than reuse the synthetic code width.

## Next real gap

Compare the same locked float result through Three.js r186 offscreen linear output and the browser canvas/presentation color path. Declare renderer output color space, target color space, tone mapping, alpha/compositing background and readback location. Hardware-backed WebGPU and Apple Safari/WebKit remain separate infrastructure-dependent gates.
