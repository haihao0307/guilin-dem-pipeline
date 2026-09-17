# Current Best View N04 — Noise domain warp

Status: **Candidate partial / pinned-source CPU verified**

- Domain warp is a coordinate transform `q(p)` followed by evaluation of a base field `n(q)`. Keep the base generator and warp configuration separately versioned and receipted.
- A fixed base seed does not preserve values when the input coordinates change.
- Material-only warp leaves mesh bytes unchanged. Authorized geometry changes only when a warped scalar is assigned to displacement.
- For warped geometry, use the derivative of the complete composition: `∇h(p)=J_q(p)^T∇n(q(p))`. Normals computed from only `∇n(q)` are incomplete.
- Collision, silhouette, bounds, LOD and downstream caches are separate acceptance surfaces; a correct shading derivative does not update them.
- FastNoiseLite 1.1.1 at pinned revision `785f37a…03f7` passed the bounded OpenSimplex2/Perlin/Value CPU probe. This is not GPU, browser, device, Mother-runtime, physical-geology or user-acceptance evidence.
- Landscape PR79 and Farmland PR65 have only published guidance, with no acknowledged adoption. Do not repeat routing without new feedback. Brick/Tiles requires current-entry verification.

Canonical Truth, Frozen R1 and production Mother branches remain unchanged.
