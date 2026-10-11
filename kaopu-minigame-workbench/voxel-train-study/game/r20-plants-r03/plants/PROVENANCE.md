# Original native78 Musa adapter, R03 candidate

This independent candidate uses the original `Musa balbisiana` profile78, stage `establishing`, habitat `sheltered`, seed `761014`, at metre scale `[1,1,1]`. The canonical mother workbench at source HEAD `d5f6ed0f41bdd6a4e4d1163190d3cd2135e8b122` is unchanged. R02 and its historical research remain unchanged.

The source chain is `profile78 → generateTropical78({compactBlades76:true}) → fixedAsset76 → exact qualified geometry/content hash pair → six resource hashes → single-use module Worker → unchanged createFixedMesh76`. The `.KaoPu` file is an independent real SQLite recipe container, not a renamed native archive; it contains no geometry, pixels, motion samples or executable incoming code.

## Actual source and slicing evidence

`rules/native78-source-closure.json` pins 92 original inputs and the 469,608-byte MotherMusa bundle. The build uses existing pinned esbuild 0.25.10 and Three 0.179.1. It removes only the unused `BARK_DATA76` wood pixel table in an esbuild virtual module. Original canonical files are never patched. The exact transformed module is `rules/build-inputs/BarkData76.musa.ts`; the builder independently verifies source bytes, source hashes and that transform.

`rules/native78-resource-slice-equivalence.json` records actual full-original versus sliced generation under Node 24.19.0: all 11 geometry typed arrays are byte-identical, complete geometry and surface objects deep-equal, all six resource hashes/bindings match, and complete geometry/content hashes match. A separate pure-generation comparison measured Node 22.23.3 and Chromium 143 against the same bytes. Node 22 and Node 24 share the full raw pair. Chromium has identical complete geometry and six resource bytes, with five Float64 blade-storage and seven materialized-graph last-bit differences no greater than 1.1102230246251565e-16. Version 2 admits its separately measured complete content hash, without numeric normalization or runtime tolerance. Other engines remain unqualified unless they produce one of the exact admitted pairs.

Single-source counts: 20,632 vertices, 36,330 triangles, 92 geometry records, 28 leaves, 64 axes, four pseudostems. Geometry logical bytes are 2,499,608 and allocated backing stores 2,579,272. Six original procedural RGBA resources total 835,584 bytes. Above-soil height is 5.031538486480713 m, crown X/Z 4.286975383758545 × 4.794157028198242 m. Root minimum Y remains −0.24102644622325897 m.

## Ownership, time and scope

The two scene instances are object-node clones of one verified generated specimen. They share original geometry, materials, PBR pixels, shadow material and native wind uniforms. A replacement generates once, retains the old pair until validation completes, then disposes the old source exactly once. Worker transfer lists contain each original backing buffer once. Abort, supersede, decode/resource failure and double-disposal are covered by tests. Wind uses the shared authoritative `host.elapsed` clock; no private animation loop exists.

Final scene positions are [−35.32316911636920, 0.081, −10.5] and [405.24741793906245, 0.081, −10.5], yaw 0, scale 1. Complete source bounds plus a 0.15 m wind margin are checked against route walls, rail and platform; the roots retain their original below-ground depth. Browser and visual review remain separate. Geometry integrity does not certify placement, browser rendering, final visual acceptance, hardware FPS, or GPU memory. Structure remains passed; surface and user visual review remain pending; hardware remains unmeasured. Nothing in this local adapter work itself publishes the candidate.
