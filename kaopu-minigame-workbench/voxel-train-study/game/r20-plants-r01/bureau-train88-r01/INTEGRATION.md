# Whole bureau across Yaumati in the retained FH88 game

This folder is an unpublished local integration candidate. No visual, frame-time or WebGL2 backend-equivalence acceptance is claimed. The user wants the entire building in the train scene to discuss its layout. No baggage-delivery scenario is started.

## Source and preservation

`source/` is a byte-identical copy of the complete R03e function modules at c38e0018aaa58c280ded445acf6485404301ff65. Hashes are in `qa/SOURCE_LOCKS.json`. The 92 × 80 m building, 72 × 62.5 m clear warehouse (4,500 m²), two banks of transverse racks, actual conveyor/boiler connections, L-shaped double arcade, stepped four-storey tower, tapering chimney, joinery and all original material mothers remain. Empty inventory means zero live item records, not deleted cabinets. Machine uniforms are its existing parked position.

`emit-shader-inputs.mjs` selects the original function closures without changing function expressions. The shader interface is changed from independent WebGPU storage/compute to raster stages for the existing WebGL2 host. The pinned sibling Naga 27.0.3 compiler remains the sole language translator. This does not make the game a native WebGPU renderer.

## Host API

Import `createBureauReceiver` from `../bureau-train88-r01/function-receiver.mjs` and `bureauView`, `applyBureauSiteExclusion` from `../bureau-train88-r01/bureau-binding.mjs`.

1. Create with the existing `{renderer, scene, atmosphere}`. For explicit technical tests only, `testResolution`, `testShadowResolution` and `setDiagnosticResolution` match the sibling station receiver. Example: `{testResolution:[640,426],testShadowResolution:[96,64]}`; both arrays require exactly two integers >=16, and a shadow override without diagnostic main dimensions throws. Initial proof records actual separate sizes. Production uses the actual host drawing-buffer size and sun shadow dimensions.
2. Apply `applyBureauSiteExclusion(world, () => game.view(), () => game.route)` once, after existing station-district siting. It augments native foliage exclusion and attaches a bounded discard mask to CLONED materials on only the original broad-earth and field-scenery objects. This clears original field rows, farm lanes and low hedges inside the bureau site without altering their geometry or other parcels. It never deletes a streamed street building or changes the route.
3. Call `bureauReceiver.render(camera, view, game.route)` after `world.update`, before the one actual `renderer.render(scene, camera)`, alongside the Kowloon receiver. Both receivers prepare their original function surfaces then render into the same opaque/transparent/depth/shadow frame.
4. Expose `bureauReceiver.proof` in the existing game debug state.
5. Provide layout view actions using `bureauView(name, game.view(), game.route)`: `context`, `street`, `exterior`, `section`, `warehouse`, `hall`, `freight`, `transport`, `roof`, `window`. Set the existing PerspectiveCamera eye/target to these world points; retain the existing upright up vector and free camera controls. `setSection(v.cut)` enables the original cut mode. Do not open the standalone bureau app.
6. `context` shows the bureau together with the station/railway. The retained source views show the door, warehouse, conveyor, receiving/boiler and full roof. They remain normal perspective views, not orthographic replacements.

The actual route lookup is index 1 with verified name 油麻地 / Yaumati. Its timetable target is 700 scene metres. No FRONT_X is added because retained stationOffset is target − distance. At that stop the candidate origin is [-5, 0.333, -66], with no rotation and no scaling. Main entrance faces local/world X-negative onto its original street; railway is world Z-positive behind the bureau. The .333 m vertical shift makes the original standalone asphalt top (−.25 m) meet the host at .083 m, 2 mm over its .081 m earth, preserving the bureau's original curb/floor elevations.

## Spatial checks

- Bureau main body is approximately world Z −108 to −25 at Yaumati; station platform is positive Z.
- Boiler/chimney approach no closer than about world Z −7.76; main railway corridor is nearer Z 0.
- Original local rear sidings remain separate sidings; no claim that their railheads or track paths connect to the running line.
- Rearward host street district was moved to world Z −147; its approximate extent is [−172, −122]. The bureau architecture and its south pavement are separated from it. The original broad asphalt ground rectangle reaches −141 and overlaps approximately 19 m of that district's ground. This is an explicit same-scene inspection item; no global building deletion is authorized by the adapter.

## Depth and glass

A miss discards. Opaque bureau hits write actual same-camera function depth. For a ray through source glass, the original throughGlass function resolves a rear bureau solid, which writes that solid's depth. Host opaque objects therefore remain able to occlude the rear solid. Two transparent response passes then use the original primary glass intersection for depth testing: source absorption/tint, then Fresnel reflection. These are screen dispatch triangles querying the original hit, not replacement window shells.

The source original material normals and response functions are evaluated directly in the matter stage. The original scalar/height/wood frame equations are unchanged. All shadows use the actual host sun camera, and glass is skipped for opaque shadow casting. Glass/host object ordering, display-space absorption/reflection blending, smoke ordering and hardware costs remain unverified. Do not claim optical equivalence or final readiness before actual same-host QA.

## Validation state and next gate

`node --test qa/*.test.mjs` passes the CPU placement/source/depth-contract checks. `node emit-shader-inputs.mjs` emits all four WGSL stages. `qa/compile-and-test.sh` invokes the already-pinned sibling compiler.

The local browser failed to launch because the sandbox disallowed Chromium's singleton socket, before any shader validation. Local cargo is absent. The user has resumed work. The shared station-host owner coordinates authorized remote CI and publication; this module owner does not publish a parallel branch. The next gate is to compile the exact candidate, validate the same-source samples, then run actual same-host context/street/warehouse/section, depth/miss/glass, drive/pause/resize/camera QA. No static screenshot is the user delivery; a new retained-old-version game entry is the delivery target after those gates.

## User layout acceptance

The conveyor layout and building siting have not been accepted by the user. This candidate brings the existing entire bureau into the same game scene so the user can point out what to move. The presence of an original conveyor or passing placement tests must not be described as proof that its position is finally correct. Preserve this review distinction in the new entry and delivery message.

## Remaining host-level blockers found in source review

- The original morning sun shadow camera is too small/short for the full bureau. This receiver now updates its projection before tracing, but the shared host must frame the currently inspected train/buildings with the same sun camera for both receivers. `shadowComplete` only certifies rays within that map, not whole-building shadow coverage.
- Host smoke/brake effects are transparent and do not write depth. Their correct order relative to real glass requires splitting transparent fragments before/after the original glass depth. Current opaque depth correctness is not transparent-layer acceptance. This is a known blocking host visual check, not only a hypothetical test.
- When the train is still at the first station, merely aiming at the bureau 700 m away does not load Yaumati's original station or ground because baseline station/terrain streaming is distance-centered. Context view must be used at the actual nearby stop, or the independent host must add a bounded camera-visible stream using original sources. Never change `view.distance` or teleport the Session to fake that state.

## Restored diagnostic / numerical QA contract (2026-10-12)

`node qa/emit-probes.mjs` emits exact-source `geometry-probe.wgsl` / `material-probe.wgsl`, manifest and preserved-function locks. Compile with the same Naga binary, entries `geometryProbe` and `materialProbe`. `node qa/backend-probes.cjs` from repository root runs isolated WebGL2 and WebGPU samples (6 comparisons: 2 domains × 3 ages). Geometry spans door, racks, transport, original boiler, chimney and hall; material samples retain original brick/stone/wood/metal/slate responses, material-normal and weather. This is backend numeric QA, not same-scene render or layout acceptance. Runtime stages remain step/normal/matter/glass. Current CPU tests: 24 passed; GPU results must be supplied by the actual unified workflow. No new boiler shape is included in this integration candidate.
