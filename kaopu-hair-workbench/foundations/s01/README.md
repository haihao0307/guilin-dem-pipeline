# SCALP-S01 — 第一课：头皮生长域与稳定根点

Status: implementation submitted for candidate testing, not public delivery yet.

Frozen parent c89ebc4da8d24ef3decfad85336c5dffb2c471c8 / PR240. Only this new foundations/s01 directory and dedicated workflows are added. Do not merge or force push. L03 and every previous public page remain unchanged.

## Scope
One original neutral GNM head, exact vertex/triangle arrays extracted without loss from the existing L03 core. This deliberately uses the same neutral surface used by the old root binding, not a new head or scalp cap. ET18 eye/lip cosmetic display refinements and skin textures are not loaded into this diagnostic; no claim that the complete L03 beauty render is reproduced.

Independent per-vertex growth mask and density; fractional zero-level boundary follows actual native triangles. Editable mask via an edge-geodesic brush with separate density tool, undo/redo, same-browser save/restore and validated JSON import/export. A deterministic, fixed potential root pool has triangle IDs, barycentric weights, stable IDs and independent activation ranks. Density and view/probe changes do not reseed it. Normal probes are explicitly not growth-direction inference. Same-topology width/crown stress tests do not claim compatibility with all character presets.

## Authoring and limitations
The initial contour is a provisional artistic preset authored on this neutral template. The build records its polar authoring markers, nearest native vertex anchors and pinna exclusion seeds in domain.json. This is NOT a measured personal hairline, automatic scalp segmentation or biological follicular-unit model. Runtime no longer invokes a haircut-dependent world-coordinate scalp function; it edits/reads explicit topology-attached fields. However that does not make the initial contour anatomically correct: the user must inspect the front/temples/ears/nape and request or apply corrections.

Editable safety band and pinna exclusions are themselves explicit authored fields. No root planting outside that band. Root marker offset 0.12mm is display-only; bound coordinates have zero offset. Boundary display offset is 0.16mm. Minimum pool spacing is a 3D Euclidean chord constraint, not a proof of geodesic/biological spacing. Surface-distance display uses zero-edge crossings plus Dijkstra on the mesh edge graph; it is an approximate surface metric, not exact continuous geodesics. Head deformation keeps rest fields/bindings attached; reported domain area remains rest-pose area.

No haircuts, dense hair generation, initial biological directions, whorls, internal follicles, self-collision or dynamics in S01. No automatic migration of old L03 hair archives. Local saved domain fields are independent. No multi-window authority service yet; cross-window storage changes are announced but do not silently overwrite active work.

## Teacher applied, not merely named
SideFX official workflow: https://www.sidefx.com/docs/houdini/fur/workflow.html
Guide Groom: https://www.sidefx.com/docs/houdini/nodes/sop/guidegroom.html
Hair Generate: https://www.sidefx.com/docs/houdini/nodes/sop/hairgen.html
Applied here: skin attributes independent of styling; explicit growth region and density; surface attachment; inspecting the authoring substrate before creating guides. No SideFX code, HDA or example assets copied. It is an independent browser implementation, not Houdini running in a browser.

## Tests and next gates
Run build.mjs then test.mjs with Node22; test.mjs uses Playwright Chromium for actual rendered screenshots and UI operations. PUBLIC_URL triggers immutable-public hash validation and the same browser interaction checks. Artifacts must be reviewed before public delivery is claimed.

Next: (1) visually confirm/refine this scalp contour and transition density; (2) independently author root tangent/emergence fields and whorls with short 1–8mm curves and collision checks; (3) independent arc-length field; (4) sparse guide grooming and part-aware interpolation; (5) dense strands, detail, shading and later dynamics. Do not skip a failed gate by hiding it under more hair.
