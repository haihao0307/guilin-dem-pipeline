# Current Best View N05 — Cellular return types

Status: **Candidate partial / pinned-source CPU verified**

- `CellValue` is a piecewise-constant closest-cell identity mask. It has zero derivative inside most cells and value cliffs at cell changes; direct displacement creates hard geometric walls unless that is deliberately intended.
- Euclidean `F1` is value-continuous but not derivative-continuous at nearest-feature boundaries. Radial shapes can be useful, but normals may crease.
- FastNoiseLite `Distance2Sub` returns `(F2-F1)-1`. Add one before treating it as a nonnegative edge-gap signal. It reaches zero at boundaries but is not a signed, normalized or unit-slope Euclidean edge distance.
- Cellular fields are procedural partitions, not physical grain, joint, weathering or erosion evidence. Material identity, scale, orientation and distribution need target-specific observations and acceptance.
- Material sampling does not mutate geometry. Displacement, normals, collision, silhouette, bounds and LOD are separate authorized consumers.
- The pinned source’s two cellular setter remarks swap their default labels. Constructor state (`EuclideanSq + Distance`) and executable equivalence are the current source contract.
- Landscape/Farmland have no N02 acknowledgment; do not repeat routing. Brick PR15/PR17 and Tiles PR11 are verified possible entries, but no guidance has been delivered or adopted.

Canonical Truth, Frozen R1 and production Mother branches remain unchanged.
