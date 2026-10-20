# Reusable adapter contract, not a whole-Hong-Kong replacement

This experiment is additive. Do not overwrite existing source packages, map cases, old/new building components or published anchors.

## Inputs and admissibility

- `createAssembly(score)` accepts the existing `kaopu.hk.measured-plane-boundary/0.1-research` metre-space adapter. A source identity and exact georeference remain attached. Retain the actual immutable recipe and provenance, not a bounding-box substitute.
- The shell assembly is not a storey container. Its `patches` are geometric surface patches. They are not inferred rooms, wall thicknesses or physical structural parts.
- `towerRule` requires one horizontal roof and all remaining operations to be wall strips sharing the same top and base. Other buildings are rejected for that rule, not forcibly simplified.
- The window requires an explicit source wall-strip ID and metre-scale axes. Never assume `p003` is the appropriate facade in another source building. The default ID is solely this tower's tested host.
- Interior floor design must remain a distinct authored layer with unknown actual interior evidence, even if its footprint derives from a measured exterior boundary. A floor-space node is not its slab mesh.

## Dependency semantics

- Spatial containment, assembly membership, geometric voids, hosted installations and motion are different relations.
- Visibility does not remove a geometric cut or change exports. Assembly exclusion removes the selected physical output and suppresses dependent installation output. Export flags any incomplete shell.
- Host cuts use the same opening parameters as the fixed frame. A leaf pivot affects its sash and glass only; fixed frame and host hole do not swing.
- Parent placement acts once. Do not both transform the group and bake the same transform into children.
- Geometric coincident edges are evidence of numerical contact only. No structural-support edge is synthesized.

## Integrating an original regional source pipeline

1. Identify exact source IDs, source versions, CRS/datum, licence and existing region owner.
2. Reconstruct and test that building's current measured shell without changing its source.
3. Admit only the supported parameter rules. Leave unsupported details unknown and editable as an explicit proposal rather than silently supplying them.
4. Select proposed design features using verified building-specific evidence first, then explicit design decisions, then type suggestions. Do not treat “hotel” or “residential” as proof of grille, doorway or interior layout.
5. Run deterministic geometry/dependency tests, actual WebGL visual tests and source-preservation checks before adding the independent adapter to a region.
6. Preserve original case URLs, per-building identities and historical gating. No height-only Peninsula old/new split; no new podium or ground closure to hide unsupported towers.

## Elevators and stairs: researched but not installed equipment

The next service schema separates a fixed shaft, assumed stop nodes tied to floor IDs/elevations, a movable car and landing-door openings. A shaft crossing a floor does not prove a stop there. Fire-fighting lift status does not make it a public evacuation route. Unknown fields remain unknown.

References: [IfcBuildingStorey](https://standards.buildingsmart.org/IFC/RELEASE/IFC4_3/HTML/lexical/IfcBuildingStorey.htm), [IfcOpeningElement](https://standards.buildingsmart.org/IFC/RELEASE/IFC4_3/HTML/lexical/IfcOpeningElement.htm), [stable elevator property set](https://standards.buildingsmart.org/IFC/RELEASE/IFC4/ADD2_TC1/HTML/schema/ifcproductextension/pset/pset_transportelementelevator.htm), [transport element common properties](https://standards.buildingsmart.org/IFC/RELEASE/IFC4_3/HTML/lexical/Pset_TransportElementCommon.htm).

These adapter records are project-specific, not a claim that custom `stopNodes` or `servedFloorIds` are native IFC JSON fields. Detailed equipment, stairs, physical collision, life-safety and code compliance are not certified by the current prototype.
