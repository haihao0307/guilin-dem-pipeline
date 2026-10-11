# Original native rescue actor restoration

## Status

Restored from haihao0307/guilin-dem-pipeline commit `30c5405cc9801e216e1155249a1b87232e4faccd`, Draft PR 200. All 39 restored source files match their original Git blob SHA, including the original full-CSR AnimatedHuman, NativeRig, HandBodyCoordinator, model loader, skin, captured walking solvers and R02 host-time binding. No Joey face, replacement body, new character geometry, second renderer, canvas or rAF is used.

The 2026-10-10 run 38064809906 verified the previous original-human/room contract. It is historical evidence, not proof that this new rescue adapter or staircase contact passes. This directory's current CPU checks cover source identity, original host contract, adapter guards and a clearly identified synthetic skeleton using the original native rig solver. Real model loading, same-Scene GPU rendering, actual skin sole contact, CORS and visual gait remain for the new integrated Actions run.

## Stable scene entry

Import `createNativeRescueActors` from `./rescue-native-actor/NativeActor.mjs`.

`await createNativeRescueActors({THREE, worldRoot, sampleSupport, onProgress, signal})`

Returns `{actors: {crew, 'east-neighbour', 'west-neighbour'}, proof, dispose()}`. The single CommonPerson model, its decoded source assets and captured walking source are loaded once. Each actor owns its original shape snapshot, full CSR GPU buffers and independent pose. Every actor provides:

- `group`: add-on root in the existing worldRoot; factory already attaches it
- `human.mesh`: the original AnimatedHuman mesh
- `proof`: count, Anny rig, source commit and mesh ownership guards must pass before `nativeGeometry: true` is set
- `applyFrame({worldSeconds, actor})`: exact gameplay actor snapshot, with feet-position, direction, moving, stand/walk and optional actual trajectory
- `reset({worldSeconds, actor})`: explicit retry or rewind; keeps the same mesh/group and resets foot support, gait and the host binding
- `readNativeFrame()` and `report()`
- `inspectContacts({includeVertices: true})`: actual updated full-CSR sole band samples and floor/tread gaps; `measureSoles` is an alias
- `dispose()`

Actor snapshots use worldRoot-local Y-up metres. The group is placed at the requested foot-floor position. An internal child applies the original `human.floorOffset`, and the original mesh owns the one native Z-up to game Y-up conversion. Do not apply that conversion a second time.

`sampleSupport({x,z,referenceY,maxRise,maxDrop})` must return the actual support `{y, normal:[0,1,0], supportId, bounds:{x0,x1,z0,z1}}`, or null. Use `makeRescueSupportSampler(contract)` from the gameplay module. It resolves floors near the requested height instead of selecting the highest storey.

Use the existing host clock. Advance the gameplay and actor together in at most 50 ms substeps, preserving all elapsed time and the real trajectory around corners. Multiple pose updates copy only 104 bone matrices and mark the existing texture dirty; they do not recompute shape/full CSR or immediately upload GPU textures. Render once after the final substep. A normal undeclared large root jump and a clock rewind reject; retry must call `reset`.

## Continuous walking candidate

The original CMU16_33 capture is a finite walk-stop clip, not a loop. The standalone factory without a support sampler retains that finite playback and explicitly reports exhaustion. The three-actor scene factory requires real support sampling and uses `SupportWalker.mjs` instead:

- The original captured stop pose supplies the neutral torso/arms and shape-specific foot calibration.
- Original NativeRig 104-bone FK/IK drives the existing full-CSR body.
- Actual path displacement advances gait; one foot swings at a time. Stance anchors remain in worldRoot coordinates.
- Foot placement predicts along the actual current phase trajectory. It considers original tread bounds and calibrated foot footprint before accepting support.
- The body heading turns at at most 2.5 rad/s without moving the root off the original path.
- Interrupted swings settle using host time; no independent timer runs.
- Leg lengths remain fixed. A pelvis adjustment of at most 0.16 stature is allowed; targets exceeding 25 mm solver reach error reject.
- Support searches allow 0.23 m above the current root and 0.43 m below. Alternating-foot transfer allows up to two such risers (0.46 m up), or 0.43 m down. Actual stair risers still come from the existing recipe, never invented support planes.

This is an experimental kinematic walking adapter, not mature stair animation, force-balanced locomotion or a complete swept collision system. Clothing remains the existing shader color region, not garment geometry or cloth simulation. Sitting and suspended transport are not implemented.

## Actual sole diagnostics

`inspectContacts` samples original CSR vertices from each foot's captured-standing low band, within 10 mm of that foot's minimum. Every optional sample contains its original vertex index, current worldRoot-local point, actual sampled support ID/height and gap. Full foot-region counts are also retained so these are not confused with all foot surface vertices.

Candidate thresholds are explicit: any penetration deeper than 8 mm fails; a planted foot needs at least 30% of its low-band vertices within ±15 mm of actual support. An airborne foot does not need contact, but penetration is still checked. These thresholds are a reviewable diagnostic only. They do not prove foot-volume collision, physical balance, wall clearance or visual acceptance. Do not substitute ankle IK error for this check.

## Source and publication

`source-lock.json` contains every restored source Git blob and SHA-256, plus 42 fixed runtime dependency URLs. Known dependency size is 74,758,616 bytes, plus the original external GNM binary whose size has not been established in this restoration. The original loader enforces its existing SHA-256 values; the capture has both SHA-256 and Git blob verification. The sources are fixed to the PR 200 commit; the original GNM external URL is already fixed to its original upstream commit.

No body weights or large teacher assets are copied into this directory or newly republished. Runtime CORS/public readability must be established in the new Actions run; this restoration did not sign in or bypass any access restriction.

Final deployment location is `kaopu-minigame-workbench/voxel-train-study/game/r20-plants-r01/walled-city-neighbourhood-r01/rescue-native-actor/`. Its `sources/vendor/three.module.js` is a tiny re-export of the host's sole r170 module, `kaopu-minigame-workbench/voxel-train-study/vendor/three.module.js`. It must not be replaced with a separately bundled Three.js. Factory arguments also verify constructor identity against this same module.

`PUBLICATION-MANIFEST.json` lists all local package files and SHA-256 values, except the manifest itself. Existing 39 source Git blobs can be reused directly in the same repository. The package has not been pushed by this restoration worker. Existing scene, gameplay and host QA files were not edited.

## CPU checks

Run `node --test rescue-native-actor/*.test.mjs rescue-native-actor/sources/tests/native-actor-contract/hand-anchor-r02.test.mjs` from the city directory, plus `node rescue-native-actor/verify-source-lock.mjs`.

The continuous route tests use a synthetic 104-bone unit fixture, never a runtime person or replacement mesh. They cover the complete east-first route at 120 Hz, the upper-first borrowed-gate route at 50 ms steps, stopping, tight turns, original floor/tread queries and declared reset. They do not claim actual-model contact or visual success.

For isolated local CPU module-import validation only, set `NATIVE_HOST_THREE_FILE` to the verified host r170 module and launch Node with `--import ./rescue-native-actor/test-host-loader.mjs`. That helper must not run in a browser deployment.

## R03 first-step diagnostic probe

The real R03 integration loaded three original actors and passed the six static low-sole bands, but first walking failed at game time 1.5 s on the first descending staircase. CPU synthetic fixture passes must not override that actual failure.

`actual-route-probe.mjs` runs in official Actions with Node 22 and the same `loadNativeActorResources`, fixed original asset URLs, original factory and original source rig. It creates no renderer or browser. Set `NATIVE_ROUTE_OUT` (or `NATIVE_ACTOR_OUT`) for the artifact directory, `NATIVE_PROBE_SECONDS` (default 2.5) and `NATIVE_PROBE_DT` (default 0.05, maximum 0.05). It writes progress, actual original foot CSR/rig diagnostic data, per-frame contact summaries and failure candidates even on failure; failure sets exit code 1.

Every actor now exposes `inspectFailure()` and `exportDiagnosticFixture()`. The former contains the failed root, previous accepted anchors, attempted foot state and individual candidate support/footprint rejection reasons. The latter exports only the original rig and complete original CSR influences for its existing foot-region vertices, not a replacement body mesh. It is diagnostic evidence, not a production asset; do not publish the generated fixture as a new model.

An already obtained fixture can be replayed entirely offline with `NATIVE_FOOT_FIXTURE=/path/original-native-foot-fixture.json NATIVE_ACTOR_OUT=/path/results node actual-foot-replay.mjs`. This reuses the original NativeRig and source foot CSR, with the current actual floor/tread sampler. No remote load or browser is needed for this replay.
