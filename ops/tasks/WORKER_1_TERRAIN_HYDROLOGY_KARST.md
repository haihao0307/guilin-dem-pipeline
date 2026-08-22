# Codex Worker 1: Terrain, hydrology, erosion and karst v0.4.0

## Branch

`codex/terrain-hydrology-karst-v040`

Before implementation, fetch and rebase onto `origin/integration/ecology-v040` so the shared contracts are present.

## Read first

- `PROJECT_MANIFEST.json`
- `DEM-Map-Pipeline/guilin-zhenbaoding-yangshuo-pingle/README.md`
- `DEM-Map-Pipeline/guilin-zhenbaoding-yangshuo-pingle/config/task_config.json`
- `DEM-Map-Pipeline/guilin-zhenbaoding-yangshuo-pingle/metadata/waterways_osm.geojson`
- `DEM-Map-Pipeline/guilin-zhenbaoding-yangshuo-pingle/metadata/ecology/v0.3.1/ecology-knowledge.json`
- `DEM-Map-Pipeline/guilin-zhenbaoding-yangshuo-pingle/metadata/gaea/terrain-processing-profile.json`
- `DEM-Map-Pipeline/guilin-zhenbaoding-yangshuo-pingle/scripts/build_web_preview.py`
- `DEM-Map-Pipeline/guilin-zhenbaoding-yangshuo-pingle/tests/run_tests.py`
- `contracts/FIELD_CONTRACTS_v0.4.0.md`
- `contracts/SHARED_HARD_RULES.md`

## Objective

Upgrade the 10 km2 ecology terrain baseline from v0.3.1 to a versioned v0.4.0 terrain field set. Improve real hydrology constraints, river exclusion, visible erosion channels, karst exposed rock, terrace classification and diagnostics while preserving the truth DEM.

## Required implementation

1. Add or upgrade a terrain field compiler that produces at least:
   - `permanent_water_mask`
   - `active_bank_mask`
   - `distance_to_water_m`
   - `flow_direction_xy`
   - `flow_accumulation`
   - `erosion_channel_mask`
   - `erosion_depth_m`
   - `karst_rock_mask`
   - `karst_rock_core_mask`
   - `landform_class`
   - `hard_exclusion_mask`
2. Use existing OSM and reconstructed water vectors for trunk rivers. Add procedural tributaries only in approved catchments.
3. Route erosion channels downhill into existing water or approved drainage channels. Reject ridge crossing, reverse-slope flow, suspended channels and closed decorative lines.
4. Store erosion and rock micro-relief in a reversible delta field. Never overwrite `z_truth_m`.
5. Build karst rock exposure from slope, curvature, relative elevation, aspect, stratification direction and multi-scale noise.
6. Avoid honeycomb texture, fish-scale repetition and complete contour rings.
7. Distinguish water surface, bare bank, active bank slope and outer riparian habitat.
8. Rebuild the current 10 km2 sample and write versioned v0.4.0 terrain assets under all three required publication locations:
   - `metadata/ecology/v0.4.0/`
   - `web/assets/ecology/v0.4.0/`
   - `site/public/terrain/assets/ecology/v0.4.0/`
9. Keep every v0.3.1 file intact.

## Validation gates

- Terrestrial vegetation instances inside permanent water or active channel: 0.
- Erosion channels terminate in permanent water or an approved drainage channel.
- Strong rock cores contain no large-tree or dense-shrub instances.
- Paddy overlap with ridge, summit, cliff, strong rock core or active water: 0.
- Cross-tile field seams pass numeric equality or tolerance tests.
- Python tests pass.
- Site tests pass.
- Browser console error count: 0.

## Visual evidence

Capture browser screenshots for aerial overview, hydrology, erosion, karst rock and top view. Screenshots must clearly show the v0.4.0 layer version.

## Handoff

Create `HANDOFF_TERRAIN_V040.md` with changed files, algorithms, parameters, tests, screenshots, performance, known issues and rollback point. Open a PR to `integration/ecology-v040`. Do not merge it yourself.
