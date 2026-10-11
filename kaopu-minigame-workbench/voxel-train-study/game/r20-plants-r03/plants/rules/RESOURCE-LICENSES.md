# Musa resource provenance

The selected original native78 Musa specimen has six generated RGBA resources: support/albedo, support/normal, support/roughness, foliage/albedo, foliage/normal and foliage/roughness. Their actual `source` metadata is `kind: procedural`, `license: CC0-1.0`, with exact generator IDs beginning `tropical-library-76/musa-balbisiana/`. Dimensions, color spaces, byte lengths and SHA-256 values are retained in the source proof and independently pinned SQLite recipe.

That existing CC0 metadata applies to those procedural resource pixels only. It does not relicense project code, geometry, scenes or packages. Botanical reference photographs, illustrations, third-party plant meshes and the mother's unused photographic wood proxy table are not part of this Musa distribution. No new general software licence is asserted.

Three.js 0.179.1 is used for original generation/render object construction, with its MIT licence retained in `../vendor/THREE-LICENSE.txt`. Bundled upstream dependency notices remain in the generated module. The train's existing renderer and licence are unchanged.
