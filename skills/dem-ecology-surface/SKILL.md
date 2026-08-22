# DEM Ecology Surface Skill v0.5

## Purpose

This skill defines the shared production rules for terrain ecology, vegetation, agriculture, wind, seasonal state, procedural surface detail, and web-runtime publication across the Guilin, Kunming, and Wenzhou-Taizhou DEM projects.

The skill is shared. Each city keeps its own project directory, source data, species catalog, crop catalog, historical land-use evidence, seasonal profile, build manifest, and release history.

Target historical interval for the current projects:

```text
1940-1945
```

The output must identify reconstructed or enhanced historical content as such. The truth DEM, source hydrology, historical vectors, and approved land-use evidence remain traceable and reversible.

## Core production order

The production order is fixed:

```text
truth DEM and source vectors
terrain derivatives
permanent water and hydrology
landform classification
hard exclusions
historical land-use constraints
forest and open-land parent masks
vegetation and agriculture habitat masks
nested field and canopy subdivision
microrelief and procedural surface fields
stable instances
wind and season parameters
runtime compilation
QA, release, rollback
```

Procedural fields may refine an approved parent mask. They may not override a truth layer or create land use in an ecologically or historically invalid location.

## Height model

Keep three separate height concepts:

```text
z_truth_m
source DEM height, read-only

z_micro_delta_m
reversible erosion, bund, terrace, crop-row, canopy, and surface-detail increments

z_visual_m
runtime display height derived from truth plus approved visual increments
```

Never rewrite the truth height grid to add erosion, fields, vegetation, or visual relief.

## Hard exclusions

The following are hard exclusions for terrestrial vegetation and agriculture unless a project-specific rule explicitly allows a compatible class:

```text
permanent water
active river channel
active bank core
road core
building footprint
airport protection area
strong karst rock core
vertical or near-vertical cliff
```

Additional rules:

```text
wild woody vegetation is excluded from crop interiors and orchard interiors
large trees and dense shrubs are excluded from strong exposed-rock cores
paddy is excluded from ridges, peaks, cliffs, exposed-rock cores, roads, buildings, airports, and non-irrigable high terraces
```

Every generated instance must carry the exclusion checks that allowed it to exist.

## Landform classes

At minimum, projects must distinguish:

```text
permanent water
active bank
bare or disturbed bank
floodplain
alluvial terrace
footslope
mid-slope
ridge or peak
karst or bedrock cliff
high plateau or shoulder
artificial agricultural terrace
```

Natural karst shoulders do not automatically become farmland. Without historical evidence and irrigation logic, they support rock, grass, drought shrubs, or sparse woodland.

## Hydrology and river continuity

Major rivers are truth-constrained. River masks must be continuous through tile and AOI boundaries.

Requirements:

```text
main channels use approved vectors and DEM drainage
tributaries follow downhill flow and approved catchments
river lines are repaired before rasterization
line-to-polygon conversion must preserve channel continuity
water is clipped with the same global AOI transform as terrain
water may not jump outside the terrain edge due to coordinate or texture inversion
```

Every erosion channel must descend into permanent water or an approved drainage channel. Decorative closed channels, ridge crossings, uphill segments, and suspended channels are prohibited.

## Vegetation knowledge model

Each prototype records:

```text
prototype ID
common name and scientific group
kind: tree, shrub, bamboo, fruit tree, grass, crop
allowed landforms
slope range
elevation range
distance-to-water range
moisture range
aspect preference
settlement-distance range
height range
crown-width range
crown shape
trunk scale
palette range
grouping mode
wind stiffness and phase range
forbidden masks
evidence status
1940-1945 verification status
```

Randomness controls individual variation only after habitat approval.

## Tree and forest system

A city project should normally use at least 18 active tree, shrub, bamboo, and orchard prototypes in a detailed core sample.

Required visual differences include:

```text
height
crown width
crown profile
trunk thickness
branch density
canopy porosity
palette
cluster density
age and scale variation
```

The forest system uses one stable source release across distance:

```text
far view
forest parent mask, canopy aggregate color, canopy height, broad species mix

medium view
three offset canopy layers, crown-profile response, trunk hints, shrub edges, parallax depth

near view
budgeted trunks, branches, crown clusters, leaf clusters, shrubs, bamboo clumps
```

Avoid maintaining unrelated manual near, medium, and far forests. Stable IDs and shared global fields must keep the same forest structure across distance changes.

## Three-layer canopy method

The reference procedural method is translated as follows:

1. Create a parent forest mask from terrain, moisture, land use, and exclusions.
2. Evaluate three offset global-coordinate cellular fields inside the forest mask.
3. Convert each cellular field into a crown-lobe height and shade response.
4. Use prototype crown classes to shape broad rounded crowns, irregular riparian crowns, narrow conifers, low bamboo crowns, and high bamboo crowns.
5. Combine the layers for far and medium canopy volume.
6. Reveal matching trunk and crown instances at near distance.

The three canopy layers must not restart at tile boundaries.

## Forest-edge shrubs

A forest edge should normally transition through a shrub belt before open ground. The belt width and density depend on landform, disturbance, moisture, road proximity, and agricultural boundaries.

Large riparian shrubs, forest-edge shrubs, drought shrubs, and low tangled thickets must remain separate classes.

## Riverbank sequence

The default riverbank sequence is:

```text
permanent water
bare or active bank
riparian shrub
riparian tree
phoenix-tail bamboo
moso bamboo or alluvial-terrace vegetation
```

This sequence may be interrupted by roads, villages, field access, embankments, disturbed banks, and irrigation cuts.

## Bamboo

### Phoenix-tail bamboo

```text
height: approximately 3-8 m
dense low clumps
arching group silhouette
outer riverbanks, field edges, settlement edges
high leaf-tip response to wind
```

### Moso bamboo

```text
height: approximately 8-17 m
tall culms with lighter upper canopy
moist low slopes, terraces, settlement edges
culm bending and top-canopy wind response are separated
```

Bamboo does not form an unbroken wall through roads, bare banks, field entrances, or buildings.

## Parallax strand surface

The carpet and fibre reference is formalized as the `Parallax Strand Surface` method.

It applies to:

```text
grass
rice
vegetables
low crops
shrub understorey
forest floor fibres
```

Distance behavior:

```text
far
base color, roughness, normal, broad direction field

medium
view-dependent parallax strand depth, layer occlusion, fibre direction, stable wind displacement

near
limited real grass blades, rice leaves, crop leaves, stalks, and small clumps
```

Rules:

```text
root or soil contact is fixed
fibre phase uses global projected coordinates
field-local crop orientation is respected
wind displacement is shared with near geometry
parallax cannot create silhouettes outside the approved vegetation or crop mask
```

## Wind system

Use one world-space wind field with species-specific transfer functions.

Minimum parameters:

```text
wind direction
mean speed
gust strength
gust scale
gust travel speed
turbulence scale
season profile
weather profile
```

Response classes:

```text
tree trunk
low-frequency, low-amplitude bend

main branches
medium-frequency bend

fine branches and leaves
higher-frequency detail

phoenix-tail bamboo
group arching with flexible tips

moso bamboo
elastic culms with greater upper-canopy motion

rice and grass
continuous field-scale travelling wave

vegetables
crop-specific stiffness and leaf amplitude

fruit trees
slower crown motion with minor leaf and fruit lag
```

Every instance receives a stable phase. Whole forests or fields may not move in perfect synchronization.

## Agriculture suitability

Agriculture is assigned after terrain and water rules.

### Paddy

Allowed:

```text
flat valley floor
floodplain
alluvial terrace
irrigable low footslope terrace
```

Required checks:

```text
slope threshold
water or irrigation access
drainage direction
no hard-exclusion overlap
no ridge, peak, cliff, or rock-core overlap
```

### Vegetables

Use smaller fields near settlements, roads, water access, and low terraces. Different vegetable classes must have distinct stable palettes, heights, row spacing, and wind stiffness.

Minimum palette families:

```text
normal leaf green
blue green
yellow green
```

### Dryland crops

Place on better-drained terraces and footslopes above paddy suitability. Distinguish maize-like crops, root crops, fallow, and harvested fields.

### Orchard

Place on well-drained footslopes and low terraces. Keep stable:

```text
orchard block ID
row ID
tree ID
row direction
spacing
missing-row pattern
missing-tree pattern
prototype and palette
```

Required orchard groups for the Guilin working catalog include citrus, pomelo, persimmon, and mixed loquat, plum, and peach.

## Field subdivision and crop rows

The reference procedural field method is translated as:

1. Build an approved arable parent mask.
2. Subdivide only inside that mask using stable nested cellular fields.
3. Assign a stable field ID and local orientation.
4. Generate crop rows with a wave field in field-local coordinates.
5. Use global projected coordinates to keep phase continuous across tiles.
6. Derive bund candidates from stable field-edge distance.
7. Allow irrigation channels, drainage outlets, field entries, and roads to cut bunds.

## Bund and irrigation system

A bund has:

```text
narrow raised core
lower vegetated shoulder
optional wet margin
irrigation cuts
drainage cuts
field access cuts
```

Bund height is a reversible microrelief delta. Bunds must remain visible in medium and near views and legible in top view.

## Crop and rice states

At minimum support:

```text
water or transplanting paddy
young seedling rice
green tillering rice
heading rice
mature rice
harvested rice
stubble
fallow
normal green vegetables
blue-green vegetables
yellow-green crops
maize-like dryland crop
root-crop dryland
orchard understorey
```

Each state records color, height, density, roughness, fibre direction, wind stiffness, and seasonal availability.

## Seasonal system for 1940-1945 projects

Projects must expose spring, summer, autumn, and winter profiles. Season changes may affect:

```text
vegetation palette
leaf density
crop stage
field water state
soil wetness
river level
fog and atmosphere
wind profile
nearshore tide profile
```

Season changes do not relocate stable trees, fields, roads, or river geometry.

The historical epoch and season are separate fields:

```text
epoch: 1940-1945
season: spring, summer, autumn, winter
```

## Nearshore tidal band interface

Coastal projects may combine land DEM with a shallow nearshore bathymetry band. The first-stage interface supports tide relationships without requiring a complete deep-ocean model.

Required coastal fields:

```text
coastline
intertidal mask
shallow bathymetry
tidal datum
tide amplitude profile
season profile
estuary and bay masks
island shoreline continuity
```

The shallow band should support approximately the first 10 m of depth where data permits. It must be labeled according to source quality and must not be presented as surveyed deep-sea bathymetry when it is reconstructed or generalized.

## Continuous detail and performance

Detail allocation uses screen footprint, camera altitude, camera speed, focus, occlusion, GPU budget, and memory budget.

Avoid abrupt three-model LOD popping. Use gradual transitions between field shading, parallax volume, and geometry instances.

Runtime outputs should use:

```text
versioned manifests
packed scalar and categorical textures
compact binary instance streams
stable prototype tables
checksums
rollback release references
```

Large per-instance JSON is not a runtime format.

## Project separation

Recommended repository structure:

```text
skills/dem-ecology-surface/
projects/guilin/
projects/kunming/
projects/wenzhou-taizhou/
```

Each project contains:

```text
AOI and core regions
source manifests
DEM and water products
city-specific ecology catalog
city-specific agriculture catalog
historical evidence
season profiles
build reports
web release
release history
```

## Release and rollback

A candidate release cannot become default until it passes:

```text
truth DEM immutability
water exclusion
rock-core exclusion
agriculture exclusion
deterministic rebuild
tile-seam continuity
asset checksums
browser console zero errors
camera and layer tests
visual reference review
Windows package integrity
online endpoint checks
rollback browser test
```

The previous stable release remains available until the new release is approved.

## Required diagnostics

Every detailed-core release should provide:

```text
full aerial overview
water and banks
erosion
rock exposure
landform classes
hard exclusions
species distribution
forest canopy
riverbank and bamboo
paddy and bunds
vegetable fields
dryland fields
orchards
top-view land use
visual montage
```

## Acceptance philosophy

Visual plausibility and geographical correctness are both required.

A visually rich result fails if vegetation occupies the river, paddy appears on a mountain top, water lines break, field rows restart at tile edges, or the rock exposure becomes a repeated procedural pattern.

A geographically correct result also fails if the trees, crops, bunds, wind, and surface detail remain too coarse to support the project’s viewing distance.
