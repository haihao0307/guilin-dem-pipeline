# Current Best View R57 — WebGPU canvas evidence remains unavailable in the tested headless lineage

Status: **Candidate partial**.

R57 attempted the direct readback required by R56. Three.js r186 configured a `bgra8unorm` WebGPU canvas with `COPY_SRC` and premultiplied alpha. For Linear-sRGB and sRGB pages, a same-page RGBA32F positive control exactly matched the locked R55 source, while a pre-acquired current texture, synchronous canvas render and immediately submitted copy failed at destination-buffer `mapAsync` with the same `AbortError`. Two earlier timing/prewarm variants produced the same failure. The screenshot control stayed fully transparent.

Therefore R56's blank WebGPU screenshots cannot be localized further in this environment. Exact offscreen output does not prove canvas presentation; the failed current-texture readback also does not prove that Three emitted blank canvas bytes. Actual swapchain bytes and the specific Chromium/Dawn/SwiftShader cause remain **Unknown**.

The transferable rule is to separate successful render-target readback, successful copy submission, successful buffer mapping and browser presentation. A failure at one stage cannot stand in for evidence from another. All R57 executions share one Headless Chromium/SwiftShader lineage and add no independent physical Observation Root.

Next: compare the default Three.js `HalfFloatType` output-buffer route with the locked forced-`FloatType` fixture in software-verifiable offscreen paths. Defer WebGPU canvas acceptance to a hardware-backed Chromium or Apple Safari/WebKit route that can actually expose presentation bytes.

Frozen R1, Canonical Truth and production Mother branches remain unchanged.
