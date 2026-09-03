# Wenzhou V200 numeric field pipeline

This contract freezes the original 12.5 m DEM truth and moves downstream production to deterministic numeric fields.

## Persistent assets

Allowed persistent assets are immutable source truth, numeric height fields, numeric masks, compact numeric time series, source-traceable OSM truth, schemas, build rules, receipts and QA hashes.

Persisted mesh files, baked render geometry, temporary triangulations, preview geometry caches, manually drawn waterways, manually drawn coastlines, manually placed labels and synthetic gap fills are prohibited.

The original DEM is read-only. Rebuildable intermediates must be deleted after use unless they are explicitly promoted as numeric truth with provenance and QA.

## Tide stage

The first active tide input is the audited Kanmen UHSLC 35-day hourly comparison window from PR #49. It contains 840 complete quality-code-4 samples from 1997-11-26 16:00 UTC through 1997-12-31 16:00 UTC exclusive.

The stored comparison series has its observation-window mean removed. It may be used for phase, rise or fall direction and tidal range validation. It may not drive absolute shoreline elevation because the source datum is station zero and no verified transform to the selected DEM or sea-level datum has been applied.

The numeric driver uses little-endian signed int16 millimeters. The binary contains 840 samples and no geometry.

## Locked gates

Absolute water elevation remains locked until a verified transform connects the selected FES mean-sea-level reference to the Kanmen benchmark or Yellow Sea datum.

Current-date daily prediction remains locked until verified FES2022b output is materialized for the requested dates. The fixed 1997 observation window cannot be presented as a current forecast.

Any future ocean material must consume numeric coastline masks, bathymetry, relative or absolute tide values and the verified datum transform. It must not use a full-AOI fallback plane or interpret DEM NoData as ocean.

The transient runtime surface policy will be reconciled with the forthcoming Xiaowang full pipeline handoff before production approval.
