# Kunming DEM data-only release V001

This directory records the GitHub Release for the clean Kunming DEM restart package.

## Release target

- Repository: `haihao0307/guilin-dem-pipeline`
- Tag: `kunming-dem-data-only-v001`
- Release title: `Kunming DEM data-only 12.5 m uncompressed V001`

## Assets to publish

1. `KUNMING_DEM_DATA_ONLY_12P5M_UNCOMPRESSED_V001.zip`
   - bytes: `201350399`
   - SHA-256: `ace84e8448869dc38ddca66bfb39dae25eca9434d5d9ea33e67d04e830dcd52a`
   - ZIP method: `STORE`
   - archive compression: `NONE`

2. `KUNMING_BASELINE_RESET_CROP_12P5M_FLOAT32_UNCOMPRESSED.tif`
   - bytes: `201333082`
   - SHA-256: `9f672e16714d98b7bc7f002826cdf788379bcb54db84227a21f53539b083f3a2`
   - data type: `float32`
   - internal TIFF compression: `NONE`
   - internal overviews: `NONE`
   - CRS: `EPSG:32648`
   - pixel spacing: `12.5 m × 12.5 m`
   - grid: `5892 × 8095`
   - area: `7452.459375 km²`

## Authoritative lineage

The crop comes from `KUNMING_ASF_11TILES_RECT_12P5M_COG.tif`, SHA-256 `af95c47f55ab8ff25d33ddc96d07c6d85fc1fcd4c2a2de9e2bef51a015860c50`. The source QA records 11 input DEMs, a 12.5 m output grid, and 100% valid coverage.

## Storage rule

Large binary assets belong in GitHub Release assets. They must not be added to ordinary Git history or GitHub Pages. Upload both the uncompressed raw TIFF and the ZIP_STORED handoff package. Verify size and SHA-256 before upload and after downloading the published asset.
