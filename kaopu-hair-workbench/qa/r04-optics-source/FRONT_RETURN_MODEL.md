# Independent finite-thickness front-return study

This is an opt-in shader set alongside the unchanged shadow-filter shader. It does not overwrite the previously built shadow A/B HTML. No renderer or host source was edited, no browser run and no upload performed.

## Exact old/new entry points

Both are exported by the same `src/anemone-optics.js` module:

- Old: `AnemoneOptics.fragment`, `AnemoneOptics.applyUniforms`, `AnemoneOptics.DEFAULTS`, `AnemoneOptics.options`
- New: `AnemoneOptics.frontReturn.fragment`, `.applyUniforms`, `.DEFAULTS`, `.options`
- The new set also includes `vertex`, `tentacleVertex`, `bodyVertex`, `shadowFragment`, `lighting`, `lightMatrix`, `PALETTES`, `DEBUG_MODES` and existing CPU reference helpers

For the frozen Base renderer, explicitly select the new set **before its script is loaded/evaluated**. It captures `AnemoneOptics` and shader strings at script evaluation, so changing the global after loading that script but before calling its constructor is too late:

```js
const oldOptics = window.AnemoneOptics;
window.AnemoneOptics = oldOptics.frontReturn;
// Now load/evaluate the existing renderer script, then construct renderer/host.
```

Keep `oldOptics` available for an isolated old-version build. Existing renderer closures and programs keep their captured/already-compiled shader; changing the global after loading that renderer does not replace them. No integration code should be inserted into the frozen prior HTML.

The new set merges the old defaults with two additional serializable, validated fields:

- `frontReturn: 0..1`, default `0.65`: fraction of the old **direct diffuse** budget assigned to the new tissue-return model
- `frontReturnView: 'beauty' | 'return-only' | 'layer-reflectance' | 'normal-thickness'`, default `'beauty'`

`frontReturn:0` skips the added transport branch and uses the old direct diffuse expression unchanged. Its mathematical fallback is exact; actual new-program/old-program pixel equality must still be checked in Chromium. A build-time old shader is available separately above for a literal same-source reference.

`transmission` retains its existing backlight-only meaning. Turning it off does not turn off front return. `frontReturnView` diagnostics are defined by the new set's `views` map and have priority over old `debug` views when selected. The `.options()` result and `.DEFAULTS` retain both new fields through JSON roundtrips; do not discard them using a hardcoded external whitelist.

- `return-only`: only the allocated returned-light term, with the same exposure/transfer function; it remains black without incident light or behind a shadow
- `layer-reflectance`: raw linear RGB finite-layer return coefficient for evaluated front-facing tissue; this is a material diagnostic, not emitted radiance
- `normal-thickness`: local inward-normal chord, white at one reference diameter; no change to silhouette/opacity

## Local model

At a front/side-lit tentacle surface, local finite depth is the existing capped-cylinder `tissuePath(-n)` divided by the existing reference diameter. The same RGB absorption K is used, including the existing tip blend/mottling. Reduced scattering is S = existing scattering × existing tip factor × (1−existing phaseG). These are artistic model units, not measured coefficients.

For the equivalent homogeneous finite slab, gamma = sqrt(K(K+2S)) and e = 1−exp(−2 gamma D). Its returned diffuse fraction is

R = S e / ((K+S)e + gamma(2−e)).

The K=0 limit is SD/(1+SD). Zero depth or zero scattering gives zero return. Thin-layer exponential cancellation is handled with a Taylor limit. R is nonnegative, at most one, increases toward a finite thick-layer limit, and decreases with increased absorption. This is the standard two-flux finite-layer relation, independently implemented; see [Hébert and Becker, 2008](https://lspwww.epfl.ch/publications/colour/cbcad2fmfratodl_08.pdf), DOI 10.1088/1464-4258/10/3/035006.

An original conservative angular redistribution gives a broader side response than Lambert. With positive incident/exit cosines muI and muO, define Q(mu)=1−mu log(1+1/mu), and

fReturn = 1 / (2 pi max(Q(muI),Q(muO)) (muI+muO)).

The cosine sum has a tiny lower numerical bound that can only reduce energy. The lobe is reciprocal, nonnegative and integrates to at most one against the outgoing projected hemisphere. The bound follows because its denominator uses at least Q(muI), while the integral of muO/(muI+muO) is exactly Q(muI). This lobe is an appearance approximation, not measured tissue phase data or a complete subsurface transport solution.

The direct non-specular response becomes

0.82 × key × visibility × (1−F) × [(1−amount) × base × muI/pi + amount × R × muI × fReturn].

This replaces a fraction of old direct diffuse; it does not append unlimited white light. Its per-channel hemisphere-integrated non-specular budget is bounded by 0.82 × [(1−amount)base + amount R], before further Fresnel/shadow reductions. Specular, ambient, backlight transmission, source-exit visibility, light direction, exposure, palette values, geometry, depth writes and alpha=1 remain unchanged. This is a bound on the new direct diffuse allocation, **not a new global energy-conservation certificate for the complete old renderer**.

## Scientific and visual boundaries

- A local straight normal chord stands in for a homogeneous optical slab; actual anemone cellular layers, fluid-filled interior and heterogeneous pigmentation are not reconstructed
- No lateral light diffusion between distant surface points, global multiple-scattering solve, BSSRDF, refraction, fluorescence, opacity blending or new ambient light is implemented
- Finite-layer return and old back transmission are distinct approximate branches. A thinner layer produces less front-return scattering even though its unscattered back-transmitted beam can be stronger. A tip is not forced to glow merely because it is a tip
- The authored photo palette and its lighting/WB caveats remain unchanged. Nothing here converts Wootton's flash-lit photograph into calibrated albedo or scattering measurements
- The model can reduce central diffuse brightness while broadening angular response. Its actual ability to improve milky tissue appearance is not established until the same-light rendered comparisons are inspected

## Required actual GPU A/B

1. Compile both fragment entries with the identical vertex/body/depth shaders, same pose/camera, same shadow map, light, exposure and palette
2. Old vs new amount=0 must reproduce matching final pixels; verify the updated program really receives both new uniforms
3. New amount=0 vs 0.65 vs 1 under **front**, **beauty/side**, and **back** lighting. Freeze every other control. Do not compensate using exposure or ambient
4. Return-only diagnostic must be dark under opposite incidence, absent source light and real shadow; nearby tubes must still occlude it
5. With back `transmission=0`, positive front return must still be measurable. With `frontReturn=0`, old backlight on/off behavior must remain unchanged
6. Compare thin/thick specimens, pale caps and shafts, rotated view, occluded roots, default/maximum density, and low-angle highlights. Inspect for new seams, view-dependent overbright rims or dim material rather than assuming the energy bound implies good appearance
7. Serialize/export/import the two new fields, including exact zero and non-default diagnostic, and reject invalid values atomically through the calling host's normal workflow
8. Confirm alpha=1, depth writes/test, no GL/JS errors and real performance. CPU tests do not establish shader compilation, browser behavior or visual acceptance
