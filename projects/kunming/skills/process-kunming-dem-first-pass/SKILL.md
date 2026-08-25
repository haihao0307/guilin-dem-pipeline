---
name: process-kunming-dem-first-pass
description: Apply the Guilin DEM production skills to the verified Kunming ASF mosaic while preserving an uncompressed, pixel-exact 12.5 m float32 authority raster and keeping every preview or procedural field separate and reversible.
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

The verified source is:

```text
KUNMING_ASF_11TILES_RECT_12P5M_COG.tif
```

Source contract:

```text
CRS: EPSG:32648
pixel spacing: 12.5 m × 12.5 m
dtype: float32
projected bounds: 209000, 2651625, 344500, 2885125
width: 135500 m
height: 233500 m
area: 31639.25 km²
grid: 10840 × 18680
valid coverage: 100%
NoData gap area: 0 km²
truth SHA-256: af95c47f55ab8ff25d33ddc96d07c6d85fc1fcd4c2a2de9e2bef51a015860c50
```

The output grid spacing is independently verified:

```text
135500 m / 10840 pixels = 12.5 m
233500 m / 18680 pixels = 12.5 m
```

This confirms a 12.5 m output-pixel grid. Keep `native12_5mSurveyClaim=false` unless qualifying source documentation separately establishes a native survey claim.

## Clean reset crop

The new working scope is the exact source-aligned crop:

```text
window: col_off=2790, row_off=5116, width=5892, height=8095
bounds: 243875.0, 2719987.5, 317525.0, 2821175.0
size: 73.650 km × 101.1875 km
area: 7452.459375 km²
```

The authority output must be named:

```text
KUNMING_BASELINE_RESET_CROP_12P5M_FLOAT32_UNCOMPRESSED.tif
```

## Mandatory no-compression rule

The authoritative DEM working master must always satisfy:

```text
dtype = float32
compression = NONE
internal overviews = none
resampling = none
pixel spacing = 12.5 m × 12.5 m
pixel values = exact source-window values
```

Rules:

1. Do not use DEFLATE, LZW, ZSTD, JPEG, WEBP or any other compression on the authority master.
2. Do not create internal pyramid levels or overviews in the authority master.
3. Do not resample, smooth, quantize, normalize or reduce the master grid.
4. Record the raw source-window pixel-array SHA-256 and output pixel-array SHA-256.
5. Require those two pixel-array hashes to match.
6. Require pixel-by-pixel equality, including NaN and NoData placement.
7. Keep every web image, PNG, JPEG, mesh, overview and preview asset outside the authority chain.
8. Never use a preview asset as the source for GAEA, hydrology, terrain derivatives or later production.

The uploaded QA records the original COG with lossless DEFLATE compression. Its float32 values remain intact. The stricter Kunming production rule still requires the new cropped authority master to be stored completely uncompressed.

## Height separation

Keep these concepts separate:

```text
z_truth_m
read-only values from the verified uncompressed master

z_micro_delta_m
reversible visual or future Gaea increments

z_visual_m
browser display height derived from z_truth_m plus approved visual increments
```

At clean restart, keep `z_micro_delta_m = 0`. Do not inherit the previous synthetic water, lake, rock, debris, erosion, contour, vertical-exaggeration or low-resolution browser work.

## Clean first-pass workflow

1. Verify source file SHA-256, CRS, dimensions, transform, bounds, pixel spacing, dtype and NoData.
2. Crop by the exact integer source window without resampling.
3. Write an uncompressed tiled float32 GeoTIFF with no overviews.
4. Reopen the output and verify compression, dtype, grid, bounds and resolution.
5. Compare source-window and output pixel arrays through SHA-256 and exact equality.
6. Record coverage and elevation statistics.
7. Freeze the resulting uncompressed crop as the new authority master.
8. Stop before hydrology, GAEA, 1 m visual sequencing, surface detail or browser production.

## Later browser candidates

Browser assets may be produced only after the uncompressed authority master passes every gate. Browser textures and meshes are review assets. They must carry explicit derivative labels and may never replace the GIS raster.

## Future Gaea route

A later Gaea build must follow the shared `process-dem-with-gaea` skill:

1. read the uncompressed float32 authority master;
2. preserve the untouched `z_truth_m` branch;
3. use a reviewed `.terrain` graph with a small variable allowlist;
4. keep repair, macro erosion, fine erosion, surface detail and outputs as separate graph stages;
5. restore and verify the geospatial transform after export;
6. compare source and result through difference, slope, hillshade, drainage and control-point QA;
7. retain the uncompressed authority master independently from all Gaea results;
8. publish only after browser and GIS gates pass.

## Guardrails

- Do not rewrite or compress the authority master.
- Do not build internal overviews into the authority master.
- Do not label derived rock, erosion, moisture or hydrology masks as surveyed data.
- Do not use 30 m fallback terrain in this project release.
- Do not describe browser resampling as improved source resolution.
- Do not define future 1 m or sub-12.5 m cores until qualifying real source data is verified.
- Keep every candidate versioned and reversible.
