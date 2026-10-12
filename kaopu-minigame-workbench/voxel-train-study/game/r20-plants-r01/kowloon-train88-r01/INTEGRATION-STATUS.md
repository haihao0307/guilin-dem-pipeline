# FH88 Kowloon function integration candidate

This is an independent candidate, not a replacement for the retained driving entry.
The original FH88 host at `r20-plants-r01/` remains unchanged. R02 station remains a separate preserved baseline.

## Verified evidence

- `fe34144d7ef094396dcb856b05a9486acd8ff85d`, Actions `38196706209`: original WGSL versus Naga ES300 geometry exact at the sampled points; six source material families at three ages differ by at most 1.49e-6. Invocation-private candidate storage is exactly equal to the previous WGSL at those points.
- `963254c0a9d8edaa011f5c8595d6cc4a6ed5bfc8`, Actions `38198038510`: retained-host candidate geometry also equals WGSL at all tested points. The actual FH88 camera generated a 48×32 diagnostic function frame: 1088 hits, 448 misses, no unresolved rays. One frame reused twice without recomputation.
- This low-resolution technical diagnostic is NOT image-quality, gameplay-performance, complete shadow, transparent-occlusion, or mobile compatibility acceptance. Its cold software-GPU frame took about 50.4 seconds. No production performance claim follows.

## Architecture

One architectural construction generator plus unchanged locked mother sources emits WGSL. A pinned Naga source build emits GLSL ES300. Only interface declarations are adapted to Three r170. No station surface triangles, baked material images, world-field voxel grid, image panel or iframe is used. The dispatch triangle is a raster compute surface only.

Function intersections write current-frame floating-point buffers. The same real host camera converts each metric hit to gl_FragDepth. These transient buffers are invalidated by camera, source, scene state, light or dimensions. They are not a permanent surface texture.

The retained Session, train, passengers and running main rail remain authoritative. The integrated station has a non-symmetrically narrowed boarding island, all 76 original posts and 24 platform benches retained, with conflicting boarding-row ingredients relocated, a deep transfer truss, and exit bearing surfaces from the audited retained passenger paths. This is an authored construction proposal, not a structural-load certification.

## Open acceptance gates

1. Unobstructed whole-station view in the original game, not just a source/probe pass.
2. Correct same-frame train/window/smoke depth and actual host-light shadow camera, with miss discard and explicit unresolved checks.
3. Driving, boarding, pause/resume, resize/context loss, and saved-state behavior against retained gameplay.
4. Native-resolution cost and a bounded interactive budget. Software-renderer diagnostics do not establish real GPU or iOS performance.
5. Architectural/material visual quality. Carrying a field in a struct is not proof of consuming it correctly. Wood coarse parallax is presently carried but the view-ray parallax solution is still absent.
6. Passenger piers and adjacent cargo waterfront remain further authored construction work. Sea mother has not been validated; no substitute low-quality water is claimed complete. Hotel stays unbuilt reservation. Ships are not part of this task.

Private user photographs are reference only and are excluded from all repository trees and artifacts.

## Current verification in progress (2026-10-12)

40061dbc / run38202903477 passed the upright desktop candidate, retained ingredient counts, rearward original street placement, finite station-only ray envelope, exact host output/fog probe, and actual 240-tick driving displacement (6.2417506m). Its station image is a 96×64 technical render, not visual acceptance.

a463f814 / run38203560796 preserved all frame hit/miss counts and zero unresolved rays with admissible candidate pruning; the warm 96×64 main field took about6.95s on software rendering. The 50c15438 alternate-union array reuse preserved counts but slowed that main field to9.68s and was reverted. No hardware frame-rate claim follows either result.

a7254801 / run38205163034 is testing source-audited projected coverage rectangles, exact GPU count reduction, and a separately keyed static sun-depth cache. Production uses native canvas resolution and the host's unchanged2048² shadow dimensions. The current test includes a native640×426 main field while keeping its shadow at96×64 diagnostic resolution; this image cannot establish final shadow quality or interactive performance. Finer post/bench group bound gates are prepared locally and are not yet GPU accepted.

The current retained train's visual construction has been rejected by the user and is being repaired separately. Its presence in an integration screenshot establishes no train-faithfulness or whole-game visual acceptance. Station work does not edit its parts.

No integrated station candidate has been published or accepted as interactive. All original mother sources and station components remain; unresolved rays and raw candidate overflow remain explicit failures.

## Restored shared-bus verification, 12 October 2026, 12:40 UTC

The restored complete construction and original bureau c38 source are now on the independent QA branch, not on Pages. The current source candidate is `a5c366b5f53b86813a989ac9d3230840bc7afc19`, Actions `38249956374`.

- All station and bureau raster stages passed the pinned Naga compiler. The original single station geometry closure failed actual driver execution, despite compiler success.
- Contiguous physical-geometry partitioning executed 10 of 12 station groups on WebGL2. Hall lettering and platform castings/lettering returned invalid all-zero records on the first readback. A common dynamic constant-struct-array access is under controlled execution-only investigation; no geometry ingredient or curve is removed.
- The four-output station WebGPU diagnostic requested 64 bytes of color attachments per sample; this test adapter supports 32. That diagnostic did not execute its geometry. Its next version stores the complete 64-byte record in a compute storage buffer instead of reducing precision or dropping fields.
- The complete bureau source's geometry and material sample probes passed WebGL2-versus-WebGPU comparisons for three ages. Maximum errors were 2.24e-8 and 5.96e-8. This is source numerical evidence, not a rendered whole-building or gameplay acceptance.
- Recovered construction now includes the original quay, finite road and pedestrian ingredients. Site layout, original-platform alignment, visual quality, interaction, native-resolution performance and final transparency ordering remain unaccepted until actual shared-game evidence.

There is still no public new integrated entry or restored whole-station frame. Original public driving and R02 station entries remain the available fallback.

### Group execution result and next complete-frame candidate, 13:36 UTC

`566993e3`, Actions `38251687932`, established that the exact constant-lookup lowering repairs both previously invalid lettering groups. All twelve WebGL2 groups completed all three ages; their strict original-order physical merge had zero raw-candidate overflow at the probe points. The original complete single closure still lost its GL/WebGPU context. The newly introduced compute diagnostic timed out at pipeline creation for every group; no cross-backend numerical conclusion follows from that diagnostic failure.

The next receiver uses those complete grouped physical queries for each original ray step, including the original alternate roof/floor union advances. Normal preparation uses the same center plus four tetrahedral samples, with a separate error field that marks invalid normals/overflow unresolved. It preserves every original source ingredient and the original material preparation/presentation. It is still an unvalidated runtime candidate, not a performance claim. A single-group fragment diagnostic will run independently; the next actual visual test is one complete station perspective frame inside the retained shared game. Bureau/return-to-driving views remain separate pending acceptance gates.
