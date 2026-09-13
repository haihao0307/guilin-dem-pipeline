# Ocean Mother R0199 — field-cache experiment

This is an isolated performance experiment based on R0198 / the frozen R018.11 visual mother. It does **not** replace the frozen visual source.

Scope: activate the pre-existing RGBA32F terrain/shore cache only when `EXT_color_buffer_float` is available. The cache is sampled only during far terrain raymarch steps. Within 3 m of the candidate terrain surface the raymarch returns to the original exact terrain function; final terrain height, normals, shoreline, water, foam, curling waves, materials, fire/smoke and final shading remain on the exact inherited formulas. Cache setup failures fall back to the exact path.

Local gates before GitHub upload: JavaScript syntax PASS, R0198 boot-order test PASS, static source contract PASS, CPU mirror 433 comparable terrain hits / 0 hit mismatches; p99 ray-intersection delta 0.005633 m, worst observed 0.107612 m. These do not prove browser/GPU or visual acceptance.

The GitHub Actions A/B runner reconstructs exact baseline/candidate HTML, fixes world time/camera, captures the six frozen views, records canvas pixel diffs, confirms the candidate cache is actually active, and records a short SwiftShader steady-state run. Pixel differences are measured but are intentionally not converted into visual approval by an arbitrary threshold on the first run.
