# Wenzhou Map Mother V0.1

## Goal

Use one Wenzhou spatial identity to express terrain, seabed, coast, water, transport and settlements through time without cloning the whole map for every year.

The current production target is the 1940s, with 1942 as the target year. Later decades are intentionally deferred until this short time window is reliable.

## Core rule: one base, sparse time deltas

Do not store `1942 DEM`, `1953 DEM`, `1965 DEM`, `modern DEM` as four complete products.

Store the spatial basis once, then describe each time state with sparse operations:

`State(t) = SpatialBasis + TerrainDelta(t) + WaterLandDelta(t) + HydroDelta(t) + InfrastructureDelta(t)`

Large mountains and unchanged low-frequency terrain are inherited. Only real changes are encoded.

## Persistent runtime data

The active runtime should contain only:

- the compact canonical terrain/spatial basis;
- compact historical coast/water controls;
- sparse change masks and local residuals;
- feature visibility/removal IDs for modern transport and structures;
- source identity, hashes, confidence and reversible operations.

Historical scans, source archives and recovery packages are cold evidence. They are never duplicated into each runtime epoch.

## 1940s first pass

High-confidence subtraction is allowed now for:

- motorway and motorway links;
- explicitly modern/construction roads;
- major modern bridges and cross-sea bridge systems;
- major reclamation and seawalls when historical open water is supported;
- modern reservoirs and dams when historical absence is secure.

Do not use 1:250,000 absence to erase minor roads, village paths, small bridges, drains or individual buildings.

## Coast and sea

The historical coastline does not need to be a literal scan trace. It may be inferred smoothly between reliable historical controls when:

1. the controls are preserved;
2. the inference method is recorded;
3. the result is reversible;
4. the inferred result is not mislabeled as surveyed truth.

Raw extraction guide lines are backend evidence only. They must not appear in the normal 3D view.

## Seabed

Ground and seabed belong to the same terrain system, but evidence status must remain explicit.

- observed/archived elevation stays authoritative;
- derived bathymetry may be used as a reconstruction layer with confidence;
- missing sea DEM is not silently converted into observed seabed;
- future better bathymetry replaces only the affected local residuals, not the whole world.

## Reservoir rollback

When a reservoir is known to be modern:

- remove the modern water surface and dam in the historical state;
- restore the historical river topology;
- reconstruct the drowned valley only where evidence supports it;
- otherwise store a derived valley estimate with confidence rather than fake truth.

## Evidence precedence

Current coarse atlas:

- NH51-13
- NG51-1
- NH51-14

Current local override:

- YUNG-CHIA / WENCHOW 1:12,500 city plan (1945)

Finer verified evidence overrides the coarse atlas only inside its footprint. No evidence source becomes a separate world.

## Size discipline

The existing approximately 2.x MiB compact Wenzhou core is the size behavior to preserve.

New historical evidence should normally increase the active runtime only by sparse deltas (KB to small hundreds of KB), not by adding another full DEM or scan.

A new source is accepted into runtime only after distillation. Original scans remain cold evidence.

## Next production step

1. retire the visible 1953 engineering guide lines;
2. build the 1940s land/water difference mask;
3. remove high-confidence reclamation and modern reservoirs from the 1940s state;
4. infer a clean historical coastline from coarse and local controls;
5. keep every change as a reversible delta against one Wenzhou Map Mother.
