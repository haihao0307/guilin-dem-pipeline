# Ocean Life Mother R01 — Fish / Bird / Coral

2026-09-18. Workbench candidate, not a production or species-accuracy acceptance.

## Project contract

References may be freshwater, reef, coastal or open-water fish. Keep each source's real identity and license. Do not rename freshwater references as real deep-sea species. A newly authored marine-looking candidate stays unnamed until target-species evidence is supplied. Reference assets teach structure and motion; never ship source meshes, textures, skin weights, skeletons or complete keyframe tracks as native KAOPU content. New topology or a new skeleton does not itself settle derivative-work rights.

Persist each reference as FISH-REF-### with file hash, source identity, license, anatomical/motion observations, target-species status, extraction method and acceptance gates. The destination is Game Mother, but a workbench result is not automatically a game-integrated release.

## Implemented

Fish: independently generated 956-vertex / 1578-triangle carrier, index hash 033deaa0, nine fixed-length FK spine joints and generated two-joint skin weights. Native authored cruise and separately labeled noncommercial reference-fit study mode. Posterior-increasing yaw and phase delay drive the chain; no source animation track is shipped. UI exposes amplitude, speed, native/study selection and up to 48 fish.

Habitat: synthetic 20 x 24 m shore/water test domain. Render and collision share the same triangulated heightfield. Conservative body/fin footprint, water-trough allowance for supported wave settings, safe initial placement and rejected unsafe predicted steps. Shallow / reef / outer deeper-water counts can be increased separately. Outer deeper water is a workbench zone, not a verified deep-sea habitat. Simple neighbor separation is not validated natural schooling or certified animal-to-animal collision avoidance.

Bird: inherited Grey Heron R61-H5B carrier and 7d9dc9bf topology retained. Ground idle and IK walking are active in the common scene. Air actors use an explicitly unaccepted wing/carrier flight study. No claim of natural flight acceptance or complete anatomical bone-matrix skinning. The original full Bird source project is preserved in the engineering package; as in the published R00 baseline, the small online page contains the shared H5B carrier, not the entire separate deep editor.

Coral: original procedural colony candidate retained. No new species fidelity, polyp physiology or general coral collision acceptance claimed.

## Reference 001 audit

File: model_67a_-_largemouth_bass.glb
SHA256: c1b964b34e80e8534b7801c496576d6a594938d217b4f763b35d04a922b3ee64
Embedded author: DigitalLife3D, https://sketchfab.com/DigitalLife3D
Embedded source: https://sketchfab.com/3d-models/model-67a-largemouth-bass-e60c457636b640629747c19feac4906c
Embedded license: CC-BY-NC-4.0, https://creativecommons.org/licenses/by-nc/4.0/
Animation: Swim Cycle; 33 skin joints; 74 channels; interval 0.033333335 to 2.099999905 seconds, duration 2.066666570 seconds; 121 samples. LINEAR rotation tracks use shortest-path quaternion slerp. Root-relative tail-direction PCA / first harmonic fit is an artist-animation study, NOT measured live-fish locomotion or hydrodynamic truth. Compact fit parameters remain restricted study content; commercialClearance=false. Do not infer that changing mesh, rig or file suffix removes these restrictions.

## KAOPU candidate contract

Preserves kaopu-score-page-candidate/0.2 identity/spaceFrame framing and adds ocean-life-recipe-candidate/0.1. KLP1 is this project's local candidate container, NOT a finalized universal Mother standard.

Little-endian header, 20 bytes: magic KLP1 at offset 0; u16 version 1 at 4; u16 header size 20 at 6; u32 UTF-8 JSON byte length at 8; u32 CRC32 of JSON at 12; reserved u32 zero at 16. JSON follows at offset 20. Known generator/version and bounds are checked. No imported code evaluation. Damaged CRC, incompatible versions and self-upgrading production/commercial flags are rejected.

The default native fish recipe is 1079 bytes. This is a recipe size, NOT the size of the required shared generator/runtime. Source model data and full source keyframes are not embedded. The current recipe contains generator parameters, seed, motion identity, metre/Y-up space frame, source evidence, host-port requirements and unaccepted release gates. CRC detects corruption, not malicious provenance forgery.

Game adapter: KaopuLife.createGameInstance(bytes, host), with host.sample([x,y,z],time) returning finite seabedY and waterSurfaceY in the same metre/Y-up world frame. update(time,pose) generates the fish, checks full vertices and sampled translation sweep, rejects unsafe placement and returns accepted/visible/last valid pose. This is a tested host-port candidate; no live Game Mother branch integration has occurred, and it is not continuous arbitrary rigid-body collision detection.

## QA scope and actual results

180 simulated seconds; 48 fish; 10800 fixed steps; 34560 full-vertex fish-pose samples. Supported waves include 0, 0.055 and 0.12; deformation tests include native and reference-study modes. Zero seabed/surface violations; minimum measured bed clearance 0.126423147 m and surface clearance 0.103005254 m. 89 unsafe predicted moves rejected, zero invalid placements. Zero degenerate fish triangles; maximum FK bone-length error 2.082e-17 m. These are tests within the synthetic heightfield and specified parameter bounds, NOT a universal guarantee against all collisions.

Recipe round-trip and recreated topology pass; corrupt CRC and production-flag upgrades rejected. Synthetic host accepts a valid placement and rejects a buried one. Bird leg-segment numerical tests pass; this does not certify visual foot sliding or natural flight.

Chromium / SwiftShader via Xvfb: 1440x1000, 1024x768, 390x844; five modes; no JS or WebGL errors, no horizontal overflow, pause works, study/native controls and 48-fish body checks pass. Browser tests use set_content because managed URL navigation is blocked. This is not an end-to-end public-navigation claim. Software-renderer FPS varies and includes samples below 5 FPS at 1440x1000; production performance is NOT accepted.

visualAcceptance=false; behaviorAcceptance=false; productionReady=false; commercialClearance=false; gameIntegrationAcceptance=false.

## Reproducible online delivery

R00 baseline commit: 0a4bd9f771f1da7b89de61a884ba7dba7565e130. The original six R00 payload files are reused unchanged. Their Git blob hashes were independently read and all six match a byte-for-byte reconstruction of the published R00 payload. Decoded baseline SHA256: 5d1d1383dcf63aed1dadffd32d60f9c604e964fc3992bce842ef75a4da364e35.

bundle-0.txt + bundle-1.txt are base64 gzip of UTF-8 source-bundle JSON. JSON contains readable files: fish-native.js, habitat-life.js, bird-life.js, kaopu-life.js, upgrade-r01.js. JSON SHA256: 71f81d4f9aa3897112f01d1163c02008980adab5c9184933892c91e38ee9a8e7. Only trusted, digest-checked bundled code executes; imported KAOPU recipes are data only.

index.html verifies baseline, source bundle and assembled HTML before launching. Its header normalization adapts the published R00 labels without modifying the underlying frozen modules. Assembled online HTML SHA256: 90e94e946845c2e48bb65d77e7c8ffa480520d1ec5dabe22641e4e86808bac9a. The assembled online HTML has also passed the three-viewport browser checks above. Old R00 URLs remain unchanged.
