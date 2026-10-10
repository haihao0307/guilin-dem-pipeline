# R18 runtime CPU profile and R19 optimization evidence

Date: 2026-10-10. Read-only source analysis. All experiment files are outside the application repository. No runtime files or remote state were modified.

## Bottom line

1. The actual CI long stalls are inside `renderer.render`: 92.3% of the total observed whole-draw wall time, with a 3,402.7 ms p95. These are SwiftShader/software-renderer measurements, not hardware GPU FPS. Removing old files or historical imports cannot by itself fix these observed rendering stalls.
2. On CPU, animated cloth normal recalculation is the largest recurring street-update cost. It accounts for 57% of steady update wall time here; cloth displacement itself accounts for another 26%. Material-uniform updates are only about 1%.
3. A tested fallback using typed-array indexed normals, precomputed cloth weights, and conservative static cloth bounds reduces median steady update from 3.880 ms to 1.257 ms on this executor, while preserving vertex positions and normal buffers exactly in the bounded equivalence test.
4. Cross-parcel draw batching is well motivated: a settled 350 m sample contains 843 street meshes, 348 instanced meshes, and 364 distinct rendered materials. Material variation must remain encoded in per-instance/per-vertex attributes or equivalent data; blindly sharing only a palette would erase age, repair, seed, origin and facade-grid variation.

## Source and evidence

- Source checkout: `/workspace/scratch/2f609cc83d31/train-city-integration-r15-20261010`
- Street source: `kaopu-minigame-workbench/voxel-train-study/game/r18`
- Browser evidence: `/workspace/scratch/2f609cc83d31/r18-ci-38044059839/browser/result.json`
- Engine: original vendored Three.js r170, with Node v24.19.0. No mocked geometry classes.
- The Node runs exercise 37 parcels × two buildings × three LODs; no reduction to building count, first-leg distance, or architectural features.

## Actual browser measurements

| Observed boundary | Median | P95 | Maximum |
|---|---:|---:|---:|
| Whole draw | 48.3 ms | 3,464.7 ms | 7,159.7 ms |
| World update | 23.5 ms | 104.5 ms | 282.4 ms |
| Renderer.render | 21.1 ms | 3,402.7 ms | 7,054.3 ms |
| Active frame interval | 2,699.1 ms | 6,626.2 ms | 8,726.3 ms |

There are 150 timing samples. Renderer calls above 100 ms occur in 20 of them. Total renderer time is 71,802.0 ms versus 77,813.0 ms whole-draw time. This locates the dominant measured tail in the renderer boundary; it does not distinguish shader compilation, synchronization, buffer upload, draw submission, or software rasterization within that boundary.

Other browser observations:

- 1280 × 720 rendering; quality mode `clear`; SwiftShader via ANGLE Vulkan
- Final scene draw calls: 615; final scene triangles: 508,633
- Peak sampled street meshes: 914; peak sampled rendered street materials: 395
- Final street: 678 meshes, 283 rendered materials, 371,586 expanded triangles
- GL buffers created: 10,571; deleted: 9,192; peak live: 1,529
- Shader programs at final observation: 41, not one unique compiled program per material
- 123 parcel loads including 86 LOD replacements during the first leg
- Browser readiness: 18,842 ms

## Uninstrumented CPU timing

These are CPU costs on this executor, not predicted browser or hardware frame times. Separate instrumented and sampling-profiler runs provide attribution. Wall-time distributions can include GC and scheduling.

| Work | Median | P95 | Maximum |
|---|---:|---:|---:|
| Far build, 37 parcels | 3.46 ms | 5.64 ms | 8.23 ms |
| Mid build, 37 parcels | 5.08 ms | 9.51 ms | 11.67 ms |
| Near build, 37 parcels | 8.74 ms | 25.32 ms | 26.08 ms |
| Recorded 141 observations, one district update each | 4.08 ms | 18.05 ms | 56.85 ms |
| Build-containing recorded updates, 57 observations | 11.33 ms | 26.64 ms | 56.85 ms |
| No-build recorded updates, 84 observations | 3.08 ms | 4.99 ms | 6.74 ms |
| Settled 350 m, 500 changing-time updates | 3.85 ms | 5.32 ms | 40.31 ms |
| Settled 350 m, 500 equal-time updates | 0.258 ms | 0.519 ms | 2.404 ms |

The replay exactly reproduces the final 123 loads, 86 replacements, and final resource metrics from the browser proof, including 371,586 triangles. This is a meaningful CPU replay, although it excludes the other world systems and renderer.

## Attribution

At 350 m, 13 active parcels contain 116 animated cloth meshes and 23,592 cloth vertices:

- Far: 48 cloth meshes, 10,288 vertices
- Mid: 48 cloth meshes, 10,496 vertices
- Near: 20 cloth meshes, 2,808 vertices

The canopy generator does not reduce tessellation for far/mid LOD. Only targeting near laundry therefore misses most animated cloth vertices.

For 500 steady changing-time updates, instrumented wall time is 2,035.8 ms:

| Exclusive cost | Total | Per update | Approx. share |
|---|---:|---:|---:|
| Cloth normal recomputation | 1,156.2 ms | 2.312 ms | 56.8% |
| Instrument update self, chiefly cloth displacement | 519.9 ms | 1.040 ms | 25.5% |
| Cloth bounding spheres | 157.6 ms | 0.315 ms | 7.7% |
| Full district accounting | 157.0 ms | 0.314 ms | 7.7% |
| Material updates | 25.3 ms | 0.051 ms | 1.2% |

Accounting runs twice every update and additionally after each successful build. It is a secondary cost during motion, but dominates equal-time/paused updates. Cache immutable geometry/resource membership; update aggregates on load, replacement and release, retaining exact budgets and proof fields. Material libraries contain 462 allocated materials at this location, of which 364 are rendered; allocation reduction is useful but their per-frame update loop is not the principal CPU bottleneck.

Across 111 standalone builds, instrumentation attributes 679 ms of 757 ms instrument-build time to architecture construction. Of the architecture time, 114 ms is batch finalization and 57 ms is clearance/stat traversal. A bounded V8 sampling run identifies matrix-instance generation, object allocation, geometry/bounds work, material construction, canopy generation and glyph tessellation as distributed construction costs. There is no single expensive JSON parsing step: validated-score parsing is only 11 ms across all 111 builds.

## Geometry-preserving cloth fallback

The prototype is `cloth-kernels.mjs`. It is analysis code, not an application patch.

- `fastNormals`: raw indexed Float32Array cross-product accumulation and normalization; same accumulation order as Three.
- `prepareCloth`: precomputes static vertex free weights and X phase factors, and one conservative bounding sphere from the rest-position box expanded by the maximum allowed displacement.
- `fastUpdate`: uses the same elapsed-time formula and wind amplitude/frequency, writes the same positions, and invokes the raw normal path.

Fresh-district tests, 500 updates each at 350 m:

| Variant | Median | P95 |
|---|---:|---:|
| Baseline | 3.880 ms | 4.703 ms |
| Typed-array normals only | 1.712 ms | 2.234 ms |
| Conservative fixed bounds only | 3.123 ms | 3.782 ms |
| Typed normals + fixed bounds | 1.405 ms | 1.751 ms |
| Above + cached vertex weights/phases | 1.257 ms | 1.722 ms |

The combined prototype reduces measured median by 67.6% and p95 by 63.4%, without dropping animations or geometry. These separate runs are not a controlled hardware benchmark; the large improvement is supported by the component timings and equality result.

Equivalence verification covers all 37 parcels × 3 LODs × 6 times (`0`, `0.123`, `7.125`, `53.29999999`, `140`, `999.125`). Across 1,287 cloth meshes and 4,048,812 compared position components plus 4,048,812 compared normal components:

- Position differences: 0; max absolute difference: 0
- Normal differences: 0; max absolute difference: 0
- Deformed vertices outside conservative bounds: 0

The generic Three normal function also supports nonindexed, interleaved and other geometry forms. This specialized replacement is intentionally limited to the existing indexed, noninterleaved cloth buffers. Wind/rest topology changes would require regenerating the cached weights/bounds. A GPU analytic-cloth route can remove CPU uploads altogether, but needs separate rendered-normal/lighting validation; the exact CPU fallback remains available if analytic normal approximation is visibly different.

## Recommended priority

1. Continue cross-parcel batching and retain the existing 74-building semantic data, metre scale, glyphs and per-surface variation.
2. Keep GPU cloth if rendered motion/normal QA passes; otherwise use the verified exact CPU fallback. Conservative fixed bounds are safe for this bounded displacement model.
3. Avoid rebuilding whole parcels for cosmetic detail transitions where reusable recipes or stable pooled slots suffice. Cache finite glyph/primitive recipes and amortize construction without starving the ±70 m coverage guarantee.
4. Make accounting topology-driven instead of twice per frame. Do not remove budget checks or public proof data.
5. Use the same trusted-UI SwiftShader journey against the final R19 commit. Compare draw counts, buffer churn, shader programs, update p95, render p95 and silhouette coverage. CPU results alone cannot establish that renderer stalls are fixed.

## Reproduction

Run from this directory:

- `python prepare.py` creates instrumented copies only in this analysis directory.
- `node profile.mjs baseline` measures original source.
- `node profile.mjs instrumented` measures named components in the copy.
- `node cloth-experiments.mjs` compares independent steady-state variants.
- `node verify-cloth.mjs` reruns the geometry/normal/bounds equivalence check.

Saved results: `baseline.json`, `instrumented.json`, `cloth-experiments.json`, `cloth-verification.json`, `build-sampling.json`. `baseline.cpuprofile` is the bounded V8 sampling capture; its timing overhead is not used for the uninstrumented figures above.
