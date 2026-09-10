# KAOPU Current Best View — R11 cloud aggregation/representativeness extension

Date: 2026-09-10
Status: Candidate extension to `CURRENT_BEST_VIEW.md`; no Frozen change.

86. Physical variable validity and representativeness are separate. A source-native optical diagnostic may be valid while its temporal/spatial support is unsuitable for direct realtime voxel use.
87. Every Weather/Atmosphere quantity should preserve an `AggregationSupportContract`: temporal support and interval, timestamp convention, horizontal grid/support and remap lineage, vertical/path support, in-cloud versus grid-mean semantics, and source/model identity.
88. `pathOpticsReady` does not imply `instantaneousLocalVolumeReady`. MERRA-2 three-hour time-averaged in-cloud optical thickness is a coarse interval/grid-cell diagnostic unless a separate disaggregation model creates finer state.
89. Spatiotemporal downscaling below source support is a state-generating operation, not a coordinate conversion. It must be represented as `OperationKind.spatiotemporal_disaggregation` with `DerivedSyntheticDisaggregation` lineage.
90. Nonlinear radiative evaluation cannot generally commute with averaging: `E[exp(-tau)] != exp(-E[tau])`. Time-mean optical depth must not be presented as transmittance-equivalent instantaneous optical depth.
91. Separately averaged marginal fields do not recover their joint state. In general `E[C*tau] != E[C]E[tau]`; cloud-fraction/optical-depth covariance and conditional semantics can matter.
92. Mean path optics and mean geometry do not uniquely define mean local extinction: `E[tau/dz] != E[tau]/E[dz]` in general.
93. Coarse mean optical depth and coverage do not determine subgrid spatial organization, silhouettes, correlation, motion or beam/shadow paths. Multiple local fields can satisfy the same coarse constraints.
94. Procedural/noise detail is legitimate only as a declared conditional realization or evaluator/art-direction layer. It does not recover unobserved/model-unresolved cloud structure and may not overwrite Weather Observation/model state.
95. MERRA-2 is useful as a global reanalysis/reference constraint but its delayed, 3-hour mean, coarse support prevents direct promotion to current instantaneous Weather truth. Source selection must match intended temporal/spatial use.
96. Renderer local coefficients remain downstream adapter targets. UE/Karma local extinction/scattering semantics do not justify treating coarse path/time-mean diagnostics as local meteorological truth.
97. Error reporting for Weather-to-render integration should separate source/model/reanalysis uncertainty, aggregation/representativeness error, disaggregation/downscaling uncertainty, optical-closure error, numerical evaluator error, visual approximation and performance cost.

R11 evidence status:
- Independent Observation roots remain distinct: NASA GMAO MERRA-2 product/time-support semantics and current MERRA-2 system/latency semantics.
- NASA Earthdata CMR/GES DISC is catalog/access metadata, not an independent physical Observation root.
- SideFX Karma and UE 5.8 are engineering evaluator roots, not meteorological truth.
- Executable semantic probe: `PROBES/cloud_aggregation_representativeness_probe_r11.py`, result `6/6 PASS` in the bounded cycle.
- No authenticated M2T3NVCLD NetCDF cloud-value packet was materialized; the R10 packet-ingestion gate remains open.
- Frozen: none.
