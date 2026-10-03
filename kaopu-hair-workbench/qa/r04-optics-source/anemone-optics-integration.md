# r04 optical kernel integration

This independent module changes material/light transport only. It preserves r03's 29-joint texture sampling, stable frame, radius profile, cap parameterization and generated positions. No rabbit files were touched. `AnemoneOptics` also exports through CommonJS for equation tests.

## Minimum integration

1. Load `anemone-optics.js` before the renderer. Compile the normal tube/body programs with `tentacleVertex` / `bodyVertex` and `fragment`. Compile two additional depth programs using the same vertex sources plus `shadowFragment`.
2. Allocate a 1024×1024 `DEPTH_COMPONENT24` / `DEPTH_COMPONENT` / `UNSIGNED_INT` 2D depth texture and framebuffer. Use `NEAREST`, `CLAMP_TO_EDGE`, no texture compare mode. Attach to `DEPTH_ATTACHMENT`, set draw/read buffers to `NONE`, and check `FRAMEBUFFER_COMPLETE`. Disable blending; keep `DEPTH_TEST` and `depthMask(true)` in both passes. Do not change geometry, alpha or depth to conceal contacts.
3. Each draw, compute `direction = O.lighting(optics.lighting, eye)` and `lightVP = O.lightMatrix(direction)`. Render both meshes into the depth target with `vp = lightVP`, the same current joint texture, and the existing instanced counts. Clear depth to 1; no culling is required. Restore the default framebuffer, color mask, viewport and camera `vp`.
4. Bind the depth texture at texture unit 1 and joints at 0. After `useProgram` for each color pass call `O.applyUniforms(gl, program, {...optics, shadowEnabled: true}, {eye, lightDirection: direction, lightVP})`. Continue uploading the existing `eye`, `vp`, and `joints` uniforms. The helper does not change program, framebuffer, texture, blend or depth state. It returns the effective options/direction/matrix.
5. Without a valid shadow pass, use `shadowEnabled:false`: ordinary surface shading remains unshadowed and **transmission is conservatively zero**, rather than inventing lit entry points or claiming a height proxy is occlusion. Surface ambient fill has an explicit artistic depth falloff; it is not ambient occlusion or global illumination.

`lightMatrix` defaults to a ±2.55-world-unit orthographic frustum centred at `[0,.62,0]`, distance 4.5, near .1/far 9. Check extreme parameter poses fit. Out-of-frustum shadow queries are conservatively dark. `shadowMapSize`, `shadowBias` and `shadowTextureUnit` are configurable; texture allocation must match. Existing `vp` and `eye` ownership stays with the renderer.

## QA controls

- `transmission: 0 | 1` adds/removes only the transmitted term; pigment, ordinary lighting and specular stay fixed
- `lighting: 'beauty' | 'front' | 'back'`; front/back are exact opposite camera-relative light directions, so recompute lightVP and the shadow pass for each
- `debug:'beauty'` is normal display
- `debug:'transmission'` isolates directional transmitted scattering on black, alpha 1
- `debug:'thickness'` shows local view-chord thickness, black to white over one reference diameter; raw linear diagnostic values
- `debug:'visibility'` shows ordinary surface light visibility in red and source-side entry visibility in green; raw diagnostic values
- `debug:'transmittance'` shows RGB Beer–Lambert beam attenuation for back-facing tissue; raw diagnostic values
- `palette:'wootton-olive-ivory' | 'pomfret-amber-yellow'`

For pixel QA hold geometry, time, camera and exposure fixed; capture transmission on/off under both front/back light. Capture transmission-only under back light, and verify shadowed/buried tips do not all light up. Thin side/cap chords should transmit more beam light than thick shafts; the top of a tip directed axially along a long shaft is deliberately **not** treated as infinitely thin. Check pale-tip transition, low/broad specular, default/maximum density, near-side contacts, back-facing illumination, all debug switches, palette restore and exact JSON/reset reproducibility. Actual Chromium shader compilation, images and visual acceptance remain the integrator's separate checks.

## What the model does and does not claim

The local ray exits a finite cylinder joined to an upper half ellipsoid. Radius, tangent, cap axial radius, radial position and signed distance to the cap centre are explicit varyings; no zero-radius cap shortcut. The chord is locally straight: long-range bending, taper and interpolated cap geometry are approximated. A source-side shadow query uses the estimated exit plus a small world-space escape bias, then 3×3 PCF. This resolves other opaque blockers approximately while avoiding rejection of transmission by the tube's own front surface. It does not transmit through multiple overlapping tentacles.

For chord distance d / referenceDiameter, RGB beam attenuation is exp(−(absorption + scattering) d). The single-scatter approximation is scattering × d × beam, modulated by a normalized Henyey–Greenstein directional phase, a source-facing cosine, source visibility and an explicit artistic 2.4 strength factor. This is not full BSSRDF, refraction, volumetric path tracing, multiple scattering or a strict global energy-conservation proof. The body remains opaque because it has no reliable local thickness contract. Broad low-energy GGX wet highlights, smooth pigment grading and low-contrast material-space mottling replace the old hard Phong highlight/tip paint band.

All colors, absorption, scattering, roughness and wetness are artist-adjusted. The reference diameter `.06` is in existing model units, not biological millimetres. Color calculations occur in linear light, followed by an exponential highlight shoulder and sRGB transfer. No fluorescence, emission, opacity blending or bloom is present.

## Photograph evidence

Actual original pixels of Wootton and Hobgood were inspected before implementation. Wootton is the principal same-species tissue/color teacher: broad milky ends, gentle yellow-green cores, purple column. Flash, auto white balance and image processing limit color inference; cyan rims are not intrinsic cyan albedo or evidence of fluorescence. The second same-species amber/yellow palette is an appearance interpretation of the Pomfret source described in the reference review, not a calibrated material.

- [Neville Wootton, H. magnifica](https://commons.wikimedia.org/wiki/File:Heteractis_magnifica,_tent%C3%A1culos.jpg), [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/)
- [Daniel Pomfret, H. magnifica](https://www.danielpomfret.co.uk/shop/macro-photography/heteractis-magnifica-magnificent-sea-anemone-maldives-009/), link-only; no photo reuse license assumed; lighting/WB undocumented
- [Nick Hobgood, E. quadricolor](https://commons.wikimedia.org/wiki/File:Entacmaea_quadricolor_(Bubble_tip_anemone).jpg), [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/): separate optical comparison only. Its bulb geometry and strong stripes are not transferred to H. magnifica. Flash/auto-WB/high-saturation photo, not measured material

OIST remains anatomy support, not the primary close-up optical teacher. Module comments link PBRT for standard attenuation, phase and microfacet equations; no third-party implementation was copied or executed.

Run `node tests/anemone-optics.cjs` for CPU/contract tests. Passing these is not GPU or browser validation.
