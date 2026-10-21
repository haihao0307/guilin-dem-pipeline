# 88 authored function-field candidate R03

Eleven locally bounded continuous fields: main fairing, cab shell, tender shell, a separate opaque glass-material candidate, authored footplate and tender lower trim, cab roof cap, front/rear appearance beams, a hollow exhaust outlet silhouette, and a continuous authored coal-bunker surface. The seven added parts are explicitly own exterior design choices, not certified structural/buffer/pipe reconstructions. Shape is evaluated directly in the fragment shader; no teacher geometry, texture, animation or tessellated shape is retained. One shared bounded shader and per-part projected scissor rectangles avoid a monolithic whole-train expression. Full-screen raster proxy triangles are used to invoke the field renderer and are not shape triangles.

Source dimensional baseline: LNER-supplied Silver Link drawing, The Engineer, 27 September 1935, p320: https://theengineer.markallengroup.com/production/2018/09/Gresley-Silver-Jubilee.pdf#page=3

The 10 axle datums, wheel diameters and outer width/height constraints remain separate from authored profile stations. Exterior controls and materials are explicitly design choices, not claimed historical measurements. Wheel-back spacing, flange/tread geometry, bearings, suspension pivots, rods and coupler travel are unresolved and are NOT silently generated. The optional center-plane wheel circles are measurement overlays, not physical wheels.

This is an in-progress exterior/component field candidate, NOT a complete train or accepted design. Original A4, prior versions and production pages are untouched. All screenshots are internal QA evidence. No teacher/model or magazine images are in this folder.

Run via HTTP and open index.html. CPU checks: node --test tests/*.test.mjs. GPU/browser checks: tests/browser.py with --url and --output. GPU checks include 88 CPU/GPU field-value probes, actual editable shape and material pixels, isolation and mobile controls. Renderer timings are measured on the test hardware, not promised production frame rates. The distance estimate is conservative and bounded in this implementation, not claimed an exact signed-distance formula.

The main profile uses shape-preserving C1 cubic Hermite interpolation with shared slopes, rather than resetting the tangent at every station. CPU tests guard both derivative continuity and local envelope non-overshoot.

Five additional primary-table measurement segments are available for independent part inspection: leading/coupled/trailing axle journals and outside/inside crank pins. Their diameter and length are sourced, their local axis is Y, and their assembly transform, shoulder geometry, fits and corner radius remain null. They are nominal circular segments, not complete certified shafts or pins. They do not appear assembled in the locomotive.
