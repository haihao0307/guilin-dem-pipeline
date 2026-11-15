# FAB Fabric Material Lab R01

A standalone WebGPU fabric material workbench inspired by publicly visible Fab fabric material references. It is an independent procedural recreation, not a repackaging of Fab's UE project or source texture maps.

## Included live material families
1. Plain weave / cotton
2. Twill denim
3. Denim grain / dyed twill
4. Coarse canvas
5. Jersey knit loop approximation
6. Felt / non-woven fibre field
7. Printed fabric over a woven base

The left canvas is rendered from a WebGPU fragment shader. The bottom controls modify weave frequency, relief, roughness, and two colours. The right editor displays the complete WGSL shader used by the renderer; compile applies code changes. Material JSON import/export stores parameters and WGSL.

## Fab references checked
- Fabric Material Pack — JulioSillet: free sample, 9 procedural Substance Designer PBR materials, 4K maps (base colour, normal, AO, roughness, metallic, height). https://www.fab.com/listings/56541b76-497a-4b76-b497-0016761b98ef
- Fabric Material Pack5: free, master fabric material and overlay maps. https://www.fab.com/listings/b30a59a7-963d-4939-a3aa-b5fc7fdaeab1
- Free Weave Fabric Material /PBR — Samur Art: free knitted/weave PBR material. https://www.fab.com/listings/85bf282f-33f3-4ab8-846a-d7916cd0ba4c
- Tent Material Pack — Samur Art: free, 10 tent/canvas materials, 4096 TIFF textures. https://www.fab.com/listings/5154d3cb-4371-428a-a12c-b51a03d650e1

## Important access and rights note
Fab listing pages and preview imagery are public. Downloading the original project package requires Fab's normal account/library entitlement flow. This workbench does not bypass login, scrape private download endpoints, or redistribute third-party source textures. The R01 shader recreates observable material behaviour procedurally. It is not pixel-identical to the original PBR packages and does not contain their copyrighted maps.

## Rendering boundary
The initial R01 uses a planar surface with analytic height-derived normals and procedural weave/fibre shading. It is a live shader-rendered material, not a static image or a full yarn-geometry simulation. It does not yet provide true displaced silhouettes, cloth simulation, or individual fibre geometry. These are separate fidelity stages and must not be claimed as completed.

## QA
The CI Playwright test runs the actual WebGPU renderer on a software Vulkan adapter at diagnostic 160x120, checks all seven presets, parameter controls, WGSL editor visibility, and console errors. It is not a production GPU performance benchmark or phone hardware test.
