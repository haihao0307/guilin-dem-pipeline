# R49 bounded learning cycle — Gaussian float-target separation

## Question

How much of R48's CPU-to-framebuffer discrepancy comes from shader/raster floating-point evaluation, and how much appears only when the result is stored and blended in the final `RGBA8` target?

## Evidence status

- **Observation:** pinned Three.js r186 equations and blending semantics are inherited from R47/R48 and remain the same source lineage, not a new independent Observation Root.
- **Candidate executable evidence:** R49 attached an `RGBA32F` texture framebuffer to the same surfaceless Mesa llvmpipe context, ran the R48 independent shader and source-over blend, read back floats, and compared them with continuous CPU and `RGBA8` results. Two outputs were byte-identical with SHA-256 `0a7aa6a811a864af9bdc14901c889037f4ee986daee88043bc3c8c8898b1f380`.
- **Unknown:** Three.js-generated TSL, WebGL/WebGPU, hardware GPUs, browser output transforms, Safari/iPhone, learned assets, real photos and human acceptance.

## New or corrected knowledge

1. `RGBA32F` versus continuous CPU maximum error was `9.94916e-8` for the reference and `6.48086e-8` for the candidate. No pixel changed covered/uncovered status.
2. The reference/candidate maximum difference was `0.0851302859` in continuous CPU and `0.0851303041` in `RGBA32F`, a delta of only `1.82347e-8`.
3. Converting the same backend path to the final `RGBA8` target introduced maxima of `0.00497459` and `0.00537919` relative to `RGBA32F`; the combined maximum fell to `0.0823529`, `0.00277736` below the float-target maximum.
4. For this fixture, R48's materially larger discrepancy is therefore attributable to final-target storage/blending behavior, while the float analytic path closely tracks the CPU equations.

## Counterexamples and boundaries

- **Rejected:** “the independent shader's floating-point evaluation explains the approximately `0.005` R48 discrepancy.” Its measured contribution stayed below `1e-7` here.
- **Rejected:** “a smaller final `RGBA8` reference/candidate difference proves improved fidelity.” Quantization can mask part of a float difference.
- **Preserved:** final framebuffer format is an independent acceptance variable and cannot be omitted from evidence.
- The result uses the same llvmpipe executable root as R48. It does not add an independent physical Observation Root and cannot be generalized across browser backends or GPUs.

## Routing

Prepared-only guidance goes to Three.js Delivery Mothers: compare analytic CPU, float render target and final presentation target separately. Always record target format and output transforms; do not infer fidelity from a lower quantized delta. Photo Reconstruction Tool Mother candidate retains float checkpoints and asset-specific image tests. Object DNA-bearing Mothers receive no production action.

R48 Mother feedback remains null and acknowledgement false. First-tier expert AI was not called; no expert or Mother meeting was duplicated.

## Next real gap

Execute the same fixture through pinned Three.js r186-generated TSL on WebGL fallback or WebGPU, reading both a float intermediate target and final target with explicit color-space/tone-map state and edge pixels. Hardware-GPU, Safari/iPhone and real-photo gates remain separate.
