# Farmland R043 · Hydrology-First Agricultural Field Graph Contract

Status: implementation contract; not visual approval.

## Required generation order

1. **Macro truth / terrain mother**
   - Preserve the accepted mountain–slope–foothill–plain–river composition.
   - Compute slope, curvature, flow direction, catchment identity, ridge mask, valley mask, and floodplain mask in stable world coordinates.

2. **Hydrology skeleton**
   - Build source, trunk river, branch, distributary, canal, field inlet, field outlet, spill, collector drain, and river receiver as distinct object classes.
   - Store branch order and accumulated distance from source / receiver.
   - Water level and bed level remain distinct.

3. **Land-use suitability fields**
   - Paddy, terrace, forest, rock, orchard, settlement, path, and protected-water masks are separate fields.
   - Paddy placement must not cross river beds, steep rock faces, protected forest sources, or unresolved terrain gaps.

4. **Management skeleton**
   - Long boundaries originate from canals, paths, settlement access, valley shelves, and contour direction.
   - These boundaries define management zones before local parcel subdivision.

5. **Parcel graph**
   - Subdivide management zones recursively using target labor scale, irrigation access, drainage access, contour orientation, and boundary continuity.
   - Adjacent parcels share exactly one boundary object.
   - No unrestricted Voronoi output is accepted as final parcel geometry.

6. **Terrace builder**
   - Generate a level or near-level bench, a real riser, a walkable bund crest, and localized inlet / outlet notches.
   - Terrace bands follow contour structure; cross-bunds, gullies, paths, and water ports subdivide the band.

7. **Per-field water control**
   - Each field is an independent control volume with water depth, capacity, inlet, outlet, upstream source, downstream receiver, and overflow rule.
   - Every field must have a valid `SOURCE -> FIELD -> RIVER` path.

8. **Ecology and labor**
   - Forest / rock placement follows terrain process masks.
   - Farmers and buffalo move only on task-compatible terrain and field routes.
   - Shelters sit on stable edge nodes outside active inundated beds.

9. **Visual field compilation**
   - Use deterministic world-space multi-scale fields for geometry, color, roughness, wetness, and crop state.
   - Fixed geometry only; no camera-dependent adaptive subdivision or device-dependent parcel simplification.

## Fail-closed gates

- River and canal topology disconnected.
- Any paddy lacks an inlet, outlet, source path, or receiver path.
- Parcel overlap, uncovered internal gap, or boundary ownership above two.
- Paddy crosses excluded slope / water / rock / forest-source masks.
- Terrace bench or riser detached from the terrain body.
- Actor feet / hooves detach from the current ground surface.
- Seasonal visual controls alter terrain, parcel identity, or hydrology.
- Public browser fails to execute or produces an empty scene.

On failure:

`truthApproved=false`

`visualApproved=false`

`visualAcceptance=false`

`productionReady=false`

## R043 implementation priority

A. Replace hand-authored river-distance approximations with an explicit hierarchical drainage graph and cumulative distance fields.

B. Derive valley shelves, floodplain, steep forest / rock zones, and agricultural suitability from that graph.

C. Regenerate plain paddies and terrace groups from management skeletons aligned to water, access, and contours.

D. Only after A–C pass, improve riverbed geometry, material fields, atmospheric depth, settlements, crop detail, and seasonal controls.
