# KAOPU Current Best View — R26 visible cloud optical closure extension

Date: 2026-09-11
Status: Candidate extension to `CURRENT_BEST_VIEW.md`; no Frozen change.

261. Effective radius is not cloud opacity, density or color. A valid optical closure additionally requires phase-resolved condensate/water-path amount, optical-model identity, spectral identity and path/subgrid semantics.
262. In the locked HRRRv4 RRTMG-SW path, liquid/ice/snow optical contributions are evaluated from **in-cloud** water paths plus effective particle size; radius changes the optical coefficient while water path controls how much optical depth is accumulated.
263. `OpticalClosureIdentity` must bind source/model/version, hydrometeor category, effective-size definition, parameterization/LUT identity, spectral grid, delta-scaling convention, subgrid policy and any clamp/fallback/remap behavior.
264. Ice effective-size semantics are parameterization-specific. A numeric radius without its ice optics flag/model is not a complete quantity identity and must not be silently routed across models.
265. Mixed-phase clouds must be composed in optical/scattering space after per-phase evaluation. Averaging liquid/ice/snow effective radii and evaluating one optical law is rejected.
266. Preserve `ProducedRadiusIdentity` separately from `ConsumedRadiusIdentity`. Locked radiation code can clamp, substitute or reclassify inputs before evaluating optics; source-native replay needs the consumed lineage as well as the microphysics output.
267. Preserve non-delta and delta-scaled optical packets as different identities. Delta scaling changes optical depth and scattering properties and therefore cannot be hidden as an implementation detail when crossing evaluator boundaries.
268. A preferred renderer-neutral exchange is `SpectralLayerOpticalPacket`: spectral-band identity, phase-resolved/total optical depth, single-scattering albedo, asymmetry/phase-moment semantics, path basis, subgrid identity, optical-model identity and evidence/provenance.
269. Path optical depth is dimensionless and must not be mislabeled as local volume extinction. `LocalVolumeOpticsAdapter` may derive m^-1 coefficients only with an explicit spatial/path-distribution assumption such as a declared homogeneous layer length.
270. Cloud fraction/overlap is a separate subgrid geometry contract. Binary clear/cloudy transmission is nonlinear, so `cloudFraction * inCloudTau` is not a universal replacement for explicit subcolumn/overlap treatment.
271. Spectral-to-RGB/display projection is an evaluator transform. RGB cloud color is not Canonical Weather truth and must never overwrite the spectral packet.
272. Locked HRRRv4 snow optics reuses cloud-ice lookup constants and the source itself identifies that treatment as imperfect. Table reuse must be preserved as a source limitation, not upgraded into a claim of independent snow-optics validity.
273. Renderer interfaces such as Karma local absorption/scattering rates and UE/Blender volume density/extinction are downstream adapter targets. Their artistic, phase and multiple-scattering controls remain evaluator state and may not feed back into Weather Canonical Truth.
274. Mother work order is now explicit: Weather emits typed phase/state + geometry; Atmosphere/optics evaluator emits spectral layer optics; Lighting/renderer adapter converts spectral/path optics to local/render-space quantities. A Mother must reject missing closure inputs rather than invent density/color from radius alone.
275. R26 adds no physical Observation Root, does not execute WRF/HRRR, leaves `ReplayStatus=source_callpath_authenticated`, and leaves Frozen unchanged. The R25 serial-SCM execution gate remains independent and still requires an environment with csh + NetCDF-Fortran.

R26 evidence status:
- Observation: no new physical atmospheric Observation Root. NOAA-EMC source, ECMWF radiation documentation and renderer documentation remain engineering/model/evaluator evidence roots.
- Candidate: `OpticalClosureIdentity`, `OpticsInputLineage`, `SpectralLayerOpticalPacket`, `LocalVolumeOpticsAdapter`, `MixedPhaseCompositionRule`, `OpticsFallbackPolicy`, plus the explicit Weather -> Optics -> Lighting Mother work contract.
- Current Best View: keep Weather state, spectral path optics and renderer-local quantities as three typed stages with one-way provenance-preserving adapters.
- Frozen: none.
- Rejected: radius-alone optics; universal frozen-particle radius semantics; averaged mixed-phase radius; path tau as local density; cloud fraction as a universal extinction multiplier; producer radius automatically equals consumed radius; direct RRTMG packet equals arbitrary renderer phase model; reused ice LUT proves independent snow optics; RGB is Weather truth.
- Unknown: real source-native RRTMG optical packet from a locked runtime checkpoint; final KAOPU spectral-to-renderer projection; source-native versus newer cloud-optics evaluator choice; cross-renderer tolerance; R25 serial-SCM execution.
- Executable numeric/source-semantic probe: `PROBES/hrrrv4_visible_optics_closure_probe_r26.py`, result `13/13 PASS`, SHA256 `9b688058d3521a1bedb068a7b2c703c6b13d3d97e6fb7fc885c55007505ad5c4`.
