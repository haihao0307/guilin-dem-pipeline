# Current Best View R60 — optical depth describes opacity, not precision risk by itself

Status: **Candidate partial**.

R60 refines R59. In the actual Three.js r186 `SPZLoader` -> `GaussianSplat` -> NormalBlending software-WebGL path, nearly equal effective optical depth did not imply similar default-Half versus Float behavior.

At target `tau=8`, seven cells spanned only `1.2019%` in actual tau, but their center Half/Float error ranged from `0.000608921` to `0.072907150` (`119.73x`); final sRGB differences ranged from zero to 29 codes. At target `tau=4`, actual tau spanned `1.9614%` while center-error ratio reached `674.36x` and display differences ranged from zero to 14 codes.

Therefore effective optical depth remains useful for ideal accumulated opacity, but it is **Rejected as a sole finite-precision risk predictor**. A precision gate must record at least:

- effective optical depth;
- per-write alpha distribution;
- overlap/write count;
- target format and rounding path;
- spatial footprint, view and order/color conditions for real assets.

The default Half target remains the unmodified validation start, not a demonstrated delivery baseline. Float remains a paired numerical counterfactual, not an automatic production promotion. Source floats and uncompressed reconstruction checkpoints remain Canonical Truth regardless of renderer-buffer choice.

R60 is a synthetic identical-splat stress grid in the same Chromium/SwiftShader evidence lineage as R59. It adds a new executable condition, not an independent physical Observation Root. WebGPU, hardware GPU, Safari/iPhone, real-photo reconstruction, performance/energy and human acceptance remain **Unknown**. Frozen R1 and production responsibilities are unchanged.

Next: test one predeclared second statistic on matched-tau, fixed-order mixed-alpha sequences; prefer a counterexample-driven sufficiency test over fitting a universal threshold.

