# Weather Mother

Start this production line at `weather-mother/index.html` on the existing `gh-pages` branch.

Public entry: https://haihao0307.github.io/guilin-dem-pipeline/weather-mother/

Current candidate: **V0.5.1**. The user's upgrade from Cloud Mother to Weather Mother is authoritative. Cloud generation and atmospheric lighting are subsystems of this weather production line. The rejected Cloud Mother V0.3.2 is not a production baseline or a new deliverable.

Read `HANDOFF.json`, `PUBLICATION_RECEIPT.json` and `qa-v051.json` when present. Resolve current source commits through GitHub file history before resuming work. An absent QA file means verification is pending; it never means passed. Public HTTP verification, automatic browser verification and human visual approval are distinct.

The runtime consists of `index.html`, `engine.js` and `cloud.glsl`. It stores no cloud photographs, image texture files, HDR environment files or imported cloud meshes. Scalar density and noise buffers are generated in a worker at runtime. Browser test images are processed in memory only; only numerical and textual evidence is retained.

The default visual review scene is a group of daylight cumulus clouds. Review the same clouds under dawn, noon, dusk and moonlight. Retain independent density, cloud count, seeded generation, wind speed and meteorological wind-from direction controls. Ten cloud genera and eight illustrative weather cases remain in one workbench.

The implementation uses a finite local volume, empty-margin validation, merged cloud-group ray intervals, midpoint integration, approximate cloud self-shadow and multiple scattering, and alpha-aware spatial reconstruction. It does not yet implement infinite-world weather streaming, real-time observed weather ingestion, a full fluid solver or temporal reprojection. Terrain updraft and aircraft wake are explicitly graphical approximations. Rain and snow are screen-space approximations. Rainbow optics are a fast angular approximation.

Do not claim AAA quality, real-world meteorological accuracy, full terrain/aircraft fluid coupling or measured user-device performance. `visualAcceptance` and `productionReady` remain false until the required review.

Do not modify unrelated DEM truth assets, other project entry pages, `main`, or GitHub Pages settings as part of weather work. Preserve this stable online entry and record actual changes rather than reintroducing an older Cloud Mother page.
