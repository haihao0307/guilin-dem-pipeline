# KAOPU Learning Flywheel — shared function class vs per-instance visibility (N199)

- Date: 2026-10-27
- Baseline: `main@3ccae4bde0c91973adbb81f99ec4d54bc9357ce0`
- Trigger: user proposed an engine for analytic/function-defined surfaces and asked whether 100 identical cubes could share one sun/function calculation so total compute approaches 1%.
- Bounded question: **which work can identical function-defined instances safely share, and which work must remain spatially instance-specific?**
- Decision: `PARTIAL_FEASIBLE_REJECT_UNCONDITIONAL_ONE_PERCENT_CLAIM`
- Candidate regression: `FUNCTION-SHAPE-REUSE-NOT-VISIBILITY-REUSE-001`
- Production/R2 change: none
- Affected route: Rendering / Procedural Geometry Mother through coordination issue #91; no ACK claimed

## Existing evidence and novelty check

The required R2 OS, reference-replication gate, freshness gate, root `AGENTS.md`, #91/#63 and applicable regression cases were reread first. Repository search on current `main` found no implemented function-surface engine or existing regression that distinguishes shared function evaluation from per-instance camera/light visibility. This is therefore a new bounded engine-contract question rather than a rename of an existing gate.

The user idea contains a strong architectural kernel: identical analytic objects should not duplicate their function code, canonical data, derivative logic, immutable parameters or canonical-space precompute. The overreach is treating the **final visibility or shadowed lighting result** as equally reusable.

## Current Best View

Separate three layers:

1. **Function class — share once per class/revision**
   - function AST/bytecode/GPU program;
   - canonical domain and bounds;
   - derivative/normal method;
   - immutable parameters and material program;
   - proven canonical-space lookup tables or interval data.
2. **Instance — retain per spatial copy**
   - transform and inverse transform;
   - parameter overrides, world bounds and visibility mask;
   - camera/light directions expressed in the instance frame;
   - dynamic state and deformation revision.
3. **Visible sample/query — evaluate where required**
   - depth ordering, occlusion and camera visibility;
   - shadow visibility and receiving/occluding relationships;
   - orientation-dependent shading and final material response.

This architecture does **not** require triangles or a production ray tracer. A function engine may use analytic projected bounds, screen tiles, hierarchical depth, spatial grids/BVHs, interval arithmetic, SDF stepping, occupancy masks or another declared route. Whatever route is chosen, two identical functions at different transforms still occupy different world regions; visibility is a relation among camera/light, instance and other occluders, not a property of the function class alone.

## Minimal correctness replay

The probe uses rays only as a small independent oracle; it does not prescribe the production algorithm.

| Negative control | Shared quantity | Instance-specific truth | Result |
|---|---|---|---|
| two unit cubes stacked along the sun direction | same local top point, normal and unoccluded `n·l = 1` | lower top is shadowed; upper top is visible | shared final lighting rejected |
| two unit cubes on the same camera pixel at depths 7 and 11 | same cube function and projected center | only the nearer instance is visible | shared camera visibility rejected |
| unit cubes rotated 0° and 60° | same function class | top-face `n·l` is 1 vs 0.5 | per-instance direction transform required |

All four correctness assertions passed. This proves the boundary, not production speed, visual quality or user acceptance.

## Cost boundary

Use an auditable cost partition rather than “100 objects means 1% compute”:

```text
naive  = N * (F + T + R)
shared = K * F + N * T + M * R
```

- `N`: instance count;
- `K`: function-class count;
- `M`: visible/evaluated instances after culling;
- `F`: shareable function compile/setup/data cost;
- `T`: per-instance transform/bounds cost;
- `R`: per-visible-instance/sample visibility and shading cost.

Synthetic units for `N=100, K=1`:

| Case | Remaining cost | Speedup | Interpretation |
|---|---:|---:|---|
| all visible; `F=100, T=1, R=100` | 50.7463% | 1.970588x | sharing setup alone cannot remove visibility/shading |
| all visible; setup-dominated `F=100000` | 1.0999% | 90.918256x | even an extreme setup-heavy case does not quite reach 1% |
| only 10 visible after culling | 5.9701% | 16.75x | the large gain comes from culling as well as class reuse |

Amdahl replay: if 99% of the old work were perfectly shareable across 100 copies, the maximum speedup is `50.251256x`, not `100x`. Reaching `99x` needs about `99.9898%` of all original work to be shareable. Exactly `100x` requires no residual per-instance work. Therefore “about 1%” is a benchmark hypothesis for a declared scene/hardware, not a safe engine promise.

## External teacher audition — PBRT v4

- Screening status: `TEACHER_CANDIDATE`
- Lifecycle: `RADAR_FOUND -> TEACHER_CANDIDATE`
- Registry/referenceSet: not entered

**What it knows beyond KAOPU Current Best View:** PBRT makes the reusable shape/primitive distinct from a transformed instance. The shared geometry is stored once, while each instance injects its own transform; the per-query intersection is transformed into that instance's coordinate system and the result is transformed back. This is the exact representation boundary needed here: reuse shape data and code, but do not reuse the final spatial answer.

Primary sources:

- PBRT v4 object instancing: https://pbr-book.org/4ed/Primitives_and_Intersection_Acceleration/Primitive_Interface_and_Geometric_Primitives
- PBRT v4 source: https://github.com/mmp/pbrt-v4
- latest observed commit on 2026-09-08: https://github.com/mmp/pbrt-v4/commit/b4ce9687e6c695f5582997c61b0c66cf064bdb4a
- license: https://github.com/mmp/pbrt-v4/blob/master/LICENSE.txt
- official scenes: https://github.com/mmp/pbrt-v4-scenes

Teacher screening:

1. **Source/provenance:** official book and authors' repository (`mmp/pbrt-v4`).
2. **Maintenance:** latest observed commit is 2026-09-08; active fixes and pull requests are present.
3. **Runnable evidence:** complete C++ source, build instructions and official scene repository; the landscape scene exercises heavy instancing.
4. **License/assets:** renderer is Apache-2.0; scene assets have their own licenses and must not be treated as uniformly Apache-2.0.
5. **Direct relevance:** directly specifies shared primitive plus per-instance transform and query semantics.
6. **Novelty:** current KAOPU main has no equivalent function-class/instance/query contract or regression boundary.
7. **Dependencies/cost:** full PBRT is a C++ renderer; its GPU path requires CUDA/OptiX. That is too heavy for a first KAOPU audition.
8. **Risks/boundary:** PBRT is ray based, while the user wants a function-native route. Learn only the decomposition and test discipline; do not adopt its runtime, API or rendering route by default.

Khronos Vulkan independently exposes the same decomposition—multiple top-level instances may reference one bottom-level structure, while each instance still has its own transform, mask and custom index—but it is only corroborating evidence here, not a second active teacher: https://docs.vulkan.org/refpages/latest/refpages/source/VkAccelerationStructureInstanceKHR.html

## Candidate translation

Task Anchor additions:

```text
functionClassId
functionRevision
canonicalDomain
canonicalBounds
sharedParameters
sharedPrecompute
instanceId
instanceTransform
parameterOverrides
worldBounds
visibilityMask
cameraVisibilityMethod
lightVisibilityMethod
shadowMethod
cullingMethod
benchmarkScenes
correctnessOracle
```

Delivery Receipt additions:

```text
sharedSetupTime
perInstanceTransformTime
visibilityAndShadowTime
visibleInstanceCount
evaluatedSampleCount
cacheHitCount
referenceImageOrOracleDiff
hardwareAndRuntime
verifierIdentity
```

Verifier gate:

- permit reuse only when function class revision and shared parameters match;
- require explicit instance transform and world bounds;
- transform camera/light directions per instance when orientation differs;
- reject shared final visibility across the stacked-shadow, depth-occlusion and rotated-instance controls;
- reject a “1% / 100x” claim without end-to-end measured remaining cost `<= 0.01` on declared hardware and correctness controls passing;
- producer cannot self-approve.

## One-Mother audition boundary

Run one Rendering / Procedural Geometry prototype with one cube function and 100 instances in four fixtures: isolated aligned, rotated, depth-overlapped and light-stacked. Compare:

1. naïve repeated function setup;
2. function-class cache only;
3. cache plus instance culling/compaction;
4. deliberately incorrect shared-visibility negative control.

Report the cost partition and oracle diff. Do not modify R2, a production Mother or a public renderer; do not claim GPU/browser/device performance until the corresponding real run exists. Current state after this synthetic replay is only `POSTED / synthetic GATE-RUN` once routed; `ACKNOWLEDGED / IMPLEMENTED / ADOPTED / USER-ACCEPTED` remain false.
