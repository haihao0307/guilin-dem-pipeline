# R03: remove wrongly repeated donor meso relief

Opt-in, subtractive candidate. R02 `ca9f7e40` and ET13 are unchanged.

## What the controlled diagnosis established

Run [38080613364](https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/38080613364), commit `fa0b8255`, made 19 checks on the exact R02 app bytes. The neutral probe is pixel-identical to R02. Same native person, pose, camera and lighting were retained while separately removing host relief, atlas R micro, atlas G meso, procedural pores, atlas B roughness and identity height. Removing G meso removes most scratch-like cheek bundles; the others do not. Rotating only atlas coordinates and gradients by 90 degrees rotates the pattern. The source image has directional structures inside the tile, not only near tile boundaries.

Source coordinates are projected native rest XY in millimetres, with repeat spans of 18 mm for tile 0 and 14 mm for tile 7. The atlas was independently contrast-normalized by frequency band; runtime G height gain is 90 micrometres times the artistic meso setting (default 0.75), not a measured depth. Repetition and planar projection make the directional donor meso structure look like repeated scratches on a different native face. R01 mip filtering prevents mip contamination but cannot make a non-transferable repeated signal anatomically appropriate. No claim is made that all remaining fine artifacts have been explained.

The existing licensed atlas comes from Lee Perry-Smith's Infinite 3D Head Scan (CC BY 3.0), transformed by the earlier platform. No replacement atlas, scan, donor head or generated image is introduced here. See `face-transfer/THIRD_PARTY.txt` and `face-transfer/assets/ATLAS.json` for original provenance.

## Smallest source-limited correction

`attachCheekMesoGuard(skin)` installs after R01/R02. In the detail-atlas call only, neutralize G to 0.5 for source tiles 0 and 7 BEFORE existing native region mixing. Existing R/B channels, chroma calls, other tiles, mixes, analytic pores, identity height, height gains and normals code are untouched. Tile 7 is also reused by the native chin, and source contributions survive at blended region edges; this is not a strictly cheek-only spatial mask.

- No new samples, textures, geometry, uniforms or editable material parameters.
- `setEnabled(false)` restores the original shader/key; `dispose()` restores previous hooks. R01 sampling off safely suspends this array-atlas correction; turning R01 back on resumes it. `report()` exposes requested/effective status.
- A later shader wrapper must be disposed first; wrong disposal order fails closed instead of silently discarding another layer.
- This is a removal of a demonstrated bad source contribution, not a claim of measured skin or new realism from parameter count.
- No automatic installation on production. No R05 compatibility claim.

## Acceptance

`tests/meso-guard.mjs`: 486 ordered native-blend cases plus shader/hook checks.
`tests/meso-guard-browser.cjs`: actual GPU A/B at mouth/oblique/face/eyes in native and grazing lights; fixed-frame repetitions; exact off/on/dispose and archive recovery; unchanged whole-frame color and roughness layers; geometry, archive, camera/light and original controls preserved. Read the terminal CI artifact for actual pass/fail; source assertions alone are not visual acceptance.

Lips, mouth-cavity edge, SSS/thickness, planar micro projection and remaining host/atlas-R detail are outside this finite correction. The candidate may look smoother. It is not film-quality skin.
