# Gaea-to-Three.js terrain delivery

## Contents

- [Reference experience evidence](#reference-experience-evidence)
- [Architecture boundary](#architecture-boundary)
- [Web terrain asset contract](#web-terrain-asset-contract)
- [Three.js runtime architecture](#threejs-runtime-architecture)
- [Precision editing round trip](#precision-editing-round-trip)
- [State model](#state-model)
- [Performance and mobile strategy](#performance-and-mobile-strategy)
- [Browser QA](#browser-qa)

## Reference experience evidence

Inspected `https://guilin-dem-terrain.sunhaihao.chatgpt.site/guilin?from=strategy&city=guilin` on 2026-08-14. Use it as a behavioral and architectural reference, not as a source of code or branded assets.

### Confirmed

- The page title is `东亚战略地球 · 1941` and the terrain view identifies itself as `THREE.JS TERRAIN MAP / DEM 12.5 M`.
- One WebGL canvas renders a perspective terrain with roads, rivers, water candidates, labels, and two simulated units.
- The UI reports WGS 84 / UTM zone 49N, extent `109.7127°E–110.4990°E / 24.9424°N–25.5811°N`, original raster `6,387 × 5,621`, elevation `91–1762 m`, coverage `5,591 km²`, and 12.5 m resolution.
- Controls include vertical scale `0.5×–2.5×`, three terrain palettes, water/river/road/name/grid/reference-grid toggles, reset view, top view, orbit/zoom, and click-to-measure elevation.
- Data resources observed in the loaded page include `dem-meta.json`, `dem.bin`, `water-surface-2009.json`, `osm-rivers.json`, `osm-roads.json`, a city manifest/package, and scenario JSON.
- Module names include `TacticalTerrainClientOnly` and `TacticalTerrainSlice`; application assets use `/_next/static/...` module chunks. The WebGL library is not placed on `window.THREE`, consistent with bundled ES modules.
- The rendered canvas used a device-pixel ratio of approximately 1.5 in the inspected desktop state.
- Responsive CSS stacks the terrain stage and control panel below `900px`; a narrower layout applies below `560px`. Reduced-motion CSS disables selected transitions/animations.

### Strong inference

- A city-package adapter resolves a manifest to DEM metadata/binary plus overlay JSON, then transforms geographic/projected coordinates into one local Three.js frame.
- Shared simulation state remains in longitude/latitude/elevation and is adapted into the local terrain frame for the tactical view.
- The original 35.9-million-sample raster is not rendered as an equivalent one-object 35.9-million-vertex browser mesh; a decimated grid, tile/LOD system, or another compact representation is necessary.
- Label DOM elements likely sit above the WebGL canvas and need visibility filtering to control clutter and layout cost.

### Unknown; verify in the project repository

- `dem.bin` sample type, dimensions, byte order, compression, decimation, and NoData behavior;
- exact Three.js version, renderer settings, geometry topology, shader code, worker usage, and resource byte sizes;
- whether overlays are preprojected or transformed at runtime;
- mobile GPU memory, context-loss, and low-end fallback behavior.

Do not claim these unknowns from filenames alone.

## Architecture boundary

Use three layers:

```text
GIS authority
  source DEM + CRS/transform/vertical datum + masks
          |
          v
Gaea build layer (Windows, licensed, offline/worker)
  .terrain + vars/profile/region/seed
  -> height + wear + deposits + flow + slope + normals + masks
          |
          v
Web compiler and runtime
  versioned manifest + height binaries + textures + overlays
  -> Three.js terrain, interaction, labels, simulation adapters
```

Do not port Gaea erosion algorithms into the browser. Runtime controls may change vertical exaggeration, palette, layer visibility/opacity, clipping, lighting, and precomputed variant blend. A true Gaea parameter change requires a new Swarm build.

If product requirements call for an online `Erosion Strength` control, choose explicitly:

- **Preview-only shader control:** fast and approximate; label it as visualization, not a Gaea rebuild.
- **Precomputed variants:** batch several Gaea strengths with identical grids and blend/select them; only the baked variants are authoritative.
- **Queued rebuild:** submit a validated job to a licensed Gaea worker and publish after QA; accurate but asynchronous.

## Web terrain asset contract

Prefer a manifest-led, immutable package:

```text
terrain/guilin/v0007/
  terrain-manifest.json
  height.u16.bin
  layers/
    wear.png
    deposits.png
    flow.png
    slope.png
    normals.ktx2
    water.geojson
    rivers.geojson
    roads.geojson
```

Minimum manifest fields:

- schema/version and immutable asset version;
- grid width/height and row/column order;
- source CRS/EPSG, transform/bounds, and optionally WGS84 bounds;
- metric world width/depth and local-frame origin;
- axis convention: `+X east`, `+Y up`, `+Z south`;
- height encoding, byte order, quantization min/max, vertical unit, decode formula, actual min/max, and hash;
- NoData/validity-mask policy;
- Gaea project hash, variables hash, Profile/Region, seed, version, and deterministic mode;
- layer URLs, type, color/data interpretation, precision, hash, and shared grid/quantization ID.

For a Uint16 height asset:

```text
elevation_m = quant_min_m + sample_u16 / 65535 * (quant_max_m - quant_min_m)
```

Use a fixed quantization interval across a world, its tiles, and blendable variants. Record clipping count; any unexpected clipped sample fails packaging. Uint16 over a 2000 m interval resolves about 3.1 cm per code, normally below source DEM error and far smaller than web mesh spacing.

Never expose absolute workstation paths in a public manifest. Include source filename/hash and build provenance, not a local directory.

## Three.js runtime architecture

Suggested modules:

```text
TerrainManifestLoader
  -> validates schema, URLs, hashes/version compatibility
HeightBinaryLoader
  -> worker decode, range checks, transferable TypedArray
TerrainGeometrySystem
  -> grid/tile geometry, LOD, skirts, bounds, raycast/probe
TerrainMaterialSystem
  -> elevation palette, Gaea masks, lighting, debug modes
GeoFrame
  -> projected/WGS84 <-> local X/Z, elevation <-> Y
OverlaySystem
  -> water polygons, rivers, roads, AOI/edit masks
LabelSystem
  -> screen-space labels with culling and collision budget
SimulationAdapter
  -> shared lon/lat/elevation state to local frame
TerrainControls
  -> orbit/top view/reset, vertical scale, palette, layer toggles
QualityTier
  -> desktop/mobile grids, DPR cap, texture/label budgets
```

For a single grid, create a plane of the metric footprint, rotate it onto XZ, and set vertex Y from decoded elevations relative to a local elevation origin. Confirm row zero maps to north and column zero to west. Recompute normals when geometry or vertical scale changes, or adjust them consistently in the shader.

Do not raycast against millions of triangles for elevation readout. Convert the pointer hit/local XZ to fractional raster coordinates and bilinearly sample the height grid; return projected coordinates, WGS84 coordinates, decoded elevation, source/processed status, and data confidence.

Treat Gaea maps as linear data unless they are actual colors. Do not apply sRGB transforms to height, flow, wear, deposits, slope, curvature, masks, or packed splat channels.

## Precision editing round trip

Represent edits as a versioned GeoJSON FeatureCollection, not canvas pixels:

```json
{
  "type": "FeatureCollection",
  "properties": {
    "schema": "gaea-terrain-edits/v1",
    "terrainVersion": "guilin-v0007",
    "crs": "EPSG:32649"
  },
  "features": [
    {
      "type": "Feature",
      "properties": {
        "operation": "selective-erosion",
        "strength": 0.18,
        "falloffMeters": 120,
        "priority": 10
      },
      "geometry": {"type": "Polygon", "coordinates": []}
    }
  ]
}
```

Workflow:

1. Edit in the website using projected/local coordinates while displaying WGS84 for the user.
2. Export GeoJSON with terrain version, CRS, operation, strength, falloff, and authoring timestamp.
3. Validate geometry, extent, parameter allowlist/ranges, and source terrain version server-side.
4. Rasterize one Float32/16-bit mask per Gaea control onto the exact working grid; preserve soft falloff.
5. Bind mask paths and whitelisted values in the `.terrain` template.
6. Queue `Gaea.Swarm.exe` in a unique job directory. Never accept arbitrary executable, project, input, or output paths from the client.
7. Restore geospatial metadata, run numeric/seam QA, package web assets, and publish an immutable version.
8. Atomically update a small city-package pointer only after all assets are available.
9. Let clients keep the previous version if loading or validation fails.

Server controls: authentication where required, rate limits, job quotas, cancellation, build timeout, bounded mask size, parameter clamps, path isolation, license-seat handling, audit logs, and no license material in responses.

## State model

| State | Entry | Camera/controls | Resources | Exit/cleanup |
|---|---|---|---|---|
| Loading | city route/manifest | static shell; controls disabled | manifest, height LOD0, core shader | Ready or Fallback; abort obsolete requests |
| Perspective | load complete/reset | orbit + zoom + probe | terrain and selected overlays | TopView/Edit/route change |
| TopView | top-view button | orthographic or constrained overhead | reuse terrain/overlays | reset/perspective; restore prior camera if desired |
| Inspect | pointer/click | camera remains enabled or temporarily gated | sample CPU height grid | pointer exit/selection change |
| Edit | edit tool | camera gestures separated from drawing | edit geometry + preview mask | commit/cancel; dispose preview buffers |
| Building | submit valid edit | old terrain remains viewable | job status only | Published/Failed/Cancelled |
| Published | manifest pointer changes | preserve view if bounds unchanged | load new version in parallel | swap after validation; dispose old GPU assets |
| Fallback | WebGL/data failure | 2D hillshade/static summary | low-res image/metadata | retry or route change |

All route changes must abort fetches/workers, dispose geometries/materials/textures/render targets, detach listeners/observers, and stop animation loops.

## Performance and mobile strategy

- Do not render the reference raster's `6,387 × 5,621` samples as one mesh: that is about 35.9 million vertices before indices, normals, overlays, or labels.
- Prototype grid: cap the longest side around 1025 on desktop and 513 on mobile, then measure. Production city terrain should use tiled LOD (often 129/257 samples per tile), frustum culling, geometric error, and skirts or edge stitching.
- Decode binary in a Web Worker and transfer the ArrayBuffer/TypedArray. Avoid JSON arrays for dense heights.
- Quantize heights to Uint16 with a shared range; use Float32 only when its added precision is justified by data error and bandwidth.
- Use KTX2/Basis for large color/normal textures; use compact single/dual-channel formats for masks when available.
- Cap device pixel ratio (the inspected page was approximately 1.5) and adapt resolution before quality effects.
- Cull labels by view, distance, priority, and collision. Batch roads/rivers and simplify geometries by quality tier.
- Pause animation on `visibilitychange`, stop simulation work when hidden, and honor `prefers-reduced-motion`.
- Provide a mobile layout that stacks the stage and panel; reduce labels, overlays, grid size, and DPR. Test portrait/landscape, touch orbit/draw conflicts, and scroll containment.
- Provide WebGL2 capability checks, context-loss recovery, loading progress, timeout, retry, and a static/2D fallback.

## Browser QA

### Numerical and alignment

- manifest schema and hashes validate before rendering;
- decoded sample min/max and four corners match the packaging report;
- north/south/east/west orientation and local axes are correct;
- probe elevation matches bilinear CPU sampling and selected GIS control points;
- water, roads, rivers, labels, and simulated units align at corners and interior checkpoints;
- vertical scale 1.0 reproduces the metric contract; debug exaggeration is visibly labeled.

### Visual and interaction

- perspective, top view, reset, orbit, zoom, probe, palette, and every layer toggle work;
- fixed palette ranges do not change when a tile or layer toggles;
- seams do not appear across LOD/tile boundaries in height, normals, or Gaea masks;
- edit gestures cannot accidentally orbit; cancel restores the previous state;
- build progress/failure never removes the last published terrain.

### Performance and resilience

- measure network bytes, parse/decode time, first terrain render, steady FPS, draw calls, triangles, textures, JS heap, and GPU memory proxies on each quality tier;
- test Chrome/Edge/Firefox/Safari as applicable, desktop and representative mobile GPUs;
- test slow network, corrupt/partial binary, schema mismatch, 404 layer, worker failure, context loss, tab hide/show, route enter/exit, and repeated version swaps;
- verify DOM labels and GPU resources return to baseline after navigation cycles;
- inspect keyboard focus, control labels, contrast, reduced motion, and non-WebGL fallback.
