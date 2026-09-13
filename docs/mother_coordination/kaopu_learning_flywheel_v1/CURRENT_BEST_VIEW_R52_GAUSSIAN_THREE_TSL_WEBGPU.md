# Current Best View R52 — confirmed Three.js r186 TSL WebGPU cutoff replay

Status: **Candidate partial**.

R52 executed the complete locked 4,644-case Gaussian cutoff-neighbor fixture through pinned Three.js r186 TSL on a confirmed WebGPU backend. The valid run used Headless Chromium 143 with a Google SwiftShader WebGPU adapter. The stepwise float32 predicate matched actual WebGPU coverage in all cases; the double-precision CPU predicate disagreed 32 times, all double-outside/backend-inside, with the same directional distribution already observed in R50 and R51 WebGL. All six exact `r2=4` axis controls were retained.

This establishes candidate cross-backend software evidence for the strict `r2 > 4` cutoff behavior across direct Three.js WebGL and direct Three.js WebGPU paths. The observed double excess range remains approximately `2.69e-8` to `4.24e-7`, but it is still fixture-specific and must not be promoted into a universal guard width or asset threshold.

A failed first R52 attempt is retained as a compatibility boundary: Playwright 1.55 / Chromium 140 reached `actualBackend=webgpu` but failed at `GPUTexture.createView()` because the browser/API surface did not match the swizzle descriptor used by r186. The valid run changed only the browser harness to Playwright 1.57 / Chromium 143; Three.js remained fixed at r186.

The remaining gap is no longer software WebGPU availability. It is hardware-backed WebGPU, target Apple browser/device execution, stable-pixel float-intermediate versus final-target error, per-group edge-mask fingerprints, real assets and human acceptance.

Frozen R1, Canonical Truth and production Mother branches are unchanged.
