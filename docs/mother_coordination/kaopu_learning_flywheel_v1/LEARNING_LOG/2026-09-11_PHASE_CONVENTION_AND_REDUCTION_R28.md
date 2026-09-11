# KAOPU bounded learning cycle — R28 phase-convention identity and dual-lobe reduction

Date: 2026-09-11
Learning question: `LQ-ATMOSPHERE-001`
Status: Candidate partial; no Frozen change; no production Mother mutation.

## Why this question was selected

The coordinator still ranks `LQ-ATMOSPHERE-001` first. R27 closed the algebraic coefficient adapter but deliberately left phase binding Unknown. The highest-value non-blocked subquestion is therefore narrower than another visual cloud pass: **what minimum convention and moment information must be carried before a source asymmetry parameter can be bound to Karma or UE phase controls without silently reversing or changing the scattering distribution?**

This is high-value because a phase-sign or convention error can produce a visually plausible cloud while reversing the forward/backward transport that the source optical model intended. It also directly teaches Mothers how to stop tuning the wrong layer.

## Logical errors rejected before implementation

1. **`g` is a universal raw number across renderers.** False. A phase parameter is not fully identified without the phase-function family, angular/direction-vector convention, sign convention, normalization and lobe/blend semantics.
2. **A documentation page saying “forward” is enough to bind the sign.** False in the present UE 5.8 case because current official Epic pages conflict with each other. The generated API/header tooltip for `UMaterialExpressionVolumetricAdvancedMaterialOutput` says `g<0` is forward and `g>0` backward; the official default Volumetric Cloud Material page says positive Phase A/B is forward and negative is backward.
3. **The formula sign alone resolves the convention.** False. PBRT explicitly uses both phase directions pointing away from the scattering point, unlike common scattering-literature conventions. A change in direction-vector convention changes the cosine sign in the formula while representing the same physical distribution.
4. **Matching one asymmetry value is enough to map a one-lobe source into a two-lobe renderer.** False. In Henyey-Greenstein, `g` is the first angular/Legendre moment. Infinitely many normalized phase functions, including many dual-lobe mixtures, share the same first moment while differing strongly in higher moments and angular shape.
5. **If a renderer exposes two phase controls, inventing a second lobe is harmless.** False. A second lobe introduces new angular information not present in the one-parameter source. It is an evaluator approximation and requires its own identity and error metric.
6. **A pretty silver lining proves the phase mapping is correct.** False. Exposure, multiple-scattering approximations, shadowing, tone mapping and even sign reversal can create convincing images. Phase QA must precede image acceptance.
7. **SideFX/PBRT agreement resolves UE behavior.** False. Independent systems corroborate a positive-forward convention, but they are not evidence of UE runtime semantics.

## Independent evidence roots

### Root A — Epic UE 5.8 generated API/header documentation

`UMaterialExpressionVolumetricAdvancedMaterialOutput`:
`https://dev.epicgames.com/documentation/unreal-engine/API/Runtime/Engine/UMaterialExpressionVolumetricAdv-_1`

Current generated API documentation, sourced from the engine header tooltip, describes PhaseG and PhaseG2 as forward for `g<0` and backward for `g>0`.

### Root B — Epic UE 5.8 Volumetric Cloud Material documentation

`https://dev.epicgames.com/documentation/unreal-engine/volumetric-cloud-material-in-unreal-engine`

The current default cloud-material page says Phase A and Phase B positive values scatter forward and negative values backward; Phase Blend controls the contribution between the two functions.

### Root C — Epic UE 5.8 Volumetric Cloud Component Properties

`https://dev.epicgames.com/documentation/unreal-engine/volumetric-cloud-component-properties-in-unreal-engine`

This page repeats the API-side `g<0` forward / `g>0` backward wording and documents Phase Blend as a linear interpolation factor.

Roots A/B/C are kept separate because their disagreement is material evidence. This cycle does not silently collapse them into a single “Epic says” statement.

### Root D — SideFX Karma Volume

`https://www.sidefx.com/docs/houdini/nodes/vop/kma_volume.html`

Karma documents positive anisotropy as forward scattering, negative as backward, and exposes a secondary anisotropy plus linear Secondary Mix. It also warns that extreme anisotropy values can produce fireflies; that is a renderer sampling/stability issue, not a reason to mutate source optics.

### Root E — PBRT v4 phase-function reference implementation/book

`https://www.pbr-book.org/4ed/Volume_Scattering/Phase_Functions`

PBRT documents Henyey-Greenstein `g` as the mean cosine / first angular moment, with positive `g` corresponding to forward scattering. It also explicitly warns that PBRT's phase directions both point away from the scattering point, unlike the common scattering-literature convention. PBRT further notes that one `g` does not uniquely specify an arbitrary phase distribution and that weighted sums of phase functions can represent more complex shapes.

### Root F — Epic UE 5.8 MaterialX VDF API

`https://dev.epicgames.com/documentation/unreal-engine/API/Plugins/InterchangeCommon/EInterchangeMaterialXVDF`

Epic documents the separate MaterialX anisotropic VDF import path as Henyey-Greenstein. This is useful evidence about that interface only; it is not promoted into proof that Volumetric Cloud PhaseG uses exactly the same implementation or sign convention.

No root above is a physical atmospheric Observation Root.

## Executable evidence

Probe: `PROBES/hrrrv4_phase_convention_probe_r28.py`

Executed result: `14/14 PASS`

SHA256: `d2b3db87487c3cc73f4ef474b4ad73533ec88eb5a1ec74a97e05e30abdc09856`

The probe defines one explicit KAOPU canonical phase convention for testing only:
- `mu_physical = cos(deflection angle)`;
- `mu=+1` means straight-ahead/forward propagation;
- positive HG `g` means forward scattering.

For `g=0.85` it numerically verifies:
- normalization over `4π`;
- first Legendre moment equals `0.85`;
- second Legendre moment equals `g^2 = 0.7225`;
- approximately `96.386%` of scattering lies in the forward hemisphere and `3.614%` in the backward hemisphere;
- sign inversion swaps those hemisphere probabilities, producing a ~`26.67x` change in forward-hemisphere probability.

The probe also verifies that PBRT's both-directions-away angular convention gives the same physical HG values after the cosine sign is transformed. Therefore a different algebraic sign in an implementation is not enough to infer a different physical phase convention.

Finally, it constructs two different normalized dual-HG mixtures that both have first moment `g=0.85`:
- mixture A: `g1=0.90`, `g2=0.40`, second-lobe weight `0.10`, second moment `0.7450`;
- mixture B: `g1=0.95`, `g2=-0.30`, second-lobe weight `0.08`, second moment `0.8375`.

Both match the same source first moment, yet their angular distributions differ by an integrated L1 distance of about `0.7231`. Mixture A also differs from the source single HG by about `0.2773` in the same metric. This is executable evidence that first-moment matching alone does not define a unique two-lobe binding.

The probe is renderer-independent mathematical evidence. It does not authenticate UE or Karma runtime behavior.

## Distilled transferable contracts

### 1. `PhaseConventionIdentity`

Every phase quantity crossing a Mother/tool boundary must bind at least:
- phase-function family or `unknown`;
- parameter semantic (`first Legendre moment`, arbitrary artist control, etc.);
- incoming/outgoing direction-vector orientation;
- angle/cosine definition;
- sign-to-forward convention;
- normalization convention;
- lobe count and blend semantics;
- spectral dependence or band identity;
- renderer/source version;
- evidence status.

A scalar `g` without this identity is incomplete data.

### 2. `PhaseMomentPacket`

When the source model supplies only an asymmetry parameter, preserve it explicitly as the first angular moment rather than pretending that it contains a full phase curve. Where available, preserve higher moments or a tabulated/analytic phase function separately.

Suggested fields:
- `P0 = 1` normalization invariant;
- `P1 = g`;
- optional `P2+` moments;
- source family/fit identity;
- spectral band;
- uncertainty/evidence status.

### 3. `PhaseReductionIdentity`

Mapping a source phase representation into a different renderer representation is a reduction/approximation problem. Record:
- source representation;
- target representation;
- fitted parameters;
- objective (`P1`, `P1+P2`, angular L1/L2, directional radiance, etc.);
- angular/spectral weighting;
- validation fixture;
- measured error and tolerance.

No reduction is “free” merely because both sides expose parameters named `g`.

### 4. `PrimaryDocumentationConflict`

If two current primary-source documents disagree on a material contract, preserve the conflict rather than choosing the page that best matches expectation. Route the affected parameter as `Unknown` until source-level or executable evidence resolves it.

This is directly reusable beyond rendering: Houdini node docs versus implementation behavior, Substance graph docs versus SBSAR runtime, Blender manual versus API, or UE property docs versus shader runtime should be handled the same way.

## Mother execution instruction

### Weather Mother

1. Continue emitting the R26/R27 source asymmetry quantity with spectral/band identity only.
2. Do not attach a renderer sign convention to Weather truth.
3. Do not create a second lobe because a downstream renderer happens to expose one.
4. If downstream asks for Phase A/B/Blend, return the source `PhaseMomentPacket` and require a renderer adapter.

### Atmosphere / Optical Closure Mother

1. Preserve the source optical asymmetry as a phase moment with its source optical-model identity.
2. Where the optical model supplies a richer phase representation, preserve that representation or additional moments rather than compressing early to one `g`.
3. Never infer renderer direction-vector convention from parameter names.
4. Mark the UE phase-sign binding `Unknown` until runtime or shader-source evidence resolves the current official-documentation conflict.

### Lighting / Karma adapter

1. Karma's documented convention is positive-forward and negative-backward.
2. A direct source-`g` binding is allowed only when `PhaseConventionIdentity` confirms the source family/angle semantics are compatible with the chosen Karma phase implementation.
3. If Secondary Anisotropy/Mix is introduced, it becomes a `PhaseReductionIdentity`; do not invent a second lobe simply to improve appearance.
4. Firefly/noise mitigation belongs to sampling/evaluator controls, not Weather or source optics.

### Lighting / UE adapter

1. Do not bind the sign of PhaseG/Phase A/B from documentation alone in R28: current official UE 5.8 pages conflict.
2. Leave `UERuntimePhaseSign` as `Unknown` and preserve both conflicting roots.
3. Do not fit Phase A/B/Blend from one source `g` using first-moment matching only.
4. If an authenticated UE runtime/source proves the phase family and sign, first test the one-lobe case with multiple known `g` values and fixed single scattering. Only then consider a dual-lobe reduction.
5. A dual-lobe reduction must publish at least first- and second-moment or angular-distribution error; visual preference is a separate downstream criterion.

### QA fixture

Use a homogeneous, single-scattering directional test before any multiscatter or tone mapping:
- fixed optical coefficients and path;
- one directional light;
- camera/light geometry that separately samples forward and backward directions;
- `g = 0`, `+0.5`, `+0.85`, and their negative counterparts;
- record radiance ratios before display transforms;
- establish the renderer's sign and angular convention empirically;
- only then fit or enable a second lobe.

The test should fail loudly if the sign binding is unresolved rather than silently using an artist default.

## Constraints preventing quick ordinary implementation

The mathematics is inexpensive, but runtime authentication is not. An ordinary developer still needs the exact target engine versions, deterministic cloud/volume test scenes, control over exposure and multiple scattering, a way to extract linear radiance or a pre-tonemap buffer, and either shader-source access or a scripted directional fixture. UE's current official documentation contains a direct sign-description conflict, so reading one page is insufficient. Cross-engine matching is further constrained by different phase families, direction-vector conventions, dual-lobe controls, sampling behavior and multiple-scattering approximations.

A one-parameter asymmetry source also fundamentally lacks enough information to identify an arbitrary two-lobe phase curve. No amount of coding can recover higher angular moments that were never present; those must remain Unknown, be supplied by a richer source model, or be introduced explicitly as an evaluator approximation.

## Status ledger

- **Observation:** no new physical atmospheric Observation Root.
- **Candidate:** `PhaseConventionIdentity`, `PhaseMomentPacket`, `PhaseReductionIdentity`, `PrimaryDocumentationConflict`, and a directional single-scattering phase-authentication fixture.
- **Current Best View:** phase parameters are typed angular-distribution contracts, not raw scalar renderer controls. Preserve source moments and conventions; authenticate renderer sign/family separately; quantify any one-to-two-lobe reduction.
- **Frozen:** none.
- **Rejected:** universal raw-`g` identity; choosing one of conflicting primary documents without further evidence; inferring physical convention from formula sign alone; first-moment-only dual-lobe fitting as a unique solution; adding a second lobe for appearance and calling it physical; pixel/silver-lining similarity as phase proof.
- **Unknown:** actual UE 5.8 Volumetric Cloud runtime sign convention; exact UE cloud phase-function family behind PhaseG/PhaseG2; authenticated Karma/source-family equivalence for the R27 HRRR optical `g`; acceptable phase-reduction error tolerance; R27 UE Extinction unit; R25 serial-SCM runtime.

## Routing / next gate

Keep the renderer-unit, phase and Weather-runtime gates independent.

**Phase runtime gate:** on the target UE 5.8 build, create the directional single-scattering fixture above and determine the sign convention for PhaseG/PhaseG2 from measured linear radiance. If engine shader source is available, cross-check the exact phase formula and direction-vector convention. Do not use documentation consensus because the current official documents conflict. Repeat a compatible one-lobe fixture in Karma. Once both conventions are authenticated, compare the source `PhaseMomentPacket` in a single-lobe representation. Only then introduce a dual-lobe target and fit at least `P1+P2` or a declared angular error metric.

**Renderer-unit gate:** retain R27's homogeneous Beer slab test for UE Extinction numeric scaling.

**Weather runtime gate:** retain R25 unchanged: close `csh + NetCDF-Fortran`, compile locked serial `em_scm_xy`, then continue the existing L1/L3 checkpoint gates.

R28 does not advance `ReplayStatus`. Candidate-complete promotion still requires the applicable runtime, optical, unit, phase and dual-evaluator gates; Frozen remains a separate Judgment event.
