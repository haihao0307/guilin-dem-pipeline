# Timber receiver: bounded original-parallax restoration experiment

This is an independent local/QA candidate. It does not update the published room.
The reviewed room-slice renderer and all mother modules remain unchanged. No
mesh, object table, image material, sampled field, new noise or colour adjustment
is introduced.

## Source evidence

Recovered timber v3 source SHA-256:
ce6a10b73516cb3fe64b389c167daab6625354e2ea9a67c08ca6ab94c8b5df9c.
The original fragment applyParallax lines 501–533 performs up to 12 layers and a
linear crossing interpolation; main lines 550–557 supplies member-local grain
position, normal and view. The existing translated mother keeps coarseRelief
but had deliberately left the view-ray iteration to the receiver.

Bed slab member coordinates are world Z,Y,X relative to its centre, with source
+X along the 2.4m bed length. Legs use world Y,X,Z relative to each leg centre.
The same permutations must apply to the world-space viewing direction. The
current mappings and metre units were verified and are retained.

Original actual-shader diagnostics (commit 75204b5e1cb02af2ed5342c32278f33acfa91096,
full and grazing door-board views, unmodified source shader) already show subtle,
low-contrast matte timber. They are source-behaviour evidence, not a pixel
comparison to this room's different member, lighting, camera and renderer.

## The one change

wood-parallax.mjs restores the source applyParallax arithmetic, including its
0.30 facing clamp and normalized tangent convention. It samples the existing
coarseRelief and returns metre-domain source coordinates for the existing wood
albedo/roughness/cavity/specular/clearcoat sample. No height is multiplied to make
an improvement appear larger. The source nominal 1.05mm parallax is multiplied
by the original member reliefScale 0.7741619322 (about 0.813mm before the facing
and sampled-depth factors). The finite maximum coordinate excursion is 2.710mm.
The runtime mode occupies existing 144-byte uniform padding, no new buffer.

woodParallax=0 is the retained baseline. woodParallax=1 enables the view march.
Changing the mode only affects shading samples; field intersections, world
sizes, micro/macro geometry, base normal query and shadow geometry stay fixed.

## Explicit boundaries

- Restoring a missing source path is not a promise of visible material quality.
- This isolated experiment does not shift the existing geometric micro-height
  normal field to the parallax-hit coordinate. Original fragment perturbation
  and the receiver's whole-field normals are different evaluation strategies;
  this is not full GLSL pixel equivalence or complete relief-transport recovery.
- Original screen derivatives are still the translated nominal physical AA
  footprint. Grazing footprint and derivative equivalence remain unverified.
- Original timber has no unified age/wet/repair mechanics. Changing those
  controls cannot invent a source weathering history.
- Current preset is yunnan_light_weathered_v2: roughness 0.8928438769,
  clearcoat 0, specularLevel 0.13 and grainContrast 0.2090269716. Low-contrast
  matte response and sparse pore/crack gates are partly source behaviour.
- Bed slab is still the approved analytic slab plus four legs. The source
  timber module does not supply a detailed bed joinery system.
- All timings from Actions are SwiftShader software-WebGPU test data, never
  real-device performance.

## Existing source preset options, not selected in this experiment

- yunnan_dark_aged_v2 (deep aged timber): source preset grainContrast .275
  versus light-weathered .205; roughness range .82–.93 and specular .17.
  Best source-native option to test for stronger grain contrast and an older
  indoor wood palette. It changes colour, not actual time-evolving wear.
- yunnan_warm_medium_v2 (warm medium): contrast .225, roughness .72–.87,
  specular .21; softer and less matte than the current preset.
- yunnan_lacquered_chestnut_v2 (lacquered chestnut): roughness .44–.63,
  clearcoat .32, specular .32, contrast .20. Better source-native coat/highlight
  visibility, but less weathered and micro/parallax amplitudes are smaller.

No preset is changed here. The current light-weathered preset has the largest
original micro/parallax/macro amplitudes of these four, so switching presets is
not automatically a stronger relief result.

## Validation and stopping point

Run node qa/wood-contract.test.mjs. Official Actions then renders one native
96x64 crop at the unchanged wood camera and full 480x320 projection: before /
after lit, albedo, normal, material ID, and baseline fallback. It requires zero
exhausted rays, complete accounting, fixed camera/ray statistics, unchanged
normal pixels and exact fallback pixels. Parent review decides whether this
small effect is useful. No new candidate publication is authorized by this QA.
