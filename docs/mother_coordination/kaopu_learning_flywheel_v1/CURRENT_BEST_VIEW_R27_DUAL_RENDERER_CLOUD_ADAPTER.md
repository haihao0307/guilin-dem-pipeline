# KAOPU Current Best View — R27 dual-renderer cloud-adapter extension

Date: 2026-09-11
Status: Candidate extension to `CURRENT_BEST_VIEW.md`; no Frozen change.

276. A single immutable `SpectralLayerOpticalPacket` must feed every renderer adapter. Renderer-specific settings may derive from it but may not mutate it or write back into Weather.
277. Use a renderer-neutral `LocalPhysicalCoefficientPacket` as the first cross-renderer comparison surface after a path/distribution model is declared: `sigma_t`, `sigma_s`, `sigma_a` in `m^-1`, spectral/component identity and source phase/asymmetry identity.
278. For every component, enforce `sigma_t = sigma_s + sigma_a` and `albedo = sigma_s/sigma_t` where `sigma_t > 0`. These are physical invariants; raw engine parameter equality is not.
279. Karma Volume explicitly documents Absorption and Scattering as rates per traveled distance in `m^-1` and exposes one anisotropy factor. That makes a direct SI coefficient adapter possible when the source phase convention is compatible.
280. Current UE 5.8 Volume documentation describes Albedo/Emissive/Extinction as local world-space-density style material quantities, but does not explicitly authenticate the final SI unit of the Extinction input. `RendererUnitBinding` therefore remains a separate Candidate gate.
281. Epic separately documents `1 Unreal Unit = 1 cm` for world/object scale. Geometric world-unit identity does not by itself prove that a shader coefficient is numerically expressed in inverse Unreal Units. Inferring `Extinction == cm^-1` from those two facts alone is rejected until source or slab-runtime evidence closes the gap.
282. A declared length conversion may be tested algebraically by preserving Beer optical depth, but such a test validates the conversion math only. It does not authenticate an engine implementation.
283. A source asymmetry parameter `g` cannot be silently copied into UE's current default cloud material Phase A/Phase B/Blend and multiscatter controls. That mapping is a `PhaseFunctionBinding` approximation with its own identity and tolerance.
284. UE `Conservative Density` is an evaluator acceleration/skip hint. Epic documents it as a cheap value that must be positive where cloud exists so expensive material evaluation can be skipped elsewhere. It is not Canonical Weather density and may not alter physical optical coefficients.
285. Cloud fraction/overlap remains a subgrid contract. Neither Karma nor UE adapter may replace binary/subcolumn coverage with `cloudFraction * localExtinction` as a universal rule.
286. Spectral-to-display/RGB projection remains downstream. Renderer adapters must preserve spectral identity until a versioned projection is selected; display-space similarity is not evidence of optical equivalence.
287. `RendererAdapterIdentity` must bind target renderer/version, coefficient vocabulary, length/unit calibration, spectral projection, phase-function approximation, solver/multiple-scattering identity, quality/acceleration state and evidence ceiling.
288. `CrossRendererValidationSurface` order is: immutable source packet -> SI coefficient invariants -> unit/Beer invariants -> phase-model identity -> solver/multiple-scattering identity -> visual comparison. A Mother should not attempt to repair a downstream renderer difference by editing upstream Weather.
289. R27's synthetic two-band mixed-phase fixture produced band-16 `(tau,SSA,g)=(3.2673787333,0.6786076243,0.8493576631)` and band-17 `(3.1931095333,0.6387021662,0.9143693458)`. The same packet closes algebraically under Karma-style absorption/scattering and UE-style albedo/extinction semantics before engine-specific binding.
290. The R27 executable probe passed `19/19`; it verifies immutability, coefficient conservation, cross-adapter albedo reconstruction, explicit unit binding, partial-cloud nonlinearity, separation of Conservative Density from physical coefficients, explicit spectral projection and explicit phase binding.
291. R27 does not run Houdini/Karma, Unreal Editor, Blender, WRF or HRRR. The bounded runtime contains none of those executables. Therefore engine numeric/unit authentication, phase reduction error and visual tolerance remain Unknown.
292. R27 adds no physical Observation Root, does not change `ReplayStatus=source_callpath_authenticated`, does not modify any production Mother branch and leaves Frozen unchanged.

R27 evidence status:
- **Observation:** no new physical atmospheric Observation Root; NOAA source and renderer documentation are engineering/model/evaluator roots only.
- **Candidate:** `RendererAdapterIdentity`, `LocalPhysicalCoefficientPacket`, `AdapterConservationInvariant`, `RendererUnitBinding`, `PhaseFunctionBinding`, `RenderAccelerationHint`, `CrossRendererValidationSurface`.
- **Current Best View:** renderer interoperability is achieved by preserving physical invariants and explicit adapter identities, not by copying raw parameter numbers between engines.
- **Frozen:** none.
- **Rejected:** raw parameter equality across renderers; `1 UU=1 cm` automatically proves Volume Extinction is `cm^-1`; one source `g` automatically equals UE Phase A/B/Blend; Conservative Density is physical density; pixel similarity proves optical equivalence; renderer tuning may write back to Weather.
- **Unknown:** authenticated UE Extinction numeric unit; UE phase reduction from one physical `g`; real Karma/UE homogeneous-slab tolerance; matched visual tolerance; source-native real HRRR optical packet; R25 serial-SCM runtime.
- **Executable numeric/source-semantic probe:** `PROBES/hrrrv4_dual_renderer_adapter_probe_r27.py`, result `19/19 PASS`, SHA256 `4941dd1c4fe0da36d0d3f37e031f6dc95e94024b376c64a81e26c84c5ec26598`.
