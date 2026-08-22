# Shared hard rules

1. Real DEM and approved historical reconstruction layers have highest authority.
2. `z_truth_m` is immutable. Terrain enhancement is stored in `z_micro_delta_m` and presentation output in `z_visual_m`.
3. Water, active channel, roads, buildings, airport, strong rock core and crop interior masks are hard exclusions for incompatible instances.
4. Real or reconstructed hydrology controls main rivers. Procedural hydrology may add fine tributaries only inside approved catchment masks.
5. Terrain generation order is truth ingest, derivatives, hydrology, landforms, hard exclusions, historical land use, macro land cover, child land cover, micro detail, instances and web tiles.
6. Nested Voronoi fields may subdivide an approved parent mask. They never create farmland, forest, water or settlements outside that parent mask.
7. All random placement uses deterministic IDs and seeds.
8. Current v0.3.1 assets and manifests are retained for rollback.
9. Web runtime must expose layer toggles and validation diagnostics.
10. Browser console errors are release blockers.
