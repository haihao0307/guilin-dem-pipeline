# Lost Property Bureau R01

A new, independent, function-generated 44 × 38 m institution-machine. Fictional Hong Kong, 1978. It preserves the existing 88 game, Kowloon station and other cases.

The whole composition includes the public entrance hall, five clerk booths, waiting benches, upper office wings and maintenance galleries; three source-specific receiving and inspection lines; dedicated freight lift towers; level sorting and four archive tiers; synchronized moving luggage, storage dwell and retrieval; a screened return counter; two boilers, linked supply/return pipes, retained A4 forged connecting rod and crosshead, and the common transmission shaft.

All geometry is generated from functions in metres. One simulation time drives luggage, shaft, crank, carriers and the UI. Steam mechanics are an abstract demonstration, not real boiler engineering. Public movement space starts at z=10 m and cargo terminates at z=8.5 m. No original floor-plan image was available; the layout follows the explicit spatial relationships described by the user.

## Genuine reuse

Direct imports retain the current original `stationSurfaceCatalog` (A4 metal shader and KST1 surfaces), original `createTimberMember`/wood-v3 shader and grain coordinates, station geometry compiler, A4 `createForgedRod`, `placeForgedRod`, `createCrosshead`, native outline lettering and original static display batching. No photo texture, generated background picture, imported teacher mesh or external model substitutes for the model. Material compilation counters are included in the browser receipt. These are existing game materials, not a claim that unreviewed masonry is aesthetically finished.

## Reference limitation

The fixed f31df978 repository tree (12,345 entries), the game and r11 `VISUAL_REFERENCES.md`, and voxel-train LEARNING/PROVENANCE were checked. They identify Kowloon, Tai Po Market and Tai Po Kau references, not the Korean railway-complex reference mentioned by the user. No unverified Seoul-station attribution was adopted. The front is presently an original civic railway-inspired composition.

## Verification and limitations

`node --test qa/simulation.test.mjs` checks pause/reset, deterministic time, actual three-source store/retrieve routes, public-zone separation and cargo-to-cargo separation. The GitHub Actions workflow runs official pinned Playwright 1.57.0 / Chromium / SwiftShader for actual WebGL views, full readback, repeated view switches and pause/resume/reset/orbit interactions. A mobile viewport is not a real phone test.

This first complete building candidate does not yet offer a native SQLite.KaoPu export, general editor interchange, full pedestrian simulation or continuous swept-volume certification. It does not label a JSON description as a native .KaoPu file. Facade proportions and material appearance remain subject to visual review. The fixed dependencies are retained in the existing station/game paths.

## R01 clearance refinement

The fixed-solid check samples all three complete cargo routes at 0.5 s intervals (780 samples) against the actual generated triangles, including galleries, walls, structural members, conveyors and timber. It is not a proof for every continuous-time point. Cargo-to-cargo checks sample the first 400 s at 0.1 s intervals. Lift entry/output openings, junction guide rails, archive ceiling clearance and the return lift gallery opening are physically left clear. The prime mover shaft has a dedicated opening in each left gallery. Archive shuttles and lift trays follow the very same bag coordinates, with no independent floating cargo animation. Exterior clocks are excluded from static batching and use the shared clock. Finished luggage geometry is released, bounding active inventory display objects.
