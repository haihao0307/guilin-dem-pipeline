# Codex Worker 2: Ecology, agriculture, bamboo and canopy v0.4.0

## Branch

`codex/ecology-agriculture-v040`

Before implementation, fetch and rebase onto `origin/integration/ecology-v040` so the shared contracts are present.

## Read first

- `PROJECT_MANIFEST.json`
- `DEM-Map-Pipeline/guilin-zhenbaoding-yangshuo-pingle/metadata/ecology/v0.3.1/ecology-knowledge.json`
- `DEM-Map-Pipeline/guilin-zhenbaoding-yangshuo-pingle/metadata/ecology/v0.3.1/ecology-release-manifest.json`
- `DEM-Map-Pipeline/guilin-zhenbaoding-yangshuo-pingle/web/index.html`
- `DEM-Map-Pipeline/guilin-zhenbaoding-yangshuo-pingle/site/public/terrain/index.html`
- `contracts/FIELD_CONTRACTS_v0.4.0.md`
- `contracts/SHARED_HARD_RULES.md`

## Objective

Build a deterministic, habitat-aware ecology and agricultural surface system. Trees, shrubs, bamboo, rice, vegetables, dry crops and orchards must occupy ecologically and agriculturally valid locations. Match the reference method's fine canopy, field rows, orchard order and parcel variation while following Guilin-specific rules.

## Species and habitat system

Provide at least 18 distinct profiles across these groups:

- riparian banyan and other large broadleaf trees
- Chinese wingnut and hackberry-type riparian trees
- evergreen broadleaf slope forest
- Chinese fir and Masson pine profiles
- large riparian shrub and forest-edge shrub profiles
- phoenix-tail bamboo and moso bamboo
- citrus, pomelo, persimmon and mixed loquat/plum/peach orchards

Each profile records landform, slope range, water distance, wetness, aspect, settlement distance, height, crown width, crown profile, color range, clustering mode, exclusions and evidence status.

## Spatial rules

1. Riparian succession follows active water, bare bank, riparian shrubs, riparian trees, phoenix-tail bamboo, moso bamboo or terrace vegetation.
2. Phoenix-tail bamboo forms 3 to 8 m dense clumps around outer banks, field edges and settlements.
3. Moso bamboo forms 8 to 17 m taller stands on moist lower slopes, terraces and settlement margins.
4. Paddy fields occupy flat valley floors, alluvial terraces and irrigated low-slope terraces only.
5. Paddy fields are prohibited on summits, ridges, steep karst slopes, exposed rock, active water and un-irrigated high terraces.
6. Vegetable plots stay near settlements on flat valley or low-terrace land and use smaller parcels.
7. Dry fields occupy better-drained terraces and lower footslopes.
8. Orchards occupy well-drained footslopes and low terraces, with regular rows and stable missing trees or rows.
9. Crop, orchard and settlement interior masks exclude wild tree and shrub placement.

## Reference-method translation

- Use parent-mask constrained nested Voronoi fields.
- Use three offset canopy layers with distinct crown profiles and micro-height.
- Use parcel-local Wave coordinates for crop rows.
- Use stable block, row and tree IDs for orchard grids and missing plants.
- Use Voronoi edge distance for narrow bund cores, planted shoulders and local path candidates.
- Use a medium-distance parallax strand layer for grass and low crops.
- Use deterministic color profiles for rice stages, leafy vegetables, blue-green crops, yellow-green crops, dry crops, harvest, fallow and orchard understory.

## Required outputs

- v0.4.0 ecology knowledge JSON.
- v0.4.0 release manifest.
- versioned field textures and instance binaries.
- species and crop validation report.
- field-level diagnostics that can show species, habitat, crop profile, bund, rows and exclusions.
- all assets copied into metadata, web and site publication locations without deleting v0.3.1.

## Validation gates

- Tree, shrub, bamboo, orchard and rice instances inside permanent water or active channel: 0.
- Paddy overlap with summit, ridge, cliff, strong rock core, road, building or airport: 0.
- Every instance references a declared profile ID.
- At least 18 profiles are present in actual instance data.
- Deterministic rebuild produces identical IDs and placement checksums.
- Cross-tile canopy, row and strand phases are continuous.
- Browser console error count: 0.

## Visual evidence

Capture browser screenshots for forest canopy, riparian vegetation and bamboo, paddy and bunds, vegetable plots, orchards and top-view land use.

## Handoff

Create `HANDOFF_ECOLOGY_V040.md` with changed files, habitat logic, species list, crop profiles, tests, screenshots, performance, known issues and rollback point. Open a PR to `integration/ecology-v040`. Do not merge it yourself.
