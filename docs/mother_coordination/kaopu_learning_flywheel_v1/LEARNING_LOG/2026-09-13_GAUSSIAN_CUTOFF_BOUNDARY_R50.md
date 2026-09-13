# R50 bounded learning cycle — Gaussian cutoff boundary

## Question

Can a double-precision CPU reference predict the fixed `r² > 4` Gaussian coverage decision at float-neighbor edge pixels, or must effective shader precision be part of the acceptance contract?

## Evidence status

- **Observation:** pinned Three.js r186 uses a strict `r² > 4` fragment discard. This source is inherited from R47-R49 and is not a new independent root.
- **Candidate executable evidence:** R50 sampled 4,644 cases across six scales, six directions and 129 adjacent float32 x-values on the existing Mesa llvmpipe `RGBA32F` framebuffer. Two outputs were byte-identical with SHA-256 `a44e50357d44fca2020649cf4c52d1cb570b801c61bdb59126903e134c36d4d3`.
- **Unknown:** Three.js-generated TSL, WebGL/WebGPU compiler behavior, hardware GPUs, browsers, Safari/iPhone, learned assets and human acceptance.

## New or corrected knowledge

1. The stepwise float32 predicate matched backend covered/discarded status in all 4,644 cases. The double-precision predicate disagreed in 32 cases.
2. All 32 disagreements were double-outside/backend-inside: double `r²` exceeded four by `2.69e-8` to `4.24e-7`, while float32 rounded the value to exactly `4.0`; the strict greater-than test retained the fragment.
3. The first counterexample had double `r²=4.00000021195`, float32 `r²=4.0`, and backend alpha `0.06766765` rather than discard.
4. All six exact one-axis `r²=4` controls were retained, confirming that `>` and `>=` are observably different contracts.

## Counterexamples and boundaries

- **Rejected:** “double-precision CPU coverage is automatically authoritative at the Gaussian hard cutoff.”
- **Rejected:** “a tiny positive double excess above four guarantees the float shader discards.”
- **Candidate method:** classify cutoff-neighbor pixels separately, compare stable pixels normally, and report boundary coverage mismatches rather than hiding or globally tolerating them.
- The measured `4.24e-7` maximum is not a universal guard band. Compiler contraction, precision, transform path and hardware can change it.

## Routing

Prepared-only guidance goes to Three.js Delivery Mothers: preserve float-effective cutoff evaluation or declare an uncertainty mask near `r²=4`; report coverage mismatch separately from color error. Photo Reconstruction Tool Mother candidate should not convert this synthetic width into an asset threshold. Object DNA-bearing Mothers receive no production action.

R49 Mother feedback remains null and acknowledgement false. First-tier expert AI was not called; no expert or Mother meeting was duplicated.

## Next real gap

Run the boundary fixture through pinned Three.js r186-generated TSL on WebGL fallback and WebGPU, then compare float intermediate and final targets. Record compiler/backend identity and edge masks before any device or real-photo criterion is proposed.
