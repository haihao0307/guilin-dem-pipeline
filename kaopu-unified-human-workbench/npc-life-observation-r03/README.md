# NPC-LIFE-OBSERVATION-R03

Status: candidate under verification. No public R03 result is accepted by this source checkpoint alone.

## Why this iteration exists

The user reported that the prior page could not be opened and requested a content audit and iteration. The accepted R02 source is `339a687dcc64160bd78730c671b8926b62af55df`. Its prior published CI measured 267,455 ms cold readiness and 65 native startup renderer calls. Real GPU completion was much slower than requestAnimationFrame callbacks, so physics could outrun the images a viewer actually saw.

This R03 changes startup, resource delivery and observation scheduling. It preserves the original physical bottle and hinged-window skills. It does not claim room navigation, a general autonomous planner, cross-device multiplayer, full-body dynamics, or finger friction simulation.

## Native source and preservation

Canonical source: HUMAN-INTEGRATED-R07, `kaopu-unified-human-workbench/human-integrated-r07/preview.html`, SHA256 `d1bd7940b885cb872143bc0e68ce85fd2f663c81be36a18e58fc6086781cf31a`.

Three original male adult forms are retained: A tall/slim + P01, B short/heavy + P02, C sturdy + P05. Each complete display has 266,098 vertices, 531,702 triangles, 104 original bones, the complete CSR weights with up to nine influences, and two original material groups. No external replacement mesh, simplified stand-in or different body system is used.

`NativeBinding.mjs`, `NativeRig.mjs`, `LifeWorld.mjs`, `WindowInteraction.mjs` remain byte-identical to R02. The first 42,629 bytes of `ActorAdapter.mjs`, before `createActors`, remain identical. Material/skin/geometry construction and camera coordinates are retained.

## Changes

- `BootLifecycle` uses a 180 s total deadline, 60 s absolute stage deadlines, resource rejection propagation and terminal failure. Absolute checks catch synchronous work that delays timers. `BootMonitor` displays stage/error state and gives fresh-document reload plus copyable diagnostics, including when WebGL2 is unavailable or lost.
- `NativeBootPatch` coalesces startup identity/portrait render requests, while preserving the complete R07 native draw chain. Completion is a real WebGL2 fence; a skipped native draw cannot count as completion. A/B/C and restored host state each receive a complete draw before capture/handoff.
- `AssetContract` pins 18 original compressed packets comprising 55 chunks (44,303,931 bytes), plus two unchanged PNGs (1,374,970 bytes). The build checks chunks, complete gzip packets, decompressed SHA256, PNG dimensions and bytes. Runtime core data is embedded; missing resources fail explicitly rather than silently fetching a substitute.
- The initial visible shell precedes native execution. The final HTML has one early UTF-8 declaration and syntax-checked programs. Actual paint and loading must still be tested in a browser.
- `RenderQueue` admits at most one native GPU frame. `ObservationClock` advances the unchanged 1/120 s physics by at most 0.12 s after its preceding frame completes, and stops as soon as an interaction phase changes. Completed-frame readers have a barrier before the CPU changes the world again.
- The UI uses existing contact/window cameras when starting those actions and resumes a paused observation. It labels slow observation explicitly. Numerical acceptance has an explicit accelerated mode and is not presented as continuous visual evidence.
- JSON export includes the R03 version, actual physical world, completed-frame trace, startup diagnostics and numerical verification results.

## Acceptance gates

1. Cold complete readiness <=180,000 ms; native startup renderer calls <=12; a real completed scene with all three complete people. GPU waits are bounded at 45 s.
2. Actual original geometry, rig, untruncated weights, six native material instances/programs, both PNG images decoded in native uniforms with matching SHA256.
3. No external HTTP request for the embedded core resources, both from file and final HTTPS navigation.
4. Three uninterrupted real UI actions: A pick/place, then open, then close the same physical window. No intermediate pause, external physics ticks or pose mutation. Actual GPU-completed metadata must show every phase, bounded fixed-step advancement, correct task token/epoch and final rendered pose equal to physical state.
5. Existing physical causality, contact/other-solid tolerances, cancellation, ownership, native rest recovery, data export and 390 x 844 viewport gates remain. A viewport test is not a physical-phone test.
6. The published HTML must exactly match the build SHA/size and source head; its fixed HTTPS URL must pass another real Chromium run.

The default complete rendering is costly. This observation scheduler preserves observable phases on a slow renderer by stretching wall time; it is not a 60 fps performance fix. The prior bottle initial wrist target clamp of approximately 26.583 mm is not addressed in this iteration. Sampled contact-clearance checks do not establish continuous mesh collision or perfect hand tracking.

## Build and verification

From the repository root:

```sh
node kaopu-unified-human-workbench/npc-life-observation-r03/prepare.cjs
node kaopu-unified-human-workbench/npc-life-observation-r03/build.cjs
node kaopu-unified-human-workbench/npc-life-observation-r03/qa/audit-r03-assets.cjs
node kaopu-unified-human-workbench/npc-life-observation-r03/qa/audit-r03-boot-render-contract.mjs
node kaopu-unified-human-workbench/npc-life-observation-r03/qa/audit-r03-continuous-contract-test.cjs
node kaopu-unified-human-workbench/npc-life-observation-r03/qa/r01-causal-regression.mjs
node kaopu-unified-human-workbench/npc-life-observation-r03/qa/window-causal.mjs
node kaopu-unified-human-workbench/npc-life-observation-r03/qa/window-host-integration.mjs
```

The workflow pins Playwright 1.58.2 and installs its Chromium. It runs the full suite using the final standalone file, then publishes only a new `npc-life-observation/r03-20261020/<source-head>/` directory and verifies the actual public page. The Pages carrier advances normally from its newest parent; no rebase, force push or historical path replacement is used. The branch remains a draft PR and is not merged.

Local numerical/resource/fixture checks are not GPU or browser proof. Browser and publication evidence must be attached to the same immutable source/build before delivery. Workspace interruption occurred during development; lost unpublished results have not been reused as evidence.
