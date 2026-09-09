# KAOPU Learning R09 — Real Weather column: conversion vs retarget and optical closure

Date: 2026-09-10
Status: Candidate-partial. No production Mother mutation.

## Bounded question

When one real radiosonde weather column is coupled to Terrain, Atmosphere and Lighting, which operations are true vertical-coordinate conversions, which operations actually move the weather state to a different place, and what minimum evidence is required before a thermodynamic profile may become cloud optical state?

This remains the highest-value unresolved sub-question of `LQ-ATMOSPHERE-001`. R08 established typed vertical coordinates, but its phrase “terrain-aware placement at two terrain elevations” can be misread as permission to rebase an already absolute pressure/geopotential profile by adding a new DEM height. That would silently change the physical state rather than merely convert its coordinate representation.

## Observation Roots kept distinct

### Observation Root A — NOAA/NCEI IGRA observation/archive semantics

NOAA/NCEI IGRA 2.2 describes radiosonde observations at standard and variable pressure levels and lists variables including pressure, temperature, geopotential height, relative humidity and dewpoint depression. Its station inventory identifies `USM00072572` as Salt Lake City/International at 40.7722, -111.9552 with station elevation 1289.0 m. The current NCEI `data-y2d` index listed `USM00072572-data-beg2026.txt.zip` when checked.

Primary sources:
- https://www.ncei.noaa.gov/products/weather-balloon/integrated-global-radiosonde-archive
- https://www.ncei.noaa.gov/data/integrated-global-radiosonde-archive/doc/igra2-station-list.txt
- https://www.ncei.noaa.gov/data/integrated-global-radiosonde-archive/access/data-y2d/

Constraint: the ZIP bytes could not be materialized in the bounded execution environment, so this cycle does not claim byte-level authentication of the executable sample against the NCEI archive file.

### Observation Root B — NOAA/NWS operational upper-air identity/coding

NWS documentation identifies WMO station `72572` as Salt Lake City, UT / KSLC. NWS upper-air transition documentation also identifies `72572 / KSLC` and points to WMO 306 for coded upper-air message requirements.

Primary sources:
- https://www.weather.gov/media/directives/010_pdfs/pd01010002curr.pdf
- https://www.weather.gov/media/notification/pdf2/scn21-98rrs_to_mros_upper_air_sites.pdf

### Observation Root C — ECMWF model/data quantity semantics

ERA5 model-level documentation archives specific humidity (`q`), specific cloud liquid water (`clwc`) and specific cloud ice water (`ciwc`) as separate quantities, alongside geopotential and surface-pressure information. This does not prove the state of the Salt Lake sounding; it independently demonstrates that a mature weather system does not identify humidity with cloud condensate.

Primary source:
- https://confluence.ecmwf.int/pages/viewpage.action?pageId=155332201

### Engineering/data transport source — UCAR RAP raw WMO relay

The executable fixture uses one Salt Lake City `72572` TTAA/TTBB message excerpt from UCAR RAP `Current.rawins`. It contains a real coded weather profile, but UCAR is treated only as a transport mirror in this cycle, not as an independent meteorological Observation Root. The short bulletin encodes day/time; exact month/year of that relay snapshot was not independently authenticated here.

Engineering source:
- https://weather.rap.ucar.edu/data/upper/Current.rawins

Locked excerpt and limitations are recorded in `references/weather-column-r09/SOURCE_LOCK.json`.

### Engineering Root D — Unreal Engine 5.8 volumetric-cloud evaluator semantics

UE 5.8 separates cloud-layer placement from tracing/sample controls and supports per-sample atmospheric-light transmittance. These are renderer/evaluator semantics, not cloud meteorological truth.

Primary vendor source:
- https://dev.epicgames.com/documentation/unreal-engine/volumetric-cloud-component-properties-in-unreal-engine

### Engineering Root E — SideFX Karma volume semantics

Karma Volume exposes absorption and scattering as rates per distance travelled in the medium. Karma render/material settings separately control sampling step and volume-ray limits. This is transferable evidence for separating optical-medium coefficients from evaluator budgets, not for deriving weather/cloud state.

Primary vendor sources:
- https://www.sidefx.com/docs/houdini/nodes/vop/kma_volume.html
- https://www.sidefx.com/docs/houdini/nodes/vop/kma_material_properties.html

## Core logical correction

There are two different operations that must never share one verb or adapter path:

1. **Coordinate conversion**: represent the same physical atmospheric parcel/layer in another vertical coordinate. Physical world placement is invariant. Example: derive AGL from a geopotential-height layer by subtracting a local surface height.
2. **Spatial retarget/rebase**: move a weather pattern to another horizontal location or terrain context while preserving some chosen relative property such as AGL. Physical world placement changes. This creates a derived synthetic scenario and needs new lineage.

Therefore, taking a source layer already located at an absolute/geopotential height and adding the target DEM elevation is not a coordinate conversion. It is a weather retarget. Calling it conversion is a category error.

## Transferable methods

1. Add an explicit `OperationKind` to vertical/weather adapters: at minimum `coordinate_conversion` versus `spatial_retarget`.
2. For `coordinate_conversion`, require a same-physical-state invariant: changing representation must not translate the absolute/geopotential/ellipsoid location of the underlying parcel.
3. For `spatial_retarget`, create a new derived identity such as `DerivedSyntheticRetarget` and retain the source state plus the retarget rule. Never overwrite the source Observation.
4. Preserve per-quantity capability. A weather column may be valid for pressure/geopotential/temperature placement while simultaneously being `Missing` for cloud fraction, condensate and optical extinction.
5. A radiosonde moisture diagnostic may be used to generate a `MoistLayerDiagnostic` or candidate cloud interval, but it is not an Observation of cloud fraction, cloud liquid/ice water or extinction unless those quantities are separately observed or modelled.
6. Split runtime data into at least:
   - `RuntimeCloudPlacement` — spatial/vertical geometry plus conversion lineage;
   - `CloudOpticalClosure` — extinction/scattering/albedo/phase or the source fields needed to derive them, with evidence lineage;
   - `EvaluatorBudget` — ray steps, bounce limits, temporal accumulation and similar renderer quality/performance settings.
7. Missing optical closure must remain typed `Missing/Unsupported`. Do not fill it with default humidity-to-density mappings merely because a renderer needs a density field.
8. Interpolating height at significant pressure levels is derived computation, not a new Observation. Record the anchor levels, interpolation law and valid segment.
9. A synthetic optical depth may be used to test transmittance wiring, monotonicity and state immutability, but it does not validate real cloud physics.
10. Geopotential/geoid-relative placement cannot be promoted to ellipsoid placement until geoid-separation/datum context is explicit.

## Executable evidence

Probe: `PROBES/weather_column_real_fixture_r09.py`

The bounded fixture embeds TTAA mandatory-height groups `85500`, `70146`, `50584` and a TTBB thermodynamic segment from the Salt Lake City `72572` relay packet. It uses the NOAA/NCEI station elevation of 1289.0 m as station-surface context.

The probe verifies seven invariants:

1. The bounded mandatory groups yield 850 hPa = 1500 m, 700 hPa = 3146 m and 500 hPa = 5840 m geopotential-height anchors.
2. A deliberately conservative engineering diagnostic, dewpoint depression <= 4 C, finds a moist interval from 596 to 541 hPa without promoting that interval to cloud Observation truth.
3. Log-pressure interpolation between the 700/500-hPa observed anchors derives a candidate interval of 4433.780 to 5208.990 m geopotential height.
4. At the 1289 m station surface, the same interval is 3144.780 to 3919.990 m AGL. Evaluating the *same physical column* against terrain 1000 m higher leaves absolute/geopotential placement unchanged and changes only its derived AGL to 2144.780 to 2919.990 m.
5. Preserving the source AGL over terrain 1000 m higher requires translating the interval to 5433.780 to 6208.990 m geopotential height. The probe labels this `spatial_retarget / DerivedSyntheticRetarget`, not coordinate conversion.
6. Cloud fraction, cloud liquid water, cloud ice water and extinction remain missing. Ellipsoid conversion is rejected when geoid-transform context is absent.
7. Evaluator-only synthetic optical depths 0.2, 1.2 and 2.0 produce monotonically decreasing transmittance 0.818731, 0.301194 and 0.135335, while leaving Weather state unchanged. These are wiring-test values only.

Result: `7/7 PASS`.

## State ledger

### Observation
- NOAA/NCEI IGRA is an observation archive containing pressure, temperature, geopotential height and humidity-related radiosonde quantities.
- NOAA/NCEI station inventory identifies `USM00072572` / Salt Lake City with station elevation 1289.0 m.
- NWS identifies WMO `72572` as Salt Lake City / KSLC.
- ECMWF archives humidity and cloud condensate as separate native model quantities.
- UE and Karma expose optical/render evaluator controls separately from meteorological data acquisition.

### Candidate
- `OperationKind.coordinate_conversion`.
- `OperationKind.spatial_retarget`.
- `DerivedSyntheticRetarget` lineage.
- `MoistLayerDiagnostic` distinct from `CloudObservation`.
- `RuntimeCloudPlacement` + `CloudOpticalClosure` + `EvaluatorBudget` as separate runtime contracts.
- Per-quantity `placementReady`, `opticalClosureReady`, and `rendererReady` capability states.
- Bounded log-pressure interpolation between observed geopotential-height anchors, with explicit approximation lineage.

### Current Best View
A Weather column should first preserve source-native identity and quantities. Coordinate adapters may change representation of the same physical state but may not move it. Moving a pattern to new terrain while preserving AGL is a separate synthetic retarget operation. Rendering readiness is also not one Boolean: vertical placement can be valid while optical cloud closure is Missing. Atmosphere/Lighting may consume a placement packet and optical packet independently, with renderer budgets remaining a third concern.

### Frozen
None.

### Rejected
- Adding target DEM elevation to every weather altitude/height as a generic “terrain-aware conversion”.
- Preserving AGL after moving an absolute/geopotential weather profile to new terrain while claiming it is still the same observed column.
- Treating relative humidity or dewpoint depression as cloud density, cloud fraction, liquid water, ice water or extinction without a separate closure/evidence step.
- Filling missing cloud optical state with renderer defaults and calling it Weather truth.
- Treating UCAR transport of an NWS-coded message as a second independent Observation Root.
- Treating synthetic Beer-Lambert optical-depth tests as validation of real cloud microphysics.
- Converting meteorological/geopotential height directly to ellipsoid height without geoid/datum context.

### Unknown
- Byte-level authentication of this exact TTAA/TTBB executable sample against the current NCEI station archive was not achieved in this bounded runtime.
- The exact month/year provenance of the short UCAR relay snapshot was not independently authenticated; day/time are encoded in the bulletin.
- The exact geoid realization/vertical datum needed to convert the station/weather height to canonical ellipsoid height.
- The first production-grade source of cloud fraction/condensate or optical closure for Weather Mother.
- Whether the first production fixture should use ERA5 model-level cloud variables, a higher-resolution NWP source, or radiosonde plus an independently observed cloud product.
- Quantitative error of the current Three.js/WebGPU cloud evaluator after consuming a physically grounded optical packet.
- The R01-R08 NRLMSIS/HITRAN physical-reference gate and two-evaluator runtime-atmosphere gate remain open.

## Routing

Route as Candidate only:

- Weather Mother: preserve the native profile; split conversion from synthetic retarget; expose per-quantity readiness and never map humidity directly to cloud density.
- Terrain/Landscape: surface height participates in AGL conversion; it does not automatically translate an already absolute weather profile.
- Atmosphere: accept placement and optical closure as separate packets; typed Missing optical state is valid.
- Lighting: consume optical-medium coefficients through evaluator queries; synthetic tau tests are allowed only as engineering probes.
- KAOPU semantic core: make operation kind, state identity, per-quantity capability and derivation lineage first-class.
- Ocean: the same conversion-versus-retarget distinction applies to sea-surface-relative weather layers near coasts.

No production Mother branch is modified by this cycle.

## Gate result and next gate

R09 **partially closes** the Weather-coupling gate: a real radiosonde-derived packet is sufficient to exercise pressure/geopotential placement, AGL diagnostics, terrain-context changes and the conversion-versus-retarget invariant. It does **not** close cloud optical physics, source byte-authentication or geoid-to-ellipsoid provenance.

Next Weather gate: obtain one authenticated source packet that includes or can be paired with cloud fraction/condensate (or another explicitly justified physical optical closure), preserve its native vertical coordinate, produce `RuntimeCloudPlacement + CloudOpticalClosure`, and feed both to at least two evaluator adapters while measuring numerical/visual/performance error separately. Physical-reference NRLMSIS/HITRAN and runtime-atmosphere dual-adapter gates remain independent.
