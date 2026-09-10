# KAOPU Learning R11 — Cloud aggregation and representativeness before realtime volume use

Date: 2026-09-10
Status: Candidate-partial. No production Mother mutation.

## Bounded question

R10 identified NASA MERRA-2 `tavg3_3d_cld_Nv` as a lower-assumption global source-native-optics fixture because it exposes cloud fraction, in-cloud condensate and in-cloud optical thickness. Before ingesting those diagnostics into a realtime Weather/Atmosphere renderer, can a 3-hourly, coarse-grid, time-averaged optical packet legitimately be treated as an instantaneous local 3-D extinction field? If not, what aggregation/representativeness contract must KAOPU preserve?

This is the highest-value unresolved sub-question of `LQ-ATMOSPHERE-001` because the R10 next gate can otherwise commit a category error: authentic source-native optical depth may still be the wrong *support* for a realtime voxel field even when the variable itself is physically meaningful.

## Core logical correction

**Source-native optics are not automatically local realtime optics.**

MERRA-2 `TAUCLI/TAUCLW` can be valid source-model cloud optical diagnostics while still being insufficient for direct local-volume rendering because their support is a time-averaged, coarse model/grid cell and path optical thickness is not a pointwise extinction field.

Two operations therefore must remain distinct:

1. **Aggregation-preserving adaptation**: retain the same 3-hour interval/grid-cell diagnostic and expose it as a coarse/path optical constraint.
2. **Spatiotemporal disaggregation/downscaling**: invent a finer, instantaneous local cloud field consistent with coarse constraints. This necessarily adds model assumptions and must create `DerivedSyntheticDisaggregation` lineage.

Adding procedural noise to a 50-km, 3-hour mean field is not “recovering the missing real cloud.” It is a synthetic conditional realization unless independently constrained by higher-resolution observations/model state.

## Observation / evidence roots kept distinct

### Observation Root A — NASA GMAO MERRA-2 product semantics

The official MERRA-2 File Specification states that time-averaged collections are continuous averages over the stated interval and are timestamped at the center of the interval. Three-hourly time-averaged products are centered at 01:30, 04:30, 07:30 UTC and so on.

For `tavg3_3d_cld_Nv (M2T3NVCLD)` the specification states:
- 3-hourly from 01:30 UTC, time-averaged;
- 576 x 361 regular horizontal grid;
- 72 model levels;
- eight times per daily file;
- `CLOUD` = cloud fraction for radiation;
- `INCLOUDQI/INCLOUDQL` = in-cloud ice/liquid for radiation;
- `TAUCLI/TAUCLW` = in-cloud optical thickness for ice/liquid clouds.

The same specification separately provides `tavg3_3d_nav_Ne`, also 3-hourly time-averaged, with model-level edge pressure `PLE` and edge height `ZLE`.

Primary sources:
- https://gmao.gsfc.nasa.gov/gmao-products/merra-2/documentation_merra-2/
- https://gmao.gsfc.nasa.gov/pubs/docs/Bosilovich785.pdf

### Observation Root B — NASA GMAO spatial/support and latency semantics

Current GMAO system documentation describes MERRA-2 as a global reanalysis. The model runs at approximately 50-km horizontal scale, distributed products use 0.625-degree longitude by 0.5-degree latitude and 72 native model levels, and 3-D output frequency is 3-hourly. Current GMAO documentation also makes clear that MERRA-2 is delayed reanalysis rather than an operational instantaneous forecast stream.

Primary sources:
- https://gmao.gsfc.nasa.gov/reanalysis/
- https://gmao.gsfc.nasa.gov/gmao-products/merra-2/system-characteristics_merra-2/

### Observation Root C — NASA GMAO post-processing/remap semantics

The MERRA-2 File Specification states that the model computes on a cubed-sphere grid while distributed data are post-processed to a regular latitude-longitude grid. It documents conservative remapping and non-conservative bilinear interpolation, states that most variable collections use bilinear interpolation, and separately lists the conservatively remapped collections. Cloud diagnostics are not in that conservative list.

This supports a general representativeness rule: horizontal remap is part of evidence/provenance and must not be erased when a distributed field is later downscaled.

Primary source:
- https://gmao.gsfc.nasa.gov/pubs/docs/Bosilovich785.pdf

### Catalog / access source — NASA Earthdata CMR / GES DISC

Earthdata CMR currently lists `M2T3NVCLD` version 5.12.4 and GMAO lists DOI `10.5067/F9353J0FAHIH`. GES DISC exposes granule-download/OPeNDAP access through Earthdata infrastructure.

This cycle did **not** materialize authenticated `M2T3NVCLD` NetCDF bytes in the bounded runtime, so no specific MERRA-2 cloud values are promoted here.

Sources:
- https://cmr.earthdata.nasa.gov/search/site/collections/directory/GES_DISC/gov.nasa.eosdis
- https://gmao.gsfc.nasa.gov/gmao-products/merra-2/citing-merra-2-data_merra-2/

### Engineering Root D — SideFX Karma local participating-medium semantics

Karma Volume represents absorption and scattering as rates per distance travelled in the medium, in `m^-1`. This is a local participating-medium evaluator representation. It is not equivalent to a coarse three-hour path optical thickness without a spatial/temporal distribution model.

Primary vendor source:
- https://www.sidefx.com/docs/houdini/nodes/vop/kma_volume.html

### Engineering Root E — Unreal Engine 5.8 realtime volume semantics

UE 5.8 volumetric fog materials describe Albedo, Emissive and Extinction for a point in space; its cloud material workflow uses 3-D noise, layout and density controls to construct local cloud structure. Those are valid realtime renderer/authoring mechanisms, but when used to fill missing MERRA-2 subgrid structure they become an evaluator/disaggregation model, not meteorological Observation evidence.

Primary vendor sources:
- https://dev.epicgames.com/documentation/en-us/unreal-engine/volumetric-fog-in-unreal-engine
- https://dev.epicgames.com/documentation/unreal-engine/volumetric-cloud-material-in-unreal-engine

## Transferable methods

1. Add a first-class `AggregationSupportContract` to every Weather/Atmosphere quantity with at least:
   - temporal support: instantaneous / interval mean / accumulation / unknown;
   - interval bounds and timestamp convention;
   - horizontal support/grid and remap provenance;
   - vertical support (layer, edge, pressure level, path, point);
   - whether the quantity is in-cloud, grid-mean, path-integrated, or local;
   - source/model/version and uncertainty/representativeness notes.
2. Add `RepresentativenessState` separately from physical-variable validity. A physically valid `TAUCLI` value may be `pathOpticsReady=true` while `instantaneousLocalVolumeReady=false`.
3. Add `OperationKind.spatiotemporal_disaggregation` and derived identity `DerivedSyntheticDisaggregation`. Any reconstruction below source time/space support must retain source constraints, method, target scale, seed/state, and uncertainty.
4. Do not evaluate nonlinear light transport after silently averaging its input. In general `E[exp(-tau)] != exp(-E[tau])`; the distinction is material in intermittent clouds.
5. Do not derive mean local extinction as `mean(tau) / mean(dz)` unless a closure explicitly justifies it. In general `E[tau/dz] != E[tau] / E[dz]`.
6. Do not reconstruct a joint cloud optical quantity as `mean(CLOUD) * mean(TAU_incloud)` unless the missing covariance/conditional semantics are justified. In general `E[C*tau] != E[C]E[tau]`.
7. Time-mean optical depth does not determine temporal intermittency. Two histories can have the same mean optical depth but very different mean transmittance and shadow behavior.
8. Grid-cell means and coverage do not determine spatial organization. Multiple subgrid cloud geometries can satisfy the same coarse means while producing different silhouettes, beam paths, shadow coherence and apparent motion.
9. Procedural/noise systems are legitimate **conditional disaggregation tools** when explicitly constrained by source state and marked synthetic. They are not evidence-recovery mechanisms and must never overwrite the source Weather packet.
10. Renderer-local extinction/scattering coefficients should be downstream of disaggregation/closure. Karma/UE local medium parameters are evaluator targets, not direct aliases for a coarse reanalysis optical-thickness diagnostic.
11. Reanalysis support and realtime weather support remain different capabilities. MERRA-2 can be useful for global climatological/reanalysis-constrained experiments, but its delayed 3-hour mean support prevents direct promotion to current instantaneous Weather truth.

## Executable evidence

Probe: `PROBES/cloud_aggregation_representativeness_probe_r11.py`.

The bounded probe was executed before publication and passed `6/6` invariants:

1. For optical-depth samples `[0, 10]`, mean optical depth is 5. Mean transmittance is `0.500022700`, while transmittance evaluated from mean optical depth is `0.006737947`, a factor of `74.21` difference. Time-mean tau is not transmittance-equivalent to an instantaneous tau.
2. For tau `[1, 9]` and layer thickness `[900, 100] m`, `E[tau/dz] = 0.045555556 m^-1`, while `E[tau]/E[dz] = 0.010000000 m^-1`. Ratio-of-means is not mean local extinction.
3. For cloud fraction `[0.1, 0.9]` and in-cloud tau `[1, 9]`, `E[C*tau] = 4.1` while `E[C]E[tau] = 2.5`. Separate time means lose joint covariance needed for a combined optical state.
4. Histories `[0, 10]` and `[5, 5]` have identical mean tau 5 but mean transmittance `0.500022700` versus `0.006737947`. The mean does not recover temporal intermittency.
5. Spatial patterns `[10,0,10,0]` and `[10,10,0,0]` have identical mean tau and 50% nonzero coverage, but a periodic lag-1 product metric differs `0` versus `25`. Coarse mean/coverage do not determine spatial correlation or geometry.
6. A contract marked `3h_time_average + coarse_grid_cell` is rejected for direct `instantaneous_local_volume` use unless an explicit disaggregation method/lineage is supplied.

These examples are mathematical/semantic counterexamples, not MERRA-2 value validation and not cloud microphysics validation.

## State ledger

### Observation
- MERRA-2 `M2T3NVCLD` is a 3-hourly time-averaged cloud-diagnostics collection on 72 model levels and a 576 x 361 regular grid.
- `CLOUD`, `INCLOUDQI/INCLOUDQL`, and `TAUCLI/TAUCLW` are distinct diagnostics; `TAUCLI/TAUCLW` are in-cloud optical thicknesses.
- MERRA-2 time-averaged products are interval means timestamped at interval centers.
- MERRA-2 distributed fields are postprocessed from the model cubed-sphere grid to a regular lat/lon grid; remap method is a data-product property.
- MERRA-2 is delayed global reanalysis, not instantaneous operational Weather truth.
- Karma and UE consume local participating-medium state at evaluator/render time.

### Candidate
- `AggregationSupportContract`.
- `RepresentativenessState` independent of physical-variable validity.
- `OperationKind.spatiotemporal_disaggregation`.
- `DerivedSyntheticDisaggregation` lineage.
- `instantaneousLocalVolumeReady` as a capability separate from `pathOpticsReady`.
- Reanalysis packet may constrain a synthetic local field, but the generated subgrid realization remains derived/synthetic.

### Current Best View
A source-native optical diagnostic can be physically meaningful and still have the wrong temporal/spatial support for a realtime local renderer. KAOPU must preserve not only variable semantics and units but also support/aggregation identity. MERRA-2 three-hour mean path optics are suitable as coarse interval/grid-cell constraints or a reanalysis reference. Turning them into a moving local 3-D cloud volume requires an explicit spatiotemporal disaggregation model and creates new derived identity. Nonlinear radiative quantities and joint cloud statistics cannot be recovered from separately averaged marginal fields without additional information.

### Frozen
None.

### Rejected
- Treating a 3-hourly mean `TAUCLI/TAUCLW` as an instantaneous local optical depth.
- Treating source-native optical diagnostics as automatically `instantaneousLocalVolumeReady`.
- `beta_ext = mean(tau) / mean(layer_thickness)` presented as mean physical local extinction without a closure.
- `mean(CLOUD) * mean(TAU_incloud)` presented as the original mean joint optical state without covariance/conditional semantics.
- Adding procedural noise/detail and calling the result “recovered real cloud structure”.
- Promoting a MERRA-2 reanalysis frame to realtime current Weather truth.
- Using UE/Karma local density/extinction controls as evidence that the missing subgrid weather state existed in the source.

### Unknown
- Exact conditional time-averaging semantics of `TAUCLI/TAUCLW` when a grid cell/layer is intermittently cloud-free are not sufficiently specified in the public File Specification for KAOPU to infer them.
- No authenticated M2T3NVCLD NetCDF cloud values were materialized in this bounded runtime.
- The correct production disaggregation model for cloud geometry, intermittency, phase and motion remains open.
- How much higher-resolution satellite/radar/NWP information is required to reduce subgrid uncertainty to an acceptable visual/physical envelope remains open.
- Exact source-specific remap lineage should be retained from dataset metadata; do not rely only on a generic collection rule when a granule-specific record is available.
- Dual-evaluator Three.js/WebGPU versus second-evaluator numerical/visual/performance validation remains open.
- NRLMSIS/HITRAN physical-reference gate and geoid-to-ellipsoid gate remain open.

## Practical constraints for ordinary implementation today

A normal developer cannot turn MERRA-2 into correct realtime 3-D local clouds by downloading `TAUCLI/TAUCLW` and applying noise. The source is a delayed reanalysis, the cloud diagnostics are three-hour means on coarse global cells, global granules are large, access normally involves Earthdata/GES DISC and NetCDF tooling, and local cloud topology/motion/intermittency are not encoded at render resolution. Any visually detailed realtime field therefore requires a downscaling/disaggregation model, additional high-resolution constraints, or both. That is a substantive modeling problem, not a shader-parameter problem.

## Routing

Candidate only:
- Weather Mother: preserve temporal/horizontal/vertical support and remap provenance for every field; separate `pathOpticsReady` from `instantaneousLocalVolumeReady`; mark MERRA-2 as reanalysis support.
- Atmosphere: accept coarse path-optics constraints without assuming they are voxel-local; require explicit disaggregation before local extinction fields are generated.
- Lighting: distinguish time-mean/path optical constraints from instantaneous transmittance; report aggregation/disaggregation approximation separately from ray-march error.
- Noise/Field methods: may synthesize constrained subgrid detail only under `DerivedSyntheticDisaggregation` with seed, target scale and source constraints; never become Observation truth.
- Terrain/Landscape: provide geometric reference context but do not invent cloud subgrid organization.
- Ocean: apply the same support/aggregation discipline to fog/sea-spray fields and avoid turning coarse means into local truth without lineage.
- KAOPU semantic core: make aggregation support, representativeness, operation kind and derived-disaggregation lineage first-class validity dimensions.

No production Mother branch is modified by this cycle.

## Gate result

R11 does **not** authenticate the MERRA-2 cloud-value packet requested by R10, so the Weather-coupling gate remains open. It meaningfully narrows the gate: even after authentication, `M2T3NVCLD` must first remain a coarse/time-mean `model_native_optics` packet. Direct conversion to a local realtime volume is rejected. The next bounded Weather gate should either:

1. authenticate a small MERRA-2 model-level packet and keep it as an aggregation-aware coarse constraint while testing one explicitly synthetic disaggregation adapter; or
2. select a higher-temporal/higher-spatial source whose native support is closer to the intended realtime Weather use case.

Dual-evaluator, NRLMSIS/HITRAN and geodetic-reference gates remain independent.
