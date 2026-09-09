# KAOPU Learning R10 — Minimum evidence for CloudOpticalClosure

Date: 2026-09-10
Status: Candidate-partial. No production Mother mutation.

## Bounded question

After R09 separated cloud placement from cloud optical closure, is the presence of cloud condensate plus cloud fraction sufficient to derive physically justified extinction/scattering for Atmosphere and Lighting? If not, what minimum typed dependencies must a `CloudOpticalClosure` expose?

This is the highest-value unresolved sub-question of `LQ-ATMOSPHERE-001` because the current Weather-coupling gate cannot advance to a real cloud/light evaluator until optical state is justified independently of renderer defaults.

## Core logical correction

`hasCondensate` does **not** imply `opticalClosureReady`.

Condensate mass says how much liquid/ice mass is present under a stated mixing-ratio/path convention. Optical depth additionally depends on particle effective size and optical model; local extinction additionally depends on layer geometry/distribution; scattering phase depends on phase/particle assumptions; unresolved cloud fraction requires a subgrid overlap/heterogeneity model. A renderer needing a density field does not remove these missing dependencies.

A second category error is to multiply a local extinction coefficient by cloud fraction by default. Fraction describes unresolved spatial coverage unless a particular homogenization model says otherwise. Treating it as a universal extinction multiplier can produce radically different transmittance from an independent-column interpretation.

## Observation / evidence roots kept distinct

### Root A — ECMWF ecRad / OpenIFS radiation semantics

Primary ECMWF source and documentation keep cloud optical calculation separate from radiative-transfer solver concerns. OpenIFS radiation interfaces carry liquid/ice condensate, liquid/ice effective radius, cloud fraction and overlap/inhomogeneity-related quantities separately. Cloud-radiation code distinguishes cloud fraction from liquid/ice specific mass inside cloud. This is evidence that mature atmospheric radiation systems do not reduce cloud optics to one density scalar.

Sources are locked in `references/cloud-optical-r10/SOURCE_LOCK.json`.

### Root B — Copernicus C3S cloud-property retrieval semantics

C3S documentation treats cloud fraction, cloud optical thickness, cloud effective radius, liquid water path and ice water path as separate quantities. Its documented water-path relation includes optical thickness, effective radius, particle density and extinction efficiency. Inverted, the relation shows that equal water path with different effective radius yields different optical thickness.

This is independent retrieval/product evidence, not ECMWF model-code duplication.

### Root C — NOAA/NCEP operational model-product semantics

NCEP GFS/HRRR inventories expose cloud condensate and cloud cover as separate fields. HRRR native/model-coordinate inventories additionally expose cloud microphysical number-concentration and density/thermodynamic fields useful for a stronger experimental microphysical closure. HRRR is regional and must not be promoted as a Wenzhou/global source.

### Root D — NASA GMAO MERRA-2 global reanalysis semantics

MERRA-2 model-level atmospheric collections provide global cloud fraction, liquid/ice mixing ratios, pressure-thickness/pressure, height and thermodynamic state. This is a practical global candidate fixture source for testing the mass/geometry side of closure. It still does not make effective particle size disappear; a separate optical/microphysical model or direct optical product is required.

### Engineering roots — SideFX Karma and Unreal Engine 5.8

Karma represents absorption/scattering as medium coefficients while keeping sampling/bounce budgets separate. UE volumetric systems likewise expose downstream extinction/density/albedo/phase-style material controls and separate tracing budgets. These support evaluator/state separation only; they are not meteorological Observation roots.

## Transferable methods

1. Split `CloudOpticalClosure` readiness by capability rather than one Boolean:
   - `pathOpticsReady`: direct COT or sufficient microphysics to derive band-specific optical depth;
   - `localExtinctionReady`: path optics plus vertical geometry/distribution sufficient to derive extinction per length;
   - `phaseReady`: liquid/ice/mixed phase plus effective-size/shape model or direct phase/asymmetry data;
   - `subgridReady`: cloud fraction plus explicit overlap/heterogeneity/homogenization semantics.
2. Add `MixingRatioSemantics`: at least `grid_mean`, `in_cloud`, `unknown`. A condensate number without this meaning is unsafe for water-path conversion.
3. Add `OpticalClosureMethod`: at least `direct_retrieval`, `microphysical`, `model_native_optics`, `synthetic_test`.
4. Permit three legitimate physical routes:
   - direct optical retrieval: COT + effective radius + phase/spectral identity + uncertainty;
   - microphysical closure: liquid/ice mass state + air-density/pressure geometry + effective particle size + phase/optical model + subgrid semantics;
   - source-native optical packet: preserve the originating model's optical parameterization and provenance instead of pretending it is universal truth.
5. Pressure-level condensate must not be silently interpreted as layer water path. Layer thickness/density/interpolation semantics are dependencies.
6. Cloud fraction is not a generic multiplier on local extinction. The chosen subgrid model must say whether quantities are in-cloud, grid-mean, independent-column, maximum-random overlap, homogenized, or something else.
7. Direct/path optical depth is not yet a 3-D extinction field. Converting `tau` to `beta_ext [m^-1]` requires path length/distribution assumptions and must retain their lineage.
8. Renderer density/global-density controls remain evaluator/material parameters. They may encode an optical packet for a renderer, but they may not overwrite Weather state.
9. Missing effective radius, phase, condensate semantics, geometry or subgrid contract returns typed `Missing/Unsupported`; do not invent hidden defaults.
10. Source selection is use-case specific. MERRA-2 is a plausible global experimental state source; HRRR native is useful for richer CONUS microphysical experiments; neither automatically becomes production Weather truth.

## Executable evidence

Probe: `PROBES/cloud_optical_closure_probe_r10.py`.

The bounded semantic probe was executed before publication and passed `6/6` invariants:

1. Using the C3S water-path relation in inverse form with a test liquid water path of 0.1 kg/m², extinction efficiency 2 and liquid density 1000 kg/m³: effective radius 5/10/20 µm gives optical depth 30/15/7.5. Equal condensate path therefore does not determine optical depth.
2. At identical mixing ratio `1e-4 kg/kg`, layer thickness 1000 m and effective radius 10 µm, changing air density from 0.6 to 1.2 kg/m³ changes derived optical depth from 9 to 18. Mixing ratio alone is not path mass.
3. At cloud fraction 0.2, the same numerical condensate interpreted as grid-mean versus in-cloud yields water paths 0.1 versus 0.02 kg/m² in the bounded example — a factor of 5. Quantity semantics matter before optics.
4. At cloud fraction 0.5 and in-cloud optical depth 10, independent-column unresolved transmittance is about 0.500023 while naive smeared extinction gives about 0.006738, a ratio above 74. Cloud fraction is not universally an extinction multiplier.
5. A path optical depth of 15 distributed over 500/1000/2000 m gives local extinction 0.03/0.015/0.0075 m⁻¹. Path optics alone does not define local 3-D extinction.
6. Missing effective radius is rejected rather than filled with a default.

These are dependency/semantics tests, not validation of real-world cloud microphysics or of any specific model's cloud optical scheme.

## State ledger

### Observation
- ECMWF ecRad/OpenIFS separates cloud condensate, effective particle size, cloud fraction/subgrid structure, cloud optics and radiative-transfer solver concerns.
- C3S treats COT, effective radius, water path and cloud fraction as separate physical/retrieval quantities; water path and optical depth are linked through particle-size/optical assumptions rather than by mass alone.
- NOAA operational model products expose condensate and cloud-cover fields separately; richer HRRR native fields can support a stronger regional experimental closure.
- NASA MERRA-2 offers a global model-level packet containing cloud fraction, liquid/ice mixing ratios and vertical/thermodynamic state suitable for testing mass/geometry conversion.
- Karma and UE keep medium optical parameters downstream from evaluator sampling/performance budgets.

### Candidate
- Capability-split `CloudOpticalClosure` with `pathOpticsReady`, `localExtinctionReady`, `phaseReady`, `subgridReady`.
- `MixingRatioSemantics = grid_mean | in_cloud | unknown`.
- `OpticalClosureMethod = direct_retrieval | microphysical | model_native_optics | synthetic_test`.
- `SubgridCloudContract` carrying fraction, overlap, heterogeneity/homogenization semantics.
- MERRA-2 model-level data as a global experimental fixture provider; HRRR native as a richer CONUS microphysics fixture provider.

### Current Best View
Cloud placement and cloud optics remain independent contracts. Optical closure is not equivalent to a renderer density value. For a microphysical route, condensate mass must be accompanied by quantity semantics, vertical/path geometry and air state, effective particle size/phase optical assumptions, spectral identity and an explicit subgrid cloud treatment. For a direct-retrieval route, path optics can be valid before a local 3-D extinction field; additional distribution geometry is still needed for volume rendering. Capability must remain per quantity and per operation.

### Frozen
None.

### Rejected
- `hasCondensate => opticalClosureReady`.
- Universal `beta_ext = k * condensate` with hidden constant `k`.
- Multiplying local extinction by cloud fraction by default.
- Treating pressure-level condensate as layer-integrated water path without vertical geometry/density semantics.
- A hidden fixed effective radius promoted as Weather truth.
- Treating UE/Karma density or extinction controls as meteorological cloud state.
- Treating HRRR as a global/Wenzhou production source.
- Claiming MERRA-2 `QL/QI` alone closes cloud optics without particle-size/optical assumptions.

### Unknown
- Exact current grid-mean-versus-in-cloud semantics of the first chosen operational condensate variables are not locked for numerical ingestion in this cycle.
- No authenticated GRIB/NetCDF cloud-state sample bytes were ingested in this bounded cycle.
- Which global data source becomes production Weather Mother truth remains undecided.
- The production effective-radius/particle-optics source for a MERRA-2-based closure remains open.
- Geoid-to-ellipsoid provenance remains open from R08/R09.
- Dual-evaluator Three.js/WebGPU versus second-evaluator numerical/visual/performance comparison remains open.
- NRLMSIS/HITRAN physical-reference gate remains open.

## Practical constraints for ordinary implementation today

A normal developer cannot obtain a defensible global 3-D cloud renderer merely by downloading a free forecast field and mapping it to density. The free ECMWF Open Data pressure-level subset exposes humidity/cloud-cover-type information but not the complete 3-D liquid/ice condensate packet needed here. HRRR has richer cloud microphysics but is CONUS-only. Global MERRA-2 model-level state is accessible but its full granules are large and normally require Earthdata/subsetting/NetCDF handling, and the state packet still needs an effective-size/optical model. GRIB/NetCDF decoding, vertical-coordinate reconstruction, unit/quantity semantics and subgrid-cloud interpretation are substantive engineering dependencies, not UI work.

## Routing

Candidate only:
- Weather Mother: expose condensate semantics, phase and per-quantity closure readiness; never publish renderer density as Weather truth.
- Atmosphere: consume `RuntimeCloudPlacement` and `CloudOpticalClosure` independently; accept partial capability and typed Missing.
- Lighting: query spectral extinction/scattering/phase from optical closure; never infer missing microphysics from brightness targets.
- Terrain/Landscape: provide geometry/reference context only; no role in fabricating optical mass/particle state.
- Ocean: use the same optical-contract discipline for fog/sea-spray overlap and avoid double-counting extinction.
- KAOPU semantic core: add closure method, mixing-ratio semantics, subgrid contract and capability-specific validity/provenance.

No production Mother branch is modified by this cycle.

## Gate result

R10 advances the Weather-coupling gate by defining what *cannot* count as optical closure and by giving an executable sufficiency probe. It does not close the gate because no authenticated cloud-state packet with source-verified condensate semantics and particle-size/optical closure was consumed by two evaluators.

Next bounded gate: choose one source packet with source-verified liquid/ice/fraction/vertical semantics and one explicit particle-optics route, produce a real `CloudOpticalClosure`, then feed the same packet to two evaluator adapters while reporting physical-input uncertainty separately from numerical, visual and performance error.
