# R03 wood/glass receiver API

Import `buildWoodCase`, `buildGlassCase`, `WOOD_FINISHES`, `GLASS_RECIPE`, and optionally `woodMacroHeight` from `../wood-glass.mjs`. Supply the existing Three r170 namespace as the first argument. No bundled Three copy is needed.

## Shared contract

Both builders synchronously return `THREE.Group`. Add this to the caller's scene. Models use metres and local procedural coordinates; place the returned group anywhere without changing its local material fields.

- `group.userData.update({wear, strength, mode})` updates bounded scalar uniforms in place and returns the group. `wear` and `strength` are 0..1. `mode`: 0 physical shading, 1 base colour, 2 roughness, 3 microheight (wood) / thickness (glass), 4 damage / deposit mask.
- `group.userData.dispose()` disposes owned geometries and materials; remove the group from the scene separately. It does not dispose the caller's environment or renderer.
- `group.userData.receiver` describes provenance, retained source, additions and limitations.
- `group.userData.materials` exposes the timber or glass materials for inspection.
- `variant: 0` is the unaged reference. `variant: 1` enables the new bounded finish/deposit receiver. Both use identical source fields, component geometry and deterministic per-member seeds.
- Optional `shaders: []` receives compiled shader objects. This is unnecessary for `update()`.
- Rebuild the group for finish, object, seed, dimensions or glass thickness changes. Scalar update does not silently pretend to update these.

## Wood

`buildWoodCase(THREE, {variant:1, finish:'warm', wear:.65, strength:1, object:'window', mode:0})`

Finishes: `warm`, `aged`, `weathered`, `chestnut`, `paint`.

The first four map directly to original mother presets: `yunnan_warm_medium_v2`, `yunnan_dark_aged_v2`, `yunnan_light_weathered_v2`, `yunnan_lacquered_chestnut_v2`. Their palette, roughness range, relief scales and clearcoat coefficients are retained. The old adapter's walnut palette is not used as an original preset. `clearcoat` and `lacquer` alias `chestnut`.

`paint` is explicitly a new opaque green coating over the warm original mother. A single new deterministic edge/patch damage mask controls exposed wood colour, roughness, microheight, cavity and clearcoat loss. Intact paint hides wood colour and wood microheight. The 65 μm coating edge is a bump-height layer, not explicit flakes. Original low-frequency substrate geometry still exists under the coating.

Objects:
- `window` (default): 1.0 × 1.42 m assembled wooden window frame, mullion, meeting rail, sill and a detached cut board. Approximate bounds: x ±0.60 m; y 0.012..1.62 m; z −0.055..0.401 m.
- `board`: separate board; optional `length:1.35`, `width:.28`, `depth:.035`, all positive metres.
- `round`: optional 1.35 m long, 0.12 m radius round member, from the complete original mother cylinder geometry and round shader mode. Not the box-only `wood-core` transport. It is not necessary to expose this in the first UI.

Each member's local +X axis follows its grain; turning a stile in the assembly rotates both member and grain. Original growth rings, fibres, pores, cracks, tools, knots and microheight remain. Macro displacement is a CPU transcription of the original vertex macroField with a 12 mm seam taper. Bounding boxes and normals are recalculated from displaced positions. The precise amplitude remains the source preset amplitude rather than being exaggerated for screenshots.

Differences from the standalone mother: physical lighting is Three's BRDF; original parallax is off; the finish mask is new and not a calibrated history/aging model. The old adapter's fixed walnut finish is saved only as an audit snapshot.

## Glass

`buildGlassCase(THREE, {variant:1, thickness:.014, compareThickness:.060, wear:.65, strength:1, mode:0})`

Both thickness values are positive metres, at most 0.3 m. The main 0.70 × 1.12 m pane and the smaller 0.36 × 0.58 m comparison coupon use closed 12-triangle boxes. Actual geometry depth equals each material's optical thickness. The default 14 mm pane keeps IOR 1.52, transmission 0.91, roughness 0.045, attenuation distance 3.5 m and the original colour/attenuation colour. Opacity stays 1; absorption is not implemented as alpha fading. Three's transmission pass handles the materials (`transparent:false` avoids a second alpha-blending mechanism).

Each pane has its own genuinely opaque coloured/striped target behind it so the transmission buffer has visible background evidence. Target geometry lies at z about −0.25 m. The new deposit mask stays in each pane's local coordinates and affects roughness, local tint and transmission consistently. It is not a recovered mature glass mother.

Approximate full bounds: x −0.68..0.69 m; y 0..1.43 m; z −0.256..0.19 m.

Three r170 transmission is screen-space and limited. No multi-pane mutual transmission, caustics, off-screen refraction, spectral glass or architectural multiple-reflection certification is claimed. A 14-to-60 mm absorption difference is physically modest at 3.5 m attenuation distance; do not compensate by changing opacity or falsely inflating absorption.

## Suggested framing

For paired groups translated to x ±1.1 m: camera `[0,1.55,5.5]`, target `[0,.81,0]`, about 35° vertical field of view. Oblique inspection: `[3.6,2.2,5.8]` looking at the same target. The caller must provide useful reflection lighting/environment and opaque background support.

## Source and licensing

`wood-glass-provenance.json` contains exact source locations and SHA256 hashes. The executable timber snapshot is byte-identical to the verified original and hashes to `ce6a10b73516cb3fe64b389c167daab6625354e2ea9a67c08ca6ab94c8b5df9c`. The snapshot modules under `sources/` are audit copies, not standalone import targets. The user project sources did not supply a uniform MIT license. Three remains separately MIT-licensed. No external textures or restricted originals are embedded.
