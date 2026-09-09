# KAOPU Atmosphere Learning R02 — Ground to Space

Status: Candidate learning note. Not formal KAOPU R2. No production Mother mutation.

## Problem

The active question is no longer only how UE 5.8 or Karma renders a convincing sky. The new question is: what vendor-independent physical state and evaluator separation would let KAOPU describe one continuous environment from the ground through the ozone-bearing stratosphere, mesosphere, thermosphere, exosphere, and into the space-weather transition without treating a renderer cutoff or the Karman line as physical truth?

## Primary-source observations

1. Current UE 5.8 Sky Atmosphere is a physically-based planetary rendering system supporting ground-to-space transitions, planetary curvature, Rayleigh/Mie scattering, absorbers, aerial perspective, and low-resolution LUT evaluators. Its `Atmospheric Height` is the height above which UE stops evaluating atmospheric light interaction. That is an evaluator/model-domain choice, not evidence that the real atmosphere ends there.
   - https://dev.epicgames.com/documentation/unreal-engine/sky-atmosphere-component-in-unreal-engine

2. Current SideFX Karma Sky Atmosphere exposes planet/sea-level framing, molecular and aerosol scattering, aerosol absorption, phase anisotropy, ozone absorption distribution, ground albedo, multi-scatter depth, step size, and LUT resolution. This is strong evidence for useful production-facing decomposition, but its RGB rendering coefficients and ray limits remain renderer semantics rather than universal atmospheric truth.
   - https://www.sidefx.com/docs/houdini/nodes/lop/karmaskyatmosphere.html

3. NASA describes the major atmospheric layers as troposphere (~0–12 km), stratosphere (~12–50 km), mesosphere (~50–80 km), thermosphere (~80–700 km), and exosphere (~700–10,000 km). NASA explicitly states that there is no sharp physical boundary where atmosphere becomes space. The Karman line at 100 km is a conventional transition marker; the geocorona can extend far beyond it.
   - https://science.nasa.gov/earth/earth-atmosphere/earths-atmosphere-a-multi-layered-cake/

4. NASA CCMC NRLMSIS 2.0/2.1 provides a current whole-atmosphere empirical reference family. NRLMSIS 2.0 extends from the ground to the exobase and returns temperature, mass density, and multiple neutral-species number densities as functions of location, time, solar activity, and geomagnetic activity. It transitions from well-mixed lower-atmosphere behavior toward diffusive species separation aloft. NRLMSIS 2.1 adds nitric oxide.
   - https://ccmc.gsfc.nasa.gov/models/NRLMSIS~2.0/
   - https://ccmc.gsfc.nasa.gov/models/NRLMSIS~2.1/

5. Above roughly the mesopause, a clear-sky Rayleigh/Mie renderer is not a complete physical atmosphere model. Current NASA CCMC physics models such as TIE-GCM and GITM include time-dependent thermosphere/ionosphere composition, temperatures, winds, ion/electron species, energy and momentum equations, and solar/geomagnetic forcing. These are reference/validation systems, not proposed runtime dependencies.
   - https://ccmc.gsfc.nasa.gov/models/TIE-GCM~2.0/
   - https://ccmc.gsfc.nasa.gov/models/GITM~2.0/

6. A "complete spectrum" cannot be represented honestly by three RGB coefficients at the reference level. HITRAN is a current NASA-supported molecular spectroscopic database used by radiative-transfer codes to predict atmospheric transmission and emission from molecular transition parameters. This supports a Candidate separation between a wavelength-resolved reference semantics layer and lower-cost runtime spectral bases/RGB evaluators.
   - https://hitran.org/
   - https://hitran.org/about/

## Candidate transferable semantics

A future KAOPU atmosphere should not store "UE Sky Atmosphere parameters". It should preserve typed physical state and allow multiple evaluators.

Candidate decomposition:

1. `PlanetFrame`
   - reference surface/radius or geoid relation
   - gravity/reference potential as needed by the chosen physical model
   - altitude coordinate definition and units

2. `NeutralAtmosphereState`
   - temperature field/profile
   - pressure or mass density where observed/modelled
   - species number-density or mixing-ratio profiles with provenance
   - winds when required by the task

3. `AerosolState`
   - aerosol concentration/optical-depth representation
   - size/phase behavior or an explicitly fitted optical surrogate
   - humidity/environment dependence when required

4. `AbsorberAndSpectralState`
   - wavelength-resolved or spectral-basis absorption/scattering semantics
   - O3 is not the only possible absorber
   - exact spectral data/provenance remains separable from an RGB runtime approximation

5. `RadiantEmitterState`
   - Sun/other source direction and distance
   - spectral irradiance/radiance reference where required
   - time dependence

6. `SurfaceBoundaryState`
   - spectral/typed albedo or reflectance where required
   - emission/thermal coupling when the task extends beyond visible rendering

7. `UpperAtmosphereState`
   - neutral species separation
   - ion/electron state when relevant
   - solar and geomagnetic drivers
   - space-weather-dependent variability

8. `RadiativeTransportQuery`
   - observer position/altitude
   - view direction and path endpoints
   - requested wavelength range or spectral basis
   - outputs such as transmittance, in-scattered radiance, extinction/optical depth

9. `EvaluatorPolicy`
   - line-by-line / spectral reference / fitted spectral basis / RGB approximation
   - LUT/ray march/path tracing/analytic approximation
   - sample budget, step policy, multiple-scatter approximation, cache provenance

10. `CameraDisplayPolicy`
    - exposure, sensor response, tone mapping, display transform
    - never mutates atmosphere truth/state

## Important corrections

- Do not treat the Karman line as a density discontinuity or the end of atmosphere truth.
- Do not equate UE `Atmospheric Height` with a real physical boundary.
- Do not force the whole 0–10,000 km atmosphere into one numerical method. Continuous semantic identity can coexist with regime-specific evaluators.
- Do not call an RGB renderer "complete spectrum". RGB can be an evaluator output or compressed basis, while a higher-fidelity spectral reference remains available where the task demands it.
- Do not assume that lower-atmosphere Rayleigh/Mie/ozone rendering is sufficient for thermosphere, ionosphere, aurora, satellite drag, or solar-wind coupling.

## Candidate simplest-drive architecture

The simplest useful runtime should be a two-level system rather than a single giant simulator:

`Reference Atmosphere State / Evidence`
→ task-dependent `State Reducer`
→ `Runtime Atmosphere Packet`
→ selected `Evaluator`

The reducer may collapse a rich reference state to the minimal coefficients/basis needed for a specific renderer or simulation, but must retain provenance, validity range, altitude/time domain, and an error/unknown contract.

## Current status

Candidate only. The decomposition is stronger than R01 because it now separates lower-atmosphere rendering from whole-atmosphere state and treats the 100 km Karman line as a conventional policy marker rather than truth topology.

## Next gate

Build a tiny unit-typed reference fixture at several altitudes (ground, stratosphere, mesosphere, ~100 km, low thermosphere, and exosphere reference points), with explicit provenance and Unknown fields. Compare:

1. a lower-atmosphere radiative evaluator for transmittance/in-scattered radiance;
2. a whole-atmosphere empirical state query (NRLMSIS family) for density/composition/temperature;
3. one spectral absorption reference path using HITRAN-derived data or a locked published subset.

The gate is not visual beauty. The gate is that all evaluators agree on coordinate/unit identity, state provenance, valid domain, and which quantities they do or do not claim to model.