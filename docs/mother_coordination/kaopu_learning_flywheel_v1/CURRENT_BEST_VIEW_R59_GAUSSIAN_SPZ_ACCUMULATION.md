# Current Best View R59 — output precision is overlap-conditioned

Status: **Candidate partial**.

R59 corrects the R58 preference wording. Three.js r186's default `HalfFloatType` is the unmodified validation starting point, not a proven delivery baseline. `FloatType` is a paired counterfactual, not an automatic production replacement.

In the actual r186 `SPZLoader` -> `GaussianSplat` -> NormalBlending software-WebGL path, a locked 4,096-splat low-alpha/high-overlap fixture produced a one-layer Half/Float maximum difference of about `1.19e-6`. The full internal-target difference grew to `0.060539484` at 4,096 layers. The Half center stopped changing at the sampled 512-layer value `0.96337890625`; Float reached `0.99999552965`. The final opaque-black sRGB canvas differed by as much as 15 codes.

Therefore a one-write precision test cannot bound iterative splat accumulation, and final display quantization cannot be assumed to hide it. This is a synthetic stress result, not evidence that a real reconstruction, target phone or user will reject HalfFloat. It also does not show that Float's extra target storage improves end-to-end quality enough to justify its cost.

Current decision contract:

- preserve the pinned renderer default as the first test configuration only;
- compare Half and Float under identical asset, view, sort, kernel, output and backend conditions when overlap risk is plausible;
- override Half only in a declared domain where it fails a predeclared image criterion and paired Float passes, with measured device cost;
- if both fail, do not silently select Float;
- preserve source floats/uncompressed reconstruction as Canonical Truth regardless of renderer-buffer choice.

WebGPU, hardware GPU, Safari/iPhone, real-photo reconstruction, useful overlap-risk thresholds, performance/energy and human acceptance remain **Unknown**. No independent physical Observation Root was added. Frozen R1 and production responsibilities remain unchanged.

Next: map a deterministic alpha-by-overlap grid through the same actual path and test whether effective optical depth predicts Half/Float divergence well enough to route real-asset validation.
