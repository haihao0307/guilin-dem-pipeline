# GNM source-guide experiment

This is an isolated research candidate. The existing GNM R6 page and the five older workbench cases remain unchanged.

The head uses the same complete Google GNM model and official XRBlocks evaluator. Scalp and eyebrow guides derive from Daniel Bystedt's Blender official Hair Styles source. The source data retains the original guide groups, part islands, and brow subregions; root binding and child interpolation adapt these to GNM. See TEACHER-GROOM-PROVENANCE.json and its source-provided CC BY-SA notice. No original Blender head, original preview image, private user asset, or original .blend is served here.

The actual browser rendering is a bounded real-time approximation with per-directional-light PCF visibility, light-facing ribbon depth silhouettes, and analytical projected coverage. It is not a complete Cycles, Karma, Marschner or multiple-scattering solution. Single-depth stochastic shadow maps approximate fractional coverage. The fine-strand default uses order-dependent alpha blending; A2C is available for an explicit comparison and reports actual framebuffer samples.

Controlled comparisons:
- Teacher-derived free 3D guides versus the old R6 shape, on the same GNM head
- Shadow on/off with identical curve buffers
- Analytical coverage on/off with identical curve buffers
- Blend versus A2C at DPR1/2, with measured framebuffer samples
- Warm/cool/ambient-only light contributions
- Neutral, fixed identity and fixed semantic-expression attachment

Only the specified demonstration parameter states are tested. Local cached clearance constraints are not a proof of collision-free behavior over all 636 GNM parameters. Known contacts, source modifications and correction magnitudes must remain recorded in the numerical reports. A technical QA pass does not imply visual acceptance.

The standalone file is generated only for QA by tools/build-experiment-offline.py. It preserves both official weight files byte-for-byte and is not duplicated in the repository. The HTTP candidate loads the pinned official weights separately.
