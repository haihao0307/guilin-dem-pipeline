# Current Best View R71 — one runtime makes undefined state look zero-seeded

Status: **Candidate partial**.

R71 generated the exact mode-7 fragment from the R70 source fingerprint and pinned historical twigl wrapper/noise. The compact program is 9,038 bytes with SHA-256 `c11c4581f7e207f87563482dcb401abd6a3a85502f7d4e8a9e78846c150ffda8`.

In Chromium 143 / ANGLE Vulkan SwiftShader, the exact undefined program, its componentwise kernel expansion, and explicit-zero reinterpretations produced bit-identical RGBA32F and RGBA8 results at `t=0`, `1.25`, and `7.5`. All tested channels were finite; an alternate framebuffer clear did not affect the undefined result; the initialized repeat was deterministic.

This is an implementation observation, not a language guarantee. GLSL ES 3.00 still leaves the pre-write reads undefined. Use the zero-seeded pair only as a revision-pinned deterministic comparison reference. Do not infer original recording pixels, cross-GPU equivalence, physical meaning or visual acceptance.

The next useful evidence must come from a genuinely different WebGL implementation or hardware GPU. Mother routing is prepared only. Gaussian R66 remains queued. Production Mothers, Canonical Truth and Frozen R1 remain unchanged.

