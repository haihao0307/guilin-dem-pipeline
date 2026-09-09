# KAOPU Learning Log — Atmosphere R01 — 2026-09-09

Status: Candidate learning only. Not formal KAOPU R2. No production Mother mutation.

## User-driven question

Which ideas from current Unreal Engine 5.8 Sky Atmosphere / Volumetric Cloud, SideFX Karma Sky Atmosphere, and modern atmosphere-rendering research are worth transferring into KAOPU as vendor-independent semantics and evaluation contracts, without importing engine code, engine parameter defaults, or renderer-specific approximations as truth?

## Source policy

Primary/current sources were preferred. No Chinese websites were used. External systems are method sources, not Observation Roots for the physical world.

Primary sources reviewed:

1. Epic Games, Unreal Engine 5.8 — Sky Atmosphere Component:
   https://dev.epicgames.com/documentation/unreal-engine/sky-atmosphere-component-in-unreal-engine
2. Epic Games, Unreal Engine 5.8 — Sky Atmosphere Component Properties:
   https://dev.epicgames.com/documentation/unreal-engine/sky-atmosphere-component-properties-in-unreal-engine
3. Epic Games, Unreal Engine 5.8 — Volumetric Cloud Component / Properties / Material:
   https://dev.epicgames.com/documentation/unreal-engine/volumetric-cloud-component-in-unreal-engine
   https://dev.epicgames.com/documentation/unreal-engine/volumetric-cloud-component-properties-in-unreal-engine
   https://dev.epicgames.com/documentation/unreal-engine/volumetric-cloud-material-in-unreal-engine
4. SideFX — Karma Sky Atmosphere:
   https://www.sidefx.com/docs/houdini/nodes/lop/karmaskyatmosphere.html
5. Sébastien Hillaire, EGSR 2020 — A Scalable and Production Ready Sky and Atmosphere Rendering Technique:
   https://diglib.eg.org/items/8a3e5350-18b3-46bd-9274-3add5af88c75
6. Eric Bruneton, 2017 — Precomputed Atmospheric Scattering: a New Implementation:
   https://ebruneton.github.io/precomputed_atmospheric_scattering/
7. Wilkie et al., SIGGRAPH 2021 — A Fitted Radiance and Attenuation Model for Realistic Atmospheres:
   https://cgg.mff.cuni.cz/publications/skymodel-2021/

Blender was deliberately not used as a primary reference in this cycle because the user has prioritized UE and Houdini for atmosphere. This is a research-priority choice, not a claim that Blender can never supply useful falsification evidence.

## Corrections before transfer

### C1 — Do not collapse atmospheric optics into “reflection/refraction”

The current UE and Karma atmosphere descriptions are organized around participating-media transport: Rayleigh scattering, aerosol/Mie scattering and absorption, additional absorbers such as ozone, transmittance/extinction, anisotropic phase behavior, multiple scattering, ground albedo coupling, and observer/light geometry.

Ground reflection matters through albedo and bounce contribution. Atmospheric refraction is a real phenomenon, but it is not a central mechanism exposed by these current UE/Karma atmosphere cores. Therefore refraction must not be promoted to the KAOPU atmosphere core merely because it is an optical phenomenon. It should enter only when a specific observable/process requires it, such as astronomical refraction or mirage-like refractive-index gradients.

### C2 — Shared engine structure is not independent scientific evidence

UE and Houdini agreeing on Rayleigh/Mie/ozone/planet geometry increases confidence that these are useful production interfaces, but the systems inherit common graphics and atmospheric-scattering literature. Their agreement is therefore method convergence, not two independent Observation Roots about reality.

### C3 — Renderer approximations are not atmosphere truth

UE 5.8 uses low-resolution LUTs for expensive atmosphere integrals and exposes quality/sample controls. Its Volumetric Cloud system uses ray marching plus real-time approximations to multiple scattering; higher approximation depth increases cost. Karma exposes march step sizes, a Multi Scatter Limit, and a transmittance LUT resolution. These are evaluator policies, not physical state.

## Candidate semantic decomposition

A vendor-independent KAOPU atmosphere should be decomposed into at least the following typed states rather than one “sky material” or one weather-prettiness control:

1. `PlanetFrameState`
   - planet center / reference frame
   - reference radius or sea-level surface
   - atmospheric vertical extent / valid domain
   - world-to-physical unit scale and datum identity

2. `RadiantEmitterState`
   - sun direction / astronomical time relation
   - emitter angular size
   - spectral or radiometric source state
   - additional emitter identities kept separate rather than a fixed “two-light” engine limit

3. `AtmosphericMediumState`
   - molecular density profile
   - aerosol density profile
   - molecular scattering coefficients
   - aerosol scattering and absorption coefficients
   - absorber layers such as ozone
   - phase/anisotropy parameters
   - all quantities typed with units and reference wavelength/color interpretation

4. `SurfaceCouplingState`
   - ground/surface albedo or more general reflected-radiance boundary condition
   - coupling is relevant to multiple scattering and to illumination of atmosphere/clouds
   - surface coupling must reference the actual surface/world state rather than duplicate it as atmosphere truth

5. `RadiativeTransportQuery`
   - transmittance along a path
   - in-scattered radiance
   - extinction / optical depth
   - single- and multiple-scattering contribution
   - view position, altitude, direction, path bounds, and time

6. `CloudMediumState` (separate but coupled)
   - cloud density/composition/phase state is not the same identity as clear-air atmosphere
   - cloud transport consumes atmospheric/emitter/ground state and can return shadowing/occlusion/lighting effects
   - visual noise used to shape cloud density is not itself evidence of fluid correctness

7. `AtmosphereEvaluatorPolicy`
   - ray march / LUT / fitted model / path trace / hybrid
   - step size, sample count, LUT resolution, multiple-scattering approximation order/limit
   - quality mode and target error budget
   - cache/bake provenance
   - this layer can change without changing atmosphere truth identity

8. `CameraDisplayPolicy`
   - exposure
   - sensor/display transfer
   - tone mapping / color transform
   - must remain downstream of physical radiance and never be silently folded into atmosphere coefficients

## Strong transferable ideas

### T1 — Ground-to-space continuity

UE 5.8 explicitly targets ground-to-space transitions with planetary curvature and aerial perspective. Karma is likewise a volumetric planetary atmosphere with explicit planet center, sea level, and unit scale. This supports a KAOPU rule: atmosphere must be addressable as a world-scale field in a planet frame, not as a local sky dome or background image.

### T2 — Observer path is first-class

Aerial perspective is not merely “fog color.” It depends on the radiative path from observer to scene point through the medium. The Wilkie et al. 2021 fitted model also highlights finite-distance in-scattering, attenuation, observer altitude, and downward-looking directions as important for realistic outdoor appearance. Therefore a view/path query should be first-class rather than reconstructed from a single sky color.

### T3 — Multiple scattering is physics; its numerical treatment is policy

UE, Karma, Hillaire 2020, and Bruneton all make multiple scattering important, but they evaluate or approximate it differently. KAOPU should store the semantic requirement to account for multiple scattering when needed, while keeping numerical method, scattering depth, LUT, and approximation settings in evaluator policy.

### T4 — Dynamic state must not require a new truth identity

Hillaire 2020 specifically targets dynamic time of day and dynamic atmosphere composition without heavy high-dimensional LUT rebuilds. This is a strong match to KAOPU: changing sun state, aerosol state, or weather-linked atmospheric state at time `t` should be a new time sample/evaluation of the same typed world system, not a new world identity.

### T5 — Dimensional correctness and reference tests should be gates

Bruneton’s 2017 reimplementation explicitly treats the lack of documentation/tests and Earth-only ad-hoc constants as defects, then adds dimensional-homogeneity checking, unit tests, configurable spectra/density profiles, and comparison against full spectral CPU reference rendering. This is highly transferable: a KAOPU atmosphere operator should not be promotable merely because it “looks right”; dimensional/unit checks plus locked reference queries should be first-class verification gates.

### T6 — Spectral/reference fidelity and realtime representation are different layers

Bruneton compares GPU approximations to full spectral CPU references. Wilkie et al. 2021 derives a fitted radiance/attenuation model from atmospheric measurement-informed scatterer distributions and adds altitude-resolved finite-distance attenuation/in-scattering and polarization. This suggests a KAOPU architecture with a high-fidelity/reference observation/evaluator path and one or more fast runtime representations, all mapped to the same semantic state but never conflated.

## Candidate gates before routing as reusable contract

1. Define units and dimensional types for every atmosphere quantity.
2. Build a tiny reference fixture with at least ground, high-altitude, horizon, sunset, and space-view queries.
3. Compare at least two evaluator families under the same AtmosphereState instead of comparing screenshots from different parameterizations.
4. Measure transmittance and in-scattered radiance error, not only image similarity.
5. Verify time-of-day changes without changing world/object identity.
6. Verify exposure/tone-map changes do not alter physical atmosphere state.
7. Keep cloud field, clear-air atmosphere, emitter state, and surface coupling as separate typed components.

## Current disposition

- `Candidate`: vendor-independent state/evaluator separation.
- `Candidate`: planet-frame + medium + emitter + surface-coupling + path-query decomposition.
- `Candidate`: multiple scattering semantic requirement separate from numerical approximation policy.
- `Candidate`: dimensional/unit/reference-test gate inspired by Bruneton.
- `Candidate`: high-fidelity reference evaluator versus runtime evaluator architecture.
- `Unknown`: exact minimum parameterization needed for Earth/weather use without overfitting engine interfaces.
- `Unknown`: whether RGB coefficient storage is sufficient for all KAOPU goals or whether a spectral reference layer is required.
- `Unknown`: quantitative error budgets for mobile/WebGPU, desktop, offline/reference, and simulation tasks.

No item in this log is Frozen. No production Mother should copy UE/Karma implementation defaults from this log.
