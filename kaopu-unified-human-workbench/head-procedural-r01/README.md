# HEAD-PROCEDURAL-R01 — head surface reconstruction candidate

User request 2026-10-14: take one of our native people into an isolated test branch, reconstruct the observable skin appearance of https://lo-th.github.io/head/ with our own procedural surface functions, retain adjustable parameters, and defer expansion to the full body. A screenshot or copied model/texture is not delivery.

## Source isolation

Native person: HUMAN-INTEGRATED-R06 C3, source8d26fa8b45a0f5285f9ccf4fe53b255572912938, fixed buildf5017cb7cb9c2024df6a08328564c3f4ae502509, receipt68b26263c5c09ab0aa0782c48e895b23e59fb230. The immutable host HTML hash is checked before every build. Original person, control geometry, body, eyes, ET19 lip shape, earR06, native rig and parameters are not replaced. Changes are limited to this new directory and dedicated workflows. Keep Draft; no merge, force push or history rewriting.

Reference: lo-th/head@21462e471d53ba8c413a96989016510ca4495a34 (verified current main on2026-10-14). Its README identifies a Google GNM model, remapped textures, Three.js TSL/MeshSSSNodeMaterial and post-processing. Reading observable results and designing independent functions is not equivalent to recovering original layer/brush/scanner data. Neither reference model, surface maps, HDR, minified application nor texture-projection code is imported into this implementation. Existing native host resources and attribution remain as before; the inherited body and eyes still need their original assets.

## Actual method

Fresh physical head material: procedural anatomy-bound chroma, broad/mid/fine variation, blood and thin-eye-zone tint, oil-zone roughness, randomized shallow follicle bowls with weak rims, irregular fine vermilion lines, lip colour feather/wetness and bounded RGB direct-light wrap. Pore radius/spacing use explicit millimetres. Pixel-footprint filtering changes continuously; no fixed-distance mesh LOD or imported skin image. Triplanar height blending uses reference/rest coordinates and the same native deformations rather than world-space crawling noise.

The original vertex shader is retained for native deformation, while its fragment shader/skin-map logic is discarded for the head. The SAME single mesh uses non-overlapping material groups derived from the original triangle indices. Original canonical indices, topology and vertex attributes are not overwritten; the body and non-skin objects retain the old material. This is a surface-shading reconstruction, not a new identity mesh or a second overlapping head.

Fifteen visible controls, deterministic seed, six display channels, same-light original/new comparison, macro views and full-person versioned archives are provided. Old archives without the new field do not silently acquire the new skin. Invalid parameters are rejected before applying native restoration. Original specialist and shape controls remain in the retained platform.

## Practical limits and acceptance

These procedural fields are artist-authored reconstructions, not measured biological concentrations or recovered source pixels. The current RGB light wrap is not full volume transport or real ear/cartilage transmission. It does not reproduce the reference's complete lighting, depth of field, scan topology or every pore position. Native eyelid/nose/lip/ear shape defects can still dominate realism. Head/body boundary and extreme proportions/expressions require visual checks before generalization. No full-body skin expansion or universal photorealistic equivalence is claimed.

Original initialization/resource costs remain; new fragment arithmetic and one additional material group add cost. Exact driver LINK_STATUS, active fragment samplers against16, visible pixels, real controls, preservation, archives and fixed PUBLIC rendering must be checked. Software Chromium/SwiftShader is not consumer GPU speed or physical Windows/phone/Safari/VisionPro certification.390x844 is only a viewport.

## Delivery

A build alone is not completed delivery. Until DELIVERY.json and PUBLIC_QA.json show successful exact-public validation, **交付未完成**. Visual comparison against the reference remains user-pending even after functional checks succeed. No claim of complete texture/data equivalence should be inferred from a passing test count.

Relevant first-party source: https://github.com/lo-th/head/tree/21462e471d53ba8c413a96989016510ca4495a34 . Project constraints: one final person, independent proportion/pose/skin state, versioned complete archives, unchanged existing pages.
