# Reusable Gaea `.terrain` processor contract

## Contents

- [Purpose](#purpose)
- [Canonical graph](#canonical-graph)
- [Processor choice](#processor-choice)
- [Variable contract](#variable-contract)
- [Build Profiles](#build-profiles)
- [Output contract](#output-contract)
- [Template acceptance checklist](#template-acceptance-checklist)

## Purpose

Create the graph once in Gaea 2.3, validate it interactively, and reuse it as a controlled processor through Build Swarm. This reference defines a convention; variable and Profile names are not reserved by Gaea.

## Canonical graph

```text
DEM_Input (File)
  -> Input_Range_Guard
  -> [optional Repair: Heal OR Denoise/Median]
  -> Erosion_Main
  -> Processed

DEM_Input -----------------------> Combine_Preserve (base)
Processed ----------------------> Combine_Preserve (source)
ProcessMask or global mix ------> Combine_Preserve (mask/ratio)
Combine_Preserve ---------------> FinalHeight

Erosion_Main.Wear -------------> Export_Wear
Erosion_Main.Deposits ---------> Export_Deposits
Erosion_Main.Flow -------------> Export_ErosionFlow
FinalHeight -> Slope ----------> Export_Slope
FinalHeight -> Curvature ------> Export_Curvature
FinalHeight -> FlowMap --------> Export_FlowMap
FinalHeight -> Normals --------> Export_Normals
FinalHeight -------------------> Export_Height
```

Do not include Repair nodes by default for good Float32 DEMs. Keep the original input branch available for comparison and controlled blending. Use Gaea's Compare tools and fixed viewport ranges to inspect changes without accidental AutoLevel.

## Processor choice

`Erosion_Main` is a role, not a required node name. Select one validated branch:

| Branch | Use when | Production guidance |
|---|---|---|
| `Erosion2_Main` | building a new detailed Gaea 2.3 processor | prefer multiple short passes for shape preservation; put a larger Erosion Scale before a smaller detail scale |
| `Erosion_Classic` | the Area input must selectively drive Strength, Rock Softness, or Precipitation, or classic controls are required | enable Deterministic for reproducible final builds; distinguish Area processing from a hard post-mask |
| `Wizard2`/`Wizard`/`EasyErosion` | exploring recipes and art direction | keep inside a reviewed, versioned template; expose only stable, tested controls |
| no erosion | faithful cleanup or derive-only delivery | bypass the simulation branch and export a clearly labeled un-eroded result |

Do not bind Classic Erosion and Erosion2 parameters to the same variables merely because their labels resemble each other. Their response, range, and semantics differ. Export only ports exposed by the selected node in the installed Gaea build.

### File node

- Name: `DEM_Input`.
- Bind `Filename` to `InputHeightfield`.
- Turn `Relative Path` off for absolute bridge paths.
- Use `Never Cache` for changing inputs.
- Interpret as a linear grayscale heightfield, not RGB/color.
- Configure Raw or Mapped behavior to match the external bridge context.
- Do not enable `Crop to Square` unless the documented working-grid plan requires it.
- Bake before Hybrid/Tiled builds as Gaea requires.

### Range guard

Inspect that values stay inside the chosen interval. Avoid AutoLevel on precision DEMs because it changes the elevation mapping. If graph operations may exceed 0..1, keep deliberate headroom or use an explicit mapped interval; do not depend on silent clamping.

### Repair branch

- `Heal`: only for quantized, damaged, low-resolution, or artifact-heavy sources where reconstruction is allowed.
- `Denoise`/`Median`: only for verified noise/spikes; compare against the input at a fixed scale.
- NoData holes: fill in GIS before Gaea and retain the original valid-data mask.

### Erosion branch

- Enable `Real Scale` and make Terrain Definition authoritative for feature size.
- For Classic Erosion, expose Duration, Strength, Rock Softness, Downcutting, Inhibition, Base Level, Feature Scale, and only the selective-processing controls actually used.
- For Erosion2, expose Duration, Downcutting, Erosion Scale, selected sediment controls, Shape controls, and selected orographic controls only after their ranges are validated in the installed build.
- Use low values for faithful DEM enhancement and preview differences.
- Enable deterministic processing or disable parallel processing when exact repeatability is required.
- Prefer selective processing/area masks over a hard post-blend when erosion must respond naturally across a boundary.

### Preserve blend

Use `Combine` to blend the processed surface with the original or a protected-area mask. Expose `ProcessMix` if the graph supports a global ratio. Verify which input is base/source and the mask polarity; record it in a graph Note.

Do not use AutoLevel/Equalize after the preserve blend for a geospatial round trip.

## Variable contract

Required strings:

| Variable | Binding | Rule |
|---|---|---|
| `InputHeightfield` | `DEM_Input.Filename` | Absolute existing file |
| `OutputHeightfield` | `Export_Height.OutputPath` | Absolute path without extension, `Location = Explicit` |

Required for website/GIS selective-edit round trips:

| Variable | Binding | Rule |
|---|---|---|
| `InputProcessMask` | mask File node `Filename` | Absolute mask raster aligned exactly to `InputHeightfield`; turn `Relative Path` off and use `Never Cache` |

Connect the mask through Erosion selective processing or the documented preserve blend. Record mask polarity, units, and falloff. Pass its path with `gaea_swarm.py prepare --set InputProcessMask=...`.

Recommended Classic Erosion controls:

| Variable | Meaning |
|---|---|
| `ProcessMix` | Original-to-processed blend; document whether 0 or 1 is original |
| `ErosionDuration` | Simulation duration |
| `ErosionStrength` | Sediment transport/erosion strength |
| `RockSoftness` | Material erodibility |
| `Downcutting` | Channel incision |
| `Inhibition` | Restraint on downcutting |
| `BaseLevel` | Lower erosion/deposition control |
| `FeatureScaleMeters` | Largest erosion feature scale in metres |
| `Deterministic` | Exact-repeatability mode when bound by the installed version |

Recommended Erosion2 controls, using recipe-specific variable names:

| Variable | Meaning |
|---|---|
| `E2Duration` | simulation duration; keep short when preserving the imported form |
| `E2Downcutting` | channel incision |
| `E2ScaleMeters` | largest erosion feature scale |
| `E2SuspendedLoad` | fine, mobile sediment contribution |
| `E2BedLoad` | gravel-like transport/deposition contribution |
| `E2CoarseSediments` | heavy, fast-settling material contribution |
| `E2Shape` | amount of erosion-led peak/ridge reshaping |
| `E2ShapeSharpness` | concavity/sharpness of the reshaped form |
| `E2ShapeDetailScale` | hierarchy of simulated shape detail |
| `E2OrographicEnable` | enables directional/altitude/slope precipitation influence |
| `E2RainDirection` | direction of stronger precipitation, using the node's documented convention |
| `E2RainShadow` | terrain blocking influence on precipitation |

For a multi-pass Erosion2 graph, prefix every control with its pass, such as `Broad_Duration` and `Fine_Duration`. Do not assume these convention names are Gaea property names; create Variables in the UI and bind them to the exact installed properties.

Optional water/design controls:

| Variable | Meaning |
|---|---|
| `HydroFixDowncutting` | small pre-flow correction amount |
| `RiverWater` | river headwater volume/control |
| `RiverWidth` | artistic river width |
| `RiverDepth` | rendered/carved river depth |
| `RiverDowncutting` | river channel incision |
| `LakeMode` | Simple or Advanced choice when exposed safely |
| `SeaLevel` | artistic sea level in the template's working domain |

Water variables do not create scientifically validated hydrology. Bind them only in a water-specific template, and preserve authoritative hydrography separately.

Optional explicit output strings:

- `OutputWear`
- `OutputDeposits`
- `OutputErosionFlow`
- `OutputSlope`
- `OutputCurvature`
- `OutputFlowMap`
- `OutputNormals`
- `OutputColor`

Give every exposed property a unique name across the whole graph. Duplicate variable names can overwrite each other. Only expose stable, intentional controls; keep experimental node internals inside a versioned template.

## Build Profiles

Suggested Profiles:

| Profile | Purpose | Typical resolution |
|---|---|---|
| `Preview_1K` | Fast graph/parameter check | 1024 |
| `Review_4K` | Visual and difference QA | 4096 |
| `Final_Full` | Full single terrain | Contract-specific |
| `Tiles_Final` | Engine/world tiles | Contract-specific |

Store destination, resolution, node outputs, overwrite behavior, tile options, and Terrain Definition in Profiles. Never assume these names exist; read the project or obtain the command copied from Gaea.

For Regions, name each by stable area of interest and preserve its bounds/relationship to the source grid in the external context.

## Output contract

- Height: TIFF32, EXR, or Float RAW/R32; never JPEG; avoid 8-bit/16-bit unless the precision budget is explicit.
- Wear/Deposits/Flow/Slope/Curvature/masks: export only available/required ports, usually TIFF16 or PNG16; 8-bit only if measured QA shows it is sufficient.
- Normals/color: choose bit depth, handedness, up-axis, gamma, and color space for the target application.
- Explicit paths: omit the file extension in variable values.
- Naming: keep output names stable and unique per run.

If multiple outputs share a run, bind every path or use a unique Profile destination. Do not let concurrent jobs write the same folder.

## Template acceptance checklist

Before headless automation:

- the file opens and builds in Gaea 2.3 without missing nodes/assets;
- File and Export paths are bound to variables with unique names;
- a small known DEM survives orientation and scale checks;
- Terrain Definition width/height and meters-per-pixel match the bridge context;
- output is 32-bit, unclipped, and contains the expected dimensions;
- original-versus-processed blend polarity is documented;
- every marked/export node is intentional;
- Profiles and Regions build correctly;
- same seed/settings reproduce the required degree of determinism;
- adjacent tile seam test passes if tiling is enabled;
- **Build > Copy Command Line** works before the wrapper is used.
