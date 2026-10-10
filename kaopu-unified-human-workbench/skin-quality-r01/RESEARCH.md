# Native skin quality: primary-source study and implementation boundary

Research date: 2026-10-10. This is an engineering plan for the user's existing KAOPU character, not a claim that a finite update can make every image flawless.

## The actual host, not a hypothetical renderer

Production R06 uses `common-skin-foundation/r1`, procedural rest-space detail and the original GGX physical material. ET13's separate fixed preview composes that host with ET12 FaceSkin (licensed regional frequency samples, face-specific microheight/roughness/color and RGB light wrapping), FaceDiffusion (25-tap RGB separable diffusion), and ET13 IdentitySkin (the user's freckles/acne/wrinkles/scar/mole fields). These are different versions. The new facial parameters must remain authoritative; a replacement head, a generated photo, or an unrelated demo would not improve this system.

## What the primary references actually establish

1. Unity Digital Human / The Heretic / Enemies provides inspectable skin/eye shader graphs, skin attachment, skin tension and wrinkle-map facilities. Its new skin shader requires Unity/HDRP; the repository license is Unity Companion for Unity-dependent projects. Public source access does not make it permissively reusable in an unrelated WebGL runtime. Study the separation between base tissue, surface detail, tension and attachments, and author the WebGL implementation independently. No Unity code/assets are copied here.
   - https://github.com/Unity-Technologies/com.unity.demoteam.digital-human
   - https://github.com/Unity-Technologies/com.unity.demoteam.digital-human/blob/master/LICENSE.md
   - Code inspection: `ShaderLibrary/Nodes_Skin/SkinTensionSampleWeight.hlsl` reads a validated per-vertex tension buffer; `SkinDeformationBlend.hlsl` blends captured albedo frames. These are separate data-backed mechanisms, not evidence that random noise or static identity wrinkles already simulate skin tension.

2. USC ICT Digital Emily 2 separates diffuse, specular, single scatter, displacement and microgeometry, and supplies polarized reference categories. That separation is a useful validation discipline: verify color without illumination baked into it, specular response independently, and shallow detail at a physical scale. The page explicitly restricts its reference image's commercial use and redistribution. It does not establish a blanket permissive license for every linked dataset; none of the Emily model, textures or images is copied or republished here.
   - https://vgl.ict.usc.edu/Data/DigitalEmily2/

3. Disney's 2023 skin micro-wrinkle research connects sampled pore nodes into a graph, optimizes wrinkle edges, and turns that structure into displacement. This supports treating pores and fine wrinkles as structured multi-scale geometry rather than simply stronger noise. The publication is a method reference, not an open-source implementation license. The project has not implemented its optimization algorithm.
   - https://studios.disneyresearch.com/2023/07/03/graph-based-synthesis-for-skin-micro-wrinkles/

4. Jimenez/Gutierrez Separable SSS explicitly distinguishes thin-slab transmittance from its two-pass reflectance blur. The host preserves the licensed RGB blur kernel, but it has not implemented actual light-space thickness/transmittance. Therefore a blur slider cannot be presented as true ear/nose transmission. Future work should first establish reliable anatomical thin-region and thickness data, shadow/light direction tests, and energy behavior.
   - https://github.com/iryoku/separable-sss/blob/master/SeparableSSS.h
   - Existing notice: `../face-transfer/THIRD_PARTY.txt`

5. Khronos GLSL ES 3.00 specifies that implicit texture derivatives and derivative functions are undefined in nonuniform control flow. `textureGrad` accepts explicit gradients; array textures select a layer rather than filtering between facial tiles. This directly supports the first small code improvement, which is testable without changing the person's identity or artistic settings.
   - https://registry.khronos.org/OpenGL/specs/es/3.0/GLSL_ES_Specification_3.00.pdf (sections 8.8 and 8.9)
   - https://threejs.org/docs/#api/en/textures/DataArrayTexture

6. Pixar's photorealistic-head tutorial, authored by Leif Pedersen and reviewed/annotated by Christophe Hery, uses separate fine bump/displacement, subsurface scattering, two specular lobes and restrained fuzz. It explicitly evaluates specular under different lighting and discusses high-bit-depth data and scene scale. This is why the next work should address light transport and region-specific surface response rather than increase contrast globally. The tutorial confirms the Infinite/Lee Perry-Smith head's CC BY 3.0 attribution, supporting the host's existing atlas provenance; no additional model is imported.
   - https://renderman.pixar.com/photorealistic-head

## Ordered quality checks before larger claims

1. Sampling correctness: close/mid/distant views must preserve intended physical frequency without incorrect mip jumps or inter-region contamination. Exact rollback must recover the baseline.
2. Surface structure: compare pores, fine wrinkle networks and meso variation under neutral and grazing lights. A good result should not depend on over-sharpening a single camera angle.
3. Reflectance: review diffuse-only, roughness, normal and beauty separately; regional oil and dry areas must respond to moving light, not appear painted highlights. Keep complexion and ET13 marks independent.
4. Scattering/transmission: distinguish face diffusion from thickness-aware transmission. Validate under backlight, self-occlusion and head rotation, preserving a sharp specular component.
5. Animation and scale: verify face parameters, expressions, profiles and camera distance without swimming detail, incorrect density changes or uncontrolled GPU cost.

Only item 1 is implemented in R01. Items 2–5 define later experiments, not completed features. Before integration, inspect all controlled same-person A/B PNGs and the existing face-identity contract checks. No imported foreign head or 2D picture is an acceptable substitute for these tests.
