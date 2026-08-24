# Wenzhou Qingjiang 22000 km² square 12.5 m DEM production task

## Branch and pull request policy

Work only on `project/wenzhou-qingjiang-22000km2-dem-v001`.

Create or continue one draft pull request targeting `integration/ecology-v040`.

Do not merge, close, force push, rewrite history, or modify `main`, `gh-pages`, or the existing Wenzhou–Taizhou PR.

## Fixed geometry

Use `projects/wenzhou/aoi/wenzhou.geojson` as the immutable requested AOI.

The center is Qingjiang Town, Yueqing, Wenzhou at WGS84 longitude `121.101666666667`, latitude `28.275000000000`, sourced from Wikidata item `Q14065537`.

Construct the requested square in `EPSG:32651` around that center.

1. Requested area is exactly `22000.0 km²`.
2. Requested side length is `148323.969742 m`.
3. Requested UTM bounds are `[239646.167823, 3054965.625915, 387970.137565, 3203289.595657]`.
4. The output grid uses `12.5 m` pixels.
5. Centered outward snapping produces `11866 × 11866` pixels, a side length of `148325.0 m`, and a raster area of `22000.305625 km²`.
6. The requested vector square remains the authoritative 22000 km² AOI. The small outward raster snap exists only to preserve complete 12.5 m pixel coverage.

Do not replace this AOI with an administrative boundary, latitude and longitude rectangle, or the earlier Wenzhou–Taizhou bbox.

## Existing implementation to reuse

Reuse and generalize the proven Guilin authenticated pipeline where possible. Important references include:

1. `DEM-Map-Pipeline/guilin-zhenbaoding-yangshuo-pingle/scripts/asf_download_stdlib.py`
2. `DEM-Map-Pipeline/guilin-zhenbaoding-yangshuo-pingle/scripts/mosaic_dem.py`
3. `DEM-Map-Pipeline/guilin-zhenbaoding-yangshuo-pingle/scripts/run_cloud_pipeline.py`
4. `DEM-Map-Pipeline/guilin-zhenbaoding-yangshuo-pingle/local_tools/LocalBuild.ps1`
5. `07_SET_EARTHDATA_TOKEN_NO_FLASH.cmd`

Keep shared behavior compatible with the Guilin project. Do not hardcode Wenzhou values into the Guilin project.

## Required project workspace

Create the complete implementation under `projects/wenzhou/`.

At minimum add:

1. `README.md`
2. `scripts/resolve_aoi.py`
3. `scripts/asf_download.py`
4. `scripts/mosaic_dem.py`
5. `scripts/build_marine_mask.py`
6. `scripts/qa.py`
7. `scripts/run_pipeline.py`
8. `local_tools/RUN_WENZHOU_ASF_12_5M_KEEP_OPEN.cmd`
9. `local_tools/LocalBuild.ps1`
10. `metadata/`
11. `reports/`
12. `outputs/`
13. `HANDOFF_WENZHOU_QINGJIANG_DEM_V001.md`

The scripts may import generalized shared modules instead of duplicating large files.

## Source and resolution policy

Use the existing production convention for the authenticated NASA ASF ALOS PALSAR `RTC_HI_RES` ancillary DEM package.

The final product label must remain `12.5 m output grid ASF RTC reference DEM`.

Preserve the documented lineage that the ancillary elevation grid was prepared for RTC processing and that 12.5 m pixel spacing does not establish native 12.5 m surveying accuracy.

This task accepts no 30 m fallback as the final result.

1. Run with `DEM_DATA_MODE=asf` behavior only.
2. Require `EARTHDATA_TOKEN` for authenticated downloads.
3. Never switch to Mapzen, Copernicus 30 m, SRTM 30 m, ASTER 30 m, synthetic terrain, random terrain, or an upsampled fallback.
4. Never declare completion from a plan file, mocked raster, source-code assertion, empty placeholder, or skipped job.
5. Preserve product IDs, source URLs, XML metadata, original archives where downloaded, file sizes, timestamps, licenses, and SHA-256 hashes.

## Download execution

First run the ASF search in plan mode against the fixed AOI plus the configured 3000 m retrieval buffer.

Select a deduplicated path and frame set that covers the full requested square. Save the exact search response and selected product plan.

Then perform the real authenticated download with resume support, partial-file protection, retry with exponential backoff, HTTP status logging, content-type checks, archive validation, and SHA-256 verification.

Extract only genuine DEM ancillary rasters matching `*.dem.tif` or `*_dem.tif`. Exclude SAR amplitude, incidence, layover, shadow, and other non-elevation rasters.

Do not delete source archives or metadata until the source manifest and checksums are complete.

If authentication is missing or the remote host rejects the request, write `projects/wenzhou/reports/BLOCKED_DOWNLOAD.json` containing the exact URL class, HTTP status, exception, UTC time, required credential name, completed plan count, and remaining work. Keep the PR open and draft. Do not substitute another resolution.

## Mosaic and sea handling

Build one COG in `EPSG:32651` at exactly `12.5 m` pixel spacing and `11866 × 11866` pixels.

Use median overlap reduction and preserve a source-count raster.

The square includes coastal water. Build a traceable coastline or land mask and classify every cell before finalization.

1. Valid terrestrial and island cells must come from the authenticated DEM source.
2. Confirmed marine cells may be represented as sea-level surface `0.0 m` for this DEM phase.
3. Keep a separate marine mask and original source-NoData mask.
4. Never use sea-level filling to hide terrestrial gaps.
5. Do not describe the marine surface as bathymetry.
6. Any unclassified NoData cell fails the build.

## Required outputs

Produce these real files and paths:

1. `projects/wenzhou/outputs/WENZHOU_QINGJIANG_22000KM2_12_5M_COG.tif`
2. `projects/wenzhou/outputs/WENZHOU_QINGJIANG_source_count_COG.tif`
3. `projects/wenzhou/outputs/WENZHOU_QINGJIANG_marine_mask_COG.tif`
4. `projects/wenzhou/outputs/WENZHOU_QINGJIANG_source_nodata_mask_COG.tif`
5. `projects/wenzhou/metadata/asf_search_response.json`
6. `projects/wenzhou/metadata/selected_products.json`
7. `projects/wenzhou/metadata/source_manifest.json`
8. `projects/wenzhou/metadata/SHA256SUMS.txt`
9. `projects/wenzhou/reports/QA_REPORT.json`
10. `projects/wenzhou/reports/DEM_PREVIEW.png`
11. `projects/wenzhou/HANDOFF_WENZHOU_QINGJIANG_DEM_V001.md`

Use Git LFS for committed GeoTIFF files. If repository quota or runner storage prevents committing the final raster, retain the exact local or artifact path and checksum in the handoff, and do not claim that GitHub contains the binary.

## QA gates

The task passes only when all of the following are measured from the produced raster files:

1. Center coordinate matches the fixed Qingjiang anchor within one centimeter in `EPSG:32651` conversion.
2. Requested square area equals `22000.0 km²` within numerical tolerance.
3. Raster CRS is `EPSG:32651`.
4. Pixel size is exactly `12.5 m × 12.5 m`.
5. Raster dimensions are exactly `11866 × 11866`.
6. Raster bounds equal the documented centered outward grid bounds.
7. Every raster cell is classified as valid land DEM, confirmed marine surface, or an explicitly failing unclassified cell.
8. Unclassified NoData count is zero.
9. Terrestrial gap count is zero.
10. Source checksums pass.
11. COG validation passes.
12. Elevation minimum, maximum, mean, percentile range, land valid count, marine count, source overlap count, and source product count are recorded.
13. The preview shows the complete square, coastline, islands, western mountains, and all four AOI edges.

## Delivery

Run the real pipeline. Commit and push implementation, manifests, reports, preview, and any valid LFS artifacts to the same branch.

Keep the pull request draft. Report the final commit SHA, exact DEM path, file size, SHA-256, source product count, coverage result, QA result, and any genuine remaining blocker.

Stop after the verified DEM and handoff are complete. Do not continue into ecology, historical reconstruction, GAEA processing, or public web development in this task.
