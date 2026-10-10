# Next gate: actual R16 WebGL validation

Status: NOT RUN. Local CPU tests and the separate Blender geometry image do not satisfy this gate. Use an authorized browser/CI environment without bypassing security restrictions. R16-only candidate branch and read-only CI are authorized; no merge or deployment before the real-frame review. The frozen R15 rejected asset is excluded. A software rasterizer must be labeled as such; desktop/phone viewports are not physical-device tests.

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
