# Fab Fabric Material Lab R02

R02 moves the fabric carrier from R01's fullscreen ray-plane surface to an indexed, interactive 3D cloth mesh rendered by a native WebGPU render pipeline.

## Live material studies
- Plain cotton / plain weave
- Cotton twill
- Dobby weave
- Canvas
- Jersey knit
- Wool/fuzz surface response
- Printed woven cloth
- Rope-style woven cloth

## Geometry and runtime
- Actual indexed cloth mesh: 128 x 88 cells, two triangles per cell.
- Vertex positions, normals and UVs are separate mesh attributes.
- Depth testing enabled.
- Mouse drag rotates the 3D sheet; wheel zooms.
- WebGPU fragment shader evaluates the weave and fibre response.
- Complete WGSL source is shown in the right editor and can be recompiled.
- Import/export material parameter JSON.

## Fab free references verified
- Quixel Fabric Clothes Cotton Plain Weave White: https://www.fab.com/listings/5b36dee7-0dfc-4d85-929f-85e07554b807
- Quixel Fabric Clothes Cotton Twill Weave Dark Gray: https://www.fab.com/listings/0d239be9-d45d-41c9-947c-831dca389d36
- Quixel Dobby Weave Cotton: https://www.fab.com/listings/2a4a568a-56de-4f3d-a8e2-16c4468d134e
- Quixel Plain Wool Fabric: https://www.fab.com/listings/bb875143-5df0-42be-a8f7-5937b25660e4
- Samur Art Free Weave Fabric Material /PBR: https://www.fab.com/listings/85bf282f-33f3-4ab8-846a-d7916cd0ba4c
- Samur Art Tent Material Pack: https://www.fab.com/listings/5154d3cb-4371-428a-a12c-b51a03d650e1

## Rights and limits
The above Fab listings identify resources marked Free. Downloading originals remains subject to Fab's own access and license workflow. This independent workbench does not bypass entitlements or redistribute third-party source maps. R02 uses procedural recreations of the observable textile structures, not the original Fab texture pixels.

The current mesh has geometric drape folds and true 3D perspective, but yarn loops, loose fuzz strands and fibre silhouettes are still shader approximations. Do not interpret the wool preset as individual simulated hairs.

## QA
A Chromium WebGPU workflow checks startup, all eight presets, live parameters, WGSL source, mesh interaction and console errors on a software Vulkan adapter. This is not an NVIDIA hardware performance benchmark.
