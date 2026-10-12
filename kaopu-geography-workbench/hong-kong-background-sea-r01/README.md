# 香港背景海试接 R01C

Scope: independent sea-layer trial. The Hong Kong terrain, railway and map are not assembled here.

The editable standalone index.html reuses Ocean Mother V001's original 24-component displaced Gerstner mesh, 12 filtered micro-slope harmonics, Fresnel reflection and sun/moon specular. It does not claim to have no geometry. The visual seed is a muted blue-green, opaque, gently moving background sea, not observed Hong Kong marine conditions.

Source: haihao0307/guilin-dem-pipeline commit 499e8eb8a74041c35c55622f391ee5de04aaca60, ocean-mother/v001/. The frozen standalone deep payload is extracted from canonical package commit 90a49e399079674230e658ca9cea242c8ec44b94 and has SHA-256 3498800d4bb287eadf448f01fb8fa8cf1b1f07eb3eab57f1428d824a62b55fd1. The full nearshore branch is not included in this page.

Rights basis: the original V001 README identifies its new sea implementation as original project code, with the user's Weather Mother providing the weather side. The background default keeps the original generated sky cache as a fixed snapshot, rebaking on weather/light/wind/height changes while sea animation and reflection continue. It does not claim live shared cloud/sea time. The QA-only ?liveWeather=1 option retains original live weather for like-for-like comparison. No externally supplied meshes, audio, images or restricted shader-study payloads have been added. No broader open-source license or user visual acceptance is asserted. The V001 technical references are retained: NVIDIA GPU Gems, Chapter 1, Effective Water Simulation from Physical Models (https://developer.nvidia.com/gpugems/gpugems/part-i-natural-effects/chapter-1-effective-water-simulation-physical-models), and Khronos EXT_disjoint_timer_query_webgl2 (https://registry.khronos.org/webgl/extensions/EXT_disjoint_timer_query_webgl2/).

Default sea parameters: wind 4 m/s, swell scale 0.30 m, period 8.8 s, chop 0.40, roughness 0.18, foam 0.04, tint 0.45, time multiplier 1, seed 8071, eye height 9 m. The original high-cloud preset uses Ci, density 0.30, count 2 and inherited fog 0.02, avoiding the original fair preset’s dominant nearby cumulus. Parameter controls, camera drag, zoom, pause, reset and configuration export remain editable.

HKBackgroundSea exposes getState, setConfig, reset, sampleHeight, pause, play and setView as a thin adapter over the inherited V001 API. reset reapplies the sea, camera and background-weather preset, preserving the elapsed simulation clocks, seed, sea speed and exposure. This is an independent page, without a reusable mount/dispose lifecycle or automatic graphics-context restoration. Units are metres, +X east, +Y up and -Z north. The sea-level vertical datum is UNBOUND. sampleHeight retains V001's undisplaced-coordinate height sampling and is not a validated inverse Gerstner collision query.

Future map integration must supply the same local metric origin, clock, camera and projection, and real coastline/depth occlusion. This file does not pretend that those connections already exist. Rendering uses inherited perspective; no orthographic flattening or proxy image is substituted.

Rollback: this directory is independent. The geography homepage, accepted nine scenes and their cards, canonical Ocean Mother files, and train88 runtime remain unchanged. Removing a trial's entry later would not alter those baselines; no existing entry is changed in R01.

## Verification status

- No generated image substitutes for the implementation.
- Actual new production differences: Hong Kong sea parameter preset, restored standalone controls, state/adapter API and explicit unassembled-map status.
- Interactive real-time 3D indexed mesh and shader rendering are retained.
- Local JavaScript syntax and source-parity checks passed.
- Local Chromium launch was blocked by the execution environment's socket restriction, including the approved escalated retry.
- Official Chromium/Playwright real-browser tests passed on GitHub Actions run 38324337266 for candidate commit dd7d493ad33a7354f20743d3f576d0186b319869. Desktop 1280×800 and mobile viewport 390×844 passed interaction, pause/time, wind/seed, error and source checks; the mobile case is not a physical-phone test.
- Matched 960×600, DPR 1, fine-quality SwiftShader tests measured 1.698 fps with original live weather and 3.598 fps with the fixed background snapshot (2.12× in this run). No repeated sky bakes occurred while ocean time advanced. The run also passed all 15 invalidation, worker-revision, resize and export checks. This is software-renderer evidence, not a hardware performance claim.
- HTTPS deployment verification is pending separately. An HTTP 200 or static syntax check alone is not rendering acceptance.
- Hardware GPU and physical-phone performance are not verified. Browser software-renderer measurements must remain labeled as such.
- Screenshots alone are not a deliverable. Visual acceptance and production readiness remain false.
