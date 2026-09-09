# KAOPU Learning Current Best View R1

Status: Candidate coordination policy. Not formal KAOPU R2.

1. Continuous learning must be problem-driven, not novelty-driven.
2. External AI output is a candidate interpretation, not an independent Observation Root.
3. Important claims should be checked against primary documentation, source code, papers, datasets, or reproducible experiments.
4. Learning speed is subordinate to provenance, independence, reversibility, and explicit Unknown handling.
5. Production Mother branches remain outside this coordination loop. Knowledge is routed to them; production changes remain their responsibility.
6. GitHub is the persistent state machine: learning queue, current best view, unknown/conflicts, tool registry, routing, and freeze ledger should survive any chat/session boundary.
7. Mature external systems are studied for transferable mechanisms, not copied wholesale.
8. Stable and experimental knowledge must remain separated. Candidate knowledge can move quickly; Frozen knowledge changes only by append-only versioning and explicit Judgment.
9. Determinism is an evaluation-contract property, not a bare boolean. A reproducibility claim must bind at least implementation/tool version, resolution/grid, seed, context/boundary policy, and execution mode. Cross-resolution equivalence is a separate property requiring separate evidence.
10. Every distributed world operator should expose a context/locality signature: local, neighborhood with required halo/radius, or global; normalization and seed scope must also be explicit. Independent page/tile scheduling is allowed only when the required context exists.
11. Global/world-stage work and local/detail-stage work should remain distinct. Baking or otherwise locking a world-consistent upstream result can be valid engineering, but presentation seam blending never proves shared truth continuity.
12. A focused high-resolution Region should normally remain a different evaluation/view of the same world graph/score, not a new truth identity or Observation Root merely because its resolution differs.
13. Tool/operator version migration is an evidence event. Vendor compatibility guidance is useful but insufficient for Frozen promotion; locked regression fixtures must test the actual project contract.
14. “Better noise” has no valid global ordering. Basis choice must be scoped to a task and metric such as derivative quality, tiling, morphology, runtime cost, temporal stability, sampling stability, or downstream physical semantics.
15. Evaluation footprint and filter policy are first-class field-operator properties. High-frequency procedural detail must not be allowed to alias into different apparent world structure merely because camera distance, page resolution, or sampling density changes.
16. Noise basis and spectral/fractal composition law are separate properties. Perlin/Simplex/Worley/etc. identify a basis family; additive fBM, multiplicative multifractal, hybrid, ridged, heterogeneous, or custom octave coupling identifies how scales interact. Both must be preserved.
17. Differential capability is a first-class operator capability. If an implementation natively provides gradients or a vector-field construction such as curl, that capability and its continuity assumptions should be recorded rather than silently reconstructed downstream.
18. Normalization, procedural runtime evaluation, and baking/caching must be explicit evaluation policies. A bake can be a reproducible derived cache of a locked graph, but it is never a new truth identity or Observation Root and must retain graph/tool/version provenance.

GAEA study disposition: LQ-GAEA-001 is candidate-complete after R01/R02 primary-source review. Current GAEA 2.3 documentation supports Erosion2 determinism, tiled-build context constraints, same-graph Regions, and migration testing. Exact current legacy TileGate semantics remain Unknown and are deliberately not required by the generalized operator-context abstraction.

Procedural noise study disposition: LQ-NOISE-001 is candidate-partial after R01. Current Unreal Engine, SideFX Houdini, Blender, Pixar research, and NVIDIA research support the contract additions above, but no production Mother has yet demonstrated measurable improvement. The next gate is execution of the footprint probe plus at least one Mother-domain cross-resolution fixture.

Next unresolved study remains LQ-NOISE-001 until its measurement gate is closed; Substance and Houdini Object-DNA studies remain queued behind it.
