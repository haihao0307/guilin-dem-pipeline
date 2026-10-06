<p align="center">
  <img src="brand/kaopu-terrain-production-logo.png" width="96" alt="KAOPU 地形构建生产线标志">
</p>

# KAOPU Geography R17

This publication adds only an isolated geography-workbench directory and its scoped QA workflow. Other hosted projects are untouched.

RME4 Crater remains a separate original entry. Underwater Crater uses the inherited implicit field with inverse-coordinate scaling: X/Z = 2/3, vertical distances = 2, pivot y = 2.1 in the source coordinate system. It is not a replacement blue-hole mesh. Sea height is 3.1 in source units. The shader uses the same original noise and scene() equations, with separate clear-water display and inspection cameras. No unit conversion to surveyed meters is claimed.

Seven entries: Endless Cave, Layered Relief, Cave Passage II, Desert Canyon 2017, RME4 Crater, Underwater Crater, Snow Fractal Ridge. Persistent DOM navigation; only one active render. Drag/zoom and view/ratio controls apply to the new underwater entry. Teacher video does not drive the simulation clock.

The web edition is a lightweight deployment. Reference recordings and experimental replacement textures remain in the conversation's complete companion package. Local video can be opened in the optional reference panel. The canyon loads the original public channel images rather than substitutes.

## Brand mark

The selected terrain-production icon is stored in `brand/` and appears at the front of the overview workbench and as the browser icon. This branding layer does not modify any scene shader, geometry, material, grain, camera path, or interaction logic.

## Sources and rights
- Moon Surface II, Nikos Papadopoulos / 4rknova, 2015, Creative Commons Attribution-NonCommercial-ShareAlike 3.0. https://www.shadertoy.com/view/4tlXzr
- Desert Canyon, Shane. Log-Bisection Tracing by nimitz / stormoid, Creative Commons Attribution-NonCommercial-ShareAlike 3.0. https://www.shadertoy.com/view/Xs33Df and https://www.shadertoy.com/view/4sSXzD
- Desert Passage II: user-provided Image/Common/Cube A source. Includes David Hoskins Hash without Sine, Creative Commons Attribution-ShareAlike 4.0, and attributed IQ, Fabrice, Tomkh, Alex Evans / Dave Smith / Media Molecule techniques retained in the complete source archive.
- RME4 Crater: user-provided source and recording. Original authorship is not transferred to KAOPU by this port.
- Snow Fractal Ridge: David Lovera / Unix, 2015, based on Kali, Creative Commons Attribution-NonCommercial-ShareAlike 3.0.

This is a shader-learning and derived-study workbench; renaming or changing the environment does not remove original license restrictions. Original commented sources are retained in the accompanying package. No commercial authorization is asserted.

## Verification
`qa_public.py` targets the deployed HTTPS page using a real Chromium WebGL2 implementation and records actual render/interaction outcomes. Mobile coverage is an emulated viewport, not physical-phone testing. Results must be read from the workflow artifact, not assumed from the presence of this script.

## Seventh terrain: Endless Cave

BoyC, The Cave (https://www.shadertoy.com/view/MsX3RH), CC BY-NC-SA 3.0 (https://creativecommons.org/licenses/by-nc-sa/3.0/). User-provided shader preserved byte-for-byte at `sources/endless/original.frag`; provenance and exact channel hashes at `sources/endless/provenance.json`. This is an inverse-square potential field traced at fixed steps, not a true SDF or Perlin-noise reconstruction. Camera, light path, field constants, grain, mirrored triplanar samples and original step counts are unchanged. No commercial license is asserted. The private user reference video is not hosted.

## O1: original teacher study correction (historical baseline)

At the O1 baseline, the seven original R17 runnable scenes and runtime remained byte-identical. The independent replacements08/09/10 have been withdrawn from the main catalog and script-loading list; their earlier files remain archived rather than deleted.

At O1, three original-study entries led to the shared, self-authored local-import container at `teacher-original/index.html?case=08`, `?case=09`, and `?case=10`. The public container contains only UI, runtime wrappers, integrity pins, and attribution. It contains no teacher shader body, original texture bytes, original audio, or pre-rendered teacher image. Before import it explicitly states that no original study pack has been loaded. The card icon represents a local file, not a completed render.

The user privately retains exact original HTML/JSON study packs. The browser parses an imported HTML only as data, checks original source bytes, each original texture, dimensions and individual sampler settings, and then compiles the source unchanged inside a uniform/entry wrapper. Imported content stays in browser memory; the container makes no upload/fetch request. Original author rights are not replaced by the container's authorship.

-08: Canyon — Inigo Quilez, https://www.shadertoy.com/view/MdBGzG
-09: Manta Ray v2.0 — dakrunch, https://www.shadertoy.com/view/4ls3zM
-10: Boaty Goes Caving — David Hoskins, https://www.shadertoy.com/view/ldBBDm

Historical O1 import-container checks covered its UI, navigation, invalid-file rejection and no network submission. That container remains the 08 route. The 09 and 10 main-workbench integrations below use bundled original resources and separate actual-render tests; UI-only import-container success is not used as their rendering evidence.

## M09 main-workbench original restoration

Study 09 now follows the same homepage button → `openScene()` → `#liveCanvas` route as the original seven entries. It uses the existing pause, reset, speed, time, resolution and return controls. It does not link to the separate `teacher-original/manta-09.html` runner, does not load the archived independently authored `manta09.js`, and requires no separate import after the page's bundled resource module is available.

Original work: **Manta Ray v2.0**, **dakrunch**, 2015. Original source: https://www.shadertoy.com/view/4ls3zM . The user-supplied shader body remains 12,150 bytes, SHA-256 `679e35942e1285cd4c5c2543896050fa6ab2326f73495d1e44be203435118c78`. Original texture bytes are embedded in `manta-original09.js`; no official-site download, replacement texture, audio input, or channel 2 is added. Channels 0/1/3 retain mipmap/repeat/vflip=false/sRGB=false, and the RGBA noise is decoded without alpha premultiplication.

Shader-license evidence: the [NVIDIA-derived MantaRay file](https://github.com/tovacinni/sdf-explorer/blob/c8b1b39796d18d2ad3e7442639ef51bf986eb187/data-files/sdf/Animal/MantaRay.glsl#L1-L12) and [JCGT dataset paper](https://jcgt.org/published/0011/02/01/paper.pdf) identify dakrunch's work with [CC BY-NC-SA 3.0](https://creativecommons.org/licenses/by-nc-sa/3.0/). The complete [v2.0 API archive](https://github.com/GabeRundlett/shadertoy-api-shaders/blob/f6d538adf936215ccf2d11ba9b4a6c79ccb448c5/shaders/4ls3zM.json) matches the user source after line-ending normalization; this is archival provenance, not a fresh confirmation from the author's live page. Original channel files were supplied for this requested study; this integration does not claim a separate asset license or original ownership of the teacher shader/textures.

KAOPU changes are limited to the integration wrapper, source/image integrity verification, original-app resource binding, per-case GPU pacing and controls. The original shader body, camera, light, colors, tail and texture bytes are not rewritten. Manta's virtual coordinates remain 1200×674 at every sampling density; default sampling is 480 wide, original time speed is 1×. Other scene shaders, assets, settings and the 08/10 entries remain unchanged.

Verification must distinguish actual main-app browser rendering from byte/static tests and native EGL comparison. The updated browser test clicks the original homepage 09 button, captures actual frames, and checks pause/seek/speed/reset/back/reopen on the shared canvas. Its completion must be read from the resulting test report; its existence is not a pass. Physical-phone acceptance is separate.


M09 publication verification (2026-10-06): production commit `d1d00fec8aa46d86cf911384de90be25a0c891fc`, [public dual-browser run 37429914807](https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/37429914807) passed Chromium and WebKit, 18 original09 checks per engine, plus 60 main-workbench regression checks and 2 catalog checks in Chromium. Desktop and mobile viewports were exercised; no physical-phone test is claimed.

## S10 original sea-exploration boat in the main workbench

Study 10 follows the existing homepage button → `openScene()` → `#liveCanvas` path and shares the existing pause, time, speed, resolution, reset and return controls. No separate file selection is needed. The archived independently authored `submarine10.js` remains unused. Original01–09 scene resources and the08 card remain unchanged.

Original work: **[SH17B] Boaty Goes Caving**, **David Hoskins / Dave_Hoskins**, https://www.shadertoy.com/view/ldBBDm . The [matching API source archive](https://github.com/GabeRundlett/shadertoy-api-shaders/blob/f6d538adf936215ccf2d11ba9b4a6c79ccb448c5/shaders/ldBBDm.json) explicitly attributes the shader to David Hoskins under [CC BY-NC-SA 3.0 Unported](https://creativecommons.org/licenses/by-nc-sa/3.0/). The user-supplied shader body matches the archived body after line-ending normalization; its supplied bytes are retained exactly in `submarine-original10.js`: 16,497 bytes, SHA-256 `571642c54667eb5a015a535172e988e0e59a7f37ab807546f7dc0e35e7440bf3`. Shader authorship and this license are retained; the integration wrapper is by KAOPU. No commercial rights are asserted.

All three original images were supplied by the user for this study. Channel0: 87,562 bytes, SHA-256 `81c28c65b034a4cd924f4254d82d7fe1ba451c8a7c735dc9da73ee782bd885ac`; channel2: 112,578 bytes, `1eae2aea7054b1aeaeb0d4f6f3bda7ec4f1c84ae24f1d08cd534fcbd0f96ec78`; channel3: 264,082 bytes, `e59217a8eecc2e90bfbe7bb163dfcdd90de155bb35e4e904484ede91b8c0f36d`. The original paths and sampler configurations are recorded in the resource module and independently match the archive. Channels0/2 use mipmaps and vertical flip; channel3 is linear and unflipped. All use repeat, byte data and no sRGB conversion or alpha premultiplication. The wrapper does not claim original ownership or a separate texture license. No official-site download or replacement image is used.

The original visual shader never reads music channel1; its only occurrence is commented out. Audio is not added. Original geometry, map side effects, the macro `F`, floaty particles, constants, lighting, camera and original four-second fade from black are unchanged. Default original time is0 at1×; sampling defaults to480×270 while virtual coordinates stay960×540. Original mouse X scrubs the route via `iMouse`; pointer input is normalized into those original coordinates, and reset clears the original mouse as well as time. It does not introduce a free-orbit camera.

Local verification checks the actual main-app selected shader and quad draw against the recovered original in native EGL at0/4/20seconds: all three pixel buffers match exactly. This is additional byte/pixel evidence, not browser acceptance. Browser tests start by clicking the original homepage10 card and exercise frames, mouse/touch route input, pause, time, speed, resolution, reset, return/reopen, interrupted10→09 navigation and preserved09/old-seven behavior. The corresponding Actions report is the browser acceptance record; physical-phone validation remains separate.
