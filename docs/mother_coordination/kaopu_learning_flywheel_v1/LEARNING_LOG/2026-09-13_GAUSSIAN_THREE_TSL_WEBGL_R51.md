# R51 bounded learning cycle — direct Three.js r186 TSL WebGL cutoff replay

## Question

Does the R50 cutoff-neighbor behavior survive direct execution through pinned Three.js r186-generated TSL on a WebGL fallback backend, or was the R50 agreement only an artifact of the independent llvmpipe shader fixture?

## Evidence status

- **Direct renderer execution:** pinned `three@0.186.0` through `WebGPURenderer({ forceWebGL: true })`, generating the cutoff through TSL `Discard(r2.greaterThan(4.0))`.
- **Browser/backend identity:** Headless Chromium 140 on Linux, WebGL 2 through ANGLE/Vulkan SwiftShader.
- **Fixture:** the full R50-compatible 4,644-case sweep: six scales × six directions × 129 adjacent float32 x-values (`-64..64` ULP from each direction base).
- **Execution shape:** 129 cases are represented as one-pixel quads sharing one TSL material; each scale/direction group is one scene submission plus one row readback. This changes scheduling/evidence collection only; no cases are removed.
- **CI evidence:** GitHub Actions run `34734918445`, run number `11`, artifact `10311065798` (`kaopu-gaussian-r51-three-tsl`).
- **Unknown:** direct WebGPU execution, hardware GPU, Safari/iPhone/macOS/iOS, learned/photo assets, stable-pixel color error on a float intermediate target, and human visual acceptance.

## Result

1. All **4,644** cases executed through direct Three.js r186 TSL on the forced WebGL fallback path.
2. The stepwise float32 predicate disagreed with direct TSL coverage in **0** cases.
3. The double-precision CPU predicate disagreed in **32** cases, all double-outside/backend-inside.
4. The directional mismatch distribution was exactly `axis=0, shallow=5, one-one-root2=6, diagonal=6, steep=8, root3=7`, matching the R50 fixture pattern.
5. The retained double-precision excess range remained `2.6925955687318037e-8` to `4.2355672125182764e-7`; these remain fixture observations, not a universal uncertainty width.
6. All six exact axis `r2=4` controls were retained, preserving the observable difference between strict `>` and `>=`.
7. The requested WebGPU run did **not** establish WebGPU evidence: Three.js initialized a WebGL backend in that CI environment, so the run is recorded as `unsupported`, not pass.

## Corrections and constraints

- **Rejected:** “R50 only proves an independent software shader and therefore says nothing about Three.js TSL.” R51 now supplies direct r186 TSL WebGL evidence for the same cutoff-neighbor conclusion in this fixed CI environment.
- **Rejected:** “The workflow succeeded, therefore WebGPU also passed.” The WebGPU request fell back to WebGL and is explicitly unsupported evidence.
- **Rejected:** “32 matching disagreements establish a universal guard band.” They establish reproducibility across R50 and this R51 WebGL fixture only.
- **Not yet proven:** float-intermediate versus final-target color/coverage equivalence across WebGPU/hardware devices. R51's committed target is an RGBA8 coverage row used to resolve the hard-edge mask.
- **Not production authority:** no topology, articulation, collision, physical material, Object DNA, Canonical Truth, or asset-acceptance rule is inferred from this cutoff test.

## Engineering note

The initial serial fixture was operationally invalid for CI because thousands of browser render/readback synchronizations could exceed the job window. The retained solution did not reduce the sample set. It batches 129 ULP neighbors into one strip, uses one TSL material with float attributes, and reduces the full 4,644-case run to 36 render submissions and 36 readbacks. Performance optimization therefore did not weaken the evidence contract.

## Routing

Three.js Delivery Mothers may now treat direct r186 WebGL cutoff replay as candidate evidence that effective float precision is part of the hard-edge contract. They must still keep cutoff-neighbor coverage separate from stable-pixel color error and human acceptance.

Photo Reconstruction Tool Mother candidate receives no asset threshold from the synthetic excess range. Object DNA-bearing Mothers receive no production action. Frozen R1 and Canonical Truth remain unchanged.

## Next real gap

Run the same locked case identity through a confirmed WebGPU backend, preferably first on a reproducible CI or cloud hardware environment and then on target Apple hardware/browser paths. Record adapter/compiler/backend identity, preserve the full edge mask, and add a float-intermediate/final-target comparison before any cross-backend cutoff rule is promoted.
