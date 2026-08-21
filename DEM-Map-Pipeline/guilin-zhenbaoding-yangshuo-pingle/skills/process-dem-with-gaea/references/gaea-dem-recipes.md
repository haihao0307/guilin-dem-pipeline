# Gaea graph recipes for imported DEMs

These are graph-planning recipes for Gaea 2.3. Author and validate them in the UI, then expose only the controls required by the production contract. Do not synthesize or patch undocumented `.terrain` serialization.

## Contents

- [Choose a recipe](#choose-a-recipe)
- [Shared graph frame](#shared-graph-frame)
- [Recipe A: faithful cleanup](#recipe-a-faithful-cleanup)
- [Recipe B: restrained Erosion2 enhancement](#recipe-b-restrained-erosion2-enhancement)
- [Recipe C: mask-driven classic erosion](#recipe-c-mask-driven-classic-erosion)
- [Recipe D: multi-scale Erosion2](#recipe-d-multi-scale-erosion2)
- [Recipe E: water and drainage design](#recipe-e-water-and-drainage-design)
- [Recipe F: cliffs, karst, and talus](#recipe-f-cliffs-karst-and-talus)
- [Recipe G: web material maps](#recipe-g-web-material-maps)
- [Acceptance protocol](#acceptance-protocol)

## Choose a recipe

| Goal | Recipe | Primary acceptance measure |
|---|---|---|
| Remove known noise/spikes without redesign | A | protected control-point deltas and difference percentiles |
| Make a DEM read more naturally at web scale | B | preserved silhouette/drainage plus visible improvement at delivery LOD |
| Apply precise edits from a website/GIS mask | C | mask alignment, falloff, allowed changes, reproducibility |
| Create stronger artistic terrain with large and fine erosion | D | large-to-small feature hierarchy, no clipping, stable seed |
| Add believable water features for visualization | E | continuous visual networks and overlay alignment; never analytical validity |
| Emphasize Guilin-like steep rocky relief | F | no global inflation, protected valleys, slope-limited displacement |
| Generate masks/color/normal support for Three.js | G | shared grid, linear decoding, channel manifest, no tile seams |

## Shared graph frame

Every processor starts and ends with the same control structure:

```text
DEM_Input (File, variable InputHeightfield)
  -> Input_Guard
  -> Recipe_Branch
  -> Preserve_Blend (original + processed + optional mask)
  -> FinalHeight

DEM_Input ---------> Difference/Compare --------- Recipe_Branch
FinalHeight -------> Derive maps ----------------> Export nodes
```

Requirements:

- keep `DEM_Input` untouched and visible for Compare;
- do NoData repair, reprojection, padding/cropping, and authoritative normalization in GIS;
- set Terrain Definition before erosion from metric width and encoded vertical interval;
- bind all bridge paths and approved artist controls to ASCII-safe unique Variables;
- write graph Notes for input range, mask polarity, Combine input order, and output units;
- build a Preview profile before Review/Final.

Use `Compare` for visual inspection and compute a numeric difference raster in GIS. Do not insert Autolevel/Equalize in the height path to make a result appear more dramatic.

## Recipe A: faithful cleanup

Use only for defects that were observed during preflight.

```text
DEM_Input
  -> [Median OR Denoise]
  -> Cleaned

DEM_Input + Cleaned + DefectMask
  -> Combine_Preserve
  -> FinalHeight
```

Rules:

- prefer a GIS-generated `DefectMask` covering known spikes, striping, or repaired gaps;
- choose Median for isolated spikes/speckles and Denoise for verified random noise;
- use the smallest effective setting and a soft mask edge;
- use Heal only for an explicitly artistic reconstruction of quantized/low-quality material;
- export the change mask and retain the original validity mask.

Reject the recipe if ordinary ridges, terraces, roads, embankments, or other real features disappear outside the defect mask.

## Recipe B: restrained Erosion2 enhancement

Use for a visualization copy that should remain recognizably faithful.

```text
DEM_Input
  -> Erosion2_Broad (short duration, shape preservation)
  -> Processed

DEM_Input + Processed + OptionalProcessMask
  -> Combine_Preserve
  -> FinalHeight
```

Tune in this order:

1. Set Terrain Definition and confirm meters per pixel.
2. Choose Erosion Scale from features that should remain visible in the final website LOD.
3. Keep Duration short; change one control at a time.
4. Keep Shape near the preservation end unless redesign is allowed.
5. Add Suspended Load sparingly for gully detail; balance Bed Load against Downcutting when channels become empty trenches.
6. Add Coarse Sediments only when scree/fan deposits are part of the art direction.
7. Control final intensity through a documented Preserve Blend or a simulation-area mechanism supported by the chosen node.

Do not transfer numeric values from Classic Erosion to Erosion2 as if the controls shared units or response curves.

## Recipe C: mask-driven classic erosion

Use when a web/GIS edit mask must affect a simulation property while flow can cross the mask boundary.

```text
DEM_Input ---------------------> Erosion_Classic
ProcessMask (File) -----------> Erosion_Classic.Area

Erosion_Classic.AreaEffect = one of:
  Erosion Strength | Rock Softness | Precipitation Amount

Erosion_Classic -> Processed
DEM_Input + Processed + OptionalHardBoundaryMask
  -> Combine_Preserve
  -> FinalHeight
```

Rules:

- rasterize `ProcessMask` on the exact working grid and record black/white meaning;
- use the Erosion Area input when natural cross-boundary material transport is desired;
- use `Combine` with a mask when the final displacement must be strictly contained;
- soften the mask in projected metres, not arbitrary browser pixels;
- use deterministic mode for reproducible publish builds and record the speed cost;
- export Wear, Deposits, Flow, FinalHeight, and a change mask when required.

Never accept an executable path, `.terrain` path, output path, or arbitrary variable name from the browser. The server selects a template and allowlisted bindings.

## Recipe D: multi-scale Erosion2

Use for artistic terrain where erosion is allowed to create a hierarchy of valleys and gullies.

```text
DEM_Input
  -> Erosion2_LargeScale (large Erosion Scale, short/moderate Duration)
  -> Erosion2_FineScale  (smaller Erosion Scale, short Duration)
  -> [optional Thermal2 on slope mask]
  -> FinalHeight
```

Rules:

- run the larger Erosion Scale first, as recommended by the official workflow;
- prefer multiple short passes when retaining the base shape;
- keep a stable seed per pass and name variables with the pass, such as `LargeScale_Duration`;
- use Erosion2 Shape/Sharpness only where peak and ridge redesign is intended;
- reduce fine displacement that cannot survive the final mesh/height-grid sampling;
- evaluate deposits and valleys after each pass, not only the combined result.

For a faithful visualization, return to Recipe B; Recipe D creates an artistic derivative.

## Recipe E: water and drainage design

Choose one branch based on intent.

### Inspect or encourage flows

```text
DEM_Input -> HydroFix_Low -> FlowMap -> Export_Flow
```

Compare HydroFix output against the source and keep its downcutting minimal. Skip HydroFix if the only purpose is to feed Rivers.

### River network

```text
DEM_Input + OptionalHeadwatersMask
  -> Rivers
  -> RiverAdjustedHeight + available river masks/surface
```

Use an aligned Headwaters mask to constrain origins. Decide whether Rivers is an early valley-carving stage or a late water-overlay stage; do not mix those roles silently.

### Lakes and sea

- use Lake Simple for a controlled source/location workflow;
- use Lake Advanced for precipitation/distribution/shore controls;
- use Sea for global or edge-fed water and optional coastal response.

Keep authoritative real-world hydrography as a separate overlay. Gaea-generated networks can enhance a visualization but do not overwrite surveyed river/lake geometry without an explicit artistic decision.

## Recipe F: cliffs, karst, and talus

Use for steep limestone/rock character such as a Guilin-inspired visualization, not as a geological reconstruction.

```text
DEM_Input
  -> Slope/Curvature selectors
  -> SoftRockMask

DEM_Input -> [restrained Erosion2 or Classic Erosion] -> Eroded
Eroded + SoftRockMask -> [Thermal2 OR Crumble] -> Weathered
Weathered + SteepSlopeMask -> [Outcrops/Rockscape/Roughen] -> Detailed
DEM_Input + Detailed + ArtDirectionMask -> Preserve_Blend -> FinalHeight
```

Rules:

- preserve the observed summit/valley silhouette before adding rock detail;
- use Thermal2 for talus and slope relaxation; use Crumble for controlled edge collapse;
- use Outcrops/Rockscape/Roughen primarily on steep or exposed masks;
- protect urban, river, road, and other constraint corridors with a GIS mask;
- push sub-grid rock detail into normals/material masks instead of height;
- label the result as an artistic visualization derived from the DEM.

Avoid stacking Thermal2, Crumble, Shatter, Shear, and strong Outcrops simultaneously without isolating and reviewing each contribution.

## Recipe G: web material maps

Derive outputs from `FinalHeight` and the chosen erosion stage:

```text
FinalHeight -> Slope -------> Export_Slope
FinalHeight -> Curvature ---> Export_Curvature
FinalHeight -> FlowMap -----> Export_FlowMap
FinalHeight -> Normals -----> Export_Normals
FinalHeight -> AO/Occlusion -> Export_AO_or_Occlusion

Erosion.Wear -------------> Export_Wear
Erosion.Deposits ---------> Export_Deposits
Erosion.Flow -------------> Export_ErosionFlow
```

Optional presentation branch:

```text
Height/Slope/Curvature/Wear/Deposits
  -> TextureBase/Texturizer/CLUTer/SatMap/SuperColor
  -> Export_Color
```

Rules:

- export only ports that exist on the selected node and are part of the manifest schema;
- keep height/masks/normals linear and color outputs color-managed;
- use fixed global ranges across tiles and variants;
- document normal space/axis, mask polarity, packed channels, bit depth, and decode rules;
- prefer runtime palettes when users need switchable styles; use baked color for fixed art direction;
- match TextureBaker/Mesher LOD outputs only when delivering a mesh asset.

## Acceptance protocol

For every recipe:

1. Build a low-resolution preview with a fixed seed and known input hash.
2. Inspect source/result with identical camera, lighting, and fixed value stretch.
3. Compute GIS difference statistics and clipping/NoData counts.
4. Probe control points inside and outside every protected/edit mask.
5. Build a Review profile at the intended physical Terrain Definition.
6. For tiles, build at least two adjacent outputs and compare every border and data map.
7. Decode and display the packaged height and maps in the Three.js client.
8. Publish only an immutable version containing project/variable/profile/seed/output hashes.

Stop on unexplained changes outside the contract, especially lost CRS context, silent crop, axis inversion, clipping, mask misalignment, tile seams, or false claims that an artistic result remains survey-grade.
