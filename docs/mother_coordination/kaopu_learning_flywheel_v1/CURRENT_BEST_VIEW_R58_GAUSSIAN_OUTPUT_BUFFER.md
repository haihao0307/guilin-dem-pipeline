# Current Best View R58 — HalfFloat remains the baseline candidate, Float remains a reference route

Status: **Candidate partial**.

Three.js r186 defaults its output-conversion framebuffer to `HalfFloatType`. In the locked R55 `[0,1]` premultiplied fixture, the WebGL Float path was exact while HalfFloat changed all 1024 channels with maximum absolute error `0.000244140625` and RMSE `0.000102134`. The HalfFloat target used half the raw color storage of Float in this 256-pixel readback (`2048` versus `4096` bytes).

The final opaque-black sRGB canvas did not erase all of the difference: 18 of 768 RGB channels differed, by at most one 8-bit code. This rejects display-quantization-as-equivalence, but the fixture supplies neither a real-asset nor a perceptual rejection threshold.

Current best view: keep HalfFloat as the baseline delivery candidate because it is the fixed renderer default and has the lower observed storage cost; keep Float as a diagnostic/reference option. Do not make either a production-wide choice from this synthetic fixture. An override needs a real splat asset, fixed views, an agreed image criterion, target-device memory/performance measurements and human acceptance.

WebGPU HalfFloat-versus-Float readback remains **Unknown** because both cases encountered the same external-instance `mapAsync` boundary as R57. Hardware GPU, Safari/iPhone, real-photo reconstruction and human acceptance remain Unknown. No independent physical Observation Root was added.

Next: run the same comparison through a deterministic minimal SPZ loaded into the actual r186 `GaussianSplat` object. Preserve source floats/uncompressed reconstruction as Canonical Truth; neither output-buffer choice changes Frozen R1.
