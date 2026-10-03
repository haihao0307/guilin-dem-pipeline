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


## Camera playback and fur appearance increment

Both main modules have independent slow camera-orbit play/pause controls. Manual dragging, pinching, wheel input, camera reset, state import and module changes stop playback without resetting the observed angle. Anemone water playback is separate from camera playback. Speeds are observation settings, not biological parameters.

Rabbit named colors reuse the original `furColor`; length reuses `hairLength`. The coupled density control changes existing Shell/Fin texture repeat, so it is visual mask density, not a count of follicles. Width is an explicitly labelled candidate-only alpha-mask remap, not a geometric strand diameter. Width=1 keeps the original mask branch. The pinned teacher modules/files and model assets remain unchanged. New JSON includes the mask-width parameter; old JSON loads width=1. Color, density and width edits do not clear combed GPU directions; parameter import still restores original directions as disclosed by the original workbench.

The latest anemone chroma adjustment preserves the local linear-light luminance of two neutral milk blends while retaining more of the tissue hue. This is a bounded photographed-color response fit, not a global exposure increase, emission model, or calibrated species reflectance. Geometry, flow, palette identities, alpha coverage and light direction are unchanged.

### Delivery gates

- No generated images replace real 3D implementation
- Production source is modified; viewport imagery is from the interactive 3D runtime
- File and exact public HTML must pass actual browser checks before delivery
- Screenshot evidence alone cannot satisfy this workbench task
- Visual acceptance, real iPhone/Safari behavior and production readiness remain separate from technical checks
