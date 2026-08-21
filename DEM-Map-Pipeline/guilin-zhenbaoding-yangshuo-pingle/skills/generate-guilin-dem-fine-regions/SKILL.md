---
name: generate-guilin-dem-fine-regions
description: Plan, validate, crop, and package real high-resolution DEM focus regions around Zhenbao Ding, the former Yangtang airfield, and Yangshuo county seat for the Guilin DEM production line. Use when requests mention these three 200 km2 fine regions, 1 m terrain, Guilin DEM detail layers, or Guilin_DEM_Full_Local_GitHub_Ready_v2.0.0. Do not use to upsample coarse DEMs or invent survey accuracy.
---

# Generate Guilin DEM fine regions

Build three square focus regions centered on:

- 真宝鼎: 110.82528 E, 26.13556 N
- 秧塘机场旧址: 110.15569 E, 25.21753 N
- 阳朔县城: 110.4920133 E, 24.7815129 N

Each region targets 200 km². Use EPSG:32649 and a square side of 14,142.135624 m.

## Source truth gate

Treat `1 m` as source-ground resolution, not output pixel spacing. Before producing a 1 m package:

1. Inspect the DEM, acquisition/product metadata, surface semantics, CRS, horizontal and vertical units/datums, transform, NoData, bounds, native resolution, and license.
2. Require a documented real source with estimated ground sample distance no worse than 1.0 m and complete coverage of the requested region.
3. Reject 30 m Mapzen/SRTM, 12.5 m ASF reference DEM, synthetic terrain, Gaea detail, AI output, and interpolated rasters as 1 m sources. Never relabel resampling or procedural enhancement as measured accuracy.
4. Preserve the source and write new outputs. Keep the authoritative raster separate from browser LOD assets.

If no qualifying source exists, generate the region plan only and report `awaiting_real_1m_source`. Continue using the current truthful base DEM on the website.

## Workflow

Use `scripts/build_fine_regions.py --plan-only --report <path>` to generate the three-region contract. With a qualifying raster, run it with `--source <dem> --output-dir <dir> --report <path>`.

The script fails closed on coarse inputs, incomplete coverage, missing CRS, or non-metric resolution. For every accepted region, preserve bounds, CRS, 1 m grid, NoData, source hash, coverage fraction, and output hash.

For `Guilin_DEM_Full_Local_GitHub_Ready_v2.0.0`, store the plan under the project metadata directory and publish a focus-region package only after raster QA. Use tiled LOD in the browser; do not render a 200-million-sample region as one mesh.

Vertical scale 1.0 must map one horizontal metre to one vertical metre. Artistic erosion, sharpening, or Gaea surface detail must remain a separately named visualization layer and must not modify the authoritative 1 m claim.
