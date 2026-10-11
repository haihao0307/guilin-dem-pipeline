# Complete native dwelling R01 — one-room inspection candidate

One immutable metric recipe constructs the complete geometry and its procedural surface field together. No image textures, imported meshes, post-build repair stickers, population generator, new website, or city layout is included.

## Scope

Four solid walls, real front door and two window openings, roof, wave-generated zinc awning, gutter/downpipe, typed water-supply route, iron security cage, sagging clothesline and procedural garments, one furnished bed, desk/stool/storage and simple household containers. A visible bulb locates the warm interior light. The external kitchen/toilet network remains an unconnected walking destination; it is not falsely depicted as rooms inside this dwelling.

The dimensions (3.6 × 4.3 × 2.75 metres) are this inspection recipe, not a final dwelling/population standard. The door leaf opens and closes with its walk edge. The entrance conservative clear width is 0.826m. CPU route checks use a 0.60m body envelope; no building-code compliance is claimed.

## Shared shape/material field

`room-weathering.mjs` samples three metric, common-seed field scales and causal sill/drip/rain-shadow emitters. The same field's plaster thickness is sampled by the wall geometry during the one build; substrate exposure, roughness, damp, oxidation and normal relief use its matching shader form. Geometry recession is bounded, solid wall core retained, and fine shader detail is screen-footprint filtered. There is no white-model stage exposed and no bitmap surface replacement.

The actual MIT `smax` smooth carving kernel from the existing KAOPU volcanic-stone source is reused and its license retained. The old seven-octave raymarch object, its hardcoded cube, and the separate CC BY-NC-SA wet-stone shader are not copied into this room. The first wall component rules are reused for real openings, frames, window cage and door hinge, with the earlier rectangular repair geometry deliberately excluded from this complete construction.

## Runtime/native contract

`buildDwellingUnit(recipe,{THREE,createHostMaterialLibrary})` returns root, proof, measure, setDoorOpen, update(authoritativeSeconds,weather), setInspectionCutaway and dispose. Geometry is baked in room-local metres; place with a rigid root transform, do not nonuniformly scale it. The roof/front can be hidden solely for labelled inspection cutaway; geometry is not deleted.

`loadNativeDwelling(bytes,{THREE,createHostMaterialLibrary,dependencyBytes})` validates pinned trusted source bytes and the actual SQLite 3 envelope before regeneration. `.KaoPu` holds only an inert normalized recipe, not shaders, arbitrary URLs, images or mesh payloads. This is the narrow experimental `kaopu.dwelling-unit/0.1-experimental` profile, not a universal importer.

## Verification status

29 local CPU tests passed: geometry budget/finite bounds, deterministic field/shape, door ray tests and walk edge, furniture clearance, causal damp/runoff, age consistency, shader hook insertion, disposal, same-recipe reuse and bounded erosion. One genuine 53,248-byte SQLite sample passed sqlite3 integrity_check.

Initial geometry: 18,780 triangles, 1,064,376 bytes, 23 grouped mesh draw calls, zero image textures. These figures are not whole-game FPS. Actual GPU compilation, whole-room views, close-up, door open/closed and same-view incremental rendering cost are collected by the isolated existing-game QA harness. Until its receipt is read, do not claim visual or GPU acceptance.

The main app/world/session/train and Pages publication are unchanged. The old R01 game/train is only the test carrier, not the new A4/No88 release. Source references containing restricted teacher shaders remain local research only and are excluded from the published candidate closure.

Second inspection changes: blanket folds now remain above the mattress; hanging garments use a gravity-shaped sag and curved folds. The same pre-displacement roomFieldPosition attribute feeds the shape/material reference coordinates. Weathering uses domain-warped connected areas and varied drip lengths, replacing the first inspection's round patches and even-length stripes. Await the second actual GPU receipt before visual acceptance.
