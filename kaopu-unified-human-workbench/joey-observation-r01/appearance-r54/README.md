# R54 isolated appearance integration

The R52 common human face is byte-locked in every view. A is the frozen existing R52 appearance and 8,000 R30 long strands; B adds current-mesh R14.2 root coverage (36,000 potential strands, 24 segments); C also adds a removable texture-free native eye surface. The R14.2 layer is short/mid coverage, not a completed long-hair replacement. Original long ends remain separate.

All views use perspective. Existing E04/U05/U07/profile cameras, bounded expressions and authored lights are copied without changing identity. Reference photos and private target observations are not included. The actual reference lights are approximate, not recovered photographic metadata.

The test verifies frozen positions/archive, exact source-face supports and roots, measured buffer budget, actual WebGL compilation, off/dispose pixel restoration, and automatic hair invalidation after a common-geometry change. Extra back/top coverage and close-eye perspective views expose gaps instead of hiding them. Light probes isolate finite-source reflection using the same shader with wetness zero; geometry and pigment remain fixed.

The hair layer is static: no physics or dynamically deforming groom claim. Face/pose/expression changes require rebuilding it. R14.2 still has upstream crown/coverage limitations. The eye adapter keeps the old native opaque cover; it does not add refraction, fix eyelid intersections, or manufacture contact shadows. A successful test is not visual acceptance, likeness acceptance or production deployment.

Run only in the existing isolated GitHub Actions browser workflow. It uses Chromium/SwiftShader software rendering, not a measured consumer GPU. No production page, other workbench, native model or teacher weights are changed.
