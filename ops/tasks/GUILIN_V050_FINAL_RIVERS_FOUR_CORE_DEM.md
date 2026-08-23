# Guilin v0.5 final blocker task: named rivers and four real core DEM packages

## Context

The private recovery candidate now starts successfully, has WebGL2, zero console or page errors, atmospheric background, active-core ecology loading and a working 1.7 m ground camera. The private QA report still blocks release because:

1. the named Li River and Xiang River network is missing from the actual candidate runtime;
2. only one real core DEM package is available and the other three fixed 10 km × 10 km core packages are missing;
3. public release is disabled until both blockers are resolved and evidenced.

Authoritative inputs:

- `reports/GUILIN_V050_PRIVATE_BROWSER_QA.json`
- `projects/guilin/config/core_regions_v050.json`
- `projects/guilin/config/release_gate_v050.json`
- `web/guilin-v050/manifest.json`
- `web/guilin-v050/runtime.js`
- existing 12.5 m source tiles and project source manifests
- current recovery branch `fix/guilin-v050-recover-v031-baseline`

## Goal

Produce one continuous, truthful 12.5 m Guilin terrain lineage for the overall map and four complete 10 km × 10 km core packages, then bind a named and continuous Li River and Xiang River system into the candidate runtime without water bridge triangles, disconnected fragments, out-of-bounds surfaces or invented branches.

## Four fixed cores

1. 真宝鼎
2. 桂林古城, 靖江王城锚点
3. 秧塘机场旧址
4. 阳朔县城

Every core must use the exact projected square in `projects/guilin/config/core_regions_v050.json`.

## Terrain requirements

1. Resolve all locally available 12.5 m source tiles and their metadata before downloading anything else.
2. Download only missing truthful source products required for complete coverage.
3. Preserve every source file, acquisition metadata, native resolution label, CRS, vertical units, NoData, coverage footprint and SHA-256.
4. Build one aligned overall 12.5 m mosaic in EPSG:32649.
5. Extract all four 10 km × 10 km core grids from that same mosaic and pixel alignment.
6. Reject any core with incomplete real coverage, mixed pixel size, mixed vertical scale or invented fill.
7. Overall and core terrain manifests must reference the same authoritative mosaic lineage and truth hash family.
8. Browser tessellation may differ by distance, while truth resolution and elevation values remain the same lineage.
9. Mirror runtime assets into the candidate web path with deterministic checksums.

## Named hydrology requirements

1. Build explicit named primary networks for:
   - 漓江, Li River
   - 湘江, Xiang River
2. Preserve original source line geometry before clipping.
3. Merge lines by named river ID and projected endpoint topology.
4. Snap only within a documented metre tolerance. Record every snap and reject large or ambiguous corrections.
5. Split lines into contiguous in-bounds parts. Never reconnect separated clipped parts.
6. Build water surfaces from validated centerlines and width profiles as independent strips or topology-safe polygons.
7. Prohibit polygon fan triangulation across disconnected or re-entering parts.
8. Generate and validate:
   - centerline layer
   - water surface layer
   - bank layer
   - flow direction layer
   - named river labels
   - continuity and endpoint report
9. Tributaries must come from approved source geometry or evidence-backed historical reconstruction. Do not use decorative procedural branches as real rivers.
10. Store source lineage, names, IDs and completeness state in the runtime manifest.

## Runtime integration

1. Bind four real core DEM packages in `web/guilin-v050/manifest.json`.
2. Overall map must show named river surfaces and labels at regional scale.
3. Active core loads its high-density grid from the same 12.5 m lineage.
4. Core switching must not change vertical datum, pixel origin or terrain scale.
5. The hydrology controls must separately toggle named rivers, tributaries, water surfaces, banks, flow direction, labels and continuity diagnostics.
6. Normal view must contain no debug lines, diagonal water triangles, mesh edges or topology overlays.
7. Diagnostic lines are visible only when their explicit switch is enabled.
8. Terrain outside the active core remains lower-detail through tessellation and atmosphere, not through a different DEM source.

## Required outputs

- four complete core terrain manifests and runtime grids
- updated overall terrain release and lineage report
- named Li and Xiang GeoJSON or equivalent runtime geometry
- water surface and bank runtime assets
- topology and continuity report
- source and output SHA-256 manifests
- updated `web/guilin-v050/manifest.json`
- updated runtime hydrology binding
- `HANDOFF_GUILIN_V050_RIVERS_FOUR_CORE_DEM.md`
- private evidence screenshots and overlays

## Tests and gates

1. all four core packages exist and have exact 10,000 m side length;
2. all four have complete real coverage;
3. all four share the same 12.5 m lineage, CRS, pixel alignment and vertical scale;
4. Li River named network is continuous through the relevant AOI;
5. Xiang River named network is continuous through the relevant AOI;
6. zero out-of-bounds water vertices;
7. zero bridge triangles and zero anomalously long water edges;
8. zero unintended self-crossings after surface generation;
9. centerlines, surfaces and banks remain spatially consistent;
10. normal render has zero diagnostic lines;
11. all water and terrain runtime assets match their checksum manifests;
12. overall and four core routes load locally with HTTP 200;
13. browser console and page error count is zero;
14. v0.3.1 rollback still loads;
15. public release remains disabled.

## Delivery

Implement on branch `fix/guilin-v050-rivers-four-core-dem`, create a draft PR targeting `fix/guilin-v050-recover-v031-baseline`, attach exact commands, checksums, coverage metrics, named-river continuity metrics and private screenshots. Do not merge and do not publish.
