# Current Best View R56 — Three.js canvas presentation is a separate evidence channel

Status: **Candidate partial**.

R56 feeds the exact R55 stepwise float32 premultiplied source-over result into pinned Three.js r186 with `NoBlending`, preserving source hash `0ca00d66d...`. Both software WebGL and WebGPU reproduced it exactly in an offscreen RGBA32F `NoColorSpace` target. Presentation was then tested with `NoToneMapping`, explicit `LinearSRGBColorSpace` or `SRGBColorSpace`, a premultiplied-alpha canvas, and transparent, black and white page backgrounds.

The WebGL screenshots distinguished Linear-sRGB from sRGB output. Black-background captures exactly matched the analytic 8-bit premultiplied result for both output spaces. White-background captures differed by at most one code. Transparent PNG alpha matched, but RGB differed by at most three codes for Linear-sRGB and four for sRGB; those residuals are consistent with a quantized premultiplied-to-straight conversion but that cause remains a Candidate interpretation.

WebGPU is not a presentation success. Its offscreen float result was exact, but all six page screenshots contained only the requested page background. A continuous render-loop control reproduced the same failure. This establishes a headless presentation-readback limitation in the tested lineage, not a Three.js color-space defect. WebGPU canvas color bytes remain **Unknown** until they are read directly from the current texture or tested in another validated presentation path.

R55 blend accumulation, R50-R53 cutoff coverage, R56 presentation and later device/human acceptance remain separate. The R56 code widths are fixture observations, not production or perceptual thresholds. Software WebGL and WebGPU share Chromium/SwiftShader lineage and are not independent physical roots.

Next: copy the WebGPU canvas current texture to a mapped buffer immediately after a locked frame, before browser screenshot composition. Declare swapchain format, row padding, alpha mode, output color space and readback timing. Compare those bytes with the R56 analytic expectations and keep the headless screenshot failure as a separate presentation-layer Unknown.

Frozen R1, Canonical Truth and production Mother branches remain unchanged.
