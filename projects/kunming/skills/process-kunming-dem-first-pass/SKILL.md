---
name: process-kunming-dem-first-pass
description: Apply the Guilin DEM production skills to the verified 11-tile Kunming ASF mosaic, preserve the truth COG, build reversible terrain-visualization fields, and package a browser review candidate with source lineage, QA, and rollback.
---

# Process Kunming DEM first pass

## Skill dependencies

This project-specific skill binds three GitHub skill families into the Kunming project:

1. `process-dem-with-gaea`
   Preserves CRS, transform, NoData, elevation range and physical scale; separates the truth raster from Gaea or browser visualization outputs; packages browser-sized terrain assets and retains reproducible manifests.
2. `dem-ecology-surface`
   Separates `z_truth_m`, reversible `z_micro_delta_m`, and runtime `z_visual_m`; keeps hydrology, rock, vegetation and agriculture constraints layered and reversible.
3. `generate-guilin-dem-fine-regions`
   Supplies the source-truth gate for future detailed cores. Resampling, Gaea detail and procedural enhancement may not be relabeled as measured high-resolution terrain.

## Fixed source release

The current truth source is the verified 11-raster Kunming mosaic:

```text
KUNMING_ASF_11TILES_RECT_12P5M_COG.tif
```

Contract:

```text
CRS: EPSG:32648
pixel spacing: 12.5 m
projected bounds: 209000, 2651625, 344500, 2885125
width: 135500 m
height: 233500 m
area: 31639.25 km²
grid: 10840 × 18680
valid coverage: 100%
NoData gap area: 0 km²
truth SHA-256: af95c47f55ab8ff25d33ddc96d07c6d85fc1fcd4c2a2de9e2bef51a015860c50
```

The earlier Cuihu-centered 20,000 km² square remains historical planning evidence. It is no longer the authoritative production clip.

## Height separation

Keep these concepts separate:

```text
z_truth_m
read-only values from the verified COG

z_micro_delta_m
reversible visual or future Gaea increments

z_visual_m
browser display height derived from z_truth_m plus approved visual increments
```

The first-pass candidate keeps `z_micro_delta_m = 0` for the authoritative raster. Rock, erosion, moisture and local-relief fields are visualization masks only.

## First-pass workflow

1. Preflight the COG and verify CRS, dimensions, transform, bounds, pixel spacing, NoData and checksum.
2. Read a browser-resolution elevation grid without changing the source file.
3. Derive reversible visualization fields:
   - slope;
   - convexity and concavity;
   - local and macro relief;
   - rock-exposure proxy;
   - erosion proxy;
   - valley and moisture proxy;
   - source-overlap count.
4. Encode height into a browser-safe 16-bit R/G texture.
5. Package terrain, elevation, slope, rock, erosion and source-overlap modes.
6. Provide WebGL2 3D rendering and an interactive 2D fallback.
7. Write a manifest and file-based QA report.
8. Preserve the original COG and all source lineage outside the web package.

## Browser candidate

The candidate exposes:

```text
terrain
elevation
slope
rock exposure
erosion preview
source overlap
vertical exaggeration
rock strength
erosion strength
light direction
perspective and top views
pan, orbit, zoom, screenshot and fullscreen
```

The browser mesh is a review asset. It is not the authoritative GIS raster.

## Future Gaea route

A later Gaea build must follow the shared `process-dem-with-gaea` skill:

1. run DEM preflight;
2. preserve a 32-bit working heightfield and validity mask;
3. use a reviewed `.terrain` graph with a small variable allowlist;
4. preserve the untouched DEM branch;
5. keep repair, macro erosion, fine erosion, surface detail and outputs as separate graph stages;
6. restore and verify the geospatial transform after export;
7. compare source and result through difference, slope, hillshade, drainage and control-point QA;
8. publish only after browser and GIS gates pass.

## Guardrails

- Do not rewrite the truth COG for visual relief.
- Do not label derived rock, erosion or moisture masks as surveyed data.
- Do not use 30 m fallback terrain in this project release.
- Do not describe browser resampling as improved source resolution.
- Do not define future 1 m or sub-12.5 m cores until qualifying real source data is verified.
- Keep every candidate versioned and reversible.
