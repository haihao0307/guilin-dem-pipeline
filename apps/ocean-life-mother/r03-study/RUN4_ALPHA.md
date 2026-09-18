# Ocean Life Mother R03.A run4 — source-alpha rendering correction

Date: 2026-09-19. This run continues `work/ocean-life-mother-r00-20260918` after run3. It does not replace R00/R01/R02, Game Mother, other Mothers, or any accepted production baseline.

## Actual increment

The study runtime no longer collapses every source alpha value above `0.13` to a fully opaque fragment. That behavior contradicted the retained FISH-REF-001 alpha field and the source material's `alphaMode=BLEND` semantics.

A shared `src/alpha-policy.js` now classifies source alpha into three explicit display classes:

- alpha < 0.015: discard for this study renderer;
- 0.015 <= alpha < 0.985: translucent pass;
- alpha >= 0.985: opaque pass.

The opaque pass writes depth with blending disabled. The translucent pass uses standard source-alpha blending with depth writes disabled but depth testing retained, then restores GL state. `study-runtime.js` now returns the policy limits and explicitly states `orderIndependent=false` and `refractive=false`. `tools/build.py` includes the policy before the runtime.

This removes one concrete falsehood in the preview: a 50%-alpha fin sample is no longer displayed as fully opaque simply because it exceeded a coarse cutout threshold.

## Executed verification

`tools/alpha_blend_browser_qa.py` was executed under Xvfb with Chromium/SwiftShader at 1280x900 and 390x844. With a blue background and red synthetic surfels, measured RGBA pixels were:

- alpha 1.0 -> `[255, 0, 0, 255]`;
- alpha 0.5 -> `[128, 0, 128, 255]`;
- alpha 0.005 -> `[0, 0, 255, 255]`.

The test also confirmed depth writes were restored, blending was disabled after the translucent pass, the classifications were `opaque / translucent / discard`, and WebGL error was zero in both layouts. Receipt: `qa/ALPHA_BLEND_R03A_RUN4.json`.

A second test, `tools/alpha_runtime_browser_qa.py`, executed the actual updated `study-runtime.js` shader/state path with three synthetic surfels at both layouts. It recorded zero page errors, zero WebGL errors, no horizontal overflow, no source-face runtime payload, and the expected non-order-independent/non-refractive policy. Receipt: `qa/ALPHA_RUNTIME_BROWSER_R03A_RUN4.json`.

These tests are real browser executions of the new display path, but they are not a FISH-REF-001 source replay.

## Source replay status

The exact reference file was not readable in the current runtime. `/mnt/data` contains only the prior Ocean R02 generated artifacts. Files/Library search and recent Library browsing did not resolve `model_67a_-_largemouth_bass.glb` to a usable file reference in this run. The source-derived coefficient payload from the original R03.A fit is likewise not mounted here.

Therefore this run does NOT claim that the actual black-bass fins are now visually correct, that the source alpha distribution was re-measured, or that close-range mouth/fin errors improved. It changes the shared renderer so that already-distilled alpha is no longer knowingly destroyed at display time.

## Important limit

Standard source-alpha blending is still draw-order dependent when translucent surfels overlap. The current update does not implement sorting, weighted blended OIT, refraction, subsurface transport, temporal anti-aliasing, or a biologically calibrated fin optics model. A function representation does not remove this visibility/compositing problem. The correct next decision must be driven by real FISH-REF-001 translucent regions and target mobile cost, not by adding a more complicated transparency method without evidence.

## Next bounded task

If the exact source or original coefficient payload becomes readable, replay the real fish with runs 2–4 and measure the source alpha histogram by semantic patch, the number and screen area of translucent fin samples, overlap depth complexity, and close-range edge error. That evidence distinguishes three cases: simple source-alpha blending is sufficient; sorting/coverage treatment is necessary; or the current surfel display itself is the limiting representation.

If source bytes remain unavailable, do not fabricate a black-bass fidelity result. The next source-independent kernel task may continue anatomical-coordinate/interface work only where it can be verified synthetically and where it does not silently invent jaw/gill/growth evidence.

`visualAcceptance=false`; `materialFidelityAcceptance=false`; `anatomicalAcceptance=false`; `motionAcceptance=false`; `productionReady=false`; `shareAllowed=false`.
