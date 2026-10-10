# Isolated groom R01 — Draft, not published acceptance

Self-authored HairLayer real GNM triangle/barycentric curves, preserved three style comparison, and existing R8 fibre material + layered opacity code from fixed `0b4703359efbae10ffc6c0e5fe3fc081e7eca4fe`. The only changes to the two optics modules are relative imports plus relocation notices. No teacher curves, source Blender assets, HAAR/Perm/DiffLocks/StrandHead weights, or their outputs are included. The existing R9 link is a reference to the existing site, not a new license claim.

GNM head: xrblocks/assets-gnm `134feb02b11fa642a43ff5e7e880246255a74e86`, gnm_head_web.bin, 34,937,952 bytes, SHA256 fd19f46eef6f8bfb725fceab581e1bc8837209997ca3fd43f3c1735003c86961. Downloaded on demand and validated; not duplicated in this patch. GNM Apache-2.0, XRBlocks and Three notices included in licenses. Existing GNMModel port is unchanged.

Controls: three self-authored short styles, camera orbit, bounded rigid head turn, reset. The head-turn adapter transforms local head and strand positions/normals/tangents together; it is not a physical solver or a full-body attachment. All geometry diagnostics are available through `window.hairDraft.diagnostics()`, not displayed over the hair.

Acceptance is false: no film-quality claim, no physical inertia, no shoulder/back collisions, no general topology remapping, and no mobile hardware performance claim. The three existing styles retain known hairline/silhouette limitations; R8 optics do not fix their grooming quality. Density changes index selection, not allocated buffers. R8 framebuffer failure is disclosed and falls back to stochastic comparison rather than silently claiming the same result.

Tests: `tests/geometry.mjs` checks real fixed GNM model, all styles, finite data, triangle bounds, barycentric sum, root-clearance bound, reset hashes, immutable source positions, density draw reduction vs unchanged allocation. Browser CI on Ubuntu 24.04 + Playwright 1.57 captures actual WebGL images and layered capability, reset and software-renderer wall timing. A passed geometry test does not substitute for pixel or hardware acceptance.

The stable human platform and old hair workbench are untouched. Actual screenshots have now been reviewed for the bounded short-hair experiment. Production/film-quality acceptance remains false; independent test-page publication is separate from human-platform integration.

## R02 focused grooming candidate

`?groom=refined` preserves the original roots and R8 shaders, adding a 1–26 mm smooth root-margin length transition, weak 12 mm spatial guide grouping, 1.8% selected interior-root silhouette flyaways, and 75 µm fibre radius (R01 was 280 µm). Volume rises from 8 to 12 mm while tangent frizz decreases from .45 to .15 mm; these are grooming changes, not a physics solver. Boundary shortening targets common clipped ends and gentle bundle convergence targets sheet-like uniform flow. Same-camera before/after screenshots are required; no assumed visual acceptance.

Diagnostics now include actual displayed rotated roots, reachable typed-array storage (not total JavaScript heap), and full-resolution readPixels timing after forced shadow rebuild. The initial gl.finish-only timing is discarded as an inadequate performance measurement.

## Verified coverage failure and correction

At commit e686095, actual Ubuntu/Chromium WebGL reports 4 samples. Exact same refined curve geometry and 75 µm base radius look markedly sparse under analytic alpha-to-coverage with depthWrite=true, but recover coverage under the original R8 analytic alpha-blend reference with depthWrite=false. This is a verified raster-resolution difference, not evidence that all missing coverage required more strands or thicker ribbons. Default is now explicitly blend. Shader code and its .001 alpha-discard threshold remain unchanged; no opacity multiplier or scalp colouring was added. This order-dependent blend reference is not order-independent transparency.

Actual CI38033938180 passed model SHA, source-response hashes, both alpha resolves, displayed rotated-root clearance, reset and mobile screenshot. Human inspection finds softer edges and finer fibres than the old hard-cut groom, while silhouette/flow remain limited. Visual production acceptance remains false. Previous 13.375 s full-frame timing belongs to the earlier baseline A2C snapshot, not the final refined blend case. Current CI records that case separately.

Release preparation: default refined + original R8 explicit blend, pinned official asset URL on public hosts (no missing-local-file probe), source/license page and separate public source-hash / three-style / head-turn / reset / narrow-screen checks. The exact XRBlocks asset LICENSE is additionally retained as XRBLOCKS-ASSETS-LICENSE.txt. Verified refined blend full-frame software timing at bdfd5c5 is 13.029 seconds for forced shadow rebuild + complete 1200×900 readback; not hardware GPU time or an FPS claim.
