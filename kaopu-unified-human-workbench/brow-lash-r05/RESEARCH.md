# BROW-LASH-R05 research boundary

Date: 2026-10-15.

## User direction

The user asked to reuse the already-built R04 eyebrow root-bearing range, study the previously supplied eyebrow templates only for variety and shape organization, and rebuild eyebrows as dense individual hairs emerging from the retained skin. External eyebrow meshes, texture cards, root coordinates and copied strand data are forbidden. The result must expose many adjustable parameters and multiple visibly different forms.

## Reference audit

### MakeHuman system eyebrow catalog

GitHub source: `makehumancommunity/makehuman-static-website`, `content/Assets/AssetPacks/makehuman_system_assets.md`, commit `883f19ca188e1cb458f2907d6f0c81187b9cf7da`.

The current catalog lists `eyebrow001` through `eyebrow012` as CC0 system assets. This is twelve entries, not fourteen. The earlier project recollection of fourteen likely combined a different pack or later/community additions and must not be treated as a verified count. R05 does not download, import, trace, convert or redistribute any of those meshes or thumbnails. It uses only the general observation that a useful eyebrow system needs distinct straight, arched, narrow, thick, short, feathered and tapered families.

### Perm

GitHub source: `c-he/perm`, README commit `5885a2ab66f128d7f0acb88c4518b21b7b4ad9cb`.

Perm exposes a predefined root set and separates guide strands from decoded strands. R05 borrows only that abstract organization: stable surface roots, a lower-dimensional regional flow field, and per-strand residual variation. It does not use Perm checkpoints, PCA bases, geometry textures, Hair20k/USC-HairSalon strands, CUDA operators, source code or root files.

### Digital Salon

GitHub source: `digital-salon/Digital-Salon`, README commit `4aacd4913a48d0b32012a672da2b35f27fc8f171`.

Digital Salon demonstrates generating hair on selected surface triangles and interactively changing physical/grooming parameters. R05 borrows only the product-level separation between a selected growth surface and strand grooming. It does not copy the simulator, triangle selection code, head mesh, resampled hair, AI components or data.

## Own representation

R05 starts from the immutable R04 page and keeps its complete R06 person, skin, eyes, lighting, original 65% blink endpoint and center-long eyelashes. The new eyebrow layer is added without changing the R04 executable scripts.

The R04 root domain provides two skin-bound patches split into head, body and tail. Each grid sample already owns exact triangle indices, barycentric weights and a local triangle frame. R05 deterministically filters these candidates according to the selected shape, then appends each generated strand's local offsets to the same surface anchor. During blinking, the existing surface sampler transports the roots and full curves with the deformed skin. No nearest-vertex substitute, floating eyebrow shell or bitmap mask is used.

Each accepted root creates one tapered 3D strip with fifteen curve samples. The first sample sits about 0.012 mm above the triangle center, followed by a low-lift curve that lies along the skin tangent field. Medial, body and tail directions blend continuously. Length, radius, pigment, vellus state, grouping and local turn vary deterministically per fiber.

Default expected density is about 1,900 hairs across both brows. The strong preset is expected to exceed 1,900; the narrow fine preset still keeps more than 650 roots inside its smaller band. These are generated model counts, not biological follicle measurements.

## Ten authored families

1. Natural dense.
2. Straight dense.
3. Soft arch.
4. High arch.
5. Feathered upward.
6. Strong thick.
7. Fine elongated.
8. Short dense.
9. Angular peak.
10. Rounded natural.

They are parameter recipes, not renamed external assets. Adjustable variables include root density, occupied width, span, arch height, peak position and sharpness, head/body/tail fullness, regional flow angles, strand length, length variation, laydown, lift, clumping, fiber width, vellus ratio, asymmetry, roughness, color and random seed.

## Explicit limits

The retained character has no scanned follicle map or pore segmentation. Therefore “growing from pores” means deterministic triangle-bound procedural follicle anchors at pore-scale spacing; it is not a claim that the roots coincide with real biological follicles. The R04 growth range itself remains a model-space candidate. R05 has no full hair-to-hair collision, elastic-rod simulation, self-shadowing path tracer or consumer-GPU certification. Visual acceptance remains with the user.
