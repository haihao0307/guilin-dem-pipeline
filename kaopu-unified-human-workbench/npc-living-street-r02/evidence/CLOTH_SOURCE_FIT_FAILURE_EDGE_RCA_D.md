# D / D01 original full-cloth fit: bounded failure RCA

## Result and scope

The fixed original fitting schedule is rejected by the original safety gate. With D's actual complete native height of **1.5038026571273804 m**, the full source WASM solver completes eight 1/60-second frames, reaches 25% of the body fit, then rejects frame 9 at 28.125%. P01's maximum paper-edge stretch is **1.4581577542485396**, above the unchanged **1.45** source ceiling. It restores all cloth state and the fitting wrapper restores body, waist targets and edge rest lengths to frame 8. No subsequent fitting or pickup frame runs.

The experiment retains every source material site, triangle, seam group, mass, distance edge, bend and waist constraint. It retains both positions and velocities between frames, uses 240 Hz substeps and the source 16 + 12 iteration schedule, and performs no per-point nearest-body rest mapping. It is not a production candidate or a visual approval.

The initial run is `APPEARANCE_CLOTH_SOURCE_FIT_D.json`. The subsequent identical-input diagnostic replay is `APPEARANCE_CLOTH_SOURCE_FIT_EDGE_D.json`. Every reported edge ratio matches the first run exactly. The replay only adds read-only observations immediately before the original audit returns; its extra time is not a solver performance benchmark.

The first run takes 9.524 s including full triangle probes. Successful 1/60-second steps average 824.67 ms. At frame 8, all 16,720 T01 and 48,272 P01 triangle-centre / edge-midpoint probes are outside the body, and seam gaps are zero. Those contact observations do not satisfy the separate strain gate.

## Exact first failing edge

The persistent maximum from frames 2 through 9 is P01 edge **14196**, between sewn particles **1718 and 1717**. It belongs to the original right upper outer hip seam **s6**, joining `pant_b_r` edge `e1` and `pant_f_r` edge `e8`. Its material-site mappings are:

| Sewn particle | Original back site | Refined front site | Waist pinned |
|---|---|---|---|
| 1718 | pant_b_r local 112, global 1744 | pant_f_r local 1561, global 6387 | No |
| 1717 | pant_b_r local 111, global 1743 | pant_f_r local 1560, global 6386 | No |

The original front sites are inserted by the original seam-refinement routine to match actual unmatched material sites; this does not create a new patch or discard an existing site. This edge is at the upper hip, not the cuff or central crotch.

| Quantity | Value |
|---|---:|
| Original spatial edge length | 4.180811 mm |
| Source rest used by original CoupledCloth | 3.943290 mm |
| Graded target rest of edge 14196 | 3.250644 mm |
| Frame 8 rest / actual length | 3.770128 / 5.384691 mm |
| Frame 8 ratio | 1.428251342 |
| Frame 9 rest / actual length | 3.748483 / 5.465880 mm |
| Frame 9 ratio | 1.458157754 |

By frame 8, this local material distance has increased 28.796% from the original 4.181 mm spatial distance, while its current material rest has decreased 4.391%. That combination explains the measured 1.428 ratio at only 25% body interpolation. The interpolation fraction is not an upper bound on local cloth strain.

Coordinates below are solver metres, Y-up, with the original native origin retained. The equivalent native coordinates are `[x, -z, y]`; no ground offset is applied to the body.

| Particle | Original position | Frame 9 position | Frame 9 displacement |
|---|---|---|---|
| 1718 | [-.154464239, .119742563, -.005601202] | [-.145617468, .109184174, -.007862562] | [+.008846771, -.010558389, -.002261360] |
| 1717 | [-.155806839, .115791538, -.005858121] | [-.148045086, .104313303, -.008369637] | [+.007761753, -.011478235, -.002511516] |

The original nearest body triangle for both is face 14655, vertex IDs `[3037, 2805, 2806]`. At the original barycentric correspondences, the body moves inward by 11.994 / 11.732 mm and downward by 1.558 / 1.194 mm by frame 9. The cloth sites move downward by 10.558 / 11.478 mm. The exact coordinates, barycentrics, current nearest triangles, masses, inverse masses and frame-start states are retained in the JSON.

The source foot minimum rises from -.985865355 to -.777949572 m over the complete morph, but **all twenty waist anchors move downward by 6.166–8.165 mm at frame 9**. Therefore a proposed explanation in which an upward-moving waistband pulls against a stationary old floor is not supported for this first failing edge. The observed local relative slide and shortening rest are real; the individual contribution of gravity, contact carry, seam metric handling and sequential contact projection is not isolated by this replay.

## Integration contracts checked

The following checks found no demonstrated new adapter error:

- Every current edge rest equals the source formula `sourceRest + (targetRest - sourceRest) * fitFraction`. Every corresponding packed WASM Float64 edge-row rest equals that JS edge rest. Both maximum differences are exactly zero.
- `actorPrevious` is the previous fitting body's coordinates; `actorTarget` is the current fitting body's coordinates. Across all 9,253 native body sites, their differences from the intended interpolation are exactly zero. The Y-up / Z-up axis conversion also has zero discrepancy.
- Original canonical `rig.weights` and reconstructed full-CSR binding select exactly the same material-measurement vertex IDs for all seven source bone regions: 549 / 262 / 112 / 112 top-region vertices, and 344 / 164 / 164 bottom-region vertices. No raw-driver index substitution is used.
- The source grade is width 1.02 and length .8181842769282975 for both garments. The width floor and height ratio are the original formulas, including their limitations for a smaller wearer. D's full native height comes from the real runtime; an incomplete headless fixture height is not substituted.
- Original waist attachment is retained: twenty particles selected by the source upper 3.5 mm rule, each attached to its original body triangle with barycentric coordinates and a local offset. The failure endpoints are free, with masses .00001039210555 / .00001038900990 kg. The maximum stretch among 18 doubly pinned edges is .991244; among 44 singly pinned edges it is 1.155690. There is no evidence of a wrong pinned endpoint causing the first failure.
- All original retained garment vertices and UV sites survive source seam/rise refinement without a coordinate change; paper area is conserved by refinement. After grading, the original rise threshold adds 28 sites instead of the ungraded control's 44. The actual resulting P01 is 6,607 vertices / 12,068 triangles / 531 seam pairs.

`SOURCE_FIT_GRADE_WAIST_CONTRACT_D.json` records the independent measurement-mask and waist-motion checks. It runs no dynamics and changes no solver input in the rejected experiment.

This is formula and participant equivalence, not bitwise GPU execution equivalence. The source GPU worker stores interpolation targets in Float32 arrays, while the isolated WASM bridge uses Float64 state. The original GPU also uses Float32 constraint buffers. The important solver differences below remain explicit.

## Source seam ease and source-rest aliasing

The same sewn particle pair has two original panel constraints:

| Panel constraint | Original paper length | Graded target length | SourceRest actually assigned |
|---|---:|---:|---:|
| Back, edge 5026 | 4.337645 mm | 3.575730 mm | 3.943290 mm |
| Front, edge 14196 | 3.943290 mm | 3.250644 mm | 3.943290 mm |

The different original lengths are intentional source material data. Seam s6 explicitly preserves a 1.1 back gathering coefficient and about 20.112 mm total ease. They must not be silently homogenized.

The unchanged original `CoupledCloth` initializes `sourceRest` through a Map keyed only by the sewn particle pair. Its later front-panel entry overwrites the back-panel original paper metric for this pair. It then assigns that last source value to both constraints, while `targetRest` retains each separate graded panel metric. P01 contains 102 duplicate-pair constraints whose target rest differs, and T01 contains 50. This is a concrete behavior of the fixed donor module, shared by its GPU and WASM paths; it is not caused by the new WASM upload code.

This behavior is a source metric provenance issue to keep visible. It does not prove that this seam alone makes the system infeasible: the two allowed .90–1.12 rest intervals still overlap at frame 9. No source ease, seam length or metric formula is changed by this RCA.

## Confirmed GPU / WASM branch differences

The source GPU first interpolates body and original waist pins, predicts cloth positions, resets constraint multipliers, then applies **bodyCarry** on each moving-body substep before the usual distance / bend / strain / contact iterations. The full original WASM branch interpolates body and waist, predicts cloth and runs constraints but has no bodyCarry call or equivalent kernel.

The exact fixed shader is `gpu-cloth.wgsl`, Git blob `709d0e3b5d29c6a12ce1ad9d2debd63bf7378933`, SHA256 `bce15ca66c757abc1900e06eb63d3e33f0f7fa03b7e0185dc2fe9c0bc2b3c2f0`. It is stored byte-for-byte in the research source directory and included in its verification ledger. The `meshpoint(..., 2)` helper reconstructs the immediately preceding substep's actual body triangle, not a rest-shape substitute.

Original bodyCarry behavior:

1. Only an unpinned particle with an existing cached actual body triangle can participate.
2. Its signed distance from the preceding-substep triangle must be in [-6 mm, clearance + 1.5 mm]. With the original clearance this upper limit is 5.5 mm.
3. The old closest-point barycentrics sample the actual triangle's change to the current substep. Only outward normal motion is carried.
4. Tangential transport is limited by the exact original friction budget `.4 * (normalMove + max(0, clearance-distance) + max(0, normal.y) * 9.81 * h*h)`.
5. Total carry is capped at 10 mm per substep. A cached -1 means no carry; it does not trigger new full-cloth skinning or attraction.

Other original differences are significant: GPU constraints are processed in conflict-free color groups, WASM in source edge order; GPU interior contacts gather/average corrections, while WASM applies them sequentially; GPU pair contacts also use gather paths. Their precision and accumulation order differ. Both use the same nominal material constants, 16 + 12 iteration schedule and 1.45 rejection threshold.

The missing carry is thus a real source-branch difference, but this measurement does not establish that adding it would resolve edge 14196. No transplant, new fitting candidate, reduced solver, extra pass, smaller time step or relaxed threshold is implemented or tested.

## Next controlled comparison

Run the unchanged original `GPUCloth` and its unchanged shader against the exported fixed D input and original 48-frame schedule. This directly tests the donor's actual primary fitting path, rather than attributing the rejection to an unproved single backend difference. It is an isolated diagnostic, not a production promotion. Stop at the first original safety rejection and preserve pre-rollback evidence.

`APPEARANCE_CLOTH_SOURCE_FIT_D_INPUTS.json` and its gzip/manifest contain the exact full refined source packets, initial garment coordinates, source and target body coordinates, original materials/settings, actual full-native height evidence, and fixed schedule. `SourceFitActorBridge.mjs` exposes the same neutral actor API used in the controlled WASM experiment; the body morph is applied externally by the original worker's fitting formula. That bridge performs no cloth or body deformation of its own.

The evidence supports **no demonstrated new adapter pin, coordinate, participant-mask or rest-upload error**, **confirmed original backend non-equivalence**, and **an unapproved full-WASM fit for D**. It does not establish that the original source fitting pipeline succeeds for all six body shapes.
