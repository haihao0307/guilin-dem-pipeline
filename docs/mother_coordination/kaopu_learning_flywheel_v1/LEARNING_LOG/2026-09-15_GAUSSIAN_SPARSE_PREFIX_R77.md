# Learning Log R77 — Independent sparse prefixes close the sampled writes but cannot separate two Float32 models

Status: **Candidate partial**. Date: 2026-09-15.

## Question

Do independently rendered sparse Half checkpoints preserve R76 terminal replay equality, and can adversarial predicted-divergence checkpoints distinguish `f32-final` from `f32-staged`?

## Method and preregistration

- Three.js remained pinned to `0.186.0`, tag commit `148ef33ecb6d2502ff796d4554abd1549c95d519`, with official `GaussianSplat.js` blob `06d37fe6af583cf8cbdf8bd93565403bc3b94691`.
- The R75/R76 nominal-45-degree fixture remained fixed: 1,941 records, identity order, packed rotation `0xc0000115`, scale bytes `[128,96,96]`, camera `[0,0,2]`, Half target and `33x33` frame.
- Seven prefixes were declared before execution: `1/32/128/512/1024/1536/1941`.
- Before reading any observed prefix, the runner scanned the two predicted state sequences for their first, maximum and last divergence and would add each step plus/minus one, capped at 16 checkpoints.
- Every selected checkpoint was a separate full-frame render and readback. Prefix 1,941 had to match a second independently rendered complete-frame control exactly.

## Observation

- The prediction scan found **zero divergent channel-states** between `f32-final` and `f32-staged` across all 1,941 steps and all 4,356 Half-decoded channels per step. Consequently no adversarial prefix existed in this fixture and only the seven fixed prefixes were rendered.
- At each of the seven independently rendered prefixes, both models matched all 4,356 observed channels exactly: zero mismatches and zero maximum absolute difference.
- The independently rendered prefix-1,941 frame and full-frame control were bit-identical, with decoded hash `73665ee5e47eb730503006526464732749088ac21584891310a5353162bba922`.
- All ten contract checks passed in workflow run `34910279853`.

## Candidate / Current Best View delta

R76's terminal closure was not an accidental consequence of the invalid scissored series: explicit Float32 evaluation before nearest-even Half storage also closes seven valid independently rendered prefixes on this fixed fixture.

However, this fixture cannot identify the fixed-function operation order. After every modeled write, Half storage collapses `f32-final` and `f32-staged` to the same predicted value everywhere. Agreement with either is therefore not independent support for one expression over the other.

## Rejected

1. The invalid R76 scissored series can be rehabilitated merely because later independent prefixes pass.
2. The nominal-45-degree fixture can distinguish `f32-final` from `f32-staged`.
3. Seven exact sparse checkpoints prove all 1,941 actual writes or another backend.

## Unknown and boundaries

- The 1,934 unobserved actual prefix frames remain Unknown even though the two CPU predictions coincide there.
- The fixed-function blend implementation, fusion and operation ordering remain Unknown.
- This is the same Chromium 143 / ANGLE Vulkan SwiftShader software Observation Root as R59-R76, not an independent hardware root.
- Formal cross-backend proof, WebGPU, hardware GPU, Safari/iPhone, real reconstruction, target performance and human acceptance remain Unknown.
- Mother adoption is unacknowledged. Production branches, Canonical Truth and Frozen R1 are unchanged.
- First-tier expert AI was not called; this was bounded executable verification, not the separate expert meeting.

## Next gap

Construct and preregister a small r186 blend fixture whose source Alpha, color and Half destination states place `f32-final` and `f32-staged` on opposite sides of a Half rounding boundary. Require a predicted divergence before rendering, then use independent full-frame prefix readbacks to select one model or reject both. Keep this diagnostic counterexample separate from asset-quality and production decisions.
