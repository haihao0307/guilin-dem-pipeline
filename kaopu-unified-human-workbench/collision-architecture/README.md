# Jolt collision architecture R01

## What actually runs

- Official `jolt-physics@1.1.0` embedded WebAssembly, MIT. Package source commit `c9c122bcd48e92885fbee7d267c928c3781d581c`; its CMake selects Jolt `v5.6.0`, commit `e77f175595e64cb44218cc9d9d56fc365ad0e36a`.
- Real `TransformedShape.CastShape`: swept glove sphere versus fitted head/torso primitives. Hit point, normal, TOI and relative speed come from this query. No animation timestamp generates a hit.
- `ContactResponse` is our bounded spring, and `PoseResponse` is our skeletal-subtree compositor. These are **not** Jolt rigid-body/ragdoll dynamics. The optional isolated demo preserves all 25,417 vertices, 50,624 triangles, 104 bones and complete visual skinning influences per actor.
- An original 81-particle fixture runs **actual Jolt soft-body dynamics** against a rigid sphere. This proves that narrow capability, not sewn-garment fit or dynamic-wear certification.

## Runtime integrity and availability

`vendor/jolt-physics.wasm-compat.js` is a small loader. Browser fetches the version-pinned official npm distribution at https://cdn.jsdelivr.net/npm/jolt-physics@1.1.0/dist/jolt-physics.wasm-compat.js, verifies SHA-256 `011233a5fff762d6f0f5b50726b315246bf68cb182f0a10024559d04f4c257de`, and imports the verified embedded-WASM module. CORS, CDN/network and Blob-module CSP support are required. Unavailability or mismatch throws visibly; there is no mock or physics fallback. The full 3.2 MB module is deliberately not copied into this repository.

Node QA installs the official package using `npm install --prefix "$RUNNER_TEMP/jolt-runtime" --ignore-scripts --no-save jolt-physics@1.1.0` and sets `JOLT_NODE_MODULE` to the absolute file URL of its `dist/jolt-physics.wasm-compat.js`. The loader verifies the same hash. No upstream source build scripts are run. npm tarball integrity: `sha512-Erl+X0yK2f9/8Wrl55Nb2y9FYS5xDx375EabnHq+TbSDYEuPZBLvpaLV4nbc1M5gyA5Llbug81wSj1zSMRUr7Q==`.

## Source reading anchors and adoption decisions

All runtime source anchors below are pinned to the actual C++ dependency rather than moving master:

1. [Collision query implementation](https://github.com/jrouwe/JoltPhysics/blob/e77f175595e64cb44218cc9d9d56fc365ad0e36a/Jolt/Physics/Collision/TransformedShape.cpp): transform the cast to the target's frame, dispatch actual shape collision, and translate collected contacts back. Our adapter subtracts target translation over the step and restores that displacement at the returned TOI. Target rotation is frozen at step start: this is **not rotational CCD**. Use <=1/120 s substeps; rapid rotations and conservative primitive overreach remain measurable limitations.
2. [ShapeCast settings and results](https://github.com/jrouwe/JoltPhysics/blob/e77f175595e64cb44218cc9d9d56fc365ad0e36a/Jolt/Physics/Collision/ShapeCast.h): preserve fraction, contact and penetration-axis semantics. Our normal is normalized and points from the casting glove into the target. Earliest opponent target wins per hand, followed by geometric separation re-arm and cooldown. All hands must be sampled, including non-attacks, for re-arm; animation phase may classify an event but may not invent contact.
3. [Architecture: rigid bodies, CCD, determinism, character and soft bodies](https://github.com/jrouwe/JoltPhysics/blob/e77f175595e64cb44218cc9d9d56fc365ad0e36a/Docs/Architecture.md): distinguish kinematic animation targets from dynamic mass/inertia/constraint solutions. Fixed stepping, stable input ordering, reset and the same package build are required for repeat comparisons; our identical-reset test does not establish cross-platform bit determinism.
4. [Ragdoll API](https://github.com/jrouwe/JoltPhysics/blob/e77f175595e64cb44218cc9d9d56fc365ad0e36a/Jolt/Physics/Ragdoll/Ragdoll.h): kinematic pose driving and constraint-motor driving are different methods. Later active-ragdoll work must calibrate the coarse collision skeleton, motor strength, joint limits and root/support control, then map back to the original detailed skeleton. Do not overwrite animation goals with contact results or unlock every joint at once.
5. [CharacterVirtual API](https://github.com/jrouwe/JoltPhysics/blob/e77f175595e64cb44218cc9d9d56fc365ad0e36a/Jolt/Physics/Character/CharacterVirtual.h): a virtual controller is query-driven and not automatically a regular world rigid body. Useful for locomotion/support and sliding, not a substitute for articulated boxing-body collision or a ragdoll.
6. [SoftBodyMotionProperties](https://github.com/jrouwe/JoltPhysics/blob/e77f175595e64cb44218cc9d9d56fc365ad0e36a/Jolt/Physics/SoftBody/SoftBodyMotionProperties.cpp): broadphase candidates are explicitly limited to rigid bodies in `DetermineCollidingShapes`; per-vertex collision planes feed constraint/velocity updates. This supports cloth against kinematic/dynamic rigid proxies. **Inter-soft-body collision is not implemented. Self-collision is not certified or implemented by our adapter.** Do not turn cloth faces into rigid bodies and claim coupled cloth-cloth physics.
7. [Shared soft constraints](https://github.com/jrouwe/JoltPhysics/blob/e77f175595e64cb44218cc9d9d56fc365ad0e36a/Jolt/Physics/SoftBody/SoftBodySharedSettings.h) and [skinned-constraint sample](https://github.com/jrouwe/JoltPhysics/blob/e77f175595e64cb44218cc9d9d56fc365ad0e36a/Samples/Tests/SoftBody/SoftBodySkinnedConstraintTest.cpp): neutral vertices, inverse bind matrices, `SkinVertices` each step, max-distance and backstop constraints. These constrain cloth around animation; backstop spheres are not self-collision. Jolt skinned constraints have four weights, whereas our display retains every original influence. Any future reduced simulation-weight map needs a separately measured approximation and must never truncate visual CSR weights.
8. [Soft-body unit tests](https://github.com/jrouwe/JoltPhysics/blob/e77f175595e64cb44218cc9d9d56fc365ad0e36a/UnitTests/Physics/SoftBodyTests.cpp) and [official JS example](https://github.com/jrouwe/JoltPhysics.js/blob/c9c122bcd48e92885fbee7d267c928c3781d581c/Examples/soft/soft_body.html): use small isolated fixtures and a collider/no-collider control before integrating any garment. Our fixture has no material calibration, seams, fitting, self-contact or garment certification.

## Stable interfaces

`await CollisionWorld.create()` → `step({time, dt, attacks, targets})` → contact events; `reset()`, `dispose()`, `diagnostics()`.

- All world vectors: metres, Y-up. `dt > 0 && dt <= 1/120`.
- Attack: `{pairId, actorId, hand, from:[x,y,z], to:[x,y,z], radius}`.
- Target: same identity and endpoint fields, plus `{bodyRegion, radius, halfHeight, rotation:[x,y,z,w]}`. `halfHeight=0` is a sphere. Capsule axis is local Y. Quaternion is unit length and represents the previous step's orientation. A controller can add guard-glove spheres as `bodyRegion:'guard'` and classify them without sending bodily recoil.
- Event: `{schema,pairId,attackerId,defenderId,hand,bodyRegion,time,contactPoint,normal,relativeVelocity,closingSpeed,toi,source,confidence,proxyApproximation,rotationalCCD,impulseSolved}`. `confidence='geometric-proxy'`, `rotationalCCD=false`, `impulseSolved=false` are deliberate boundaries.
- `ContactResponse.accept(event,{height})`, `.step(dt)`, `.state(actorId)`, `.reset()`. State vectors are world Y-up. R03 may convert these once into its native pose space and perform proper FK/foot IK. Do not also call `composeContactPose` on that result; the standalone demo compositor is an alternative, not a second correction.
- `fitAnnyProxies(human)` reads actual neutral positions and complete CSR weights. `AnnyProxyAdapter.create(actors)` hashes positions and the full rest skeleton; `.sample()` returns sweep endpoints. Call once to prime after reset, then at every fixed step.

The adapter maps native `(x,y,z)` to view `(x,z,-y)`, then applies the actor's complete `matrixWorld`, including ring origin, facing and floor offset. Posed matrices already contain root motion; it is not added again. Glove center is wrist-to-middle-knuckle lerp(0.75), with the existing R02 safe fist sphere radius `0.10125*height/1.75`. It excludes the wrist sleeve. Per-substep computation can read these bones directly instead of deforming glove geometry, but must numerically prove center equivalence. Per-render complete glove deformation remains intact.

## Shape contract and limits

The mesh-based sphere/capsule fits are conservative, inexpensive approximations, not millimetre-accurate skin collision. Record and visualize their excess extent. Primitive shapes cannot stop all visible mesh penetration, especially during rotational sweeps and blended face motion. New body/head morphology must rebuild its actor and proxies; old shape fingerprints and baked contact baselines are invalid. The six-case R03 adipose recipe additionally needs its amount/schema/source hash; original state alone does not reconstruct it. This layer does not silently replace the existing 36 actors with those experimental shapes.

## Evidence and outstanding gates

`ENGINE-QA.json`: actual WASM hit/miss, analytic TOI, translating targets, self/pair rejection, sustained-contact debounce, separation rearm, repeat-reset, five scales and 10,000-cast steady heap check.

`ANNY-QA.json` and `POSE-QA.json`: original two complete adult actors, original safety spacing produces no hits; isolated reduced spacing yields measured contact. Skeletal reaction changes head matrices while leaving root and foot matrices unchanged. `SOFT-BODY-QA.json` records the small rigid-collision control fixture. `RESPONSE-QA.json` records bounded recovery.

Browser render, source/CDN failure behavior, multiple actual shape pairs, full mesh preservation, pause/reset/single-step and fixed-HTTPS publication each need independent QA. A Node pass is not browser acceptance; software-GPU captures are not user-hardware FPS. Tailor's P01 remains paper-pattern/design presets and is not modified or certified here.

## Accepted candidate browser evidence

Candidate `c75ebe4302decd566b811c213b33fa89acfec917`, [Actions run 37889950154](https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/37889950154), passed actual Chromium WebGL2/SwiftShader testing. Three actual body pairs retained full geometry and weights; the adult safe-spacing control had zero hits in 12 s, the independent closer-spacing scene had four. Event replay after reset matched exactly; pause/single-step passed. Twenty-four consecutive deterministic rendered frames and contact/proxy screenshots were inspected. Separate offline and tampered-CDN pages remained unready and visibly reported their failures. See `BROWSER-QA.json` and `EVIDENCE.json`. Fixed-HTTPS deployment verification follows publication and is not implied by this candidate result.
