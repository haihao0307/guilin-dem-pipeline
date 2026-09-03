# Wenzhou V200 17-tile truth, OSM hydrology and bathymetry rebuild

## Scope

Continue only on branch:

```text
project/wenzhou-v200-17tile-truth-hydrology-rebuild
```

Base branch:

```text
review/wenzhou-uncropped-20260826
base commit e84b507653554ecc8062c75d3be597d82de57d93
```

Keep the pull request open, Draft and unmerged. Do not modify `main`, `gh-pages`, PR #49, PR #53 or their branches. Do not force-push or rewrite history.

## Frozen new truth identity

```text
WENZHOU_17TILE_SCREENSHOT_CROP_12_5M_COG.tif
bytes 136760745
SHA-256 c1da93dca81abc2ee9edaa47496d80c6fa36155e11c9b61464f4f2b547659b43
CRS EPSG:32651
grid 17555 × 17918
pixel 12.5 m
transform [12.5, 0, 187912.5, 0, -12.5, 3243587.5]
bounds [187912.5, 3019612.5, 407350.0, 3243587.5]
```

The old Qingjiang truth remains historical and must not supply elevation, crop geometry, marine mask or runtime height assets to V200.

## Stage 0, repository foundation

1. Freeze the new truth identity, AOI, source-package receipt and binary gate.
2. Record that the exact COG binary is currently absent from this execution runtime.
3. No LFS upload, GEBCO alignment, terrain draping or browser publication may claim completion before exact byte and SHA-256 verification.

## Stage 1, OSM reacquisition

1. Reacquire `natural=coastline` and `waterway=river|stream|canal|tidal_channel` from OpenStreetMap for the new WGS84 envelope.
2. Preserve every Overpass query, compressed raw response, endpoint attempt, OSM way ID, source coordinate, timestamp, license and SHA-256.
3. Project to EPSG:32651 and clip to the exact V200 bounds.
4. Preserve centerline coordinates. Width controls may alter lateral offsets only.
5. Commit only source-traceable geometry. Manual coastlines and hand-drawn rivers are prohibited.
6. Keep estuary connectivity explicitly `pending` until a separate topology stage passes.

## Stage 2, exact COG Git LFS archive

Start only after the exact 136760745-byte COG is mounted.

1. Verify byte count and SHA-256 before any repository write.
2. Store at:

```text
projects/wenzhou/v200/truth/WENZHOU_17TILE_SCREENSHOT_CROP_12_5M_COG.tif
```

3. Use Git LFS.
4. Fresh-clone the branch, download the LFS object and verify the same byte count and SHA-256.
5. Update the manifest only after the fresh-clone check passes.

## Stage 3, GEBCO 2026 rebuild

Start only after Stage 2 passes.

1. Reacquire the official GEBCO 2026 Grid and TID subset for the new buffered V200 coastal domain.
2. Preserve native source subsets and build independent 100 m EPSG:32651 COGs.
3. Never stretch, translate or reuse the old PR #49 bathymetry as if it covered V200.
4. Land and sea remain separate reversible layers.
5. Record source-quality and vertical-datum uncertainty.

## Stage 4, topology, draping and labels

1. Build the marine surface from real coastline and island topology.
2. DEM NoData and source-tile gaps must not be interpreted as sea.
3. Drape OSM waterway centerlines using the new truth COG only.
4. Build place labels from source-traceable OSM place features with OSM IDs and projected coordinates.
5. Points outside the AOI remain outside. Clamping labels to the map edge is prohibited.
6. Unverified informal names remain hidden or visibly marked unresolved.

## Stage 5, browser QA

1. Use one EPSG:32651 world origin and one documented north-up transform.
2. Raster row zero maps to the north edge.
3. No manual flip or rotation is allowed.
4. Show land, coastline, rivers, ocean and bathymetry as independent switchable layers.
5. Verify representative screenshots for the north, south, east, west, coast, estuaries and islands.
6. Console errors must be zero.
7. Automated QA cannot override failed visual review.

## Fixed prohibitions

```text
oldQingjiangTruthUsed=false
manualRiverGeometry=false
manualCoastlineGeometry=false
manualPlaceClamping=false
syntheticGapFill=false
30mFallback=false
verticalScale=1.0
publicDeploymentAllowed=false
visualAcceptance=false
productionReady=false
```
