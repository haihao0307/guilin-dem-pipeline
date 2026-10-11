# User-selected teachers: inspection, reuse, and rejected defects

Reviewed 2026-10-11. This document distinguishes copied source data, mathematical adaptations, independent implementations, and unimplemented research. Public browser evidence must refer to the exact new build, not inherited R10 tests.

## Mindfront / MakeHuman Eyebrows01

Source: https://static.makehumancommunity.org/assets/assetpacks/eyebrows01.html
Official pack: https://files2.makehumancommunity.org/asset_packs/eyebrows01/eyebrows01_cc0.zip
SHA-256: 5425891dce613bef85c7117f7843cd49d57d1fb28127e76d77d2a2eaccb4fe78

All 14 OBJ headers explicitly name CC0. The actual inspected assets are per-strand tube meshes, not texture cards. Each disconnected strand is a sequence of triangular cross-sections, usually 3–6 rings. Material files do not supply a diffuse hair atlas. The source pictures are thumbnails only, not replacements for our live geometry.

extract_brows.py parses connected components, checks contiguous three-vertex rings and taper orientation, and extracts the authored centreline. Counts by source style 01–14: 789,1144,1212,1772,1267,1776,2200,1130,1767,2111,2139,1990,1360,2430. Total 23,087. Per-OBJ hashes, ring counts and any root/tip reversal are in data/BROW_PROVENANCE.json.

MakeHumanBrows.js maps the common source reference onto GNM brow landmarks and actual component-0 skin triangles through the existing TeacherSkinBVH. Each root and curve support stores triangle and barycentric coordinates, and follows the actual deformed skin. The original MakeHuman head and tube meshes are not pasted onto the GNM head. Density selects stable source strands without moving roots. Shaft length takes arc-length prefixes. Shape parameters deliberately rebind the region. Eyelid guards are calibrated, not universal anatomy. Rejected roots are counted, never silently claimed all present. New eyebrows and retained R9 eyebrows are mutually exclusive.

## Digital Salon

Pinned revision: 4aacd4913a48d0b32012a672da2b35f27fc8f171
Repository: https://github.com/digital-salon/Digital-Salon
Primary files inspected: README.md, INSTALL.md, LICENSE, src/Scene.cpp, extern/hairsim/src/HairGen.cpp. The native HairSim.cu and solver files are identified for a future focused physics port; this release does not claim to have reproduced their full solver.

Root repository license is MIT (Digital Salon 2024), preserved verbatim. Dependencies and model assets must be reviewed independently. Desktop native C++/CUDA/OpenGL is not directly executable in a WebGL page. Some photographic output in the project is an additional AI image-rendering stage and cannot be used as proof of the browser hair shader's quality.

Useful adopted structure: separate HairRoot/HairNode/Particle identities, flat root and strand-offset arrays, and rest-length links to neighbours +1 (edge), +2 (bend), +3 (the source's torsion-distance link). StrandCore.js generates that topology from current real curves, not fabricated values. A topology export is NOT a solver.

Rejected defect: GenerateRoots allocates HairsPerTri for every selected triangle regardless of its area. Its nested Lerp construction uses three independent uniform values; the expected barycentric weights are (1/2,1/4,1/4), rather than (1/3,1/3,1/3), favouring vertex zero. We keep R3 area-weighted selection plus the exact sqrt-barycentric formula, and unit-test 100,000 samples against the source formula. This statistical property does not by itself establish biologically correct follicles. R3 regional masks, follicular units and minimum spacing still need visual and anatomical validation.

## Perm

Pinned revision: 5885a2ab66f128d7f0acb88c4518b21b7b4ad9cb
Repository: https://github.com/c-he/perm
Project: https://c-he.github.io/perm/
Primary inspected code: src/hair/strands.py and src/hair/rotational_repr.py, plus README.md and LICENSE. Other root/model files are retained for further study, not all declared integrated.

Root license is MIT, Chengan He 2024, preserved verbatim. The repository is the ICLR 2025 work. Its published architecture separates global and local structure using low/high-frequency PCA hair textures and trained generative models. Selected portable mathematics are adapted here: consecutive directions and edge lengths, integration from an anchored root, and endpoint-preserving moving-average smoothing with linearly reflected boundaries. Test round-trip error is checked at 1 micrometre tolerance.

The current browser residual is independently implemented in a local tangent/normal frame above the retained R3 macro shape. Wave amplitude, microcurl amplitude, period and smoothing are separate controls. Root and first segment remain unchanged; zero amplitude must restore the exact baseline. Residuals are bounded to 3 mm and do not establish collision freedom. This is not a port of the PCA/GAN/VAE inference, learned hairstyle generation, shape editing latent space or example fitting.

The README's CUDA/toolchain requirements and approximately 64 GB RAM note concern its full data-processing/PCA workflow, not a blanket memory claim for every inference. No neural model weights, NVIDIA vendor modules, reconstructed human heads or externally downloaded hairstyle datasets are redistributed here. The linked example collection remains a next-stage data-learning target, not falsely labelled loaded into this release.

## Explicit remaining work

Long-hair dynamics, self/body/clothing collision, general scalp segmentation, benchmarked physical hardware performance, TEN24 female integration, comprehensive body ProjectState binding, actual learned Perm generation, and cinematic-quality visual acceptance remain uncompleted. Exact file provenance and permitted reuse do not remove these engineering requirements. All previous preview versions stay accessible.
