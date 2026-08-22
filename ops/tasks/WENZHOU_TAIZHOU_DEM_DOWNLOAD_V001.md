# Wenzhou-Taizhou DEM v0.1 land and shallow tidal-band download task

## Branch

`project/wenzhou-taizhou-dem-v001`

## Target

`integration/ecology-v040`

## Fixed scope

The AOI and anchors are stored in `projects/wenzhou-taizhou/config/project_scope_v001.json`.

The project covers the Qingtian county-seat area, Yongjia and the Nanxi River corridor, Daluo Mountain, Dongtou islands, Yuhuan, Yandang Mountain, Jiaojiang, and approximately 15 km north of Jiaojiang.

Historical target for later work:

```text
1940-1945
```

This phase ends after verified land DEM, shallow bathymetry, coastline and source files are downloaded, mosaicked, checked and packaged. Do not build vegetation, agriculture, tide simulation, historical reconstruction or a public candidate site.

## Land DEM source policy

1. Reuse the existing authenticated DEM download framework.
2. Prefer truthful approximately 12.5 m terrain through the established allowed source pipeline when full coverage and licensing permit.
3. Preserve original source products, product IDs, metadata, checksums and licenses.
4. Use an explicitly labeled 30 m fallback only when the preferred source is incomplete or unavailable.
5. Never relabel resampled data as a better native resolution.
6. Do not use Chinese commercial download sites or unverified mirrors.

## Nearshore and tidal-band source policy

1. Download the current official GEBCO grid for the AOI and its TID grid.
2. Preserve the full source subset and its native 15 arc-second resolution label.
3. Create a separate working shallow-bathymetry product for approximately 0 to -10 m where source values support it.
4. Keep values deeper than -10 m in the preserved source and clip or mask them only in the working tidal-band product.
5. Download or derive coastline and intertidal candidate vectors from open, traceable sources.
6. Record vertical datum and source-type uncertainty. GEBCO and reconstructed intertidal products may not be described as local hydrographic survey data.
7. This phase prepares the tidal relationship. It does not simulate tide height, currents, seasonal tide cycles or coastal flooding.

## Required project structure

Create an independent directory under:

```text
projects/wenzhou-taizhou/
```

Add:

- resolved AOI and anchor report;
- land source search and download manifest;
- bathymetry and TID download manifest;
- resumable download scripts;
- original source products;
- SHA-256 checksums;
- land mosaic and reprojection script;
- land COG;
- shallow bathymetry COG;
- coastline and intertidal vectors;
- combined land-sea reference grid with documented seam rules;
- coverage, NoData, overlap and coastline QA;
- land hillshade and bathymetry preview;
- `HANDOFF_WENZHOU_TAIZHOU_DEM_V001.md`.

## Land-sea seam rules

- preserve the land DEM above the coastline;
- preserve source bathymetry below the coastal transition;
- do not create a vertical wall at the shoreline;
- keep a separate coastline and transition mask;
- do not overwrite either source to hide datum differences;
- report gaps, overlaps and datum offsets;
- keep islands and narrow channels topologically connected to the coastline data;
- make the Dongtou and Yuhuan shorelines inspectable in the QA preview.

## QA

Verify:

- every named anchor is inside the AOI;
- the AOI extends at least 15 km north of the Jiaojiang anchor;
- Qingtian county seat, Nanxi River, Yandang Mountain, Yuhuan and Dongtou are covered;
- land source checksums pass;
- bathymetry and TID checksums pass;
- native resolution and vertical-unit labels are retained;
- land COG and shallow bathymetry COG validate;
- source and output extents match the resolved AOI;
- NoData, seam gaps, overlaps and shoreline offsets are measured;
- the working tidal band contains the 0 to -10 m range where available;
- deeper water remains preserved in the source subset but is outside the first-stage working band;
- no tide simulation or deep-ocean modeling is included.

## Stop condition

Stop after the downloads, mosaics, reference grids, manifests, QA, previews and handoff are complete. Do not continue into ecology or browser development.

Submit a draft PR to `integration/ecology-v040`. Do not merge it yourself.
