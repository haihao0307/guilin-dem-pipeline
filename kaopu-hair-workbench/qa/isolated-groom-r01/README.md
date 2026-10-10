# Isolated groom R01 — Draft, not published acceptance

Self-authored HairLayer real GNM triangle/barycentric curves, preserved three style comparison, and existing R8 fibre material + layered opacity code from fixed `0b4703359efbae10ffc6c0e5fe3fc081e7eca4fe`. The only changes to the two optics modules are relative imports plus relocation notices. No teacher curves, source Blender assets, HAAR/Perm/DiffLocks/StrandHead weights, or their outputs are included. The existing R9 link is a reference to the existing site, not a new license claim.

GNM head: xrblocks/assets-gnm `134feb02b11fa642a43ff5e7e880246255a74e86`, gnm_head_web.bin, 34,937,952 bytes, SHA256 fd19f46eef6f8bfb725fceab581e1bc8837209997ca3fd43f3c1735003c86961. Downloaded on demand and validated; not duplicated in this patch. GNM Apache-2.0, XRBlocks and Three notices included in licenses. Existing GNMModel port is unchanged.

Controls: three self-authored short styles, camera orbit, bounded rigid head turn, reset. The head-turn adapter transforms local head and strand positions/normals/tangents together; it is not a physical solver or a full-body attachment. All geometry diagnostics are available through `window.hairDraft.diagnostics()`, not displayed over the hair.

Acceptance is false: no film-quality claim, no physical inertia, no shoulder/back collisions, no general topology remapping, and no mobile hardware performance claim. The three existing styles retain known hairline/silhouette limitations; R8 optics do not fix their grooming quality. Density changes index selection, not allocated buffers. R8 framebuffer failure is disclosed and falls back to stochastic comparison rather than silently claiming the same result.

Tests: `tests/geometry.mjs` checks real fixed GNM model, all styles, finite data, triangle bounds, barycentric sum, root-clearance bound, reset hashes, immutable source positions, density draw reduction vs unchanged allocation. Browser CI on Ubuntu 24.04 + Playwright 1.57 captures actual WebGL images and layered capability, reset and software-renderer wall timing. A passed geometry test does not substitute for pixel or hardware acceptance.

The stable human platform and old hair workbench are untouched. This version must remain a Draft until actual screenshots have been reviewed.

## R02 focused grooming candidate

`?groom=refined` preserves the original roots and R8 shaders, adding a 1–26 mm smooth root-margin length transition, weak 12 mm spatial guide grouping, 1.8% selected interior-root silhouette flyaways, and 75 µm fibre radius (R01 was 280 µm). Volume rises from 8 to 12 mm while tangent frizz decreases from .45 to .15 mm; these are grooming changes, not a physics solver. Boundary shortening targets common clipped ends and gentle bundle convergence targets sheet-like uniform flow. Same-camera before/after screenshots are required; no assumed visual acceptance.

Diagnostics now include actual displayed rotated roots, reachable typed-array storage (not total JavaScript heap), and full-resolution readPixels timing after forced shadow rebuild. The initial gl.finish-only timing is discarded as an inadequate performance measurement.
