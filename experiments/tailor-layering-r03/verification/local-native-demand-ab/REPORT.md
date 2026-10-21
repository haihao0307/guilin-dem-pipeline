# Native complete-World contact-demand A/B

**PASS**: frozen R02, R03 OFF and R03 ON matched at initialization and all 8 accepted steps (9 discrete states), including `outer push` before step 3 and `inner tug` before step 6. Physical progress reached 0.066666666667 seconds without a rollback.

## Input and comparison boundary

Float32/Uint32 reconstructed from complete numeric R02 public Worker init. This is a historical input A/B, not fresh current-browser input capture.

The same complete native body and three garments were restored separately for every world. Physical `p/v/old`, inverse masses, topology, initial/rest state, masses, constraints and saved state used typed-array byte comparisons. Rendered `positions/normals/indices` also used byte comparisons. Complete histories and all normalized snapshot/scalar values used deep strict equality, including signed zero. Excluded timing/work fields and the two R03-only explanatory strings are enumerated in `summary.json`; the strings themselves are recorded per lane.

Each shared state was audited once after the three worlds proved identical. The independent audit covered complete nondegenerate cloth/body triangle pairs and full native-body half-thickness distances. No triangle intersections or degenerate triangles were reported. Every movable garment had actual particle motion. This does not establish continuous collision, self collision, arbitrary layering, dynamic-body behavior or rendered-yarn collision.

## Physical gates

| Metric | Observed maximum | Gate |
|---|---:|---:|
| Dynamic edge stretch | 1.449926135792 | 1.45 |
| Cloth contact residual | 0.481721199231 mm | 0.5 mm |
| Seam gap | 0.000000000000 mm | 0.01 mm |
| Body particle half-thickness overlap | 0.000000000000 mm | 0.001 mm |
| Independent triangle/body half-thickness overlap | 0.000000000000 mm | 0.001 mm |
| Fixed-particle drift | Every state passed | 0.001 mm |

## CPU replay timing

| Lane | 8-step wall total | Per-step wall median | 8-step process CPU | Initialization wall |
|---|---:|---:|---:|---:|
| r02 | 44.362 s | 5.411 s | 47.680 s | 6.024 s |
| r03-off | 43.846 s | 5.421 s | 46.102 s | 5.840 s |
| r03-on | 35.897 s | 4.350 s | 40.635 s | 4.823 s |

ON reduced total wall time by 18.13% and process CPU by 11.86% against R03 OFF in this run. Median per-step wall time changed by 19.75%. Lane execution order rotated at every step. Process CPU can exceed wall time because it includes all process threads. One eight-step run does not establish a stable performance distribution or a browser framerate.

| Stage, sum over 8 steps | R03 OFF | R03 ON |
|---|---:|---:|
| membraneMS | 0.522 s | 0.535 s |
| bodyProjectionMS | 6.909 s | 6.767 s |
| bodyVelocityMS | 0.510 s | 0.525 s |
| bodyEnvelopeMS | 6.646 s | 2.883 s |
| activeStrainMS | 0.258 s | 0.262 s |
| layerContactMS | 20.957 s | 18.247 s |
| layerBroadphaseMS | 3.904 s | 4.070 s |
| layerAuditMS | 5.848 s | 4.601 s |

`layerBroadphaseMS` is already included in `layerContactMS`; do not add both to a solver total.

## Executed feature work

| Counter, sum over 8 steps | OFF | ON | Reduction |
|---|---:|---:|---:|
| layer.candidateVisits | 221,647,151 | 221,647,151 | 0.00% |
| layer.vertexFaceTests | 15,172,691 | 10,744,820 | 29.18% |
| layer.edgeEdgeTests | 44,731,153 | 33,117,645 | 25.96% |
| layer.adjacentFaceTests | 7,567,663 | 78,520 | 98.96% |
| body.triangleQueries | 2,175,320 | 2,175,320 | 0.00% |
| body.cacheHits | 0 | 1,639,225 | — |
| body.bvhNodeVisits | 34,605,399 | 10,171,287 | 70.61% |
| body.vertexFaceTests | 30,920,856 | 2,718,741 | 91.21% |
| body.edgeEdgeTests | 46,381,284 | 6,945,604 | 85.02% |

The cloth candidate order and traversal count remain unchanged. The VF/EE counters count nearest-feature operations at candidate entry, not every operation inside swept tests, retargeting or sample collection. Both R03 lanes used the same numbers of solve and measure calls; no contact-history reset or inactive-garment shortcut produced the savings.

## Memory and evidence

Each world has 134,217,728 bytes of WASM memory and 6,753,168 reserved solver-pool bytes. The R03 body acceleration arrays account for 8,507,352 extra bytes, present in both OFF and ON worlds. Dynamic cloth caches, live feature bounds, JS objects and allocator overhead are excluded from that static-array figure. Process memory snapshots in raw evidence cover all three live worlds plus snapshots/audits; they must not be represented as per-world allocation measurements.

- `summary.json`: result, provenance, source and test hashes, every state, timings, counters and process memory.
- `states.ndjson`: independently audited state records.
- `comparison.json`: aggregates derived from those records.
- `tests/native-demand-ab.mjs`: repeatable full-world harness in R03 source.
