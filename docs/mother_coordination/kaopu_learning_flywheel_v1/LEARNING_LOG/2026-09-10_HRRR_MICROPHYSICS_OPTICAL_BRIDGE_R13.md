# KAOPU Learning R13 — HRRR microphysics to visible-light optical bridge

Date: 2026-09-10
Status: Candidate-partial. No production Mother mutation.

## Bounded question

Given the public HRRRv4 native microphysics field family established in R12, can KAOPU derive a visible-light `CloudOpticalClosure` without inventing renderer/art-direction parameters, and which parts can be replayed from source-model physics versus which remain an explicitly separate optical model?

This is the highest-value unresolved sub-question of `LQ-ATMOSPHERE-001`: R12 showed that HRRR exposes much richer cloud microphysics than coarse reanalysis, but `microphysicsReady` was still distinct from `opticalClosureReady`.

## Logical corrections before implementation

1. **Mass mixing ratio + number concentration do not uniquely determine optical cross-section unless a particle-size distribution (PSD) is fixed.** Two size distributions can have the same total particle count and total condensate mass but different projected area, hence different extinction.
2. **A source-model diagnostic is not the same as a source-native field.** HRRR's public native index exposes the state needed by Thompson-style diagnostics, but does not expose `re_cloud/re_ice/re_snow` under those names. Recomputing them is a derived replay and needs algorithm/version lineage.
3. **Using the newest Thompson source is not automatically HRRRv4-consistent.** NOAA documents HRRRv4 as a specific Thompson-Eidhammer-era configuration, while newer RRFS configurations use newer implementations. A replay may be called model-consistent only after the exact operational source/version is locked or numerically cross-validated.
4. **Radiation effective radius is not yet a visible-light renderer packet.** Effective radius plus condensate materially reduces the optical unknowns, but wavelength, refractive index, PSD width/variance and—especially for ice—particle habit/roughness/phase-function assumptions remain necessary.
5. **Air-density support matters for per-metre extinction.** Mixing ratios and number concentrations expressed per mass of air do not by themselves give a spatial extinction coefficient in m^-1; either air density or sufficient thermodynamic state to derive it must be retained.
6. **Cloud fraction is not a multiplier that makes nonlinear radiative transfer exact.** `FRACCC` remains a grid/subgrid support quantity. R11's aggregation/overlap warning still applies; it cannot silently be folded into a local extinction field.
7. **Renderer controls are adapters, not physics closure.** UE/Karma extinction/scattering/albedo/anisotropy inputs are valid evaluator targets, but tuning them to look right cannot back-fill missing microphysics or spectral optical assumptions.

## Evidence roots kept distinct

No new physical atmospheric Observation Root is claimed in R13. The roots below are independent model/system/physics/renderer evidence and must not be counted as independent observations of a real cloud.

### Evidence Root A — NOAA HRRRv4 model configuration

NOAA's HRRR system description states that HRRRv4 uses the Thompson bulk microphysics scheme; by HRRRv4 it predicts snow with one moment and cloud water, cloud ice, rain and graupel/hail with two moments. NOAA's 2026 diagnostics documentation treats HRRRv4/RAPv5 and newer RRFS configurations as versioned systems rather than interchangeable implementations.

Primary sources:
- https://doi.org/10.1175/WAF-D-21-0151.1
- https://repository.library.noaa.gov/view/noaa/72271

### Evidence Root B — NOAA/NOMADS live HRRR native schema

The official 2026-09-09 00 UTC HRRR native-analysis `.idx` exposes, per hybrid level, the complete field family needed to attempt a Thompson-consistent radiative-effective-radius replay:
`TMP`, `PRES`, `SPFH`, `CLWMR`, `NCONCD`, `CIMIXR`, `NCCICE`, `SNMR`.
It also exposes `MASSDEN`, `FRACCC`, rain/graupel-related fields and geometric/placement support such as `HGT`.

Primary source:
- https://nomads.ncep.noaa.gov/pub/data/nccf/com/hrrr/prod/hrrr.20260909/conus/hrrr.t00z.wrfnatf00.grib2.idx

The index is current product-schema/transport evidence. The GRIB2 body was not materialized in this bounded runtime, so no actual HRRR atmospheric values are claimed in R13.

### Evidence Root C — DTC/WRF Thompson radiative diagnostic semantics

DTC CCPP documentation exposes `calc_effectRad(t, p, qv, qc, nc, qi, ni, qs, ...)` and states that it computes radiation effective radii of cloud water, ice and snow consistently with Thompson microphysics assumptions rather than using arbitrary constants. The WRF source also explicitly encodes PSD and mass-size assumptions and returns bounded `re_cloud/re_ice/re_snow` fields for radiation coupling.

Primary/community sources:
- https://dtcenter.ucar.edu/GMTB/UFS_SRW_HSD/scidoc/group__aathompson.html
- https://github.com/wrf-model/WRF/blob/06d4240ae989cc3e50af412bb472df3d9048783c/phys/module_mp_thompson.F

Constraint: the cited current/community source establishes the transferable method and input dependency. It is not yet authenticated as the exact operational HRRRv4 executable source hash.

### Evidence Root D — DTC RRTMG cloud-radiation contract

DTC documentation describes cloud liquid/ice water path, cloud fraction and effective radius as distinct cloud-radiation inputs and separately exposes cloud-overlap/subgrid assumptions. This independently supports the rule that condensate alone is not a complete radiative closure.

Primary source:
- https://dtcenter.ucar.edu/gmtb/users/ccpp/docs/sci_doc/group__module__radiation__clouds.html

### Evidence Root E — NASA liquid-water scattering lookup-table work

NASA's Lorenz-Mie lookup-table work for water clouds treats liquid droplets as homogeneous spheres and shows that inherent optical properties depend on wavelength/refractive index and PSD descriptors including effective radius and effective variance. It is useful for a future liquid-water spectral closure, but it does not define ice-cloud optics.

Primary source:
- https://ntrs.nasa.gov/citations/20220011134

### Evidence Root F — SideFX Karma and Unreal Engine evaluator contracts

Karma Volume consumes wavelength/color-dependent absorption and scattering rates in m^-1 plus anisotropy. UE 5.8 volume media expose extinction, albedo and scattering-direction/phase controls, while lighting/shadow/sample budgets remain separate evaluator concerns.

Primary vendor sources:
- https://www.sidefx.com/docs/houdini/nodes/vop/kma_volume.html
- https://dev.epicgames.com/documentation/unreal-engine/volumetric-fog-in-unreal-engine
- https://dev.epicgames.com/documentation/unreal-engine/local-fog-volumes-in-unreal-engine

These establish renderer-neutral adapter targets, not meteorological truth.

## Transferable methods

1. Introduce `MicrophysicsDiagnosticReplay` as a separate derived operation. It consumes source-model state plus an exact algorithm/version lock and produces source-model-consistent diagnostics such as effective radius. Its output status is `SourceModelDerivedReplay`, never `Observation` and never silently relabeled as a native GRIB field.
2. Add a `MomentClosureContract` for each hydrometeor species: predicted moments, units/basis, PSD family/shape parameters, mass-size relation, bulk density assumptions, bounds/clamps, and implementation/version provenance.
3. Add a `SpectralOpticalClosureContract`: wavelength/band, refractive-index source/version, particle phase/habit/roughness, PSD/effective-radius/effective-variance assumptions, scattering solver/LUT, extinction/scattering/single-scattering-albedo/phase representation, validity range and uncertainty.
4. Prefer **replaying the provider's own microphysics-consistent diagnostic** over inventing a new `q/N -> radius` shortcut when the required source fields and exact implementation are available.
5. If an exact source implementation is unavailable, a simplified `q/N` radius or Mie closure may still be used as an explicitly named Candidate approximation with its own uncertainty; it may not inherit the provider's identity.
6. Retain `MASSDEN` or enough `PRES/TMP/SPFH` context to convert per-mass mixing/number quantities into volumetric coefficients. Do not drop density support when creating the compact Weather packet.
7. Treat liquid and ice optical closure separately. Spherical-water Lorenz-Mie is a defensible liquid-water candidate when its PSD assumptions are explicit; ice requires a habit/roughness/scattering model and cannot reuse the liquid-water spherical closure by default.
8. Keep `FRACCC`/overlap/subgrid semantics outside the local optical coefficient itself. Local realization/disaggregation remains a separate operation under R11.
9. Define a renderer-neutral optical packet first: at minimum spectral/band `alpha_ext`, `alpha_sca`, `alpha_abs`, single-scattering albedo and phase/asymmetry representation with units and support. Then adapt it to Karma/UE/Three.js-WebGPU without changing source Weather state.
10. Separate uncertainty by layer: source/model error; diagnostic-replay/version error; moment/PSD closure error; spectral/scattering-model error; support/disaggregation error; evaluator numerical/visual/performance error.

## Executable evidence

Probe: `PROBES/hrrr_microphysics_optical_bridge_probe_r13.py`

The probe was executed before publication with synthetic test-only values and passed **7/7** checks:

1. The locked public HRRR native field family contains all field categories needed by the documented Thompson `calc_effectRad` interface: `TMP/PRES/SPFH/CLWMR/NCONCD/CIMIXR/NCCICE/SNMR`.
2. Effective-radius outputs are not treated as directly exposed HRRR native fields; a replay must remain derived.
3. A counterexample constructs a monodisperse and a two-size distribution with identical total number and total mass but different projected area. The bimodal/monodisperse projected-area ratio is about **0.885275**, proving mass+number alone do not identify extinction without a PSD assumption.
4. With the same test-only mass/number state and a wiring-only `Qext=2`, doubling air density from 0.6 to 1.2 kg/m^3 doubles the computed per-metre extinction from about **0.0424214 m^-1** to **0.0848429 m^-1**. The numbers are semantic test values, not HRRR cloud truth.
5. A simple monodisperse `q/N` shortcut produces a test radius of about **10.6078 um**, but the probe explicitly labels it Candidate-only rather than source-native Thompson `re_cloud`.
6. Renderer-neutral decomposition `alpha_ext = alpha_abs + alpha_sca` is conserved for a test-only albedo, demonstrating the adapter contract without validating real cloud optics.
7. Ice visible-light closure returns typed Missing/Unsupported until wavelength/band, ice habit/scattering model and phase-function/asymmetry context are supplied.

Result: `7/7 PASS`.

## Ordinary-person implementation constraints

An ordinary developer still cannot turn the public HRRR file into physically grounded cinematic cloud/laser interaction with a single formula:

- the current native file is hundreds of megabytes and the bounded runtime could not materialize its binary body; a range/subset/preprocessing service is still needed;
- HRRR exposes useful moments but not a ready-made visible-light extinction/scattering volume;
- reproducing Thompson radiative effective radii correctly requires a version-matched operational implementation or numerical cross-validation, not merely copying the newest WRF source;
- a visible liquid-water closure still needs wavelength/refractive-index/PSD assumptions or a validated LUT;
- ice is harder: habit, roughness and phase-function assumptions materially affect scattering, so `qi + ni` is not enough to claim unique visible optics;
- 3 km horizontal support remains much coarser than near-camera cloud structure, so any local volume below support is still declared synthetic/disaggregated;
- dual-evaluator validation remains necessary because renderer sampling/temporal/shadow approximations can diverge even when they consume the same optical packet.

## State ledger

### Observation
- None added. R13 contains no new direct physical observation of a real cloud.

### Candidate
- `MicrophysicsDiagnosticReplay`.
- `SourceModelDerivedReplay` status.
- `MomentClosureContract`.
- `SpectralOpticalClosureContract`.
- A renderer-neutral spectral optical packet carrying extinction, scattering, absorption, albedo and phase/asymmetry with support and uncertainty.
- Source packet expansion to retain `SPFH` plus `MASSDEN` or equivalent density derivation context and `SNMR` when replaying Thompson radiative diagnostics.
- Liquid and ice closure as separate capability gates.

### Current Best View
HRRRv4 public native output appears to preserve enough state categories to attempt a source-model-consistent replay of Thompson radiation effective radii, which is a substantially better bridge than inventing a generic cloud-radius formula. But the replay is not yet authorized as HRRRv4-exact because the exact operational implementation/hash has not been locked, and effective radius itself still does not complete visible-light optics. KAOPU should therefore use a two-stage bridge: `Weather microphysics -> version-locked MicrophysicsDiagnosticReplay -> SpectralOpticalClosure -> renderer-neutral optical packet -> evaluator adapters`. Each stage retains its own evidence identity and uncertainty.

### Frozen
None.

### Rejected
- `CLWMR/NCONCD` or `CIMIXR/NCCICE` uniquely determine renderer extinction without a PSD/shape model.
- A monodisperse `q/N` radius may be called the HRRR/Thompson effective radius without source-version validation.
- The newest WRF Thompson implementation may silently substitute for the operational HRRRv4 implementation.
- Radiation effective radius alone is a complete visible-light scattering/phase closure.
- Liquid-water spherical Mie assumptions may be applied unchanged to ice.
- `FRACCC` may simply multiply local extinction and thereby reproduce exact cloud overlap/radiative transfer.
- Renderer albedo/extinction/anisotropy tuning may be written back into Weather truth.

### Unknown
- Exact authenticated HRRRv4 Thompson/WRF operational source hash and the exact `calc_effectRad` implementation used in the production build.
- Whether a replay from public GRIB fields reproduces internal/UPP radiation effective radii within a defined tolerance.
- Actual decoded HRRR values for a selected small packet; the binary GRIB body was not materialized in this bounded runtime.
- Best validated visible-band liquid-water LUT/model and uncertainty for KAOPU's realtime target.
- Best validated visible-band ice habit/roughness/scattering representation and uncertainty.
- Whether precipitation hydrometeors must participate in the first visual closure or may be gated separately by scene/query conditions.
- Quantitative 3 km-to-local disaggregation error and cloud-overlap handling.
- Dual-evaluator numerical/visual/performance agreement for the same spectral optical packet.
- Existing NRLMSIS/HITRAN and runtime-atmosphere dual-adapter gates remain open.

## Routing

Route as Candidate only:

- Weather Mother: retain the expanded microphysics/thermodynamic bundle and exact source/model/version lineage; do not publish renderer optical coefficients directly from raw HRRR moments.
- Atmosphere: add `MicrophysicsDiagnosticReplay` and `SpectralOpticalClosure` boundaries; accept typed Missing for ice/spectral closure where assumptions are not locked.
- Lighting: consume only the renderer-neutral optical packet; local/spot/laser lighting queries may sample it but never alter Weather/microphysics state.
- Noise/Field: local geometric cloud detail remains `DerivedSyntheticDisaggregation` below source support and must not change the column-integrated/microphysical constraints without an explicit conservation rule.
- Terrain/Landscape/Ocean: preserve placement/reference-frame/support provenance; no new optical truth role is assigned.
- KAOPU semantic core: make diagnostic replay, moment closure, spectral closure and layer-specific uncertainty first-class typed operations.

No production Mother branch is modified by this cycle.

## Gate result and next gate

R13 materially narrows the Weather-coupling gap: the public HRRR field schema is sufficient in category to support a Thompson-style effective-radius diagnostic replay, and a mathematically explicit counterexample proves why raw mass+number must not be mapped directly to extinction without PSD assumptions. The gate remains **candidate-partial** because no version-matched HRRRv4 diagnostic replay and no decoded real packet were executed.

Next Weather gate: lock or numerically authenticate the exact HRRRv4 Thompson effective-radius diagnostic; materialize a tiny official HRRR native range/subset containing the required fields plus exact GRIB metadata; replay liquid/ice/snow effective radii; then attach one explicitly versioned visible-band liquid optical model and a separately justified ice model. Only after that should the same renderer-neutral optical packet be sent to two evaluator adapters for numerical/visual/performance comparison.
