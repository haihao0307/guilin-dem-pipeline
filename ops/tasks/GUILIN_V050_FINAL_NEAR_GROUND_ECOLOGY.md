# Guilin v0.5 final blocker task: near-ground ecology, crops, bunds and wind

## Context

The private recovery candidate successfully restores executable v0.3.1 fields and instances, active-core loading, atmospheric background and 1.7 m ground access. The private browser QA blocks public release because near-ground tree billboards are oversized and pixelated. The final candidate must preserve the v0.3.1 spatial rules while replacing crude near-ground point and billboard rendering with controlled species-aware geometry and shader detail.

Authoritative inputs:

- `reports/GUILIN_V050_PRIVATE_BROWSER_QA.json`
- `projects/guilin/recovery/v031_baseline_manifest.json`
- `projects/guilin/config/release_gate_v050.json`
- `web/guilin-v050/runtime.js`
- current v0.3.1 ecology assets and metrics
- shared v0.5 ecology, wind and Parallax Strand Surface contracts

## Goal

Make the active 10 km × 10 km core visually convincing from aerial view down to approximately 1.7 m above ground. Detailed ecology is loaded only in the active core. The overall map uses broad land-cover and blurred canopy fields without dense individual plant geometry.

## Required spatial behavior

1. Preserve the v0.3.1 hard exclusions:
   - zero terrestrial plants in permanent water and active channels;
   - zero large trees and dense shrubs in strong karst rock core;
   - zero wild woody instances inside crop interiors, roads, buildings and airport protection surfaces;
   - paddy only in valid valley, floodplain, alluvial terrace or irrigable low-foot-slope cells.
2. Keep at least 18 active declared vegetation prototypes in each appropriate core release when habitat allows.
3. Keep separate forms for riparian Ficus, Chinese wingnut, hackberry, broadleaf forest, Chinese fir, Masson pine, phoenix-tail bamboo, moso bamboo, riparian shrubs, forest-edge shrubs and orchard groups.
4. Keep detailed instances inside the active core only.
5. Use stable global projected coordinates for instance IDs, canopy phase, field rows, wind phase and orchard gaps.

## Distance system

Use one release and continuous transition weights:

### Far

- broad forest and agriculture colors;
- canopy-height and density fields;
- atmospheric blur and desaturation;
- no individual tree billboards;
- no dense crop geometry.

### Medium

- three offset canopy shells or equivalent lobe fields;
- species-dependent crown shape and color;
- trunk cues;
- forest-edge shrub band;
- Parallax Strand Surface for grass, rice, vegetables and low crops;
- explicit bund core and shoulder;
- orchard rows and stable gaps.

### Near

- bounded real geometry for trunks, branch clusters, leaf clusters, bamboo culms, shrub clusters, rice, vegetables and dryland crops;
- geometry budget based on screen footprint and camera distance;
- no giant square points, pixelated circular billboards or sudden size jumps;
- smooth fade between parallax and real geometry;
- all roots fixed to sampled terrain.

## Tree and bamboo rendering

1. Replace point-sprite tree crowns in near view.
2. Build low-cost species-aware meshes or impostors with:
   - trunk geometry;
   - multiple crown lobes;
   - alpha-tested leaf clusters with controlled edge softness;
   - species-specific crown width, height and asymmetry;
   - stable rotation and size variation.
3. Riparian Ficus must have broad, asymmetric, multi-lobed crowns and visible trunk cues.
4. Conifers must use narrow or open conical silhouettes.
5. Phoenix-tail bamboo must form 3 to 8 m dense low arching clumps.
6. Moso bamboo must form 8 to 17 m tall culm groups with lighter crowns.
7. Forest edge must have a deliberate shrub transition, with no hard wall or texture stretch.

## Agriculture and bund rendering

1. Preserve at least eight crop palette classes.
2. Render visually distinct:
   - water or seedling paddy;
   - green tillering paddy;
   - heading or mature paddy;
   - harvested paddy;
   - fallow;
   - normal green vegetables;
   - blue-green vegetables;
   - yellow-green crops;
   - maize-like dryland crops;
   - root crops;
   - citrus, pomelo, persimmon and mixed orchards.
3. Use field-local row direction from release data.
4. Keep row phase continuous in world coordinates.
5. Make bunds explicit:
   - narrow raised core;
   - lower vegetated shoulder;
   - irrigation cuts;
   - drainage cuts;
   - field-entry cuts.
6. Orchard rows must preserve deterministic missing rows and missing trees.

## Wind

1. Use a shared world-space wind field.
2. Root or ground contact remains fixed.
3. Trunks move slowly and slightly.
4. Branches and crown lobes have medium-frequency response.
5. Leaves and fine clusters use higher-frequency response.
6. Phoenix-tail bamboo bends in grouped arcs.
7. Moso bamboo culms and tops have different stiffness.
8. Rice, grass and vegetables form coherent travelling waves.
9. Every instance uses a stable phase and species-specific stiffness.
10. Spring, summer, autumn and winter profiles must change amplitude, gusts, crop state and palette without changing instance identity.

## Parallax Strand Surface

Implement the carpet-derived method for grass, rice, vegetables, low dryland crops, shrub understorey and forest floor:

- far color and normal response;
- medium parallax fibre height and self-shadow approximation;
- near bounded real geometry;
- stable direction and phase in global coordinates;
- parent-mask containment;
- no fibres in water, bare banks, rock core, roads, buildings or airport surfaces.

## Required outputs

- updated ecology runtime modules and shaders
- species-aware geometry and material definitions
- crop, orchard and bund runtime integration
- wind and seasonal runtime integration
- performance budgets and diagnostic readout
- hard-exclusion and overlap report
- private screenshots from every required camera distance
- `HANDOFF_GUILIN_V050_NEAR_GROUND_ECOLOGY.md`

## Required tests and evidence

For every core where the habitat is present:

1. aerial screenshot;
2. medium oblique screenshot;
3. 50 m above-ground screenshot;
4. approximately 2 m screenshot;
5. ground-observer screenshot;
6. forest and species view;
7. bamboo view;
8. paddy, crop and bund view;
9. orchard view;
10. hard-exclusion overlay.

Automated gates:

- zero plant overlap with water and active channel;
- zero large tree or dense shrub overlap with rock core;
- zero paddy overlap with forbidden cells;
- at least 18 active declared prototypes in the full real sample;
- no point sprite larger than its declared pixel budget;
- no near-ground square or circular billboard artifact;
- deterministic rebuild and stable IDs;
- wind root displacement equals zero;
- field and fibre phase seam tests pass;
- camera movement does not cause LOD popping beyond tolerance;
- average frame time and draw calls are recorded;
- browser console and page error count is zero;
- v0.3.1 rollback remains available;
- public release remains disabled.

## Delivery

Implement on branch `fix/guilin-v050-near-ground-ecology`, create a draft PR targeting `fix/guilin-v050-recover-v031-baseline`, attach exact commands, performance results, overlap metrics and private screenshots. Do not merge and do not publish.
