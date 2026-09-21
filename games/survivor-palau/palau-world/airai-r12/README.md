# Stone Money Island / Airai R12 — Reproducible Evidence Runtime

R12 is a takeover stabilization increment for the Stone Money Island / Survivor Palau line. It is a real WebGL2 3D engineering diagnostic and a browser-loadable `PalauWorld.sample()` evidence runtime built from the sealed NOAA ENC / Allen vector evidence that is actually present in the R11 handoff.

It is **not** the accepted full-Palau world, **not** survey truth, and **not** a visual-acceptance candidate.

## What R12 fixes

- Rebuilds a deterministic 25 m, 310 × 310 Airai candidate bathymetry field from the available vector evidence.
- Preserves unsupported cells as NoData beyond 800 m from evidence.
- Keeps NOAA ENC sounding datum as `local datum`; no MSL conversion is asserted.
- Keeps numeric depth unchanged by Allen semantics, user hypotheses, or DEPARE intervals.
- Carries semantic and DEPARE disagreement into uncertainty and support classes.
- Exposes the same evidence through `PalauWorld.sample(lon, lat, t)` with `traditionalLOD=false`.
- Provides a real WebGL2 orbit/zoom workbench with depth, uncertainty, evidence-distance, quality, semantic, and DEPARE views.
- Records that the historical R11 depth raster is absent and cannot be reproduced numerically from the sealed vectors/scripts without drift.

## Run

Open `index.html` directly in a browser, or serve this directory through any static HTTP server. No CDN or network data fetch is required.

## Verify

```bash
python verify_r12.py
node verify_sampler_r12.mjs
xvfb-run -a python qa_browser_r12.py
```

The browser QA requires a WebGL2-capable browser. The included software-renderer evidence is a diagnostic floor, not a claim about production GPU performance. The branch workflow rebuilds runtime arrays from the sealed vector inputs, runs numeric and browser QA, regenerates receipts, and commits the exact derived assets back to the same work branch.

## Current gate state

- `visualAcceptance: false`
- `productionReady: false`
- `publicShareAllowed: false`
- Full-Palau first-view authority recovery: blocked
- Accepted land DEM / numeric land elevation: blocked
- Explicit chart-datum-to-MSL transformation: blocked
- R10 source workbench recovery into Git history: blocked
