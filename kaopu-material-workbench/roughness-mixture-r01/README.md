# Roughness mixture R01

A new isolated demonstration of the 2026-10-22 Filament equation study. It does not change any existing building or workbench case.

Open index.html directly, offline. No server, installation, assets folder, WebGL context, triangle mesh or network runtime dependency is needed. The public mirror contains the identical HTML bytes.

This is a real analytical 3D CPU renderer. Orthographic rays intersect a unit sphere. Surface normals and the shared directional light are evaluated in 3D using original JavaScript GGX, correlated Smith visibility and Schlick Fresnel equations. Canvas 2D only transfers the calculated pixel array. It is not a screenshot, painted gradient, or complete Filament renderer.

Both methods share camera, shape, light, F0, area weights, exposure, tone mapping and diffuse settings. Mode A averages perceptual roughness before evaluating the BRDF. Mode B evaluates both BRDFs then linearly combines them by area. No per-side normalization. Tone mapping is fixed Reinhard then standard sRGB. A subtle central ring marks the normal-aligned diagnostic point; it is UI, not a material feature.

Inputs: tile roughness .34, grout roughness .91, F0 .04. The realistic tile fraction is (298/301)^2. The default half-and-half case is a diagnostic contrast, not a realistic joint fraction. Optional neutral gray Lambert shading is identical on both sides, for shape readability; it is not the original building color. Base specular-only mode removes diffuse and ambient equally.

Boundaries: no spatial grout pattern, no clearcoat/layer transport, no normal maps, no multiple-scattering compensation, no production building change, no claim of improved production image quality. Central numeric response is BRDF times cosine, before light intensity and display transforms. Percentages describe only that scalar response.

Sources: Google Filament v1.56.0 commit 003e5005713cba55cbd3f3a423c472000b96b868, Apache-2.0, brdf.fs and common_material.fs. KAOPU numerical snapshot ed015e34af0e967c3535f01b062da2de7c5bd6f2. See sources.json. No third-party visual/audio assets or executables are distributed.

Checks: node numeric_qa.cjs; python browser_qa.py (installed Playwright and Chromium required for development QA only). Python reference_experiment.py is the unchanged prior original numerical implementation. Browser QA tests 2,736 reference samples, initial pixels, light and weight changes, endpoint pixel equality, layout switching, base-specular mode, sweep start/stop, no overflow, desktop and mobile viewports, no dependencies, no WebGL and explicit failure. QA screenshots are internal verification evidence, not substitute deliverables.

Delivery gates: no generated image substitute; source implementation exists; interactive analytical 3D runtime; controls must pass; exact public HTTPS bytes and browser test required before sharing. A screenshot alone is failure. Human visual acceptance and production integration are not automatically approved.
