# Guilin v0.5 recovery audit

## Status

The currently published build is rejected as a visual and functional candidate. It was published before the full user requirement set and visual gates were verified. No later build may be published automatically.

The public URLs remain useful only as references for the current defects:

- main terrain page
- GAEA proof page

The stable release stays `v0.3.1` until a new candidate passes the gates in `projects/guilin/config/release_gate_v050.json`.

## Confirmed regressions

### 1. Strange line artifacts

The current page contains visually unexplained lines. Likely sources include:

- river polylines converted into wide polygons and triangulated across disconnected or re-entering segments;
- clipped water polygons that bridge separated pieces;
- terrain or diagnostic mesh edges leaking into the normal render;
- field or water overlays drawn without a parent-mask and depth discipline.

Normal view must contain no wireframe, topology debug line, polygon bridge, diagonal water triangle, field-cell outline or clipping line. Every optional diagnostic line must be behind an explicit diagnostic switch.

### 2. Water system is not the requested system

The final hydrology must use named and continuous real river topology. The Li River and Xiang River are mandatory named primary networks. Their tributaries may be added only from approved source geometry or historical reconstruction evidence. Programmatic branch generation is allowed for diagnostics and erosion candidates, not as a replacement for the named real river network.

Required fixes:

- preserve complete source line geometry before clipping;
- split a line into contiguous in-bounds parts instead of reconnecting separated parts;
- use topology-aware line merging and endpoint snapping in projected metres;
- generate water surfaces from validated centerlines and widths;
- clip surfaces to the terrain AOI without creating bridging triangles;
- store named river IDs, source lineage and continuity reports;
- render a dedicated hydrology layer and a visible hydrology control group;
- expose river centerline, water surface, bank, flow direction and continuity diagnostics separately;
- require zero out-of-bounds vertices and zero unexplained diagonal triangles.

### 3. Mixed terrain clarity violates the agreed model

The overall terrain and the four core regions must share one authoritative DEM lineage and the same truthful native resolution label. Core regions may have denser browser tessellation, local cached grids and ecology detail, but they may not switch to a different truth source or create a visible boundary between a coarse outside map and a clear inside map.

The current public build mixes an approximately 30 m overall fallback with 12.5 m focus grids. This is rejected for the final Guilin candidate.

Locked rule:

- build a continuous 12.5 m authoritative mosaic for the full Guilin AOI when source coverage is available;
- if any area still uses a fallback source, mark the candidate blocked and do not publish it as the final 12.5 m map;
- use one vertical datum, CRS, pixel alignment, row order and elevation scale across the AOI;
- core regions differ by visual detail and ecology layers, not by terrain truth clarity.

### 4. Black perimeter and hard visual cutoffs

The terrain must not sit inside a large black void. The full AOI surface must cover the expected camera view. At the outer boundary use atmosphere, distance haze, desaturation, depth blur and a terrain skirt or horizon treatment. Do not fill missing truth pixels with invented elevation.

The visual policy is:

- near active core: sharp terrain, water, vegetation, crops, bunds and local material detail;
- medium range: simplified canopy, broad land-use colors, reduced crop geometry and softer normals;
- far range: terrain silhouette, broad land-cover color, atmospheric perspective and controlled blur;
- outside the AOI: fade into horizon or background atmosphere, with no stark black rectangle.

### 5. Ecology belongs in the cores

Detailed trees, shrubs, bamboo, crops, orchards and bunds are required only in the four fixed 10 km by 10 km core regions:

1. Zhenbao Ding
2. Guilin old city
3. former Yangtang airfield
4. Yangshuo county seat

The overall map does not receive dense individual plant instances. It may use broad land-cover color, canopy-height fields and blurred aggregate vegetation. Detailed ecology streams load only after a core becomes active and the camera reaches the appropriate screen footprint.

Hard exclusions remain active in every core:

- permanent water;
- active channel and bare bank;
- strong rock core;
- road core;
- building footprint;
- airport protection surface;
- crop interiors for wild woody instances.

### 6. The prior 10 km2 ecology work was not carried into the runtime

The prior `Guilin_10km2_Ecology_Surface_Prototype_v0.3.1` contains actual visual behavior that the new candidate lost. Its code and output are a visual and behavioral baseline, even though its terrain was a deterministic proxy awaiting replacement by the real 12.5 m DEM.

Baseline identity:

- standalone HTML SHA-256: `40c5771cb625a74fe7b03cd8b7653ee21aea2067dadffb509c49e8b869616b46`
- validation SHA-256: `abaa5db435c519db7aca056b150bc57ea726d2e9853d0637be3420f894af5417`
- review montage SHA-256: `4e99c4bcbc0381dee19624b8842f15a9bba55fbec5bf70dbd288d502877d246f`

Validated behavior to recover:

- 20 vegetation archetypes;
- 23,685 tree, bamboo and orchard instances;
- 7,322 shrub instances;
- 5,277 rice clusters;
- zero tree, shrub or rice instances in permanent channels;
- 68 terrain-following erosion streamlines;
- maximum added erosion incision 8.629 m;
- visible rock exposure 4.13 percent and strong rock core 2.80 percent;
- eight crop palette classes;
- approximately 0.753 km2 paddy, 0.585 km2 orchard, 0.130 km2 vegetables and 0.311 km2 dry crops;
- narrow raised bund cores with lower vegetated shoulders;
- world-aligned field texture without Y inversion;
- water, paddy, forest, karst, erosion and top-view inspection presets.

Recovery rule:

- port the actual field, instance, canopy, crop, bund, erosion and material behavior into a reusable core-runtime module;
- replace the proxy terrain input with each core's real DEM;
- do not reduce the baseline to documentation or JSON contracts only;
- preserve the baseline's spatial rules and improve its visual fidelity with the shared v0.5 skill.

### 7. Camera and ground access

The current fixed camera height and near plane prevent ground inspection. The four cores must reach 1.7 to 2.0 m above sampled terrain. Camera target, collision and clipping use real metres. Ground mode, terrain focus, core switching and diagnostics are release blockers.

### 8. GAEA and hydrology controls must both be visible

The candidate must show two distinct control groups:

- GAEA-style visual processing: erosion, deposition, surface detail, talus, karst, exposed rock and material response;
- hydrology: named rivers, tributaries, water surfaces, banks, flow direction, continuity diagnostics and water visibility.

A water-material slider does not satisfy the hydrology-system requirement.

## Correct runtime architecture

1. Load the continuous overall DEM mosaic.
2. Render overall terrain, named river network and broad land-cover only.
3. Apply distance haze and far blur instead of black or a hard clarity boundary.
4. Select one of the four fixed cores.
5. Stream the core DEM grid from the same authoritative mosaic lineage.
6. Load the recovered v0.3.1 ecology behavior for that core, rebuilt against real terrain fields.
7. Add v0.5 tree species, canopy, wind, Parallax Strand Surface, crop, bund and season systems.
8. Allow camera descent to ground level.
9. Keep v0.3.1 available as rollback.
10. Publish only after screenshot and browser gates pass.

## Required evidence before publication

For the overall map:

- full map screenshot without strange lines;
- full AOI screenshot without a black perimeter;
- Li River and Xiang River continuity overlay;
- water surface and centerline comparison;
- far-distance blur and atmosphere evidence.

For each core:

- overview;
- medium oblique view;
- 50 m altitude;
- 2 m altitude;
- ground observer view;
- vegetation and hard-exclusion overlay;
- paddy, crops, orchard and bund view;
- water and bank view;
- GAEA controls visible;
- hydrology controls visible.

No candidate is public-release eligible until these images, zero-error browser logs, topology reports and rollback test results are attached to the PR.
