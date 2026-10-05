# GNM source-guide experiment

This is an isolated research candidate. The existing GNM R6 page and the five older workbench cases remain unchanged.

The head uses the same complete Google GNM model and official XRBlocks evaluator. Scalp and eyebrow guides derive from Daniel Bystedt's Blender official Hair Styles source. The source data retains the original guide groups, part islands, and brow subregions; root binding and child interpolation adapt these to GNM. See TEACHER-GROOM-PROVENANCE.json and its source-provided CC BY-SA notice. No original Blender head, original preview image, private user asset, or original .blend is served here.

The actual browser rendering is a bounded real-time approximation with per-directional-light PCF visibility, light-facing ribbon depth silhouettes, and analytical projected coverage. It is not a complete Cycles, Karma, Marschner or multiple-scattering solution. Single-depth stochastic shadow maps approximate fractional coverage. The default uses the explicitly recorded source-scaled radii and order-dependent alpha blending; A2C is available for an explicit comparison and reports actual framebuffer samples.

Controlled comparisons:
- Teacher-derived free 3D guides versus the old R6 shape, on the same GNM head
- Shadow on/off with identical curve buffers
- Analytical coverage on/off with identical curve buffers
- Blend versus A2C at DPR1/2, with measured framebuffer samples
- Warm/cool/ambient-only light contributions
- Neutral, fixed identity and fixed semantic-expression attachment

Only the specified demonstration parameter states are tested. Local cached clearance constraints are not a proof of collision-free behavior over all 636 GNM parameters. Known contacts, source modifications and correction magnitudes must remain recorded in the numerical reports. A technical QA pass does not imply visual acceptance.

The standalone file is generated only for QA by tools/build-experiment-offline.py. It preserves both official weight files byte-for-byte and is not duplicated in the repository. The HTTP candidate loads the pinned official weights separately.

The ear-repair candidate is evaluated against real GNM triangles in the four named display states. Conservative ear envelopes are routing aids only after a local geometric contact trigger. The recorded numerical reports distinguish actual intersections, finite-radius bounds, unchanged curves and correction magnitudes; they do not establish arbitrary-identity or arbitrary-expression collision freedom. Caster-isolation images keep the same curves and receivers, separating head-only from fibre-only shadow casters.

The authoritative displayed-runtime contract is seed724 with the identical vendored THREE.BufferGeometry.computeVertexNormals path. Earlier seed8124/custom-normal reports do not certify this page. See ORBITAL-RUNTIME-CONTRACT-724.json and EAR-RUNTIME-CERTIFICATE.json for exact browser buffer comparisons. The four demonstrated states have no remaining skin/eye centerline crossings and pass the ear and repaired-tip finite-radius tests. A broader orbital-region audit still finds unchanged baseline root-segment micro-overlaps; these remain a failing contact gate and are not silently waived.

A separate controlled shadow-seed probe changes only offsets0.271 and0.619 in the existing light-pass occupancy threshold. It fixes curves, lamps, depth bias, map dimensions and PCF filter, checks actual depth uniforms, and restores offset0 with an exact pixel check. Offset0 remains the default; this diagnostic is not a new shading solution.
