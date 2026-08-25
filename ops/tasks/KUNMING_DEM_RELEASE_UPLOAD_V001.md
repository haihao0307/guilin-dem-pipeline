# Kunming DEM GitHub Release upload V001

## Work location

Continue only on `project/kunming-dem-v001` and PR #20. Keep PR #20 open and Draft. Do not merge, close, retarget, force push, or modify `main`, `gh-pages`, or unrelated Guilin and Wenzhou files.

## Source asset

Expected mounted package:

`/mnt/data/KUNMING_DEM_DATA_ONLY_12P5M_UNCOMPRESSED_V001.zip`

Required identity:

- bytes: `201350399`
- SHA-256: `ace84e8448869dc38ddca66bfb39dae25eca9434d5d9ea33e67d04e830dcd52a`
- ZIP entry count: `6`
- every entry must use ZIP method `STORE`
- no entry may be recompressed

The package contains the raw authority crop:

`KUNMING_BASELINE_RESET_CROP_12P5M_FLOAT32_UNCOMPRESSED.tif`

Required TIFF identity:

- bytes: `201333082`
- SHA-256: `9f672e16714d98b7bc7f002826cdf788379bcb54db84227a21f53539b083f3a2`
- dtype: `float32`
- CRS: `EPSG:32648`
- pixel spacing: `12.5 m × 12.5 m`
- grid: `5892 × 8095`
- bounds: `[243875.0, 2719987.5, 317525.0, 2821175.0]`
- area: `7452.459375 km²`
- TIFF compression: `NONE`
- internal overviews: `NONE`

## Release target

- repository: `haihao0307/guilin-dem-pipeline`
- tag: `kunming-dem-data-only-v001`
- title: `Kunming DEM data-only 12.5 m uncompressed V001`
- target commitish: `project/kunming-dem-v001`
- release state during controller review: Draft

Upload both assets:

1. `KUNMING_DEM_DATA_ONLY_12P5M_UNCOMPRESSED_V001.zip`
2. `KUNMING_BASELINE_RESET_CROP_12P5M_FLOAT32_UNCOMPRESSED.tif`

Use `projects/kunming/data-release-v001/Publish-KunmingDemRelease.ps1` as the authoritative uploader. It must verify package size and SHA, verify ZIP_STORED, extract the raw TIFF without recompression, verify TIFF size and SHA, upload or replace both Release assets, download both published assets again, and verify their SHA-256 values.

## Fail closed

If the mounted package is absent, inaccessible, a different size, a different SHA, or unavailable to the Codex environment, stop immediately and report the exact checked path and result. Do not create placeholder assets, split the file into ordinary Git objects, use Git LFS as an undeclared replacement, recompress it, or claim that upload succeeded.

If the package is available and `gh` is authenticated, perform the real upload now. Return the release URL, tag, asset names, uploaded byte counts, and downloaded verification hashes. Commit `KUNMING_DEM_RELEASE_UPLOAD_REPORT.json` under `projects/kunming/data-release-v001/` only after the real round-trip verification passes.
