# 36 native morphology presets / R01

This interface replaces the initial slider wall with 36 complete parameter states on the existing common-person model. It is available at both the original root URL and `/full/`. The original parameter panel remains behind **全部参数**. No source geometry, native parameters, skeleton driver, head transfer, canonical recipes, or fixed topology is replaced. The retained `index-minimal.html`, skin-r01, skin-r02, anchors, and all other workbenches remain unchanged.

## Model semantics

Each of six stages has six forms: short/slim, tall/slim, tall/sturdy, short/heavy, rounded, and sturdy. Female and male form endpoints are balanced in each stage. Child, young and old correspond to official Anny age anchors; teen, adult and middle labels describe interpolation between those anchors. They do not claim a calibrated real-world age.

Height, weight, muscle, proportions and symmetric native local-change fields are explicitly recorded in `../../ui/PresetCatalogue.mjs`. No body-wide scaling, arbitrary PCA exaggeration or image-generated person is used. The skin layer does not infer complexion from gender or ancestry. The numerical `weight` shape parameter is never represented as kilograms. Displayed height is the current canonical mesh Z-span in native metres, converted to centimetres, not a clinical body measurement.

## Transactions and compatibility

Every selection begins with the full neutral `defaultState()` and applies the complete named preset; dormant GNM/MHR values, facial actions and pose are reset. Parameter edits mark the character as custom. Selecting another preset keeps the current material settings. All native data remain in the standard `kaopu-common-archive/rebuild-1` state. Optional `preset` and `surface` metadata supplement that archive; old geometry archives still restore. A separate parameter record is marked `unfitted-preset`: no photograph fitting is implemented or claimed.

The adapter fingerprint is intentionally retained because state validation and model deformation are byte-for-byte unchanged. Viewer-only shader/UI changes have separately updated runtime integrity hashes.

## Preview assets

The 36 thumbnails are screenshots of the actual current common mesh rendered by Chromium and Three.js. No image generation or external character photographs are used. The gallery loads thumbnail images lazily and creates only one WebGL context, on demand.

## Verification

- `tests/presets-catalogue.mjs`: native names, bounds, stage balance, independent full states, record export.
- `tests/presets-browser.cjs`: 36 finite distinct canonical meshes, no accumulated edits, archive save/restore, root/full routes, cancellation/retry, search, advanced panel and mobile layout.
- `tests/skin-browser.cjs`: material shader, semantic lip isolation, age/sex combinations, light jaw opening, original-material comparison and mobile close-ups.
- Historical geometry-only limits remain: full-strength native Anny blink can overclose; this UI/material release does not alter that source behaviour.

Browser captures and their final review are recorded separately. A numerical pass is not a blanket visual acceptance.
