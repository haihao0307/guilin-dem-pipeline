# Codex task: continue Kunming V003 stable 3D and real OSM integration

Work only on `project/kunming-dem-v001` and PR #20. Keep the PR open and Draft. Do not merge, force push, rewrite history, modify `main`, or replace the authoritative DEM.

Start by confirming the latest remote HEAD. Use these files as the new stable base:

- `projects/kunming/web/rich-color-v003/index.html`
- GitHub Actions artifact `KUNMING_DEM_3D_WEB_V003_RICH_COLOR_FIX`
- `projects/kunming/web/rich-color-v003/app.js`
- `scripts/generate_kunming_rich_surface_v003.py`

## Immediate goals

1. Confirm `Deploy Kunming rich-color 3D V003` completes successfully.
2. Open the public page in a real Chrome or Edge browser and capture desktop plus 390×844 screenshots.
3. Verify WebGL2 is active, the canvas is genuinely three-dimensional, camera rotate/pan/zoom work, console has zero errors, and fallback mode is not active.
4. Preserve the V003 stable terrain path and rich-color generator.

## Fix real OSM hydrology on top of V003

The previous `kunming-osm-hydrology-v001` page failed with a Float32 binary alignment error. Fix it without reintroducing hand-drawn geometry.

Required binary rules:

- validate HTTP status, MIME type, content length and magic/version header before decoding;
- reject HTML or JSON error bodies masquerading as binary;
- use an explicit binary header with element counts and byte offsets;
- require every Float32 section offset and length to be divisible by 4;
- create typed arrays from validated `ArrayBuffer` slices only;
- record source artifact run, SHA256 and feature counts in the public manifest;
- browser failure must show a clear diagnostic, never a blank white map.

Required data rules:

- modern OSM waterways and water areas only;
- hand-drawn water count stays 0;
- historical verified count stays 0 until dated evidence passes review;
- river centerlines remain fixed, width control changes lateral width only;
- lake shorelines remain fixed, waves change shading only;
- flow animation follows stored downstream direction.

Create a new online directory `kunming-osm-hydrology-v002/`. Do not overwrite V003 or the older V001 page. Stop after browser QA, screenshots, manifest, build report and handoff are committed.
