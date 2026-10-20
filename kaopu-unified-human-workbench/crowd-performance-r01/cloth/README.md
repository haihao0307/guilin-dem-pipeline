# Native NPC component research

This archive preserves measurements of the **original MP05 R10 clothing CPU solver** and **original R14 shoe geometry**. It does not certify a complete R07 body + F13 hair + clothing + shoes scene. The separate `shoe-sharing/` experiment can be placed beside these files; it uses the same locked source tree and has its own reproduction instructions.

Start with [REPRODUCE.md](REPRODUCE.md). Source bytes are pinned in [SOURCE_LOCK_AUDIT.json](SOURCE_LOCK_AUDIT.json); the downloader verifies file sizes, SHA-256 and Git blob SHA-1. The lock also includes nine frontend files for interface inspection, without claiming their entire webpage dependency graph is installed. No production solver, garment mesh, action or rendering quality was changed for the clothing measurements.

## What was actually measured

| Probe | Actual scope | Excluded from the result |
| --- | --- | --- |
| [Clothing R02](cloth-component-bench-r02.json) | Unchanged `ReducedCloth`, T03 + P02 denim-bleach, retained fit body, original procedural `step`; 60 warmup + 120 measured steps, dt = 1/60; orders 1/2/4 then 4/2/1 independent worlds on one Node thread | R07 grading and new joint fit, browser workers, hair, shoes, rendering, complete-scene FPS |
| [Shoe geometry](shoe-counts.json) | Unchanged R14 `buildStyle` for four styles; counts for **one shoe** | Force dynamics, wearer fitting, textures, GPU frame times |

Clothing mean step wall times were 16.09/16.12 ms for one world, 33.69/33.27 ms for two, and 68.38/75.15 ms for four. All six cases completed, with no numeric rollback. That is not wearing acceptance: the fixture already had an inter-garment penetration sample at step 0; step 180 had a -0.2503 mm body sample, a -4.7440 mm inter-garment sample, and maximum edge-length ratios 1.5830 / 2.0362. Dense contact checks were taken only at steps 0 and 180. Intermediate first-failure steps are unknown. The initialization intentionally retained the saved fit and skipped the published joint-fit phase, so these precise penetration values must not be attributed to the published webpage or a new R07 fitting.

The four-world reverse-order p95 was 115.71 ms. It is retained with all raw timing samples, not removed as an outlier. None of these CPU values is a rendered frame rate or a capacity guarantee for another machine.

## Minimum native clothing integration contract

The following is an interface review and proposed adapter boundary, **not an implemented shared-renderer integration**. All MP05 source references below resolve to the pinned `c5c0bedbc35f24cbb35426ab9c14b74ca7fc5f49` publication.

### 1. Preserve the identity and build the fitted actor

`loadPlatformPerson()` obtains the actual platform model, native binding, rig, original unpruned influences and appearance. It checks the retained person topology before grading garment panels. `gradeGarmentToPlatform()` changes the paper size and binding identity, explicitly setting the target static gate to **not accepted until new fitting and visual review**. Equal topology alone does not establish an accepted fit for a different body shape. See [platform-person.mjs](mp05-r10/platform-person.mjs), lines 8–38.

The original module has a single module-level `runtime`; its `PlatformViewer` takes ownership of the original canvas/viewer. Repeated concurrent calls are not a safe multi-actor factory. A scene adapter must give each actor its own binding, fit identity, mutable clothing state and lifecycle while retaining the original model data. Loading multiple hidden copies and then moving their groups does not implement this ownership contract.

### 2. Supply one pose per physical tick

The actual signature is **`NativeMotion.evaluate(pose = {}, matrices = null)`**. For externally supplied bone skin matrices, the primitive call is:

```js
// Interface illustration only; this is not a complete worker/frame adapter.
world.actor.evaluate({}, skinMatrices);
await world.acceleration.step(dt, false);
nativeBinding.animate(skinMatrices);
```

`skinMatrices` must contain one 16-value row-major matrix for every bone in the retained **104-bone `rig.names` order**. Each matrix is `posedWorld * inverse(restWorld)`. These are skin transforms, not world transforms, local quaternions, Three.js column-major `Matrix4.elements`, or the first argument to `evaluate`. The primitive preserves the actor's full weight set and updates its native body positions; `NativeBinding.animate()` uploads the same matrix convention for visible skinning. See [native-motion.mjs](mp05-r10/native-motion.mjs), lines 16–28, and [platform-motion/bridge.mjs](mp05-r10/platform-motion/bridge.mjs), lines 151–165 and 215–227.

The native body frame is Z-up; the clothing/render frame uses metres with `[x, z, -y]`. Keep actor-local fitting and collision coordinates consistent with that conversion. Apply NPC scene placement consistently to all displayed components; do not add root translation twice.

The example is deliberately incomplete. `step(dt, false)` suppresses internal action advancement, but the original step increments `motionTime` only for internally advanced motion and `bodyRevision` only when `world.motion !== 'idle'`. Its rollback snapshot also begins **inside** `step`, after an external `evaluate` would have changed the body. A real adapter must own the input pose sequence, simulation time, revisions and atomic body/cloth presentation, and restore the previous accepted input pose when a step fails. Its pose packet needs full length and finite-value validation. The matrix branch also does not refresh `actor.anchors`; current reduced contacts consume `actor.positions` / `actor.skin`, so future consumers must not assume `anchors` is current. See [reduced-cloth.mjs](mp05-r10/reduced-cloth.mjs), lines 41–60.

The current [LiveClothController](mp05-r10/live-cloth-controller.mjs) and [worker](mp05-r10/live-cloth-worker.mjs) expose action names and internal clock advancement; they have **no external `skinMatrices` command**. Extending that protocol is required before a shared scene clock can drive clothing. The existing three-slot transferable output pool and frame sequence should remain bounded. Body, cloth and any hair-root update must correspond to the same accepted physical tick before presentation.

### 3. Export the full original garment representation

The original workbench exposes `window.__MP05__.debug()` with `{ viewer, items, physics, model, lighting, personPreview, actionCycle }`. An item's visible garment is **`item.solid.group`**, generated by `buildContinuousSolid(item.mesh, packet, info, { renderer, ... })`. `item.mesh` is its carrier/control geometry; exporting only that mesh would omit the original visible yarn or leather representation.

Each accepted physics output updates the carrier positions and normals, bounds and initial index orientation; then `solid.motion()`, `solid.deform()` and `solid.update(camera)` update the original representation. Original skin binding and shadow/depth materials must advance with the same pose. See [app.mjs](mp05-r10/app.mjs), lines 54–68, 80 and 110; [continuous-solid.mjs](mp05-r10/continuous-solid.mjs); and [native-shadow-binding.mjs](mp05-r10/native-shadow-binding.mjs).

The solid closes over its renderer, camera sampling, request-render callback and per-garment deforming resources. Its bounds and projected-error calculation currently treat garment coordinates as scene coordinates. Moving the group under an NPC transform alone gives incorrect sampling coordinates. The adapter must transform the camera/frustum into that actor's local space or account for the actor's world matrix throughout those calculations. Its frame atlas must be created for the shared renderer/context; moving a render target from an old workbench does not move its GPU allocation. Beauty, shadow and native face diffusion routing must retain the original appearance and current-frame occlusion; see [yarn-frame-atlas.mjs](mp05-r10/yarn-frame-atlas.mjs) and [face-pass-routing.mjs](mp05-r10/face-pass-routing.mjs).

### 4. Use one Three.js module instance for the shared renderer

MP05 and the R14 package both report Three r170, but their bytes differ: MP05 starts seven resource ID counters at 1,000,000; the recorded R14 npm package starts them at 0. The lock retains both exact byte identities. The derived file is used only to reproduce the recorded component probes; the shoe-sharing probe retains the original MP05 vendor module.

Every independently evaluated copy or iframe has its own counters. This can produce duplicate IDs when resources are mixed in one renderer. The pinned renderer indexes geometry state by `geometry.id` and tracks current material by `material.id`. Therefore a shared renderer should construct/adopt resources through **one shared Three.js module instance**, resolving both bare and explicit imports consistently. Rebuilding Three resource wrappers around exact original immutable data is a possible adapter strategy; rebuilding simplified asset geometry is not part of this audit. Mutable bone textures, deformation targets, per-actor uniforms and cloth arrays still need correct independent ownership.

Calling a foreign object's `.clone()` is not enough: upstream clone methods call `new this.constructor()`, so they can allocate another ID from the same foreign module's counter. Merely setting all initial counters to 0 or another offset also does not establish global uniqueness. See [vendor/three.module.js](mp05-r10/vendor/three.module.js), resource counter declarations, `clone()` implementations, and geometry state at lines 15324–15329 / 17628–17632. This is a concrete integration risk inferred from the source; no complete cross-iframe renderer failure benchmark is claimed here.

## Explicitly unsupported by this archive

- Complete, rendered and visually accepted R07 body + F13 hair + MP05 clothing + R14 shoes on one shared renderer, at any NPC count.
- A newly graded R07 garment fit, full arbitrary layering, or proof that finite reduced-solver coordinates satisfy material strain/penetration acceptance.
- Full free cloth, complete cloth self-collision or continuous collision detection. The released solver retains a skeletal reference with regional secondary dynamics and specific body/top–bottom contacts; see [BUILD_MANIFEST.json](mp05-r10/BUILD_MANIFEST.json).
- A common force/contact world for hair–cloth, shoe–body, cloth–shoe, NPC–NPC or arbitrary room objects. R14 geometry flex is not a shoe force solver; wearer fitting is not certified.
- Browser/GPU frame-rate conclusions from the Node CPU measurements, or summed component timings represented as measured complete-scene FPS.

No fixed-distance LOD tiers, substitute characters, action-result replay cache, relaxed safety thresholds or production optimization were introduced by these reproduction scripts. Any later integrated experiment needs its own source lock, actual frame-time measurements and visual/contact evidence before it can extend these conclusions.
