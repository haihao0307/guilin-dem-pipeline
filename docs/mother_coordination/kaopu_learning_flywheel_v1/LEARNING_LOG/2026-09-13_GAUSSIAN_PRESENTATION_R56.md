# R56 bounded learning cycle — Three.js canvas transfer and alpha presentation

## Question

When the exact R55 premultiplied float output is presented through Three.js r186, what do explicit Linear-sRGB versus sRGB output, transparent versus opaque background composition, and the browser screenshot path add?

## Executable evidence

- Pinned renderer: `three@0.186.0`, tag commit `148ef33ecb6d2502ff796d4554abd1549c95d519`.
- Browser harness: Playwright `1.57.0`, Headless Chromium `143.0.7499.4`, `pngjs@7.0.0`.
- Locked source: exact R55 stepwise float32 premultiplied source-over array, SHA-256 `0ca00d66d1646fd820cf6fca230460f4dd11b31d05c1a683aa12278603a1e520`.
- Rendering: `NoBlending`, offscreen RGBA32F `NoColorSpace`, renderer `FloatType` output buffer, `NoToneMapping`, explicit Linear-sRGB or sRGB output, transparent canvas, transparent/black/white page backgrounds.
- Readback: offscreen float API before presentation; Playwright PNG screenshot of the 256×1 CSS canvas rectangle during continuous rendering.
- Accepted workflow: run `34741403097`, artifact `10313240410`, digest `e078360a4930ae0dcb706689da515f359a924e738e5ab2fe13b013e697f6f31b`; machine gate `Candidate-pass`.

## Observations

1. Both software backends reproduced the locked R55 array exactly offscreen (`maxAbs=0`, identical hash).
2. WebGL black-background screenshots exactly matched analytic premultiplied 8-bit output for Linear-sRGB and sRGB.
3. WebGL white-background maximum error was one code in both output spaces.
4. Transparent PNG RGB maximum error was three codes for Linear-sRGB and four for sRGB; alpha maximum error was zero. Linear-sRGB and sRGB screenshot hashes differed for every background.
5. WebGPU screenshots were pure transparent, black or white background in all six cases even though its offscreen float result was exact. The result repeated with both single-frame capture and an active continuous presentation loop.

## Official-source interpretation

Pinned `Renderer.js` says screen output uses the configured tone mapping and output color space while non-output targets remain in the working color space. When a transform is required, it allocates an intermediate target and runs an output pass. Pinned `RenderOutputNode.js` clamps alpha, unpremultiplies, applies tone mapping and working-to-output color conversion, then premultiplies in the output color space. `ColorManagement.js` defines Linear-sRGB and sRGB with shared Rec.709 primaries but different transfer functions. `WebGPUBackend.js` configures the canvas with `alphaMode: 'premultiplied'` and `COPY_SRC` usage.

The WebGL black-background equality is consistent with those operations. The larger transparent PNG RGB residual is consistent with byte quantization plus unpremultiplication, but this is retained as **Candidate**, not promoted to an independently proven browser implementation detail.

## Failure and counterexample record

The first workflow (`34741165625`) showed a blank WebGPU screenshot. A swapchain-lifetime hypothesis motivated a continuous presentation-loop control (`34741271893`), but the canvas screenshot stayed blank. The specific cause remains **Unknown**. Because offscreen WebGPU bytes are exact, attributing the blank screenshot to Three.js color conversion is **Rejected**.

## Transferable method correction

- Preserve a hash-locked pre-presentation source so transfer tests cannot silently change reconstruction or blend inputs.
- Record output color space, tone mapping, output buffer type, alpha mode, background, and the exact readback location.
- Pair transparent captures with opaque black and white backgrounds. Transparent PNG mixes canvas storage, premultiplication and screenshot unpremultiplication.
- Treat an unavailable presentation readback as unavailable evidence; do not score its background pixels as color error and do not promote offscreen success to canvas success.
- Keep browser/backend repetitions within one Chromium/SwiftShader lineage distinct from independent device evidence.

## Boundaries and routing

R56 does not execute Gaussian cutoff, hardware GPU, Safari/iPhone, a real photo set, COLMAP/Brush training or human acceptance. Three.js Delivery Mothers may use the WebGL fixture as a regression and must retain WebGPU presentation as unavailable in this environment. Photo Reconstruction Tool Mother candidate receives no adoption claim or production task.

## Next real gap

Read the WebGPU current texture directly to a mapped buffer immediately after render, using its declared `COPY_SRC` usage. Record swapchain format, padded bytes-per-row, alpha mode, output transfer and timing. This can separate Three.js/WebGPU output bytes from the still-Unknown Headless Chromium screenshot/compositor path.
