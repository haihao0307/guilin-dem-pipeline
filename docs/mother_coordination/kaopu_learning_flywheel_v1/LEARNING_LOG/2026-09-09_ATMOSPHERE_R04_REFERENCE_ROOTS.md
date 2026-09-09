# KAOPU Atmosphere Learning R04 — Earth Reference Roots and Sample Identity

Status: Candidate learning note. No production Mother mutation. No Frozen promotion.

## Bounded question

Can the R03 atmosphere architecture be grounded in a small Earth fixture without collapsing independent sources into one invented "truth profile", and what metadata must survive when static standard-atmosphere data, driver-conditioned whole-atmosphere data, and spectroscopy are reduced for runtime use?

## Observation Roots kept independent

### Observation Root A — U.S. Standard Atmosphere 1976

Primary source:
- NASA/NOAA, *U.S. Standard Atmosphere, 1976*, NASA-TM-X-74335 / NOAA-S/T-76-1562.
- https://ntrs.nasa.gov/archive/nasa/casi.ntrs.nasa.gov/19770009539.pdf

Official documentation defines an idealized steady-state atmosphere to 1000 km. For the lower atmosphere it defines the reference constants and a segmented molecular-scale-temperature profile in geopotential height. The published 0–86 km layer bases are 0, 11, 20, 32, 47, 51, 71, and 84.852 geopotential km, with gradients -6.5, 0, +1.0, +2.8, 0, -2.8, and -2.0 K/km respectively. It also gives the hydrostatic pressure equations for non-isothermal and isothermal layers.

Transferable role: **static regression Observation Root**, not current weather truth.

R04 executable subset implements only those official lower-atmosphere defining constants/equations. It deliberately does not reimplement the more complicated 86–1000 km species model in this bounded cycle.

### Observation Root B — NRLMSIS 2.1 official specification

Primary sources:
- NASA CCMC NRLMSIS 2.1 model page: https://ccmc.gsfc.nasa.gov/models/NRLMSIS~2.1/
- NRL public package directory: https://map.nrl.navy.mil/map/pub/nrl/NRLMSIS/NRLMSIS2.1/

NASA CCMC currently documents geodetic altitude from 0–1000 km plus time, geodetic latitude/longitude, local solar time, 81-day F10.7, previous-day F10.7, and geomagnetic activity as model inputs. Outputs include neutral-species densities, total mass density, exospheric temperature, local temperature, anomalous O, and NO. NRLMSIS 2.0/2.1 also explicitly models the transition from a well-mixed lower atmosphere to species separation at high altitude.

Transferable role: **driver-conditioned whole-atmosphere Observation Root**. It must remain distinct from the static U.S. Standard Atmosphere root.

### Candidate executable transport — NRLMSIS 2.1 release test vectors

A public GitHub mirror of the NRL release package was used only to inspect the packaged Fortran interface and expected test vectors because the official NRL archive could not be materialized into this execution environment during the bounded cycle.

Mirror: https://github.com/jacobwilliams/NRLMSIS2.1

This mirror is **not an independent Observation Root**. Its numerical vectors remain Candidate evidence until an official NRL package execution or NASA CCMC run reproduces them.

The mirrored `GTD8D` header explicitly states legacy output units: species number densities in cm^-3, total mass density in g/cm^3, temperatures in K, and missing density sentinel 9.999e-38. The package README states that double precision test builds should exactly reproduce `msis2.1_test_ref_dp.txt` independent of compiler/settings.

Four packaged test cases at the same 500 km altitude but different location/time/solar/geomagnetic context produce local temperatures from 777.86 K to 1116.07 K and total mass density from 1.339e-16 to 1.034e-15 g/cm^3, a ~7.72x density range.

Status of that numerical observation: **Candidate**, because the transport path is a non-authoritative mirror even though it appears to preserve the release package.

What it tests architecturally is still valuable: **altitude is not a sufficient sample key**. A whole-atmosphere state sample must retain the source-required driver tuple.

### Observation Root C — HITRAN semantics

Primary sources:
- HITRAN definitions and units: https://hitran.org/docs/definitions-and-units/
- HAPI documentation: https://hitran.org/hapi/

HITRAN defines spectral-line vacuum wavenumber in cm^-1 and line intensity at the 296 K reference state in cm^-1/(molecule cm^-2). Its documentation expresses absorption coefficients as line intensity times a line-shape function, and optical depth as column number density times absorption coefficient. HITRAN also distinguishes pressure-broadening-dominated lower-atmosphere behavior from Doppler-dominated upper-atmosphere behavior and supports more advanced line-shape models than a single universal Voigt assumption.

Transferable role: **spectroscopy Observation Root / property-provider semantics**, not a runtime rendering implementation.

HAPI currently requires an API key for line-data download. No authenticated transition line was retrieved in this cycle. Therefore numerical HITRAN line checkpoints remain explicitly **Unknown**; no line parameters were invented.

## Executable probe

Added:

`PROBES/atmosphere_earth_reference_fixture_r04.py`

The exact probe content was executed locally before publication and all assertions passed.

The U.S. Standard Atmosphere subset reconstructs the official lower-atmosphere layer bases from the published constants/equations. Selected outputs include:

| H geopotential km | Z geometric km | T_M K | P Pa |
|---:|---:|---:|---:|
| 0 | 0.0000 | 288.150 | 101325.000 |
| 11 | 11.0191 | 216.650 | 22632.064 |
| 20 | 20.0631 | 216.650 | 5474.889 |
| 32 | 32.1619 | 228.650 | 868.019 |
| 47 | 47.3501 | 270.650 | 110.906 |
| 51 | 51.4125 | 270.650 | 66.939 |
| 71 | 71.8020 | 214.650 | 3.95642 |
| 84.852 | 86.0000 | 186.946 | 0.373384 |

The probe intentionally labels these as a static regression root, and labels the mirrored NRL release vectors separately as Candidate.

## Candidate conclusions

1. **Independent roots must not be numerically averaged into a synthetic canonical atmosphere.** U.S. Standard Atmosphere 1976 and NRLMSIS 2.1 answer different questions. One is a static standard/regression profile; the other is a context-driven empirical family. Agreement or disagreement is meaningful only after the query identity and validity domains are matched.

2. **Reference-sample identity is a typed key, not just an altitude.** At minimum it should preserve:
   - source/model + version;
   - coordinate kind (geometric/geopotential/geodetic) and units;
   - altitude;
   - time/date when required;
   - latitude/longitude when required;
   - solar/geomagnetic drivers when required;
   - species/thermodynamic quantities with units;
   - provenance and validity domain.

3. **A State Reducer may discard driver dimensions only by declaring an approximation.** If runtime Weather/Lighting wants an altitude-only packet, the reducer must state what time/location/solar/geomagnetic state was fixed, averaged, or ignored and attach the resulting error/Unknown contract. Dropping those fields silently changes the meaning of the state.

4. **Spectral checkpoints need evaluator metadata as well as line data.** A useful optical checkpoint must bind spectral coordinate convention, molecule/isotopologue, line-list provenance, temperature, pressure, line-shape model, column/path state, and units. A line intensity by itself is not a complete transport query.

5. **Executable evidence transported through a mirror does not become a new Observation Root.** It can be a Candidate reproducibility vector, but official-source execution or an authoritative hosted run is required for promotion.

## Logical correction / practical constraint

The R03 next gate originally asked for one fixture spanning ground, stratosphere, mesosphere, ~100 km, thermosphere, exosphere, plus spectroscopy. That wording risks implying that all layers should be sampled from one homogeneous source. That would be a category error.

The better fixture is a **multi-root reference suite**:

`USSA1976 static regression root`

`NRLMSIS2.1 driver-conditioned state root`

`HITRAN spectroscopy/property root`

Each sample keeps its own identity and validity domain; a later reducer may produce a common runtime packet without erasing those distinctions.

An ordinary implementation cannot make this fully authoritative in one short cycle because:
- the official NRL archive must be executed or an authoritative CCMC result captured for numerical promotion;
- HITRAN line retrieval requires authenticated data access;
- the U.S. Standard Atmosphere 86–1000 km species formulation is substantially more complex than its lower-atmosphere hydrostatic layers;
- any optical comparison across roots needs a defined wavelength/line subset and error metric rather than visual agreement.

## Status ledger

- Observation: official USSA 1976 constants, lower-atmosphere layer structure, hydrostatic equations, and static 0–1000 km role.
- Observation: official NASA CCMC NRLMSIS 2.1 driver/state interface and 0–1000 km domain.
- Observation: official HITRAN spectral-coordinate/unit and absorption/line-shape semantics.
- Candidate: executable NRLMSIS release vectors transported through a non-authoritative mirror.
- Current Best View: independent reference roots remain distinct; sample identity includes all source-required driver dimensions; reducers must declare dimensional/context loss.
- Frozen: none added.
- Rejected: "average USSA + NRLMSIS into one canonical profile"; "use altitude alone as whole-atmosphere sample identity"; "invent HITRAN line checkpoints without authenticated provenance".
- Unknown: official execution confirmation of selected NRL vectors; authenticated numerical HITRAN checkpoints; the exact smallest Earth reference schema across 86–1000 km.

## Routing recommendation

Weather:
- preserve source/version/coordinate/time/location/driver identity upstream of any runtime atmosphere packet;
- do not treat a static standard atmosphere as live weather truth.

Lighting:
- require spectroscopy provenance and line-shape/thermodynamic/path metadata for optical reference checkpoints;
- RGB/few-band packets remain reducers/evaluator products, not the reference spectral identity.

Future-Space:
- use NRLMSIS-style driver-conditioned neutral state for high-altitude neutral atmosphere; do not extrapolate a fixed sea-level mixture.

KAOPU semantic core:
- make `ReferenceSampleKey` first-class;
- preserve independent Observation Root IDs through reduction;
- prohibit silent driver-dimension deletion.

No production Mother branch was modified.

## Next gate

1. Execute the selected NRLMSIS 2.1 cases from the official NRL package or NASA CCMC and compare byte/number-level outputs with the Candidate mirror vectors.
2. Retrieve a very small authenticated HITRAN line subset and create two or three optical checkpoints with explicit molecule/isotopologue, line release/query provenance, T/P, line-shape model, column/path, units, and tolerances.
3. Only then consider LQ-ATMOSPHERE-001 `candidate-complete`; Frozen promotion remains a separate Judgment event.
