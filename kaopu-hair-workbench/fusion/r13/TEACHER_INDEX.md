# R13-M1: three teachers, indexed by the problem we actually need to solve

Reviewed 2026-10-11. Current work starts at the user's accepted R12 short-hair baseline. Retired teacher long-hair presets and the TEN24 female viewer are not runtime dependencies of R13. Existing versions are not deleted.

## MakeHuman Eyebrows01 — retain the working surface adapter

Primary source: https://static.makehumancommunity.org/assets/assetpacks/eyebrows01.html
Asset pack: https://files2.makehumancommunity.org/asset_packs/eyebrows01/eyebrows01_cc0.zip
Fixed SHA256: 5425891dce613bef85c7117f7843cd49d57d1fb28127e76d77d2a2eaccb4fe78

Contains 14 CC0 per-strand tube geometries. R12 already extracted 23,087 source centrelines. R13 preserves `MakeHumanBrows.js`, `BrowData.js` and per-file provenance unchanged, rather than claiming that extraction happened again. Its root/support triangle IDs and barycentric coordinates are the relevant solution to brow attachment. R13 exposes a small retained brow selector and density control; full brow/beard editing remains in the unchanged R12 link.

Lookup rule: malformed eyebrow outline -> source centreline and extraction provenance; drifting roots -> triangle/barycentric support; density -> deterministic strand selection. Eyebrows01 is not a scalp-hair generator and cannot supply women's long hairstyles. MakeHuman's broader proxy.py (AGPL3, https://github.com/makehumancommunity/makehuman/blob/a8bc2d54ff0ac92e78ff71431b1023eda42bf482/makehuman/shared/proxy.py) is a separate code license. It has NOT been copied into this runtime. Asset CC0 does not relicense the whole application.

## Perm — decompose the haircut before adding curl detail

Fixed revision: 5885a2ab66f128d7f0acb88c4518b21b7b4ad9cb
Project https://c-he.github.io/perm/
Model wrapper https://github.com/c-he/perm/blob/5885a2ab66f128d7f0acb88c4518b21b7b4ad9cb/src/hair/hair_models.py
Strands https://github.com/c-he/perm/blob/5885a2ab66f128d7f0acb88c4518b21b7b4ad9cb/src/hair/strands.py
Metrics https://github.com/c-he/perm/blob/5885a2ab66f128d7f0acb88c4518b21b7b4ad9cb/src/eval_blend_shapes.py

`guide_strands(theta)` / `superresolution(roots,img,beta)` separate coarse haircut shape from local residuals. `guide_roots`, root-relative positions and the separate mask are useful interfaces, not proof of biological follicle density. `eval_blend_shapes` measures position and curvature errors against known reference curves. The repository includes `.pkl` network checkpoints via external links and fitted parameters for USC hairstyles; these are NOT downloaded or run by R13.

Actual R13 adaptation: `LengthKernel.compileGroom` produces coarse 48-segment guides, arc-length samples them to 24-segment followers, interpolates root-relative displacements and applies root-normal alignment. Macro length/part/volume live separately from fine local waves. A zero-wave control does not rebuild the root set. Generated guides are inspectable in the actual scene; they are not arbitrary lines sampled after rendering. Three self-authored styles are authoring candidates, NOT Perm-generated outputs, learned latent fitting or a trained PCA texture decoder.

Lookup rule: wrong silhouette -> inspect macro guide curves and region lengths before adjusting noise; overly smooth/coiled result -> inspect residual layer; different-root interpolation -> check root-relative coordinates and arc-length alignment; hairstyle-data import -> review both sample license and head coordinate alignment first. The next length stage can add offline fitting once an independently licensed, multi-angle target is selected. We do not load pickle files from unreviewed sources into CI.

## Digital Salon — guides, followers, frame transport and obstacle fields

Fixed revision: 4aacd4913a48d0b32012a672da2b35f27fc8f171
Generation https://github.com/digital-salon/Digital-Salon/blob/4aacd4913a48d0b32012a672da2b35f27fc8f171/extern/hairsim/src/HairGen.cpp
Runtime https://github.com/digital-salon/Digital-Salon/blob/4aacd4913a48d0b32012a672da2b35f27fc8f171/extern/hairsim/src/HairSim.cu
Contracts https://github.com/digital-salon/Digital-Salon/blob/4aacd4913a48d0b32012a672da2b35f27fc8f171/extern/hairsim/src/HairSim.cuh
Shader https://github.com/digital-salon/Digital-Salon/blob/4aacd4913a48d0b32012a672da2b35f27fc8f171/shaders/Hair.frag.glsl

Useful contents and destinations:

| Source area | Problem it addresses | R13 state |
|---|---|---|
| `InterpolateHair`, `InterpolateStrands`, `InterParticle` | Dense render hairs need not all be independent simulation guides | Adopted hierarchy, independently implemented 3-guide root-relative interpolation with part membership |
| `ComputePFTs`, `LoadComputePFTs` | Curl/ribbon axes should not flip along a curved strand | Independent deterministic minimal-rotation transport, including parallel/antiparallel cases |
| `SFieldCPU`, `HeadCollision`, `TriInterpSdf` | Hair leaving the root domain still needs solid-head avoidance | Independent lazy 3mm actual-triangle signed-distance grid, trilinear interpolation and sampled projection; static neutral head only |
| `GenerateParticles`, `StrainLimiting`, `MoveRoots` | Later dynamics needs rest lengths, fixed roots and strain limits | Retained conceptual roadmap; no R13 dynamics |
| PIC/FLIP, spring forces, head friction | Dense long-hair motion | Deferred, not a copied/running CUDA solver |
| `CutHair`, selection operations | Future local interactive restyling | Deferred; current native controls alter rest-groom parameters |

Rejected as-is: equal counts per selected triangle; vertex-biased nested random Lerps; nearest-only whole-strand duplication; blending across a part; random perturbations merely to avoid parallel frame degeneracy. R13 keeps the R12 area-weighted root sampler and its root IDs at a fixed quality level. The straight-distance +3 link called “torsion” by the source is not a full material twist degree of freedom. No rod-twist or full friction certificate is claimed.

The source's C++/CUDA/OpenGL runtime cannot simply execute in a browser. R13 takes targeted mathematical/architectural support, not native binary or restricted demonstration data. Primary source notices are preserved in `licenses/`. Our R12 fibre optics and layered shadows are retained; the Digital Salon still-image/AI demonstration is not used as the webpage render.

## Diagnosis before filling a reported bald patch

Check root-domain inclusion, active root counts, intended parting, rejected bindings, guide-family membership, actual final curve positions, and finally shader/opacity. A bare region alone does not prove which one failed. Do not add density to hide an unknown mapping or rendering defect. R13 exposes actual roots and actual generation guides and keeps region counts in diagnostics; these are NOT a medically/anatomically validated baldness map.

## Length ladder and engineering boundaries

R12 remains accepted short-hair reference. R13-M1 develops 45–160 mm target top-guide arc lengths (not equal length at every follicle), with separate fringe, side and back factors. Shoulder-length and longer women's hair remain the next stage and require neck/shoulder/body collision geometry, including multi-angle visual review. This head-only stage neither promises full-head dynamics nor substitutes an unverified woman model.

Further growth does not require three incompatible data systems. The shared GroomDNA root/guide/region/rest/detail contract can dispatch length-appropriate authoring and physical solvers. The current stable head identity, units, source hash and schema stay explicit. Browser root counts/segments have real memory cost; compressed network bytes are not GPU memory or performance measurements.
