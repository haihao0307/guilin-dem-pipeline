# Guilin DEM v0.6 terrain and hydrology only

## Purpose

Replace the old v0.5 workbench line with one minimal online inspection page that contains only truthful terrain, programmatic terrain enhancement and named hydrology. Vegetation, agriculture, buildings, ships, human history and GAEA software integration are out of scope.

## Fixed architecture

1. The immutable truth layer is the verified NASA ASF ALOS PALSAR 12.5 m source lineage. Never modify, resculpt or overwrite truth DEM values.
2. Remove every runtime dependency on the 30 m full-area preview. Keep old files only in an explicit archive path until the v0.6 release is validated, then remove them from active manifests and public routes.
3. Remove all `GAEA bridge`, external GAEA page, worker bridge, GAEA software connection and ecology demo navigation from the new page.
4. Replace the old GAEA UI with `Terrain Enhancement / 地形塑造` controls implemented by our own grayscale procedural fields.
5. The four named locations are camera anchors on one terrain system: 真宝鼎、桂林古城、秧塘机场旧址、阳朔县城. Do not present ecology demos or proxy terrain when a button is clicked.
6. Li River and Xiang River are named, continuous centerline networks. The centerline geometry is immutable. Width controls alter cross-section width only. They may not scale, translate, stretch or shorten the network.

## Current source truth and blocking fact

Read `DEM-Map-Pipeline/guilin-zhenbaoding-yangshuo-pingle/metadata/12_5m_download_status.json` first.

The repository currently records:

- 10 verified local 12.5 m source DEM tiles;
- selected source coverage fraction about 99.7002 percent;
- a real-pixel mosaic valid fraction about 99.6778 percent;
- an unresolved gap about 60.4567 square kilometres;
- ASF product download HTTP 401 in the last recorded attempt.

Do not claim full-area 12.5 m completion until the gap is actually resolved. Build v0.6 in two modes:

- `truthful_available_12_5m`: render only valid 12.5 m pixels and expose the gap clearly;
- `full_12_5m`: enabled only after missing source coverage is downloaded and checksummed.

Never silently fill the gap with 30 m, interpolation or synthetic terrain.

## Required v0.6 web page

Create a new self-contained route:

`web/guilin-v060/index.html`

with local JavaScript and CSS modules under `web/guilin-v060/`.

The page must provide:

- one full-area terrain viewport;
- four camera anchor buttons;
- a visible 12.5 m source status and gap status;
- no ecology panel;
- no GAEA bridge;
- no external iframe;
- direct terrain enhancement controls;
- direct Li River and Xiang River visibility controls;
- browser diagnostics and zero-console-error target.

## Terrain enhancement fields

Generate and expose independent grayscale fields. They are reversible visual delta fields and never alter truth elevation.

Required fields:

- `karst_mask`
- `cliff_mask`
- `erosion_mask`
- `sediment_mask`
- `terrace_mask`
- `fracture_mask`
- `debris_large_mask`
- `debris_medium_mask`
- `debris_small_mask`
- `riverbank_microterrain_mask`

Required controls:

- karst strength
- cliff verticality
- erosion depth and scale
- deposition amount
- terrace intensity and elevation band
- fracture scale
- large, medium and small debris density
- riverbank microterrain intensity
- enhancement detail scale, displayed in metres

The enhancement system may visually represent 1 m or 0.5 m detail through procedural grayscale displacement, normals, parallax and material response. It must label this as procedural visual detail, never as measured 1 m DEM.

## Regional terrain profiles

Apply distinct parameter profiles through masks and camera anchors:

- 真宝鼎: high mountain, broad slopes, forested highland morphology, local cliffs and plateaus, almost no karst enhancement.
- 桂林古城: compact vertical karst towers and valley floor, medium-high karst and cliff enhancement.
- 秧塘机场旧址: gentler low karst and agricultural plain morphology, moderate terrain enhancement.
- 阳朔县城: strongest peak-cluster karst, vertical walls, fractures, debris and river-valley contrast.

These are parameter presets on one terrain system. Do not crop or replace the map merely because a camera anchor is selected.

## Hydrology rebuild

Delete old generated water surfaces from the new v0.6 route. Rebuild from freshly validated source data.

Required steps:

1. Re-download or reconstruct Li River and Xiang River source features from official or OpenStreetMap primary geometry using a reproducible script.
2. Normalize names and segment topology.
3. Snap endpoint gaps only within a declared tolerance.
4. Preserve branches and confluences.
5. Emit named centerline GeoJSON with source IDs and checksums.
6. Generate width from local cross-section metadata and terrain relationship.
7. Width control changes lateral bank offset only.
8. Add a diagnostics mode showing centerline, segment IDs, gaps, confluences and invalid geometry.
9. Reject disconnected named-river output.

First v0.6 inspection may show centerlines and cross-section width. Seasonal water surfaces, beaches and hydraulic simulation can follow after centerlines pass visual review.

## Cleanup

The new route must not reference:

- the 30 m manifest;
- `/guilin/gaea-proof`;
- `gaea-bridge.js`;
- ecology demo runtime assets;
- v0.3.1 tree, shrub or rice binaries;
- iframe workbench navigation;
- old proxy core pages.

Do not delete archival evidence before the new route is validated. Remove obsolete public navigation and active manifests first. A later cleanup commit may delete archived files after user approval.

## Required tests

1. no 30 m runtime reference in v0.6;
2. no `GAEA bridge` or external GAEA URL in v0.6;
3. no ecology assets loaded by v0.6;
4. truth DEM hash unchanged;
5. source gap is visible and never filled by fallback data;
6. four camera anchors work on one terrain runtime;
7. terrain enhancement controls change only reversible enhancement fields;
8. Li and Xiang centerlines are named and continuous;
9. river width control does not alter centerline coordinates or length;
10. all local assets return HTTP 200;
11. browser console errors equal zero;
12. a directly open online inspection artifact is produced.

## Delivery

- Commit implementation to `fix/guilin-v060-terrain-hydrology-only`.
- Keep the PR draft.
- Publish a private or public inspection route only after tests pass.
- Final comment must include the exact online URL, truth DEM checksum, source gap status, named-river continuity metrics and browser test results.
