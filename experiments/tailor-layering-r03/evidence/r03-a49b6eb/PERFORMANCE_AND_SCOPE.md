# R03 measured performance and scope

Frozen production source: `a49b6eb9bdf9f3bb097a4470465bc463d97dfb7b`.
Fresh full CI run: `39539509515`. These are numerical and implementation findings;
the final release decision additionally requires the complete browser matrix,
fixed public deployment, public desktop/mobile evidence and independent approval.

## Production changes

R03 conservatively rejects impossible local cloth features before the existing
closest-feature calculations. It updates affected feature bounds after constraint
corrections and retains the original candidate order, constraints and contact
history. The static body query path reuses a result only when the complete input
coordinates, indices and radius are exactly unchanged. This is not a semantic
active-region system, dynamic-body implementation or physical sleep mechanism.

The page provides a contact-computation toggle. In the fresh eight-step test,
frozen R02, R03 OFF and R03 ON had strictly equal physics, contact history and
render geometry. The redress transaction repair is shared by both R03 paths.

Explicit garment addition uses `GLOBAL_REDRESS_RESTART`: all garments restart
from independent prepared seed positions, with velocities and physical clocks
reset. Normal steps never restore these seeds. A failed addition restores the
existing physical arrays, lambda values, history, reports and clocks; the UI's
subsequent cleanup of the absent garment is a no-op. This is not state-preserving
redressing. Allocator counters may change during a rejected provisional addition.

The native person, T08 inner knit, T03 outer knit and P02 denim pants remain the
original independent assets, with their original patterns, masses, materials,
thicknesses, seams and complete continuous yarn representation.

## Fresh same-input comparison

The exact input was captured from the current native browser page. All three
paths ran the initial state and eight real steps, including a push at step 3 and
a tug at step 6. The test performs strict comparisons; independent review also
checks every retained state digest, source binding, log and hard gate.

| Path | Eight-step solver wall total | Step wall median | Process CPU total |
|---|---:|---:|---:|
| Frozen R02 | 47,582.752 ms | 5,841.344 ms | 51,467.380 ms |
| R03 OFF | 47,300.220 ms | 5,857.113 ms | 51,195.444 ms |
| R03 ON | 38,128.689 ms | 4,656.064 ms | 45,716.925 ms |

OFF to ON reduces the recorded wall total by **19.3900%** and process CPU by
**10.7012%**. This is one short CI observation covering about 0.0667 physical
seconds, not a statistical or user-hardware performance guarantee. The system
remains far from real-time operation. External independent geometry-audit wall
time is outside these solver timing totals.

| Recorded work | OFF | ON |
|---|---:|---:|
| Solve invocations | 276 | 276 |
| Measurement invocations | 116 | 116 |
| Candidate visits | 221,647,151 | 221,647,151 |
| Cloth vertex/face exact tests | 15,172,691 | 10,744,820 |
| Cloth edge/edge exact tests | 44,731,153 | 33,117,645 |
| Adjacent-face tests | 7,567,663 | 78,520 |
| Body triangle queries | 2,175,320 | 2,175,320 |
| Body BVH node visits | 34,605,399 | 10,171,287 |
| Body triangle tests | 5,153,476 | 2,059,652 |
| Body vertex/face exact tests | 30,920,856 | 2,718,741 |
| Body edge/edge exact tests | 46,381,284 | 6,945,604 |

ON has 1,639,225 exact body query cache hits (75.356%). Cloth VF/EE counters cover
candidate-entry exact tests, not all sweep, retarget or diagnostic arithmetic.
Large count reductions therefore do not imply the same reduction in total time.

ON stage totals are cloth contact 19.470 s (51.065%), body projection 6.756 s
(17.720%), layer audit 5.091 s (13.353%) and body envelope 3.150 s (8.263%).
The 4.588 s broadphase total is **already inside cloth contact** and must not be
added again. Candidate enumeration remains a major next measurement target.
There is no memory-saving claim: caches, local bounds and prepared seeds require
additional storage, and complete dynamic JavaScript memory was not measured.

## Unchanged numerical gates and long replay

| Quantity | Unchanged maximum |
|---|---:|
| Edge stretch ratio | 1.45 |
| Cloth thickness residual | 0.5 mm |
| Body half-thickness overlap | 0.001 mm |
| Seam gap | 0.01 mm |

The fresh baseline and perturb replays each completed 240 steps, approximately
2.0 physical seconds, with 241 independently audited discrete states per replay.
Each state covers all input cloth triangles and 9,402 body-distance vertices.
Perturb retains push/tug/push before steps 61, 121 and 181. Both numerical suites
passed 93 of 93 tests.

Both replays have maximum dynamic stretch 1.4498629135478847 and cloth residual
0.46967070395377736 mm. Seam gaps, fixed-point drift and particle half-thickness
overlap are zero. Independent full-triangle body envelope overlap is **nonzero**:
baseline peaks at 0.0004752060016864103 mm, perturb at 0.0008538310809352856 mm.
Both remain below the unchanged 0.001 mm gate. Do not replace these values with
an assertion of mathematically zero overlap.

The fresh redress regression completes three cycles, 14 real steps and 19 full
audits. Each redress matches a fresh same-settings world; a test-only failure
injected after actual settling converges validates rollback and absent-ID cleanup.
The nonempty history coverage is the actual `history=2` and `frameSides=1` case,
not all possible history combinations.

The earlier candidate `74c20ec28e07cbd9e0082e03216d0231556efa0f` failed a real
browser reentry step. Its original failure evidence is retained. A separate local
three-path reconstruction did not reproduce that Chrome failure; that diagnostic
does not establish that optimization could not have contributed. Acceptance of
the new source depends on its own unchanged complete browser reentry test.

## Limits and next bounded work

The body is static. Complete continuous collision, self-collision, per-yarn
collision certification, calibrated material parameters, automatic occlusion
culling and sleep/wake are not implemented by this change. Discrete surface
audits cannot certify times between snapshots. Browser CI uses Chromium with
SwiftShader, whose timing cannot represent a user's GPU or physical phone.

The next performance increment should measure and reduce conservative candidate
enumeration while preserving original order, history and same-input equality.
Visibility-aware yarn scheduling requires separate evidence that the affected
geometry and shading inputs are unchanged. In the retained historical R02 public
first-step panel probe, all 22 panels changed position and normal inputs, so an
exact unchanged-whole-panel cache would have no hits in that baseline case. This
is not a new R03 GPU measurement. Hidden support layers must
continue physical simulation, and knit holes and shadows remain relevant.

Sources for these findings are the original files in the retained native
baseline/perturb archives, their completed job logs, and the 9,986-check combined
review and compact summary. Original evidence bytes are preserved separately
from these interpretations.
