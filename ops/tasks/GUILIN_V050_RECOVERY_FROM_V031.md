# Guilin v0.5 recovery from v0.3.1 visual baseline

## Branch and target

- Work branch: `fix/guilin-v050-recover-v031-baseline`
- Target: `project/guilin-v050-four-core`
- Public release gate: `projects/guilin/config/release_gate_v050.json`
- Audit: `projects/guilin/recovery/GUILIN_V050_REQUIREMENTS_AUDIT.md`

Do not publish or promote the candidate. Work inside the branch and keep the PR draft.

## First action

Read the audit and release gate. Inspect the currently generated public web source and the last pre-regression commits. Produce `reports/GUILIN_V050_CURRENT_BUILD_AUDIT.json` with:

- current terrain source lineage and native resolution by overall map and each core;
- all render passes and line-producing paths;
- water centerline, polygon, triangulation and clipping paths;
- black background and AOI edge behavior;
- ecology loading bounds and instance counts outside active cores;
- missing hydrology controls;
- current GAEA controls;
- camera limits;
- differences from the v0.3.1 baseline metrics recorded in the audit.

## Recovery architecture

### Overall map

1. Use one continuous authoritative 12.5 m DEM mosaic lineage for the full AOI before final release.
2. Do not mix a 30 m overall truth surface with 12.5 m focus truth surfaces in the final candidate.
3. Render terrain and named hydrology continuously.
4. Render only broad land-cover and aggregate canopy outside active cores.
5. Use atmosphere, haze, desaturation and distance blur in the far field.
6. Add a terrain skirt or horizon fade at the AOI edge without inventing elevations.
7. Remove every unexplained line from normal rendering.

### Named hydrology

1. Build named primary networks for Li River and Xiang River.
2. Preserve complete source geometry and split into contiguous clipped parts.
3. Snap and merge endpoints in projected metres with an explicit tolerance.
4. Reject self-crossing, disconnected and re-entry bridge artifacts.
5. Generate water surfaces from validated centerlines and width attributes.
6. Clip each contiguous surface separately.
7. Validate zero out-of-bounds water vertices and zero bridging triangles.
8. Add a hydrology control group independent from the GAEA water-material slider.
9. Provide centerline, surface, bank, flow and continuity diagnostic switches.

### Core-only ecology

1. Detailed ecology loads only for the active 10 km by 10 km core.
2. Overall view uses aggregate land-cover and blurred canopy only.
3. Recover the actual v0.3.1 field, canopy, instance, crop, bund, erosion and material behavior described in the audit.
4. Bind that behavior to real core DEM fields.
5. Keep the shared v0.5 habitat, wind, season and Parallax Strand Surface contracts.
6. Do not replace executable behavior with documentation-only contracts.

### Four fixed cores

Use the existing locked core file. Never ask for these points again:

- Zhenbao Ding
- Guilin old city
- former Yangtang airfield
- Yangshuo county seat

Each core is exactly 10,000 m by 10,000 m in EPSG:32649.

### Camera

Integrate the ground-camera contract. Every core must reach 1.7 to 2.0 m above sampled terrain. Use real-metre conversions, terrain and water collision, adaptive clipping, actual pointer focus and ground-observer mode.

## Baseline behavior to reproduce before enhancement

- 20 vegetation archetypes;
- multiple crown, size and palette families;
- three-layer canopy;
- riverbank shrub and bamboo sequence;
- zero terrestrial vegetation in permanent channels;
- paddy, vegetables, dry crops and orchard classes in valid terrain only;
- eight crop palette classes;
- narrow raised bund core and lower vegetated shoulders;
- world-aligned rows without Y inversion;
- visible erosion and karst rock exposure;
- water, paddy, forest, karst, erosion and top camera presets.

## Required implementation outputs

- `scripts/guilin_v050/audit_current_build.py`
- `scripts/guilin_v050/build_named_hydrology.py`
- `scripts/guilin_v050/build_core_ecology_release.py`
- `scripts/guilin_v050/validate_release_gate.py`
- `web/guilin-v050/` candidate runtime changes
- `metadata/guilin/v0.5.0/overall-terrain-release.json`
- `metadata/guilin/v0.5.0/hydrology-release.json`
- one versioned ecology release per core
- topology and continuity reports
- render artifact scan report
- normal-view screenshots and diagnostic screenshots
- `HANDOFF_GUILIN_V050_RECOVERY.md`

## Required tests

1. normal render has zero debug line and wireframe passes;
2. water polygons have zero out-of-bounds vertices;
3. water triangulation has zero cross-part bridge triangles;
4. Li River continuity passes;
5. Xiang River continuity passes;
6. overall and core terrain releases share the same authoritative source lineage;
7. final candidate contains no 30 m overall plus 12.5 m core truth-source mix;
8. no detailed ecology instance exists outside the active core;
9. v0.3.1 baseline metrics and visual classes are represented in the core runtime;
10. far view uses haze or blur and does not end in a black rectangle;
11. GAEA and hydrology controls are both visible;
12. all four cores reach ground mode;
13. browser console errors equal zero;
14. stable v0.3.1 rollback loads;
15. public release gate remains false until evidence is complete.

## Publication rule

No workflow may deploy this branch publicly. Upload private artifacts and screenshots only. The controller will set `public_release_allowed` and trigger the manual public workflow after visual review.
