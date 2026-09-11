# Current Best View — Tiles footprint response R31 candidate

1. A footprint signal and a reconstruction/filter response are different contracts. GLSL derivatives can estimate projected variation; a custom gate still needs its own declared semantics and evidence.
2. The fixed Tiles R2 candidate uses screen-derivative footprint control and therefore already improves on unfiltered point evaluation in principle.
3. Its `grain` and `micro` height paths apply the same gate twice. This composes the response to approximately `gate²`; repeated application is not idempotent.
4. The bounded plane-wave fixture found 1.4216x aggregate transition RMSE for repeated versus single gating, but retained cases where repeated gating was closer. Thus “double gate is a bug” is Rejected; “the cumulative response is undocumented and materially consequential” is Current Best View.
5. Require one inspectable cumulative response per signal path, plus an actual fixed-camera WebGL A/B on the real field before production change.
6. Keep structure/height, derived normal, color, roughness, geometry/history and human acceptance separate.
7. Observation Roots: fixed Mother source, Khronos derivative specification, and Epic filter-width interface remain distinct. CPU probes are derived executable evidence, not physical Observation Roots.
8. Frozen R1 is unchanged. Production Tiles Mother was not modified.
