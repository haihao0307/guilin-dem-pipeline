# R06 coastal display repair

The retained land renderer includes a coarse triangle only when its three nodes are non-ocean and finite. The old ocean fragment clip discarded nearest-node land regions instead. These shapes differ in mixed coastline cells, leaving uncovered strips through which the sky is visible. The old mask also sampled node data as edge-normalized texture coordinates rather than explicitly addressing the original nodes.

R06 uses the same two-triangle subdivision and node mask for the inner ocean discard test. It does not alter any source node or wave/material equation. The outer renderer's nearest-category partition is retained because its full mixed-cell geometry already uses a complementary nearest-category fragment mask.

Existing elevated land boundary edges receive separate, synthetic vertical display triangles down to -2 m, below the normal Hong Kong sea preset. These close visible side gaps; they are not surveyed sea walls, geology, bathymetry, or foundation construction. Original heights, categorical masks, and public height samplers are unchanged. Interior detail boundaries are excluded from the coastal closure unless an adjacent source triangle was omitted for actual ocean nodes.

The 30 m source coastline remains visibly coarse. This repair does not claim a newly measured or smoothed shoreline. CPU partition and source-hash checks are in `../tests/COAST-CPU-QA.json`; actual GPU screenshots are separately required before publication.
