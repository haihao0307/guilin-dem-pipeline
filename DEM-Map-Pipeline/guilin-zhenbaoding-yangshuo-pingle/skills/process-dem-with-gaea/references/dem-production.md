# DEM production line around Gaea

## Contents

- [Principle](#principle)
- [Stage A: source acceptance](#stage-a-source-acceptance)
- [Stage B: GIS preparation](#stage-b-gis-preparation)
- [Stage C: Gaea processing](#stage-c-gaea-processing)
- [Stage D: geospatial restoration](#stage-d-geospatial-restoration)
- [Stage E: quality assurance](#stage-e-quality-assurance)
- [Scenario profiles](#scenario-profiles)

## Principle

Use three distinct data domains:

1. **Authoritative geospatial DEM** — CRS, affine transform, bounds, NoData, vertical datum/unit, and measured elevations.
2. **Gaea working heightfield** — square, lossless, linear, usually normalized or explicitly mapped, with physical width/height supplied through Terrain Definition.
3. **Delivered geospatial terrain** — Gaea result decoded into the agreed elevation domain and written onto the intended output grid with authoritative metadata.

Gaea is an excellent artistic and procedural terrain engine, but its documented heightfield workflow is not a substitute for a GIS metadata model. Unless an inspected export proves otherwise, assume CRS, transform, vertical datum, NoData semantics, and source footprint must be restored externally.

## Stage A: source acceptance

Capture a source manifest:

```json
{
  "source": "source-dem.tif",
  "sha256": "...",
  "surface_type": "DEM|DTM|DSM|unknown",
  "band": 1,
  "crs_wkt_or_epsg": "EPSG:...",
  "transform": [0, 0, 0, 0, 0, 0],
  "bounds": [0, 0, 0, 0],
  "shape": [0, 0],
  "pixel_size": [0, 0],
  "horizontal_unit": "metre",
  "vertical_datum": "...",
  "vertical_unit": "metre",
  "nodata": null,
  "valid_min_max": [0, 0]
}
```

When storing a GDAL geotransform, use the explicit order `[origin_x, pixel_width, row_rotation, origin_y, column_rotation, pixel_height]`; a north-up raster normally has zero rotations, positive pixel width, and negative pixel height. If using a Rasterio/Affine six-tuple instead, label that ordering rather than calling it a GDAL geotransform.

Check:

- correct surface semantics and acquisition date;
- single elevation band or explicit band selection;
- projected metric CRS for physical scale; reproject geographic latitude/longitude data before Gaea;
- north-up affine grid or an intentional warp plan for rotated/skewed data;
- NoData coverage, voids, ocean policy, spikes, sinks, striping, and source tile seams;
- horizontal/vertical datum compatibility and geoid-versus-ellipsoid assumptions;
- legal/provenance requirements.

Do not infer a vertical datum from `EPSG:4326`, filenames, or a horizontal CRS alone.

## Stage B: GIS preparation

### Choose the working grid

Define target CRS, bounds, pixel size, dimensions, resampling method, and alignment explicitly. For continuous elevation use a continuous-data resampler such as bilinear or cubic only when appropriate to the source; use nearest for categorical masks. Keep the output aligned to the intended delivery grid when round-tripping matters.

Gaea terrain builds are normally square. For rectangular DEMs choose one of:

- crop to a documented square area of interest;
- pad to square with a saved validity mask;
- split into square, aligned processing units with overlap;
- use a wider world/tile strategy designed in the Gaea template.

Do not let the File node crop without documenting the removed footprint.

### Preserve NoData

Save the valid-data mask before filling holes. Fill only what the terrain process needs, using a documented method and maximum gap size. Reapply the authoritative mask after processing unless the task explicitly asks to synthesize terrain beyond coverage.

### Encode elevation

Prefer a Float32 TIFF/EXR or R32 working heightfield. Two valid strategies are:

- **Mapped interval:** retain a fixed physical interval such as `z_floor..z_ceiling` when the Gaea template is configured for mapped input/output.
- **Recorded normalization:** encode `h = (z - z_floor) / (z_ceiling - z_floor)` and record `z_floor` and `z_ceiling`. Add deliberate headroom if Gaea may raise or lower terrain; clipping at 0 or 1 is a failed build.

Never use per-tile min/max normalization. All tiles in a terrain set must share the same elevation mapping.

Set Terrain Definition:

- Width = square working footprint in projected metres.
- Height = encoded vertical interval in metres, with any base offset stored in the external context.
- Meters per pixel = footprint width / raster width, checked against Gaea's readout.

### Save the bridge context

Alongside the working raster, save:

- authoritative source manifest and hashes;
- working CRS/grid/footprint;
- normalization floor/ceiling or mapped range;
- NoData fill method and validity-mask path;
- axis/flip convention;
- expected output resolution/profile/region/tile scheme;
- project template path/hash and allowed parameter ranges.

## Stage C: Gaea processing

Use the graph contract in `graph-contract.md`. Start with the least destructive path:

1. Input and range validation.
2. Optional repair only when defects justify it.
3. Scale-aware simulation or surface detail.
4. Blend with the original when shape preservation matters.
5. Derive supporting data maps.
6. Export the main heightfield at 32-bit precision and masks at their justified precision.

For real DEM enhancement, prefer low erosion strength and a controlled mix. `Heal`, AutoLevel, Equalize, strong denoise, and aggressive erosion alter measured elevations; use them only when the intended deliverable is artistic.

For tiled processing, separate global/world operations from local/detail operations. Bake the global stage, use Hybrid buckets with enough context, and seam-test a small neighborhood before the full run.

## Stage D: geospatial restoration

Inspect the raw Gaea output first. Then:

1. Confirm width, height, dtype, orientation, and value range.
2. Decode the recorded elevation interval.
3. Apply the output grid appropriate to the Profile/Region/tile, not automatically the source grid.
4. Reapply the valid-data mask and agreed NoData value.
5. Write CRS, transform, and vertical metadata with GDAL/Rasterio or another GIS library.
6. Create overviews/compression only after numerical validation.

If the output was flipped or transposed, correct pixel orientation before assigning the transform. If Gaea output resolution changed, preserve bounds but recompute pixel size unless the contract says the footprint also changed.

## Stage E: quality assurance

### Metadata and file checks

- readable, non-empty, lossless file;
- correct band count, Float32/appropriate integer dtype, NoData, CRS, transform, bounds, and dimensions;
- pixel size and axis directions agree with the intended grid;
- no unexpected palette, gamma, color-management, or lossy compression on data rasters.

### Numeric checks

- decoded elevation min/max and percentiles;
- count of values at normalization bounds to detect clipping;
- NoData area and boundary agreement;
- difference raster statistics: min/max, mean, median, RMSE, and robust percentiles;
- control-point elevation differences in protected areas;
- slope/aspect/curvature distribution changes when relevant.

### Visual and structural checks

- common-stretch and fixed-stretch hillshades for source/result/difference;
- contour continuity and drainage plausibility;
- absence of banding, spikes, pits, mirrored axes, crop, resampling blur, and tile seams;
- adjacent tile border comparison for height and every data map;
- expected Wear/Deposits/Flow behavior without overdriven texturing.

### Reproducibility checks

Record Gaea version, edition, `.terrain` hash, Variables JSON, Profile, Region, seed, deterministic/parallel choice, cache choice, command, logs, and output hashes. Rebuild a representative tile or preview before accepting a pipeline version change.

## Scenario profiles

### Faithful visualization

- preserve grid and elevation mapping;
- repair only known artifacts;
- use subtle scale-aware erosion or surface detail;
- keep `ProcessMix` low and report elevation deltas;
- deliver the processed DEM separately from the source.

### Artistic terrain / film / game

- allow larger erosion and detail changes within art direction;
- still preserve physical width, chosen vertical scale, and a deterministic seed;
- export height, normals, slope, flow, wear, deposits, curvature, material masks, and color only as needed by the target engine;
- follow engine-specific tile size, axis, handedness, and import precision requirements.

### Analytical or engineering surface

Do not apply artistic Gaea operations to the authoritative analytical raster. Gaea may create a derived visualization copy, but hydrologic conditioning, datum transforms, volume calculations, and survey/engineering QA belong in GIS or scientific tooling.
