# 小温州 · 三维地形 R3

Buildless static Three.js viewer at `/r3/`. The published folder is `dist`; no server, external API or runtime data upload is required. Three.js 0.186.0 is vendored from the official npm archive and pinned by SHA-512/SHA-256 in `DEPENDENCIES.lock.json`. No package installation scripts were executed.

The source-indexed measurement packets and masks in `dist/r3/data` are persistent input evidence. Rendering creates positions, normals and triangle indices in memory and disposes them when switching regions. `terrain.json` defines the canonical original-grid bilinear surface separately from its display approximations and physical uncertainties.

The full R3 workspace contains the new `tools/prepare_dem.py` and `tools/validate_surface.py`, their source mirrors here, the locked original R1 input paths, and verification results under `docs`. Run preparation then validation in that full workspace to reproduce numerical packets. The temporary 708MB decoded source array stays outside this Site checkout. Copies of the scripts here resolve their parent R3 workspace; the original locked R1 data must remain available. No historical renderer, asset production skill, or recovery executable is needed or imported.

Validation includes all 1219 encoded tile hashes, the recovered full-grid hash, 336 valid zero heights, coordinate and surface identities, all 12 query locations, and exhaustive retained-domain display approximation bounds. Those checks establish numerical correspondence only; they do not establish physical measurement accuracy or an unknown vertical datum. Real browser interaction and public-delivery checks are recorded separately in the parent R3 workspace after deployment.

R2, R2.1 and R2.2 remain separate fixed historical deliveries. Do not overwrite a released R3 page to publish a later version; add a new explicit version path and retain its source and measurement locks.
