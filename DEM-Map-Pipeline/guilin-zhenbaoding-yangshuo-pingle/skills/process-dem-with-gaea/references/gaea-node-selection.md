# Gaea 2.3 node selection for DEM production

Verified against QuadSpinner's official Gaea 2.3 documentation on 2026-08-15. Use this as a routing guide, not a substitute for checking the properties and ports in the installed build. Gaea 2.3.0.1 is the current production release at this revision.

## Contents

- [Fast routing](#fast-routing)
- [Input and numeric range](#input-and-numeric-range)
- [Erosion selection](#erosion-selection)
- [Water and drainage](#water-and-drainage)
- [Repair, shape, and surface](#repair-shape-and-surface)
- [Derived maps and color](#derived-maps-and-color)
- [Graph utilities](#graph-utilities)
- [Output selection](#output-selection)
- [Production rules](#production-rules)
- [Official sources](#official-sources)

## Fast routing

| Intent | Start with | Add only when justified | Avoid by default for authoritative DEMs |
|---|---|---|---|
| Import a DEM | `File` | `Flip`/`Transform` only for a documented orientation fix | unnoticed `Crop to Square`, RGB interpretation, caching changing inputs |
| Repair damaged source | GIS void repair, then `Median` or `Denoise` | `Heal` for visibly quantized, 8-bit, JPEG-damaged, or low-resolution material | claiming reconstructed detail is measured elevation |
| Subtle naturalization | `Erosion2` with short duration and shape preservation | second smaller-scale pass; source/process blend | one destructive long pass |
| Controlled classic erosion | `Erosion` | `Area` input for selective Strength, Rock Softness, or Precipitation | confusing selective processing with a hard output mask |
| Fast look exploration | `Wizard2`, `Wizard`, or `EasyErosion` | save candidate settings and reproduce them in a locked template | exposing preset/style choices as unbounded public controls |
| Talus and slope breakdown | `Thermal2` | `Debris`, `Scree`, or `Crumble` on a constrained mask | applying everywhere to a real DEM |
| Improve procedural flow continuity | `HydroFix` before flow/erosion | `FlowMap` for inspection | using it before `Rivers`, which already contains equivalent correction |
| Generate artistic waterways | `Rivers`, `Lake`, or `Sea` | headwater, shore, or edge masks | describing the result as hydrological analysis |
| Add rocky character | `Outcrops`, `Rockscape`, `Roughen`, `GroundTexture` | slope/curvature/height masks | displacing below the website's sampling scale |
| Produce terrain masks | `Height`, `Slope`, `Angle`, `Curvature`, `FlowMap` | `RockMap`, `Soil`, `Occlusion`, `TextureBase` | autoleveling each tile independently |
| Produce web data | `Export` for height/masks | `Mesher`/`TextureBaker` for a justified mesh workflow | assuming a Gaea GLB preserves CRS or is the best city-terrain runtime format |

## Input and numeric range

### File

Use `File` for a heightfield, mask, or color asset. For bridge jobs:

- bind the filename to a String variable;
- use an absolute path, disable `Relative Path`, and enable `Never Cache` for changing inputs;
- leave `Is RGB` off for height and masks and keep data linear;
- bake the File node before Hybrid or Tiled builds;
- decide `Raw`, `Normalized`, or `Mapped` scale from the external elevation contract;
- enable `Allow Unclamped` only when the graph deliberately handles values outside 0..1;
- never let `Crop to Square` silently change the footprint.

`Mapped` is the useful bridge mode when an external system must retain a fixed numeric interval. Keep the authoritative elevation offset/range in the external context even when the Gaea working field is normalized.

### Range-changing nodes

`Autolevel`, `Equalize`, `Extend`, `Clamp`, `Clip`, `Curve`, `Adjust`, `Match`, and some Combine modes change value distribution. They are valid artistic tools but dangerous in a geospatial round trip.

- Keep a fixed range and deliberate headroom through the displacement path.
- Use `Clamp` only with a documented interval and record clipped sample counts.
- Use Autolevel/Equalize on display copies of masks when needed for inspection, not on the authoritative height path or independently per tile.
- Use `Compare` or a difference branch to inspect changes without remapping the source.

## Erosion selection

### Decision matrix

| Node | Best use | Main controls/behavior | Production note |
|---|---|---|---|
| `Erosion2` | Default detailed hydraulic erosion for new 2.3 templates | Duration, Downcutting, Erosion Scale; suspended/bed/coarse sediment; Shape; orographic influence | deterministic, GPU/CPU capable; use large-scale passes before small-scale passes |
| `Erosion` | Precise classic control and selective processing | Duration, Strength, Rock Softness, Downcutting, Inhibition, Base Level, Feature Scale, sediment removal | parallel mode can vary fine details; use Deterministic when exact reproducibility matters |
| `Wizard2` | Quick Erosion2-style art direction | Power, Depth, Scale, Deposits, Flow, Shape, Detail | good for discovery; lock a tested graph before automation |
| `Wizard` | Curated classic erosion with two recipe phases | Strength, material/density, channel depth/width, deposits, removal, Bulk | Bulk helps preserve delicate forms under stronger erosion |
| `EasyErosion` | Fast preset exploration | style, influence, direction, bias, seed | use as a controlled preset, not an unexplained correction |
| `HydroFix` | Small pre-pass for longer continuous flows | Downcutting | low-level adjustment; not required before Rivers |
| `Thermal2` | Thermal weathering, talus, slope material movement | Duration, Strength, Anisotropy, talus angle, sediment removal, feature scale | mask it when source shape must be preserved |
| `Crumble` | Collapse along existing edges, crevices, and flow structure | duration, strength, coverage, directional/height bias, hardness, edge, downcutting | strongly artistic; compare against source at fixed scale |

### Erosion2

Prefer Erosion2 for a new general-purpose processor when the required controls exist in the installed edition. Its sediment model separates:

- Suspended Load: fine mobile material that travels far and details gullies;
- Bed Load: heavier gravel-like material that fills and reshapes channels;
- Coarse Sediments: fast-settling rock/debris that produces scree and fan-like deposits.

Use several shorter passes rather than one long pass when retaining the imported landform matters. For multi-scale erosion, put the larger `Erosion Scale` first and the smaller detail pass later. Keep Shape low when preserving the DEM; increase it only when erosion is allowed to redesign ridges and peaks. Orographic controls can bias precipitation by direction, rain shadow, altitude, and slope.

Gaea 2.3 adds Extra Deposits and No Erosion behavior to Erosion2. Verify their exact UI labels, bindings, and output effect in 2.3.0.1 before exposing them through automation.

### Classic Erosion

Use `Area` selective processing when the website or GIS supplies a mask. It modulates a simulation property while material and flow may continue beyond the mask. A normal node mask or post-`Combine` confines the final shape instead. Choose intentionally:

- `Erosion Strength`: vary transport/erosion intensity;
- `Rock Softness`: vary material erodibility;
- `Precipitation Amount`: vary where water enters the simulation.

The principal data outputs are Wear, Deposits, and Flow. Treat them as linear data. Avoid making Flow dominate the final color because it easily creates an artificial procedural look.

## Water and drainage

Gaea water nodes are terrain-design simulations, not replacements for GIS/scientific watershed tooling.

- `HydroFix`: makes small terrain changes that encourage continuous drainage paths. Use before Erosion/FlowMap only after comparing the displacement.
- `Rivers`: generates and carves a river network; a Headwaters mask can constrain origins. It already incorporates flow-path correction, so do not prepend HydroFix automatically.
- `Lake`: Simple mode positions a controlled lake; Advanced mode uses precipitation, small-lake, flood, floor, shore, altitude, and size controls.
- `Sea`: creates global or edge-fed water and optionally coastal erosion, shore, beach, and cliff response.
- `FlowMap`: derive runoff-style data without claiming a hydrologically calibrated discharge model.

Export water depth/surface/shore/channel masks only when the installed node exposes the required ports and the downstream schema defines their units and polarity.

## Repair, shape, and surface

### Repair and form

- `Median`: remove spikes/speckles while preserving edges better than a blur; use the smallest effective radius/mode.
- `Denoise`: remove random noise and extreme sharp artifacts; difference-test for genuine landform loss.
- `Heal`: reconstruct visibly damaged or quantized terrain. It creates plausible detail, not recovered measurement.
- `Shaper`/`Recurve`/`ThermalShaper`: reshape profile or bulk. Keep off the faithful path unless artistic modification is explicit.
- `Transpose`, `Warp`, `SlopeWarp`, `DirectionalWarp`, and `Transform`: valuable for procedural design but alter spatial correspondence. Never use them in a GIS round trip without an explicit transform/mask contract.

### Surface structure

Use surface nodes after the macro landform and major erosion:

- layered geology: `Terraces`, `FractalTerraces`, `Stratify`, `Sandstone`, `Steps`;
- rocky exposure: `Outcrops`, `Rockscape`, `RockNoise`, `Craggy`, `Shatter`, `Shear`;
- superficial breakup: `GroundTexture`, `Roughen`, `Distress`, `Pockmarks`, `Stones`, `Bomber`;
- loose material: `Thermal2`, `Debris`, `Scree`, `Sediments`.

Restrict structural nodes with Height/Slope/Curvature/source-validity masks. If the final Three.js grid cannot resolve the generated displacement, export the detail as a normal/material map instead of modifying height.

## Derived maps and color

### Geometry and material descriptors

| Need | Node | Web/GIS interpretation |
|---|---|---|
| elevation band | `Height` | normalized selection unless externally decoded |
| slope band | `Slope` | verify units/range in the installed node; do not assume degrees from pixels |
| aspect/facing | `Angle` | record orientation convention |
| convex/concave structure | `Curvature` | useful for ridge/crevice masks |
| drainage-style path | `FlowMap` | linear influence data, not calibrated flow |
| shading normal | `Normals` | record tangent/object space and axis convention |
| recess/settling | `Occlusion`, `Soil` | material support maps |
| rock/texture support | `RockMap`, `TextureBase`, `Texturizer` | blend inputs, not measured geology |

Wear, Deposits, Flow, masks, normals, slope, and curvature are data textures. Keep them linear; only actual color outputs use an sRGB/color-managed path.

### Color and channel packing

- `SatMap`, `SuperColor`, `CLUTer`, `Tint`, and `Synth` create presentation color, not analytical classification.
- `ColorErosion` and `Weathering` alter color distribution using terrain-like processes.
- `RGBMerge`, `RGBSplit`, and `Splat` pack/unpack masks. Document every channel, default value, color space, precision, and shared grid in the web manifest.

For the Three.js product, prefer a deterministic palette/shader driven by height and Gaea data maps when users need switchable styles. Bake color only when art direction calls for a fixed appearance.

## Graph utilities

- `Combine`: merge heightfields, masks, or colors. Confirm which input is Base/Source, mask polarity, mode, ratio, output clamping, and enhancement. Keep output unclamped only with an explicit range guard.
- `Compare`: build QA and choice branches without destroying either input.
- `Gate`: establish a bake boundary for Regions/Tiled builds.
- `Chokepoint`, `Route`, `Switch`, `Layers`: organize reusable branches and profile alternatives.
- `Variables`: expose Float, Int, Choice, Color, Range, and String values. Use ASCII-safe unique names, explicit min/max, and bind one variable to multiple properties only when semantics and units match.
- `Expressions`: constrain or derive Float/Int property values. Use them for scaling/clamping related controls, not for hidden arbitrary file I/O.
- `MacroPort` and Macros: package a validated processor with typed/optional inputs and exposed controls. Keep the source `.terrain`; the `.macro` is the distributable artifact.

For external automation, prefer a small, stable allowlist of variables over exposing every node property.

## Output selection

- `Export`: general heightfield, mask, or color export. Explicit output paths omit the extension because the selected format supplies it.
- `Mesher`: OBJ/FBX/DAE/glTF/GLB, normalized/metre/kilometre scale, triangles/quads/adaptive triangles, optional normals/UVs/walls and LODs. A mesh export does not carry the GIS contract automatically.
- `TextureBaker`: bake maps aligned to Mesher LODs when delivering a mesh asset.
- `PointCloud`: use only when the receiver wants point samples; preserve coordinate/elevation metadata outside Gaea.
- `Unity`/`Unreal`: use for their engine-specific conventions, not for Three.js by default.
- `AO`, `Shade`, `LightX`, `Sunlight`, `Cartography`: presentation or support renders; keep separate from numeric terrain outputs.

For a large Three.js city terrain, the default delivery remains a manifest-led heightfield/tiled LOD package. Use Gaea Mesher only when a measured comparison shows that adaptive mesh delivery is better for the target view and overlay alignment.

## Production rules

1. Set Terrain Definition from the projected metric footprint and encoded vertical range before scale-aware simulations.
2. Preserve an untouched input branch and export a source-versus-result difference or compute it in GIS.
3. Change one functional family at a time: repair, macro erosion, fine erosion, surface, derive, then color/output.
4. Seed all procedural nodes that expose a seed. Record Gaea version, Profile/Region, variables, cache choice, and project hash.
5. Build Preview, Review, and Final profiles. Do not infer final behavior from the interactive preview alone.
6. Bake the world stage before Regions/Hybrid tiles. Put tile-local detail after the bake and seam-test adjacent outputs.
7. Keep web-exposed controls within validated ranges. A browser requests parameters/masks; a licensed worker chooses the template and paths.
8. Stop on unexplained clipping, flipped axes, silent crop, lost metadata, NoData fill, seams, or elevation changes outside the allowed mask.

## Official sources

- [Gaea node families](https://docs.gaea.app/reference/nodes/)
- [Complete node map](https://docs.gaea.app/reference/node-map.html)
- [File node](https://docs.gaea.app/reference/nodes/primitive/file)
- [Erosion](https://docs.gaea.app/reference/nodes/simulate/erosion)
- [Erosion2](https://docs.gaea.app/reference/nodes/simulate/erosion2)
- [Erosion2 workflow](https://docs.gaea.app/using/using-gaea/understanding-erosion/erosion_2/)
- [Wizard](https://docs.gaea.app/reference/nodes/simulate/wizard.html)
- [HydroFix](https://docs.gaea.app/reference/nodes/simulate/hydrofix.html)
- [Rivers](https://docs.gaea.app/reference/nodes/simulate/rivers.html)
- [Lake](https://docs.gaea.app/reference/nodes/simulate/lake.html)
- [Sea](https://docs.gaea.app/reference/nodes/simulate/sea.html)
- [Modify nodes](https://docs.gaea.app/reference/nodes/modify/index.html)
- [Surface nodes](https://docs.gaea.app/reference/nodes/surface/)
- [Derive nodes](https://docs.gaea.app/reference/nodes/derive/index.html)
- [Utility nodes](https://docs.gaea.app/reference/nodes/utility/)
- [Output nodes](https://docs.gaea.app/reference/nodes/output/index.html)
- [Variables](https://docs.gaea.app/developers/extensibility/scripting-and-expressions/variables.html)
- [Expressions](https://docs.gaea.app/developers/extensibility/scripting-and-expressions/expressions.html)
- [Macros](https://docs.gaea.app/developers/extensibility/macros/index.html)
- [Gaea 2.3.0.1 release notes](https://quadspinner.com/Download/Changelog)
