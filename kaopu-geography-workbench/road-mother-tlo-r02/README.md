# KAOPU Road Mother TLO R02

Hong Kong road-rule teaching workbench. Not a surveyed location, engineering design, collision certificate or historical road event. R01 is preserved separately.

## Representation
Time → Location (with environment) → Object.Road. Materials, components, damage, repair and access restrictions belong to Road. One Mother generates ordinary road and highway examples from parameters. Highway has a central concrete barrier and hard shoulders, and does not inherit pedestrian or cycle facilities.

All visible shapes are evaluated by original analytic GPU functions. No road/object triangle mesh, no point cloud, no imported assets. A single full-screen triangle is solely the display carrier. Spatial wave/noise functions generate local surface variation; these are not image textures.

## Real geometry versus shading
- Geometry: regional ragged pothole with adjustable depth; 9 mm finite crack depressions; localized kerb chipping; 55 mm drain recess and grate bars; 5 mm raised repair layer; W-beam double corrugation, supports and outward/downward end anchor; concrete barrier profile.
- Shading only: fine aggregate micro-normal and roughness, paint wear, concrete pores, galvanizing. These are not separately collidable stones or deep physical pores.
- Damage is bounded to a small patch. No global cracked-noise overlay.
- Construction closes a segment of the left outer lane in the model. Repair restores passage. These are teaching semantics, not a judgment that a damaged real road is safe.

## Sources and limits
Source facts and precise links are in knowledge.json. Crossfall: TPDM Volume 2, August 2026, 3.4.1.1. Steel and concrete profiles: HyD H2112C / H2101D. Support arrangements: H2117D. End-treatment caution: GN040 supplement. No official PDF artwork is bundled.

The guardrail terminal is a simplified shape-study with unverified clear-zone, flare, anchorage and impact performance. Central barrier extends across the full teaching segment; its cut face is a sample boundary, not a proposed exposed road terminus. All editable sizes are teaching parameters, not compliance validation.

## Use and test
Drag to orbit, wheel/two fingers to zoom, click to inspect. View buttons give whole-road, material, drainage and highway barrier details. Four time phases and two rendering modes share the same model. JSON edits regenerate the scene and semantics.

`node test-model.mjs` checks two families/four phases and access. `browser-qa.mjs` uses official Playwright Chromium, desktop 1440×1000 and mobile viewport 390×844. Render DPR capped at 1.5 and does not drop while rotating. Benchmarks explicitly use synchronous full-frame readPixels after each draw; wall time includes rendering completion and CPU readback overhead (not a pure hardware GPU timer). GitHub Actions SwiftShader is software rendering, not a physical phone or hardware-GPU smoothness claim. Performance reports distinguish submission time from completed-frame/readback measurements. gl.finish alone returned near-zero in Chromium and was rejected as an invalid timing method.
