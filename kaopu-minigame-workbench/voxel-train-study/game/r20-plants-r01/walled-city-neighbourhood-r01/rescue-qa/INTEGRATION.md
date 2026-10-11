# First city rescue: integration contract

This adds a game to the existing 10-storey city. It does not make a second renderer, canvas, scene loop, clock or resident model.

## Existing-host setup

1. Keep the current building recipe and makeRescueContract(recipe). The real upper W7/E7 borrowed bridge and upper-borrowed-gate are required. The module refuses to start against the older missing-bridge recipe.
2. Import createCityRescueGame and makeRescueSupportSampler from ../rescue-gameplay.mjs. Instantiate game with {contract, onDoorChange:(id,open)=>hood.setDoor(id,open)}.
3. Restore three instances of the original native actor. IDs are crew, east-neighbour, west-neighbour. Each exposes applyFrame({worldSeconds,actor}) and proof.nativeGeometry === true. Supply makeRescueSupportSampler(contract) to the actor factory for actual tread/landing contacts. Add their roots under the existing hood.root, with the same local-metre coordinate system as the contract. Do not insert substitute display residents.
4. Load ../rescue-gameplay.css. Call attachCityRescueGameplay({THREE,game,worldRoot:hood.root,camera,canvas,container,nativeActors,onDirectorCue,onPause,onRetry}). The container is the positioned overlay parent of the existing canvas.
5. Each authoritative host frame calls hood.update(worldSeconds), view.update(worldSeconds), the existing camera/director update, then the existing renderer. The view invokes nativeActors[id].applyFrame for all three. Do not invoke a second animation clock.
6. Pausing must freeze the host clock, including actors, doors, fire and camera. There is no visibilitychange listener or local pause on blur. Resuming after a background gap advances to the new authoritative time, including deadlines. For retry, the simplest valid host policy keeps absolute world time monotonic and lets the game reset its local run epoch. If the host rewinds to zero, have onRetry reset the shared clock and return 0; the view resets the game to that returned time. Do not let a stale later frame re-enter it. onPause may return the new boolean paused state to update the button label.

## Director callback

Cues include nodeIds, exposeWallIds, cameraIntent:'upper-rescue'. Call hood.setWallInspection(cue.exposeWallIds). Keep the complete building and the real roof. The cue also provides local-metre subjects, lookAt, suggested position, transitionSeconds, and an explicit focus target. The host transforms them with hood.root. It must not hide the required rope/route information using depth of field. User camera control may interrupt the suggested transition. These cues do not create or control a second camera.

## Actual operations

The first click starts the game. Click a scene resident, then a scene anchor, choose the front/borrowed route where applicable, and commit the guide operation. Route previews are dashed, laid rope is solid and grows during actual laying. The original resident follows supported stair/platform points. The same rope remains at its anchor until a separate recovery action finishes. It cannot be used twice.

The front entry warns at 30 game seconds and is due to close at 55. The front route can only be started when its computed door-clear time is before the announced closure. An early button press cannot reserve the front path indefinitely. The close is postponed if someone is actively using its guide or if closing would remove all remaining deadline-feasible solutions. The player can toggle the rear gate; a close cannot hit an active rope or seal the remaining route. Action refusal explains the actual cause and spends no rope.

## Bounded mathematical model

- One 18.2 m line, one team, two residents.
- Exact route polyline distance + 1.8 m end reserve + 0.12 m per significant corner.
- The 8.5-floor point requires about 18.4 m to the east resident, and is therefore too short. Moving down to the 8-floor turn needs about 13.5 m. The rear route from W7 needs about 17.3 m.
- Actor routes sample actual walls/openings/supports at <= 60 mm spacing. Foot queries use the actual floor/tread at each foot X/Z and a bounded reference height.
- These are designed game rules, not professional firefighting, smoke dynamics, certified rope rigging or a continuous capsule/rope physics engine.

## Required verification before claiming playable delivery

CPU state-machine tests are in ../rescue-gameplay.test.mjs. The host still needs real WebGL screenshots and end-to-end interaction checks with native actor loading, support-constrained gait, stable frame cost, readable camera, start/finish/fail/retry, repeated clicks, shared pause, long-background catch-up and door-in-use rejection. Browser UI and native gait must not be marked passed from the CPU tests alone.

The flame is an original bounded two-ribbon procedural effect at the actual east doorway. It is not simulated combustion or a veil used to hide the building. There is deliberately no random full-scene smoke.

## Authorized CI browser flow

rescue-qa/browser-flow.cjs exports runBrowserFlow({page,report,shot}) for the existing official runner, plus runCityRescueBrowserFlow(page,options) for a pre-created authorized Playwright page. It does not launch browsers or CI. It waits for the actual host's __CITY_RESCUE_QA__.proof.actorReady, uses real UI clicks to select people/anchors/routes and commit actions, and only uses QA advance for deterministic shared-clock substeps. The host advance must subdivide into <= 0.05 s actor updates with one final draw.

It covers short-rope refusal, both rescue orders, front-window refusal, last-route and in-use gate refusal, separate rope recovery, actual pause/continue, failure/retry, retained original mesh identity, one canvas, WebGL readback and a 390×844 mobile layout. Ten full-page screenshots are labelled in the receipt. It records actual original-CSR sole-band diagnostics at each captured state and fails a candidate contact gate; that gate is not full foot collision or polished-animation acceptance. The outer runner separately measures navigation-to-ready cost including the large original model load.

## Next revision after the first real run (7bd60f2a)

The first real run loaded all three original models and passed all six static sole candidate gates. It failed on the first shorter route selection because Three r170 BufferGeometry.setFromPoints reused a longer attribute count and read an undefined point. The fix uses persistent position/lineDistance buffers with an explicit live drawRange. The actual same-host r170 test is rescue-qa/line-geometry.test.mjs; it covers 72→39→18→2→0→1→128→9 points and stale-tail rejection.

The same next revision gives residents separate supported roof arrivals and the crew a 0.9 m route-following head start plus a supported side position to let the resident pass. Both complete routes maintain > 0.50 m between actor foot positions in the sampled regression; this is an explicit spacing check, not a full human collision engine. Completion times are now 103.843 s and 132.926 s, including roof approaches and crew returning from its side position. The actual NativeRig route fixtures were rerun at this exact core SHA: 28b1514571f75e0604d899d39b0384142283acb2536b4333d58514cd992b9371.

The view now shows people first, then only the selected person's 2–3 relevant anchors. A real “更多锚点” control exposes the rest. It holds the committed route measurements steady during an operation, selects a closer shot, and reveals the actual back bridge when borrowed routing is chosen. Paused commands may queue a logical operation; native poses are only applied on a positive shared-world step. Initial actor binding and retry explicitly reset original native state.

Latest CPU verification: 59/59 top-level tests plus 2/2 actual r170 line-buffer tests. These do not erase the first real UI failure or establish the next revision's WebGL/UI/contact acceptance. Keep the first artifact tied to 7bd60f2a and rerun the corrected candidate.

## R04 framing correction after actual R03 images

The R03 `9203d5a9` real UI run confirms the 18.4 m refusal, repeated anchor selection and paused native-pose queue. It stops at 1.5 game seconds with the original walker's `No actual support for L foot`; neither full route is accepted yet. The core remains SHA-256 `28b1514571f75e0604d899d39b0384142283acb2536b4333d58514cd992b9371`.

The actual images also exposed a 266 px control panel occluding a low anchor, and a departing crew head clipped at the top. The view now fits actual feet, 2.05 m head/label envelopes and route points into a screen rectangle with separate 76 px top and measured panel bottom margins. It uses the actual host perspective (43 degrees, current aspect), a near-frontal initial view and the real rear direction for the borrowed route. It does not relocate any world target. The desktop panel shares the route/more-anchor row and removes the repeated footer, preserving readable mobile fonts. Expanding all anchors also widens the director framing to their true positions.

`makeRescueDirectorCue(game, snapshot, event = null, {width, height, fov} = {})` is backward-compatible. Host `rescueView` should supply its real canvas dimensions and camera FOV. The view itself reads canvas/panel rectangles. Same-Three CPU projection tests cover 900×700, 390×844, 1280×720 and 900×500 with initial, selected, departure and rear views. Projection is evidence of bounds, not of visual occlusion or usability; new screenshots remain required.
