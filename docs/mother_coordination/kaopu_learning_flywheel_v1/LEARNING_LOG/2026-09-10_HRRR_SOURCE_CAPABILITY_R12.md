# KAOPU Learning R12 — Weather source capability, query support and lifecycle routing

Date: 2026-09-10
Status: Candidate-partial. No production Mother mutation.

## Bounded question

After R11 showed that coarse three-hour MERRA-2 cloud diagnostics cannot be promoted directly to instantaneous local 3-D cloud truth, can a current higher-temporal/higher-spatial operational weather source materially reduce the Weather-to-render representativeness gap, and what source-selection contract prevents a better regional source from being mistaken for universal or renderer-ready truth?

This remains the highest-value unresolved sub-question of `LQ-ATMOSPHERE-001`. The bounded source candidate is NOAA HRRR, with RRFS used only as lifecycle/migration evidence.

## Logical corrections before implementation

1. **Higher resolution is not local truth.** A 3 km hourly model materially improves support relative to an approximately 50 km, three-hour reanalysis, but it is still about 30 times coarser than a test-only 100 m close-range rendering footprint. It therefore reduces rather than eliminates disaggregation uncertainty.
2. **Cloud-resolving is model terminology, not an Observation claim.** HRRR analysis/forecast fields are model-derived state informed by observations/data assimilation. They may be strong operational constraints, but they do not become an independent atmospheric Observation Root simply because the model resolves convection/cloud processes better than coarser systems.
3. **Assimilation cadence is not output support.** Frequent radar/data assimilation does not imply that every 15 minutes exposes the full native 50-level cloud-microphysics state. NCEP explicitly lists the HRRR sub-hourly product as a 2-D Surface Levels product.
4. **Microphysics readiness is not optical readiness.** Cloud liquid/ice mixing ratios, number concentrations and cloud fraction are much closer to a physical optical closure than relative humidity alone, but they still are not renderer-ready extinction, scattering, single-scattering albedo or phase parameters.
5. **A better regional source is not a universal source.** HRRR CONUS/Alaska coverage cannot replace a global reanalysis/forecast source for queries outside its supported domain.
6. **A source name is not a permanent contract.** NOAA is transitioning RRFS toward operations in 2026 while current NCEP HRRR products remain available. KAOPU must route by source capability/lifecycle/effective time, not hard-code a vendor/model name into semantic truth.

## Evidence roots kept distinct

### Evidence Root A — NOAA/GSL HRRR system semantics

Official NOAA/GSL material describes HRRR as a 3 km, hourly-updating operational numerical weather prediction system over the contiguous United States and describes 50 vertical elevations above each gridpoint.

Primary sources:
- https://gsl.noaa.gov/news/tenth-anniversary-of-the-hrrr-in-operations/
- https://gsl.noaa.gov/pages/air-quality-and-health/

This root establishes model/system capability only. It is not an Observation Root for the actual state of a particular cloud.

### Evidence Root B — NOAA/NCEP HRRR product-support semantics

The official NCEP HRRR product page lists CONUS native-level output at 3 km Lambert Conformal resolution and explicitly labels the sub-hourly product as `2D Surface Levels - Sub Hourly`, with each file containing the nominal forecast hour plus 15, 30 and 45 minutes before the hour.

The official native-analysis inventory exposes, through 50 hybrid levels, quantities including `PRES`, `CLWMR`, `CIMIXR`, `NCONCD`, `NCCICE`, `FRACCC`, `HGT`, `TMP`, and `SPFH`.

Primary sources:
- https://www.nco.ncep.noaa.gov/pmb/products/hrrr/
- https://www.nco.ncep.noaa.gov/pmb/products/hrrr/hrrr.t00z.wrfnatf00.grib2.shtml
- https://www.nco.ncep.noaa.gov/pmb/products/hrrr/hrrr.t00z.wrfsubhf00.grib2.shtml

### Evidence Root C — NOAA/NOMADS current transport/index evidence

The official NOMADS production directory exposed HRRR data dated 2026-09-09 during this bounded cycle. The 00 UTC CONUS native analysis file `hrrr.t00z.wrfnatf00.grib2` was listed at approximately 667 MB, while its `.idx` was approximately 59 KB. The live index itself carries `d=2026090900` and repeats the cloud/microphysics/location field bundle through hybrid level 50.

Primary sources:
- https://nomads.ncep.noaa.gov/pub/data/nccf/com/hrrr/prod/
- https://nomads.ncep.noaa.gov/pub/data/nccf/com/hrrr/prod/hrrr.20260909/conus/
- https://nomads.ncep.noaa.gov/pub/data/nccf/com/hrrr/prod/hrrr.20260909/conus/hrrr.t00z.wrfnatf00.grib2.idx

This is live operational schema/transport evidence, not a new independent physical Observation Root. The 667 MB value is a current sample and must not be Frozen as a permanent file-size invariant.

### Evidence Root D — NOAA/NCEP current production status

NCEP production-status reporting showed HRRR hourly cycles completing in the current production suite around the R12 check.

Primary source:
- https://www.nco.ncep.noaa.gov/pmb/nwprod/prodstat/

Operational status is time-varying lifecycle metadata.

### Evidence Root E — NOAA/GSL + NCEP RRFS lifecycle transition

NOAA describes RRFS as its next-generation rapidly updating high-resolution system and states RRFSv1 is transitioning to operations in 2026. The NCEP RRFS product page checked in this cycle is explicitly preliminary and subject to change, with multiple NOMADS products still described as coming soon/parallel.

Primary sources:
- https://gsl.noaa.gov/rrfs/
- https://www.nco.ncep.noaa.gov/pmb/products/rrfs/

This root establishes the need for source lifecycle/migration semantics; it does not prove that KAOPU should switch from HRRR to RRFS now.

## Transferable methods

1. Introduce a first-class `WeatherSourceCapabilityContract` containing at least:
   - source/model/version;
   - source role (`observation`, `analysis`, `forecast`, `reanalysis`, etc.);
   - operational/lifecycle state plus effective-time provenance;
   - geographic/domain coverage;
   - horizontal support/grid/projection;
   - native vertical-coordinate/level support;
   - temporal support, cycle/update cadence and latency;
   - available physical quantities and their units/support;
   - direct optical-closure capability versus microphysics-only capability;
   - transport/access method, subset capability and acquisition lineage.
2. Introduce `QuerySupportMatch`: source suitability is evaluated against a query contract rather than stored as one scalar quality rank. A source can be excellent for regional current Weather while unsuitable for global climatology or 100 m local cloud truth.
3. Introduce `SourceFederationPolicy`: keep global reference/reanalysis, regional operational model, local observation and renderer-derived states as separately identified sources that may constrain one another without merging identities.
4. Preserve `sourceRole` through all adapters. Model analysis/forecast data may become a model-derived Weather state but not an independent atmospheric Observation simply through ingestion.
5. Split `microphysicsReady` from `opticalClosureReady`. HRRR native variables can support a lower-assumption optical closure experiment, but the closure itself remains derived and must retain formula/model/assumption lineage.
6. Preserve support dimensionality. A 2-D/sub-hourly product can constrain timing, cloud base/top, radiation or column behavior without being treated as the missing 50-level native microphysics volume.
7. Assimilation/input cadence, model cycle cadence, output valid-time support and renderer update cadence are separate typed times. Never infer one from another.
8. Make transport cost a routing concern. The current ~667 MB full native-analysis sample makes naive whole-file browser ingestion an impractical default. Prefer NOMADS GRIB filtering, byte/index-aware subsetting, server-side preprocessing and cacheable compact runtime packets.
9. Treat source replacement as a migration event. A future HRRR->RRFS change should rerun schema/support/quality/vertical-coordinate/optical-closure gates rather than silently inherit HRRR assumptions.
10. Keep R11 `DerivedSyntheticDisaggregation` semantics. Even a better source does not authorize generated local detail to overwrite model state.

## Executable evidence

Probe: `PROBES/weather_source_capability_probe_r12.py`

The bounded semantic probe was executed before publication and passed **7/7** checks:

1. The locked HRRR native schema contains the minimum selected microphysical/location fields `PRES/HGT/CLWMR/CIMIXR/NCONCD/NCCICE/FRACCC/TMP/SPFH`.
2. Renderer-specific `EXTINCTION/SCATTERING/SINGLE_SCATTER_ALBEDO/PHASE_G` are not directly present in that native field set, so optical closure remains a separate derived operation.
3. Using R11's approximate 50 km MERRA-2 support and 3 h temporal support versus HRRR's 3 km and 1 h cadence, nominal horizontal support-area ratio is approximately **277.777778** and temporal ratio is **3.0**. This is a support-comparison diagnostic, not an accuracy score.
4. For a test-only 100 m local rendering footprint, nominal HRRR/grid ratio is **30**, versus **500** for the approximate MERRA-2 support. HRRR materially reduces but does not close the local-detail gap.
5. Regional CONUS/Alaska support rejects a universal-global-source interpretation.
6. A 2-D aggregate/support packet cannot uniquely identify a 3-D profile; two distinct profiles can have the same summary/integral.
7. `operational_model_analysis_and_forecast` is not an atmospheric Observation role.

The probe uses no invented HRRR atmospheric values. It tests source/support semantics only.

## Ordinary-person implementation constraints

A person cannot realistically obtain “true realtime 3-D cinematic cloud” merely by pointing a browser at HRRR:

- the full native GRIB2 analysis is hundreds of megabytes per cycle in the current operational sample, so direct repeated whole-file web ingestion is wasteful and fragile;
- GRIB2/native hybrid-level decoding, geographic subsetting, unit/support interpretation and vertical-coordinate handling require a preprocessing/data service layer;
- HRRR is regional, so a global system needs source federation/fallback rather than one source;
- 3 km remains far above close-view voxel resolution, requiring explicitly synthetic/local downscaling for small-scale cloud shape;
- the native cloud variables still require a physically justified optical closure before a renderer or laser/spot-light evaluator can consume extinction/scattering;
- operational model/version transitions such as RRFS require lifecycle-aware adapters and migration testing.

## State ledger

### Observation
- NOAA describes HRRR as an operational 3 km, hourly-updating high-resolution regional model.
- NCEP lists 3 km native-level HRRR output and a separate 2-D sub-hourly output family.
- The HRRR native analysis inventory contains cloud liquid/ice mixing ratios, droplet/ice number concentrations, cloud fraction, pressure, geopotential height, temperature and humidity across 50 hybrid levels.
- The live NOMADS 2026-09-09 00 UTC native-analysis index confirms those fields through hybrid level 50.
- The current sampled native analysis file was approximately 667 MB; this is current transport evidence, not a permanent invariant.
- NOAA/NCEP documents an RRFS operational transition in 2026 while its current product inventory remains preliminary/subject to change.

### Candidate
- `WeatherSourceCapabilityContract`.
- `QuerySupportMatch`.
- `SourceFederationPolicy`.
- `SourceLifecycleState` plus effective-time/version provenance.
- Separate `microphysicsReady` and `opticalClosureReady` capabilities.
- Separate assimilation cadence, cycle cadence, output support and renderer cadence.
- Transport/subsetting cost as a source-routing dimension.
- HRRR as a regional operational Weather/model-state candidate and lower-assumption cloud-microphysics constraint source, not a global canonical source.

### Current Best View
Weather-source selection must be query-scoped and lifecycle-aware. HRRR is materially better aligned than MERRA-2 to current regional CONUS Weather and supplies much richer native cloud microphysics, so it is a better candidate constraint for a regional realtime cloud experiment. But the state remains model-derived, regional, 3 km-scale and optically incomplete. KAOPU should therefore federate source identities, preserve support and role, derive optical closure explicitly, and declare any local downscaling below source support as synthetic rather than treating “higher resolution” as truth completion.

### Frozen
None.

### Rejected
- “3 km hourly HRRR means local 100 m/near-camera cloud detail no longer needs disaggregation.”
- “Cloud-resolving means HRRR cloud fields are independent observations of the real cloud.”
- “Frequent radar/data assimilation means full 3-D native cloud microphysics is available at the same sub-hourly cadence.”
- “A 2-D sub-hourly product can uniquely reconstruct the missing 50-level 3-D microphysical field.”
- “Cloud water/ice plus number concentration are already renderer extinction/scattering coefficients.”
- “HRRR is better than MERRA-2, therefore HRRR should become the single global Weather truth source.”
- “RRFS is transitioning, therefore silently replace HRRR now.”
- “Download every full native GRIB2 file directly into the browser and let the renderer parse it.”

### Unknown
- Actual decoded HRRR native GRIB2 values for a selected small region/time were not materialized in this bounded cycle; only official inventory/live index support was verified.
- Exact GRIB statistical-processing/support metadata for every selected field should be retained from a decoded packet rather than inferred solely from display labels such as `anl`.
- The first physically justified visible-light `CloudOpticalClosure` from HRRR liquid/ice mixing ratios and number concentrations, especially mixed-phase/ice particle assumptions.
- Quantitative source/model error versus independent observations for the selected cloud case.
- Error/uncertainty of a declared 3 km -> local-volume disaggregation model.
- Exact production migration timing and schema differences between HRRR and RRFS for the quantities KAOPU needs.
- Appropriate global operational/reanalysis fallback outside the HRRR/RRFS regional domain.
- Numerical/visual/performance error when one physically grounded local optical packet is consumed by two independent evaluator adapters.
- The existing NRLMSIS/HITRAN physical-reference gate and dual-evaluator runtime-atmosphere gate remain open.

## Routing

Route as Candidate only:

- Weather Mother: implement source capability/query-support/lifecycle/federation semantics before selecting a production data provider; HRRR is a regional candidate, not canonical truth.
- Atmosphere: consume source-role/support-aware placement/microphysics packets and a separately derived optical closure; do not infer local truth from grid resolution.
- Lighting: consume only `CloudOpticalClosure`, never raw model cloud mixing ratio as renderer extinction without a closure adapter.
- Noise/Field: any 3 km-to-local structure synthesis remains `DerivedSyntheticDisaggregation`, constrained by but distinct from HRRR.
- Terrain/Landscape: retain projection/reference-frame/vertical-coordinate lineage during source subset and placement.
- Ocean/Coast: regional source coverage and lifecycle are query constraints for coastal weather coupling; do not promote regional source identity to ocean/global datum truth.
- KAOPU semantic core: make `WeatherSourceCapabilityContract`, `QuerySupportMatch`, `SourceFederationPolicy`, source role/lifecycle and transport capability first-class.

No production Mother branch is modified by this cycle.

## Gate result and next gate

R12 **materially advances** the Weather-coupling gate by identifying a current regional source whose native output carries much richer and finer cloud microphysics than MERRA-2 while preserving the distinction between model state and Observation truth. It does not close the gate.

Next Weather gate: materialize one small official HRRR native GRIB2 subset for a selected region/time containing at least `PRES/HGT/CLWMR/CIMIXR/NCONCD/NCCICE/FRACCC/TMP`, preserve exact GRIB support/vertical metadata, derive one explicit candidate visible-light optical closure with assumptions and uncertainty, create a declared local downscaling packet only if needed, and feed the same optical packet to two evaluator adapters. Report source/model error, support/disaggregation uncertainty, optical-closure error, numerical/visual error and performance cost separately. Keep global fallback and HRRR->RRFS migration as independent source-federation/lifecycle work.
