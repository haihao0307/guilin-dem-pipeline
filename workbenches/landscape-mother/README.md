# Landscape Mother B1: source-specific reconstruction

The user's latest instruction authorizes one source-driven cliff reconstruction, not another generic karst landscape. The root index and reference entry now lead to the same original/fit viewer. Paddy and river categories remain unbound. No previous scene recipe is imported. The seven-file core and all regional assets remain untouched.

## Actual executable path

A user selects a local GLB, or restores the previously saved same-origin B original. The file is hashed and decoded without mutation. Area-weighted face samples are grouped by 3D spatial support and normal direction. Each support carries a measured center, normal and bounded quadratic coefficients. Coplanar region candidates, sharp-edge candidates, upward-facing ledge candidates and low-height base candidates are recorded separately from geological interpretations.

`rebuild(recipe)` has no source mesh argument. It evaluates the numeric oriented surface field on one fixed 3D grid and constructs entirely new isosurface topology. It does not draw the source as the generated result, retain source indices, clone the source geometry, add generic rock noise, or use camera-dependent precision. This is a source-specific geometric fit, not yet a transferable geological rock-family generator. Do not call all observed folds or sharp edges confirmed fractures.

The original and generated geometry share one camera, projection scale, lighting model and optional source-derived numeric color field. Input image evidence is sampled only on CPU to obtain per-region mean color; no UVs, images, numeric textures or texture samplers enter either 3D render path. This low-frequency color field does not recover a complete PBR material or its fine surface structure.

## Evidence and uncertainty

All source geometry remains available on the left. The new topology is independent. The original file hash is checked again after the run. Two-direction face-centroid-to-triangle distances are measured with a BVH; sample maximum is explicitly not a full Hausdorff error bound. Full index topology counts expose open edges, components and nonmanifold incidence. Source-specific fitting may create additional boundary loops or small components; these are reported, never silently marked approved or filled. The original model's physical scale, geography and geology stay unverified.

Current task execution could not find a mounted copy of the original `huge_nordic_coastal_cliff_venrdcgga_high.glb`. It did find the supplied screenshots and the prior repository custody receipt. Therefore no original-specific new fitted recipe, visual comparison or fidelity result has been asserted in this commit. The online application performs those measurements from the actual user-selected file. QA fixtures are artificial tests and never appear as default/user cases or enter the public file manifest. The earlier original custody receipt is historical intake evidence, not evidence of this new fit.

## Gates

`node --test test.mjs`; `node test.mjs --compile EVIDENCE_DIRECTORY`; `python browser_qa.py --url STAGED_URL --output EVIDENCE_DIRECTORY`.

Browser QA uses a labelled synthetic wall at a 2048 x 1152 viewport and a 390 x 844 mobile viewport. It checks actual module workers, recipe exports, unchanged source hashes, fixed geometry during camera motion, no WebGL texture allocations and actual screenshots. Mobile viewport testing is not physical-phone performance evidence. The local execution container blocked browser navigation and did not expose WebGL2; public/staged browser success must come from actual CI, not that local attempt.

Publish only the existing `landscape-mother-workbench/` Pages directory. Preserve every unrelated public subtree and all source branches. Never bundle the user GLB or textures. Keep `visualApproved=false` and `productionReady=false`.
