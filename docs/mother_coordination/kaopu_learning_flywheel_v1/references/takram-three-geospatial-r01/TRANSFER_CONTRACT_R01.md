# Takram three-geospatial → KAOPU transferable contract R01

Status: Candidate learning artifact. Not production code. Not formal KAOPU R2.

Locked upstream: `takram-design-engineering/three-geospatial@b012ad06d858fc035d88aacfd73f092f93c994e4`.

## What is worth transferring

1. **Typed reference frames before rendering.** Keep world/local coordinates, ECEF, ECI, moon-fixed frames, reference surface and altitude convention explicit. Frame conversion is part of the query contract, not a cosmetic transform.
2. **Origin rebasing is evaluator precision policy.** A runtime may move/rotate the local world near the origin to protect floating-point precision, but this must not move the canonical world. A world→ECEF transform used for this purpose must be rigid: translation + rotation, no scale.
3. **Ellipsoid-to-spherical-atmosphere adaptation is an evaluator adapter, not new truth.** Takram projects the camera to the ellipsoid and computes an osculating-sphere correction before using a spherical atmosphere model. KAOPU should preserve the real reference surface separately from any spherical evaluator approximation.
4. **Atmosphere state, ephemeris state and evaluator state remain separate.** Sun/moon direction, ECI→ECEF transform, atmosphere medium state, camera state and LUT/raymarch policy are coupled at runtime but should not share one truth identity.
5. **Physical phenomenon ≠ numerical representation.** Bruneton-style 4D scattering LUT, Hillaire multiple-scattering LUT and camera-to-object raymarching are evaluator choices for scattering. Multiple scattering itself remains a physical transport semantic.
6. **Vendor defaults are not canonical.** Takram's Earth defaults (bottom/top radius, Rayleigh/Mie/absorption profiles, RGB coefficients, albedo, angular radius) are useful implementation fixtures only. They must not enter KAOPU as Earth truth without independent physical provenance and unit/error contracts.
7. **Quality presets change evaluator budget, not weather.** Cloud Low/Medium/High/Ultra modes change raymarch precision, detail, turbulence, light shafts and shadow resolution. KAOPU should preserve one CloudState while allowing multiple RuntimeEvaluatorBudget packets.
8. **Temporal reconstruction is a derived cache.** Temporal upscaling/filtering can drastically reduce cost, but ghosting, smearing and disocclusion are known failure modes. Reprojected history must never be mistaken for new physical evidence.
9. **Mean-depth cloud aerial perspective is an approximation.** Transmittance-weighted mean depth is useful but loses overlapping sparse-cloud depth structure. Any similar shortcut must carry an evaluator validity/error label.
10. **Cloud altitude reference is a semantic issue.** Upstream explicitly notes that constant layer altitude relative to an ellipsoid is physically inadequate. KAOPU should preserve cloud-base reference (ellipsoid/geopotential/terrain-relative/model-native) rather than hard-code one interpretation.
11. **Large-coordinate motion buffers need special care.** Computing model-view transforms on the CPU can avoid precision loss in ECEF-scale velocity calculation. This is a reusable renderer technique, not a world-state rule.
12. **Node/context architecture is a useful dependency-injection pattern, not a semantic standard.** Shared AtmosphereContext can ensure consistent runtime inputs across lighting, sky and aerial perspective, but the upstream WebGPU API is still changing and must not be frozen into KAOPU.

## Explicit non-transfer

- Do not copy the whole repository into any production Mother.
- Do not freeze Takram package APIs, shader layouts, LUT sizes, quality-preset numbers or Earth defaults as KAOPU semantics.
- Do not treat upstream visual success as evidence that a physical state is correct.
- Do not treat ECEF itself as KAOPU's canonical world address language; it remains an import/export/evaluator frame.
- Do not use cloud seam blending or temporal filtering as evidence of physical continuity.

## Candidate runtime split

`World/Atmosphere/Cloud/Ephemeris State` → `Frame Adapter + State Reducer` → `Runtime Packet` → `Atmosphere/Cloud/Lighting Evaluator` → `Camera/Display`.

Each arrow must retain source/version, units, reference frame, validity domain and approximation/error metadata.
