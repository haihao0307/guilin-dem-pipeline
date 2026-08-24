# ASF RTC reference DEM acquisition skill

## Purpose

Use the repository's established NASA ASF DAAC workflow to search, download, preserve and mosaic ALOS PALSAR `RTC_HI_RES` ancillary DEM assets for DEM production projects such as Guilin, Kunming and Wenzhou.

## Product identity

The canonical production label is:

`12.5米输出像元的ASF RTC参考DEM`

The pipeline writes a `12.5 m` output grid and keeps:

- `native12_5mSurveyClaim=false`
- original source products
- search response and selected-product plan
- source URLs and product IDs
- metadata XML or downloaded archives
- byte counts and SHA-256 hashes
- source-count and fill-class rasters
- coverage and elevation QA

Do not rename this product as a native 12.5 m survey DEM.

## Approved authentication paths

Run authenticated downloads in the user's Windows environment. Use the first available path:

1. `EARTHDATA_TOKEN` already present in the process environment.
2. `%APPDATA%\HaihaoDEM\earthdata-token.dpapi`, decrypted only through the existing Windows DPAPI loader in `Common.ps1`.
3. The existing authenticated ASF Chrome session under `C:\HaihaoDEM\ASF_v104_local`.

Credentials stay local. Never commit a password, token, cookie, browser profile or decrypted credential.

Do not ask the user to send the ASF password again while the saved DPAPI token or the logged-in Chrome session remains usable.

A cloud Codex environment cannot inherit Windows DPAPI state or the local Chrome profile. Codex must prepare and validate the project configuration and local runner, then leave the authenticated transfer to the Windows runner. It must not use a public 30 m replacement.

## Existing reusable implementation

Reuse these files:

- `DEM-Map-Pipeline/guilin-zhenbaoding-yangshuo-pingle/scripts/asf_download_stdlib.py`
- `DEM-Map-Pipeline/guilin-zhenbaoding-yangshuo-pingle/scripts/mosaic_dem.py`
- `DEM-Map-Pipeline/guilin-zhenbaoding-yangshuo-pingle/local_tools/Common.ps1`
- `DEM-Map-Pipeline/guilin-zhenbaoding-yangshuo-pingle/local_tools/SetEarthdataToken.ps1`
- `07_SET_EARTHDATA_TOKEN_NO_FLASH.cmd`

The Python downloader already provides ASF SearchAPI planning, path and frame deduplication, AOI coverage selection, bearer authorization across redirects, resumable `.part` downloads, TIFF and archive validation, direct DEM transfer, archive extraction, metadata transfer, SHA-256 recording and source-manifest generation.

The mosaic implementation already provides CRS inspection, project reprojection, aligned 12.5 m output grids, median overlap reduction, source-count and fill-class rasters, configurable gap treatment, COG generation, overviews, coverage statistics, elevation statistics and output checksums.

## Chrome session contract

The local Chrome-session implementation is expected at:

`C:\HaihaoDEM\ASF_v104_local\scripts\run_chrome_session_download.ps1`

It reuses a browser session that already displays the ASF `Welcome` state. It does not read the account password, token or Chrome password store. Chrome may request one confirmation for multiple downloads or file retention.

Project runners expose:

- `ASF_CHROME_TASK_FILE`
- `ASF_PROJECT_WORK_ROOT`
- `ASF_PROJECT_ID`

When the Chrome script declares `TaskFile` or `OutputRoot` parameters, pass the same values explicitly.

PowerShell values returned from JSON, COM, browser windows or process queries may collapse to a scalar when one item is returned. Before reading `.Count`, always coerce the value to an array:

```powershell
$count = @($value).Count
```

Apply the same rule to task lists, browser targets, downloaded files and selected products. This prevents the strict-mode missing-`Count` failure observed on the first download item.

## Per-project files

Each project must contain an authoritative AOI GeoJSON, project configuration, empty or resolved existing-source manifest, resolved AOI compatibility JSON, Windows keep-open launcher, Windows local build script and final handoff.

The compatibility `resolved_aoi.json` must contain:

- `status: exact_boundary_resolved`
- `final.wgs84Polygon`
- `search.envelopeWkt`

This permits reuse of the proven downloader and mosaic scripts without hardcoding a new project into the Guilin source files.

## Standard execution

1. Copy project configuration and resolved AOI into a local work directory under `C:\HaihaoDEM`.
2. Create or reuse the Python environment from the shared requirements file.
3. Run ASF planning with `--plan-only`.
4. Load the saved local credential or invoke the logged-in Chrome session route.
5. Download and preserve the selected sources.
6. Confirm genuine `*.dem.tif` or `*_dem.tif` files.
7. Run the project mosaic.
8. Verify COG outputs, masks, QA and hashes.
9. Write the handoff and stop.

## Prohibited substitutions

For a strict ASF project, do not switch to Copernicus GLO-30, Mapzen, AWS Terrain Tiles, SRTM, ASTER, synthetic terrain, an upsampled public fallback, a mocked raster or a plan-only result.

If authentication, source transfer or coverage fails, record the precise blocker and retain resumable state.

## Completion gate

Completion requires real files on disk and file-based QA. At minimum report the project AOI, selected product count, source DEM file count, final COG path, file size, SHA-256, CRS, pixel spacing, raster dimensions and bounds, valid coverage fraction, NoData and fill counts, elevation statistics, and the credential route used without exposing credential contents.
