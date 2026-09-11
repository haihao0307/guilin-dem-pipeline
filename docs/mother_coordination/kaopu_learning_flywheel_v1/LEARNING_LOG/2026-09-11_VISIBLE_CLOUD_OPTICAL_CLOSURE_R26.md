# KAOPU bounded learning cycle — R26 visible cloud optical closure and Mother work contract

Date: 2026-09-11
Learning question: `LQ-ATMOSPHERE-001`
Status: Candidate partial; no Frozen change; no production Mother mutation.

## Why this question was selected

The coordinator still ranks `LQ-ATMOSPHERE-001` first. R25's real serial-SCM execution remains blocked in the present bounded runtime by missing `csh` and NetCDF-Fortran, and those external packages cannot be installed from this environment. Repeating that same blocked installation would add no evidence. The queue explicitly keeps visible-band liquid/ice optical closure as a separate unresolved gate, so this cycle takes that independent gate rather than inventing progress on L1 execution.

The highest-value subquestion is: **what exact information must cross from Weather/microphysics into Lighting/renderer adapters so a Mother cannot incorrectly turn effective radius into cloud density, color or opacity?**

## Logical errors rejected before implementation

1. **Effective radius present => optical extinction is known.** False. Locked RRTMG-SW forms optical depth from hydrometeor water path multiplied by a size- and band-dependent extinction coefficient. Radius selects/changes optical coefficients; it does not supply the amount of condensate.
2. **A single effective-radius definition is valid for every frozen hydrometeor optics model.** False. Locked RRTMG distinguishes multiple ice-size semantics and parameterizations (`iceflag`), with different valid ranges and lookup/formula contracts.
3. **Mixed phase can be reduced by averaging liquid/ice/snow radii and evaluating one optical law.** False. Locked RRTMG computes phase-specific optical contributions and then combines optical depth, scattering and phase moments.
4. **Layer optical depth is already a local renderer extinction coefficient.** False. Optical depth is path-integrated/dimensionless. A local coefficient in m^-1 additionally requires an explicit path/distribution model. `sigma_t=tau/L` is valid only under the stated homogeneous-path assumption.
5. **Cloud fraction can always multiply local extinction.** False. A clear/cloudy subcolumn mixture is nonlinear in transmission; cloud fraction/overlap is a subgrid geometry/coverage problem, not a universal scalar multiplier on in-cloud optical coefficients.
6. **Microphysics-produced radius equals the radius consumed by radiation.** False. The locked radiation wrapper clamps radii and contains cloudy-cell fallback/reclassification behavior. Producer lineage and optics-consumed lineage must both be preserved.
7. **RRTMG delta-scaled `tau/omega/g` can be copied into any renderer and called physically identical.** False. Delta scaling, spectral-band/g-point organization and two-stream phase treatment are evaluator/model identities. Renderers expose different local-media abstractions and phase approximations.
8. **Snow has an independently validated snow optical model merely because `re_snow` exists.** False for this locked path. The source explicitly says snow reuses cloud-ice lookup constants and calls that treatment "far from perfect".
9. **RGB cloud color is Weather truth.** False. Spectral/band optical state must be projected into a renderer/display color basis by an explicit evaluator transform.

## Primary evidence roots kept distinct

### Root A — locked NOAA-EMC HRRRv4 radiation driver

`NOAA-EMC/HRRR@40ee6058c2fc6624cbfbbe8cf1c20c59e6a45827`, `module_radiation_driver.F`, blob `9769918bc3f8089851af655a7d7e37d570601c74`.

Transferable fact: `re_cloud`, `re_ice`, `re_snow` plus their request flags are handed into the radiation path. This establishes a producer-to-consumer interface, not a complete optical state by itself.

### Root B — locked NOAA-EMC HRRRv4 RRTMG shortwave source

Same commit, `module_ra_rrtmg_sw.F`, blob `d3848906b5bec0a656b1009baa2cad35f609eb6e`.

Transferable facts:
- cloud optics consumes **in-cloud** liquid, ice and snow water paths (`clwp`, `ciwp`, `cswp`) together with effective particle sizes;
- liquid optics uses a size- and spectral-band lookup contract; ice has multiple parameterization identities and effective-size definitions;
- phase optical contributions are calculated separately;
- non-delta optical depth is formed as liquid + ice (+ snow) contribution sums;
- delta scaling changes optical depth and single-scattering albedo before phase mixing;
- combined SSA/asymmetry are scattering-weighted rather than obtained by averaging radii;
- the snow branch explicitly reuses ice lookup constants and identifies that as an imperfect approximation.

The locked wrapper also shows that optics-consumed radius may differ from the producer field through lower bounds, empirical fallback behavior or hydrometeor-category remapping. Therefore a faithful checkpoint needs both `ProducedRadiusIdentity` and `ConsumedRadiusIdentity`.

### Root C — current official ECMWF ecRad documentation

The current ecRad User Guide states that hydrometeor optical parameterizations are expressed in terms of effective radius and that lookup tables bind optical properties to effective radius and wavenumber. The ecRad technical memorandum describes cloud optics as producing bandwise optical depth, single-scattering albedo and asymmetry from in-cloud hydrometeor amount plus effective radius, while cloud subgrid treatment remains a separate solver/cloud-generator concern.

This is independent mature-system corroboration of the decomposition, not a claim that ecRad and HRRR RRTMG use identical constants or defaults.

### Root D — current SideFX Karma volume documentation

Karma's volume interface exposes absorption and scattering as rates per distance in m^-1, separately per color/wavelength component, plus anisotropy. This gives a useful renderer-side target vocabulary, but it is local-medium semantics, not a direct representation of a path-integrated NWP optical depth.

### Root E — Unreal Engine 5.8 and Blender 5.2 volume documentation

UE volume materials expose albedo/emissive/extinction at points in space and UE cloud rendering uses real-time multiple-scattering approximations. Blender Principled Volume similarly exposes density/scattering/absorption/anisotropy. These renderer interfaces confirm the need for a **renderer adapter**, but their artistic/runtime controls are not Weather state and must never write back into Canonical Truth.

The roots above are engineering/model/rendering evidence. Agreement across them does not create multiple independent atmospheric Observation Roots.

## Executable evidence

Probe: `PROBES/hrrrv4_visible_optics_closure_probe_r26.py`

Executed result: `13/13 PASS`

SHA256: `9b688058d3521a1bedb068a7b2c703c6b13d3d97e6fb7fc885c55007505ad5c4`

The probe uses a small exact subset of locked RRTMG-SW liquid extinction-table values plus locked delta-scaling structure and synthetic, clearly non-observational fixtures. It verifies:
- radius alone cannot determine tau;
- radius and spectral band both affect optical coefficients;
- mixed-phase contribution-space composition differs from an averaged-radius shortcut;
- delta-scaled and non-delta packets are different identities;
- tau cannot become local m^-1 extinction without explicit path length;
- local scattering + absorption closes to total extinction once a path is defined;
- cloud-fraction subcolumn transmission differs from naively multiplying tau by cloud fraction;
- producer radius and optics-consumed radius can differ;
- spectral-to-display projection must be explicit;
- source table reuse does not erase snow/ice category identity.

This probe is executable structural evidence only. It is not a WRF/HRRR run and is not a physical atmospheric observation.

## Distilled transferable contracts

### 1. `OpticalClosureIdentity`

Bind the exact optical interpretation of a cloud packet:
- source/model/version;
- hydrometeor phase/category;
- effective-size definition and valid range;
- optical parameterization/LUT identity;
- spectral grid/band identity;
- delta-scaling state/convention;
- subgrid/cloud-overlap identity;
- any fallback, clamp or category-remapping policy.

A radius without this identity is not sufficient optical semantics.

### 2. `OpticsInputLineage`

Preserve at least:
- `producedRadius` and producer/source identity;
- `consumedRadius` after clamp/fallback/remap;
- in-cloud versus grid-mean condensate/path semantics;
- phase-resolved water path or sufficient state to derive it;
- layer/path geometry and pressure/mass basis;
- cloud fraction and overlap/subcolumn provenance.

### 3. `SpectralLayerOpticalPacket`

The preferred renderer-neutral exchange object is a versioned band packet, not RGB and not a texture:
- spectral band identity;
- phase-resolved and total non-delta optical depth where available;
- delta-scaled optical depth if a source evaluator uses it;
- single-scattering albedo;
- asymmetry/phase-moment semantics;
- path basis and subgrid identity;
- source optical-model identity;
- confidence/evidence state.

Do not silently collapse non-delta and delta-scaled quantities into one field.

### 4. `LocalVolumeOpticsAdapter`

Only after an explicit spatial/path-distribution assumption may a renderer adapter derive local coefficients such as `sigma_t`, `sigma_s`, `sigma_a` in m^-1. A homogeneous layer can use `sigma_t=tau/L`, but the path length `L` and assumption must be provenance, not an implicit constant.

Spectral-to-RGB/display conversion is another explicit evaluator transform. It must not overwrite the spectral packet.

### 5. `MixedPhaseCompositionRule`

Compute phase-specific optical contributions first. Combine in optical/scattering space according to the declared optics model. Do not average liquid/ice/snow effective radii into one radius as a shortcut.

### 6. `OpticsFallbackPolicy`

If a source-native radiation adapter clamps, substitutes or remaps a field, record that operation. A Mother choosing an independent modern optical model may avoid the old fallback, but then it must declare a new evaluator identity and cannot call the result a byte/semantic replay of the HRRR source-native optics.

## Mother work instruction — how to execute rather than merely know

### Weather Mother

For every cloud cell/layer intended for rendering:
1. keep raw phase-resolved microphysics state and cloud fraction intact;
2. tag condensate as `grid_mean`, `in_cloud` or `unknown`;
3. preserve producer effective radius and, if reproducing source-native radiation, the actual optics-consumed radius after source clamp/fallback/remap;
4. derive or expose phase water path only with explicit layer mass/pressure/geometry assumptions;
5. emit a typed `CloudMicrophysicsPacket`; never emit "cloud color" as physical truth;
6. do not multiply cloud fraction into local extinction by default.

### Atmosphere / optical-closure evaluator

1. choose and lock one optical model/LUT identity before evaluation;
2. evaluate liquid/ice/snow separately;
3. retain spectral bands and non-delta/delta identities;
4. combine phase optical contributions only after per-phase evaluation;
5. carry cloud fraction/overlap as a separate subgrid contract;
6. if using source-native HRRR RRTMG behavior, preserve its documented snow-table reuse as an explicit limitation rather than hiding it.

### Lighting Mother

1. consume `SpectralLayerOpticalPacket`, not raw `re_*` fields;
2. reject packets missing water/path amount, optical-model identity, spectral identity or path basis;
3. convert path optics to local volume coefficients only through an explicit spatial adapter;
4. convert spectral data to renderer RGB/color space through a versioned projection;
5. keep artistic controls, multiple-scattering approximations and performance knobs in evaluator state only;
6. never write renderer-tuned density/albedo/extinction back into Weather Canonical Truth.

### QA rule for all Mothers

A visually pleasing cloud is not accepted as evidence that the Weather-to-optics bridge is correct. QA must separately test semantic closure, numeric invariants and visual acceptance.

## Constraints preventing an ordinary developer from realizing this quickly

A faithful implementation needs more than the three effective-radius fields. It also needs phase-resolved condensate or water paths, cloud-fraction semantics, layer mass/geometry, a source-locked or explicitly substituted spectral optical model, correct units, subgrid/overlap treatment, and a spectral-to-renderer projection. Reproducing source-native HRRR behavior additionally requires matching its clamps/fallbacks and its RRTMG tables. A real-time renderer then introduces a second mismatch: it usually expects local coefficients and uses approximate phase/multiple-scattering methods, whereas NWP radiation schemes often operate on layer optical packets and specialized solvers. Those transforms are manageable, but they cannot be skipped without changing the meaning of the data.

## Status ledger

- **Observation:** no new physical atmospheric Observation Root.
- **Candidate:** `OpticalClosureIdentity`, `OpticsInputLineage`, `SpectralLayerOpticalPacket`, `LocalVolumeOpticsAdapter`, `MixedPhaseCompositionRule`, `OpticsFallbackPolicy`, and the Mother execution contract above.
- **Current Best View:** Weather should preserve phase/state truth; a dedicated optics evaluator converts it into spectral path-optics; a separate renderer adapter converts path/spectral optics to local/render-space quantities. Effective radius must never jump directly to density/color/opacity.
- **Frozen:** none.
- **Rejected:** radius-alone optics; universal ice-radius semantics; averaged mixed-phase radius; tau-as-local-density; cloud-fraction-as-universal-extinction-multiplier; producer-radius==consumed-radius; direct RRTMG-to-renderer identity; snow-table-reuse==independent snow model; RGB-as-Weather-truth.
- **Unknown:** numerical source-native RRTMG packet from a real locked HRRRv4 checkpoint; exact renderer spectral projection chosen for KAOPU; how much source-native versus newer ecRad-style cloud optics should be retained; dual-evaluator visual/numeric tolerance; R25 serial-SCM execution remains independently blocked by missing current-runtime dependencies.

## Routing / next gate

Run two gates independently rather than letting one block the other:

**Weather runtime gate:** retain R25 and close the serial SCM toolchain when an execution environment can provide `csh + netCDF-Fortran`; then continue the locked L1 ControlInstrumentedPair. Do not change ReplayStatus before its existing L3 requirement.

**Optical closure gate:** build a small phase-resolved fixture that starts from a fully typed Weather layer (`q/path + cloud fraction + produced/consumed radius + geometry`) and evaluates at least two spectral bands into `SpectralLayerOpticalPacket`. Then pass the same immutable packet through two independent renderer adapters (for example a coefficient-oriented Karma-style adapter and a UE-style volume adapter) and verify that differences remain evaluator-side rather than feeding back into Weather. The fixture must explicitly test mixed phase, partial cloud, spectral projection and path-to-local conversion. Candidate-complete promotion requires this cross-evaluator closure plus the existing runtime gates; Frozen remains a separate Judgment event.
