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

The recorded Node run passed 10/10 tests: byte-identical determinism, rewind/replay and recipe immutability, full parent timing, staged emergence, meaningful parameter changes, fixed old vertices, normal-based shell thickness, finite indexed closed component shells, input bounds, original-piece OBJ and full mature preview counts. See `tests/node-test-results.txt` for the actual run.

A regression test caught and fixed a cache bug that could reuse mature parts after rewinding. The complete suite passed after the fix.

Browser acceptance is pending a real Chromium/WebKit run on the dedicated QA branch. Node checks and offline geometry renders are recorded separately from browser validation. The existing dedicated workflow serves the candidate's exact checked-out files over localhost in its disposable runner. No published mother entry is changed by that test.

The browser script accepts `CORAL_ENGINE`, `CORAL_URL`, and `CORAL_OUT`; it records the source commit, real WebGL pixel readback, geometry fingerprints, interaction outcomes, screenshots, downloads and measured frame intervals. A missing browser or driver is reported as NOT RUN, not a pass. Physical phone testing is a separate unperformed check.

See `RESEARCH_COMPARISON.md` for the preserved earlier R03 solver and the present guided route's different capabilities and limits.

Manual visual review remains required: crown irregularity, insufficient layering, excessive column appearance, stage continuity, screen framing in portrait/landscape, touch orbit/pinch, mobile memory, and whether the result meets the user's reference morphology.
