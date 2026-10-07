# Guided coral tissue growth, JS R4.1

Independent research candidate. It is not registered with the mother workbench or deployed to Pages. This app uses an original deterministic guided skeleton and lamella material-growth law. It does not contain or recreate the video author's HIP, a biological solver, water, sand, or source assets.

## Run

From this directory, serve the files through HTTP, for example:

    python -m http.server 8765 --bind 127.0.0.1

Open `http://127.0.0.1:8765/` in a permitted browser. ES modules, Web Workers and Three.js must be served; double-clicking an HTML file through `file://` is not supported. Runtime files are `index.html`, `style.css`, `viewer.mjs`, `geometry-worker.mjs`, `coral-growth.mjs`, `vendor/`, and `THIRD_PARTY_NOTICES.txt`. The `tests/` directory is development-only; it contains a large OBJ used for independent Blender review and should not be included automatically in a release.

All Three.js resources are vendored. There are no CDN requests or remote runtime APIs. The only intentional external link returns to the verified existing mother workbench:

https://haihao0307.github.io/guilin-dem-pipeline/coral-mother-core-seed-r01/

## Controls

- Drag to orbit; wheel or pinch to zoom; two-finger move / right drag to pan.
- Play / pause, rewind to the low base, or drag the time slider in either direction.
- Front / side / top use an orthographic camera. Perspective restores the default angle.
- Seed, mature lamella density, and fold amount regenerate actual geometry.
- Click a part or choose it in the inspector to see IDs, parent IDs, birth, parent arrival and growth front.
- Current-stage OBJ preserves one named object per original tissue piece; selected-piece OBJ exports only that part. The filename and data use the stage currently displayed, not an unrendered pending slider value.
- JSON exports the complete immutable recipe and current-stage lineage/fronts.
- Reset restores parameters, stage, wireframe and camera.

The neutral gray model is the main view. No water, sand, display plinth, source video or texture is used.

## Geometry contract

`coral-growth.mjs` is dependency-free and can be imported directly in Node. `createRecipe({seed,density,fold})` produces a complete time-independent recipe. All component IDs, parents, attachment material coordinates, births and durations exist before evaluation. FNV-1a labelled seed streams plus Mulberry32 are explicit and deterministic; this is not a bit-for-bit reproduction of NumPy PCG64.

`createEvaluator(recipe, quality)(time)` returns the original individual meshes and lineage. Each tube uses the full immutable path to build fixed cross-section frames. Lamellae append fixed `u = j / steps` material rows, plus one moving fractional frontier; old rows are never transformed by object scaling. A fixed full-material mid-surface normal field provides symmetric normal thickness, including at nearly vertical folded edges. The common `u=0` root is welded. Normals do not depend on the current time, preserving existing tissue positions during rewind/replay. Memoized completed pieces are used only while the piece is fully grown at the requested time.

The recipe explicitly includes low base pads, main stems, forks, crown support branches and mantles. Crown lamellae are parented to their actual crown support; their birth is no earlier than the support's arrival at the attachment coordinate. Density changes the number of growth events, and fold changes the outer material chart. Main stem layout remains stable when density is changed.

Default preview at maturity: 479 pieces, 366,734 vertices and 731,552 triangles. The renderer merges buffers into one draw mesh without geometric welding/union, retains per-piece face ranges for picking, and generates geometry/normals in a Web Worker. Higher-resolution OBJ is optional and costs more CPU and memory.

## Important distinctions

- Real-time model and every OBJ export: overlapping individual closed tissue shells, with possible inter-part intersections and lamella self-intersections. These are raw organization meshes.
- Offline tissue union: a separate workflow being validated elsewhere; not included or claimed by this app.
- Per-part edge-incidence closure is not proof of one connected watertight object, manufacturing readiness, or absence of self-intersections.
- The app is an independent research candidate. Node tests do not establish morphology acceptance or visual/browser acceptance.

## Validation

Run:

    node --test tests/growth.test.mjs
    node --check viewer.mjs
    node --check geometry-worker.mjs

The original Node run passed 10/10 tests (the current lifecycle/LOD revision passes 13/13, described below): byte-identical determinism, rewind/replay and recipe immutability, full parent timing, staged emergence, meaningful parameter changes, fixed old vertices, normal-based shell thickness, finite indexed closed component shells, input bounds, original-piece OBJ and full mature preview counts. See `tests/node-test-results.txt` for the actual run.

A regression test caught and fixed a cache bug that could reuse mature parts after rewinding. The complete suite passed after the fix.

Browser acceptance is pending a real Chromium/WebKit run on the dedicated QA branch. Node checks and offline geometry renders are recorded separately from browser validation. The existing dedicated workflow serves the candidate's exact checked-out files over localhost in its disposable runner. No published mother entry is changed by that test.

The browser script accepts `CORAL_ENGINE`, `CORAL_URL`, and `CORAL_OUT`; it records the source commit, real WebGL pixel readback, geometry fingerprints, interaction outcomes, screenshots, downloads and measured frame intervals. A missing browser or driver is reported as NOT RUN, not a pass. Physical phone testing is a separate unperformed check.

See `RESEARCH_COMPARISON.md` for the preserved earlier R03 solver and the present guided route's different capabilities and limits.

Manual visual review remains required: crown irregularity, insufficient layering, excessive column appearance, stage continuity, screen framing in portrait/landscape, touch orbit/pinch, mobile memory, and whether the result meets the user's reference morphology.


## Bounded lifecycle and mobile-cost revision

The geometry law, recipe and layer count are unchanged. The default desktop's full recipe and five stages of position/index buffers match the recorded pre-LOD SHA-256 fixtures byte-for-byte. Mobile viewport sampling preserves all 479 parts and 436 lamellae. It uses seven main radial intervals and 14 angular intervals, plus fixed material samples at the curl onset (0.86), the shared desktop outer sample (13/14), and applicable radial/rise extrema. The normal-thickness field remains the desktop 14×28 full-material field. Shared material points are exactly identical. No layer is deleted.

Default mature mobile rendering is 143,502 vertices / 285,088 triangles. Its main position + normal + index buffers total 6,865,104 bytes, versus desktop's 17,580,240 bytes (about 61% lower). These are explicit mesh buffer byte counts, not whole-process RAM or complete GPU memory measurements. Current-stage export matches the displayed sampling; the higher-resolution export remains an explicit checkbox.

The closed shells now use FrontSide back-face culling. Node checks include positive signed volume and consistent closed edge incidence. This does not establish absence of local/inter-part intersections.

The renderer draws only when geometry, camera, selection, wireframe or size changes. Controls continue receiving RAF updates, but an unchanged view submits no repeated draw. The readonly audit reports actual draw counts, WebGL bufferData/bufferSubData submission counts and bytes, geometry installation times, render-submit wall time, and separate pixel readback/digest time. Submission wall times are not GPU elapsed times.

On pagehide, the app terminates its worker, cancels RAF and timers, disposes controls/geometries/materials/renderer, revokes download object URLs, and explicitly loses its GPU context. A session-only cleanup receipt and view/parameter snapshot allow verification after Back. A disposed BFCache page reloads safely on pageshow, reconstructing from that snapshot. Ordinary context-loss/restoration events pause rendering, preserve recipe/parameters, rebuild GPU resources through Three.js, and resume safely.

The browser runner separately measures 60 idle RAF intervals (requiring zero draws, geometry installs, uploads and readbacks) and 60 RAF intervals during controlled continuous camera movement (requiring repeated actual draws but no geometry rebuild/upload/readback). It explicitly simulates one WEBGL_lose_context loss/restoration and checks real pixels and exact geometry/parameters afterward, then verifies cleanup on mother-workbench navigation and Back. BFCache-specific behavior is reported as unexercised when the browser chooses an ordinary history reload.

Mobile WebKit uses real touchscreen taps on the accessible +/− zoom buttons instead of the unsupported mouse-wheel API. Optional single-touch picking is separately recorded. Mobile viewport/input emulation is not proof of physical-phone pinch performance.

Current Node result: 13/13 passed, including desktop bit-exact fixtures, unchanged mobile lineage, shared material points and normal thickness, preserved curl landmarks, rewind, and closed outward shells. Browser validation of this revision remains pending; no performance improvement is claimed from Node alone.
