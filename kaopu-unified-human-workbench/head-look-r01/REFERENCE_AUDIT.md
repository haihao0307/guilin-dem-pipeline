# HEAD LOOK R01 — reference audit and transfer boundary

Reference: lo-th/head@21462e471d53ba8c413a96989016510ca4495a34 (2026-10-06).
Retained host: HUMAN-INTEGRATED-R03@2c08fa9728f64e9119b4a666cf80ee3faecb23de.
This module keeps the host body, GNM-derived head, eye, ear R05, lip ET19-L3 and native animation. It does not import the reference head, textures, HDR or application bundle.

## Verified reference pipeline

The reference README identifies a GNM head with remapped textures and Three.js TSL/postprocessing. Its package.json pins Three.js 0.185.1 and declares MIT. That package declaration is not a separate provenance audit of every bundled mesh, image and environment. The authoring paint layers, brush history and complete original texture-production process were not supplied in the public files inspected.

The audited bundle is 1,291,578 bytes; SHA-256 723c4bb687c4445ba7f52521780971ec47907226ef2f22eccc9917faa9e629d7.

Five per-skin assets are assigned: `_c` to base colour, `_n` to normal, `_r` to roughness, `_s` to thicknessNode, and `_sss` to thicknessColorNode as well as sheenColorMap. `_c` and `_sss` are treated as sRGB; the data maps are not colour-encoded. The public renderer also loads a skin AO map. The lips are part of the shared skin/texture system, not a separate public procedural lip authoring module.

Do not overinterpret `_s`: the published Three.js fast SSS direct-light formula reads thicknessColorNode; assigning thicknessNode does not by itself prove that this texture modulates that SSS term. These assets are not established as measured tissue thickness.

Reference defaults include IOR 1.44, roughness 0.8, normal scale (0.4,-0.4), sheen 1, sheen roughness 0.8; SSS distortion 0.23, ambient 0.2, attenuation 0.4, power 2 and scale 0.6. Neutral tone mapping/exposure 1, photo HDR environment intensity 0.8 with 100-degree Y rotation, white key intensity 3, warm rim #efa37e intensity 3.5, shadows and focus/depth blur jointly affect the displayed result. It requests a device pixel ratio of at least 2, which is a material cost and sharpness difference from a DPR1 comparison.

## Transferred implementation

The retained host is Three.js r170/WebGL2, not the reference r185 TSL renderer. R01 independently composes the published fast-translucency equation with the existing physical skin shader and removes the previous face wrapping term in that region rather than stacking both at full strength. It is not a volumetric or measured BSSRDF solver.

Lighting uses a newly authored linear softbox environment prefiltered once, plus key and rear rim lights and Neutral output. It is an explicit approximation: it does not use photo.hdr, does not force DPR2, uses one key shadow rather than two shadowed lights, and omits focus blur so defects remain inspectable.

Surface channels reuse the host's already admitted detail/chroma atlases. Micro and meso height affect the normal; colour residual affects base colour; roughness remains an independent spatial field. Synthetic inherited pore strength is reduced while those atlas bands are active. No extra face mesh or reference bitmap is overlaid.

The same lip domain controls vermilion/skin feathering, retained upper/lower pigment models, dry outer-lip roughness and wet inner-band reflection. ET19 geometry, native expression, melanin/blood/oxygenation and upper/lower controls remain distinct from the new appearance recipe. The original expression-geometry deficiencies are not declared fixed.

## Provenance and source pointers

Reference code and README: https://github.com/lo-th/head/tree/21462e471d53ba8c413a96989016510ca4495a34

Three.js material documentation: https://threejs.org/docs/pages/MeshSSSNodeMaterial.html

Three.js implementation: https://github.com/mrdoob/three.js/blob/dev/src/materials/nodes/MeshSSSNodeMaterial.js

Credit: lo-th for the demonstrated lighting/material configuration; Three.js Authors for the public rendering implementation and documented fast-translucency material. Preserve the existing host/vendor MIT notices and asset provenance. The reference bundle and texture pixels are not included in this module.

## Acceptance boundaries

A working renderer, different framebuffer hashes, passing parameters and a valid archive are not evidence of photorealistic equivalence. Evaluate matched camera/pose views, macro lips, neutral/raking/back lighting and material channels. A first candidate is not user visual acceptance. See VISUAL_REVIEW.md for observed issues on the actual immutable public page.

The larger retained body/model downloads, half-million-triangle display surface, native idle basis baking, shader compilation and GPU memory are existing costs. Adding a web lighting recipe does not eliminate them. Real-phone, Safari, Vision Pro and consumer-GPU performance remain unverified until explicitly tested.
