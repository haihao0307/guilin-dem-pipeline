# KAOPU Atmosphere Learning R03 — Evaluator Validity and Reference-State Separation

Status: Candidate learning note. No production Mother mutation. No Frozen promotion.

## Bounded question

Can one explicit AtmosphereState be queried by different evaluator families while keeping approximation error visible, and what does that imply for the simplest driveable ground-to-space atmosphere?

## New primary-source observations

1. NASA Science explicitly says there is no sharp physical boundary where the atmosphere ends; the exosphere is roughly 700–10,000 km and the Karman line near 100 km is a conventional transition marker.
   - https://science.nasa.gov/earth/earth-atmosphere/earths-atmosphere-a-multi-layered-cake/

2. The U.S. Standard Atmosphere 1976 is an old but still valuable locked reference model: NASA/NOAA document a static atmosphere to 1000 km, with separate lower- and high-altitude formulations. Its age is a reason not to treat it as current weather truth, not a reason to discard it as a regression root.
   - https://ntrs.nasa.gov/archive/nasa/casi.ntrs.nasa.gov/19770009539.pdf

3. Current NASA CCMC NRLMSIS 2.1 provides a whole-atmosphere empirical state family from 0–1000 km whose inputs include location, time, solar F10.7 and geomagnetic activity, and whose outputs include temperature, total mass density and neutral-species number densities. This demonstrates that high-altitude state cannot be inferred from altitude alone or from a fixed sea-level gas mixture.
   - https://ccmc.gsfc.nasa.gov/models/NRLMSIS~2.1/
   - https://map.nrl.navy.mil/map/pub/nrl/NRLMSIS/NRLMSIS2.1/

4. HITRAN remains a maintained spectroscopy source for molecular transmission/emission calculations. This supports wavelength-dependent reference semantics rather than storing vendor RGB coefficients as atmosphere truth.
   - https://hitran.org/

5. UE 5.8 `Atmosphere Height` is explicitly the height above which that evaluator stops atmospheric light-interaction evaluation. It is therefore an evaluator-domain cutoff, not a physical atmosphere boundary.
   - https://dev.epicgames.com/documentation/unreal-engine/sky-atmosphere-component-in-unreal-engine

## Executable probe

Added `PROBES/atmosphere_reference_fixture.py`.

The fixture is intentionally synthetic and is **not Earth truth**. It fixes one unit-explicit spherical exponential state and asks two evaluators for the same queries:

- spherical numerical reference;
- plane-parallel approximation.

Both evaluators compute transmittance `T` and single-scattered radiance `L1`.

Executed results:

| observer | view zenith | relative T error | relative L1 error |
|---|---:|---:|---:|
| 0 km | 0 deg | 0.000065% | 0.0081% |
| 0 km | 80 deg | 2.06% | 2.84% |
| 0 km | 89 deg | 96.10% | 8.01% |
| 80 km | 80 deg | 0.000069% | 2.96% |

The vertical ground query is essentially identical in this toy state. Near the horizon, the cheap plane-parallel evaluator becomes catastrophically wrong for transmittance because planetary curvature/path geometry dominate.

## Candidate conclusion

The simplest driveable architecture should not select one globally "correct" evaluator. It should preserve one state identity and attach an explicit validity envelope to each evaluator:

`AtmosphereState + Query -> EvaluatorPolicy(validDomain,errorBudget) -> Result`

Required validity fields should include at least:

- observer altitude/domain;
- view-path geometry / zenith range;
- wavelength or spectral-basis range;
- supported scattering order/approximation;
- physical-state source/version;
- numerical integration cutoff;
- measured error against a higher-fidelity reference fixture.

A fast evaluator is acceptable where its error is bounded. It must automatically lose authority when the query leaves that validity domain.

## Minimum reference-state refinement

R02's ground-to-space decomposition is retained. This round adds a stronger distinction among three boundaries:

`stateSource.validityDomain`

`evaluator.validityDomain`

`conventionalBoundary` (for example Karman-line metadata)

These three domains must never be aliased.

For upper atmosphere, the reference layer should preserve thermodynamic/species state or a versioned state-model query. Optical coefficients should be derived through a spectral-property provider. Runtime RGB/few-band packets remain allowed only as task-specific reduced products with provenance and measured error.

## Logical correction / practical constraint

A request for "complete physical atmosphere + complete spectrum from ground to space" is not a single renderer task. It spans neutral atmosphere, aerosols/clouds, chemistry, upper-atmosphere composition, spectral radiative transfer, and eventually ionosphere/plasma/space-weather physics. An ordinary implementation cannot realize all of that quickly without either faking regimes or silently dropping physics.

The workable architecture is therefore layered fidelity:

`Reference State/Evidence -> State Reducer -> Runtime Packet -> Evaluator`

The reducer is where complexity is compressed; the reference state is where physical meaning and provenance are preserved.

## Status

- `LQ-ATMOSPHERE-001`: remains Candidate-Partial.
- Evaluator/state separation now has executable evidence, not only literature support.
- `U-ATMOS-001`: move from Unknown to PartiallyResolved; exact canonical Earth schema remains open.
- `U-ATMOS-002`: move from Unknown to PartiallyResolved; spectral reference semantics are justified, but wavelength domains/compression error budgets remain open.
- Add `U-ATMOS-004`: neutral-atmosphere vs ionosphere/plasma semantic boundary remains Unknown.

## Next gate

Build a small Earth multi-altitude state fixture using two independent roots:

1. U.S. Standard Atmosphere 1976 as static regression reference;
2. NRLMSIS 2.1 as time/location/space-weather-dependent whole-atmosphere reference.

Then attach a wavelength-limited optical checkpoint set (visible plus selected UV/IR points) with explicit spectroscopy provenance. Do not use vendor RGB defaults as truth.
