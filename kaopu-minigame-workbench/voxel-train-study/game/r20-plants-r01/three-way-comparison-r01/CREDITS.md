# A4 · 88 · Mark3 原样对比工作台 R01

## Old KAOPU source-backed learning copies

The two detailed older study objects are preserved KAOPU source-backed learning copies. They are not represented as independently authored pure-function reconstructions. The viewer loads the original student object graph, sampled fields and images. It does not load the teacher scene.gltf file. Original source attribution records remain inside the student data.

### Mark3 GWR
- Original work: Mark 3 Carriage Std Open GWR Green
- Author: timblewee — https://sketchfab.com/timblewee
- Source: https://sketchfab.com/3d-models/mark-3-carriage-std-open-gwr-green-0c64f6c0affb41f7bd4583a96c9fd0f1
- License: Creative Commons Attribution 4.0 International — https://creativecommons.org/licenses/by/4.0/
- Study source: learned/carriages/mark3_gwr_green, KAOPU R01. 145 source nodes; 356 sampled fields; two original images.

### A4 Union of South Africa
- Original work: Train Class A4 Union of South Africa
- Author: timblewee — https://sketchfab.com/timblewee
- Source: https://sketchfab.com/3d-models/train-class-a4-union-of-south-africa-636ed4890b72429da4a10abec0551373
- License: Creative Commons Attribution 4.0 International — https://creativecommons.org/licenses/by/4.0/
- Study source: learned/trains/a4_union_south_africa, KAOPU R01. 331 source nodes; 942 sampled fields; two original images.

### Changes for this comparison
No source geometry, materials, textures or source scale changed. Field payloads are losslessly gzip-compressed for transport, decompressed in the browser, and checked against their original SHA-256 before rendering. Rigid wrapper transforms align axes and position the objects in separate comparison lanes. Shared neutral lighting and one normal-perspective camera are presentation changes. Part selection and temporary isolation are viewing operations. No author endorsement is implied.

The old study objects' physical units have not been remeasured. This display is not a gauge, wheel diameter, wheelbase, or mechanism certification. Original shapes and scale are preserved; models are not normalized by stretching or uniform fit scaling.

## Later KAOPU 88 / A6 student r02
- Original existing native function assembly, with branding and window-front gills.
- Frozen source commit: 815a68995ae875155cfc59a3623f5ee6155f3841
- Source: https://github.com/haihao0307/guilin-dem-pipeline/tree/815a68995ae875155cfc59a3623f5ee6155f3841/kaopu-minigame-workbench/voxel-train-study/game/r20-plants-r01/a6-student-r02/native
- All 48 imported source modules verified against Git blobs. Geometry and materials unchanged; display uses a rigid wrapper only. Source rail datum Z=0 is preserved, including the small flange below rail top.
- Existing design metres are retained. This comparison does not declare new dimensional approval.

## Viewer
- Three.js r170 and included examples: MIT License, copyright Three.js Authors. See THREE-LICENSE.txt.
- This standalone comparison wrapper and interface are new. Existing workbenches and original assets are retained.
- SOURCE_LOCK.json contains pinned source and integrity checks.
