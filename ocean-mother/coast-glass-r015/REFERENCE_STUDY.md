# Ocean Mother: glass and material study R015

Recorded 2026-09-03. Basis: two exact user-provided pages; direct public browser inspection retained separately from runtime. No image or proprietary template source is copied into the coast runtime.

## ThreeUI: Advanced Glass Material
https://threeui.com/hero/advanced-glass-material

The public description presents a faceted spectral glass form over an interactive water field. It names two-bounce refraction, edge dispersion, studio reflections, pointer orbit, impulses and a restrained technical product interface. The inspected page returned HTTP 200 and displayed a preview, but explicitly gates the live renderer and source package behind Pro. The underlying implementation was not obtained or verified. Earlier claims of having extracted its exact implementation should not be used.

Transfer chosen for Ocean Mother, independently implemented: restrained floating controls; readable foreground HTML text; shaped translucent boundaries; gentle edge refraction from the current scene buffer. This version does not claim that its screen-space glass reproduces the template's two-bounce volumetric algorithm.

## three.js forum: liquid metal audio visualizer
https://discourse.threejs.org/t/i-am-stuck-building-a-liquid-metal-audio-visualizer-can-you-help-me-out/69144

The inspected topic has one post. It shows noise-driven vertex displacement, a constant-white fragment shader, wireframe enabled, and asks how to achieve chrome appearance. It links to Blobmixer as a reference. The post is an unresolved question, not a completed glass implementation or a validated normal-reconstruction recipe.

Transfer chosen for Ocean Mother: separate surface deformation from material response; update normals from the actual generated surface; preserve lighting and roughness rather than treating displacement alone as a finished material. These are our implementation decisions, not a solution supplied by that post. No audio interface or sphere geometry is added to Coast.

## Additional implementation documentation
https://threejs.org/docs/pages/MeshPhysicalMaterial.html
Physically based transmission, thickness and reflectivity are distinct properties. Used for terminology and optical design, not imported as a runtime dependency.

https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/backdrop-filter
Backdrop filtering acts behind a partially transparent element. Applied only to UI backgrounds; text remains ordinary HTML. Reduced-transparency, reduced-motion and increased-contrast fallbacks are included.

## Permanent constraints
No image generation, image enhancement, photographic backgrounds, authored albedo/normal/noise/foam textures, external models or runtime CDN. Mesh-height, color and depth buffers are numeric/runtime state only, never shipped image assets. Internal browser screenshots serve inspection only and are excluded from the runtime.

## Candidate scope
Outward closed rock meshes, finite bounded wave phases, shared CPU/GPU bed, corrected background compositing, daylight default, procedural glass controls and obstacle-aware foam coverage transport. Full conservative hydrodynamics and 3D overturning waves remain outside this candidate's verified scope.
