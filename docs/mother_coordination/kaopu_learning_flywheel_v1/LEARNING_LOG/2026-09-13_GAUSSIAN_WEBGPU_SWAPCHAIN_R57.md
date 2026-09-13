# R57 bounded learning cycle — Three.js WebGPU current-texture readback

## Question

Can the exact R55 source be read directly from the Three.js r186 WebGPU canvas current texture, separating renderer output bytes from R56's blank screenshot/compositor path?

## Locked method

- `three@0.186.0`, tag commit `148ef33ecb6d2502ff796d4554abd1549c95d519`.
- Playwright `1.57.0`, Headless Chromium `143.0.7499.4`, Google SwiftShader.
- Exact R55 stepwise-float32 premultiplied array, SHA-256 `0ca00d66d1646fd820cf6fca230460f4dd11b31d05c1a683aa12278603a1e520`.
- Explicit Linear-sRGB and sRGB output, `NoToneMapping`, transparent premultiplied canvas.
- Canvas format `bgra8unorm`; declared copy row pitch `1024` bytes for 256 RGBA8 pixels.
- Positive control: Three.js RGBA32F `NoColorSpace` render-target readback on the same page and device.
- Direct attempt: acquire `GPUCanvasContext.getCurrentTexture()`, submit a synchronous Three canvas render, immediately submit `copyTextureToBuffer`, then map the destination buffer.

Accepted workflow: run `34746373524`, artifact `10314740422`, digest `409409bdd58d5929c66b8c708d9ac00fa86e4c4ad2eecc589948d5c9c583af79`; machine gate `Candidate-pass` means the outcome was fully classified, not that canvas bytes were obtained.

## Observations

1. The RGBA32F positive control exactly reproduced the locked source for both output-space pages (`maxAbs=0`, identical hash).
2. Both current-texture copies reached `copy-submitted-map-pending`, then `GPUBuffer.mapAsync` raised the same `AbortError`: `A valid external Instance reference no longer exists.` No current-texture byte was observed.
3. The transparent screenshot control remained all zero bytes in both output spaces, with common hash `5f70bf18...`.
4. Two earlier lifecycle variants reproduced the same error: copy after `renderAsync` (run `34746045676`), and offscreen warmup followed by synchronous canvas render/copy (run `34746128331`). Canvas-format warmup plus an animation-frame boundary did not change it.

## Official-source boundary

Pinned `WebGPUBackend.js` configures the canvas with `RENDER_ATTACHMENT | COPY_SRC` and premultiplied alpha. Pinned `WebGPUUtils.js` selects the preferred canvas format when no explicit canvas `outputType` is supplied; the runtime reported `bgra8unorm`. Thus the requested copy usage and observed format are explicit. The stable `AbortError` is still only an executable observation of this Headless Chromium/SwiftShader lineage; its internal cause is **Unknown**.

## Status changes

- **Observation:** same-page Three RGBA32F readback is healthy and exact.
- **Observation:** three current-texture timing/prewarm variants all failed before mapped bytes became available.
- **Rejected:** moving the copy before an `await` boundary is sufficient in this environment.
- **Rejected:** exact offscreen bytes prove canvas or screenshot presentation.
- **Candidate:** the failure lies at a headless current-texture/external-instance boundary rather than in the locked offscreen calculation. This is not an independent implementation proof.
- **Unknown:** actual swapchain bytes and the specific Chromium/Dawn/SwiftShader cause.

## Transferable method

- Add a same-device offscreen positive control before interpreting canvas readback failures.
- Treat `copy command submitted` and `mapped bytes obtained` as separate milestones.
- Record current-texture acquisition timing, canvas format, copy usage, row pitch, alpha mode and output transfer.
- An unavailable current-texture readback cannot localize a blank screenshot and must not be converted into pixel-error numbers.
- Repeated variants within one Chromium/SwiftShader lineage improve failure characterization but add no independent physical Observation Root.

## Routing and next gap

Three.js Delivery Mothers should keep WebGPU canvas presentation unavailable in this environment and require another validated browser/device route before acceptance. Photo Reconstruction Tool Mother candidate receives no adoption claim. Object DNA-bearing Mothers receive no production change.

The next CPU/software-verifiable gap is the default Three.js `HalfFloatType` output-buffer route versus the R55/R56 forced `FloatType` route. Hardware-backed Chromium and Safari/iPhone current-texture/presentation checks remain infrastructure-dependent.

Frozen R1, Canonical Truth and production Mother branches remain unchanged. First-tier expert AI was not called.
