# R53 bounded learning cycle — exact Three.js WebGL/WebGPU cutoff-mask identity

## Question

R51 and R52 produced the same summary counts, but could WebGL and WebGPU still disagree on which individual cutoff-neighbor samples are retained while accidentally preserving the same totals? R53 tests exact per-case identity rather than summary agreement.

## Evidence status

- **Pinned renderer:** `three@0.186.0`.
- **Common browser/toolchain:** Playwright `1.57.0`, Headless Chromium `143.0.7499.4`.
- **WebGL path:** `WebGLBackend`, ANGLE/Vulkan SwiftShader.
- **WebGPU path:** `WebGPUBackend`, Google SwiftShader adapter.
- **Locked case identity:** six scales × six directions × 129 adjacent float32 x-values = **4,644 cases per backend**.
- **Execution:** one TSL material, 36 render submissions and 36 readbacks per backend.
- **Comparison:** every group carries an input identity SHA-256 plus 129-bit backend, float32-model and double-model coverage masks.
- **CI:** workflow run `34735711931`, artifact `10310872456`, artifact SHA-256 `f4db6d180a35009e1f250c279949dafa8035c8e34001e0602a41135f3343de3a`.
- **Machine gate:** `Candidate-pass`, no errors.

## Result

1. WebGL and WebGPU executed the same **4,644** input identities.
2. The aggregate input identity SHA-256 was identical on both paths: `078382191e293e114cdf4e9a8968ba1e513c9670ed98838558862e8cfaf3b6ea`.
3. The complete backend coverage-mask SHA-256 was identical on both paths: `88658a976148927fbb2676874bafe48274aa65c662e3978c24939cb1c919cdd6`.
4. The float32-model aggregate mask had the same SHA-256: `88658a976148927fbb2676874bafe48274aa65c662e3978c24939cb1c919cdd6`.
5. Exact group-by-group and bit-by-bit comparison found **no divergence**: `firstDivergence = null`.
6. Both backends had `float32PredicateMismatchCount = 0` and `doublePredicateMismatchCount = 32`.
7. Therefore the R50-R52 conclusion is stronger than matching summary counts: under this locked software toolchain, WebGL and WebGPU retain/discard the **same individual cutoff-neighbor samples**.

## Logical correction

- **Rejected:** “WebGL and WebGPU both report 32 double mismatches, therefore they must agree sample-for-sample.” Equal counts do not imply equal sets. R53 removes that inference gap by comparing every bit.
- **Now supported in this fixture:** exact sample-level software WebGL/WebGPU mask identity under one Chromium 143 / Three.js r186 toolchain.
- **Still rejected:** promoting this software agreement into hardware/device universality.

## Boundaries

- SwiftShader is software execution, not hardware GPU evidence.
- Coverage-mask identity is not stable-pixel color equivalence.
- An RGBA8 coverage row does not establish float-intermediate versus final-target color accuracy.
- No real-photo/learned asset or human visual acceptance is represented.
- The synthetic double excess range from R50-R52 remains fixture-specific and is not an asset threshold.
- No Object DNA, Canonical Truth, topology, material, collision or production authority follows from this renderer test.

## Routing

Three.js Delivery Mothers may use R53 as a locked software cross-backend edge-mask regression. Any future backend/device that changes a single one of the 4,644 bits must report the first divergent case rather than hide the change behind equal totals.

Photo Reconstruction Tool Mother candidate must keep hard-edge coverage separate from stable-pixel color error and visual acceptance. Object DNA-bearing Mothers receive no production mutation.

## Next real gap

Stop repeating software SwiftShader cutoff tests. The next evidence-bearing work is hardware-backed WebGPU and target Apple execution, followed by stable-pixel float-intermediate versus final-target color comparison. If hardware infrastructure is unavailable, retain that as an explicit execution constraint rather than substituting more software repetitions.
