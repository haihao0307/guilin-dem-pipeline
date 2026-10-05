# R8 continuous hair-shadow learning experiment

This isolated page compares the same GNM head, seed724 teacher-derived curves, fibre radii, BRDF, lamps, exposure and opaque-head shadows with two hair-shadow representations. Original stochastic shadows remain the default and fallback.

The optional implementation uses packed nearest depth and four cumulative RGBA16F optical-depth channels per light. Explicit ONE/ONE blending sums tau = -log(1-alpha); receiver transmittance is exp(-tau). The two lights have separate maps. Head and hair receive their own native opaque visibility multiplied by hair transmission. Four-depth interpolation and finite spatial resolution remain approximations; no exact deep-shadow or multiple-scattering claim is made.

Capability is checked in the actual WebGL2 context using a complete half-float framebuffer, two additive test draws and an RGBA8 readback. Unsupported contexts keep original shadows with a visible explanation. Memory for the four color textures is estimated at 6 MiB, excluding depth attachments, native maps and driver allocation. Diagnostics distinguish CPU submission, synchronized browser wall time, and optional non-disjoint GPU query time. Chromium touch emulation is not iPhone hardware testing.

## Learning and production boundary

Guide data are derived from Daniel Bystedt's official Blender Hair Styles demonstration and remain attributed under the source CC BY-SA terms (the source does not specify a license version). This is a learning comparison, not final independently authored KAOPU groom data. A later original parameterized groom would be a separate implementation after learning the full method. See licenses/TEACHER-GROOM-CC-BY-SA.txt and TEACHER-GROOM-PROVENANCE.json.

The original five cases and production GNM R6 are not replaced by this page. The existing geometry certificate still reports contactAcceptance=false: four tested states retain 3/2/3/3 preexisting microscopic finite-radius root contacts. Centreline, ear and repaired-tip checks are separate and are not substituted for the failed root gate. This optical comparison does not certify arbitrary expressions, hair-hair collisions or GPU antialias support.

Primary method reference: https://www.cemyuksel.com/research/deepopacity/deepopacitymaps.pdf . The exponential optical-depth mapping here is an explicit adaptation, not a copied implementation.
