# Guilin v0.6 user-supplied ASF tile ingest

The user supplied `AP_10613_FBS_F0480_RT1.zip` in the active conversation. Verification metadata is committed at:

`DEM-Map-Pipeline/guilin-zhenbaoding-yangshuo-pingle/metadata/user_supplied/AP_10613_FBS_F0480_RT1.receipt.json`

## Required ingest

1. Obtain the exact uploaded archive through the task attachment bridge using conversation file ID `file_00000000b1cc8211862d7dd2f2dd17f9`.
2. Verify the archive SHA-256 is `3959841a2caa52c627eb03825dab6dd043de8a1e46afdbecee438020d3d1d658`.
3. Extract only `AP_10613_FBS_F0480_RT1/AP_10613_FBS_F0480_RT1.dem.tif` initially.
4. Verify the DEM SHA-256 is `ff968e6f826d7b02605466fcbf8fa1a29f72033767361786c33539cd20342747`.
5. Preserve the archive and DEM unchanged in the immutable source cache.
6. Rebuild the 12.5 m mosaic using the ten verified existing sources plus this tile.
7. Recompute exact valid coverage, connected gap components, source-count raster, seams, NoData and checksums.
8. If any gap remains, report its exact geometry and required granule. Do not use 30 m data or interpolation.
9. Feed the truthful rebuilt 12.5 m result into the v0.6 terrain-only inspection route.

The archive has already been locally inspected: EPSG:32649, 12.5 m, 6396 × 5578, bounds `[327504.84375, 2704417.75, 407454.84375, 2774142.75]`, valid fraction `0.9967605078111073`, elevation range 29 to 1211 m.
