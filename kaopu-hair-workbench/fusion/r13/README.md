# R13-M1 — short-to-mid progressive groom, first static authoring stage

User direction: keep the accepted R12 short-hair baseline, increase length in stages, build multiple mid-short/mid-length styles, remove the old female teacher hairstyle from the runtime and use the three selected teachers as indexed technical references.

Base: `5d420df72b94c089d38be934a02aa4b8323404fc` (R12 delivery recovery). Only new `fusion/r13` and dedicated workflows are changed. Keep Draft; no merge, force push, branch reset, baseline overwrite or additional hosting service.

## Working candidate

Three self-authored rest-groom presets: textured micro-part fringe, longer side part, and centre-part layered fringe. Top-guide target arc-length range 45–160 mm; preset defaults 85/110/135 mm. Native buttons expose 55/80/110/140 mm steps plus a continuous slider. Regional fringe/side/back length factors, part position/openness, root volume, lateral flow, clumping, tip variation and a separate wave residual are editable. Actual resulting median and upper-percentile arc lengths are measured rather than presented as equal to requested length.

The R12 root sampler is reused with its area weighting and neutral conservative scalp mask. Root position and triangle binding do not change between length/style edits at the same quality. Coarse generation guides are independently grown away from the scalp boundary; followers interpolate three same-part guides using root-relative coordinates. A deterministic transported frame carries local detail. The model is the same hash-verified GNM head, with one visible head surface, not an ellipsoid replacement. A 3mm cached signed-distance field of its actual triangle mesh supplies sampled neutral-head avoidance.

The original source hairstyle data, the retired teacher haircut menu, and the TEN24 female viewer are not included. The 14 CC0 MakeHuman eyebrow centrelines/adapter remain unchanged; original complete short-hair, brow and beard controls remain accessible through the fixed R12 link. R13 is a focused new length stage, not a replacement of all prior features.

## Durable source, tests and release

`prepare.py` copies selected fixed R12 modules and adds only an export for the root sampler. `src/LengthKernel.js` and `src/app.js` are readable new source. `BASE_LOCK.json` records inherited bytes. `bundle.mjs` uses pinned esbuild; `package.py` embeds JS/CSS/notices into one HTML with one fixed-hash compressed GNM asset dependency and original-source fallback. No model weights, user images or old female assets are uploaded.

Tests: `tests/kernel.mjs` tests recipe validation, roots, same-part followers, transported frames, length progression, deterministic restore and cancellation on the actual original GNM asset. `tests/browser.mjs <URL> [--public]` drives real native controls and actual pixels, three styles/multi-angle views, the length ladder, manual save/restore, inspector, brows, lighting, JSON export and 390×844 mobile viewport. Reports and screenshots belong to their exact build, not inherited R12 passes.

Public delivery is complete only after a real external browser loads the fixed HTML and verifies its bytes and interactions. The published SHA and link belong in `PUBLIC_URL.txt` and the delivery receipt after verification. A local computational fixture or a screenshot alone is not public delivery.

## Boundaries

This is a **static rest-groom** stage, not physical hair growth, true follicle anatomy, wind, dynamics, rod torsion, self/body/clothing collision, women's shoulder-length hair or cinematic acceptance. SDF projections and sampled polyline tests do not establish continuous swept-radius collision freedom. No Perm neural/PCA inference or Digital Salon CUDA runtime is running. Current interpolation and fibre optics remain approximations; individual strand style and multi-angle silhouette need user review.

Default new mid-hair budget: 64,000 roots and 24 rendered segments; mobile viewport default 36,000; optional 96,000. This does not lower/change R12's original budget. Root counts are potential roots; active counts are reported separately. More segments and roots consume real CPU/GPU memory. Software GPU screenshots are not a user's physical-device performance certificate.

The local editing environment cannot navigate/render WebGL; local Node tests use real GNM bytes, while actual browser testing is run in dedicated GitHub Actions. Do not label local head fixtures as public browser runs.
