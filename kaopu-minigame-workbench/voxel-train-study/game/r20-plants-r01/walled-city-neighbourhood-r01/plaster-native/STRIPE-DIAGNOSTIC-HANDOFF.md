# R02 hard-stripe isolation controls

Status: implementation and CPU contracts passed; GPU controls not yet run. The R02 borrowed-door, street-eye, dry-control and all four legacy/metric single-wall PNGs were actually inspected. Both isolated walls appear almost flat grey; the metric bridge is not accepted as a cure for the hard building stripes.

## Integration

Import runPlasterStripeDiagnostics from ./plaster-stripe-diagnostics.mjs in the host QA module. Call it immediately after the existing open building-borrowed-door shot:

await runPlasterStripeDiagnostics({THREE,renderer,scene,camera,hood,report})

The caller owns the existing renderer and browser. There is no new RAF, browser launch, external upload, or production source edit. The module requires the existing exact R02 camera position [-.2,7,-8.6] and target [-2.2,6.55,-4.65]. It does not change camera, visibility setup, inspection level, clock, doors or lighting. World transforms and projection are checked before every frame.

The report callback receives the usual stage:shot PNGs. Strip each returned shot.png when writing the JSON receipt, as for the existing field comparison. Readback comparisons, ROI scanlines, uniform values, and ray probes are returned as data.

## Bounded matrix

Two completed readPixels frames per mode; 11 modes plus one restored-wet frame group, 12 PNGs total:

1. wet-native: unmodified production shaders and wet state
2. dry-api: only the actual setWaterEnabled(false), with no forced uniform update
3. dry-shader-bypass: also make nativeApplyWater no-op on every bound material, independent of uniform state
4. dry-no-micro: only remove the plaster perturb call from #3
5. dry-plane-normal: only replace its shading normal with the same coat's carrier-plane world normal
6. dry-constant-base: only replace base and roughness with constants, preserving lighting
7. unlit-plaster-constant: uniform unlit grey plaster output; all other scene geometry stays present
8. water-mask: actual V26 receiver mask, directly visualized
9. water-components: retained V26 contribution algebra; red streak*.92, green broad*verticalGate*.32, blue lowerDamp*.58
10. normal-deviation: 64× deviation of interpolated vertex normals from the coat plane
11. primitive-boundaries: original exact triangle positions, per-triangle colour and barycentric edge overlay
12. restored-wet: original geometry/materials/uniform state; its pixels must equal #1 exactly

All changes are temporary inside this diagnostic call. Finally blocks restore every shader, geometry, visibility flag and diagnostic uniform, and dispose transient geometry even after failure. Source mother functions remain in the generated shader variants byte-for-byte; only adaptation calls, the water-mix bridge, or diagnostic main output are intercepted.

Primitive visualization preserves every original triangle position and count. Its temporary position/barycentric/ID attributes are explicitly capped at 64 MiB. CPU preflight for R02 sees 34 plaster coat meshes, 283,256 triangles, 23,793,504 transient bytes in the borrowed-door view. It does not refine or permanently deindex the building.

## How to decide

- dry-api equals dry-shader-bypass: uniform disable works; remaining differences from wet are real water shading.
- dry-api differs from shader bypass: inspect material/uniform upload or an unbypassed material before changing aesthetic parameters.
- Hard lines disappear in dry and match the water mask / red contribution: identify V26 streaks rather than geometry.
- Lines remain dry but disappear after no-micro or plane-normal: inspect the affected normal contribution and the amplified normal image.
- Lines remain with constant lit material but vanish unlit: remaining lighting/normal-state issue.
- Lines remain even with unlit plaster: inspect real overlapping primitives, gaps, another material in front, or depth ordering.
- Compare hard-line screen coordinates with the primitive image and per-pixel faceIndex/vertexIndices/barycentric/world-normal probes. A coincident screen-space line alone is not proof; use the isolated controls.

Both unobscured wall regions are sampled at every pixel on scanlines y=80,x=70..274 and y=200,x=520..750. Every eighth pixel also has a CPU ray probe with actual triangle IDs, barycentric weights, interpolated normal and cachedLow. This avoids attributing a stripe to a mesh boundary by appearance alone.

No result of the unrun controls is claimed here. The source cheap streak remains a candidate: it uses floor(horizontal*5.4 + seed*.0031), a per-column width, and vertical gates normalized to the full building height. It is visualized without changing that source.

## Checks

24/24 CPU checks passed: original 14, metric 4, diagnostic 6. node --check passed. Main runtime sources, shader mother functions and source parameters were not modified in this diagnostic task. See stripe-diagnostic-cpu-results.txt and STRIPE-DIAGNOSTIC_SHA256.txt.
