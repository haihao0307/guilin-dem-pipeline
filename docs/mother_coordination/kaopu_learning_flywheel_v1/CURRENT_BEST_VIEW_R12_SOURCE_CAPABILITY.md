# KAOPU Current Best View — R12 Weather source capability/query-support extension

Date: 2026-09-10
Status: Candidate extension to `CURRENT_BEST_VIEW.md`; no Frozen change.

98. Weather-source suitability is query-relative, not a single scalar quality rank. A source can be excellent for regional current Weather and simultaneously unsuitable for global coverage or near-camera local-volume truth.
99. Every Weather provider should expose a `WeatherSourceCapabilityContract`: source/model/version, source role, lifecycle/operational state, effective time, geographic domain, horizontal support/grid/projection, native vertical support, temporal support/cycle/latency, quantity capabilities, optical-closure capability, access/subsetting method and acquisition lineage.
100. Source role survives ingestion. `analysis`, `forecast`, `reanalysis` and `observation` are not aliases; a model analysis does not become an independent atmospheric Observation Root because it assimilates observations.
101. Higher source resolution reduces representativeness/disaggregation uncertainty but does not eliminate it. NOAA HRRR 3 km/hourly support is materially closer to current regional Weather than approximately 50 km/3-hour MERRA-2, yet remains far coarser than a 100 m test-only close-view volume query.
102. `microphysicsReady` does not imply `opticalClosureReady`. Cloud liquid/ice mixing ratios, cloud fraction and number concentrations support a lower-assumption closure but are not themselves renderer extinction/scattering/albedo/phase coefficients.
103. Domain coverage is part of validity. Regional HRRR CONUS/Alaska state cannot become a universal global Weather source merely because it has stronger local support.
104. KAOPU should use `QuerySupportMatch` plus a `SourceFederationPolicy` rather than one permanent provider. Global reanalysis/reference, regional operational model, local observations and synthetic renderer-local realizations retain separate identities and evidence status.
105. Temporal dimensions remain typed: assimilation/input cadence, model cycle cadence, forecast/analysis valid time, statistical support interval and renderer update cadence must not be inferred from one another.
106. A sub-hourly 2-D product cannot be silently treated as the corresponding sub-hourly 50-level native microphysics volume. Support dimensionality and aggregation semantics are part of quantity identity.
107. Source lifecycle/version is a first-class validity dimension. The 2026 HRRR/RRFS transition demonstrates that provider replacement is a migration event requiring schema/support/quality/closure regression tests, not a transparent rename.
108. Transport feasibility is part of source routing. Current full HRRR native GRIB2 files are hundreds of megabytes per cycle; browser/runtime systems should normally consume filtered/subset/preprocessed packets with provenance rather than whole provider files.
109. `DerivedSyntheticDisaggregation` remains required for local structure generated below source support. Better source constraints reduce the synthetic gap; they never reclassify unobserved/unresolved detail as source truth.
110. The same Weather packet may have different readiness by task: e.g. `regionalCurrentWeatherReady`, `microphysicsReady`, `opticalClosureReady`, `localVolumeReady`, and `globalCoverageReady` should remain independently queryable rather than collapsed to one Boolean.

R12 evidence status:
- NOAA/GSL model-system semantics and NOAA/NCEP product-schema semantics are official evidence about HRRR capability, not physical cloud Observation roots.
- A live NOAA/NOMADS 2026-09-09 native-analysis index confirms the selected microphysical field family through hybrid level 50; no atmospheric values from the GRIB2 body were decoded in this cycle.
- NOAA/NCEP current production status and NOAA RRFS transition/product pages establish time-varying source lifecycle context; they are not meteorological Observation roots.
- Executable semantic probe: `PROBES/weather_source_capability_probe_r12.py`, bounded result `7/7 PASS`.
- Frozen: none.
