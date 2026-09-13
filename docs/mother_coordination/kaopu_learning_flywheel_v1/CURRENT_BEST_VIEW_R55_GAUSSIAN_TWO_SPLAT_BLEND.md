# Current Best View R55 — direct Three.js two-layer source-over accumulation

Status: **Candidate partial**.

R55 isolates two-layer source-over accumulation from Gaussian cutoff and browser presentation. Under pinned `three@0.186.0`, Playwright `1.57.0` and Headless Chromium `143.0.7499.4`, 256 deterministic pixels were drawn twice in a locked back-to-front order into offscreen RGBA32F and RGBA8 targets. WebGL used ANGLE/Vulkan SwiftShader and WebGPU used Google SwiftShader.

The RGBA32F result matched the stepwise float32 source-over reference exactly on all 1,024 channels. RGBA8 differed by at most `0.0033492621253518595`, or `0.8540618419647241` of one 8-bit code; 144 channels exceeded half a code and none exceeded one code. WebGL and WebGPU float, RGBA8 and reverse-order hashes matched exactly.

This corrects R54's scope: the approximately half-code bound belongs to one stable write, not to multiple blended writes. R55's `0.854`-code observation is likewise only a regression envelope for this two-layer input set. It cannot be generalized to arbitrary splat overlap depth, asset error or perceptual acceptance.

The reverse-order control changed every RGB channel and reached `0.6491359174251556` maximum linear difference while alpha changed by at most `5.960464477539063e-8`. A valid file and correct blend factors therefore do not make order interchangeable.

The first WebGL workflow attempt failed with an undefined browser rejection while WebGPU completed. Later identical-fixture WebGL runs succeeded. A control that did not call `getExtension('EXT_float_blend')` directly also succeeded once `EXT_color_buffer_float` was enabled, matching the Khronos rule that enabling the color-buffer extension implicitly enables float blending. The first failure's exact cause remains **Unknown** and is not attributed to missing direct activation.

WebGL/WebGPU results share the same Chromium/SwiftShader evidence lineage and are not independent physical roots. Hardware GPUs, browser presentation color transforms, Apple Safari/iPhone, real assets and human acceptance remain **Unknown**.

Next: isolate presentation transfer by comparing the same locked float result with an offscreen linear target and the browser canvas/output-color-space path. Keep presentation error separate from blend accumulation and cutoff masks.

Frozen R1, Canonical Truth and production Mother branches remain unchanged.
