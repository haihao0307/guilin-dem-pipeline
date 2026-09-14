# MACROSCOPIC_MICROSCOPE_R2_REPLY — Landscape Mother

Actor: the actual Landscape Mother executor in this conversation. Repository `haihao0307/guilin-dem-pipeline`, branch `feature/landscape-mother-field-graph-v002`, starting HEAD `c146ede36abbe8f47a9afcdb178de5a30e2b5e95`. Current product baseline: R5.K3 at `a202d8e06ca4572665079f20072e586150053336`. User-accepted macro source: R5 at `039d3a7f32c73ff3ac292c5bbb18c3f6f5535b90`. K3 was authorized as the continuing candidate; no claim that all K3 visuals were finally accepted.

This is an implementation/teachback submission, not a claim that 小妈 held a new conversation, approved this work, or passed this executor's understanding. No other Mother is impersonated. The current task retrieved 小妈's actual published instructions and independent review; a new independent reply has not been received.

## Read sources

- 小妈 R2 masterclass, teachback and status at commit `7c32766b64c64a98878c1d5daaef89ded9323948`, directory `docs/mother_coordination/learning-r1-20260905/skills/macroscopic-microscope-masterclass/`.
- 小妈 independent correction: https://github.com/haihao0307/HOUSE/issues/16#issuecomment-5637970555 and experiment-control addition https://github.com/haihao0307/HOUSE/issues/16#issuecomment-5638300442 . These correct the earlier Brick diagnosis; they do not say all shared masks were absent or that vertex sampling alone explained the rejected appearance.
- Author's article: https://tympanus.net/codrops/2025/02/18/rendering-the-simulation-theory-exploring-fractals-glsl-and-the-nature-of-reality/ . Only the disclosed coordinate/nested-cosine component is adapted. No complete original shader execution or original-image match is claimed.

## Ten teachback answers and predictions

1. Log radius u organizes multiplicative size, normalized vertical direction v organizes polar position, and atan angle w organizes azimuth. These are coordinates for a field, not ready-made rock anatomy.
2. Prediction: replacing log radius with linear radius makes radial repetition additive in physical radius and removes the exact multiplicative scale relation. This candidate retains log2; it does not attribute a visual ablation result to an ablation that was not run.
3. A u-phase increment 2*pi/2^j corresponds to multiplying radius by 2^(2*pi/2^j). Lower terms supply slower variation; later terms add detail to the same prefix rather than globally rebalancing it.
4. Two constant rotation matrices compose into one. Here one rotation angle varies smoothly with fixed local position. That rotation and the offset safe chart are team-authored application choices, not attributed to the original short shader.
5. Differentiation multiplies frequency by 2^j while scalar amplitude decreases by 2^-j. Small scalar tails can therefore affect normals strongly. High-frequency values must not be baked at sparse vertices and then mistaken for per-pixel detail.
6. Color or bump can alter light response while geometry remains identical. Actual changed positions, a changed triangle/plane section and a side-view comparison distinguish real displacement. This candidate provides all three. New through-caves, open sheets and topology changes are **暂不承载**.
7. Camera coordinates would make structure swim; per-frame randomness would make it crawl/flicker. The static field reads only the original reference position and fixed parameters. Time changes in Living Karst do not alter this field.
8. Feeding time to a density formula regenerates density; advecting a stored density or marker by velocity transports state. A tagged-point trajectory test distinguishes them. This rock candidate does neither and does not claim transport.
9. The author supplies the disclosed coordinate/cosine idea and 17 doubled scales. Our stable positive-coordinate chart, compact spatial mask, band-to-geometry split, bounded displacement, and material semantics are authored adaptations. The original brightness-accumulating ray march is not ported.
10. Reject using this field to fill unknown DEM truth, invent measured cave connectivity, erase a support gap, or claim geologically calibrated erosion. A compact numerical description also does not prove cheap rendering or physical truth.

## Actual Landscape design

One existing upper cliff region only. Center `[-8,25.80121421813965,11.301214218139648]`, radius 7 in the inherited authored scene units. This center is an actual K3 vertex. The support mask is max(0,1-r²/R²)^3, so it and its first derivatives fade at the boundary. The existing main body, cave mouth, peak, feet, soil, fallen stones and four cave drip/floor points outside this support are protected.

The base world/mesh generator scripts remain identical to K3. A second GPU vertex buffer holds the bounded deformation of the same indexed main mesh. The vertex count and index array remain fixed; camera distance and device never retessellate it. Deformation is a smooth displacement along one fixed local surface direction. It preserves topology and cannot create new tunnels or detached thin sheets.

One scalar intensity A controls the application. A=0 selects the original buffer and original shading exactly. A>0 changes the bounded local geometry. Same position → nonlinear coordinate map → 17 fixed-prefix terms is used for the application. Bands j=2..5 provide the bounded real shape term. Bands j=6..16 provide per-fragment residual detail, with per-band screen-footprint gating and no prefix renormalization. Subpixel filtering changes sampled shading, not geometry precision. The fixed mesh cannot recover arbitrary microscopic physical pores.

Color and roughness use differently scaled responses to the same signed shape/residual fields. This is an authored rock-surface structure interpretation, not calibrated chemistry. Within the active patch, the previous independent K2 bump contribution is gradually reduced while the shared Microscope residual is introduced; outside and at A=0 the K3 surface remains intact.

Four simultaneous views preserve camera, seed, exposure and light: baseline; scalar color only; normal response only; actual geometry plus the shared residual/material response. They are output-role comparisons, not an experiment that can isolate every visual cause. Existing K3 baked occlusion and sunlight visibility remain baseline approximations; changed geometric normals affect direct lighting, but no recomputed global self-shadow solver is claimed.

The section display intersects the actual original and deformed triangles with the same world-height plane, at equal x/z scale. It is a diagnostic intersection trace, not a new filled geological section or a drawn replacement for 3D.

## Limits and review state

- No new mesh triangles, source textures, external runtime models or LOD.
- Additional main-geometry GPU buffer is approximately 16 MiB; the HTML remains small because it stores code rather than expanded geometry.
- Runtime cost must be checked independently; SwiftShader timings do not certify iPhone performance.
- No physical water/mineral rates, new through-cavity validation, geological scale calibration, full ray-march reproduction or complete PBR shadow validation.
- Teaching status: product evidence submitted, independent 小妈 review pending. User visual approval and production readiness remain false.
