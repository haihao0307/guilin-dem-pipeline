# Learning Log R78 — A preregistered Half-boundary counterexample selects staged Float32 replay

Status: **Candidate partial**. Date: 2026-09-15.

## Question

Can a fixed Three.js r186 blend fixture force `f32-final` and `f32-staged` onto opposite Half results, then use independent prefix readback to select one model or reject both?

## Method and preregistration

- Three.js remained pinned to `0.186.0`, tag commit `148ef33ecb6d2502ff796d4554abd1549c95d519`, with official `GaussianSplat.js` blob `06d37fe6af583cf8cbdf8bd93565403bc3b94691`.
- A CPU breadth-first search used the earlier center Alpha estimate only to derive a two-record candidate: Alpha byte 193 with red 255, followed by Alpha byte 144 with black. Rotation `0xc0000115`, scale bytes `[128,96,96]`, camera `[0,0,2]`, Half target and `33x33` frame were fixed.
- The runner first rendered independent Float calibration pages for Alpha bytes 193 and 144. It was forbidden to render the target unless those actual calibration values made the two preregistered models predict different Half output.
- Only after this check did it independently render Half prefixes 1 and 2, plus a separate duplicate prefix-2 control. Acceptance required exact decoded Half equality.

## Observation

- Actual center effective Alpha was `0.3139647841453552` for byte 193 and `0.23425349593162537` for byte 144.
- After the first record, both models and the renderer produced red `0.31396484375`.
- At the second record, `f32-final` predicted pre-Half `0.24041748046875`, rounding to `0.240478515625`; `f32-staged` predicted pre-Half `0.2404174655675888`, rounding to `0.2403564453125`. The predictions differed by one Half ULP, `0.0001220703125`, at exactly the center red channel.
- Independent prefix-2 readback matched `f32-staged` across all 4,356 decoded Half channels and differed from `f32-final` only at that center red channel by one ULP. Prefix 1 matched both, as expected.
- The independent duplicate prefix-2 control was bit-identical to the first target render, with decoded hash `3fbda5390c20767dcc3086564527b5df88ef80d8e427a67c28b3461dbe566c2b`.
- All eight evidence-contract checks passed in workflow run `34918687978`.

## Candidate / Current Best View delta

For this fixed Chromium 143 / ANGLE Vulkan SwiftShader `NormalBlending` path, the observed Half result is consistent with staging the complement, products and sum through Float32 before Half storage. R77's ambiguity is closed for this synthetic counterexample.

This selects a diagnostic replay model for one observation root; it does not expose the driver's internal instructions, prove that every blend takes the same operation path, or establish cross-backend behavior.

## Rejected

1. A target rendered before proving model divergence can identify the operation order without selection bias.
2. `f32-final` is bit-exact for the locked two-record counterexample.
3. Agreement on the first prefix alone selects an operation order.
4. One software counterexample proves fixed-function behavior on hardware GPU, WebGPU, Safari/iPhone or production assets.

## Unknown and boundaries

- Fixed-function instructions, fusion and the reason for the staged-equivalent result remain Unknown; only input/output behavior was observed.
- Generality across other Alpha/color combinations, positions, footprints, renderer versions and output formats remains Unknown.
- This is the same Chromium/ANGLE Vulkan SwiftShader software Observation Root as R59-R77, not an independent hardware root.
- Hardware GPU, WebGPU, Safari/iPhone, real reconstruction, target performance and human acceptance remain Unknown.
- Mother adoption is unacknowledged. Production branches, Canonical Truth and Frozen R1 are unchanged.
- First-tier expert AI was not called; this was bounded executable verification, not the separate expert meeting.

## Transferable method

To identify a low-precision arithmetic contract, first construct inputs whose candidate models straddle a representable-output midpoint; lock the inputs and decision rule; verify divergence from independently measured inputs before observing the target; then use independent prefixes and a duplicate control. Ordinary fixtures that collapse both models to the same stored value cannot identify their operation order.

## Next gap

Preregister a small matrix of independently derived Half-boundary counterexamples that separates complement, product and sum staging across multiple color channels and signs/ranges permitted by the route. Require the same pre-target divergence and duplicate-control gates before treating `f32-staged` as a reusable bit-exact diagnostic model. Keep cross-backend and target-device acceptance separate.
