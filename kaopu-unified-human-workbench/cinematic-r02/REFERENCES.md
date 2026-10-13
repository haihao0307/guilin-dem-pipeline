# Research and source provenance

These references guide principles. No Disney mesh, texture, simulation implementation, film scan or commercial head was imported.

- Disney Research Studios, Fast Dynamic Facial Wrinkles (2024): https://studios.disneyresearch.com/2024/04/26/fast-dynamic-facial-wrinkles/ — compressed wrinkles narrow/deepen, stretched wrinkles broaden/shallow. This paper uses procedural displacement synthesis; our bounded geometric roll construction is not a reproduction or claim of equivalent accuracy.
- Disney Research Studios, Stylize My Wrinkles: Bridging the Gap from Simulation to Reality (2024): https://studios.disneyresearch.com/2024/06/07/stylize-my-wrinkles-bridging-the-gap-from-simulation-to-reality/ — separation of simulation and realistic appearance; no runtime or commercial texture copied.
- Three.js manual, Shadows: https://threejs.org/manual/en/shadows.html — additional scene rendering for shadow lights. R02 uses an optional cached directional key shadow rather than the frozen manual 36-read area-shadow approximation.
- Three.js LightShadow: https://threejs.org/docs/#api/en/lights/shadows/LightShadow — shadow lifetime and update control. Actual implementation uses r170 renderer.shadowMap.autoUpdate=false with explicit invalidation for geometry/light/morph changes.
- Three.js manual, Rendering on Demand: https://threejs.org/manual/pages/rendering-on-demand.html — static editors should not repeatedly render unchanged frames.
- Own frozen hair source: guilin-dem-pipeline@ccf5a1ed9ddde8803e292f1e62d777b141ff52d8/kaopu-hair-workbench/qa/gnm-study/src/app.js. WARM_DIRECTION=(1,.45,.75), COOL_DIRECTION=(-1,.35,.55), WARM_COLOR=#ffb473, COOL_COLOR=#7caaff. Skin energy is rebalanced and source colors are desaturated toward linear white by .58/.48; directions are retained. The original hair's different geometry and shading do not establish identical performance on this character.

Original inherited skin/eye source attributions remain in their existing directories, including eye-materials/THIRD_PARTY.md. No new external portrait, mesh or texture asset is added by R02.
