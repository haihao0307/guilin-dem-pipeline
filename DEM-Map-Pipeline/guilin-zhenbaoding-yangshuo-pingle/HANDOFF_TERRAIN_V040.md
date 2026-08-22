# HANDOFF TERRAIN V0.4.0

## Phase A status

This handoff covers the deterministic text-only terrain-field compiler and its focused contract tests. It does not yet publish PNG or binary field assets and it does not change the active v0.3.1 runtime.

## Added files

- `scripts/ecology_v040/terrain_field_compiler.py`
- `schemas/ecology/v0.4.0/terrain-field-manifest.schema.json`
- `metadata/ecology/v0.4.0/terrain-field-manifest.template.json`
- `tests/test_terrain_field_compiler_v040.py`
- `HANDOFF_TERRAIN_V040.md`

## Algorithm

The compiler reads the immutable source height grid and either a raster water mask or the existing waterway GeoJSON. It derives slope, curvature, local relief, D8 flow direction, flow accumulation, drainage-to-water, distance to water, active bank, erosion-channel, reversible erosion depth, karst rock, karst rock core, landform class, and hard-exclusion fields.

Flow direction always selects a strictly lower neighbour. Ties are resolved by a fixed D8 order. Erosion channels are restricted to cells that drain to permanent water. The compiler hashes the truth elevation before and after field generation and raises if the two hashes differ.

Karst exposure combines slope, local relief, convexity, relative elevation, and a stable global-coordinate noise value. The noise seed, tile origin, and projected grid contract make rebuilds deterministic and keep procedural phase continuous across tile boundaries.

## Hard rules implemented

- `z_truth_m` is read-only.
- Permanent water is included in `hard_exclusion_mask`.
- Strong karst rock core is included in `hard_exclusion_mask`.
- Erosion channels must follow strictly descending D8 paths that terminate in permanent water.
- Output field values and the complete release have canonical SHA-256 checksums.
- v0.3.1 files remain untouched.

## Focused tests

Run from the project root:

```bash
python -m unittest tests/test_terrain_field_compiler_v040.py
```

The focused test suite covers:

1. truth-elevation immutability and matching before/after hashes;
2. permanent-water hard exclusion;
3. strictly downhill erosion drainage into water with no loops;
4. deterministic repeat builds and identical release checksums.

## Phase B work remaining

- Bind the compiler to the exact v0.3.1 height-grid dimensions and current terrain manifest automatically.
- Rasterize roads, buildings, airport protection zones, and approved historical drainage features into additional hard-exclusion channels.
- Calibrate erosion and karst thresholds against the 10 km² visual reference.
- Publish versioned field textures and binary assets to metadata, web, and site paths.
- Add tile seam, full AOI, browser, and screenshot validation.
- Produce the required full-view, water, erosion, karst, and top-view evidence images.

## Rollback

No active runtime reference is changed in Phase A. Rollback consists of deleting the five files listed above. The stable ecology release remains v0.3.1.
