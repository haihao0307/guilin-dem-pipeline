---
name: process-dem-with-gaea
description: Build safe, repeatable DEM terrain pipelines around QuadSpinner Gaea 2.x and deliver precise Three.js/WebGL terrain websites. Use when Codex must inspect or clean a DEM; select Gaea nodes or recipes using Erosion, Erosion2, Wizard, HydroFix, Rivers, Lake, Thermal, surface, derive, color, utility, or output functions; preserve CRS, transform, NoData, physical scale, and elevation range; automate a validated .terrain template with Gaea.Swarm.exe; produce height, wear, deposits, flow, slope, normal, mask, tiled, region, mesh, or web assets; package terrain for Three.js; or build a website-to-Gaea mask/parameter round trip. Trigger on Gaea, DEM, DTM, DSM, heightmap, heightfield, terrain erosion, tiled terrain, Gaea Build Swarm, Three.js terrain, WebGL terrain, GIS-to-Gaea bridge, or DEM website work. Do not use for generic image editing or unrelated GIS analysis.
---

# Process DEM with Gaea

Treat Gaea as a scale-aware terrain compiler inside a geospatial and web pipeline, not as the system of record for CRS or elevation metadata and not as browser runtime code. Preserve the source context outside Gaea, process a controlled heightfield, restore and verify it, then compile browser-sized height/texture/overlay assets for Three.js.

## Route the task

1. For source inspection or acceptance testing, run `scripts/dem_preflight.py` and read [references/dem-production.md](references/dem-production.md).
2. For Gaea installation, editions, formats, variables, profiles, regions, tiling, or CLI behavior, read [references/gaea-2.3.md](references/gaea-2.3.md).
3. For choosing among Gaea's repair, erosion, water, surface, derive, color, utility, and output nodes, read [references/gaea-node-selection.md](references/gaea-node-selection.md).
4. For a concrete imported-DEM graph such as faithful cleanup, restrained or multi-scale erosion, mask-driven editing, water design, karst/cliff treatment, or web material maps, read [references/gaea-dem-recipes.md](references/gaea-dem-recipes.md).
5. For creating or reviewing the reusable `.terrain` processor template and its variable/output contract, read [references/graph-contract.md](references/graph-contract.md).
6. For Three.js data contracts, the inspected Guilin reference, LOD, overlays, precision editing, and runtime QA, read [references/threejs-delivery.md](references/threejs-delivery.md).
7. For a headless build, run `scripts/gaea_swarm.py`; start with `detect`, then `prepare`, `command`, `run --execute`, and `verify`.
8. For a browser-ready terrain package, run `scripts/package_three_terrain.py` after restoring the intended elevation domain.

## Execute the production workflow

Resolve a real Python 3 interpreter before running bundled scripts. In Codex desktop, call the workspace-dependency locator when it is available and `python` resolves only to the Microsoft Store stub. `dem_preflight.py` and `gaea_swarm.py` use the standard library, with optional GDAL/Rasterio/Pillow enrichment; `package_three_terrain.py` requires NumPy and requires Pillow for TIFF/PNG input or resampling. If no suitable existing interpreter/dependency set is available, report the blocker. Do not download or install a Python runtime or dependencies, even into a task-local directory, unless the user requested installation.

### 1. Define the contract

Record before changing data:

- intended use: visualization, game/film terrain, print/cartography, or analytical surface;
- source path, DEM/DTM/DSM semantics, CRS, horizontal and vertical units/datums, transform, bounds, resolution, NoData, and band;
- target footprint, pixel grid, elevation behavior, output formats, downstream application, and reproducibility requirement;
- modification class: faithful repair, restrained visualization enhancement, mask-driven edit, or artistic redesign;
- whether artistic terrain changes are allowed. Never describe an eroded, healed, river-generated, or surfaced result as survey-grade or analytically equivalent to the source.

If a material decision is missing, create a reversible preview plan and state the assumption. Do not normalize, crop, fill voids, reproject, or exaggerate elevation silently.

### 2. Preflight the DEM

Run:

```powershell
python scripts/dem_preflight.py "D:\terrain\source.tif" --pretty --report "D:\terrain\source.preflight.json"
```

Use `--width`, `--height`, and `--dtype` for headerless RAW data. Treat warnings about geographic CRS, non-square grids, NoData, rotation, multiple bands, lossy/8-bit input, or missing georeferencing as work to resolve before Gaea.

Prefer GDAL or Rasterio when available; the script falls back to TIFF/PNG metadata through Pillow and raw-file size inference. A fallback report is an inspection aid, not a replacement for authoritative GIS validation.

### 3. Prepare a Gaea-safe working heightfield

Follow [references/dem-production.md](references/dem-production.md). In particular:

- reproject to a suitable projected metric CRS before deriving terrain width or erosion scale;
- select the elevation band and decide how to fill voids while saving the original validity mask;
- crop, pad, resample, or tile to square processing units intentionally; never rely on an unnoticed `Crop to Square`;
- use a lossless 32-bit heightfield for the main displacement path;
- save a context manifest containing CRS/transform/bounds, vertical metadata, NoData policy, original elevation range, normalization mapping, source hash, and working grid.

Keep GIS preprocessing and georeference restoration outside Gaea. Do not assume a Gaea export retained GeoTIFF CRS or affine tags; inspect the actual output before deciding.

### 4. Choose the Gaea functions and graph recipe

Read [references/gaea-node-selection.md](references/gaea-node-selection.md), then choose one primary recipe from [references/gaea-dem-recipes.md](references/gaea-dem-recipes.md). Do not stack nodes merely because they exist.

Default to `Erosion2` for a new detailed 2.3 erosion template when its controls match the task. Use Classic `Erosion` when selective Area processing or its specific transport controls are required. Use Wizard/Wizard2/EasyErosion for look exploration; lock the production result into a reviewed graph with a small allowlist of stable variables. Treat HydroFix/Rivers/Lake/Sea as artistic terrain design unless a separate GIS workflow validates the hydrology.

Keep repair, macro erosion, fine erosion, surface detail, derived maps, and color/output as distinguishable graph stages. Preserve the untouched DEM branch and make every spatial or numeric change auditable.

### 5. Build the `.terrain` processor once in the UI

Create and validate the graph described in [references/graph-contract.md](references/graph-contract.md). Bind input/output paths and artist controls to uniquely named variables. Configure Profiles for preview and final builds. Use Gaea's **Build > Copy Command Line** as the first known-good automation command.

Do not synthesize or patch undocumented `.terrain` internals. Ask for a user-authored template when none exists, or provide exact UI graph instructions. Automation, variables, and macro authoring may require Professional or Enterprise licensing; verify the installed edition.

### 6. Prepare and run a Build Swarm job

Use a unique run directory:

```powershell
python scripts/gaea_swarm.py detect --pretty
python scripts/gaea_swarm.py prepare `
  --project "D:\terrain\processors\dem-erosion.terrain" `
  --input "D:\terrain\working\dem-normalized.tif" `
  --run-dir "D:\terrain\runs\run-001" `
  --profile "Review_4K" `
  --seed 1337 `
  --set ErosionStrength=0.18 `
  --set ProcessMix=0.25
python scripts/gaea_swarm.py command "D:\terrain\runs\run-001\manifest.json"
python scripts/gaea_swarm.py run "D:\terrain\runs\run-001\manifest.json" --execute
python scripts/gaea_swarm.py verify "D:\terrain\runs\run-001\manifest.json" --pretty
```

The wrapper uses a JSON variable file to avoid command-line key/value syntax ambiguity. `run` is dry-run unless `--execute` is explicit. Preserve the manifest, variables, command, logs, seed, profile, project hash, and Gaea reports with every production build.

### 7. Restore geospatial meaning

Decode the processed normalized heightfield using the recorded elevation mapping, then write the authoritative CRS, transform, bounds, NoData mask, and vertical metadata using a GIS tool. Do not copy tags blindly if the Gaea build changed dimensions, region, tile layout, or axis direction; compute the output grid from the intended contract.

### 8. Package the Three.js terrain

Follow [references/threejs-delivery.md](references/threejs-delivery.md). Keep the authoritative GIS raster separate from the web asset. Generate a browser grid small enough for the target quality tier or split it into LOD tiles; never upload a 6K-class DEM as one 36-million-vertex mesh.

For a single-grid prototype:

```powershell
python scripts/package_three_terrain.py "D:\terrain\restored\guilin.tif" `
  --out-dir "D:\site\public\data\terrain\guilin" `
  --value-mode elevation `
  --world-width-m 78200 `
  --world-depth-m 71000 `
  --max-dimension 1025 `
  --quant-min 0 `
  --quant-max 2000 `
  --context "D:\terrain\restored\guilin.preflight.json" `
  --title "Guilin terrain"
```

The package contains `terrain-manifest.json` plus a little-endian Uint16 height binary. The manifest fixes row/column order, local axes, metric footprint, quantization range, elevation decode rule, hashes, and source metadata. Use one shared quantization interval for every tile or variant in the same world.

Keep Gaea processing offline. For precise web-driven editing, let the website export projected/WGS84 GeoJSON masks and whitelisted parameters, rasterize them against the authoritative grid, rebuild through a licensed Windows Swarm worker, run QA, publish a versioned terrain package, then atomically update the website manifest. Never send arbitrary paths or command text from the browser to Swarm.

### 9. Verify before delivery

Run `dem_preflight.py` on the restored output and compare it with the source context. Verify:

- dimensions, band, dtype, CRS, transform, bounds, pixel size, orientation, and NoData;
- elevation range and units, unexpected clipping or quantization, and whether the chosen artistic change stayed within scope;
- seam continuity across adjacent tiles, stable global tonality, and expected overlap handling;
- reproducibility with the same `.terrain`, variables, Profile/Region, seed, Gaea version, and deterministic settings;
- required derivative outputs such as Wear, Deposits, Flow, Slope, Curvature, Normals, masks, color, or mesh.
- browser package decode, local-axis orientation, overlay alignment, click-probe elevation, LOD seams, mobile fallback, DPR cap, memory budget, and lost-context recovery.

For important real-world DEMs, inspect difference rasters, hillshades, slope distributions, drainage behavior, and several control points in a GIS. Stop delivery on silent crop, lost georeference, wrong vertical scale, flattened NoData, seams, clipping, or 8-bit displacement.

## Guardrails

- Preserve the source; write to a new run directory.
- Never activate, deactivate, copy, or expose a Gaea license key.
- Do not install Gaea or execute a long final build unless the user asked for it.
- Do not attempt to run Gaea or its license inside the browser. Bake Gaea results or queue rebuilds on a controlled worker.
- Do not expose arbitrary node names, property names, file paths, commands, or unlimited values to a website. Map user intent to a versioned template and a validated variable allowlist.
- Use absolute quoted paths. Keep outputs unique per run; do not rely on overwrite mode for production.
- Prefer 32-bit TIFF/EXR/R32 for heightfields, 16-bit for most masks, and 8-bit only for categorical or deliberately low-precision data.
- Keep AutoLevel/Equalize and other frame-dependent normalization out of per-tile stages.
- Use deterministic erosion when exact repeatability matters; record the performance tradeoff.
- If Gaea, GDAL, or the necessary license is unavailable, still complete preflight, graph specification, variable manifest, dry-run command, and QA plan; report the execution boundary precisely.
- Keep web packages versioned and immutable. Publish only after GIS, Gaea, binary-decode, and browser QA all pass.
