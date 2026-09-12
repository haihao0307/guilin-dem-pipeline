# Current Best View R48 — Gaussian software-GL compositor

Status: **Candidate partial**.

R47's analytic compositor remains the float reference, but its continuous outputs are not exact predictions of an `RGBA8` raster target. An independent Mesa llvmpipe OpenGL framebuffer replay of the same 33×33 two-splat equations preserved a material reference/candidate difference (`0.0823529` maximum channel difference), while the continuous CPU result was `0.0851303`. The difference between those reported maxima was `0.00277734`.

The software backend differed from continuous CPU by as much as `0.00497459` for the reference image and `0.00537919` for the candidate. A naive CPU model that rounded after every source-over draw matched the reference within one code but required two codes for the candidate. Therefore neither continuous arithmetic nor a generic per-pass UNORM8 rounding assumption is an exact backend oracle.

This is executable framebuffer evidence, but not direct Three.js TSL evidence and not hardware GPU, browser, Safari/iPhone, real-photo or human-acceptance evidence. The observed two-code envelope is a regression bound for this fixed llvmpipe fixture only; it must not become a production visual threshold.

Frozen R1, Canonical Truth and production Mother branches are unchanged.
