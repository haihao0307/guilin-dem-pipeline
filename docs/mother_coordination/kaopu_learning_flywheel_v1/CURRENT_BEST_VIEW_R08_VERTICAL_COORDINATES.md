# KAOPU Current Best View — R08 vertical-coordinate extension

Date: 2026-09-10
Status: Candidate extension to `CURRENT_BEST_VIEW.md`; no Frozen change.

55. A vertical coordinate is part of physical/evidence identity, not display metadata. `AGL`, pressure, hybrid model level, geopotential height, geoid-relative geometric height and ellipsoid/geodetic height are not aliases.
56. Weather-source native coordinates must survive reduction. A renderer-space cloud base/top is a derived `RuntimeCloudPlacement`, never a replacement for the source-native Weather state or a new Observation Root.
57. AGL conversion requires an explicit surface/terrain reference and datum. A cloud reported at 1000 m AGL is not globally located until the local surface height is known.
58. Hybrid sigma-pressure/model-level conversion is context-dependent. A level number cannot be converted to fixed metres without the source's A/B definition, surface pressure and additional thermodynamic/geopotential context required by the chosen reconstruction.
59. Geopotential height and geometric height are separate typed quantities. Any conversion between them must retain the reference surface, approximation and error/Unknown contract.
60. Weather, Atmosphere, Terrain and Lighting should meet at explicit adapters: `WeatherColumnState -> VerticalCoordinateAdapter -> RuntimeCloudPlacement`, while optical medium state is consumed by atmosphere/light evaluators independently of placement quality budgets.
61. Renderer cloud-shell parameters such as UE Layer Bottom/Height or Takram layer altitude are evaluator/runtime controls. Agreement between renderers is engineering convergence, not meteorological Observation evidence.
62. Local, spot, or laser-like lighting through cloud/fog is a participating-medium lighting query. Changing light intensity, ray-march budget, per-sample transmittance, shadow method or temporal accumulation must not mutate humidity, condensate, cloud fraction or other Weather truth.
63. Terrain/DEM supplies conversion context, not cloud truth. Weather-to-render conversion must carry datum lineage so a DEM/geoid/ellipsoid mismatch cannot silently shift cloud layers.
64. The correct failure mode for missing vertical-conversion context is typed `Unknown/Unsupported`, not a guessed absolute altitude or visual adjustment.

R08 source status:
- Observation roots remain distinct: ECMWF/OpenIFS model-coordinate semantics; ECMWF/ERA5 height semantics; NWS METAR AGL reporting; UE 5.8 renderer/evaluator semantics.
- Takram remains an engineering learning source, not an independent meteorological Observation Root.
- Executable semantic probe: `PROBES/weather_vertical_coordinate_contract_r08.py`, result 4/4 PASS.
- Frozen: none.
