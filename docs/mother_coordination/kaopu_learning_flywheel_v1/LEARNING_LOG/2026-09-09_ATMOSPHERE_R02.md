# KAOPU Atmosphere Learning R02 — Ground-to-Space State Boundary

Date: 2026-09-09
Status: Candidate research note. No production Mother mutation. No Frozen promotion.

## Bounded question

What minimum vendor-independent atmosphere state should KAOPU preserve if the world must remain physically coherent from the surface through the upper atmosphere into space, while still allowing a very small realtime evaluator?

## Independent Observation Roots

### OR-NASA-LAYERS-2024 — physical boundary caution
NASA Science describes the exosphere as roughly 700–10,000 km and explicitly states that there is no clear physical boundary where atmosphere suddenly becomes outer space. The Kármán line near 100 km is a conventional transition marker, not a density discontinuity. NASA also reports that the hydrogen geocorona may extend far beyond the Moon.
Source: https://science.nasa.gov/earth/earth-atmosphere/earths-atmosphere-a-multi-layered-cake/

Disposition: Observation.

### OR-USSA-1976 — stable static regression reference
The U.S. Standard Atmosphere 1976, archived by NASA/NOAA, defines a static reference atmosphere to 1000 km and separates the lower-atmosphere model from the high-altitude model above ~85 km.
Source: https://ntrs.nasa.gov/archive/nasa/casi.ntrs.nasa.gov/19770009539.pdf

Disposition: Observation. Useful as a locked regression fixture; not current local/weather truth.

### OR-NRLMSIS-2.1 — current whole-atmosphere empirical state source
NASA CCMC currently hosts NRLMSIS 2.1. It accepts geodetic altitude 0–1000 km plus location, day/time, solar F10.7 indices and geomagnetic activity, and returns temperature plus neutral-species number densities (He, O, O2, N, N2, Ar, H, anomalous O, and NO in 2.1) and total mass density. NRLMSIS 2.0/2.1 explicitly transitions from a fully mixed lower region to diffusively separated species aloft.
Sources:
- https://ccmc.gsfc.nasa.gov/models/NRLMSIS~2.1/
- https://map.nrl.navy.mil/map/pub/nrl/NRLMSIS/NRLMSIS2.1/

Disposition: Observation.

### OR-HITRAN — wavelength-dependent molecular property source
HITRAN is a maintained molecular spectroscopic database used to predict atmospheric transmission and emission. It provides line parameters rather than a pre-baked RGB sky.
Source: https://hitran.org/

Disposition: Observation.

### OR-UE58 — realtime planetary evaluator boundary
UE 5.8 Sky Atmosphere is a physically motivated participating-media renderer with ground radius, atmosphere height, Rayleigh/Mie distributions, absorption, aerial perspective, and ground-to-space rendering. Its Atmosphere Height is explicitly a height above which the renderer stops evaluating atmospheric light interactions.
Source: https://dev.epicgames.com/documentation/unreal-engine/sky-atmosphere-component-in-unreal-engine

Disposition: Observation about an evaluator interface, not Earth truth.

## Primary correction from R01

A rendering-domain top boundary must not become the physical atmosphere boundary. UE's Atmosphere Height is a valid realtime evaluation cutoff. NASA's atmosphere description and NRLMSIS show that the real neutral atmosphere continues well above 100 km with continuously falling density and changing composition. Therefore KAOPU must represent model validity/domain separately from evaluator cutoff.

Candidate rule:

`physicalState.validityDomain != evaluator.integrationDomain != conventionalFlightBoundary`

The Kármán line can exist as metadata for aviation/spaceflight classification. It must never force atmospheric density to zero.

## Minimum AtmosphereState candidate

The smallest state that appears able to survive ground-to-space use without overfitting UE/Karma is not one set of Rayleigh/Mie RGB knobs. It is a layered contract:

1. `PlanetReferenceState`
   - body/reference ellipsoid or radius model
   - geodetic/geocentric transform
   - reference surface/geopotential convention
   - time

2. `NeutralAtmosphereState(x,t)`
   - temperature
   - total mass density
   - species number densities or an explicitly versioned composition model
   - model source and validity range
   - no assumption of fixed sea-level composition at all altitudes

3. `AerosolState(x,t)`
   - separate from molecular composition
   - size/optical-property representation sufficient for the active evaluator

4. `CloudMediumState(x,t)`
   - separate participating medium, coupled but not identical to clear-air atmosphere

5. `SpectralPropertyProvider(species,T,p,lambda)`
   - derives wavelength-dependent absorption/scattering/emission properties from physical state
   - can use line/cross-section databases or validated compressed approximations
   - RGB coefficients are evaluator caches/approximations, not canonical species truth

6. `RadiantEmitterState(t,lambda,direction)`
   - top-of-atmosphere solar spectral irradiance or another emitter spectrum
   - sun/body geometry

7. `SurfaceBoundaryState(x,t,lambda)`
   - spectral/typed albedo, BRDF/emissivity as needed

8. `UpperAtmosphereDriverState(t,location)`
   - solar/geomagnetic drivers such as F10.7 and Ap where the selected high-altitude state model requires them

9. `EvaluatorPolicy`
   - spectral bands/RGB compression
   - LUTs, integration cutoff, ray-march steps, multiple-scattering approximation, caching, quality mode
   - explicitly outside physical truth identity

10. Optional future `IonospherePlasmaState`
   - required for charged-particle/plasma/auroral/electrodynamic problems
   - must not be faked by extending a neutral-atmosphere renderer

## Spectral conclusion

"Full spectrum" should be interpreted as a reference-semantic capability to query wavelength-dependent transport over a declared wavelength domain, not as a requirement that every realtime Mother evaluates millions of spectral lines every frame.

NASA solar-irradiance material shows that spectral solar irradiance varies strongly with wavelength and that different atmospheric constituents absorb different bands. HITRAN demonstrates why molecular absorption is naturally line/spectrum based. Runtime RGB or a few bands may be valid only as a measured compression of a spectral reference for a specific task/error budget.

Candidate rule:

`SpectralReference -> validated task-specific compression -> realtime evaluator`

never

`RGB vendor defaults -> assumed physical spectrum`

## Executable contract probe

Added: `PROBES/atmosphere_reference_fixture.py`

The fixture is intentionally synthetic and is NOT Earth truth. It uses one explicit spherical exponential AtmosphereState and asks two evaluator families for identical queries:

- spherical numerical reference
- plane-parallel approximation

Queries include transmittance `T` and single-scattered radiance `L1`.

Executed local results:

| observer | view zenith | relative T error | relative L1 error |
|---|---:|---:|---:|
| 0 km | 0 deg | 0.000065% | 0.0081% |
| 0 km | 80 deg | 2.06% | 2.84% |
| 0 km | 89 deg | 96.10% | 8.01% |
| 80 km | 80 deg | 0.000069% | 2.96% |

Interpretation: the cheap plane-parallel evaluator is nearly identical for a vertical ground query in this toy state, but its transmittance becomes catastrophically wrong near the horizon because planetary curvature/path geometry matter. The same AtmosphereState can therefore support multiple evaluators, but evaluator validity must be attached to query geometry/error metrics.

This validates the architecture distinction; it does not validate any Earth coefficient set.

## Transferable methods

1. Separate `state validity domain` from `render/integration cutoff`.
2. Preserve species/thermodynamic state at reference level; derive optical coefficients through an explicit spectral-property model.
3. Separate lower-atmosphere mixed composition from upper-atmosphere diffusive separation; never extend a sea-level composition ratio to space by convenience.
4. Carry solar and geomagnetic drivers as state inputs when upper-atmosphere models depend on them.
5. Treat Kármán line as conventional metadata, not a physical discontinuity.
6. Every evaluator must publish a validity/error envelope by observer altitude, view geometry, wavelength domain, and active approximations.
7. Old authoritative models may remain excellent regression roots without being current truth. U.S. Standard Atmosphere 1976 is a canonical example.

## Constraints / failure modes

- A truly complete Earth-to-space physics stack cannot be built quickly by one ordinary implementation: neutral atmosphere, aerosols/clouds, chemistry, thermosphere, ionosphere/plasma, magnetosphere, spectral radiative transfer, solar variability, and surface coupling are different model classes.
- UE/Houdini are excellent rendering/evaluation teachers but are not sufficient physical truth sources for the thermosphere/exosphere.
- NRLMSIS is empirical neutral-atmosphere state, not a complete optical renderer, weather model, ionosphere model, or magnetosphere model.
- HITRAN provides spectroscopy, not atmospheric state or geometry.
- A hard 100 km atmosphere cutoff is useful for some realtime renderers but wrong as a universal world-state assumption.
- "Full spectrum" without a declared wavelength range, resolution, thermodynamic state, and error budget is underspecified.

## Status decisions

- `LQ-ATMOSPHERE-001`: remains Candidate-Partial. The minimum-state structure is materially clearer and the evaluator-separation gate now has executable evidence, but Earth spectral/reference fixtures have not yet been cross-validated.
- `U-ATMOS-001`: PartiallyResolved. Minimum structure now has stronger primary-source support; exact canonical schema and data-source hierarchy remain open.
- `U-ATMOS-002`: PartiallyResolved. Keep a spectral reference capability; do not require spectral realtime evaluation. The exact wavelength domains and compression error budgets remain Unknown.
- New Unknown: `U-ATMOS-004` — where neutral-atmosphere semantics end and ionosphere/plasma semantics begin for KAOPU queries.

## Next gate

Build one Earth reference profile fixture using two independent state roots:

- static U.S. Standard Atmosphere 1976 regression profile, and
- current NRLMSIS 2.1 profile for a fixed date/location/solar state,

then define a wavelength-limited optical fixture (visible + selected UV/IR checkpoints) whose spectroscopy source is explicit. Do not promote any vendor RGB defaults to physical truth.
