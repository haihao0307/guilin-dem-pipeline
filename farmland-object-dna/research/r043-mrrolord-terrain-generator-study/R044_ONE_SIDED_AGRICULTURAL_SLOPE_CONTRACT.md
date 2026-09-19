# Farmland R044 · One-Sided Agricultural Slope Contract

Status: required composition and generation contract for the next visual workbench.

## 1. Fixed scene composition

The next Farmland workbench must use one continuous landform section:

1. **Rear mountain and source forest**
   - high mountains remain behind the agricultural system;
   - protected forest and springs occupy upper catchment positions;
   - mountains are background / source terrain, not a second agricultural wall.

2. **One dominant forward-facing slope**
   - a single broad slope descends from the rear mountains toward the viewer / plain;
   - terrace groups are cut into this slope;
   - no mirrored agricultural slope is created across the river.

3. **Foothill transition**
   - terrace drainage, paths, sediment transition, and collector channels converge here;
   - slope terraces connect physically to the flat plain without floating shelves.

4. **Broad foreground paddy plain**
   - the plain is larger than any single terrace group;
   - fields are smaller, irregular, and organized by canals, paths, labor access, and historical subdivision;
   - field groups do not form a uniform grid, honeycomb, or random polygon mosaic.

5. **Front / lower-edge river**
   - the river is the final receiver at the lower foreground edge;
   - it may curve across the front and receive collector drains;
   - it must not divide the scene into two equal agricultural banks.

## 2. Correct use of MrRolord's method

Use the video as a procedural-method reference only:

- begin with a hierarchical source-to-receiver water graph;
- derive terrain and suitability fields from river / canal distance, branch order, slope, curvature, and catchment identity;
- make land-use masks conform to the terrain;
- derive agricultural organization from water, access, and terrain constraints;
- compile vegetation, material, wetness, and seasonal appearance from the same fixed world fields.

Do not copy the video's exact valley layout.

## 3. Water hierarchy for this composition

`mountain spring / forest runoff`
`-> high contour intake canal`
`-> terrace-group distributaries`
`-> local field inlet`
`-> terrace storage`
`-> staggered spill / outlet`
`-> lower terrace or foothill collector`
`-> plain main canal`
`-> plain field inlet / outlet network`
`-> front river`

The high contour canal may run laterally across the single slope. Water descends through localized ports, not through continuous blue lines across every bund.

## 4. Parcel formation order

No field subdivision is allowed before these structures are frozen:

- single slope boundary;
- foothill break;
- plain boundary;
- river corridor;
- high contour canal;
- terrace-group axes;
- plain main canal and collector drain;
- primary labor paths and access points.

Then form parcels in two different regimes:

### Terrace parcels

- begin as contour-following bands on the single slope;
- split with cross-bunds, gullies, paths, and water-control points;
- each parcel has a level or near-level bench, a real riser, a walkable crest, and local ports;
- widths and lengths vary with slope and water access.

### Plain paddy parcels

- begin as management blocks between canal / path axes;
- recursively subdivide by labor scale and drainage access;
- emphasize quadrilateral, trapezoidal, elongated, and gently curved polygons;
- T-junctions are common; full-width grid lines are not;
- adjacent fields share exactly one bund object.

## 5. Visual and agricultural gates

Fail the version when any of the following occurs:

- river creates a symmetrical two-sided agricultural valley;
- a second major agricultural slope appears opposite the confirmed main slope;
- terraces float, intersect, or fail to connect to the terrain body;
- fields are cut before the water / path / management skeleton exists;
- plain parcels look like Voronoi cells, bacterial colonies, or a rigid grid;
- river, canal, path, forest, field, and settlement masks do not conform to the same terrain;
- any field lacks a legal inlet, outlet, source path, receiver path, or labor access;
- actor routes cross deep water, steep risers, or inaccessible bunds;
- visual richness is achieved by color alone while geometry relations remain wrong.

## 6. Required review views

Before public delivery, review at minimum:

- long view: rear mountain -> one slope -> plain -> front river;
- oblique slope view: terrace bench / riser / canal relation;
- top view: parcel and water hierarchy;
- plain close view: shared bund, inlet, outlet, crop rows, path;
- foothill view: transition from terrace collectors to plain canals;
- labor-scale view: human and buffalo routes.

visualAcceptance=false
productionReady=false
