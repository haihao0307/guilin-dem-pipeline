# Wenzhou R3.3 Environmental Data Intake

Date: 2026-09-08

This branch is an isolated evidence and acquisition branch for environmental context around the locked Wenzhou domain. It must not be merged wholesale into the Xiaoma coordination branch or treated as the Wenzhou production baseline.

Locked domain:

- CRS: EPSG:32651
- Bounds: 190475.0, 2991275.0, 411250.0, 3241862.5
- Canonical land grid: 12.5 m, 20047 rows, 17662 columns

The first live acquisition probe targets SoilGrids 250 m. Source-native values, source projection, request parameters, uncertainty semantics and hashes are retained. Any EPSG:32651 derivative remains a regional environmental covariate and cannot be promoted to 12.5 m field truth.

Current gates:

- Canonical DEM remains read-only.
- Environmental layers have independent source identity.
- Native resolution and uncertainty must remain visible.
- No silent upsampling or datum guessing.
- A layer is ready only after payload, source identity, coverage and QA all pass.
