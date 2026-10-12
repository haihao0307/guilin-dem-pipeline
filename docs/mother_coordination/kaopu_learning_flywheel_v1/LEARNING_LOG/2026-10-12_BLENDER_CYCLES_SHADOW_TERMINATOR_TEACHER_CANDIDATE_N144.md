# KAOPU Learning Flywheel N144 — Blender/Cycles geometry-aware shadow terminator Teacher Candidate

Date: 2026-10-12  
Bounded owner: Learning Flywheel → Human / ET20 only  
Teacher state: `TEACHER_CANDIDATE`  
Production import: not performed  
Lifecycle at publication: `POSTED=false / ACKNOWLEDGED=false / IMPLEMENTED=false / CLASSIFICATION-GATE-RUN=true / HUMAN-PRODUCTION-GATE-RUN=false / ADOPTED=false / USER-ACCEPTED=false`

## Bounded question

Can Blender/Cycles' local-geometry-aware shadow-ray origin method teach ET20 a falsifiable alternative to repeated fixed-millimetre normal-bias tuning, while preserving real small contact shadows?

## Existing real failure

The exact current subject remains PR #227:

- source `cdb27baae71bb51af1f176ac67ef9c2ecf0c44eb`;
- fixed build `ccf5a1ed9ddde8803e292f1e62d777b141ff52d8`;
- final evidence `80e8ace61c36efefb0ded90f1873eed339aa30b9`.

ET20 R01.1 moves only the shadow lookup point:

`receiverWorld = worldPosition + smoothNormal * (1.5mm * (1 - abs(dot(smoothNormal, lightDirection))))`.

It also retains a 0.6mm light-direction comparison tolerance and 36-read PCF. The fixed-public regression proves that the shader ran, the result changed, the whole-frame black fraction stayed between zero and 20%, and the production mesh did not move. It does **not** prove that:

1. the remaining eye/low-key stripes are specifically a shadow-terminator error rather than shadow-map resolution, PCF/depth precision, insufficient tessellation or true geometry;
2. the 1.5mm world-space offset scales with local triangle size/curvature;
3. small true contact/self shadows are preserved;
4. the correction works across relevant light directions and animated facial poses.

The PR's own final review says nose/cheek striping improved, but eye and low-key artifacts remain and small contact shadows may be weakened. Therefore the lawful current state is not failure of the whole ET20 candidate; it is:

`HOLD_SHADOW_TERMINATOR_CAUSE_AND_CONTACT_RETENTION_UNBOUND`.

## External teacher evidence

### Source and activity

Candidate source: Blender official GitHub mirror, fixed commit `05b4ed5d395292b1da0acf431515d3f0ca3e45f1` (2026-10-12), file `intern/cycles/kernel/light/sample.h`.

The repository is active and production-grade, but fame is not the selection reason. The useful bounded implementation is `shadow_ray_smooth_surface_offset` plus the terminator activation logic in `shadow_ray_offset`.

### What it knows beyond current ET20

Cycles does not choose one global millimetre displacement from only the interpolated normal and light direction. It:

1. reads the current triangle vertices and vertex normals;
2. reconstructs the point and interpolated normal from barycentric coordinates;
3. estimates a local parabolic smooth surface and a linear envelope from those actual triangle quantities;
4. blends the displacement only near the terminator using both shading-normal/light and geometric-normal/light relationships;
5. skips the current primitive as a self-hit only when geometric normal and light are on the compatible side; otherwise the surface is still allowed to occlude.

The transferable knowledge is therefore **local geometry identity + terminator-limited activation + a contact-preservation control**, not Blender UI, renderer architecture, thresholds or source code.

Disney Animation's “Taming the Shadow Terminator” independently supports the underlying failure mechanism: interpolated shading normals can stay lit where the geometric surface already reaches its terminator, producing a discontinuity. It is supporting theory, not a second independent implementation claim.

### Reproducibility and license

- Runnable upstream code exists in Cycles and the file header is `Apache-2.0`.
- Blender as a whole is GPL and its root `COPYING` says Blender is not offered under another project-wide license. Any code reuse must therefore bind the exact source file and its SPDX header; this N144 Candidate copies no Blender code into production.
- No dedicated upstream unit/regression fixture for this exact function was found by repository search. That is an evidence limitation, so KAOPU must create its own positive controls before probation.
- Direct integration would also require exposing triangle vertices, vertex normals, geometric normals and barycentric coordinates at the shadow lookup. ET20's current shader receipt does not bind these objects.

## Comparison with KAOPU Current Best View

| Concern | ET20 R01.1 | Cycles bounded method | N144 delta |
|---|---|---|---|
| Offset scale | fixed world max 1.5mm | derived from local triangle geometry, then blended | bind offset to local geometry identity |
| Activation | `1-abs(Ns·L)` only | shading and geometric normals near terminator | prevent whole-surface bias |
| Contact retention | coarse black-fraction check | self-hit skip conditional on geometric side | add known-contact positive control |
| Causal evidence | fixed screenshots/hash delta | algorithm exposes local cause variables | per-ROI terminator + contact metrics |
| License | KAOPU source | exact Cycles file Apache-2.0; Blender tree mixed boundary | learn method; no unscoped copy |

Institutional result: `NO_NOVELTY`. R2 already requires bounded Candidate trials, independent verification, provenance and no Producer self-approval. The novelty is technical and Human-local.

## Falsifiable hypothesis

On the exact ET20 R01.1 subject, an independently implemented local-geometry-aware lookup offset will reduce a frozen eye/low-key terminator-band score more than both zero bias and the current 1.5mm fixed bias **without reducing contact-occluder recall** on a known small-occluder control.

Reject this Candidate if either:

- the band score does not improve under fixed camera/light/mesh/shadow-map conditions; or
- any real/fixture contact shadow disappears, weakens beyond an independently frozen tolerance, or the method needs broad whole-surface displacement.

On rejection, investigate shadow-map resolution, PCF/depth precision, tessellation, true eye-socket geometry or area-light visibility instead of increasing the bias again.

## Minimal audition

1. Keep PR #227 exact source/build as A; do not change skin, lights, camera, facial pose, shadow-map size, PCF or tone mapping.
2. Add an isolated test-only B that exposes triangle position/index digests, vertex-normal digest, geometric-normal digest and barycentric convention to an independently implemented geometry-aware lookup.
3. Freeze at least the current window and low-key eye/cheek ROIs plus several light azimuth/elevation samples.
4. Inject two controls:
   - a known low-tessellation smooth-normal terminator patch that B must detect;
   - a small real or test-only contact occluder that B must not erase.
5. Record `affectedSampleFraction`, `maximumOffsetLocalEdgeRatio`, ROI band score and contact-occluder recall for zero bias, fixed 1.5mm A and geometry-aware B.
6. Independent Verifier decides only the scoped shadow result. It cannot approve skin quality, film quality or user acceptance.

Fixture numbers in the regression file are classification-only; production thresholds remain `UNKNOWN`.

## Applicable boundary

- Applies only to smooth-normal triangle receivers and their shadow lookup.
- Does not solve shadow-map aliasing, area-light integration, skin scattering, eyelid anatomy, missing lashes/brows, pore design or film look.
- Does not authorize retessellation or production mesh movement.
- Does not allow Blender code to be copied without exact per-file license and attribution review.
- Does not convert the teacher to `ACTIVE_TEACHER`; Mother ACK and an exact-subject audition are still required.

## Decision and routing

`TEACHER_CANDIDATE` for Human/ET20 only.

Not `PROBATION`: no exact-subject geometry-aware ET20 trial exists yet.  
Not `ACTIVE_TEACHER`: no Human Mother ACK exists.  
Not a global OS change.

Route only to PR #227 with four questions:

1. Is the unresolved eye/low-key stripe still the next true Human defect?
2. Does current runtime already expose/bind triangle vertices, vertex normals, geometric normals and barycentrics for the shadow lookup?
3. Is the worth-learning subset limited to geometry identity, terminator activation and contact preservation, with no Blender code import?
4. What exact A/B positive-control trial would falsify the hypothesis?

## Metrics

- first-candidate pass rate: `UNKNOWN`;
- user correction count delta: `UNKNOWN`;
- same-error recurrence: `UNKNOWN`;
- rejected-lineage inheritance: `UNKNOWN`;
- stale delivery count: `UNKNOWN`;
- internal iterations per accepted delta: `UNKNOWN`;
- time from instruction to legal candidate: `UNKNOWN`.

No KPI is inferred from the 7/7 classification replay.
