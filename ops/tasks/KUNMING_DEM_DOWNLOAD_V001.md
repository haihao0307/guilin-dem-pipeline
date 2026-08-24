# Kunming Cuihu 20000 km² ASF RTC 12.5 m output-grid DEM task

## Branch and pull request policy

Work only on `project/kunming-dem-v001` and keep PR #20 open and Draft.

Do not merge, close, retarget, force push, rewrite history, or modify `main`, `gh-pages`, or `integration/ecology-v040`.

## Fixed AOI

Use `projects/kunming/aoi/kunming_cuihu_20000km2_square.geojson` as the authoritative AOI.

- Center: Kunming Cuihu
- WGS84 center: `102.70228 E, 25.05042 N`
- Requested area: exactly `20000.0 km²`
- Requested side length: `141421.356237 m`
- Project CRS: `EPSG:32648`
- Output grid spacing: `12.5 m`

Verify the projected square area and center containment before searching ASF.

## Existing production convention

Reuse the authenticated Guilin ASF pipeline already stored in this repository:

1. `DEM-Map-Pipeline/guilin-zhenbaoding-yangshuo-pingle/scripts/asf_download_stdlib.py`
2. `DEM-Map-Pipeline/guilin-zhenbaoding-yangshuo-pingle/scripts/mosaic_dem.py`
3. `DEM-Map-Pipeline/guilin-zhenbaoding-yangshuo-pingle/local_tools/Common.ps1`
4. `DEM-Map-Pipeline/guilin-zhenbaoding-yangshuo-pingle/local_tools/SetEarthdataToken.ps1`
5. `07_SET_EARTHDATA_TOKEN_NO_FLASH.cmd`
6. the already authenticated Windows Chrome session workflow under `C:\HaihaoDEM\ASF_v104_local`

Use the repository's established product label:

`12.5米输出像元的ASF RTC参考DEM`

Keep `native12_5mSurveyClaim=false`. The `12.5 m` value records the output pixel spacing used by the production pipeline.

Do not introduce TanDEM-X procurement, commercial-license applications, Copernicus GLO-30, Mapzen, AWS Terrain Tiles, SRTM preview products, synthetic terrain, or any 30 m final fallback into this task.

## Authentication and execution

The production download must run in the user's Windows environment because that environment already contains the authenticated ASF access state.

Supported credential paths are:

1. `EARTHDATA_TOKEN` already present in the process environment.
2. Windows DPAPI file `%APPDATA%\HaihaoDEM\earthdata-token.dpapi`, loaded through the existing `Load-EarthdataToken` implementation.
3. The already logged-in ASF Chrome session and its existing local session downloader.

Never commit a password, token, cookie, Chrome profile, or decrypted credential.

Do not request the user's password again while either the DPAPI token or the authenticated Chrome session remains usable.

A cloud Codex checkout that cannot see the user's Windows credential state must prepare and validate the scripts, then report the local execution requirement. It must not replace the source with a public 30 m product.

## Required project workspace

Complete the implementation under `projects/kunming/` with at least:

1. `README.md`
2. `config/task_config.json`
3. `config/existing_five_manifest.json`
4. `metadata/resolved_aoi.json`
5. `local_tools/LocalBuild.ps1`
6. `local_tools/RUN_KUNMING_ASF_12_5M_KEEP_OPEN.cmd`
7. source manifest, selected-product plan, checksums, QA report and handoff

The local build must use the existing ASF SearchAPI planner, authenticated resumable downloader, source preservation and `*.dem.tif` extraction.

## Download and mosaic

1. Search `ALOS PALSAR` with processing level `RTC_HI_RES` over the fixed AOI plus the configured retrieval buffer.
2. Deduplicate by path and frame and select enough products to meet the configured AOI coverage target.
3. Preserve search response, selected products, original DEM assets, metadata XML or archives, byte counts and SHA-256 hashes.
4. Extract only `*.dem.tif` and `*_dem.tif`. Exclude polarization, incidence, layover and shadow rasters.
5. Resume partial downloads and validate TIFF or archive signatures.
6. Mosaic into one aligned `EPSG:32648` grid at `12.5 m` spacing.
7. Use median overlap reduction and retain source-count and fill-class rasters.
8. Clip to the authoritative square AOI and build a COG.
9. Record coverage, NoData, overlap, fill class, elevation statistics, raster bounds, dimensions, CRS, pixel spacing and checksums.
10. Fail closed when the authenticated download or coverage gate fails. Do not switch to a 30 m source.

## Stop condition

Stop after the real ASF source download, exact-AOI mosaic COG, source-count raster, fill-class raster, QA, checksums and `HANDOFF_KUNMING_DEM_V001.md` are complete.

Do not continue into ecology, agriculture, historical reconstruction, GAEA processing, a detailed core, browser terrain work or public deployment in this task.
