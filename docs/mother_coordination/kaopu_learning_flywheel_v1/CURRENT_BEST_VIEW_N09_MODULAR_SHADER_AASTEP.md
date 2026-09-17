# Current Best View N09 — modular derivative threshold

Status: **Candidate partial / source contract verified; target runtime pending**

- `glsl-aastep` is a small MIT-licensed threshold helper, pinned at commit `49d5967…`, suitable only for presentation masks whose scalar field already exists.
- Its exact `GL_OES_standard_derivatives` preprocessor guard is a WebGL 1 contract. Blindly copying it into Brick R8's GLSL ES 3.00 WebGL2 shader can select the hard-`step` fallback even though derivatives are core.
- For an isolated WebGL2 trial, adapt the helper to call `dFdx`/`dFdy` directly, retain the MIT notice and record the adaptation revision. Do not silently mix WebGL1 and WebGL2 interfaces.
- The helper changes fragment coverage only. It does not change object coordinates, geometry, pore identity, material state, water, sediment or physical weathering.
- Compare hard, fixed-width, exact guarded and WebGL2-direct variants across scale and subpixel phase. Preserve coverage error, phase instability and partial-pixel rate separately.
- Do not infer full Brick R8 improvement from an analytic mask. R8 integration, real camera views, performance, hardware/mobile/public behavior, Mother acknowledgement and user visual acceptance remain separate gates.

Frozen: Canonical Truth, Frozen R1 and production Mother branches are unchanged.
