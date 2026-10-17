# R16 real WebGL validation and measurement contract

Status on 2026-10-10: actual Chromium/ANGLE SwiftShader frames and native interactions have been exercised in the authorized Ubuntu 24.04 CI. Run [38028738677](https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/38028738677) passed 175 unit tests, seven browser cases and all GL/network gates; its native test incorrectly compared meshes after the legitimate 307m release boundary. With the same runtime and corrected distance-aware assertions, run [38029895563](https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/38029895563) passed the complete native journey, pause/door/control/storage checks and three real release/reentry cycles. That second run selected only the native case; it is not independently an eight-case pass.

The current two-persistent-light-slot optimization is a separate candidate. The workflow restores all eight browser cases, repeats clean R14/R16 startup, and compares the fixed pre-optimization R16 commit 966337636c9c5112a126acbdc91244207fb29fcc with the candidate on the same runner. Read the exact candidate CI result before treating that optimization as accepted.

The new street produces real shaders and geometry; no cinema/3A or lightweight hardware-performance acceptance is claimed. No physical GPU/phone measurement or public deployment has occurred. This remains a Draft PR with read-only CI. Local socket restrictions are not bypassed; the frozen rejected R15 mesh/image package is excluded.

## Exact target and identity

- Entry: existing study `/kaopu-minigame-workbench/voxel-train-study/game/r16/` served with all preserved relative host dependencies.
- Freeze the candidate commit and verify loaded source hashes against `evidence/load-closure.json`.
- Assert `window.__trainDriver.version === 'kcr-kst1-r16'`; inspect `getState().streetDistrict`, rather than accepting a screenshot of any old entry.
- One shared Three r170. No network request to `game/city-assets`, `.bin.gz`, a model file, or a street bitmap/font. Existing documented audio remains a separate preserved host dependency.

## Functional/render sequence

1. Cold page, then warm reload, landscape and portrait: check start/menu/keyboard/button controls and no WebGL shader compilation errors. Record renderer string and canvas pixel dimensions. Confirm generated street metrics and correct glyph-facing directions.
2. Play from the first station with the real locomotive and two coaches. At the street near-view interval (around 30m after departure) capture platform, overview and street preset. Pause and resume: the same Session elapsed must freeze/resume cloth, people, steam and body motion together; timetable compression must not multiply those movements.
3. Capture 5–10 seconds of actual motion while the street passes. Check anchored weather masks do not swim; signs/buildings do not pop by camera-side switching; folds stay pinned; support beams do not cut important lettering; street ground is not hidden by host grass.
4. Drive beyond the street unload threshold, then restart/re-enter through normal game controls. Record `loadCount`, `unloadCount`, renderer memory/buffer/resource behavior and network/cache reuse across at least three cycles. Geometry/material/InstancedMesh dispose events are already tested in CPU; actual renderer memory must also plateau after renderer cleanup.
5. Repeat interruption flows: pause before score resolves, reload, restart, lost/restored WebGL context where supported, and score load failure. Original train controls must remain usable on street failure. Verify R14 saved game/view/quality keys are unchanged by R16.

## Measured performance, not a file-size inference

Record separately: compressed HTTP bytes/cold and warm requests; parse/validate/build and GPU-upload stall; main-thread frame time; renderer draws/visible triangles; GPU frame time if available; shader-program count; geometry/texture/memory after unload; input latency. Report software-rasterizer versus hardware details. Compare identical resolution/preset/seed against R14, then against frozen R15 only if its old payload is explicitly allowed for that comparison.

## Independent visual gate

Inspect near pixels at the same candidate commit: authentic Traditional glyph holes/stroke ends, facade recesses and cages, per-tenant sign ages, correlated rain/repair masks, brick/mortar scale, wet roughness, shop depth and real train occlusion. Plain side walls, repetitive bays, limited sign layering and unverified shader appearance remain known quality gaps. Functional pass is not a film/3A approval. No extra streets, characters or artistic expansion is required to finish this gate.
