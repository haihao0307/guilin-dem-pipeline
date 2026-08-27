# ASF RTC reference DEM acquisition skill

## Purpose

Use the repository's established NASA ASF DAAC workflow to search, download, preserve and mosaic ALOS PALSAR `RTC_HI_RES` ancillary DEM assets for projects such as Guilin, Kunming and Wenzhou.

## Product identity

The canonical production label is:

`12.5米输出像元的ASF RTC参考DEM`

The pipeline writes a `12.5 m` output grid and retains:

1. `native12_5mSurveyClaim=false`
2. original source packages and extracted DEM files
3. ASF search response and selected product plan
4. source URLs and product IDs
5. metadata, byte counts and SHA-256 hashes
6. source count and fill class rasters
7. coverage and elevation QA

Do not label this product as a native 12.5 m survey DEM.

## Approved authentication paths

Authenticated transfers run in the user's Windows environment. Use the first available path:

1. `EARTHDATA_TOKEN` already present in the process environment.
2. `%APPDATA%\HaihaoDEM\earthdata-token.dpapi`, decrypted only by the existing Windows DPAPI loader.
3. The running Chrome profile that already displays the authenticated ASF `Welcome` state.

Credentials remain local. Never commit a password, token, cookie, browser profile or decrypted credential.

Do not ask the user to send the ASF password again while the saved DPAPI token or authenticated Chrome session remains usable.

A cloud Codex checkout cannot inherit Windows DPAPI state or the user's local Chrome profile. Cloud jobs perform code checks and ASF planning. Real authenticated transfer is handed to the Windows launcher. A public 30 m substitute is prohibited.

## Reusable repository implementation

Use these shared files:

1. `DEM-Map-Pipeline/guilin-zhenbaoding-yangshuo-pingle/scripts/asf_download_stdlib.py`
2. `DEM-Map-Pipeline/guilin-zhenbaoding-yangshuo-pingle/scripts/mosaic_dem.py`
3. `DEM-Map-Pipeline/guilin-zhenbaoding-yangshuo-pingle/local_tools/Common.ps1`
4. `DEM-Map-Pipeline/guilin-zhenbaoding-yangshuo-pingle/local_tools/SetEarthdataToken.ps1`
5. `tools/asf-local/InvokeChromeSessionDownload.ps1`
6. `tools/asf-local/RepairChromeSessionDownloader.ps1`
7. `07_SET_EARTHDATA_TOKEN_NO_FLASH.cmd`

The Python downloader provides ASF SearchAPI planning, path and frame deduplication, AOI sample coverage selection, bearer authorization across redirects, resumable `.part` transfers, TIFF and archive signature validation, direct DEM transfer, archive extraction, metadata transfer, SHA-256 recording and source manifest generation.

The mosaic implementation provides CRS inspection, reprojection, aligned 12.5 m output grids, median overlap reduction, source count and fill class rasters, configurable gap treatment, COG generation, overviews, coverage statistics, elevation statistics and output checksums.

## Authenticated Chrome session downloader

The production helper is:

`tools/asf-local/InvokeChromeSessionDownload.ps1`

It receives a verified `selected_products.json`, discovers the running Chrome profile, opens each selected ASF archive URL in that authenticated profile, monitors the known download directories, waits for stable completed files, validates ZIP or TIFF signatures, moves the source packages into the project work directory, extracts only `*.dem.tif` and `*_dem.tif`, computes SHA-256 values and writes `chrome_session_download_manifest.json`.

The helper does not read account passwords, tokens, cookies or the Chrome password store. Chrome may display one permission prompt for multiple downloads or file retention. One approval is sufficient when that prompt appears.

The legacy local script remains at:

`C:\HaihaoDEM\ASF_v104_local\scripts\run_chrome_session_download.ps1`

Its previous v1.0.7 run stopped on the first task because PowerShell treated a single object as a scalar and `.Count` was unavailable. `RepairChromeSessionDownloader.ps1` performs an AST based, backed up repair by wrapping unguarded Count expressions with `@(...)` and validating the revised script before writing it. New project runners use the repository production helper directly, so the legacy script is no longer required for the main path.

## PowerShell collection rule

PowerShell may collapse a one item pipeline result into a scalar. Before reading `.Count`, coerce the value to an array:

```powershell
$count = @($value).Count
```

Apply this rule to selected products, task lists, Chrome processes, download candidates, archive entries and DEM files.

## Per project contract

Each project contains:

1. authoritative AOI GeoJSON
2. project task configuration
3. existing source manifest
4. resolved AOI compatibility JSON
5. Windows keep open launcher
6. Windows local build or download script
7. source and result handoff

The compatibility `resolved_aoi.json` includes:

1. `status: exact_boundary_resolved`
2. `final.wgs84Polygon`
3. `search.envelopeWkt`

This allows the proven shared downloader and mosaic scripts to be reused without hardcoding each new project into the Guilin source.

## Standard execution

1. Copy project configuration and resolved AOI into a local work directory under `C:\HaihaoDEM`.
2. Create or reuse the Python environment from the shared requirements file.
3. Run ASF planning with `--plan-only`.
4. Load the saved DPAPI token or invoke `InvokeChromeSessionDownload.ps1` against the authenticated Chrome profile.
5. Download and preserve the selected sources.
6. Confirm genuine `*.dem.tif` or `*_dem.tif` files.
7. Run the project mosaic when the phase includes mosaic construction.
8. Verify COG outputs, masks, QA and hashes.
9. Write the handoff and stop.

## Prohibited substitutions

For a strict ASF project, do not switch to Copernicus GLO-30, Mapzen, AWS Terrain Tiles, SRTM, ASTER, synthetic terrain, an upsampled public fallback, a mocked raster or a plan only result.

When authentication, source transfer or coverage fails, record the precise blocker and retain resumable state.

## Completion gate

Completion requires real files on disk and file based QA. At minimum report the AOI, selected product count, source DEM file count, final COG path, file size, SHA-256, CRS, pixel spacing, raster dimensions and bounds, valid coverage fraction, NoData and fill counts, elevation statistics, and the credential route used without exposing credential contents.
