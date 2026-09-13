# R52 bounded learning cycle — confirmed Three.js r186 TSL WebGPU cutoff replay

## Question

Does the R50/R51 hard-cutoff conclusion survive direct execution through a confirmed Three.js r186 WebGPU backend, or is the agreement specific to the WebGL path?

## Browser-compatibility correction before the valid run

The first R52 attempt successfully initialized `actualBackend=webgpu` but failed before the first sweep render. The failure was `GPUTexture.createView()` rejecting the `swizzle` descriptor used by Three.js r186. The harness was still pinned to Playwright 1.55 / Chromium 140, while texture-component swizzle is a later WebGPU surface. That attempt is retained as a browser/API compatibility counterexample, not Gaussian evidence.

The valid R52 execution therefore kept Three.js fixed at `0.186.0` and advanced only the browser harness to Playwright `1.57.0`, whose Chromium baseline is 143. No Three.js source patch or private WebGPU shim was introduced.

## Evidence status

- **Direct renderer execution:** pinned `three@0.186.0`, `WebGPURenderer`, confirmed `actualBackend=webgpu`.
- **Browser/backend identity:** Headless Chromium `143.0.7499.4` on Linux.
- **Adapter identity:** vendor `google`, architecture `swiftshader`.
- **Fixture identity:** same 4,644 R50/R51 cases: six scales × six directions × 129 adjacent float32 x-values (`-64..64` ULP from each direction base).
- **Execution shape:** one shared TSL material, 36 render submissions and 36 row readbacks.
- **Gated CI evidence:** GitHub Actions run `34735508683`, run number `3`, artifact `10310597863`, artifact SHA-256 `54c2c437fb1e65bafe145a92644403729aec6f1a62d4ceb37d75e582ccdbc8c0`.
- **Machine gate:** `Candidate-pass`, no errors.
- **Unknown:** hardware GPU, Safari/WebKit, macOS/iOS target devices, real-photo/learned assets, float-intermediate versus final-target stable-pixel color error, and human acceptance.

## Result

1. All **4,644** cases executed through direct Three.js r186 TSL on a confirmed WebGPU backend.
2. The stepwise float32 predicate disagreed with WebGPU coverage in **0** cases.
3. The double-precision predicate disagreed in **32** cases, all double-outside/backend-inside.
4. The mismatch distribution was exactly `axis=0, shallow=5, one-one-root2=6, diagonal=6, steep=8, root3=7`, matching R50 and R51 WebGL.
5. The retained double-precision excess range remained `2.6925955687318037e-8` to `4.2355672125182764e-7`.
6. All six exact axis `r2=4` controls were retained.
7. The first counterexample remained the same fixture point: double `r2=4.000000211950066`, float32 `r2=4.0`, retained by the strict `>` cutoff.

## What is now established

The R50 cutoff-neighbor conclusion has now reproduced across three increasingly direct execution conditions:

- R50 independent llvmpipe float shader,
- R51 direct Three.js r186 TSL WebGL fallback,
- R52 direct Three.js r186 TSL WebGPU on SwiftShader.

Across these locked synthetic fixtures, float-effective evaluation predicts coverage while a naive double CPU oracle does not at the discontinuous boundary.

## What is not established

- SwiftShader WebGPU is not hardware WebGPU.
- Matching summary counts are not proof that every future browser/compiler/device will have the same numeric uncertainty width.
- The observed `2.69e-8..4.24e-7` range is not an asset tolerance or a universal guard band.
- This coverage-mask fixture does not yet measure stable-pixel color error through a float intermediate and final output target.
- No Object DNA, Canonical Truth, geometry, physical material, topology, collision or visual-quality authority follows from this result.

## Routing

Three.js Delivery Mothers may now treat the strict cutoff rule as candidate cross-backend software evidence for WebGL and WebGPU, provided effective precision and backend identity stay in the acceptance contract.

Photo Reconstruction Tool Mother candidate must continue reporting edge coverage separately from stable-pixel color error. Object DNA-bearing Mothers receive no production action.

## Next real gap

Move from software WebGPU to hardware-backed WebGPU and target Apple browser/device paths. Preserve the exact case identity, add per-group edge-mask fingerprints, then add float-intermediate versus final-target stable-pixel color comparison. Only after those layers should any cross-device delivery rule be proposed.
