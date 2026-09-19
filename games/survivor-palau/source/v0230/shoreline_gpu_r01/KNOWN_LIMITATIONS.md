# SMI shoreline GPU bed parity R01 — known limitations

Status: executable adapter + source-contract tests + WebGL2 parity probe pass; **full scene integration and visual acceptance remain false**.

- This slice corrects only the bathymetry read used by the local `waveSurface` consumer. It does not replace the global legacy `bedH`, create a new shoreline, recolor foam, or change the frozen deep-ocean/cloud source.
- The generated GLSL constants and blend weights come from the current authoritative `../shoreline_profile.cjs` (`SMI_WAKE_BAY_R01`). The legacy fixture is a pinned representation of the current V0.2.3.0 default bed expressions used for parity tests; it must be reread if those upstream expressions or defaults change.
- The WebGL2 test executes the adapter in Chromium through ANGLE/SwiftShader under Xvfb. It proves shader compilation/execution and CPU/GPU numerical parity within the recorded thresholds; it is not a physical GPU, iPhone, performance, or production-render acceptance test.
- The actual V0.2.3.0 release HTML was not modified. The reversible patch utility targets the single `waveSurface` legacy bed read and is intentionally not applied to the production entry in this branch.
- No full-scene desktop or 390×844 A/B capture is claimed in this run. Direct container access to `github.com` failed DNS resolution, while the GitHub connector could read source but did not mount the oversized release HTML into the browser runtime. The compact parity harness therefore ran independently of the complete scene.
- Passing bed parity does not prove final swash, wet-sand memory, foam transport, breaker timing, water optics, or final beach appearance. The current release still has `visualAcceptance=false`, `physicalDeviceTest=false`, and `productionReady=false` until the adapter is integrated into a candidate build and the fixed views are rerun.
- After bed integration, if the detached white sheet remains, the next smallest suspect is the foam/breaker path's legacy `smiShoreDistance` and legacy shoreline-distance bands. That must be verified in the integrated scene before any further change; this R01 does not pre-emptively rewrite them.
- The mean-water contact threshold remains `<= 0.05 m`. This slice records numerical contact parity in the standalone WebGL probe only; it does not claim the complete renderer meets the visual contact gate.
- No public URL, merge, release, swash completion, or user acceptance is claimed.
