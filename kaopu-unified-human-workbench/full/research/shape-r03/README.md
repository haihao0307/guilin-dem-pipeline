# R03 six-shape review, kept separate from R01/R02

This is an opt-in candidate on the same 25,417-vertex / 50,624-triangle canonical person. The existing R01 boxing animation, R02 catalogue, source models, shared head transfer, topology, full skin weights, and common default state are not modified.

## What changed

1. Wider named native regional physique parameters: upper/lower arms, thighs/calves, waist, torso depth, hip/buttock and neck.
2. Named nose, chin, mouth, brow and conservative eye-shape identity recipes independent of body-fat labels. Fat no longer drives the broad horizontal cranium control.
3. Explicit adult-only soft-tissue extension, after probing the native weight ceiling: weight-anchor displacement minus the weighted native bone-head displacement. The added displacement is regularized, restricted by the full original body weights and applied to each joint-conditioned rest contribution before skinning. It does not scale the person, replace geometry, prune weights or move joints. The existing native shoulder and body skeleton is retained.
4. A separately bounded, low-frequency native head-fat/submental field adds facial soft tissue while leaving the upper cranium and eye/dental components unchanged. Oral skin receives continuous boundary transport. A rejected region-island version is not shipped.
5. Child/teen presets do not use the extension. Adult lean bodies retain the native low-weight surface rather than extrapolating below it; the lean facial soft-tissue layer remains separate. Child values have independent modest fat/face ranges; no adult hollow-cheek recipe is applied.

`shape-r03.html` exposes only six review examples with same-camera R02/R03 switching. Full 36 expansion and integration into boxing, Jolt and clothing are deliberately gated on visual review and fresh shape-bound tests.

## Known boundaries

- Additional displacement is authored from native model anchors. It is not a calibrated BMI, diagnosis, growth model, or anatomical validation.
- The extra layer supports the Anny rig in this pilot. MHR rig use is rejected rather than silently mis-skinned.
- Native eye controls can fold tiny translated inner-eye triangles in strong combinations. Eye controls are limited and every actual preset is numerically screened; the face cameras must still be inspected.
- A face normal-dot/area screen is not a full self-intersection/contact test. Finite pose tests do not establish all-motion nonpenetration.
- Rest geometry changes invalidate old boxing separation/glove-fit, collision proxies and clothing fitting. Use `SHAPE-CONTRACT.json.gz` fingerprints, not the unchanged base adapter fingerprint, for the new shape.
- Software WebGL screenshots from Chromium/SwiftShader are real rendered geometry; they are not hardware/device FPS tests.

## Archive contract

A complete R03 recipe requires both the common state and `{schema:'native-soft-tissue-r03/1', amount}`. The legacy common-state archive alone does not contain this optional extension and must not be called a complete R03 archive. The validation contract records full states, extension amounts/source hash, geometry hash, shape hash, complete 104-bone rest matrices/parents/names, weight hash and wrist/forearm bounds.

## Frozen baseline

R02 catalogue: `full/ui/PresetCatalogueR2.mjs`; original engine and viewer loaded through `full/ui/load-common.mjs`. R01 motion: `full/boxing/`. Candidate work adds only distinct R03 files; production publication must inherit the latest gh-pages tree and preserve all other files.
