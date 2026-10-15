# Architecture study R02: verification contract

This directory adds checks to the existing Bureau-only QA route. It does not add or edit a GitHub Actions workflow, publish anything, or certify architectural/artistic acceptance.

## Existing runner contract

- Repository: `haihao0307/guilin-dem-pipeline`.
- Existing branch: `qa/bureau-r03f-public-hall-20261013`.
- Existing workflow: `.github/workflows/bureau-r03f-public-hall.yml`.
- Existing fixed entry: `kaopu-minigame-workbench/voxel-train-study/game/r20-plants-r01/lost-property-bureau-r03f/qa/startup-recovery-webgpu.cjs`.
- Candidate directory: the same Bureau directory plus `architecture-study-r02/`.
- Existing workflow already checks out the whole Bureau subtree and installs pinned Playwright/Chromium in its remote runner. No local browser installation or local Chromium launch is required for preparing these files.
- Existing artifact directory: `bureau-r03f-public-preview-results/`; new output names begin `architecture-r02-`.

After the separately authorized external synchronization, copy the contents of `targeted-entry.cjs` to the fixed **QA-branch** entry. Do not change the workflow. Do not copy that dispatch change into the production Bureau root.

The entry verifies the exact preserved baseline manifest Git blob (`9e26a4f0e32608550a40f24f60a52db32f25d41b`) and its 57 original SDF source/test files at baseline `8675b08a00a35a77b86984273974c5dcb286bedb`, then executes this candidate's `geometry.test.mjs` and `browser.cjs`. The workflow's existing root CPU tests and clearance step remain in place. Subdirectory CPU tests are not picked up automatically by the root `qa/*.test.mjs` glob.

`geometry.test.mjs` builds the actual model and checks finite/non-degenerate faces, 14 routes at three lateral offsets (42 rays), 90 stair tread supports and sampled 2 m headroom, 27 landing/floor support points, 27 shaft opening points, nine hall-height samples, roof bounds, the actual hall-roof underside over every truss vertex, nine monitor aperture/glazing/canopy samples, measured warehouse area and the preserved R01 model SHA-256. Mesh/triangle counts and sampled rays cannot establish architectural quality. `spatial.mjs` is shared by CPU and browser verification, so both exercise the same 14 declared routes.

## Required browser API

`window.__bureauArchitecture` must provide:

- `ready`: true only after a completed renderer frame.
- `frames`: cumulative count incremented after actual rendering, not an independent timer.
- `firstFrameMs`: measured startup-to-first-render time.
- `frameTimes`: numeric frame-interval array in milliseconds.
- `camera()`: `{eye:[x,y,z], target:[x,y,z], radius:number}`.
- `setView(name)` and `views`: all of `whole`, `street`, `hall`, `warehouse`, `tower`, `service`, `section`, `back`.
- `rendererInfo()`: actual last-render `calls` and `triangles`, both positive in the whole view.
- `proof`: serializable model/build proof. No old R01 count threshold is treated as R02 architectural acceptance.
- `passages()`: an object with the 14 declared routes, each sampled at 0 and ±0.35 m lateral offsets, keyed by named route, each with numeric `hits`. Coordinates and first hit information are useful additional evidence. Each required sampled route must have zero hits.

For scene-state verification, `rendererInfo()` should additionally return `roofsVisible`, `floorsVisible`, `cutHeight` and `clippingPlanes` (number of active planes or an array). The same fields at API top level are accepted; legacy `api.cut` is accepted for `cutHeight`. Roof/floor booleans must be computed from the actual scene objects, and clipping data from the renderer/plane. Copying checkbox values into these fields does not prove the scene changed. Missing observable roof/floor/cut state causes a failed check rather than a skipped claim.

Optional `view` or `currentView` is checked against the clicked preset when present. Optional `contextLost` is also checked. Startup failure should be exposed as `window.__bureauArchitectureError`; ordinary page errors and console errors are collected independently.

## Required controls

- Renderer canvas is a direct child of `body`.
- `#views`: a select with view values, or a container with `[data-view="name"]` buttons. Tests use these real controls rather than directly invoking `setView()`.
- `#roofs` and `#floors`: checkboxes; checked means the corresponding scene layers are visible. The whole view allows both layers to be shown.
- `#cut`: numeric/range control with valid min/max/step; maximum means no clipping. It responds to input/change events. The test cuts at 4.8 m when in range, otherwise a valid middle value, and restores maximum.
- `#light-quality`: current quality control. Its presence and selected value are recorded; quality switching is not claimed as tested by this script.

## Checks and evidence

1. Fresh context, entry HTTP success, API readiness, actual WebGL2 identification, nonzero drawing buffer, positive rendered calls/triangles, finite camera, and measured first frame.
2. Unobstructed canvas drag with real pointer events. Before pointer release, the camera must move and at least three actual frames must be rendered.
3. Real wheel events in both directions: zoom-in radius decreases by more than 5%, zoom-out increases by more than 5%, with frames in both stages.
4. All eight view controls, finite cameras, fresh frames, changed camera between successive distinct presets, and actual UI/canvas screenshots.
5. Roof and upper-floor hiding/restoration: actual scene visibility changes and rendered triangle counts decrease, then return to the original count.
6. Manual cut/restoration: reported actual cut height follows the input; when plane counts are exposed, active/cleared clipping is verified. Screenshots are retained for visual inspection. This is not a topological or watertight-mesh proof.
7. All 14 routes provide all three lateral samples (42 rays), and every reported sampled passage ray is clear. This does not prove whole-building navigation, accessibility, fire safety or code compliance.
8. No page/console/network errors, no observed context loss, and no final GL error.

Screenshots cover the initial view, pointer-held state, zoom restoration, each preset, hidden layers, manual section and restored layers/cut. They are evidence to inspect, not automatically accepted art. Canvas screenshots can include overlapping UI because Playwright captures composited pixels; the paired UI view makes that context explicit.

## Performance remains a separate gate

Both whole and section receive one requested 2500 ms sample. Each must produce **more than 5 frames**, preserving the previous gate, with actual elapsed time, frame count and computed FPS recorded. The script does not retry a failed sample or extend it until it passes. Aggregate frame intervals also report median and p95; the initial warm-up may be included and is not presented as an isolated steady-state benchmark.

- `functionalPassed` and `performancePassed` are separate.
- Either failure sets a failing process exit code.
- A functionality-only result is explicitly `functional-passed-performance-failed`.
- A full technical pass remains `passed-awaiting-visual-review`, with `artisticAcceptance: false` and `userHardwareVerified: false`.
- SwiftShader/software-renderer measurements are not phone or user-GPU performance certification.

## Preparation validation and boundaries

Syntax checks can run locally without launching a browser:

    node --check architecture-study-r02/qa/browser.cjs
    node --check architecture-study-r02/qa/targeted-entry.cjs

Run the actual entry only in the authorized remote repository QA layout, with the existing runner's dependencies. The workspace's local recovered candidate/source directories are not that complete checkout layout.

This QA package does not modify model/viewer files, publish original reference images, change permissions, edit other projects, or authorize external synchronization. Publication and exact-commit CI/artifact/HTTP verification remain separately controlled by the parent task.
