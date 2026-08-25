# Kunming authoritative baseline reset crop V001

## Branch and PR

Work only on `project/kunming-dem-v001` and PR #20. Keep the PR open and Draft. Do not merge, force push, rewrite history, modify `main`, or delete unrelated Wenzhou or Guilin work.

## Authoritative input

Use only:

- file: `KUNMING_ASF_11TILES_RECT_12P5M_COG.tif`
- SHA-256: `af95c47f55ab8ff25d33ddc96d07c6d85fc1fcd4c2a2de9e2bef51a015860c50`
- CRS: `EPSG:32648`
- pixel spacing: `12.5 m`
- source grid: `10840 × 18680`
- source bounds: `[209000.0, 2651625.0, 344500.0, 2885125.0]`

Fail closed when the source SHA, CRS, resolution, dimensions or bounds do not match.

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

## Reset boundary

Discard every later procedural or online visualization change from the new baseline, including synthetic water and lake overlays, procedural rock, debris and erosion layers, contour display, vertical exaggeration, and the low-resolution `160 × 160` online height texture.

Retain only the authoritative source COG, source lineage, 12.5 m grid, exact crop AOI, crop COG, source-count crop and file-based QA.

## Completion gate

Do not begin new hydrology, GAEA, surface detail, 1 m visual sequencing or browser terrain work until all of these exist:

1. cropped COG generated from the verified source;
2. output SHA-256;
3. `5892 × 8095` grid;
4. exact EPSG:32648 bounds;
5. 12.5 m resolution;
6. valid coverage fraction;
7. elevation statistics;
8. COG validation and overviews;
9. handoff recording the new clean baseline.

Stop after the crop, QA and handoff are complete.
