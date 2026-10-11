# ET15 natural eyes: source and modification notice

The two included original PNGs are **Harvey_eye1** and **Harvey_eye2**, by **callharvey3d**, from MakeHuman Community **system_eye_materials03**.

Official source and license listing: https://static.makehumancommunity.org/assets/assetpacks/system_eye_materials03.html

Official selected pack: https://files2.makehumancommunity.org/asset_packs/system_eye_materials03/system_eye_materials03_cc-by.zip

The pack listing labels these assets **CC-BY** but does not specify a Creative Commons license version. This project does not silently invent a version or relabel them CC0. The attribution applies to the included PNGs and our modified sclera/background and vessel-mask derivatives. The original PNG bytes and their SHA-256 values are preserved in SOURCE_LOCK.json. The original author's material descriptors carry AGPL boilerplate; those descriptors and their shader code are not copied into or executed by this implementation. The runtime parameter adapter, curved display refinement, GLSL integration and image-processing preparation script are newly authored. New code does not make the underlying artwork exclusively ours.

Included: Harvey_eye1 (gray-green/hazel appearance) and Harvey_eye2 (blue appearance). Other pack items, including feline, reptile, mechanical, rainbow, target and fantasy designs, are not shipped. Brown, olive and gray-blue options are adjustable color derivatives of the two selected originals, not additional downloaded eye assets.

Changes: atlas sampling registered to the existing character's fixed ocular coordinates; pupil/radial resampling; optional color and inner-ring controls; independently adjustable sclera color and extracted vessel coverage; bounded view-dependent refraction approximation; surface roughness and analytic studio reflection; extra eye-only display tessellation. The source-comparison switch samples the original PNG without tint, pupil-resampling or vessel edits. This preserves source pixels, not an identical MakeHuman renderer, lighting setup or screenshot.

The atlas is 1024 x 1024 and contains two eyes. Each source iris is approximately 243 pixels across. No artificial enlargement is described as additional measured detail or as an 8K/cinematic scan. Source shadows and painted optical cues cannot all be separated into measured physical material properties by image processing. Sclera controls are artistic appearance controls, not medical health measurements. Refraction is a real-time bounded approximation, not a volumetric anatomical eye simulation.

Primary implementation references (ideas only; no Epic code or textures copied):
- https://dev.epicgames.com/documentation/metahuman/metahuman-materials-and-textures
- https://dev.epicgames.com/documentation/metahuman/eye-material-tools?lang=en-US

Existing Anny/MakeHuman, GNM, MHR, Three.js, Lee Perry-Smith/Infinite 3D and separable-subsurface assets/code retain their prior licenses and attribution in the inherited workbench. This eye-only delivery does not relicense them.
