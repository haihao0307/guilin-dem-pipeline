# Current Best View R53 — exact Three.js WebGL/WebGPU cutoff-mask identity

Status: **Candidate partial**.

R53 closes the summary-count ambiguity left by R51/R52. Under one pinned Three.js r186 / Chromium 143 software toolchain, direct WebGL and confirmed WebGPU executed the same 4,644 cutoff-neighbor inputs and produced identical per-case coverage masks. No group or bit diverged. Both backend masks also matched the stepwise float32 model exactly.

The aggregate input identity SHA-256 is `078382191e293e114cdf4e9a8968ba1e513c9670ed98838558862e8cfaf3b6ea`. The WebGL backend mask, WebGPU backend mask and float32-model mask all share SHA-256 `88658a976148927fbb2676874bafe48274aa65c662e3978c24939cb1c919cdd6`. Both backends retain the established 32 double-precision counterexamples.

Thus, within this locked software environment, the strict Gaussian cutoff is not merely statistically similar across WebGL and WebGPU; it is sample-for-sample identical for the tested boundary fixture.

This does not establish hardware GPU, Safari/WebKit, macOS/iOS, real assets, stable-pixel color equivalence, or human visual acceptance. Coverage-mask exactness must not be expanded into claims about color accuracy or asset quality.

The next meaningful boundary is hardware/target-device execution plus float-intermediate versus final-target stable-pixel color comparison. Repeating the same software SwiftShader fixture would add little evidence.

Frozen R1, Canonical Truth and production Mother branches remain unchanged.
