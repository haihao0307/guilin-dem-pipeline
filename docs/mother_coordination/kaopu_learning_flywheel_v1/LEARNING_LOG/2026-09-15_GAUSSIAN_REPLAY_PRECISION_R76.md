# Learning Log R76 — Float32 blend replay closes the terminal fixture only

Status: **Candidate partial (classified)**. Date: 2026-09-15.

## Question

Which bounded source/readback or arithmetic distinction explains R75's `0.00048828125` Half replay mismatch on the fixed nominal-45-degree eccentric footprint?

## Locked source and fixture

- Three.js remains pinned to `0.186.0`, tag commit `148ef33ecb6d2502ff796d4554abd1549c95d519`.
- Official `GaussianSplat.js` blob `06d37fe6af583cf8cbdf8bd93565403bc3b94691` returns fragment Alpha as `exp(-0.5*r2) * splatColor.a` and the material uses `NormalBlending`.
- R75 camera, 1,941 source records, identity order, scale bytes `[128,96,96]`, packed quaternion `0xc0000115`, Half target, viewport and Chromium/ANGLE Vulkan SwiftShader route remain fixed.
- Two source candidates were tested: Float single-splat Alpha readback and Half single-splat Alpha readback. Three arithmetic candidates were predeclared: JavaScript double, a Float32-rounded final blend expression, and Float32-staged factor/products/sum.

## Observation — valid terminal evidence

- The inherited Float-calibration/double replay mismatch reproduced exactly: 6 of 4,356 final RGBA channels differed, with maximum difference `0.00048828125`.
- Float calibration plus Float32 rounding before Half conversion matched all 4,356 final channels exactly. The `f32-final` and `f32-staged` variants produced the same final hash `14673a27afe2fd387cd7b7e55229a13d7ed0cad9e7051fc494e1adc879a68c8c` on this fixture.
- Half single-splat calibration did not close the result under any tested arithmetic model: all three retained 6 final mismatches of maximum `0.00048828125`.
- Float and Half single-splat Alpha maps differed at 13 pixels for every Alpha class. Their maximum absolute differences were `2.07917765e-7`, `4.15835530e-7`, and `1.66334212e-6` for source Alpha bytes 1, 2, and 8.

## Failed subprobe retained

The predeclared scissored prefix-series path returned `[0,0,0,0]` at its final selected-pixel checkpoint, while the independently rendered full frame at the same pixel was `[0.31787109375,0.29248046875,0.3232421875,0.88818359375]`. The first run's length/finite-value gate was insufficient and is **Rejected**. The second run requires this invalidity to remain explicit. No first-divergence or intermediate-write claim uses the series.

## Candidate

For this exact SwiftShader fixture, Float-calibrated fragment Alpha plus Float32 blend evaluation before nearest-even Half storage is a candidate explanation of R75's terminal mismatch. Diagnostic replay code should declare its arithmetic precision rather than allowing host-language double evaluation to stand in silently.

This is not yet a formal per-write or cross-backend proof. Terminal equality can hide intermediate disagreement, and the two Float32 variants were not separated by this fixture.

## Rejected

1. Half one-splat readback is automatically a more faithful replay source than Float calibration.
2. Final-frame equality alone establishes intermediate-write equality.
3. A prefix capture is valid merely because its array length is correct and every value is finite.

## Unknown and boundaries

- A valid sequence of actual intermediate Half checkpoints is still missing.
- Whether the fixed-function path behaves like `f32-final`, `f32-staged`, fused arithmetic, or another equivalent expression at every write is Unknown.
- Formal bounds, other covariance footprints, WebGPU, hardware GPUs, Safari/iPhone, target performance, real photo assets and human acceptance remain Unknown.
- This remains the same Chromium/SwiftShader observation root as R59-R75.
- Mother adoption is unacknowledged. Production branches, Canonical Truth and Frozen R1 are unchanged.
- First-tier expert AI was not called; this was executable verification, not the separate expert meeting.

## Next gap

Replace the invalid scissored series with independently rendered sparse prefix checkpoints whose final checkpoint must equal the full-frame control before any sequence analysis. Use adversarial prefixes around the first disagreement candidates to distinguish `f32-final` from `f32-staged`; keep terminal and per-write gates separate.
