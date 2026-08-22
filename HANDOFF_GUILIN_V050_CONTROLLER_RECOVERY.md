# Guilin v0.5 controller recovery handoff

## Current status

The previously published Guilin candidate remains rejected. Public release and automatic deployment remain disabled. This handoff records the controller fallback implementation that is now physically present in the GitHub branch after the earlier Codex local commit could not be recovered.

The current branch is:

```text
fix/guilin-v050-recover-v031-baseline
```

The review target is:

```text
project/guilin-v050-four-core
```

The active public stable release remains `v0.3.1`.

## Actual files now in the branch

```text
web/guilin-v050/index.html
web/guilin-v050/style.css
web/guilin-v050/manifest.json
web/guilin-v050/bootstrap.js
web/guilin-v050/runtime.js
tests/test_guilin_v050_recovery_runtime.py
.github/workflows/guilin-v050-private-qa.yml
HANDOFF_GUILIN_V050_CONTROLLER_RECOVERY.md
```

These are executable candidate files and tests, rather than task descriptions alone.

## Recovered baseline behavior

The private runtime consumes the existing v0.3.1 runtime assets already stored in the repository:

```text
257 × 257 height grid
field0 elevation, slope, forest and permanent water
field1 paddy, bund, rows and rock exposure
field2 wetness, terrace, erosion and land use
23,685 tree, bamboo and orchard records
7,322 shrub records
5,277 rice-cluster records
20 vegetation archetypes
8 crop palette classes
68 erosion streamlines
zero validated terrestrial vegetation in permanent channels
```

The terrain and field shader restores:

```text
permanent-water masking
paddy and non-rice agriculture classes
distinct crop palette families
raised bund cores and lower shoulders
terrace microrelief
karst rock exposure
erosion cores and shoulders
three globally stable canopy layers
far atmospheric haze
```

The instance runtime restores:

```text
species-dependent broadleaf, conifer, bamboo, shrub and orchard crown shapes
tree-trunk cues
stable world-space wind phase
root-locked sway
seasonal color response
rice-cluster movement
medium-distance canopy and fibre detail
```

## Core policy

The fixed Guilin core list remains:

1. Zhenbao Ding
2. Guilin old city
3. former Yangtang airfield
4. Yangshuo county seat

Each core is exactly 10 km × 10 km in EPSG:32649. Detailed ecology is restricted to the active core. The current private implementation binds the recovered v0.3.1 visual baseline to the former Yangtang airfield core only. The other three core buttons explicitly report that truthful 12.5 m DEM and ecology fields remain pending. They do not substitute proxy terrain silently.

## Camera recovery

The candidate uses physical metres rather than a fixed normalized height offset. It includes:

```text
terrain height sampling
bilinear ground interpolation
pointer ray and iterative ray to height-field intersection
terrain collision
ground-observer mode at 1.7 m clearance
adaptive near clipping from about 0.08 m to 0.22 m in ground mode
continuous wheel zoom
right-drag and Shift-drag terrain-plane pan
double-click terrain focus
WASD and arrow movement in ground mode
camera diagnostics in metres
```

The old fixed `+0.12` camera-height rule is absent from the recovery runtime.

## GAEA and hydrology separation

The page exposes two separate groups:

```text
GAEA terrain visual controls
Hydrology controls
```

GAEA controls adjust reversible visual response for vertical emphasis, erosion display and karst exposure.

Hydrology controls separately expose the baseline permanent-water surface, bank diagnostics and continuity diagnostics. The named Li River and Xiang River switch is intentionally blocked until the topology asset is physically present and validated. The UI reports this state rather than pretending the named network is complete.

## Private runtime guard

The controller identified one invalid conditional expression after writing the initial runtime. `bootstrap.js` loads the private runtime as text, repairs that one known expression, verifies the invalid source pattern is gone and imports the repaired module from a Blob URL. The branch QA writes the repaired module to a temporary `.mjs` file and runs `node --check` on the exact transformed source.

This guard is temporary. Before final promotion the source file itself must be rewritten cleanly and the bootstrap replacement list must be empty.

## Automated tests and private artifact

The focused Python tests validate:

```text
publication remains blocked
four fixed core identities and dimensions
active-core-only detailed ecology
real v0.3.1 baseline asset sizes and record counts
executable terrain, ecology, crop, bund, erosion and camera systems
separate GAEA and hydrology controls
known source defect repair and transformed Node syntax
baseline metrics
```

The private QA workflow:

```text
validates JSON
runs Python tests
checks bootstrap syntax
checks transformed runtime module syntax
assembles a private static artifact
copies the baseline height grid into the candidate artifact
checks stable and candidate HTTP routes and all required assets
verifies publication remains blocked
uploads a private artifact only
```

The workflow contains no Pages deployment step.

## Remaining blockers

The candidate cannot be published until all of the following are complete:

```text
full Guilin AOI has one verified continuous 12.5 m terrain lineage
Zhenbao Ding source gap is resolved
Li River and Xiang River named topology is generated from approved source geometry
zero bridge triangles and zero unexplained normal-view lines are demonstrated
all four real 10 km × 10 km core DEM packages are mounted
v0.3.1 ecological behavior is rebuilt against each real core DEM
private browser screenshots are captured for overall and all required core views
browser console error count is zero
black perimeter is absent in rendered screenshots
GAEA and hydrology controls are visibly functional
all four cores reach ground-observer altitude
controller visual approval is recorded
```

## Rollback

No public runtime is changed by this branch. Closing the draft PR or deleting the private recovery artifact leaves the stable v0.3.1 deployment unchanged.
