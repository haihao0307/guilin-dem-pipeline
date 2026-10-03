# KAOPU complete anemone and rabbit workbench

This single-HTML candidate retains the 240-tentacle original r03 shape, body connectivity, rounded tube profile, KuKo-derived airy material, and compact mobile/desktop controls. The rabbit has a full-screen editable view, with its teacher opened only on request.

## Current bounded anemone update

Natural study presets separate root/shaft/tip/column colors. Green, yellow, brown and purple variants are supported qualitatively by species literature; the hand-fit sRGB colors are not NOAA/PICRC measurements or calibrated albedos. Prior coral-red and mist-blue presets remain explicitly artistic alternatives inside the adjustment panel. Column color is separate from the oral disc through a non-geometric vertex attribute; all original body position/normal/index bytes and tube vertex positions remain unchanged.

Regional aperiodic flow replaces the shared dual-sine driver. Neighbors sample a continuous low-frequency spatial/temporal field with a downstream delay; more distant regions differ. It preserves fixed roots and normalized segment lengths. It is a kinematic visual approximation, not fluid–structure interaction, collision response, a calibrated Palau current, or active contraction physiology. Existing geometry intersections and two-layer transparency limits remain.

State JSON v3 records the motion-model version. Old v1/v2 parameters are accepted with a visible migration notice and are evaluated under the new flow; they do not recreate the old solver's frame. Unknown v3 motion models are rejected before state mutation.

## Evidence

- Species and tissue zones: Titus et al. 2024 https://zenodo.org/records/13760333
- Bright yellow/green tentacles and red/purple column: 2021 field study https://www.vliz.be/imisdocs/publications/370236.pdf
- Lighting/depth color context only: NOAA https://oceanexplorer.noaa.gov/ocean-fact/animal-color/
- General other-species current response: SICB https://sicb.org/abstracts/sea-anemone-tentacles-flutter-and-flap-in-water-flow-in-the-field-/
- Actual H. magnifica video previews UP24379 and UP14739 were sampled for qualitative motion/tip shape. No preview video is embedded or republished.
- Wootton macro photo remains CC BY 2.0 with attribution. Original SEDDI MIT source/assets and the user-provided KuKo algorithm reference remain preserved.

## Build / tests

Run `python full-cluster/build.py` using the complete source package. The produced HTML embeds its runtime and assets. The browser QA uses the existing pinned Playwright setup and separately checks file/public bytes, real WebGL, native Chromium touch, parameters, reset and UI. Chromium touch emulation is not physical iPhone/Safari validation. Refer to the exact publication receipt for each build; test counts do not establish natural appearance or production quality.
