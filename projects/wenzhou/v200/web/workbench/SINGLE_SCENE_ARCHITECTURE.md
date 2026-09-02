# Wenzhou single-scene Weather adapter V0.3

## Active build path

`assemble.py` builds the complete Wenzhou numerical overview directly into the publication root and then installs:

* `terrain-index.html` as public `index.html`
* `terrain-runtime.js` as public `runtime.js`
* `terrain-shaders.js` as public `shaders.js`
* `weather-scene.mjs` as the Wenzhou Weather adapter
* the exact Weather Mother V1.1.0 package under `modules/weather-mother/`

The public build contains one canvas, one camera, one WebGL2 renderer and zero iframe elements. Terrain, sea, rivers and volumetric weather use the same Wenzhou metre coordinates and the same depth buffer.

## Preserved legacy checkpoint source

The older `index.html`, `workbench.js`, `weather-bridge.mjs` and `bridge.test.mjs` files remain in this folder only as source evidence for the previously published hidden Weather iframe checkpoint. The V0.3 build does not copy or execute them.

## Weather source boundary

`modules/weather-mother/field-worker.js` remains byte-identical to Weather Mother V1.1.0. It produces the scalar cloud density volume. `weather-scene.mjs` is a Wenzhou-only adapter that performs the declared kilometre-to-metre conversion, uploads the result to the main WebGL2 context and renders the cloud, rain and fog candidates.

## Current evidence status

Local package identity, source hashes, assembly and JavaScript syntax checks pass. Actual Chromium checks are produced by `.github/workflows/wenzhou-weather-workbench.yml` before and after public publication.

The current build remains a research preview. Full native 12.5 metre LOD, scientific weather calibration, bathymetry, absolute tide datum, physical target-machine verification, user visual approval and production approval remain open.
