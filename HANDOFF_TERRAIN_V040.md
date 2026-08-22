# HANDOFF TERRAIN V0.4.0

## Phase A implementation

Phase A adds a deterministic, dependency-light terrain-field compiler while keeping every v0.3.1 release file available for rollback. The compiler reads a real or proxy height grid, rasterizes approved waterway geometry or accepts a supplied water mask, and publishes versioned hydrology, erosion, karst, landform and hard-exclusion fields.

The source height array is copied into `z_truth_m` and checked by a semantic SHA-256 checksum before and after compilation. Erosion is stored in `erosion_depth_m`; it does not overwrite the truth grid. Procedural rock variation uses projected world coordinates, so the phase does not restart at tile boundaries.

## Added files

- `DEM-Map-Pipeline/guilin-zhenbaoding-yangshuo-pingle/scripts/compile_terrain_fields_v040.py`
- `DEM-Map-Pipeline/guilin-zhenbaoding-yangshuo-pingle/tests/test_terrain_fields_v040.py`
- `DEM-Map-Pipeline/guilin-zhenbaoding-yangshuo-pingle/metadata/ecology/v0.4.0/terrain-field-contract.json`
- `DEM-Map-Pipeline/guilin-zhenbaoding-yangshuo-pingle/schemas/terrain-fields-v040.schema.json`
- `HANDOFF_TERRAIN_V040.md`

## Phase A validation

Run from `DEM-Map-Pipeline/guilin-zhenbaoding-yangshuo-pingle`:

```bash
python tests/test_terrain_fields_v040.py
python -m py_compile scripts/compile_terrain_fields_v040.py
```

The tests cover truth-grid immutability, permanent-water hard exclusion, downhill D8 drainage, water-connected erosion channels, deterministic arrays and manifest completeness. The same test suite was executed before the files were committed to the branch.

## Production invocation

```bash
python scripts/compile_terrain_fields_v040.py \
  --height-grid metadata/ecology/v0.3.1/runtime-assets/height-grid.u16 \
  --release-manifest metadata/ecology/v0.3.1/ecology-release-manifest.json \
  --waterways metadata/waterways_osm.geojson \
  --output metadata/ecology/v0.4.0/terrain-fields
```

## Remaining Phase B work

Phase B will run the compiler against the mounted 12.5 m truth DEM, calibrate river widths and karst thresholds against the actual ten-square-kilometre sample, generate diagnostic images, validate tile seams, and publish synchronized copies under `metadata`, `web/assets`, and `site/public/terrain/assets`.

## Rollback

No v0.3.1 file is modified or removed. Runtime promotion remains blocked until the v0.4.0 field release, ecology release and browser gates pass together.
