# R04: one real geometric link between two proposed floors

This isolated pilot uses the existing measured exterior footprint of Kowloon object B359971994401063C0. Its interior, use, construction and real staircase location remain unknown. No Peninsula Hotel identity or new/old separation is asserted. The current r03 entry and all r03 files remain unchanged.

## What is built

- Two closed, stepped solid flights and one closed intermediate landing.
- The departure and arrival landings are retained physical regions of the lower and upper slabs, not duplicate overlapping boxes.
- Stable floor IDs supply the endpoints. Default FFLs are 3.40000191 and 6.60000191 m. The previous firstSlabOffset is the slab bottom, not FFL.
- 20 risers of 0.16 m, two runs of nine 0.28 m treads, 1.2 m flight width and landing depth. These are editable author-selected design inputs, not measured dimensions or legal standards.
- A separately derived upper-slab staircase aperture. It does not cut the lower floor, fill the source concavities or reuse the central 2×2 m service reserve.
- Changes to floor spacing, slab thickness, tread and target rise recompute the actual rise count, solid profiles, landing levels and hosted aperture together. Invalid fit, landing thickness, endpoint and clearance inputs are rejected before committing state.
- Geometry uses metre coordinates and the existing original concrete material mother. Transparent slabs are a display-only inspection mode.

## Minimal adapter contract

1. Inspect the proposed floors without additional stair openings.
2. Derive the stair proposal from stable lowerFloorId and upperFloorId.
3. Pass openingRecords into the floor adapter's additionalOpenings. Every record has one exact hostSlabId.
4. Rebuild and inspect those floors, then build the stair against them. The builder rejects a missing or mismatched actual upper-host opening.
5. Derive effective assembly enablement from both endpoint floors and their common building parent; visibility is separate. Disabling the stair removes its added hole. Disabling an endpoint suppresses the connection.

## Verification and limits

The test suite checks manifold positive-volume solids, actual tread and landing elevations, the final riser supplied by its host face, downward and upward rays against slab and stair triangles, lower-floor nonpenetration, full-patch geometric clearance, strict footprint/hole fit, parameter propagation, local-to-world transform inheritance and reset. Browser tests must also pass with actual WebGL and matching served asset hashes; source or a concept image alone is not a render pass.

This is only floor-001 to floor-002. Guards, handrails, doors, actual support design, ground access, complete multi-storey circulation and elevator machinery are not implemented. navigationConnectionEnabled, circulationComplete and evacuationPermitted remain false. The 3.0 m default geometric headroom result is not a legal clearance certification.

## Learning and provenance

Original implementation, learning host/void/spatial relationships from [IfcOpenShell feature API](https://docs.ifcopenshell.org/autoapi/ifcopenshell/api/feature/add_feature/index.html), [IfcBuildingStorey](https://standards.buildingsmart.org/IFC/RELEASE/IFC4_3/HTML/lexical/IfcBuildingStorey.htm), [IfcOpeningElement](https://standards.buildingsmart.org/IFC/RELEASE/IFC4_3/HTML/lexical/IfcOpeningElement.htm) and [FreeCAD ArchStairs](https://github.com/FreeCAD/FreeCAD/blob/main/src/Mod/BIM/ArchStairs.py). No external teacher source or mesh is copied into this pilot. Existing repository source/data/material provenance and Three.js MIT notices remain applicable. Reused immutable modules are explicitly imported from r03 and the existing hk-three-buildings-r01 case.
