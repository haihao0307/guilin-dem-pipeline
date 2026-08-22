---
name: generate-guilin-dem-fine-regions
description: Plan, validate, crop, package, and publish four fixed 100 km2 Guilin focus regions around Zhenbao Ding, Guilin Old City, the former Yangtang airfield, and Yangshuo county seat. Use for the Guilin overall map and its four 10 km by 10 km detailed cores. Do not re-ask the user for the four locations. Do not upsample coarse DEMs or invent survey accuracy.
---

# Generate Guilin DEM fine regions

Build four fixed square focus regions centered on:

- 真宝鼎: 110.82528 E, 26.13556 N
- 桂林古城, 靖江王城 anchor: 110.29455 E, 25.28450 N
- 秧塘机场旧址: 110.15569 E, 25.21753 N
- 阳朔县城: 110.4920133 E, 24.7815129 N

These locations are locked project inputs and must not be requested from the user again.

Each region is exactly 10,000 m by 10,000 m and covers 100 km². Use EPSG:32649. Project each WGS84 center, subtract and add 5,000 m in X and Y, and store the exact projected bounds in the release manifest.

The four detailed cores sit inside one overall Guilin map that continues to cover the established Zhenbao Ding, Guilin, Yangtang, Yangshuo, and Pingle direction. Missing source tiles must be downloaded or reported. The overall AOI may not be reduced to avoid missing coverage.

## Historical and seasonal contract

The project represents the 1940-1945 interval. Store epoch and season separately.

```text
epoch: 1940-1945
season: spring, summer, autumn, winter
```

Season may alter vegetation palette, crop stage, field-water state, river level, wetness, atmosphere, and wind profile. Season may not relocate stable terrain, rivers, roads, fields, or trees.

## Source truth gate

Treat a claimed source resolution as native ground resolution, not output pixel spacing. Before producing any high-resolution package:

1. Inspect the DEM, acquisition and product metadata, surface semantics, CRS, horizontal and vertical units and datums, transform, NoData, bounds, native resolution, and license.
2. Require a documented real source for every accuracy claim.
3. Reject 30 m Mapzen or SRTM, 12.5 m ASF reference DEM, synthetic terrain, Gaea detail, AI output, and interpolated rasters as 1 m sources. Never relabel resampling or procedural enhancement as measured accuracy.
4. Preserve the source and write new outputs. Keep the authoritative raster separate from browser detail assets.
5. If no qualifying source exists, publish a truthful core plan and continue using the best verified base DEM. Mark programmatic or historical enhancement explicitly.

## Four-core workflow

1. Read `projects/guilin/config/core_regions_v050.json`.
2. Project each fixed center into EPSG:32649.
3. Derive a 10 km square and validate side length, area, center containment, and overall-AOI containment.
4. Resolve source coverage independently for each core.
5. Preserve source rasters and source checksums.
6. Build tiled core terrain, water, landform, hard-exclusion, ecology, agriculture, wind, season, and browser assets.
7. Use stable global projected coordinates so water, canopy, crop rows, orchard rows, wind phase, and Parallax Strand Surface do not restart at core or tile edges.
8. Publish one overall map with visible labels and smooth entry into each core.

## Core-specific priorities

### 真宝鼎

High-relief terrain, source completion, ridges, exposed rock, erosion, streams, conifers, broadleaf forest, sparse rock shrubs, and seasonal mountain response.

### 桂林古城

Li River relationship, old-city anchor, nearby hills, urban hard exclusions, historical-road and land-use placeholders with evidence status, and city-edge agriculture.

### 秧塘机场旧址

Historical airfield terrain, runway protection and flatness, drainage, surrounding karst hills, farmland, villages, and the existing historical-enhancement module inside the 100 km² core.

### 阳朔县城

Li River continuity, karst peaks, county-seat terrain, rice, vegetables, orchards, bamboo, roads, and transition to the southern AOI.

## Website and release

Use tiled, progressively loaded detail. Do not render a whole 100-million-sample core as one mesh.

The candidate viewer must provide:

- one overall map;
- four fixed core markers and buttons;
- core camera presets and layer switches;
- season selector;
- source-quality and release information;
- v0.3.1 rollback;
- GAEA proof and operations links.

Vertical scale 1.0 must map one horizontal metre to one vertical metre. Artistic erosion, sharpening, GAEA surface detail, vegetation height, bunds, crop rows, and parallax fibres remain separately named reversible visualization layers and do not modify the authoritative height claim.
