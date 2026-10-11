# R3.12 single-wall runtime surface adapter probe

Status: isolated local candidate. 12 CPU/static tests pass. GPU compilation, images,
quality and speed are NOT accepted yet. The local Chromium attempt was actually run
and refused by this executor's socket permissions; see `local-smoke-evidence/receipt.json`.
Use the existing authorized QA CI, not a claim that no GPU means a pass. Nothing here
is published, connected to the room, or substituted into the game. Original `r312-wall/`
and game files are not edited.

## Why this is a different rendering path

`createR312SurfaceProbe({THREE,renderer,showPlaster:false,...originalOptions})` takes
an existing renderer and the same original wall options, returning the original
adapter interface `{group, materials, meshes, proof, updateCamera, dispose}`.
It does not make a website, renderer, camera, animation loop or network request.

- Original R3.12 six shaders and source snapshot remain hash-locked. Both new fragment
  programs begin with the entire original fragment prefix. Original field, derivative
  normal, material and lighting functions are byte-for-byte, not a new noise imitation.
- The original vertex shader's decodeBase/decodeClosure/decodeCap and exact GPU seed
  expression generate all 1,494 brick identities. Centers, yaw, seed and variant are
  read back as float data. There is no JS reimplementation of procedural RNG.
- At construction, six parametric cube-face grids are sampled against the original
  exact signed field. Sixteen bounded radial bisections plus endpoint/residual checks
  are 19 field evaluations per sample. It generates a numerical, camera-independent
  surface mesh. Bisection is a new sampler of the original field, not the original
  tracing algorithm. Any unbracketed or >0.15 mm residual sample rejects construction.
- At each frame the cached triangles rasterize normally. Each shaded pixel still calls
  original `brickNormal`/`soilNormal` and `shadeBrick`/`shadeSoil`; there is no view-ray
  march in main and no fragment depth write. This enables ordinary depth rejection,
  but actual performance must be measured. Original derivative-based shading stays.
- Transient RGBA32F framebuffer attachments are runtime numeric scratch storage for
  positions and original identity metadata, deleted immediately after readback. They
  are not image assets, never sampled by visible materials, and never persisted as
  replacement textures. Meshes are generated at runtime, not external models.

The prototype requires WebGL2, `EXT_color_buffer_float`, 3 float draw buffers and
32-bit indices. It fails explicitly when unsupported. Host renderer state is reset
before/after raw GL sampling. Integration should call during controlled loading,
not in the middle of another render pass.

## Fixed initial configuration and cost accounting

Default spacing is 0.06 m across source bounding cube axes (actual radial surface
spacing varies). For the full 43-course wall:

- 108 grid samples / brick, 161,352 brick samples total
- 11,928 core samples; 173,280 total samples
- 207,972 triangles before small doorway cap quads
- 3 float outputs / sample in the one-time stage

This is intentionally a measurable fixed-quality first probe, NOT a proven cheap
startup. All six faces are generated; no unproven invisible-brick culling is applied.
The same renderer and exact parameters share the cached generated CPU arrays on
subsequent construction. Different seeds, material field parameters, door or spacing
use separate cache entries. `clearR312SurfaceCache(renderer)` explicitly drops that
cache. Dispose removes GPU buffers/materials; cache remains until cleared/renderer GC.
Memory is reported as retained CPU bytes, estimated GPU buffer bytes, and peak transient
CPU readback + float-attachment bytes. This is an estimate, not full driver process RAM.

`proof.stages` separates shader/setup time, draw submission, full THREE-ATTACHMENT
float readback, and CPU mesh building. `proof.totalBuildMs` is complete construction.
Frame QA separates submission, gl.finish wait and full RGBA8 readPixels completion.
Only `totalThroughReadbackMs` is the comparable whole-frame wall time. Never compare
a cold original frame with a warm adapter frame or treat gl.finish alone as evidence.

## Door handling

The door remains an analytic full-thickness rectangle in original wall coordinates.
Surface fragments strictly inside it discard. Runtime jamb/header quads are generated
only where their planes intersect a source solid's conservative bound. A cap fragment
checks the ORIGINAL exact field once and discards where the original solid is absent;
it then uses the original material/light with the analytic cut normal. Door caps are
not a painted dark rectangle or a solid plane filling all source holes. Core caps keep
the original depth-only tie priority via vertex clip-depth adjustment. Source outer
normals/material remain original; cap normals are explicitly geometric adaptation.

## Honest quality boundary

This mesh is NOT pointwise equivalent to view-ray hits from the mother:

- A single radial shell cannot represent arbitrary undercuts, disconnected cavities,
  or multiple ray crossings. Endpoint signs and low residual are not a topology proof.
- Detail narrower than grid spacing is absent from geometric silhouette/depth. Tiny
  cracks, deep pore entrances, chip rims and shadowing may flatten, bridge or disappear.
- Exact micro material and normal functions remain, but evaluating them at interpolated
  triangle positions is different from evaluating at an original precise ray hit.
- At grazing angles and very close door edges the sampled outside shell and exact cap
  can disagree; residual-based vertex tests do not bound inter-vertex error or exclude
  edge gaps. The grazing/reveal screenshots are mandatory before any integration.
- Original 17-scale micro shading, noise, derivative perturbation and four exact-field
  normal probes per pixel remain expensive. No frame-time win is assumed.
- No host-light, shadow-depth, collision, interaction or picking integration is added.
- Initial probe explicitly rejects optional plaster instead of silently faking it.
- Whole-wall caching is not LOD or streaming. A 208k-triangle wall may itself be too
  costly for a mobile game. Failure of performance or quality gates is valid evidence.

## Files / CPU tests

- `geometry.mjs`: runtime grid and conservative cap candidates
- `shaders.mjs`: source-preserving bake/render shaders
- `gpu-sampler.mjs`: float MRT sampling with complete readback
- `surface-probe.mjs`: original-controller reuse, cache, runtime mesh and telemetry
- `qa-scene.mjs`: same-camera A/B using explicit identical original parameters
- `gpu-ab.cjs`: existing-page Playwright runner; app response disabled only in memory
- `probe.test.mjs`, `cpu-test-results.txt`: executable CPU/static tests and output

Run from room-unit root: `node --test wall-surface-adapter-probe/probe.test.mjs`.
Includes original source hashes, full function-prefix retention, exact GPU layout,
no pixel tracing/depth writes, closed-grid outward winding, bounded sampler, door
candidates, exact cap occupancy branch, retained GPU identity and valid geometry indices.
These are not a GPU image or field-equivalence test.

## Existing official CI handoff

Copy this directory beside the existing `r312-wall/` in the same already-authorized
room QA directory. It only imports that sibling and the existing host's Three r170.
From repository root:

`node kaopu-minigame-workbench/voxel-train-study/game/r20-plants-r01/room-unit-r02/wall-surface-adapter-probe/gpu-ab.cjs`

Default: 632 × 474 = 299,568 pixels; front and oblique; original and adapter each
one first frame + TWO warm frames. `receipt-progress.json` is written after sampling,
every completed full readback, and every compared view, so no long silent run.

Use `PROBE_EXTENDED=1` for mandatory final reveal + grazing views as well (same size).
Use `PROBE_WIDTH=360 PROBE_HEIGHT=270` for a cheaper first diagnostic, never compare
that runtime against a 300k-pixel result. `PROBE_SMOKE=1 PROBE_WIDTH=96 PROBE_HEIGHT=72`
uses three courses to catch compile/framebuffer errors first; it is not wall acceptance.
`PROBE_FRAMES` defaults 3, `PROBE_SPACING` .06; do not lower frames below 3 for a
performance claim. `CHROMIUM_BIN` optionally selects the already-installed binary.

Runner also supports `PROBE_ROOT`, `PROBE_GAME`, `PROBE_MODULE`, `PROBE_THREE`,
`PROBE_OUT`; default paths match the existing game and room QA layout. It never writes
or starts game app.mjs, and records before/after SHA256 equality. PNGs contain original,
surface, and 4× absolute difference for each view. Metrics include RGB MAE/RMSE,
changed pixels >8, and cyan-background silhouette disagreement. These are descriptive;
no arbitrary threshold converts nonidentical geometry into an original-equivalence pass.

Provisional explicit gates are construction <10 s and ALL two warm frames <33.3 ms
on that reported device. They are usability screens, not user-approved acceptance or
a hardware GPU estimate from SwiftShader. Visual and interactive acceptance are always
false in the automated receipt until a human and the surrounding system review them.

For a first bounded diagnostic only, `PROBE_ORIGINAL_FRAMES=1 PROBE_SURFACE_FRAMES=2`
is supported. Its receipt explicitly has `fullColdWarmProtocol:false`; it cannot supply
the requested matched cold + two-warm performance conclusion. Default protocol remains
3/3. The runner has a 600,000 ms observation deadline (`PROBE_TIMEOUT_MS` override),
closes the browser on timeout, and preserves completed-stage progress. Timeout is a
failed/incomplete observation, not a successful lower-bound benchmark.

The A/B context is antialias:false, recorded together with actual drawing-buffer size.
Both variants share that exact context. Do not directly compare these numbers with
previous MSAA-on room captures. Difference PNG rows are flipped for the same top-down
orientation as canvas screenshots; numerical differences use the original readback rows.
