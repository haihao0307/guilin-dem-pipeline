# Kunming V004 visual review and next refinement

Continue only on `project/kunming-dem-v001` and PR #20. Keep the PR open and Draft. Do not merge, force push, rewrite history, modify `main`, overwrite V003, or modify the authoritative uncompressed DEM.

Review the public page at:

`https://haihao0307.github.io/guilin-dem-pipeline/kunming-yunnan-hydrology-v004/`

## Review requirements

1. Confirm real WebGL2 3D, direct mouse rotate/pan/zoom, and zero console errors.
2. Confirm no total-view, top-view, north-view or other camera preset controls exist.
3. Confirm the water layer is generated exclusively from the accepted modern OSM artifact, with hand-drawn water count 0 and historical accepted truth count 0.
4. Confirm rivers stay on fixed centerlines, width changes laterally only, lakes keep fixed shorelines, river animation follows stored downstream direction, and lake waves alter shading only.
5. Tune the deterministic Yunnan palette only when visual evidence supports it. Preserve moist green valleys, yellow-green plateau surfaces, dry-season ochre, red-earth slopes, brown exposed rock, grey stone and pale high ridges. Avoid neon green, flat tan, hard white clipping and high-frequency random noise.
6. Preserve natural vertical scale 1.0× and the frozen 12.5 m DEM identity.
7. Commit desktop and 390×844 browser screenshots, console report, FPS samples and a concise visual review. Stop after visual refinement and QA.
