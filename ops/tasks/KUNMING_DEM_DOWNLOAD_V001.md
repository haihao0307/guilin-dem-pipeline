# Kunming DEM v0.1 download, mosaic and QA task

## Branch

`project/kunming-dem-v001`

## Target

`integration/ecology-v040`

## Fixed scope

- Center: 昆明翠湖
- WGS84 center: 102.70228 E, 25.05042 N
- Overall area: 20,000 km²
- Shape: projected square
- Side length: 141,421.356 m
- Project CRS: EPSG:32648
- Historical target for later work: 1940-1945

This phase ends after verified DEM download, mosaic, QA and file packaging. Do not build ecology, agriculture, seasons, the 100 km² core, or a public candidate site in this phase.

## Data-source policy

1. Reuse the existing authenticated project download framework where possible.
2. Prefer truthful approximately 12.5 m terrain from the established allowed source pipeline when complete coverage and licensing are available.
3. Preserve original source products and metadata.
4. If the preferred source has gaps or fails, record the exact reason and use an explicitly labeled fallback such as Copernicus DEM GLO-30 only after source and license checks.
5. Never relabel a 30 m fallback or resampled product as native 12.5 m or 1 m data.
6. Do not use Chinese commercial download sites or unverified mirrors.

## Required implementation

Create an independent project directory under:

```text
projects/kunming/
```

Add:

- AOI derivation script and resolved projected bounds;
- source search and download manifest;
- resumable download scripts;
- checksums;
- original source directory structure;
- mosaic and reprojection script;
- COG output;
- coverage, NoData and overlap QA;
- elevation statistics;
- hillshade and low-resolution overview preview;
- `HANDOFF_KUNMING_DEM_V001.md`.

## QA

Verify:

- the projected square area is 20,000 km² within numerical tolerance;
- the center is inside the AOI;
- all source tiles cover the AOI or gaps are explicitly listed;
- source checksums pass;
- CRS and vertical units are documented;
- NoData, seams, duplicate strips and overlaps are measured;
- mosaic extent matches the resolved AOI;
- output COG validates;
- source and mosaic elevation ranges are plausible and reported;
- every fallback is labeled by native resolution and source;
- the future 10 km × 10 km core is recorded as disabled and unbuilt.

## Stop condition

Stop the project after the files, mosaic, reports, preview and handoff are complete. Do not continue into vegetation, historical reconstruction or detailed browser work.

Submit a draft PR to `integration/ecology-v040`. Do not merge it yourself.
