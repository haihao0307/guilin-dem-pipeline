# R54 bounded learning cycle — direct Three.js float-intermediate versus RGBA8 stable color

## Question

After R53 isolated the discontinuous cutoff mask, what error is introduced purely by storing stable direct-TSL color values in an RGBA8 final offscreen target instead of an RGBA32F intermediate target, and do software WebGL/WebGPU agree on that storage path?

## Evidence status

- **Pinned renderer:** `three@0.186.0`.
- **Common browser/toolchain:** Playwright `1.57.0`, Headless Chromium `143.0.7499.4`.
- **Backends:** direct WebGL and confirmed WebGPU, both software SwiftShader paths.
- **Fixture:** 256 stable one-pixel quads, 1024 RGBA channels, deterministic float color attributes, no Gaussian cutoff, no overlap and no blending.
- **Float intermediate:** offscreen `RGBA32F` RenderTarget.
- **Final storage:** offscreen `RGBA8` RenderTarget.
- **Color state:** `NoToneMapping`, target `NoColorSpace`; renderer output color space declared `LinearSRGBColorSpace`.
- **CI:** run `34735939991`, artifact `10311191870`, artifact SHA-256 `03f25f3fa46711cd0bdecd4a8f96b1eb2d25eb9a9de4387bd23aaf1dd0d7946d`.
- **Machine gate:** `Candidate-pass`, no errors.

## Result

1. Both WebGL and WebGPU processed all 256 stable pixels / 1024 channels.
2. Maximum normalized RGBA32F-to-RGBA8 absolute error was `0.0019607962346544494` on both backends, approximately half one 8-bit code plus float epsilon.
3. RMSE was `0.001131800634389483` on both backends.
4. No channel exceeded one 8-bit code of error.
5. The WebGL and WebGPU RGBA32F results had identical SHA-256 `964924dc62a4f2c16c9f93f34d19e4a0392ad41a5412d15c9671464d14d73a69`.
6. The WebGL and WebGPU RGBA8 results had identical SHA-256 `cb9e4d9859c67d8a2d414a52571886cf77adc70fc8da92cf7b729ef60b11636e`.
7. Cross-backend max-error and RMSE deltas were exactly zero in this fixture.

## Corrections and logical boundaries

- **Rejected:** “R49's roughly 0.005 final-target discrepancy means a single stable color sample can be wrong by roughly 0.005 merely because it is stored in RGBA8.” R54 isolates unblended stable storage and observes only about half-code quantization error. R49 included source-over blending and therefore measured a different path.
- **Rejected:** “R54 proves the full Gaussian final image is accurate to half a code.” It deliberately removes blending, cutoff and presentation transforms; that broader inference would be invalid.
- **Supported in this fixture:** direct stable TSL output stored from RGBA32F to RGBA8 behaves like ordinary 8-bit quantization and is exactly reproducible between the locked software WebGL/WebGPU paths.

## Boundaries

R54 does not cover Gaussian source-over blending, per-draw RGBA8 accumulation, browser presentation/sRGB conversion, tone mapping, hardware GPUs, Apple target devices, real assets or human acceptance.

## Routing

Three.js Delivery Mothers may use R54 as a stable-pixel storage baseline: if a future unblended no-transform final target exceeds one code versus the float intermediate, it is a regression or a declared pipeline change, not normal R54 quantization.

Photo Reconstruction Tool Mother candidate must not combine this storage bound with the cutoff uncertainty band. Edge coverage and stable color remain separate channels of evidence.

## Next real gap

Replay a controlled two-splat source-over blend through direct Three.js TSL using a blendable float intermediate and RGBA8 final target, so the additional error from per-draw final-target accumulation can be separated from the half-code stable-storage baseline. Presentation transforms and hardware/Apple execution remain later independent gates.
