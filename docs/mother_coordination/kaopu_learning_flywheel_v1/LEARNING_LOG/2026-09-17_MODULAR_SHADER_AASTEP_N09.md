# N09 — modular derivative threshold for Brick Material R8

## Bounded question

N02-6 asks which one small, source-licensed shader function can improve an already authorized surface task while keeping coordinate, state and optics separate. This round selects only a derivative-aware threshold for one future isolated Brick Material R8 mask trial. It does not integrate code into HOUSE, change brick geometry or approve a material.

## Target and source receipts

Brick Material PR15 is the narrowest current entry. Its head `a354d0d…` uses a WebGL2 / GLSL ES 3.00 shader, object-space procedural coordinates, derivatives for normal perturbation, a manual footprint gate for fired-brick pores, and fixed `smoothstep` widths for pore and fissure masks. Its receipts still record `humanVisualApproved=false` and `productionApproved=false`.

The candidate is [`glslify/glsl-aastep`](https://github.com/glslify/glsl-aastep/tree/49d59670789be4b9863c3991baa3a58b9bff8c05), pinned at commit `49d59670789be4b9863c3991baa3a58b9bff8c05`. The exact `index.glsl`, README and MIT license blob identities are stored in [`SOURCE_LOCK.json`](../references/modular-shader-aastep-n09/SOURCE_LOCK.json). Copyright and permission text are preserved in [`LICENSE_glsl-aastep.md`](../references/modular-shader-aastep-n09/LICENSE_glsl-aastep.md).

Khronos' [WebGL `OES_standard_derivatives` specification](https://registry.khronos.org/webgl/extensions/OES_standard_derivatives/) is written against WebGL 1.0 and says the extension macro is defined when that extension is enabled. The same page says the functionality was promoted to core and the extension is no longer available in WebGL 2.0. The [WebGL 2.0 specification](https://registry.khronos.org/webgl/specs/2.0.0/) independently lists `OES_standard_derivatives` among functionality moved to core.

## New Observation and counterexample

The pinned helper guards its derivative branch with `#ifdef GL_OES_standard_derivatives` and otherwise returns hard `step`. That is a WebGL1 extension-interface decision, not a portable statement that derivatives are absent.

Brick R8 explicitly requests WebGL2 and `#version 300 es`. Therefore blindly copying the exact helper can compile yet select the hard fallback on a conforming WebGL2 implementation, even though `dFdx` and `dFdy` are core. The failure mode is silent: dependency and shader compilation can pass while the advertised antialiasing is disabled.

The bounded probe compiles four variants against one identical analytic repeated-circle scalar field and identical fullscreen geometry:

1. hard `step`;
2. exact upstream macro-guarded helper;
3. a fixed-width `smoothstep`;
4. a WebGL2-profile adaptation that calls `dFdx`/`dFdy` directly.

It records exact-profile macro state, mean coverage error, phase-to-phase mean instability, adjacent-frame RMS and partial-pixel rate at 16, 8, 4 and 2 pixels per cell. The analytic field is only an executable counterexample; it is not the Brick noise field.

Local browser execution was attempted twice before shader execution. The first attempt found Playwright's default headless-shell absent; the second found the presumed Chromium path absent. An on-demand browser download then timed out. These failures are preserved as environment evidence, not counted as runtime results.

[GitHub Actions run 35218517766](https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/35218517766) then executed the unchanged matrix in Chrome 152, WebGL2 / GLSL ES 3.00, ANGLE Vulkan SwiftShader. All 8 semantic gates passed and the visual/result artifact `10496256211` was preserved with digest `sha256:a23663192f5e993460ee00cbcc025ce1f57bfeafb085e11a25d7157c4b6402c2`.

- `GL_OES_standard_derivatives` was absent in the WebGL2 shader profile.
- The exact guarded upstream helper equaled hard `step` for every tested scale and phase and produced zero partial pixels.
- At 2 pixels per cell, the WebGL2-direct helper reduced phase-mean standard deviation from `0.124020` to `0.069270` and coverage error from `0.025565` to `0.009851`; partial coverage rose from `0` to `0.609375`.
- At 8 pixels per cell, phase-mean standard deviation fell from `0.015097` to `0.000958` and coverage error fell slightly from `0.006661` to `0.006386`.
- The direct helper reduced phase instability at every tested scale, but it was not universally best on area error. Fixed-width smoothing had lower area error at 4, 8 and 16 pixels per cell, while it collapsed to hard-step behavior at 2 pixels per cell. This is a retained counterexample against blanket replacement.

## Candidate / Current Best View

Status: **Candidate partial / pinned-source and one SwiftShader WebGL2 probe verified**.

- Keep the scalar generator in object coordinates. The threshold helper consumes that scalar and screen-space derivatives only to estimate fragment coverage.
- For WebGL2, use a profile-specific direct derivative helper rather than the upstream WebGL1 extension macro guard. Record that adaptation separately from the pinned upstream source.
- Retain the MIT notice. A small module is not provenance-free merely because it is easy to paste.
- Apply the candidate to one existing R8 mask first. Do not replace all `smoothstep` calls, because some widths encode an artistic or physical transition rather than sampling antialiasing.
- Compare hard/current/adapted variants at locked cameras, scales and subpixel phases. Coverage, normal response, roughness response and runtime cost are separate metrics.
- Treat the helper as optics/presentation. It creates no geometry, pore identity, moisture, weathering, erosion or other physical state.

## Rejected

- “If derivatives are core, the `GL_OES_standard_derivatives` macro must also be defined in WebGL2.”
- “A shader that compiles has selected the intended antialiasing branch.”
- “Every `smoothstep` should be replaced by `aastep`.”
- “Screen-space derivative smoothing changes object-space geometry or validates a physical pore.”
- “A small dependency has negligible cost or does not need a license/provenance receipt.”
- “A SwiftShader or analytic-mask pass proves hardware/mobile/public Brick R8 acceptance.”

## Unknown / routing state

- The analytic WebGL2 result and screenshot are available, but they cover only Chrome 152 / ANGLE Vulkan SwiftShader.
- Full R8 integration, locked Brick camera behavior, normal/roughness interaction, fragment cost, hardware GPU, mobile/public deployment and user visual acceptance are Unknown.
- Brick Material Mother has not received or acknowledged this route. The route is prepared only.
- Landscape PR79 and Farmland PR65 still have no new receipt after earlier N02 guidance, so no repeat was sent. Brick shape and Tiles/building were not routed.
- Canonical Truth, Frozen R1 and all production Mother branches remain unchanged.

## Next gate

Send one incremental trial request to Brick Material PR15. The Mother should choose one mask, keep the current fixed-width path as a control, and judge locked R8 cameras, cost and hardware/mobile behavior before any adoption. Mother implementation and user acceptance remain separate.

First-tier expert AI was not called; routine expert discussion remains owned by the separate night expert task.
