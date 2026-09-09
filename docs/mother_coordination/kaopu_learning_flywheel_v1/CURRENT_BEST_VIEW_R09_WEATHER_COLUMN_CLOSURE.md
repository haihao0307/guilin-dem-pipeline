# KAOPU Current Best View — R09 Weather-column closure extension

Date: 2026-09-10
Status: Candidate extension to `CURRENT_BEST_VIEW.md`; no Frozen change.

65. `coordinate_conversion` and `spatial_retarget` are different physical operations and must be represented by different operation kinds. Coordinate conversion changes representation of the same physical state; retargeting changes where the state exists.
66. A coordinate conversion has a same-physical-state invariant. Converting pressure/geopotential/AGL representations may change numbers, but it may not translate the underlying atmospheric parcel merely because the destination terrain has a different elevation.
67. Preserving source AGL while moving a weather pattern to another terrain height is a derived synthetic retarget. The result needs a new identity/lineage such as `DerivedSyntheticRetarget`; it must not overwrite or masquerade as the source Observation.
68. Weather-to-render readiness is per quantity, not one Boolean. A column can be valid for pressure, geopotential height, temperature and runtime placement while cloud fraction, condensate and extinction remain `Missing`.
69. Humidity, relative humidity or dewpoint depression are not aliases for cloud density, cloud fraction, cloud liquid water, cloud ice water or optical extinction. Moisture-based cloud masks remain diagnostics/candidates unless separately validated.
70. Split cloud runtime state into at least `RuntimeCloudPlacement`, `CloudOpticalClosure`, and `EvaluatorBudget`. Their provenance and validity must be independently queryable.
71. Renderer requirements do not authorize fabricated weather values. If optical closure is absent, return typed `Missing/Unsupported` or use an explicitly synthetic engineering fixture; never promote renderer defaults into Weather truth.
72. Pressure-to-height interpolation between real sounding anchors is derived computation. Preserve anchor levels, interpolation law, valid interval and approximation status rather than reclassifying interpolated points as observations.
73. A synthetic optical-depth/transmittance probe can validate evaluator wiring, monotonicity and state immutability, but it cannot validate cloud microphysics or real-world optical depth.
74. Geopotential/geoid-relative weather placement is not canonical ellipsoid placement until geoid/datum transform context is explicit. Missing transform context must fail typed rather than guessing.

R09 evidence status:
- Independent Observation Roots remain distinct: NOAA/NCEI radiosonde archive/station semantics; NOAA/NWS operational station/coding identity; ECMWF model/data quantity semantics.
- UCAR `Current.rawins` is a transport mirror for the executable TEMP fixture and is not counted as an independent Observation Root.
- UE 5.8 and SideFX Karma remain engineering/renderer roots, not meteorological truth sources.
- Executable probe: `PROBES/weather_column_real_fixture_r09.py`, result `7/7 PASS` in the bounded cycle.
- Weather-coupling gate: partially closed for placement/operation semantics; optical closure, source byte-authentication and geoid-to-ellipsoid provenance remain open.
- Frozen: none.
