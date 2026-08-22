# Guilin v0.5 Worker 1A: DEM completion and river continuity

## Branch

`codex/guilin-hydrology-gaea-v050`

## Target

`project/guilin-v050-four-core`

This focused task replaces the failed combined execution attempt. Work only on DEM coverage, Li River and Xiang River continuity, water clipping, hydrology diagnostics and tests. GAEA UI regression is assigned to a separate worker.

## Required work

1. Resolve the established overall AOI and all source-tile requirements.
2. Identify and retry missing DEM coverage toward 真宝鼎 without shrinking the AOI.
3. Preserve source product IDs, URLs, checksums, native resolution, CRS, vertical units and license metadata.
4. Repair full Li River and Xiang River centerline topology before rasterization.
5. Use the same project CRS, pixel origin, Y orientation and AOI clipping contract for terrain, linework, polygons, distance fields and web assets.
6. Prevent water from leaving, shifting or mirroring at tile and AOI edges.
7. Generate permanent-water and active-channel masks consumable by vegetation and agriculture workers.
8. Add diagnostics for source linework, repaired linework, water polygons, active banks, invalid endpoints, gaps, overlaps and boundary crossings.
9. Add automated tests for overall AOI coverage, all four core centers, Zhenbao Ding coverage state, Li and Xiang continuity, valid boundary endpoints, raster orientation and water-to-terrain intersection.
10. Create `HANDOFF_GUILIN_DEM_HYDROLOGY_V050.md`.

## Acceptance

- no unexplained midstream breaks in Li River or Xiang River;
- no water outside the terrain footprint except valid source boundary crossings;
- no Y-axis inversion or texture-coordinate shift;
- every core lies inside the overall DEM coverage;
- missing Zhenbao Ding source state is resolved or recorded with exact retry evidence;
- source truth and v0.3.1 remain untouched;
- focused tests pass.

Push changes to this branch and keep PR #15 in draft. Do not work on GAEA UI in this task.
