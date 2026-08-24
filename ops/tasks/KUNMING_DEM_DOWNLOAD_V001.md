# Kunming DEM v0.1 strict 12.5 m download and mosaic task

## Branch

`project/kunming-dem-v001`

## Target

`integration/ecology-v040`

## Fixed AOI

- Center: 昆明翠湖
- WGS84 center: 102.70228 E, 25.05042 N
- Shape: projected square
- Area: 20,000 km²
- Side length: 141,421.356237 m
- Project CRS: EPSG:32648
- Output grid spacing: 12.5 m

The checked-in AOI GeoJSON is authoritative. The projected square area and center containment must be verified before acquisition.

## Strict source policy

1. Use only the established authenticated NASA Earthdata and ASF acquisition path for ALOS PALSAR `RTC_HI_RES` DEM assets with 12.5 m posting.
2. Download DEM elevation assets ending in `.dem.tif` or `_dem.tif`, together with the matching metadata needed to establish source lineage, footprint, CRS, vertical reference and pixel spacing.
3. Preserve every original source file without modification and record URL, granule, byte count and SHA-256 checksum.
4. A NASA Earthdata bearer token must be supplied through the existing secret or local token mechanism. Never commit credentials.
5. Do not download, generate, test or publish Copernicus GLO-30, Mapzen, AWS Terrain Tiles, SRTM preview mosaics or any other approximately 30 m fallback.
6. Do not upsample a coarser fallback and label it 12.5 m.
7. If authenticated 12.5 m acquisition cannot complete, fail closed and report the exact blocking request. Do not create a substitute mosaic.
8. Do not use Chinese commercial download sites or unverified mirrors.

## Required implementation

Work only under `projects/kunming/` and reuse proven repository utilities where appropriate.

Required outputs:

- `aoi/kunming_cuihu_20000km2_square.geojson`;
- deterministic AOI derivation and validation;
- ASF search plan listing all selected granules and approximate AOI coverage;
- resumable authenticated download;
- original 12.5 m-posting DEM assets and source metadata;
- source manifest and SHA-256 checksums;
- exact-AOI mosaic in EPSG:32648 with 12.5 m output spacing;
- Cloud Optimized GeoTIFF output;
- coverage, NoData, overlap, seam and extent QA;
- source and mosaic elevation statistics;
- `HANDOFF_KUNMING_DEM_V001.md`.

## Mosaic rules

- Use the checked-in square AOI as the clip boundary.
- Keep all source rasters traceable through the manifest.
- Use a single aligned EPSG:32648 grid with 12.5 m pixel spacing.
- Do not silently fill uncovered AOI cells from another dataset.
- Do not declare completion below 99.9% valid AOI coverage. Any remaining gap must stop the build and be listed by area and location.
- Validate the final COG, dimensions, transform, bounds, data type, NoData value, elevation range and checksum.

## Stop condition

Stop immediately after the verified 12.5 m-posting source download, exact-AOI mosaic COG, minimal QA reports, checksums and handoff are complete.

Do not build a 30 m preview, hillshade website, ecology, agriculture, seasons, historical reconstruction, future core terrain or a public site. Keep the PR open and Draft. Do not merge it.
