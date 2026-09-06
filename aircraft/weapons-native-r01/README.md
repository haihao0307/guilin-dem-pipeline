# Aircraft native workbench R01

Public entry: https://haihao0307.github.io/guilin-dem-pipeline/aircraft/weapons-native-r01/

Source repository: haihao0307/AIRCRAFT, feature/b24-weapons-mother-v1.
Reviewed source commit: 03087fefd77d87c70e2e16cf3b48ff99cd41f1ca.
Source WebGL review run: 34002025758. Both 1600 x 1000 and 390 x 844 Chromium viewports passed 35 checks each.

HTML SHA-256: 296853d3ad98c9d312fbeb45d6ddd1eed28e451e6e1b284812c6f2d0096f5960.
HTML size: 1,408,978 bytes. The published bytes match the reviewed self-contained artifact.

This is a first, nonfunctional historical-exterior visualization candidate. Geometry is generated from authored rules in memory. No imported product mesh, sampled source vertex/UV table or raster product texture is retained or loaded. The generic Three.js r170 runtime and its license are included. No retired S01 implementation is used.

The page includes eight visual groups, a candidate aircraft mount, part isolation/spread/restore, PBR controls, channel/light inspection, A/B surface comparison and bounded presentation effects. One-in-five tracer appearance is a user-specified visual preset, not a historical ammunition claim. Mount applicability, sight placement and visual proportions remain to be reviewed; no fabrication dimensions or functional weapon mechanisms are supplied.

This commit triggers the existing Pages deployment for this isolated path only. It does not modify any B24, terrain, weather or other workbench. A separate public-URL Chromium check is pending; the source browser check alone does not establish live deployment success.
