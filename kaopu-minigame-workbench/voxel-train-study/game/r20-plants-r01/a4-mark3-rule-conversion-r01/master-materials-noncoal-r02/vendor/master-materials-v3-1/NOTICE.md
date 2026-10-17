# Train master candidate v3.1: source-aware clearcoat instance policy

Independent candidate; v1/04, v2/05c, v3 and published pages are preserved. Exact source PBR conversion still covers all42 definitions. Optional master appearance coverage stays96 audited primitive uses across13 definitions: A4 75, Mark3 21. The22 paint uses remain18 Body and4 roof/top/accessory uses; the allowlist has not expanded.

## Finish decision and evidence

None of the42 source definitions declares material extensions or a clearcoat layer. The five selected paint definitions are dielectric (M=0), opaque, double-sided and have no baseColor texture. Source roughness values are A4 Roof_Black .3492759146, Body .022675304900000026, Body.001 .02300000000000002; Mark3 Roof_Black .8, Body.004 0. These values describe source appearance, not measured paint chemistry or proof of actual coat thickness.

The actual existing createTrainMatter(T).paint factory returns MeshPhysicalMaterial with clearcoat .84 and clearcoatRoughness .20. It exposes no public finish argument. V3.1 calls the same unchanged factory and copies full source Standard state, then sets ordinary instance properties: clearcoat=0 by default for every selected paint use. This explicitly removes the unsubstantiated second optical layer; it does not replace the mother paint algorithm or flatten source roughness. clearcoatRoughness=.20 is inactive when clearcoat=0.

An optional source.paintFinishOverrides Map/object can select one audited Body tuple (source:material:node:mesh:primitive), with clearcoat 0..1, optional clearcoatRoughness 0..1, and a required written reason. It is an unmeasured appearance candidate. There is no global override, no default Body coat, and Roof overrides are rejected. Source definitions are never changed.

All six original R08 executable factory files are byte-identical to their locked originals. The paint fragment callback is unchanged. Actual Three r170 program features do change: USE_CLEARCOAT is absent at default clearcoat=0 and present only for an explicit positive instance override. Do not claim identical final compiled shader or pixel equivalence. The existing vertex assignment wrapper still attaches the material domain to caller-captured rest matrices without modifying UVs or geometry.

The original analytic microheight coefficient .000020, RGB multiplier .94..1.03, roughness noise approximately ±.06 and final field clamp [.08,.99] remain active. R=0/about .023 therefore differs in the final micro-roughness field. Source envMapIntensity replaces factory .20. Domain scale is uncalibrated source-rest reference units; physical micrometre certification is not established. No oil, corrosion, leather or ageing is inferred.

Source linear color, metallic, roughness, map/UV/channel/transform/color-space/sampler objects, alpha and full Standard blend/depth/single-pass flags are retained. Actual five image-bearing source definitions remain source-exact and outside the candidate allowlist; synthetic texture transport tests do not expand that scope.

## Preserved modules and entry

V2 R06 source-surface parameterization remains unchanged: eight explicit guarded substitutions, coherent source diffuse/F0/metal/roughness, no zinc branch, weathering locked off. Original vendor bytes remain locked, but the executed metal field is a declared derived recipe. R03 finite glass is unchanged and retains its unverified source-thickness limit.

R06 release anchor: 7577ae37c8bc13bc3f7c0204c1857e83074c257a. R08 matter has the identical R03 audit snapshot plus separately locked executable dependencies. Three r170 is injected, SHA ce1fa418de16a19495a9f72495580e3015d7745c296d3ce0485897f902ddedfb; MIT license included. Original source rights remain their own.

Stable API: train-binding.mjs, installTrainMaster(T, source) -> switchMode('source-exact'|'master-upgrade'), records, materialRecords, dispose. Source-exact is default. Exact parser tuple associations, source-factor locks and caller-captured rest matrices remain mandatory. All original material references and geometry restore unchanged. Runtime-lock records the full local dependency closure. Native GLES compile/link and CPU/GLTF semantics passed; browser whole-train comparison and visual acceptance are separate and pending.
