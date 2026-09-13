# Current Best View R50 — Gaussian cutoff boundary

Status: **Candidate partial**.

The `r² > 4` Gaussian discard is a discontinuous coverage decision. In 4,644 float-neighbor cases on the fixed llvmpipe `RGBA32F` control, a stepwise float32 predicate matched actual framebuffer coverage in every case, while a double-precision predicate disagreed 32 times. Every disagreement had double precision slightly outside the cutoff but float32 rounded `r²` to `4.0`, which the strict `>` rule retains.

The double-precision excess among retained counterexamples ranged from `2.69e-8` to `4.24e-7`. These are fixture observations, not a universal uncertainty width. Exact axis cases at `r²=4` were retained as specified.

Framebuffer validation must therefore distinguish stable interior/exterior pixels from a declared cutoff-neighbor band and report coverage disagreements separately. A double-precision CPU oracle must not be required to match hard-edge coverage without replaying the effective shader precision. This remains an independent llvmpipe shader, not direct Three.js TSL, WebGL/WebGPU, hardware GPU, browser, device or human evidence.

Frozen R1, Canonical Truth and production Mother branches are unchanged.
