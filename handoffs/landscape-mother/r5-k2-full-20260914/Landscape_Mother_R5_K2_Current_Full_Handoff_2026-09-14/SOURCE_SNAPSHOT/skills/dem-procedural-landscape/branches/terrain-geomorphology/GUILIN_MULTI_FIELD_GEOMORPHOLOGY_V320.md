# Guilin Multi-Field Geomorphology Graph v3.2

## Status

```text
controller: 小王
repository: haihao0307/guilin-dem-pipeline
branch: skill/dem-procedural-landscape-v010
PR: 51
visualAcceptance: false
productionReady: false
```

This revision freezes the v3.1 page as an initial technical baseline and starts a new Guilin-specific geomorphology graph. The graph distils node-graph ideas from procedural terrain systems into a project-owned implementation. It does not require GAEA or World Creator at runtime.

## Gold reference 01

```text
file: 1126796564_16065260452161n.jpg
SHA256: b1711f4c3c119e6a0620b6a06561cb2eab4c1823e251b52d8153b47d4674f7bd
public redistribution: false
public image embedding: false
```

Only derived observations are stored in the public repository:

```text
multiple foreground, middle-ground and background peak layers
many tower peaks rather than one central dome
short peak feet around an open lowland valley
broad paddy plain with local contour terraces
field boundaries, ponds and drainage as a connected system
```

## Fixed truth boundary

```text
z_truth_m: read-only 12.5 m DEM
z_base_resampled_m: runtime interpolation layer
z_macro_delta_m: reversible tower profile and footslope graph
z_micro_delta_m: reversible process and engineering detail
truthOverwrite: false
truthMutationCount: 0
vegetationInstances: 0
verticalScale: 1.0
```

## Scale graph

```text
20.48 km regional layer
  peak-group distribution
  distant silhouette
  regional valley continuity

6.4 km geomorphology layer
  tower peak detection
  prominence and non-maximum suppression
  peak family and saddle relationships
  valley protection

512 m local layer
  1 m desktop grid
  2 m mobile grid
  cliff process detail
  paddy bunds and drainage
  riverbed and water cross-sections
```

## Operator graph

### Truth derivatives

```text
small, medium and coarse smoothing
slope
relative relief
valley mask
karst mask
paddy suitability mask
```

### Peak skeleton

```text
local maxima
prominence
non-maximum suppression
stable peak seed
height-to-footprint target
anisotropic orientation
```

### Macro profile

```text
anisotropic tower envelope
profile shaper
domain warp
asymmetry field
footslope contraction
edge feather
valley hard exclusion
```

The valley exclusion is a hard gate. Vertices classified as protected valley do not receive macro peak deltas.

### Process detail

```text
ridged FBM
Worley pitting
downslope grooves
directional layering
large cracks
medium cracks
small cracks
```

The operators are multiplied by the karst parent mask and share projected world coordinates, so their phase does not restart at patch boundaries.

### Paddy engineering

```text
warped Worley field cells
local level quantisation
bund distance field
drainage groove field
```

Paddy detail is allowed only in low-slope, low-relief, protected valley areas. Plant geometry remains outside this build.

### River geomorphology

```text
approved Lijiang centreline
4 m resampling
variable width
11-vertex cross-section
longitudinal water profile
bank transition
channel carve
continuous water surface mesh
```

Tube geometry and floating centreline rendering are forbidden.

## Visual review order

```text
01 overall peak distribution and depth layers
02 height-to-footprint proportion
03 short footslope and open valley ratio
04 paddy plain and local terrace relationship
05 riverbed, bank and water-surface relationship
06 cliff grooves, fissures and material response
07 vegetation integration in a separate system
```

Automated QA checks data, geometry, reversibility and browser execution. It cannot mark the page visually approved.
