# Independent GNM skin material study

This is a FILE-only preview source package until its actual rendered appearance is reviewed. No public interactive skin page or main entry is included in this preview batch. R9 is unchanged.

The default is an independently authored procedural skin material on the real GNM mesh. It adds landmark-derived lip/cheek/nose/ear color, bounded rest-space micro-normal detail, separate roughness, and a small wrapped-diffuse approximation. It is not a scanned-skin replica, BioSkin network execution, full spectral subsurface scattering, or a photorealism acceptance claim.

## Geometry and maps

The official Apache-licensed gnm_head_uvs.bin is pinned to xrblocks/assets-gnm commit 134feb02b11fa642a43ff5e7e880246255a74e86, 396732 bytes, SHA-256 5c396e14fb429e794b2d520377b392426e70c24af8c3fd4adb2475f02b83cb9a. No TEN24-derived sidecar, scan or texture is included.

The solver and hair still use the original 17821 vertices and exact original-topology Three normals. The render-only geometry maps 18437 vertices through official uvSource and uv_triangles. All 105972 triangle corners map exactly to the original mesh; seam copies use exactly their source position and normal. There is no invented UV unwrap or V-coordinate flip.

Official materialIds separate skin, teeth, gums, tongue, scleras, irises and pupils. Local skin maps apply only to materialId0, and cannot paint the eye or oral components. Lips remain part of skin. Eyes currently use component colors, not a photoreal corneal/iris model.

The three local image inputs read PNG/JPEG/WebP into browser memory only, not a remote upload. Albedo textures use sRGB, tangent normals and roughness use NoColorSpace linear data. Roughness reads green. Normals use OpenGL convention. Images are not saved persistently. Explicit Clear restores the procedural channel; an empty/cancelled input preserves the previous map. Maps must match GNM UVs; this is not automatic photo fitting or UV retargeting.

## Frozen appearance

FiberMaterial.js, HairOpacityShadows.js, TeacherGroomBinding.js, HairLayer.js, TeacherGroomEditor.js, original guide data, the camera and lamp setup remain copied byte-for-byte from accepted R9 wherever applicable. The skin shader deliberately leaves the head receiver's packing/lights_fragment_begin hooks intact so the original layered hair-shadow module can wrap it. Head geometry and original normals are not altered by a material change.

## Validation

CPU tests check official UV corners/seams, skin/eye/material separation, map color spaces, atomic invalid input rejection, exact original source preservation, and female seed20261005/20261006 render compatibility. Browser FILE-only previews must verify real compile/pixels, skin/clay/UV comparisons, map imports/cancel/repeat/clear, expression propagation, and exact procedural reset. Runtime source hashes pin R9 and old cases. Full regression/contact/physical-device and visual acceptance remain separate.
