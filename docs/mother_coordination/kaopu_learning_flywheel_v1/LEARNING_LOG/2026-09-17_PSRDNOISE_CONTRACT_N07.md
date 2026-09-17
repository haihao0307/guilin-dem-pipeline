# N07 — psrdnoise period, derivative, wrapping and phase contract

## Bounded question

N02-4 asks whether psrdnoise composition retains requested spatial and temporal continuity. This round fixes the official 2-D implementation and tests only period validity, per-axis wrapping, analytic derivatives, coordinate scaling and gradient-rotation phase. It does not implement erosion, fluid state or a production shader.

## Fixed sources and method

- Primary implementation: [stegu/psrdnoise](https://github.com/stegu/psrdnoise/tree/419175a270862ce7ae692038fafafb42ec0427e9), revision `419175a…27e9`, `src/psrdnoise2.glsl`, MIT.
- Primary raw-byte SHA-256: `3abb8a20…58a6`; source version date 2021-12-02.
- Authors' open paper: [Tiling simplex noise and flow noise in two and three dimensions](https://jcgt.org/published/0011/01/02/), JCGT 11(1), 2022.
- Legacy comparison: [stegu/webgl-noise psrdnoise2D](https://github.com/stegu/webgl-noise/blob/22434e04d7753f7e949e8d724ab3da2864c17a0f/src/psrdnoise2D.glsl), raw SHA-256 `e945bcbb…0383`.
- A deterministic scalar C++ port mirrors the pinned GLSL equations. It evaluates 4,096 fixed points, values and gradients across seams, central finite differences, scaled coordinates, phase recurrence and a constant-translation negative control.
- The CPU port is semantic evidence from the same source chain, not an independent shader implementation or GPU Observation Root.

Probe: [`psrdnoise_contract_probe_n07.cpp`](../PROBES/psrdnoise_contract_probe_n07.cpp)  
Result: [`psrdnoise_contract_result_n07.json`](../PROBES/psrdnoise_contract_result_n07.json)  
Source receipt: [`SOURCE_LOCK.json`](../references/psrdnoise-contract-n07/SOURCE_LOCK.json)

## Observation

All 15 CPU checks passed, and a second local execution reproduced the complete JSON byte-for-byte.

- With period `(5,4)`, values and analytic gradients repeated across x, y and combined shifts within the recorded 12-decimal precision.
- With declared period `(5,3)`, a y shift of 3 had value RMSE `0.64094` and gradient RMSE `3.70908`; a y shift of 6 closed exactly. The odd input is not its own y period.
- A fractional x period `4.5` produced value RMSE `0.61804` and gradient RMSE `3.36066`. The function does not validate, round or repair this input.
- Period `(5,0)` preserved x tiling while y remained unwrapped: shifting y by 4 had value RMSE `0.67916`. Nonpositive components disable wrapping independently.
- The pinned 2021 `alpha` uses radians. `alpha+2π` reproduced the value and gradient, while `alpha+1` had value RMSE `0.45648`. The legacy 2016 API's “1.0 is one full turn” contract cannot be copied into this version.
- Analytic gradients matched finite differences with RMSE `1.59e-9`. For `n(fx)` at frequency 1.5, multiplying the returned gradient by 1.5 gave RMSE `5.19e-9`; omitting the chain factor gave RMSE `1.22567`.
- A 4 m world period sampled at frequency 1.5 maps to lattice period `(6,6)` and tiled. A 5 m x period maps to invalid lattice period `7.5` and failed with value RMSE `0.65849`.
- Fitting one constant translation velocity to alpha evolution left `99.89%` relative RMS residual. This rejects one rigid-translation explanation; it does not prove or disprove every possible velocity field.

## Candidate / Current Best View

1. Store implementation revision and phase unit with every animated procedural field. “psrdnoise” alone is insufficient because old and new public functions use different rotation units.
2. Express period in the function's scaled coordinate domain. For 2-D tiling, require integer x and even-integer y after scaling; fail closed on fractional values rather than silently rounding them.
3. Record value and gradient seam errors independently. Value continuity alone does not establish normal continuity.
4. Apply the chain rule after coordinate scaling. If psrdnoise is used after N04 domain warp, multiply by the complete warp Jacobian rather than only the scalar frequency.
5. Treat `alpha` as a presentation phase that rotates lattice gradients. Define radians per second and loop time explicitly; `2π` phase recurrence is not material displacement.
6. Keep water, sediment, mass, sources/sinks and history in a separate stateful process. A flow-like image is not physical advection or erosion evidence.

Status: **Candidate partial / pinned-source CPU semantic verified**. N02-4 is complete only at source and CPU-method level.

## Rejected

- “Any positive float is a valid seamless period.”
- “Odd y repeats after the declared odd period.”
- “A zero period means a zero-length tile.”
- “The current alpha uses turns because the older rot parameter did.”
- “Returned derivatives are already world-space after coordinate scaling or warp.”
- “Rotating-gradient animation transports material or proves fluid flow.”
- “A CPU semantic port proves GLSL, WGSL or HLSL runtime parity.”

## Unknown / routing state

- Actual GLSL precision, compiler dead-code elimination, GPU cost, browser/iPhone behavior and WGSL/HLSL parity remain Unknown.
- Multi-octave period compatibility, temporal sampling/aliasing and target visual quality remain separate acceptance work.
- Landscape PR79 and Farmland PR65 still have no feedback after the existing N02 publication; no message was repeated.
- Brick material PR15, Brick shape PR17 and Tiles/building PR11 remain verified entries only. Routing is prepared but not delivered; no adoption is claimed.
- Canonical Truth, Frozen R1 and all production branches remain unchanged.

## Next learning gap

Advance N02-5 independently: construct a bounded conservative erosion counterexample that explicitly stores water, sediment, sources/sinks, boundaries and history, inheriting W01-W03 event and time contracts. Noise may seed heterogeneity but cannot replace those states.

First-tier expert AI was not called; routine expert discussion remains owned by the separate night expert task.
