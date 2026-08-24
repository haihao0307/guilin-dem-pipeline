# Kunming DEM Guilin-skill first-pass handoff

## Delivered

The verified 11-source Kunming COG remains the truth layer. This first pass transfers the Guilin terrain-production structure into a Kunming-specific skill, derives reversible preview fields, and packages an offline browser candidate.

## Truth release

- CRS: EPSG:32648
- pixel spacing: 12.5 m
- bounds: 209000, 2651625, 344500, 2885125
- size: 10840 × 18680
- footprint: 135.5 km × 233.5 km
- area: 31639.25 km²
- valid coverage: 100%
- source DEM count: 11
- truth COG SHA-256: `af95c47f55ab8ff25d33ddc96d07c6d85fc1fcd4c2a2de9e2bef51a015860c50`

The former Cuihu-centered 20,000 km² square is retained only as historical planning evidence. `projects/kunming/aoi/kunming_asf_11tiles_rect.geojson` is now authoritative.

## Skill transfer

The project binds:

- `process-dem-with-gaea` for geospatial preservation, reversible Gaea stages, browser packaging and QA;
- `dem-ecology-surface` for truth, micro-delta and visual-height separation;
- `generate-guilin-dem-fine-regions` for future source-truth gating of detailed cores;
- `projects/kunming/skills/process-kunming-dem-first-pass/SKILL.md` for the current project-specific workflow.

## First candidate

The delivered offline candidate provides:

- terrain;
- elevation;
- slope;
- rock-exposure proxy;
- erosion proxy;
- source-overlap view;
- vertical exaggeration, lighting and visual-strength controls;
- perspective, top view, pan, orbit, zoom, screenshot and fullscreen;
- WebGL2 three-dimensional rendering with an interactive two-dimensional fallback.

The browser package is a review asset. It does not replace the authoritative GIS COG.

## Height policy

```text
z_truth_m       read-only verified COG
z_micro_delta_m reversible future Gaea or visualization increment
z_visual_m      runtime display height
```

The first candidate keeps the authoritative `z_micro_delta_m` at zero. Rock, erosion, moisture and local relief remain separate visualization masks.

## Validation

- the complete 202,491,200-pixel target rectangle has 100% valid coverage;
- NoData gap area is 0 km²;
- the output is a tiled DEFLATE Cloud Optimized GeoTIFF with 2, 4, 8, 16, 32 and 64 overviews;
- the first browser candidate passed mode switching and screenshot-path checks in its interactive fallback;
- browser console errors in the tested route: 0;
- the truth COG was not modified.

## Remaining work

A later phase may add verified hydrology, landform classes, historical land-use constraints, a reviewed Gaea `.terrain` processor, detailed cores, ecology and agriculture. Those layers are outside this first candidate and may not overwrite the truth DEM.
