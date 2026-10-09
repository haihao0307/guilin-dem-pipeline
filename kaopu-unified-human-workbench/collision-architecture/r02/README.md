# Actual surface contact R02

R01 remains an archived coarse-proxy experiment. R02 reads the same complete CSR influence records and 104 skin matrices as `AnimatedHuman` and collides against the visible skin triangles. The glove side is the actual posed `Gloves.mjs` geometry, including articulated cuff, not the old bounding sphere. No display topology or visual weight is changed.

## Why the old fit failed

An independent audit of six original body presets and nine poses (54 actor frames, 1,372,518 vertex evaluations) found head vertices up to 26.0 mm and torso vertices up to 16.5 mm outside the old primitive union. The head fitter incorrectly discarded vertices below `headBone.z - stature * .012`, including fully head-weighted lower-face samples. The three torso capsules followed one bone each while the visible skin blends all native weights. Shoulders, neck and limbs had no complete collision coverage.

Across these frames, 35.0–41.3% of skin vertices lie more than 5 mm outside the old union, substantially because limbs were absent. Negative primitive signed distance at skin samples reaches 66.9 mm for the head and 136.5 mm for the torso; this is interior clearance, **not** a measured bidirectional surface gap. Twelve old glove-sphere queries intersected actual hand skin omitted by the old targets; this does not certify twelve actual equipment contacts.

## Geometry and numerical contract

- `SurfaceNarrowPhase(human)` builds a spatial tree over all 40,120 skin triangles. The material mask excludes eye and mouth interior materials. The original display still has 25,417 vertices / 50,624 triangles.
- `snapshot(skinMatrices, group.matrixWorld.elements)` copies complete pose matrices and world transform. The native row-major metre/Z-up points map to view `(x,z,-y)`. Root motion already belongs to matrices and is not added again.
- `setStep(previous,current)` defines linear trajectories of actual rendered vertices between snapshots. This models the fixed-step surface, not an unmeasured curved skeletal trajectory between samples.
- Each tree node bounds the nonnegative CSR influence positions under every relevant bone, including actual Float32 weight sums. Endpoint bounds enclose linear vertex trajectories. Leaf vertices are skinned lazily and cached per snapshot.
- `castGloveSurface(surface, previousGlove, currentGlove)` returns `{hit,unresolved,trianglePairs}`. `snapshotGlove(glove)` copies the actual current position buffer and matrixWorld, so the deforming cuff remains represented.
- `castGloveGuard(...)` tests the same actual triangle surfaces on both gloves. The caller must compare its TOI with body results and use the earliest contact. An intervening forearm is labeled as that arm, never changed into a desired head/torso hit.
- `unresolved` is a hard failure for event generation, even when a provisional candidate exists. A budget/convergence failure is never relabeled a miss or successful hit. A future controller must halt or refine the contact-critical motion rather than silently advance through an unresolved interval. The diagnostic restores its probe to the separated start.
- Contact contains body triangle ID, barycentric coordinates, attacker triangle ID, actual contact point, inward normal, TOI and barycentric relative displacement. For linear deformation, the latter derives from both actual surfaces.
- Skin-mesh full containment at startup is not a certified volume-overlap query. Start separated; initial surface intersections are flagged. This is a surface collision reference, not a watertight human-volume SDF.

The demo uses an actual Jolt WASM sphere-envelope cast only as a conservative broad phase. That envelope never becomes the final contact. Final body and guard contact is the new local triangle CCD. It deliberately labels this division rather than claiming Jolt solved the final skinned collision or rigid-body response.

`SurfaceFingerprint.mjs` binds caches to actual positions, topology, full CSR weights/ranges and complete rest skeleton. Rebuild after shape changes. Common state alone cannot reconstruct the additional R03 adipose / R03.1 bony layer recipe. Those new recipes are supported as new actual geometry inputs, but this release has not automatically validated them.

## Acceptance checks

1. CPU surface replay against `AnimatedHuman.sampleVertex`: maximum error <1 micrometre across tested poses and body sizes. This compares the same shader inputs, not a GPU hardware transform-feedback measurement.
2. Accepted continuous contact separation ≤0.02 mm; static translation uses exact separating-axis or sphere-feature solutions. Deforming triangles use conservative advancement with an explicit iteration budget.
3. Synthetic 0.2 mm near-miss is a miss; tangent/edge grazing and fast crossing are detected. A segment through a triangle interior is treated as an intersection. Degenerate triangles must never produce NaN events.
4. Actual glove directed toward a head encounters the intervening arm first in the tested guard pose. A separately placed actual guard glove intercepts earlier. Both relative body motion and glove orientation change have a continuous actual-vertex regression.
5. Browser checks cover original rounded, short-slim and senior-sturdy presets, three motion poses and three camera angles each. Reset removes contacts. Separate browser evidence identifies SwiftShader; it is not a hardware-device FPS claim.

Run tests from a checkout with the existing pinned human assets. The local numerical tests are `tests/sweep.mjs`, `tests/triangles.mjs`, `tests/anny-surface.mjs` and `tests/glove-surface.mjs`. The browser fixture reads the real existing assets and real integrity-checked official Jolt loader. No binary is bundled here.

## Performance and next integration gate

This is an accuracy reference and single-case diagnostic. A deliberately long 0.6 m sweep through an articulated human and guard takes hundreds of milliseconds in current Node measurements. Temporal AABB pruning reduced the tested body/guard triangle pairs, but **18 arenas at 120 Hz are not passed**. The boxing controller must not adopt this reference as a production realtime solver without a measured budget and no-false-negative comparison.

A separate real-Jolt candidate partitions the authored fist into 14 convex bands. Its bidirectional finite static samples measured up to 1.792 mm at 1.75 m stature, or 1.971 mm at the tallest audited old preset. It is not the final query in this demo. Sampling is not a continuous Hausdorff certificate; the shell band crossing the cuff-deformation threshold needs dynamic treatment. A safe acceleration must retain exact surface confirmation and compare with this reference on near misses, grazing, fast motion, adjacent limbs and guard ordering.

No whole-body dynamics, automatic attacking-hand TOI clamp, muscle solver, cloth self-collision or cloth intercollision is certified here. R01 modules and the current boxing motion controller remain separate.

## Independent review

The review found and fixed a degenerate-triangle NaN path before final publication. The fixed candidate passed 500 random translating and 150 deforming triangle cases against an independent sampled oracle; 4,000 time-varying AABB cases and 3,219,354 actual CSR node/vertex inclusion checks found no false pruning. In a separate 120-case random small-mesh comparison, one deforming case returned explicit unresolved in both pruned and exhaustive paths. It remains an exposed solver-budget limitation, not a successful collision result. Finite randomized checks do not establish a proof for all inputs.
