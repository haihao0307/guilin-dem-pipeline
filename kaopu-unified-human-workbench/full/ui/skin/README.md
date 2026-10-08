# Common person: basic surface features

This module is attached to the current unified person. It changes rendering attributes and a Three.js material only. It never substitutes the model, position/index buffers, teacher adapters, age/gender deformation, parameter owners, or native controls.

## Baseline audit

The separate published `skin-r02/index.html` pins preview commit `29d75e6a6e4e2627578d61e898461b968e3dd598`. That preview's `BUILD_MANIFEST.json` and `build.cjs` identify source baseline `c713eb1353cbf75ca57e1d9a80c6a9d0222d55ee`, not the accepted `b4b0cca7590d60031267dd41a70d93fffa6d37f3` head-binding repair. Therefore the older preview bundle must not be copied over the current root/full platform.

## Surface mapping

- GNM native material IDs strictly separate skin from teeth, gums, tongue, sclera, iris, and pupil.
- The upper/lower lip region IDs alone are too broad: they include surrounding skin. The actual lip field is clipped by the existing 68-point landmark convention's outer lip contour, landmarks 48–59, evaluated in native rest geometry. No screen-space gradient is used.
- GNM native region IDs provide nose/forehead/chin oil zones, cheeks, and thin eye-area skin.
- Anny neutral wrist/finger bone frames locate palms; neutral joints locate modest dry-area variation.
- The fields are interpolated through the same fixed canonical recipes as the model. They are never recomputed from a posed camera image or projected onto each changed head.
- Spatial color, roughness, and sub-mm microheight are original procedural functions in fixed rest metres. Lip grooves replace pores in the vermilion field. The field cannot drift onto teeth or eyes as age, gender, expression, or presets change.

## Integration

Import `{CommonSkinLayer, SKIN_DEFAULTS}` from `./skin/CommonSkinLayer.mjs` in the Viewer. Instantiate once after initial display geometry exists. Call `skin.update()` after position/normal changes and after wire/band toggles. `set(values)` updates settings and renders. `dispose()` restores the original material before the Viewer disposes it. `report()` exposes semantic counts and limitations. No parameter-state schema change is needed.

## Sources and rights

All new color, noise, microheight, region-mapping and material code in this folder is original work. It refers to already-present GNM/Anny data under the existing workbench notices. No third-party scan image, commercial Universal Human node graph, TEN24 material, or Unity asset was copied. No problematic skin-quality-lab scan or hair asset is loaded here.

## Verification and scope

`QA-NUMERIC.json` records the real fixed model check: 20,062 skin vertices, 5,355 non-skin vertices, 237 lip-field vertices; lip field on non-skin equals zero. Baby/child/adult/old × two gender extremes preserve identical rest/region attributes. Creating the fields leaves geometry byte-exact.

`tests/skin-browser.cjs` checks the integrated UI, shader errors, age/gender deformations, original-clay comparison, region/roughness/color diagnostics, light jaw opening, preset switching, and mobile layout. Its generated screenshots require separate visual review; numeric success is not visual acceptance.

This is a basic feature-painting and surface-material foundation. It is not photorealistic scan skin. Anatomical age wrinkles, calibrated subsurface scattering, transmission, and repaired scan/hair integrations remain outside this foundation. Age currently modulates microtexture strength only. Complexion is an independent artistic control and is not inferred from gender or ancestry.
