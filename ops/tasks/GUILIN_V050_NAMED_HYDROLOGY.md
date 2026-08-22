# Guilin v0.5 named Li River and Xiang River hydrology

Branch: `codex/guilin-named-hydrology-v050`
Target: `fix/guilin-v050-recover-v031-baseline`
Public release: blocked

Keep the pull request draft. Do not deploy.

## Context

The current private recovery runtime restores the v0.3.1 water field for visual and exclusion testing. It does not yet provide the complete named Li River and Xiang River system requested for the final Guilin map. The named-river switch is intentionally disabled until a validated topology asset exists.

Read:

- `projects/guilin/recovery/GUILIN_V050_REQUIREMENTS_AUDIT.md`
- `projects/guilin/config/release_gate_v050.json`
- `HANDOFF_GUILIN_V050_CONTROLLER_RECOVERY.md`
- `DEM-Map-Pipeline/guilin-zhenbaoding-yangshuo-pingle/metadata/waterways_osm.geojson`
- `DEM-Map-Pipeline/guilin-zhenbaoding-yangshuo-pingle/metadata/waterways_osm.json`
- current terrain and AOI manifests
- `web/guilin-v050/`

## Goal

Build named, continuous, source-traceable primary networks for:

- Li River;
- Xiang River.

Use approved source geometry and preserve its lineage. Programmatic branches may support erosion diagnostics, but cannot replace the two named primary networks.

## Topology pipeline

1. Read all source river segments and preserve original feature IDs, names, source and license.
2. Normalize known name variants without erasing the original name.
3. Project geometry into the project CRS, EPSG:32649.
4. Split lines into contiguous parts before clipping.
5. Snap endpoints in projected metres with a declared small tolerance.
6. Merge only topologically connected segments.
7. Reverse segment direction when required for continuity.
8. Reject unexplained midstream gaps, self-crossings and disconnected decorative loops.
9. Clip each contiguous part independently to the overall AOI and to each core.
10. Never reconnect separate re-entry parts across an out-of-bounds gap.
11. Generate flow direction and ordered vertex sequence where evidence supports it.
12. Produce a continuity report listing source segments, endpoints, gap distances, component counts and unresolved evidence gaps.

## Water surfaces

1. Generate surfaces from validated centerlines and width attributes or a documented width class.
2. Build each contiguous surface independently.
3. Use projected-metre normals and joins.
4. Clip each surface independently.
5. Triangulate each valid part independently.
6. Reject triangles whose edges exceed a declared local-width multiplier.
7. Require zero out-of-bounds vertices.
8. Require zero triangles that bridge separate line parts.
9. Keep centerline, surface, bank and diagnostic geometry separate.

## Runtime integration

Create versioned assets under `web/guilin-v050/data/` and matching metadata and reports. Enable the existing named-hydrology control only after the assets and validation report load successfully.

Hydrology controls must separately switch:

- Li River;
- Xiang River;
- approved tributaries;
- water surface;
- banks;
- flow direction;
- continuity diagnostics.

Normal rendering must show no topology lines, cross-part diagonals, polygon bridges or debug wireframes. Diagnostics appear only when explicitly enabled.

## Ecology and terrain interaction

- permanent-water and active-bank masks must agree with the rendered surface;
- detailed terrestrial vegetation remains outside permanent water and active channel;
- paddy cannot occupy permanent water;
- water follows the same terrain CRS, axis, pixel alignment and row order;
- do not modify the truth DEM.

## Tests

- Li River source features are found or a fail-closed evidence gap is reported;
- Xiang River source features are found or a fail-closed evidence gap is reported;
- endpoint snapping is deterministic;
- segment reversal preserves coordinates and source IDs;
- independent clipped parts remain independent;
- zero out-of-bounds water vertices;
- zero cross-part bridge triangles;
- zero abnormal long triangle edges;
- normal view contains no diagnostic line pass;
- masks and surfaces use north-up orientation;
- water and active-bank exclusions pass;
- rebuild checksums are deterministic;
- browser control switches work;
- console error count remains zero;
- public release gate remains false.

## Evidence

Provide private evidence for:

- complete Li River centerline;
- complete Xiang River centerline;
- continuity and endpoint report;
- centerline versus water-surface overlay;
- edge clipping and re-entry cases;
- abnormal-triangle scan;
- overall normal view with diagnostics disabled;
- hydrology panel with separate switches.

Deliver source code, versioned GeoJSON and surface assets, topology and geometry reports, tests, browser integration and `HANDOFF_GUILIN_V050_NAMED_HYDROLOGY.md`. Open a draft PR to the recovery branch and stop for controller review.
