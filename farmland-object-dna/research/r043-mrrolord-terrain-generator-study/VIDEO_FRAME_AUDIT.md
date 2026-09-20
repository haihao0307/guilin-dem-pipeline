# Farmland R043 · MrRolord Terrain Generator Video Audit

Source: user-uploaded 18.02 s video `video__地形生成器的开发过程___大家..._0.mp4` reviewed frame-by-frame on 2026-09-16. The source file remains outside the repository; only observations are recorded here.

## What the video actually shows

- ~1.25 s: build a river / drainage network first in Blender Geometry Nodes.
- ~2.25 s: derive the first terrain from geometric proximity to the river system.
- ~3.25 s: use Voronoi as an early landscape-texture experiment, not as a claim that every agricultural parcel is a Voronoi cell.
- ~4.25 s: apply the landscape texture to the generated terrain and add point distributions for trees.
- ~5.25 s: rebuild terrain logic using accumulated distance from hierarchical river branches.
- ~6.25 s: use shader nodes and micro-displacement to form forests, fields, orchards, and paths.
- ~7.25 s: add mountain and plateau terrain variants.
- ~8.25 s: merge river-system geometry with the landscape-texture system.
- ~10.25 s: distort the landscape texture so it conforms to the underlying terrain relief.
- ~11.25 s: add building distributions.
- ~13.25 s: improve the riverbed and use steepness to place forest and rocky slopes.
- ~15.25 s: add a custom Adaptive Subdivision preset for smoother transitions and Eevee rendering.
- ~16.25 s: expose material controls for seasonal agricultural appearance.

## Direct correction to R041 / R042

R041 made a category error: it treated “cellular organization” as a visible Voronoi parcel style. The video does not support that interpretation. Voronoi is used as one intermediate texture experiment inside a larger hierarchy. The higher-level system is hydrology-first and terrain-constrained.

R042 corrected parcel topology, but it still starts too late in the chain. It builds fields on a prepared terrain and then connects them to water. MrRolord's stronger logic is:

`river hierarchy -> cumulative distance fields -> terrain valleys / benches -> land-use pattern -> terrain-conforming distortion -> vegetation / fields / roads / buildings -> material and seasonal variation`

## What Farmland must adopt

1. River order, cumulative branch distance, catchment identity, valley-floor distance, bank distance, and local slope become first-class fields.
2. Paddy suitability is derived from low slope, manageable elevation difference, irrigation reach, drainage path, access, and exclusion masks.
3. Parcel boundaries derive from management axes, canals, paths, contours, and historical subdivision; they do not emerge from unrestricted Voronoi.
4. Terraces are generated as bench + riser geometry from contour bands and permitted slope zones.
5. Forest, rock, orchard, path, settlement, and paddy masks share the same world-space field graph.
6. Visual detail uses fixed-world numeric fields; camera or device changes cannot rearrange geometry or object identity.
7. Seasonal controls modify crop state and material response but do not move field boundaries or hydrology.

## Constraints that prevent literal copying

MrRolord's shown workflow uses Blender Geometry Nodes, shader micro-displacement, and Adaptive Subdivision. Farmland currently requires browser delivery, fixed geometry, zero texture sampling, zero camera-dependent LOD, and explicit agricultural hydrology. Therefore the video should be translated into deterministic world-space fields and fixed tessellation, not copied literally.

## Acceptance split

- Visual composition gate: landscape hierarchy, continuity, material richness, atmospheric depth, terrain-conforming land use.
- Agricultural correctness gate: every paddy has legal inlet / outlet, shared bund ownership, realistic access, bounded water level, and task-compatible human / buffalo routes.

A version does not pass by satisfying only one of these gates.
