# Guilin DEM v0.5 master task

## Fixed project scope

Build one overall Guilin DEM and four independently zoomable 10 km × 10 km detailed cores.

The four fixed cores are stored in `projects/guilin/config/core_regions_v050.json` and are not to be re-confirmed:

1. 真宝鼎
2. 桂林古城, anchored at 靖江王城
3. 秧塘机场旧址
4. 阳朔县城

Each detailed core is a 100 km² square centered on its fixed point. Use EPSG:32649 and derive exact projected bounds from the WGS84 centers.

Historical interval:

```text
1940-1945
```

Season profiles must be available for spring, summer, autumn, and winter without relocating stable terrain, rivers, roads, fields, or trees.

## Immediate priority

Produce a showable online Guilin candidate as quickly as possible. The candidate must remain separate from the current stable v0.3.1 page until the user approves it.

Suggested candidate path:

```text
/guilin-v050/
```

Keep these existing validation entrances available:

```text
/
/guilin/gaea-proof
```

## Overall map

Continue the established overall range from the Zhenbao Ding direction through Guilin, Yangtang, Yangshuo, and the Pingle direction. Fill missing DEM coverage instead of shrinking the AOI.

The overall map must provide:

- truthful approximately 12.5 m DEM where available;
- continuous major rivers and tributaries;
- stable terrain tiling and no edge gaps;
- distant vegetation, agriculture, rock, and wetness fields;
- clear markers and entry controls for the four detailed cores;
- smooth zoom from overall map into each core.

## Water-system repair

The current build has water leaving the terrain at the clipped edge and broken major river segments.

Required corrections:

1. Repair and validate the full Li River and Xiang River centerlines across the project AOI.
2. Use one global CRS transform and one AOI clip for terrain, linework, water polygons, distance fields, and runtime textures.
3. Repair broken river line segments before line-to-polygon conversion.
4. Prevent Y-axis or texture-orientation inversions.
5. At tile and AOI edges, water may terminate only where the source river crosses the boundary.
6. Terrestrial vegetation, crops, trees, shrubs, bamboo, and orchards inside permanent water or active channel must equal zero.
7. Add river-continuity tests and a diagnostic map that highlights gaps, overlaps, exits, and invalid endpoints.

## GAEA feature regression

The previous build exposed GAEA-style terrain controls and the current build no longer shows them.

Required work:

1. Find the last known good implementation from Git history, previous assets, or existing page code.
2. Restore the missing controls and feature visibility without deleting current ecology work.
3. Keep controls for erosion, rock exposure, terrain detail, water, vegetation, agriculture, and diagnostics.
4. Add a regression test that verifies the GAEA panel and required control IDs exist and remain interactive.
5. Do not replace real terrain truth with a decorative procedural terrain.

## Vegetation regression and quality rebuild

The current vegetation layer is visually worse than the previous good version. Treat this as a regression investigation.

Required process:

1. Compare the last visually acceptable version with the current candidate.
2. Identify whether the regression comes from instance loss, canopy shader changes, palette flattening, habitat masks, load failures, field orientation, or camera and lighting changes.
3. Restore every superior element that remains compatible with the new habitat rules.
4. Apply `skills/dem-ecology-surface/SKILL.md` and the v0.4 knowledge catalog.
5. Use at least 18 active vegetation, bamboo, shrub, and orchard prototypes across the detailed cores.
6. Implement species-dependent height, crown profile, trunk scale, palette, grouping, wind stiffness, and habitat.
7. Add three-layer canopy volume, tree-trunk cues, forest-edge shrubs, phoenix-tail bamboo, moso bamboo, and near-distance geometry.
8. Use the carpet-derived Parallax Strand Surface for grass, rice, vegetables, low crops, and forest floor.
9. Add one world-space wind field with stable per-instance phase, root locking, species-specific stiffness, gusts, and season profiles.
10. Avoid abrupt LOD popping. Use continuous far, medium, and near detail.

## Agriculture, crop color, and bunds

Required agriculture classes:

- water or transplanting rice;
- green tillering rice;
- heading or mature rice;
- harvested rice and stubble;
- fallow;
- normal green vegetables;
- blue-green vegetables;
- yellow-green crops;
- maize-like dryland crops;
- root-crop dryland;
- citrus orchard;
- pomelo orchard;
- persimmon orchard;
- mixed loquat, plum, and peach orchard.

Placement rules:

- paddy only on valley floor, floodplain, alluvial terrace, and irrigable low footslope terraces;
- vegetables near settlements, roads, low terraces, and water access;
- dryland crops on better-drained terraces and footslopes;
- orchards on well-drained footslopes and low terraces;
- no agriculture on water, active bank, ridge, peak, cliff, strong rock core, road, building, or airport masks.

Bund rules:

- narrow raised core;
- lower vegetated shoulder;
- visible top-view field boundaries;
- irrigation and drainage cuts;
- field-access cuts;
- local field orientation;
- globally continuous crop-row phase;
- reversible microrelief only.

## Detailed core expectations

### 真宝鼎

Prioritize high-relief mountain form, exposed rock, erosion, ridges, forest transitions, conifers, evergreen broadleaf forest, sparse rock shrubs, streams, and season changes.

### 桂林古城

Prioritize historically constrained city terrain, Li River relationship, old-city anchor, nearby hills, city-edge agriculture, roads and waterways, urban hard exclusions, and 1940-1945 land-use placeholders that remain evidence-labeled.

### 秧塘机场旧址

Prioritize the historical airfield terrain, runway protection and flatness, surrounding karst hills, farmland, drainage, villages, river relationship, and the existing 48 km² historical-enhancement logic nested within the new 100 km² core.

### 阳朔县城

Prioritize Li River continuity, karst peaks, county-seat terrain, farmland, orchards, bamboo, riverbank sequence, roads, and the transition toward the existing southern AOI.

## Candidate runtime

The candidate viewer must include:

- overall map;
- four core-region buttons and visible markers;
- smooth camera transitions;
- full aerial, river, erosion, rock, forest, bamboo, paddy, vegetable, orchard, GAEA, and top-view presets;
- layer switches;
- active season selector;
- active release and source-quality display;
- performance information;
- v0.3.1 rollback link;
- `/ops/` status link.

## Validation

At minimum verify:

- four exact 10 km × 10 km projected core bounds;
- overall AOI coverage includes every core;
- no missing Zhenbao Ding DEM tile is silently skipped;
- Li River and Xiang River continuity;
- water stays inside its valid geometry and terrain intersection;
- zero terrestrial vegetation in permanent water and active channel;
- GAEA control regression fixed;
- at least 18 active prototypes;
- paddy forbidden overlap equals zero;
- strong rock-core large-tree overlap equals zero;
- crop palettes are visually distinct;
- bunds are visible and cut by irrigation and field access;
- wind root locking and stable phase;
- tile seams for canopy, rows, fibre phase, water, and terrain;
- browser console zero errors;
- all camera presets and layer switches work;
- v0.3.1 rollback loads;
- online endpoints return HTTP 200.

## Delivery sequence

1. Hydrology and GAEA regression repair.
2. Vegetation, agriculture, wind, and Parallax Strand Surface rebuild.
3. Four-core and overall-map runtime integration.
4. Candidate browser, screenshots, QA, package, and online preview.
5. User visual review.
6. Promotion only after approval.
