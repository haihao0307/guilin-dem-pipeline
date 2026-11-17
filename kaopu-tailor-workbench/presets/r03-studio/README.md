# KAOPU Garment Studio · ATELIER R01

This is a new presentation layer over the existing R03 garment geometry library. It keeps the 60 original parameterized garment designs, 432 top/bottom combinations, the frozen mannequin, original pattern references, search, categories, favorites, view controls and paper preview.

## Visual rebuild
- Every catalogue card is rendered from the actual garment mesh through the same WebGL renderer; there are no SVG garment icons or generated vector substitutes.
- Thumbnail render resolution is 480 × 640 WebP. The renderer uses ACES tone mapping, a dark warm studio cyclorama, key/fill/rim lighting, soft shadows and a metal display plinth.
- Fabric surfaces use tiled DataTexture color, normal and roughness maps with a subtle woven/knit/satin microstructure. The underlying garment geometry and source recipes are unchanged.
- The catalogue is paginated at 18 items per page. Search/filter runs against the local catalogue immediately; thumbnails are generated progressively and cached in memory as visited.

## Verified source boundary
The original 55-item external gallery's model files were not present in the accessible repository snapshot. This rebuild therefore uses the repository's verifiable 60-style R03 catalogue rather than falsely claiming to have re-rendered those 55 external assets. The 60 styles cover tops, trousers, skirts, dresses and jumpsuits; this catalogue does not include the external gallery's hats/gloves/socks/accessory group.

## Technical boundary
This is still a static design-shape viewer. It is not live cloth simulation, sewn-pattern draping, dynamic wear, or a no-intersection certification. The source R03 README and visual review remain authoritative for these limits. No original R03/R02/R01 files are overwritten.
