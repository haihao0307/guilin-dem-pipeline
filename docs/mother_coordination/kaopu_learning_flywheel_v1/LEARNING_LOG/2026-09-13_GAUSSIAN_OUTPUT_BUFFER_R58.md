# R58 bounded learning cycle — Three.js r186 default HalfFloat output buffer

## Question

What measurable difference does Three.js r186's default `HalfFloatType` internal output buffer introduce relative to the forced `FloatType` path used by R55–R57, and does the final sRGB canvas hide that difference?

## Locked method

- `three@0.186.0`, tag commit `148ef33ecb6d2502ff796d4554abd1549c95d519`.
- Playwright `1.57.0`, Headless Chromium `143.0.7499.4`, Google SwiftShader.
- Exact R55 stepwise-float32 premultiplied array, SHA-256 `0ca00d66d1646fd820cf6fca230460f4dd11b31d05c1a683aa12278603a1e520`.
- Two constructor cases: omit `outputBufferType` (the r186 default) and explicitly request `FloatType`.
- `SRGBColorSpace` plus `NoToneMapping` forces r186's internal framebuffer target. The probe reads the revision-pinned private target before output conversion, then separately captures the opaque-black sRGB canvas.
- Machine gate passed in workflow run `34750525794`; artifact `10315264196`, digest `ceb1a3508d58106ab241258b0cd0db88a8b27405be948046ce608038b82a3dbc`.

## Observations

1. In the working WebGL route, omitting the option selected `HalfFloatType`; the internal readback was `Uint16Array` (`2048` bytes for 256 RGBA pixels). Explicit `FloatType` returned `Float32Array` (`4096` bytes).
2. The Float path reproduced the 1024-channel locked source exactly (`maxAbs=0`, identical hash).
3. HalfFloat changed all 1024 channels. Its maximum absolute error was `0.000244140625`; RMSE was `0.00010213396882336865`. All decoded values were finite. These numbers describe this bounded `[0,1]` fixture, not a universal asset threshold.
4. On the opaque-black WebGL sRGB canvas, HalfFloat and Float differed in 18 of 768 RGB channels; the maximum difference was one 8-bit code and RMSE was `0.1530931` code. Thus later output conversion and 8-bit storage did not erase every internal half-float difference.
5. The HalfFloat canvas differed from its analytic stored-value prediction in one RGB channel by one code; the Float canvas matched its analytic prediction exactly. This is a fixture regression observation, not a perceptual threshold.
6. Both WebGPU internal-target readbacks ended at the R57 environment boundary: `GPUBuffer.mapAsync` reported that a valid external Instance reference no longer existed. No WebGPU HalfFloat-versus-Float number was observed.

## Official-source boundary

Pinned `Renderer.js` declares `HalfFloatType` as the constructor default and creates the color-conversion framebuffer with that type. Its `needsFrameBufferTarget` condition becomes true when output color space differs from the working space or tone mapping is active. Pinned `WebGPUTextureUtils.js` maps RGBA half and float textures to `rgba16float` and `rgba32float`; pinned `DataUtils.js` supplies the half-float decoder used by this probe.

The private `_frameBufferTargets` map was used only to inspect the fixed revision. It is not a public API recommendation.

## Status changes

- **Observation:** r186 default selection, target types, raw byte counts, WebGL readbacks and canvas bytes in the locked software execution.
- **Observation:** default HalfFloat altered every locked source channel but stayed within the observed fixture envelope.
- **Rejected:** the final 8-bit sRGB canvas necessarily hides all HalfFloat-versus-Float differences.
- **Rejected:** exact Float results justify making Float the production default without cost and target-runtime evidence.
- **Candidate / Current Best View:** retain HalfFloat as the baseline delivery candidate and Float as a diagnostic/reference option. Promotion or override requires a real asset to fail an agreed image criterion and must include the 2x internal color-buffer storage/bandwidth tradeoff.
- **Unknown:** WebGPU numeric equivalence in this environment, hardware GPU behavior, Safari/iPhone behavior and asset/perceptual significance.

## Transferable method

- Verify the renderer's actual default; do not infer it from a previous test that forced a different option.
- Compare the pre-transfer internal target and final display target separately.
- Record raw target type and byte count alongside numeric error; accuracy choices have memory/bandwidth costs.
- Keep finite-range, rounding error, final code-value difference and human acceptance as separate gates.
- An unreadable backend remains Unknown; another backend from the same browser software stack does not become independent physical evidence.

## Routing and next gap

Three.js Delivery Mothers should preserve the default HalfFloat candidate for current planning and keep Float as an opt-in diagnostic reference, not a global replacement. A future deterministic minimal SPZ/`GaussianSplat` render should repeat this comparison through the actual r186 splat object before any real-photo pilot. Hardware-backed Chromium and Safari/iPhone remain required for device acceptance.

Photo Reconstruction Tool Mother candidate receives a prepared test method only; no production adoption is claimed. Object DNA-bearing Mothers receive no production change. Frozen R1, Canonical Truth and production Mother branches remain unchanged. First-tier expert AI was not called.
