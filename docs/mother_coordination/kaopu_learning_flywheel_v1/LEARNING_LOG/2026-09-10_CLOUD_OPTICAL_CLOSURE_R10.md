# KAOPU Learning R10 — Minimum evidence for CloudOpticalClosure

Date: 2026-09-10
Status: Candidate-partial. No production Mother mutation.

## Bounded question

After R09 separated cloud placement from cloud optical closure, is the presence of cloud condensate plus cloud fraction sufficient to derive physically justified extinction/scattering for Atmosphere and Lighting? If not, what minimum typed dependencies must a `CloudOpticalClosure` expose?

This is the highest-value unresolved sub-question of `LQ-ATMOSPHERE-001` because the current Weather-coupling gate cannot advance to a real cloud/light evaluator until optical state is justified independently of renderer defaults.

## Core logical correction

`hasCondensate` does **not** imply `opticalClosureReady`.

Condensate mass says how much liquid/ice mass is present under a stated mixing-ratio/path convention. Optical depth additionally depends on particle effective size and optical model unless the source already supplies its own optical diagnostic; local extinction additionally depends on layer geometry/distribution; scattering phase depends on phase/particle assumptions; unresolved cloud fraction requires a subgrid overlap/heterogeneity model. A renderer needing a density field does not remove these missing dependencies.

A second category error is to multiply a local extinction coefficient by cloud fraction by default. Fraction describes unresolved spatial coverage unless a particular homogenization model says otherwise. Treating it as a universal extinction multiplier can produce radically different transmittance from an independent-column interpretation.

## Observation / evidence roots kept distinct

### Root A — ECMWF ecRad / OpenIFS radiation semantics

Primary ECMWF source and documentation keep cloud optical calculation separate from radiative-transfer solver concerns. OpenIFS radiation interfaces carry liquid/ice condensate, liquid/ice effective radius and cloud fraction as distinct quantities. `ac_cloud_model.F90` explicitly documents cloud fraction separately from specific ice/liquid mass inside cloud before producing optical coefficients. This is evidence that mature atmospheric radiation systems do not reduce cloud optics to one density scalar.

Sources are locked in `references/cloud-optical-r10/SOURCE_LOCK.json`.

### Root B — Copernicus C3S cloud-property retrieval semantics

C3S documentation treats cloud fraction, cloud optical thickness, cloud effective radius, liquid water path and ice water path as separate quantities. Its documented water-path relation includes optical thickness, effective radius, particle density and extinction efficiency. Inverted, the relation shows that equal water path with different effective radius yields different optical thickness.

This is independent retrieval/product evidence, not ECMWF model-code duplication.

### Root C — NOAA/NCEP operational model-product semantics

NCEP GFS/HRRR inventories expose cloud condensate and cloud cover as separate fields. HRRR native/model-coordinate inventories additionally expose cloud droplet/ice number concentrations and thermodynamic/height fields useful for a stronger experimental microphysical closure. NOAA documents operational HRRR sectors for CONUS and Alaska. HRRR is therefore a regional source and must not be promoted as Wenzhou/global truth.

### Root D — NASA GMAO MERRA-2 global reanalysis semantics

MERRA-2 model-level atmospheric collections provide global cloud fraction, liquid/ice mixing ratios, pressure thickness, height/pressure and thermodynamic state. More importantly for this gate, the documented `tavg3_3d_cld_Nv` cloud-diagnostics collection separately carries `INCLOUDQI`, `INCLOUDQL`, grid/model cloud fraction and source-native in-cloud optical thickness `TAUCLI`/`TAUCLW` on 72 model levels. The guide documents this collection as 3-hourly and roughly 691 MB per global granule.

That creates a lower-assumption global experimental route: preserve MERRA-2's native optical-depth diagnostic as `model_native_optics` instead of rebuilding optical depth from QL/QI with an invented fixed effective radius. It still does not directly yield a local 3-D extinction coefficient or universal scattering phase; those remain separate adapter/closure steps.

### Engineering roots — SideFX Karma and Unreal Engine 5.8

Karma represents absorption/scattering as wavelength/color-dependent medium rates per distance while keeping sampling/bounce budgets separate. UE volumetric systems likewise expose downstream extinction/albedo/emissive-style world-space material controls separately from tracing budgets. These support evaluator/state separation only; they are not meteorological Observation roots.

## Transferable methods

1. Split `CloudOpticalClosure` readiness by capability rather than one Boolean:
   - `pathOpticsReady`: direct/source-native COT or sufficient microphysics to derive band-specific optical depth;
   - `localExtinctionReady`: path optics plus vertical geometry/distribution sufficient to derive extinction per length;
   - `phaseReady`: liquid/ice/mixed phase plus effective-size/shape model or direct phase/asymmetry data;
   - `subgridReady`: cloud fraction plus explicit overlap/heterogeneity/homogenization semantics.
2. Add `MixingRatioSemantics`: at least `grid_mean`, `in_cloud`, `unknown`. A condensate number without this meaning is unsafe for water-path conversion.
3. Add `OpticalClosureMethod`: at least `direct_retrieval`, `microphysical`, `model_native_optics`, `synthetic_test`.
4. Permit three legitimate physical routes:
   - direct optical retrieval: COT + effective radius + phase/spectral identity + uncertainty;
   - microphysical closure: liquid/ice mass state + air-density/pressure geometry + effective particle size + phase/optical model + subgrid semantics;
   - source-native optical packet: preserve the originating model's optical parameterization/diagnostics and provenance instead of pretending they are universal truth.
5. Prefer a source-native optical diagnostic over reconstructing the same quantity with unverified hidden assumptions when such a diagnostic is available and its semantics are documented.
6. Pressure-level condensate must not be silently interpreted as layer water path. Layer thickness/density/interpolation semantics are dependencies.
7. Cloud fraction is not a generic multiplier on local extinction. The chosen subgrid model must say whether quantities are in-cloud, grid-mean, independent-column, maximum-random overlap, homogenized, or something else.
8. Direct/path optical depth is not yet a 3-D extinction field. Converting `tau` to `beta_ext [m^-1]` requires path length/distribution assumptions and must retain their lineage.
9. Renderer density/global-density controls remain evaluator/material parameters. They may encode an optical packet for a renderer, but they may not overwrite Weather state.
10. Missing effective radius, phase, condensate semantics, geometry or subgrid contract returns typed `Missing/Unsupported` for any route that requires them; a source-native path-optics route may be valid without re-deriving its hidden microphysics, but its source-model identity must remain explicit.
11. Source selection is use-case specific. MERRA-2 cloud diagnostics are a plausible global `model_native_optics` experimental fixture; HRRR native is useful for richer regional CONUS/Alaska microphysical experiments; neither automatically becomes production Weather truth.

## Executable evidence

Probe: `PROBES/cloud_optical_closure_probe_r10.py`.

The bounded semantic probe was executed before publication and passed `6/6` invariants:

1. Using the C3S water-path relation in inverse form with a test liquid water path of 0.1 kg/m², extinction efficiency 2 and liquid density 1000 kg/m³: effective radius 5/10/20 µm gives optical depth 30/15/7.5. Equal condensate path therefore does not determine optical depth.
2. At identical mixing ratio `1e-4 kg/kg`, layer thickness 1000 m and effective radius 10 µm, changing air density from 0.6 to 1.2 kg/m³ changes derived optical depth from 9 to 18. Mixing ratio alone is not path mass.
3. At cloud fraction 0.2, the same numerical condensate interpreted as grid-mean versus in-cloud yields water paths 0.1 versus 0.02 kg/m² in the bounded example — a factor of 5. Quantity semantics matter before optics.
4. At cloud fraction 0.5 and in-cloud optical depth 10, independent-column unresolved transmittance is about 0.500023 while naive smeared extinction gives about 0.006738, a ratio above 74. Cloud fraction is not universally an extinction multiplier.
5. A path optical depth of 15 distributed over 500/1000/2000 m gives local extinction 0.03/0.015/0.0075 m⁻¹. Path optics alone does not define local 3-D extinction.
6. Missing effective radius is rejected rather than filled with a default for the microphysical closure route.

These are dependency/semantics tests, not validation of real-world cloud microphysics or of any specific model's cloud optical scheme.

## State ledger

### Observation
- ECMWF ecRad/OpenIFS separates cloud condensate, effective particle size, cloud fraction/subgrid structure, cloud optics and radiative-transfer solver concerns.
- C3S treats COT, effective radius, water path and cloud fraction as separate physical/retrieval quantities; water path and optical depth are linked through particle-size/optical assumptions rather than by mass alone.
- NOAA operational model products expose condensate and cloud-cover fields separately; richer HRRR native fields can support regional microphysical closure experiments over its operational sectors.
- NASA MERRA-2 provides global model-level cloud state and a separate cloud-diagnostics collection containing in-cloud QL/QI semantics plus source-native in-cloud liquid/ice optical thickness.
- Karma and UE keep medium optical parameters downstream from evaluator sampling/performance budgets.

### Candidate
- Capability-split `CloudOpticalClosure` with `pathOpticsReady`, `localExtinctionReady`, `phaseReady`, `subgridReady`.
- `MixingRatioSemantics = grid_mean | in_cloud | unknown`.
- `OpticalClosureMethod = direct_retrieval | microphysical | model_native_optics | synthetic_test`.
- `SubgridCloudContract` carrying fraction, overlap, heterogeneity/homogenization semantics.
- MERRA-2 `tavg3_3d_cld_Nv` as the preferred first global `model_native_optics` experimental fixture candidate; HRRR native as a richer regional CONUS/Alaska microphysics fixture candidate.

### Current Best View
Cloud placement and cloud optics remain independent contracts. Optical closure is not equivalent to a renderer density value. For a microphysical route, condensate mass must be accompanied by quantity semantics, vertical/path geometry and air state, effective particle size/phase optical assumptions, spectral identity and an explicit subgrid cloud treatment. When a source provides a documented native optical-depth diagnostic, preserving that diagnostic with source-model provenance is preferable to reconstructing it with arbitrary hidden microphysical defaults. Path optics can be valid before a local 3-D extinction field; additional distribution geometry and phase/subgrid semantics are still needed for volume rendering and lighting.

### Frozen
None.

### Rejected
- `hasCondensate => opticalClosureReady`.
- Universal `beta_ext = k * condensate` with hidden constant `k`.
- Multiplying local extinction by cloud fraction by default.
- Treating pressure-level condensate as layer-integrated water path without vertical geometry/density semantics.
- A hidden fixed effective radius promoted as Weather truth.
- Treating UE/Karma density or extinction controls as meteorological cloud state.
- Treating HRRR as Wenzhou/global production truth.
- Recomputing a source-native optical diagnostic from QL/QI with an invented fixed radius and then treating the recomputation as more truthful than the documented source optical packet.

### Unknown
- No authenticated MERRA-2/HRRR GRIB/NetCDF cloud-state sample bytes were ingested in this bounded cycle.
- Exact local-extinction distribution and scattering-phase adapter for MERRA-2 `TAUCLI/TAUCLW` remain open.
- Which global data source becomes production Weather Mother truth remains undecided.
- Geoid-to-ellipsoid provenance remains open from R08/R09.
- Dual-evaluator Three.js/WebGPU versus second-evaluator numerical/visual/performance comparison remains open.
- NRLMSIS/HITRAN physical-reference gate remains open.

## Practical constraints for ordinary implementation today

A normal developer cannot obtain a defensible global 3-D cloud renderer merely by downloading a free forecast field and mapping it to density. HRRR has richer cloud microphysics but is regional, with operational CONUS and Alaska sectors, so it cannot supply Wenzhou/global truth. MERRA-2 is global and its cloud-diagnostics collection reduces assumptions by exposing in-cloud QL/QI plus native optical thickness, but a documented global model-level granule is still roughly 691 MB, requires Earthdata/subsetting/NetCDF handling in normal workflows, is reanalysis rather than realtime weather, and path optical depth still needs a spatial/phase/subgrid adapter before it becomes a realtime 3-D light-transport field. GRIB/NetCDF decoding, vertical-coordinate reconstruction, unit/quantity semantics and subgrid-cloud interpretation remain substantive engineering dependencies, not UI work.

## Routing

Candidate only:
- Weather Mother: expose condensate semantics, source-native optical diagnostics and per-capability closure readiness; never publish renderer density as Weather truth.
- Atmosphere: consume `RuntimeCloudPlacement` and `CloudOpticalClosure` independently; accept partial capability and typed Missing.
- Lighting: query spectral extinction/scattering/phase from optical closure; never infer missing microphysics from brightness targets.
- Terrain/Landscape: provide geometry/reference context only; no role in fabricating optical mass/particle state.
- Ocean: use the same optical-contract discipline for fog/sea-spray overlap and avoid double-counting extinction.
- KAOPU semantic core: add closure method, mixing-ratio semantics, subgrid contract and capability-specific validity/provenance.

No production Mother branch is modified by this cycle.

## Gate result

R10 advances the Weather-coupling gate by defining what *cannot* count as optical closure and by identifying a lower-assumption global source-native-optics route. It does not close the gate because no authenticated cloud-state/optics packet was consumed by two evaluators.

Next bounded gate: authenticate and ingest one MERRA-2 model-level cloud-diagnostics packet (or a better source with equally explicit semantics), preserve `CLOUD/INCLOUDQI/INCLOUDQL/TAUCLI/TAUCLW` and vertical provenance, derive only the missing local-volume/phase/subgrid adapter state, then feed the same `RuntimeCloudPlacement + CloudOpticalClosure` to two evaluator adapters while reporting source/model uncertainty separately from numerical, visual and performance error.
