# Candidate residency optimization

Scope: equivalent execution of the current resolver, not a new architecture, material or level of detail.

For each native candidate with nominal field d, every possible value used by the retained resolver lies in [d−.03001,d+.03001]. Near the surface the locked geometry displacement interval is inside [−.021,+.006] (wood within ±.0003, stone ±.004, metal and concrete within ±.001); away from the surface the retained stepping branch offsets by at most .03. The extra .00001 is outward engineering margin, not a formal IEEE builtin error certification. Nonnative values are exactly d.

Maintain U as the minimum upper endpoint among recorded candidates. U bounds the final minimum from above. A candidate whose lower endpoint exceeds U cannot win. Dropping it does not change the winning value, full construction coordinates, source identity or strict-less-than tie order. At resolve time, repeat that test against final U so earlier surviving candidates may also be skipped.

The original sequential resolver decides whether to evaluate a material using d−.03<h.d. Removing a nonwinning provisional winner does not alter the eventual winner: any potentially winning candidate has lower endpoint ≤U, while a removed provisional winner is strictly above U. Such a candidate therefore still takes the same evaluation branch whenever it could affect the final answer. Candidates that only change a nonwinning intermediate value cannot affect the final min.

The raw candidate count increments before pruning. Any original count above capacity still fails with id999. Retained count never exceeds raw count. No ingredient, surface, normal or matter function is removed, and no shader/material mother is edited. The original array capacity and final hit semantics stay intact.

CPU regression exercises more than 700,000 candidate records with f32 arithmetic, positive/negative near and far fields, native/nonnative identities, duplicate ties, retained order, and raw overflow. This is regression support for the argument; real GPU/backend and whole-frame verification remain required.

## Same-query construction reuse (rejected execution experiment)

The ray accelerators previously regenerated the entire architectural candidate set when asking for the union excluding roofs or excluding floors. The local revision assigns construction-only category metadata to the exact record calls already guarded by skipRoof/skipFloor. A complete query retains candidates admissible in any of three independently bounded sets. Alternate union resolution reuses those same function values in their original order, with independent upper endpoints. Exit ramps remain ordinary candidates; their material id17 does not make them skippable floor records.

The reuse is valid only for the identical query position and a complete original construction set. A changed position or partial set explicitly regenerates the requested domain. No prior-frame/screen/world texture is reused. CPU regression compares all three unions with three independent original-style queries across a further 16,000 multi-candidate cases. The 50c15438 GPU run preserved counts but slowed the warm main pass from about7s to9.7s. That execution change was reverted to a463f814 while retaining its tests/history. It is not used as an optimization.

## Fine row-group lower bounds (awaiting GPU acceptance)

For the shed's four unchanged post rows, each selected post's body, plinth and capital lies inside the box centered at (columnSupport, y−5, columnZ) with half extents (.43,4.15,.43). The fluted body radius is at most .209; the base spans y=[.85,1.25] and the capital y=[8.73,9.13]. All fit the enclosing y=[.85,9.15]. For the four bench rows, both complete finite slat sets and all three leg families fit the box centered at (benchSupport,y−1.518,bz), half extents (.4,.7,1.7). Its y=[.818,2.218] encloses the longest back support including its capsule radius.

The signed distance to an enclosing solid is a lower bound on the signed distance to every contained primitive. The selected repeated post/bench center is the identical center used by the retained construction; its selection is not approximated. This proof therefore concerns the actual candidates queried, including finite end cells. Subtracting the existing .03001 material/stepping envelope gives a lower endpoint for the complete group. If this endpoint is strictly greater than the existing admissible stationCandidateUpper, none of these candidates can win. Only then are the group's trig, primitive distances and record writes skipped.

Skipped groups still increment the original raw candidate count by three or five respectively. Exceeding the unchanged 96/64 limit still raises id999; a skipped group cannot hide overflow. No bound becomes a surface or a shadow caster. Retained candidates preserve their original source parameters and order. CPU checks compare 100,000 column positions and 100,000 bench positions with every constituent distance; these checks supplement containment, not replace it. The existing whole-field/backend and whole-frame checks remain required before accepting this execution optimization. IEEE builtin rounding is not formally certified by this real-arithmetic proof.

## Exact finite-center lookup (awaiting GPU acceptance)

The boarding row's original linear searches of19 post centers and6 bench centers are replaced by balanced comparisons over those same sorted centers, generated from the unchanged construction recipe. No new cell grid or geometric approximation is introduced. Midpoints are checked to be exactly representable f32 constants, and an exact tie takes the earlier/higher center, as in the original strict-less scan. The selected center is subtracted using the original expression; timber retains its original source-center value independently of relocated placement. The existing1e5 sentinel comparison is retained.

CPU tests compare400,000 f32 queries in the ray envelope, every center, every midpoint, and adjacent f32 values on both sides of each midpoint. Selected source identity and final f32 residual match the original scans exactly. Generated leaves retain all19 post and6 bench centers. This removes linear-loop work but is not a measured GPU speedup until the next exact-source run.
