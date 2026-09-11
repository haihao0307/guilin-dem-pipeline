# KAOPU bounded learning cycle — R27 dual-renderer cloud-adapter contract

Date: 2026-09-11
Learning question: `LQ-ATMOSPHERE-001`
Status: Candidate partial; no Frozen change; no production Mother mutation.

## Why this question was selected

The coordinator still ranks `LQ-ATMOSPHERE-001` first. R25's locked serial-SCM runtime remains independently blocked in the current bounded environment by missing `csh` and NetCDF-Fortran. R26 left a non-blocked optical gate: one fully typed mixed-phase/partial-cloud Weather fixture must become an immutable spectral optical packet and then feed at least two renderer adapters without renderer assumptions writing back into Weather.

The highest-value bounded question is therefore: **which physical invariants may be shared across renderers, and which renderer parameters require a separate unit/phase/solver binding rather than raw numeric copying?**

## Logical errors rejected before implementation

1. **Same raw extinction number in two renderers means the same physical medium.** False. A coefficient has meaning only with a length-unit contract and renderer semantics. Karma explicitly documents absorption/scattering in m^-1; UE documents Volume Extinction as a world-space density but does not explicitly state a final SI unit for that input.
2. **UE uses 1 Unreal Unit = 1 cm, therefore Volume Extinction is proven to be cm^-1.** Not established by the documentation reviewed. Geometry scale and shader-parameter unit identity are separate claims. A Beer-slab engine test or source-level confirmation is still required before calling that binding authenticated.
3. **A single source asymmetry parameter `g` can be copied into UE Phase A, Phase B and Phase Blend.** False. The current UE default cloud material documents two phase functions plus a blend and separate multiscatter controls. Mapping one physical asymmetry parameter into that artistic/evaluator parameterization is a model-reduction choice, not an identity.
4. **UE Conservative Density is the physical cloud density.** False. Epic documents it as a cheap positive occupancy/conservativeness signal used to skip expensive material evaluation; it is an evaluator acceleration hint.
5. **If Karma and UE images look similar, the adapter is numerically correct.** False. Tone mapping, spectral projection, phase approximation, multiple-scattering approximation, sampling and exposure can hide or create differences. Adapter QA must compare reconstructed physical invariants before comparing pixels.
6. **Cloud fraction can be folded into local extinction before both adapters.** False. R26's subcolumn nonlinearity still applies; coverage/overlap remains a separate contract.
7. **Renderer performance controls may be written back to Weather if they improve stability.** Rejected. Sampling octaves, conservative-density hints, shadow mode, quality settings and material controls are evaluator state only.

## Independent evidence roots

### Root A — locked NOAA-EMC HRRRv4 RRTMG-SW

`NOAA-EMC/HRRR@40ee6058c2fc6624cbfbbe8cf1c20c59e6a45827`, `WRFV3.9/phys/module_ra_rrtmg_sw.F`, blob `d3848906b5bec0a656b1009baa2cad35f609eb6e`.

The R27 fixture uses an exact small subset of locked liquid optical tables plus the locked Ebert-Curry branch equations. This provides source-semantic tau/SSA/asymmetry inputs for a synthetic two-band mixed-phase layer. It is not an HRRR runtime checkpoint and not an atmospheric Observation Root.

### Root B — current SideFX Karma Volume documentation

`https://www.sidefx.com/docs/houdini/nodes/vop/kma_volume.html`, retrieved 2026-09-11.

Karma Volume documents absorption and scattering as rates per distance in `m^-1`, component/wavelength-wise, and exposes a single anisotropy factor. This is a strong local-coefficient target contract.

### Root C — Unreal Engine 5.8 Volumetric Fog documentation

`https://dev.epicgames.com/documentation/unreal-engine/volumetric-fog-in-unreal-engine`, retrieved 2026-09-11.

UE Volume materials expose Albedo, Emissive and Extinction at a point in space and describe Emissive/Extinction as world-space densities. This supports a local-medium adapter target, but the page does not explicitly define Extinction in SI units.

### Root D — Unreal Engine 5.8 Volumetric Cloud documentation

`https://dev.epicgames.com/documentation/unreal-engine/volumetric-cloud-component-in-unreal-engine`, retrieved 2026-09-11.

The cloud renderer uses ray marching and scalable multiple-scattering approximations. `Conservative Density` is documented as an inexpensive early evaluation used to decide whether the expensive material graph should run; it only needs to be positive where cloud exists. It is therefore acceleration metadata, not a physical density field.

### Root E — Unreal Engine 5.8 Volumetric Cloud Material documentation

`https://dev.epicgames.com/documentation/unreal-engine/volumetric-cloud-material-in-unreal-engine`, retrieved 2026-09-11.

The current default cloud material uses two phase-function controls (Phase A/Phase B plus Blend) and separate multiscatter controls. These are evaluator-specific controls and are not automatically equivalent to one source optical asymmetry parameter.

### Root F — Unreal Engine world-unit documentation

`https://dev.epicgames.com/documentation/en-us/unreal-engine/importing-static-meshes-in-unreal-engine`, retrieved 2026-09-11.

Epic states that one Unreal Unit equals one centimeter for object/world scale. R27 keeps this fact distinct from the still-unverified numeric unit of Volume-material Extinction.

### Root G — Blender 5.2 Principled Volume documentation

`https://docs.blender.org/manual/en/5.2/render/shader_nodes/shader/volume_principled.html`, retrieved 2026-09-11.

Blender independently exposes volume Density/Color/Absorption/Anisotropy controls. It corroborates the need for renderer adapters, not a universal parameter identity.

No root above is promoted to a physical atmospheric Observation Root.

## Executable evidence

Probe: `PROBES/hrrrv4_dual_renderer_adapter_probe_r27.py`

Executed result: `19/19 PASS`

SHA256: `4941dd1c4fe0da36d0d3f37e031f6dc95e94024b376c64a81e26c84c5ec26598`

The synthetic Weather fixture is explicit:
- cloud fraction `0.35`;
- homogeneous in-cloud path `600 m`;
- liquid/ice/snow paths `12/6/2 g m^-2`;
- liquid/ice/snow radii `8/30/60 um`;
- subgrid semantics `binary_clear_cloudy_fraction`.

The locked-source structural evaluator produces:
- band 16: `tau=3.2673787333`, `SSA=0.6786076243`, `g=0.8493576631`;
- band 17: `tau=3.1931095333`, `SSA=0.6387021662`, `g=0.9143693458`.

For the declared homogeneous `600 m` cloudy path, the Karma-style physical adapter yields:
- band 16: `sigma_a=0.00175018436 m^-1`, `sigma_s=0.00369544687 m^-1`;
- band 17: `sigma_a=0.00192277260 m^-1`, `sigma_s=0.00339907663 m^-1`.

The UE-style semantic adapter expresses the same local physics as:
- `physical_extinction = sigma_t = sigma_a + sigma_s`;
- `albedo = sigma_s / sigma_t`;
- the source `g` carried separately;
- engine numeric Extinction left **unbound** until an explicit unit calibration is supplied;
- phase-function binding left **unbound** until an explicit approximation policy is supplied;
- Conservative Density carried only as an evaluator acceleration hint.

The probe verifies:
- two spectral bands stay distinct;
- the `SpectralLayerOpticalPacket` is immutable;
- `sigma_t = sigma_a + sigma_s` in each band;
- Karma-style and UE-style forms reconstruct the same physical albedo/extinction invariants before engine binding;
- UE engine Extinction is not guessed when unit calibration is absent;
- UE phase parameters are not guessed from one source `g`;
- an explicitly declared length conversion preserves Beer optical depth algebraically;
- partial-cloud subcolumn transmission differs from `exp(-cloudFraction*tau)`;
- changing UE Conservative Density hints does not change the physical extinction/albedo packet;
- spectral-to-display projection is rejected when no projection identity is provided;
- a declared projection produces derived display values without mutating source optics;
- a phase binding exists only after an explicit adapter policy is named.

No Houdini/Karma, Unreal Editor, Blender, WRF or HRRR executable is installed in the bounded runtime, so the probe does not claim engine-runtime authentication.

## Distilled transferable contracts

### 1. `RendererAdapterIdentity`

Bind at least:
- target renderer + version;
- local coefficient vocabulary;
- length/unit convention or calibration identity;
- spectral projection identity;
- phase-function approximation identity;
- multiple-scattering/solver identity;
- quality/performance/acceleration settings;
- evidence ceiling.

### 2. `LocalPhysicalCoefficientPacket`

Before engine-specific binding, derive and preserve SI local quantities from a declared spatial model:
- `sigma_t` in `m^-1`;
- `sigma_s` in `m^-1`;
- `sigma_a` in `m^-1`;
- spectral/component identity;
- source asymmetry/phase-moment identity;
- path/distribution assumption.

This packet is the cross-renderer comparison surface. Raw engine parameters are not.

### 3. `AdapterConservationInvariant`

For every component with `sigma_t > 0`:
- `sigma_t = sigma_s + sigma_a`;
- `albedo = sigma_s / sigma_t`;
- Beer optical depth must remain invariant under a declared length-unit conversion;
- source spectral packet must remain immutable.

### 4. `RendererUnitBinding`

Keep geometric world scale, physical coefficient units and engine material numeric units separate. A geometric statement such as `1 UU = 1 cm` is not sufficient by itself to authenticate a shader coefficient's numeric unit. Use source-level evidence or a homogeneous-slab runtime calibration before promotion.

### 5. `PhaseFunctionBinding`

A source asymmetry parameter may be routed directly only to a renderer contract that actually consumes the same phase model. If the target uses two lobes, artistic blend controls or multiscatter eccentricity controls, the mapping is an evaluator approximation with its own identity and tolerance.

### 6. `RenderAccelerationHint`

Optimization metadata such as UE Conservative Density is neither Canonical Weather density nor an optical coefficient. It may be derived from occupancy/support bounds, but must not alter `tau`, `sigma_t`, `albedo` or the Weather packet.

### 7. `CrossRendererValidationSurface`

Compare renderers in this order:
1. immutable source `SpectralLayerOpticalPacket` equality;
2. reconstructed SI coefficient invariants;
3. declared unit-conversion/Beer slab invariants;
4. phase-model approximation identity;
5. solver/multiple-scattering identity;
6. only then visual/image differences.

This prevents a Mother from trying to fix a renderer approximation by corrupting Weather truth.

## Mother execution instruction

### Weather Mother

1. Emit the R26 typed cloud/microphysics packet only.
2. Never write `density`, UE `Conservative Density`, Karma absorption/scattering or display RGB into Canonical Weather truth.
3. Preserve cloud fraction/subgrid semantics independently from in-cloud optical amount.
4. If a renderer reports a visual mismatch, do not change Weather unless a Weather invariant itself failed.

### Atmosphere / Optical Closure Mother

1. Produce one immutable `SpectralLayerOpticalPacket` from the declared optical model.
2. Produce `LocalPhysicalCoefficientPacket` only after the path/distribution model is explicit.
3. Retain the source `g`/phase identity without deciding UE Phase A/B/Blend.
4. Reject any renderer adapter that requests a raw scalar density without unit/path semantics.

### Lighting / Karma adapter

1. Consume `LocalPhysicalCoefficientPacket`.
2. Map `sigma_a -> Absorption`, `sigma_s -> Scattering`, source `g -> Anisotropy` only where the phase convention is declared compatible.
3. Keep all values in the documented local coefficient unit contract (`m^-1`) before any color/display projection.
4. Never change source optics to compensate for sampling/noise/fireflies.

### Lighting / UE adapter

1. Derive physical `Albedo = sigma_s/sigma_t` and retain physical `sigma_t` separately.
2. Do **not** emit a final engine Extinction number until `RendererUnitBinding` is authenticated or explicitly labeled Candidate calibration.
3. Do **not** derive Phase A/Phase B/Blend from one source `g` without an explicit approximation policy.
4. Treat Conservative Density only as an optimization hint; changing it must not change physical optical fields.
5. Keep ray-march sample count, multiple-scattering octaves, Beer-shadow mode and other quality controls in evaluator state.

### QA for both renderer adapters

Use a homogeneous slab with known physical path length. Before any image judgment, verify that the renderer's measured direct transmittance follows the expected Beer attenuation within a declared tolerance. Then test phase response and multiple-scattering separately. Do not use a pretty cloud image as the first validation surface.

## Constraints preventing quick ordinary implementation

A purely mathematical adapter is straightforward; an authenticated dual-renderer adapter is not. The current bounded environment has no Houdini/Karma or Unreal Editor executable, so it cannot run the required homogeneous-slab tests. A normal developer would need licensed/installed renderer versions, deterministic scene setup, control of exposure/tone mapping, known path geometry, scripting or capture of direct transmittance, and ideally engine/source access where documentation leaves units unspecified. Cross-renderer phase equivalence is harder because UE's current default cloud material exposes dual-lobe and multiscatter controls rather than the same single phase parameter contract as Karma. Spectral-to-display projection is another independent choice and must be fixed before RGB comparison.

## Status ledger

- **Observation:** no new physical atmospheric Observation Root.
- **Candidate:** `RendererAdapterIdentity`, `LocalPhysicalCoefficientPacket`, `AdapterConservationInvariant`, `RendererUnitBinding`, `PhaseFunctionBinding`, `RenderAccelerationHint`, and `CrossRendererValidationSurface`.
- **Current Best View:** compare renderers through immutable spectral optics and reconstructed SI invariants; bind engine units, phase approximations and performance controls only downstream.
- **Frozen:** none.
- **Rejected:** raw-number equality across renderers; `1 UU = 1 cm` automatically proves UE Extinction is cm^-1; one source `g` automatically equals UE Phase A/B/Blend; Conservative Density is physical cloud density; pixel similarity proves optical equivalence; renderer tuning may write back to Weather.
- **Unknown:** authenticated UE Volume Extinction numeric unit; source/engine-equivalent UE phase binding for one source `g`; actual Karma and UE homogeneous-slab error/tolerance; visual tolerance after matched physical coefficients; source-native real HRRR packet; R25 serial-SCM runtime remains independently blocked.

## Routing / next gate

Keep runtime and renderer gates separate.

**Renderer runtime gate:** on machines with the target renderers, build the same one-band homogeneous slab in Karma and UE from one `LocalPhysicalCoefficientPacket`. Disable/lock display transforms where possible. Measure direct transmittance at at least two physical path lengths and verify Beer attenuation. In UE, use this to authenticate the engine Extinction numeric scale instead of inferring it from world units. Next, test a single-scattering directional case to calibrate/quantify the phase-function reduction. Only after these gates pass should a visual cloud comparison be used.

**Weather runtime gate:** retain R25 unchanged: close `csh + NetCDF-Fortran`, compile locked serial `em_scm_xy`, then continue R21/R22/R23/R20 L1 execution. Neither R27's algebraic dual-adapter closure nor a renderer slab test advances `ReplayStatus`; L3 locked HRRRv4 state-source-aligned checkpoint/replay remains the runtime-authentication authority.
