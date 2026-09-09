# KAOPU Current Best View — R10 CloudOpticalClosure extension

Date: 2026-09-10
Status: Candidate extension to `CURRENT_BEST_VIEW.md`; no Frozen change.

75. `hasCondensate` is not equivalent to `opticalClosureReady`. Condensate mass alone does not determine cloud optical depth, local extinction, scattering phase or unresolved-cloud transport.
76. A microphysical optical-closure route must preserve at least condensate quantity semantics, vertical/path geometry and air state, effective particle size/phase optical assumptions, spectral identity and subgrid cloud treatment. Missing dependencies stay typed Missing/Unsupported.
77. Cloud optical readiness is capability-specific: distinguish at least `pathOpticsReady`, `localExtinctionReady`, `phaseReady`, and `subgridReady` rather than using one renderer-ready Boolean.
78. Cloud condensate mixing ratios require explicit semantics such as `grid_mean`, `in_cloud`, or `unknown`. Cloud fraction cannot repair an unknown mixing-ratio meaning after the fact.
79. Cloud fraction represents unresolved coverage/subgrid state unless a named homogenization model says otherwise. It is not a universal multiplier on local extinction.
80. Path optical depth and local volume extinction are different typed quantities. `tau` becomes `beta_ext [m^-1]` only through an explicit path-length/distribution model with lineage.
81. Legitimate closure routes remain distinct: direct optical retrieval, microphysical closure, source-native model optics, and explicitly synthetic evaluator tests. Results from one route do not silently inherit the evidence status of another.
82. Renderer density/extinction/albedo/phase controls are adapter/evaluator representations. Their defaults may never be promoted into Weather truth because a renderer requires a value.
83. When a weather/reanalysis source already exposes a documented optical diagnostic, preserving that source-native optical packet is lower-assumption than reconstructing the same quantity using a hidden fixed particle radius. MERRA-2 `tavg3_3d_cld_Nv` is a candidate global experimental route because it exposes cloud fraction, in-cloud QL/QI and in-cloud liquid/ice optical thickness on model levels. Those optical depths remain source-model diagnostics, not universal truth or local 3-D extinction.
84. HRRR native fields remain useful for richer **regional** microphysical experiments over its operational CONUS and Alaska sectors. Source geography, latency, resolution and field semantics are part of validity and prevent HRRR from serving as Wenzhou/global Weather truth.
85. A physically meaningful cloud/light integration reports source/model or retrieval uncertainty separately from numerical integration error, visual approximation error and performance budget.

R10 evidence status:
- Independent roots remain distinct: ECMWF ecRad/OpenIFS radiation/model semantics; Copernicus C3S retrieval/product semantics; NOAA/NCEP operational model-product semantics; NASA GMAO MERRA-2 global reanalysis semantics.
- SideFX Karma and UE 5.8 remain engineering renderer roots, not meteorological truth.
- Executable semantic probe: `PROBES/cloud_optical_closure_probe_r10.py`, result `6/6 PASS` in the bounded cycle.
- Weather-coupling gate: advanced on sufficiency semantics and identified a lower-assumption global source-native-optics route; authenticated cloud packet ingestion and dual-evaluator consumption remain open.
- Frozen: none.
