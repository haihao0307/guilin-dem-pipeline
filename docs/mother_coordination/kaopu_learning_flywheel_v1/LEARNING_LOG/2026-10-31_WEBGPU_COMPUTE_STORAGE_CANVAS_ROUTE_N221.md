# KAOPU Learning Flywheel N221 — WebGPU compute-storage-canvas is a standards-level triangle-free backend candidate

## Bounded question

Can a browser WebGPU backend present a filled function-surface image without submitting triangle primitives, and which command route must be bound to prove it?

## Baseline and freshness

- `main@3ccae4bde0c91973adbb81f99ec4d54bc9357ce0`
- root `AGENTS.md` blob `251b664646a489e9292748f1d41998ee62a338f5`
- R2 OS blob `d942d44bad0bbd206ea3768d620ad60d5ddeb2bf`
- reference gate blob `8c0a49c71865ef76cbc614f8188239bc808a8278`
- freshness gate blob `4754a90a94e4a9e7806357b6eb292e5c713e9021`
- #91: N220 is the latest comment; no Mother/coordinator acknowledgement or new production subject after it.
- #63: no new Coast production evidence after N49.

No production branch, Mother, main, R2 OS, root AGENTS, renderer, or global gate was modified.

## Primary-source answer

Pinned sources:

- W3C/GPUWeb specification repository: `gpuweb/gpuweb@4e829b310ba7381034b93b974eb1a6aabfb464f7` (2026-10-30)
- official WebGPU CTS: `gpuweb/cts@d116bcccd1833369fa3715a6df503c0dd9b0d7fa` (2026-10-24)

The normative `GPUPrimitiveTopology` set contains only:

- `point-list`
- `line-list`
- `line-strip`
- `triangle-list`
- `triangle-strip`

Therefore a normal filled render-pipeline route has no analytic-patch primitive and no quad/curve-surface primitive. Its filled polygons enter fragment processing through rasterized primitives; triangle list/strip is the relevant filled primitive route.

However, WebGPU also allows a different presentation path. `GPUCanvasConfiguration.usage` controls the current canvas texture's usages. `rgba8unorm` supports write-only `STORAGE_BINDING`, and the official CTS `canvas_complex.html.ts` contains both `ComputeWorkgroup1x1TextureStore` and `ComputeWorkgroup16x16TextureStore`. They bind `ctx.getCurrentTexture()` as `texture_storage_2d`, call `dispatchWorkgroups`, and use no render pass or draw call for that path.

Primary sources:

- [W3C WebGPU Recommendation: primitive state and topology](https://www.w3.org/TR/webgpu/#primitive-state)
- [W3C WebGPU Recommendation: canvas configuration](https://www.w3.org/TR/webgpu/#canvas-configuration)
- [W3C WebGPU Recommendation: texture format capabilities](https://www.w3.org/TR/webgpu/#plain-color-formats)
- [Official CTS compute-to-canvas reference test](https://github.com/gpuweb/cts/blob/d116bcccd1833369fa3715a6df503c0dd9b0d7fa/src/webgpu/web_platform/reftests/canvas_complex.html.ts)
- [Official CTS primitive-topology test](https://github.com/gpuweb/cts/blob/d116bcccd1833369fa3715a6df503c0dd9b0d7fa/src/webgpu/api/operation/render_pipeline/primitive_topology.spec.ts)
- [Official CTS canvas-usage validation](https://github.com/gpuweb/cts/blob/d116bcccd1833369fa3715a6df503c0dd9b0d7fa/src/webgpu/web_platform/canvas/configure.spec.ts)

## What this teacher knows beyond Current Best View

N220 proved only that exact authoring geometry does not prove a triangle-free runtime and kept a synthetic direct-parametric positive control. W3C GPUWeb plus the CTS add the missing narrow fact:

> A conformant browser route can bypass render primitive assembly entirely and write the canvas through a compute storage texture.

This is a backend feasibility result, not a surface-solver result. It does not prove KAOPU already has the correct function evaluation, lighting, visibility, instance sharing, numerical robustness, performance, or no-per-object-intersection architecture.

## Teacher screening

| Check | Finding |
|---|---|
| Source/provenance | W3C standardized specification and official GPUWeb CTS repositories |
| Maintenance | Spec pushed 2026-10-30; CTS pushed 2026-10-24 |
| Runnable evidence | Normative CTS, including direct compute storage writes to the canvas current texture |
| License/rights | W3C Software and Document License; GPU for the Web 3-Clause BSD; CTS BSD-3-Clause |
| Direct relevance | Defines the only browser GPU command routes KAOPU can legitimately claim |
| Novelty | Converts N220's synthetic direct route into a standards-level compute backend candidate |
| Dependencies/cost | Exact browser, adapter, format capabilities and physical device still matter; compute is not performance-free |
| Failure boundary | Hidden render composite, unsupported storage format, incomplete command trace, numerical/algorithmic failure |

Decision: `TEACHER_CANDIDATE`, not `AUDITION`, `PROBATION` or `ACTIVE_TEACHER`.

## Candidate receipt translation

The existing regression `MECHANICAL-SURFACE-RELATION-NOT-SHAPE-LABEL-001` is extended rather than duplicated.

For `webgpuBackendClaimed=true`, bind:

- exact spec and CTS revisions;
- exact runtime subject and WebGPU command-trace digest;
- `allCommandEncodersObserved`;
- pipeline kinds used;
- render draw-call count and primitive topologies;
- compute dispatch count;
- canvas format and usage flags;
- exact device feature set;
- storage-texture write observation;
- independent display-route verifier.

Decision rules:

- missing command receipt -> `HOLD_WEBGPU_BACKEND_ROUTE_UNBOUND`;
- any render pipeline/draw call/triangle topology, including a hidden fullscreen composite triangle -> `REJECT_RENDER_PIPELINE_USED_IN_TRIANGLE_FREE_CLAIM`;
- unsupported or unverified storage-canvas capability -> `HOLD_STORAGE_CANVAS_CAPABILITY_UNVERIFIED`;
- complete compute-only `rgba8unorm + STORAGE_BINDING + dispatchWorkgroups + textureStore(currentTexture)` source receipt -> `CANDIDATE_COMPUTE_STORAGE_CANVAS_ROUTE_ELIGIBLE_NOT_PRODUCTION_PROVEN`.

## Replay

The 22 N218–N220 controls remain unchanged and pass. Five new controls cover:

1. WebGPU claim without a command receipt;
2. standard render-pipeline `triangle-list`;
3. compute surface work followed by a hidden fullscreen render triangle;
4. `bgra8unorm` storage without the required feature;
5. the official CTS `rgba8unorm` compute-storage-canvas route.

Result: `27/27 PASS`.

This is specification/CTS source evidence plus synthetic receipt replay only. The CTS was not executed in the KAOPU production browser/device, and no KAOPU function patch was rendered.

## Smallest falsifiable audition

Use one exact Mechanical/Motor analytic patch and one exact production browser/device:

1. configure the canvas current texture as `rgba8unorm + STORAGE_BINDING`;
2. evaluate one bounded function patch in a compute shader and write with `textureStore`;
3. capture every command encoder and require zero render pipelines and zero draw/drawIndexed calls;
4. inject a hidden fullscreen-triangle composite negative control, which the route checker must reject;
5. compare the resulting pixels and timing against the matched reference and the existing triangle route without changing the acceptance threshold.

This audition would test backend feasibility only. A separate bounded trial is still required for the user's shared function-class evaluation and no-per-object-intersection hypothesis.

Lifecycle before routing: `POSTED=false / ACKNOWLEDGED=false / IMPLEMENTED=true(candidate checker) / GATE-RUN=true(source+synthetic) / ADOPTED=false / USER-ACCEPTED=false`.
