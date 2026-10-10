# Regional groom R02 — independent draft

R01 stays at ../isolated-groom-r01/ and merge 1e04485610b20e0c3309415d579f51f345ef4c68. R01-ANCHOR.json records its published source and tests. No human-platform code is changed.

R02 replaces the old axis-aligned scalp exclusion with a continuous lower scalp boundary and a conservative GNM-neutral pinna guard. This is an explicit artistic approximation, not an ear anatomy label: GNM has no dedicated ear region in the loaded metadata. Candidate triangles crossing the boundary are sampled with point rejection instead of removing the whole triangle. Region density weights redistribute the fixed 18,000 scalp root budget; no global count increase.

Eyebrows use 1,200 bound roots with medial upward, body convergence and lateral tail directions. A separate 4,800-root facial field distinguishes chin, moustache, jaw, cheek and sideburn coverage. Clean, chin/moustache, full short-beard and moustache-only presets use index selection without allocating new root arrays. Population variation is supported conceptually; these fixed demo thresholds are not medical or anatomical norms.

?roots=1 shows coloured preallocated root fields on the actual GNM surface; colours include roots hidden by a chosen draw-density or beard preset. It is diagnostic, not a scalp texture or a substitute head. All visible hair continues to use R8 fibre shaders and explicit alpha blend.

Read REGION-RESEARCH.md for primary observations, professional anatomy references and limits. No paper figures, teacher curves or restricted model weights are included. Existing GNM/Three licences remain. Test regions.mjs checks actual roots and guards; browser-regions.cjs captures front/side/back, beard presets and coloured roots. Film-quality, physical hair, body collisions and human-platform integration remain unaccepted.
