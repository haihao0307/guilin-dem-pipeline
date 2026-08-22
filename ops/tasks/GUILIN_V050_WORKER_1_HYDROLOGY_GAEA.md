# Guilin v0.5 Worker 1: hydrology continuity, DEM completion and GAEA regression

## Branch

`codex/guilin-hydrology-gaea-v050`

## Target

`project/guilin-v050-four-core`

## Read first

- `ops/tasks/GUILIN_V050_MASTER.md`
- `projects/guilin/config/core_regions_v050.json`
- current project waterway data and build scripts
- current web page and GAEA proof page
- Git history and previous implementations that contained the visible GAEA controls
- current DEM source, download, mosaic and QA manifests

## Scope

1. Complete any missing DEM coverage toward 真宝鼎. Do not shrink the established overall AOI to avoid the missing data.
2. Repair and validate continuous Li River and Xiang River linework through the whole AOI.
3. Fix water that leaves the terrain or shifts at clipped edges.
4. Restore the missing GAEA-style controls and regression tests.
5. Produce versioned terrain, hydrology and diagnostic assets needed by the other workers.

## DEM completion

- Resolve the current overall AOI and tile manifest.
- Identify missing or failed DEM tiles, especially the 真宝鼎 direction.
- Re-run source selection and download through the project’s existing allowed data pipeline.
- Prefer truthful approximately 12.5 m terrain. Do not relabel resampled data as a better native source.
- Record source URLs, source IDs, checksums, coverage and license metadata.
- Mosaic and validate without seams, holes, duplicate strips or projection shifts.
- Preserve source products and current stable v0.3.1 assets.

## River continuity

- Use approved river vectors and DEM flow as constraints.
- Repair gaps and invalid topology in the Li River and Xiang River before rasterization.
- Add a named main-channel graph and a continuity report.
- The graph must have valid in-AOI endpoints only where the river crosses the AOI boundary.
- Prevent duplicate segments, self-intersections caused by repair, isolated midstream fragments and river polygons outside the terrain footprint.
- Use the same CRS transform, pixel origin, Y orientation and AOI clip as terrain.
- Add diagnostics for line source, repaired line, water polygon, active bank, clipped output and invalid endpoints.

## GAEA regression

- Find the last known good implementation that displayed the GAEA-style panel or controls.
- Restore the panel and the following functional groups where they previously existed: erosion, rock exposure, terrain detail, water, vegetation, agriculture and diagnostics.
- Do not replace truth terrain with a decorative terrain generator.
- Keep the current ecology and release selectors intact.
- Add DOM and interaction tests for the panel and required controls.
- Add a regression note explaining which commit or file was used as the recovery source.

## Outputs

- repaired river vector and topology report;
- water raster or packed field with documented channel contract;
- overall AOI coverage report;
- missing-tile download report;
- terrain and water diagnostics;
- restored GAEA UI and tests;
- `HANDOFF_GUILIN_HYDROLOGY_GAEA_V050.md`.

## Acceptance

- overall AOI still covers the established project range and all four core centers;
- 真宝鼎 source coverage is present or the exact external-source blocker is documented with retry state;
- Li River and Xiang River have no unexplained midstream breaks;
- water does not leave or shift away from terrain at tile and AOI edges;
- vegetation exclusion can consume the final water and active-channel masks;
- GAEA controls are visible and interactive;
- current stable page remains available;
- tests pass and browser console errors are zero for the repaired pages.

Submit a draft PR to `project/guilin-v050-four-core`. Do not merge it yourself.
