# Gaea 2.3 automation and production reference

Verified against QuadSpinner's official documentation on 2026-08-14. The current public Gaea release at that time was **2.3.0.1**, released 2026-05-13. Re-check the official download and CLI help when the installed version differs.

## Contents

- [Supported automation model](#supported-automation-model)
- [Gaea 2.3 production baseline](#gaea-23-production-baseline)
- [CLI contract](#cli-contract)
- [Input, output, and precision](#input-output-and-precision)
- [Scale, regions, and tiled builds](#scale-regions-and-tiled-builds)
- [Determinism and caching](#determinism-and-caching)
- [Edition and license boundaries](#edition-and-license-boundaries)
- [Official sources](#official-sources)

## Supported automation model

Gaea automation starts from a `.terrain` project that already builds successfully in the UI. The supported production pattern is:

1. Author and validate the graph, exports, Terrain Definition, destination, and resolution in Gaea.
2. Expose every changing property as a uniquely named Variable.
3. Bind the File node's `Filename` and each Export node's `OutputPath` to variables.
4. Save repeatable output sets as Build Profiles and focused areas as Regions.
5. Use **Build > Copy Command Line** for a known-good baseline.
6. Invoke `Gaea.Swarm.exe` with the `.terrain` file and variable values.
7. Preserve Gaea's human- and machine-readable post-action reports.

`Gaea.exe` handles UI launch, activation/deactivation, proxy, safe mode, CPU-only mode, diagnostics, and version display. `Gaea.Swarm.exe` is the headless build engine. Do not use the UI executable as the batch builder.

Do not edit `.terrain` serialization by guess. Use UI authoring, Macros, Variables, Expressions, and documented automation surfaces.

## Gaea 2.3 production baseline

The official 2.3.0.1 release notes identify these pipeline-relevant capabilities:

- reusable Macros with exposed parameters, typed/optional MacroPorts, Variables, and Expressions;
- advanced CLI/Build Swarm automation for validated `.terrain` projects;
- Erosion2 Extra Deposits and No Erosion behavior;
- Lake Simple mode for fast controlled lake generation;
- optional Bridge input/output variables;
- 16K baking plus improved Regions, caches, tiled builds, exports, and build diagnostics;
- updated CUDA 12.8 and HIP 6.4 backends with expanded AMD support.

Use features from the installed production build, not the Gaea 3 preview or future SDK promises. Test a representative project before moving a production template between Gaea versions. Read `gaea-node-selection.md` for node choice and `gaea-dem-recipes.md` for imported-DEM graph patterns.

## CLI contract

Current CLI help describes:

```text
Gaea.Swarm.exe --Filename <project.terrain>
  [--ignorecache] [--interactive]
  [--profile <name>] [--region <name>]
  [--safemode] [--seed <integer>]
  [-v <name=value> ...] [--va <values>] [--vars <file>]
  [--verbose]
```

Use `--vars` with JSON for production. Official pages show both `name=value` and `name:value` examples for inline variables; a variable file avoids that ambiguity and produces an auditable artifact.

Example:

```json
{
  "InputHeightfield": "D:\\job\\input\\dem-normalized.tif",
  "OutputHeightfield": "D:\\job\\output\\height",
  "ErosionStrength": 0.18,
  "ProcessMix": 0.25
}
```

For an Export node using `Location = Explicit`, pass a fully qualified output path **without an extension**. Gaea appends the extension selected by the node's format. Turn `Relative Path` off on automated File nodes unless the caller deliberately passes a path relative to the Swarm executable. Disable File-node caching/enable `Never Cache` for changing bridge inputs.

Always quote paths. Prefer absolute paths for bridge jobs. Store the Profile, Region, seed, variables, exact command, exit code, log, reports, `.terrain` hash, and Gaea version.

## Input, output, and precision

Gaea processes heightfields internally as 32-bit floating point. The File node can load grayscale heightfields or RGB color data and supports Raw, Normalized, and Mapped scale behavior. Use Mapped behavior when an external bridge must preserve a defined numeric interval; otherwise use an explicitly recorded normalized working interval.

Relevant formats include:

- 32-bit: OpenEXR, TIFF, float RAW/R32, Gaea RAW;
- 16-bit: TIFF, PNG16, unsigned-short RAW/R16;
- 8-bit: PNG/TIFF and lossy images for masks or damaged-source recovery, not precision displacement;
- mesh: OBJ, FBX, DAE, glTF/GLB; point cloud outputs are also available.

Prefer 32-bit TIFF or EXR for interchange and R32/Gaea RAW for Gaea-to-Gaea transfers. Use 16-bit formats for masks and secondary maps when their precision budget allows. Avoid JPEG and 8-bit displacement. `Heal` can artistically reconstruct quantized or damaged terrain, but cannot restore true measurements.

Useful outputs from an erosion-oriented processor include the final heightfield plus Wear, Deposits, Flow, Slope, Curvature, Normals, and a change/blend mask. Export only required ports.

## Scale, regions, and tiled builds

Terrain Definition stores terrain width and maximum height in meters and reports meters per pixel. It drives scale-aware simulations such as Erosion with `Real Scale` enabled. Set it from the working raster's projected metric footprint and recorded vertical span, not from a visual guess.

Regions rebuild a selected subsection at higher pixel density. Global generators required by Regions must be baked first. Keep macro shape in the world stage and procedural detail after the bake.

For tiled builds:

- ensure the world resolution divides cleanly into the tile grid;
- bake frame-dependent and tile-unfriendly macro operations at a resolution close to the complete world;
- use Hybrid buckets large enough to give simulations neighborhood context;
- treat a 4096 bucket and about 25% blend as starting points, not universal constants;
- inspect at least two adjacent tiles before a full-world build;
- avoid per-tile AutoLevel, Equalize, histogram remapping, or other local normalization;
- preserve linear values for data maps and import them downstream as non-color data.

Profiles should encode complete, named build targets such as `Preview_1K`, `Review_4K`, `Final_Full`, and `Tiles_Final`. These are conventions, not reserved names.

## Determinism and caching

Record a build seed. Gaea's Erosion can vary in fine features under parallel processing. Enable its deterministic option or disable parallel processing when byte-for-byte repeatability matters; expect slower execution.

Reuse baked cache for iteration only when input, graph, scale, and relevant variables match. Use `--ignorecache` for clean verification or suspected stale cache. Keep high-resolution Build Swarm work separate from a resource-heavy open UI when possible.

## Edition and license boundaries

Official 2.3 Macro documentation says Professional and Enterprise can create/use Macros and include exposed parameters, Variables and Expressions, and Automation; Indie can use installed Macros. Edition resolution and commercial-use constraints also apply. Confirm the active edition and current EULA before relying on headless automation or high-resolution output.

Do not automate activation/deactivation or read/copy license material. A floating UI and Swarm may each need a license token. If a build cannot acquire a license, stop and report it rather than retrying aggressively.

## Official sources

- [Gaea download and current version](https://quadspinner.com/download)
- [Gaea 2.3 release notes](https://quadspinner.com/Download/Changelog)
- [Complete Gaea node map](https://docs.gaea.app/reference/node-map.html)
- [Automation overview](https://docs.gaea.app/developers/automation/index.html)
- [Command-line interface](https://docs.gaea.app/developers/automation/cli/index.html)
- [Command-line automation](https://docs.gaea.app/developers/automation/cli/command-line-automation.html)
- [Building a bridge with the CLI](https://docs.gaea.app/developers/automation/building-bridges/building-a-bridge-with-the-cli.html)
- [Managing input and output](https://docs.gaea.app/developers/automation/building-bridges/managing-input-and-output.html)
- [Build Swarm](https://docs.gaea.app/using/advanced-topics/build-swarm/index.html)
- [Build Options](https://docs.gaea.app/ui/interface/build-options/index.html)
- [Terrain Definition](https://docs.gaea.app/ui/interface/build-options/terrain.html)
- [File formats and precision](https://docs.gaea.app/using/advanced-topics/technical-information/file-formats.html)
- [File node](https://docs.gaea.app/reference/nodes/primitive/file)
- [Export node](https://docs.gaea.app/reference/nodes/output/export.html)
- [Tiled builds](https://docs.gaea.app/using/using-gaea/build-and-export/tiled-builds.html)
- [Regions](https://docs.gaea.app/using/using-gaea/build-and-export/regions/index.html)
- [Erosion](https://docs.gaea.app/reference/nodes/simulate/erosion)
- [Building Macros and edition availability](https://docs.gaea.app/developers/extensibility/macros/building-macros.html)
- [Compare editions](https://quadspinner.com/Order/Editions)
