# KAOPU Learning R08 — Weather vertical-coordinate coupling contract

Date: 2026-09-10
Status: Candidate. No production Mother mutation.

## Bounded question

What vertical-coordinate contract should KAOPU use when Weather Mother cloud state is coupled to Atmosphere, Lighting, Terrain and realtime renderers, so that AGL, geopotential/geoid height, ellipsoid/geometric height, pressure/model levels and renderer cloud-shell altitude are not silently treated as the same quantity?

This is the highest-value unresolved sub-question of `LQ-ATMOSPHERE-001` because R07 already identified cloud vertical reference as Unknown and the user requested that the learned atmosphere/cloud architecture be combined with Weather.

## Observation Roots kept distinct

### Observation Root A — ECMWF/OpenIFS model-coordinate semantics
Primary ECMWF OpenIFS documentation states that IFS uses a hybrid sigma-pressure vertical coordinate. Near the surface, sigma levels follow topography; higher levels transition toward pressure levels. Full-level pressure depends on interface coefficients A/B and surface pressure. Model level therefore is not a fixed geometric altitude.

Source:
- https://confluence.ecmwf.int/spaces/OIFS/pages/431064381/4+Vertical+Resolution+and+Configurations
- page updated 2024-07-01; checked 2026-09-10.

### Observation Root B — ECMWF/ERA5 height semantics
Primary ECMWF/Copernicus documentation distinguishes geopotential height from geometric height. ERA5/IFS commonly represents height through geopotential/geopotential height relative to the geoid, while geometric height is a derived approximation. The documented relation is `alt = Re * h / (Re - h)` under a spherical/constant-gravity approximation.

Source:
- https://confluence.ecmwf.int/spaces/CKB/pages/158636068/ERA5+compute+pressure+and+geopotential+on+model+levels+geopotential+height+and+geometric+height
- page last modified 2024-10-08; checked 2026-09-10.

### Observation Root C — NWS operational cloud-base reporting
The U.S. National Weather Service METAR explanation states that cloud-layer bases such as BKN022 and OVC050 are heights Above Ground Level (AGL). This is an observational/reporting coordinate convention, not a model-level or ellipsoid-height convention.

Source:
- https://www.weather.gov/asos/METAR.html
- checked 2026-09-10.

### Observation Root D — Unreal Engine 5.8 renderer/evaluator semantics
Epic's UE 5.8 Volumetric Cloud documentation exposes `Layer Bottom`/`Layer Height` in kilometres above ground and separates renderer quality/tracing controls from cloud placement. The component also exposes optional per-sample atmospheric-light transmittance. Epic's environment-lighting documentation describes Sky Atmosphere, Volumetric Clouds, Directional Lights and Sky Light as coupled rendering components.

Sources:
- https://dev.epicgames.com/documentation/unreal-engine/volumetric-cloud-component-properties-in-unreal-engine
- https://dev.epicgames.com/documentation/unreal-engine/environmental-light-with-fog-clouds-sky-and-atmosphere-in-unreal-engine
- UE 5.8 docs checked 2026-09-10.

### Engineering source — Takram three-geospatial R07
The previously locked Takram source shows an ellipsoid/spherical-atmosphere adapter and documents that its current cloud layer altitude model is an engineering approximation. It remains an engineering learning source, not an independent meteorological Observation Root.

## Transferable methods

1. Preserve the **native vertical coordinate** of every weather source. A model-level index, pressure, geopotential, geopotential height, AGL report and geometric/ellipsoid altitude are different typed quantities.
2. Introduce a first-class `VerticalCoordinateContract` with at least:
   - coordinate kind;
   - units and positive direction;
   - reference surface/datum;
   - source/model/version;
   - horizontal location and time needed by conversion;
   - surface pressure / A-B coefficients / profile dependencies where model levels are involved;
   - terrain/geoid/ellipsoid dependency where AGL or world placement is involved;
   - conversion method, approximation and error/Unknown contract.
3. Introduce a `VerticalCoordinateAdapter` below Weather truth. It may derive renderer-space placement, but the derived result is a runtime packet/cache with lineage, not a new Observation Root.
4. `CloudState` should not be reduced to one `altitude` scalar. Source-native vertical state and diagnostics remain separate from a renderer's cloud-shell base/top.
5. AGL is a **surface-relative diagnostic/observation coordinate**. It cannot be converted to world/geoid/ellipsoid height without a terrain/surface reference.
6. Hybrid model level is **context-dependent**. It cannot be converted to height by a static lookup alone because pressure depends on surface pressure and the A/B definition; full geometric placement additionally depends on thermodynamic/geopotential reconstruction.
7. Geopotential height and geometric height must remain distinct. A conversion is an explicit approximation with its own reference surface and assumptions.
8. Lighting is coupled through participating-medium queries. Local/spot/laser-like lights may query cloud/fog extinction/scattering and atmospheric transmittance, but changing a lighting evaluator must not mutate humidity, cloud condensate, coverage or other Weather truth.

## Executable evidence

`PROBES/weather_vertical_coordinate_contract_r08.py` was run before publication.

The probe is intentionally semantic, not meteorological truth. It verifies:
- same 1000 m AGL cloud base over 0 m and 1500 m terrain produces different absolute placement;
- a naive fixed 1000 m absolute shell over 1500 m terrain yields -500 m AGL and is therefore semantically invalid;
- geopotential and geometric heights are distinct under the documented spherical conversion form;
- direct hybrid-model-level-to-height conversion is rejected when required context is absent.

Result: `4/4 PASS`.

With a test-only spherical radius of 6,371,000 m, the probe yields:
- 10,000 m geopotential height -> 10,015.721 m geometric height;
- 20,000 m geopotential height -> 20,062.982 m geometric height.

Those numbers are executable demonstration values only; the test radius is not promoted as KAOPU Earth truth.

## State ledger

### Observation
- IFS hybrid sigma-pressure levels depend on surface pressure and follow terrain near the surface.
- ERA5 distinguishes geopotential/geopotential height relative to geoid from geometric height.
- NWS METAR cloud bases are operationally reported AGL.
- UE 5.8 exposes cloud-layer placement separately from ray-march/lighting evaluator controls and supports per-sample atmospheric-light transmittance.

### Candidate
- `VerticalCoordinateContract`.
- `VerticalCoordinateAdapter`.
- `WeatherColumnState.nativeVerticalCoordinate`.
- `CloudDiagnosticAGL` distinct from source-native column coordinates.
- `RuntimeCloudPlacement` as derived evaluator packet with lineage.
- `LightingMediumQuery` that consumes atmosphere/cloud optical state without mutating Weather truth.

### Current Best View
Weather Mother should preserve source-native vertical coordinates and diagnostics. Terrain/Geoid/Ellipsoid/ReferenceFrame services supply explicit conversion context. Renderers consume derived runtime placement packets. Atmosphere and Lighting consume the same physical medium state through their own evaluator contracts. No renderer cloud-shell altitude is allowed to overwrite Weather truth.

### Frozen
None.

### Rejected
- One universal `cloudAltitude` scalar for Weather + renderer + observations.
- Treating model-level number as fixed metres.
- Treating AGL as ellipsoid or MSL height without surface context.
- Treating UE/Takram renderer placement as meteorological truth.
- Moving clouds to make lighting look right without recording that as an evaluator/art-direction operation.
- Letting local/laser-like light intensity modify cloud density or humidity state.

### Unknown
- Which real weather-data source and native vertical coordinate will be the first production Weather Mother integration fixture.
- Which geoid model/datum will be canonical for each Earth-region pipeline.
- The exact terrain-versus-planet-surface interpretation of UE's phrase "above ground" is not sufficiently specified by the public property page for KAOPU truth use.
- Quantitative error budget for converting a chosen weather source into the current Three.js/WebGPU cloud renderer.
- How precipitation shafts, fog and cloud overlap should share vertical-coordinate conversion without double counting condensate/extinction.

## Routing

Route as Candidate only:
- Weather Mother: native vertical coordinate + diagnostic + derived render placement separation.
- Terrain/Landscape: provide terrain surface height and datum as conversion input, never overwrite weather source heights.
- Atmosphere: consume vertical state through explicit reference-frame/height adapters.
- Lighting: query optical medium and transmittance; local/laser-like light response stays in evaluator layer.
- Ocean: sea-surface height may be an AGL/ASL conversion input near coast, but ocean rendering does not become the weather vertical datum.
- KAOPU semantic core: make vertical coordinate/datum/conversion lineage first-class.

Production mutation remains prohibited in this coordination cycle.

## Next gate

Use one real weather-column sample in its native vertical coordinate and one terrain location with explicit datum. Produce a `RuntimeCloudPlacement` for at least two terrain elevations and compare:
1. source-native invariants;
2. AGL/geoid/ellipsoid conversion lineage;
3. renderer placement;
4. atmosphere transmittance/light response.
No promotion to Candidate-complete until this real-data fixture closes alongside the existing NRLMSIS/HITRAN and evaluator-adapter gates.
