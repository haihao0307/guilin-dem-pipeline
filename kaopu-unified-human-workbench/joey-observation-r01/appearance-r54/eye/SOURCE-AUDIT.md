# R54 native eye surface: reviewed adapter boundary

This is a removable appearance candidate for the frozen R52 person. It is not accepted likeness, measured anatomy, a new eye system or a correction for native contact problems.

## Pinned inputs actually read

Repository: https://github.com/haihao0307/guilin-dem-pipeline

- R05 engine commit `0b4703359efbae10ffc6c0e5fe3fc081e7eca4fe`: `kaopu-unified-human-workbench/full/ui/skin/CommonSkinLayer.mjs`, blob `7005138bfaac3e5b4c6858b006ab4972cfeac953`.
- Existing E1 bridge at QA commit `f416dd7e1113150b7a1974af3c68f96a96c44438`, directory `kaopu-unified-human-workbench/joey-observation-r01/eye-r14/`: R05EyeBridge `bfd1d9962bacdec99ed7fd9e82f51ae8ebb58c28`; NativeEyeOptics `bf33760d2ed089e04f427a44f177f37cf2fedd2a`; IrisField `10f5135a262c70f7eda29502cedf8ef095434153`; EyeParameters `2b81c54647823b6fd517659f8e9952e4aec550b8`.
- ET16 teacher commit `f662a52e30b568eeec09e8d3f5b2e692cccc5ab5`, directory `kaopu-unified-human-workbench/eye-materials/`: EyeContactField `75a87120dddd33e76e1a8b6bc47581f2f2c74003`; NaturalEyeShader `bfd39a1697a4d60490b298decb4ca63a06116613`; NaturalEyeState `c9ba4051a72db3591de6e73df4989be8dd41ffe4`.
- Read the same teacher commit's THIRD_PARTY.md `e19ff666b045c3d1360465390fae23bde5555720`, SOURCE_LOCK.json `e4987471446740ed17c359a05ba8babc10a5183b`, and README.md `8d5a2708c26bc2af7434197db6a35a8d752edaf4` before implementing this candidate.

## Source and license boundary

The teacher notice identifies its parameter adapter and GLSL integration as newly authored. Its external Harvey artwork is by callharvey3d, listed CC-BY with no version specified. The original material descriptors contain separate AGPL boilerplate and are not part of that runtime. This candidate does not download, import, transform, bundle or sample any Harvey image, derived sclera/vessel map or descriptor. It does not claim ownership of those assets or apply their listing to other source code.

The R54 adapter is original project code using the finite rectangular light-source idea and feathered radial transitions visible in the owner's ET16 implementation. The pinned original procedural IrisField remains the source of iris structure and pigment. It creates its existing DataTexture; R54 creates zero textures and has no image loader. Existing host and Three.js licenses remain unchanged. The fixture directory contains only byte-exact project implementation inputs used by CPU tests, not an additional browser runtime or imported eye system.

## Actual reusable interface

R05EyeBridge installs `fEye`/`vFEye` from unchanged bind-space iris and pupil coordinates, then calls the existing NativeEyeOptics. R54 attaches after that chain and patches only its assembled fragment shader. It uses the existing `e1OuterNormal` before iris relief, existing `vViewPosition`, the real Three `directionalLights[i].direction` and `.color`, and the already present CommonSkin `csLayer` gate.

- `pupilFeather`: minimum pupil transition footprint, default .008, fraction of bind iris radius.
- `limbusSoftness`: minimum iris/sclera transition footprint, default .012, same dimensionless coordinates. Existing `uE1LimbusMM` and native iris radius remain unchanged.
- `angularWidth`: rectangular source half-width in reflection-plane slope, default .075. It is an artistic finite-source approximation, not a measured light radius.
- `reflectionStrength`: default 1.2, bounded 0–2.4; multiplied by actual linear light color/intensity.
- `wetness`: default .68, bounded 0–1; appearance weighting only.
- `enabled`: reversible whole-layer gate. Disabled edge formulas are exactly the E1 scalar formulas. The existing E1 tear clearcoat is restored when disabled. Enabled R54 replaces that extra clearcoat with its analytic finite-source highlight while keeping the native base BRDF.

Edge smoothing preserves r=1 and the existing pupil radius as half-coverage boundaries. It does not resize geometry, select another pupil, change gaze/axis, infer identity, or alter the frozen six R52 face controls. Shader derivatives for rectangular reflection run across the full pixel quad before the varying eye mask. No point, hemisphere or ambient light is invented as a catchlight; only actual directional-light uniforms participate.

## Why contact shading is deliberately unavailable

ET16 EyeContactField requires `model.eyeSurface.skin`, `model.eyeSurface.eyes` including native triangles, and `eyeSurface.landmark()`. Its shader also expects the complete FaceSkin host chain. R05 has only the minimal chart bridge, not that verified intersection-field API. Therefore `neContact` is not fabricated, contact-shadow settings are rejected, and report().contactShading is false.

The missing future interface would be a separately verified, current-geometry native skin/ocular intersection field with per-vertex [distance in mm, valid, eye-or-skin, side], proven coordinate conversion, eye-side mapping, update behavior and geometry diagnostics. Such a field may color a genuine contact only after the geometry is inspected. A dark ellipse, painted socket, screen-space mask or wet strip would not supply this evidence. Existing native opaque-cover/contact limitations remain visible for the parent's geometry QA.

## Verification boundary

CPU tests pass against the actual pinned CommonSkin, R05EyeBridge and E1 hook chain, including fixture Git blob identities. They cover light response, bounded edge transitions, retained original atlas/chart/positions/faces, invalid-update atomicity, repeat installation, explicit disposal, owner disposal and shader-anchor failure. CPU hook assembly is not GLSL compilation or a real 3D render. No local browser was run. Real compile, pixel, light-change, multi-view and neutral/smile contact tests must run in the parent's isolated GitHub Actions render before selecting this candidate.

## Real-render reinstall correction

The second real run passed the first install, off and disposal pixel restoration, but the later close-eye light probe had no response. A new contract test reproduced Three r170's material program-cache behavior: when the same custom key is reused, onBeforeCompile is skipped, so the new closure's uniforms are not bound and the previous disabled uniforms survive. Each bounded adapter installation now has a distinct cache key. The new test failed before this change and passes after it. Native geometry and the original procedural iris are unchanged. The actual renderer must still verify the corrected second installation and light response. Program variants stay owned by the host material and are released with it; this experimental lifecycle is not a claim of unbounded cost-free toggling.
