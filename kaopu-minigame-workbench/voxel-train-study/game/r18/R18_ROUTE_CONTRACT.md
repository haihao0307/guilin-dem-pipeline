# R18 first-interstation contract

R18 extends the procedural KST1 street instrument to the existing Kowloon → Yaumati game leg. The canonical R17 Session, dimensions, timetable, station platforms, passengers and controls remain shared imports. R18 has separate save, quality and camera-view storage keys.

## Coordinates and recipes

- Session targets are exactly 0 and 700 scene metres. The timetable's 4.4 km remains display/history data, not a geometry multiplier or a claim of geographic reconstruction.
- The fixed deterministic route contains 37 chunks (indices −4…32), two buildings per chunk, with centre `27 + 22 × index`. Centres −61…731 provide view margins around the first leg; they do not extend generation to the next interstation.
- Buildings are on negative Z; the unchanged station platform and boarding side is positive Z. The observer remains on positive Z. Root ground offset is +0.0805 m, without mirroring/scaling the host train.
- The original R17 near anchor stays at +27 m. Its source recipe is unchanged at version 1.0.0; `resolveChunk` clones it into a 1.1.0 runtime score. Near geometry, transforms and explicit-time snapshot match R17, including 161,930 expanded triangles.
- The host bridge is centred at 355 scene metres: the first-leg midpoint plus canonical `FRONT_X = 5`. Chunk centres 335, 357 and 379 use facade setback Z = −10.8.

## Instrument and streaming

`route.score.json` is a bounded `kaopu.street.route/1` plan, validated by `route-plan.validateRoute`. `resolved-score.schema.json` describes generated `kaopu.street.resolved/1` scores for Instrument 1.1.0. Runtime validators remain authoritative for byte/nesting bounds, finite values, parcel edges, registered glyph/style pairs and forbidden delivered-asset fields.

Near/mid/far enter distances are 21/76/140 m; exit distances are 27/88/156 m. Selection is camera-target-relative, with at most one near chunk, 16 live chunks, 520,000 live expanded triangles and 48,000,000 live geometry bytes. The live-geometry budget excludes separately reported instance buffers, the finite CPU recipe cache, and temporary replacement overlap. These are not GPU-memory measurements. At most two generation attempts (including failed attempts) are scheduled per update. Missing parcels receive their own far architectural outline before any LOD replacement. The far form retains pierced walls, roof, balcony/cage silhouettes and supported sign boards; it is not a substitute box. Then outgoing LOD downgrades precede fine-detail promotion. A per-frame coverage report records required and missing parcels within ±70 m of the camera focus. The nearest chunk wins the near-detail cap; hysteresis does not override that cap.

Primitives and finite glyph geometries are reference-counted across live chunks. Unloading one owner must preserve a sibling's geometry; the last live owner emits disposal. Chunk-owned materials, mutable cloth geometry and instance buffers are separate. Re-entry regenerates the same geometry; an empty district clears the finite cache. Two persistent host point-light slots avoid chunk-local light-count churn.

All construction is runtime geometry and licensed glyph curves. Formal scores carry no external meshes, image textures or font binaries. Animation receives only `Session.view.elapsed`; pause must not advance cloth or the simulation clock.

## Verification

Run from the repository root:

    node --test kaopu-minigame-workbench/voxel-train-study/game/r18/tests/r18-route.test.mjs

The independent suite checks route/distance separation, deterministic recipes, schema/manifest agreement, rejection boundaries, R17 anchor equivalence, both station approaches, bridge setback, real LOD simplification, hysteresis, shared-resource ownership, streaming release/re-entry, clock/replay and isolated storage.

This suite builds and inspects Three.js geometry on the CPU. It does not create a WebGL renderer and does not establish shader compilation, GPU performance, screenshots or visual acceptance. Those require separate browser/GPU evidence.

Online coverage additionally replays actual native sampled distances from run 38042577648 and worst-case 24/36 m steps, with exactly one update per point and no intermediate settling. The browser checks this protected interval on every rendered frame, including frames before any paused screenshot. The original scheduling bug, where LOD work starved incoming parcels, is preserved as a regression test.
