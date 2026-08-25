# Kunming authoritative baseline reset crop V001

## Branch and PR

Work only on `project/kunming-dem-v001` and PR #20. Keep the PR open and Draft. Do not merge, force push, rewrite history, modify `main`, or delete unrelated Wenzhou or Guilin work.

## Authoritative input

Use only:

- file: `KUNMING_ASF_11TILES_RECT_12P5M_COG.tif`
- SHA-256: `af95c47f55ab8ff25d33ddc96d07c6d85fc1fcd4c2a2de9e2bef51a015860c50`
- CRS: `EPSG:32648`
- pixel spacing: `12.5 m × 12.5 m`
- dtype: `float32`
- source grid: `10840 × 18680`
- source bounds: `[209000.0, 2651625.0, 344500.0, 2885125.0]`

The 12.5 m grid is independently confirmed by:

- `135500 m / 10840 = 12.5 m`
- `233500 m / 18680 = 12.5 m`

Fail closed when the source SHA, CRS, resolution, dtype, dimensions or bounds do not match.

## Source storage fact

The uploaded QA records the original COG as `COMPRESSION=DEFLATE` with average-resampled internal overviews. DEFLATE is lossless and preserves the float32 values. The new working master must follow the stricter project rule below and must be written with no compression at all.

## Exact crop

The user's uploaded reference is pixel-identical to the full preview window:

- full preview: `1045 × 1800`
- window: `x=269, y=493, width=568, height=780`

The source-aligned raster crop is:

- `col_off=2790`
- `row_off=5116`
- `width=5892`
- `height=8095`
- EPSG:32648 bounds: `[243875.0, 2719987.5, 317525.0, 2821175.0]`
- physical size: `73.650 km × 101.1875 km`
- area: `7452.459375 km²`

Use `projects/kunming/baseline-reset-v001/scripts/crop_authoritative_dem.py`.

## Mandatory uncompressed master contract

The new authority file must be:

```text
KUNMING_BASELINE_RESET_CROP_12P5M_FLOAT32_UNCOMPRESSED.tif
```

It must satisfy every item below:

1. `GTiff`, one band, `float32`.
2. `COMPRESS=NONE`.
3. No DEFLATE, LZW, ZSTD, JPEG, WEBP or other compression.
4. No internal overviews or pyramid levels.
5. No resampling.
6. No reduction of width, height or pixel count.
7. `5892 × 8095` pixels at `12.5 m × 12.5 m`.
8. Exact bounds `[243875.0, 2719987.5, 317525.0, 2821175.0]`.
9. Source-window and output pixel arrays must have identical SHA-256 values.
10. Pixel-by-pixel comparison must pass, including NaN placement and NoData values.

A web texture, PNG, JPEG, terrain mesh, overview or proxy raster can never replace this master or be used as the next processing input.

## Reset boundary

Discard every later procedural or online visualization change from the new baseline, including synthetic water and lake overlays, procedural rock, debris and erosion layers, contour display, vertical exaggeration, and the low-resolution `160 × 160` online height texture.

Retain only the verified source, source lineage, 12.5 m float32 grid, exact crop AOI, uncompressed cropped master, source-count crop and file-based QA.

## Completion gate

Do not begin new hydrology, GAEA, surface detail, 1 m visual sequencing or browser terrain work until all of these exist:

1. uncompressed cropped master generated from the verified source;
2. output file SHA-256;
3. source-window and output pixel-array SHA-256 equality;
4. `5892 × 8095` grid;
5. exact EPSG:32648 bounds;
6. 12.5 m resolution;
7. float32 dtype;
8. `COMPRESS=NONE`;
9. zero internal overviews;
10. valid coverage fraction;
11. elevation statistics;
12. handoff recording the new clean baseline.

Stop after the uncompressed crop, QA and handoff are complete.
