# KAOPU Current Best View — R13 microphysics-to-optics extension

Date: 2026-09-10
Status: Candidate extension to `CURRENT_BEST_VIEW.md`; no Frozen change.

111. Raw hydrometeor mass mixing ratio plus number concentration is not a unique optical closure unless the particle-size-distribution family/shape and mass-size assumptions are fixed; equal mass and count can have different projected area and extinction.
112. A model-consistent diagnostic replay is a distinct derived operation. `MicrophysicsDiagnosticReplay` consumes a source-model state plus exact algorithm/version lineage and produces `SourceModelDerivedReplay`, not an Observation and not a source-native field.
113. Prefer a provider's own microphysics-consistent diagnostic over a new generic shortcut when its required inputs and exact implementation are available. A generic `q/N -> radius` mapping remains Candidate-only unless explicitly part of the locked source model.
114. HRRRv4's public native schema contains the field categories required by the documented Thompson `calc_effectRad` interface (`TMP/PRES/SPFH/CLWMR/NCONCD/CIMIXR/NCCICE/SNMR`), but the exact operational HRRRv4 implementation/hash is not yet locked; therefore an exact HRRRv4 effective-radius replay is still Unknown.
115. `MomentClosureContract` is first-class: predicted moments, basis/units, PSD family and shape parameters, mass-size law, density assumptions, clamps/bounds and model/version provenance must travel with any replayed microphysical diagnostic.
116. Radiation effective radius is an intermediate closure, not a complete visible-light medium. A `SpectralOpticalClosureContract` must additionally state wavelength/band, refractive-index source/version, particle phase/habit/roughness, PSD width/variance, scattering solver/LUT, validity range and uncertainty.
117. Liquid and ice optical closure have separate readiness. Homogeneous spherical-water Lorenz-Mie is a defensible liquid candidate when explicitly scoped; it must not be silently reused for ice, whose habit/roughness/phase assumptions remain material.
118. Per-metre extinction requires volumetric support. Compact Weather packets must retain `MASSDEN` or enough thermodynamic state to derive air density; source per-mass quantities must not be treated as already spatial optical coefficients.
119. `FRACCC`, overlap and subgrid realization remain support/aggregation semantics, not a scalar correction that makes a local extinction field exact. R11 `DerivedSyntheticDisaggregation` still governs sub-source-scale cloud structure.
120. The renderer-neutral optical packet should carry spectral/band extinction, scattering, absorption, single-scattering albedo and phase/asymmetry representation with units/support/uncertainty before any UE/Karma/Three.js-WebGPU adapter is applied.
121. Renderer adapters may map the same physical packet into engine-specific parameterizations, but evaluator tuning, sample budgets and light-intensity controls cannot alter Weather or optical-closure truth.
122. Error reporting remains layered: source/model error; diagnostic-replay/version error; moment/PSD closure error; spectral/scattering-model error; representativeness/disaggregation error; and evaluator numerical/visual/performance error must not be collapsed into one confidence score.

R13 evidence status:
- No new physical atmospheric Observation Root was added.
- NOAA HRRR system/configuration, NOAA/NOMADS product schema, DTC/WRF Thompson diagnostics, DTC RRTMG cloud-radiation inputs, NASA liquid-water Mie lookup work, SideFX Karma and UE 5.8 are kept as distinct engineering/model evidence roots.
- Executable semantic probe: `PROBES/hrrr_microphysics_optical_bridge_probe_r13.py`, result `7/7 PASS`; all numerical cloud values in that probe are test-only synthetic values.
- The HRRR GRIB2 body was not materialized; no actual HRRR atmospheric value is claimed.
- Frozen: none.
