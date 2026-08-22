# Guilin v0.5 Worker 2: vegetation, agriculture, wind and reference-quality surface detail

## Branch

`codex/guilin-ecology-visual-v050`

## Target

`project/guilin-v050-four-core`

## Read first

- `ops/tasks/GUILIN_V050_MASTER.md`
- `projects/guilin/config/core_regions_v050.json`
- `skills/dem-ecology-surface/SKILL.md`
- v0.4 terrain and ecology Phase A handoffs, compilers and knowledge catalog
- current v0.3.1 ecology release and the last visually acceptable browser build
- user-supplied Blender reference logic already summarized in the skill

## Immediate objective

Fix the visual regression in the current vegetation layer and produce a clearly better candidate for the overall map and all four 10 km × 10 km cores.

## Regression analysis

Before replacing code, compare the current candidate with the last visually acceptable version. Identify and report changes in:

- instance counts and rejected habitats;
- canopy shader and crown depth;
- species prototype mapping;
- palettes and lighting;
- trunk visibility;
- forest-edge shrubs;
- bamboo bands;
- field and orchard rows;
- LOD or continuous-detail transitions;
- asset loading and coordinate orientation.

Restore compatible superior behavior before adding new effects.

## Vegetation system

- Activate at least 18 declared prototypes in the detailed-core release.
- Keep riparian Ficus, Chinese wingnut, hackberry, lowland broadleaf, slope broadleaf, Chinese fir, Masson pine, phoenix-tail bamboo, moso bamboo, riparian shrub, forest-edge shrub, drought shrub and four orchard groups visibly distinct.
- Use landform, slope, water distance, moisture, aspect when available, settlement distance, agriculture and hard exclusions.
- Keep permanent water, active channel, road core, building, airport, crop interior and strong rock core free of invalid woody instances.
- Implement three offset canopy layers in global projected coordinates.
- Add crown-profile response, medium-distance trunk cues, near trunks and crown clusters, forest-edge shrubs and species-dependent scale and palette.
- Avoid uniform green carpets, identical tree balls and abrupt LOD popping.

## Parallax Strand Surface

Implement the carpet-derived Parallax Strand Surface for:

- grass;
- rice;
- vegetables;
- low dryland crops;
- shrub understorey;
- forest floor.

Far view uses aggregate color, roughness and normals. Medium view uses view-dependent strand depth, fibre direction and stable wind. Near view adds a bounded amount of actual blades, leaves and stalks. Parallax may not extend beyond an approved mask.

## Wind

Use one world-space wind field with:

- wind direction and mean speed;
- gust strength, scale and travel speed;
- turbulence;
- stable per-instance phase;
- root locking;
- species-specific stiffness;
- spring, summer, autumn and winter profiles.

Tree trunks, branches, leaves, phoenix-tail bamboo, moso bamboo, rice, vegetables, grass and fruit trees must react differently. Whole stands may not move in perfect synchronization.

## Agriculture and bunds

Implement and visibly distinguish:

- water or transplanting rice;
- green tillering rice;
- mature or heading rice;
- harvested rice and stubble;
- fallow;
- normal green vegetables;
- blue-green vegetables;
- yellow-green crops;
- maize-like dryland crops;
- root crops;
- citrus, pomelo, persimmon and mixed loquat, plum and peach orchards.

Paddy remains in flat valley, floodplain, alluvial terrace and irrigable low footslope terrain. Vegetable fields are smaller and closer to settlement and water access. Dryland crops occupy better-drained terrain. Orchards use stable block, row and tree IDs.

Bunds require:

- a narrow raised core;
- lower vegetated shoulders;
- irrigation and drainage cuts;
- field-entry cuts;
- stable field boundaries;
- field-local row orientation;
- global row phase continuity;
- clear top-view and medium-view visibility.

## Four-core adaptation

### 真宝鼎

Use high-relief mountain ecology, rock exposure, conifers, broadleaf forest, sparse rock shrubs and stream corridors.

### 桂林古城

Use urban hard exclusions, Li River edge vegetation, historic-city edge agriculture and evidence-labeled 1940-1945 placeholders.

### 秧塘机场旧址

Preserve airfield protection, runway and drainage. Concentrate agriculture, villages and karst-edge vegetation outside the protected footprint.

### 阳朔县城

Emphasize Li River banks, karst forest, bamboo, rice, vegetables, orchards and county-edge transitions.

## Outputs

- versioned ecology and agriculture release assets;
- vegetation and crop diagnostics;
- wind profile and shader contracts;
- Parallax Strand Surface implementation and tests;
- crop and bund screenshots;
- forest, bamboo and orchard screenshots;
- regression comparison report;
- `HANDOFF_GUILIN_ECOLOGY_VISUAL_V050.md`.

## Acceptance

- at least 18 active prototypes;
- zero terrestrial instances in water and active channel;
- zero paddy forbidden overlap;
- zero large-tree and dense-shrub overlap in strong rock core;
- at least three vegetable palette families are visibly distinct;
- rice stages are visibly distinct;
- bund core and shoulders are clear;
- irrigation and field entries cut bunds;
- stable deterministic rebuild;
- stable global canopy, row, orchard and fibre phase;
- wind roots remain fixed and species motion differs;
- current candidate is visibly better than the identified last good version in canopy depth, species variation, crop separation and bund legibility;
- browser console errors are zero.

Submit a draft PR to `project/guilin-v050-four-core`. Do not merge it yourself.
