# Kunming V004 Yunnan color and real OSM hydrology QA

Work only on `project/kunming-dem-v001` and PR #20. Keep the PR open and Draft. Do not merge, force push, rewrite history, modify `main`, overwrite V003, or modify the authoritative uncompressed DEM.

## Stable inputs

- V003 terrain base: `projects/kunming/web/rich-color-v003/`
- V004 source: `projects/kunming/web/yunnan-hydrology-v004/`
- V004 builder: `scripts/build_kunming_yunnan_hydrology_v004.py`
- OSM knowledge artifact run: `32925496927`
- authoritative crop SHA: `9f672e16714d98b7bc7f002826cdf788379bcb54db84227a21f53539b083f3a2`

## Required outcome

1. `kunming-yunnan-hydrology-v004/` opens as real WebGL2 3D in desktop and 390×844 mobile browser tests.
2. No total-view, top-view, north-view or other camera preset buttons are present. Camera remains directly controllable by rotate, pan and zoom.
3. Yunnan surface colors remain deterministic and use elevation, slope, aspect, local relief, regional relief, valley moisture and hillshade. No random texture noise may be added.
4. Modern OSM waterways and water areas come only from the accepted hydrology artifact. Hand-drawn water count remains 0.
5. River centerlines and lake shorelines remain fixed. River width changes laterally only. Flow animation follows the stored OSM downstream direction. Lake waves alter shading only.
6. The old Float32 binary path is prohibited. V004 uses the validated PNG hydrology knowledge field and must not request `.f32` assets.
7. Public screenshots, browser QA, manifest, build report and package artifact must exist before claiming visual completion.

## Review focus

Visually inspect whether the palette resembles Yunnan mountain terrain at regional scale: moist green valleys, yellow-green plateau surfaces, dry-season ochre, red-earth slopes, brown exposed rock, grey stone and pale high ridges. Reduce neon green, uniform tan and harsh white clipping. Preserve fine mountain relief at normal vertical scale 1.0×.
