# R47 bounded learning cycle — Gaussian reference compositor

## Question

Can a minimal fixed-source CPU compositor combine the already identified Three.js r186 DC, kernel/alpha, sorting and projected-ellipse behavior without treating the component checks as independent image-error guarantees?

## Evidence status

- **Observation:** pinned Three.js r186 sets `KERNEL_2D_SIZE=0.3`, derives `alphaScale=sqrt(detBase/det)`, evaluates the Gaussian as `exp(-r2/2)`, discards outside `r2>4`, uses normal non-premultiplied alpha blending, and obtains draw order from the 4096-bin sorter.
- **Observation:** pinned Niantic SPZ intentionally allows DC base colors outside display range so higher SH can bring them back; this is the same source lineage used by R35, not an independent root.
- **Candidate executable evidence:** the R47 CPU equation replay renders a deterministic 33×33 two-splat control and four ablations. Two identical runs produced SHA-256 `eea674b77236fd8210d6b8954cf20d7a87d6ba6e3cc61a555e984b7258e4b186`.
- **Unknown:** direct TSL/WGSL execution, GPU floating-point/raster edge behavior, browser color/tone-map output, learned-asset distributions, target-device behavior and human acceptance.

## New or corrected knowledge

1. Component errors are not generally additive after transparent compositing. In this fixture the combined maximum linear RGB error was `0.0851303`, greater than every single ablation: DC `0.0483221`, order `0.0434365`, ellipse `0.0467564`. Maximum alpha error was `0.0779273` and the maximum non-additive RGB residual was `0.0895575`.
2. R46's kernel-expanded size needs an alpha qualifier. A `0.00341946 px` isotropic base scale became `0.548022 px`, but the center alpha multiplier became `3.89741e-5`; at a half-pixel diagonal offset it was `1.69535e-5`. The continuous `alphaScale × sqrt(det)` proxy matched the pre-kernel `sqrt(detBase)` exactly for this isotropic control.
3. The R46 cap counterexample remains: `1499.6867 px` versus `1453.6189 px` raw major axes both display as `1024 px`, hiding `46.0678 px` of raw difference.

## Counterexamples and boundaries

- **Rejected:** “passing separate DC, covariance and sorting checks implies a bounded sum of final pixel errors.” The source-over weights change with order and footprint.
- **Rejected:** “the 0.3 kernel making a quad about 0.548 px wide means the original tiny splat becomes comparably opaque.” Alpha compensation can make its contribution extremely small.
- **Preserved:** “equal capped display axes do not prove covariance fidelity.”
- All numerical values are derived fixture results in linear channels. They are not perceptual metrics, real-photo results, GPU screenshots, physical accuracy or acceptance thresholds.

## Routing

Prepared-only guidance goes to the Photo Reconstruction Tool Mother candidate and Three.js Delivery Mothers: retain the component reports, then run a combined fixed-view compositor comparison. Object DNA-bearing Mothers receive no production action.

Mother feedback remains null and acknowledgement false. The Sep 13 Mother SL003 relay concerns a different water/density question and is not Gaussian adoption evidence. First-tier expert AI was not called; no expert or Mother meeting was duplicated.

## Next real gap

Execute this exact two-splat fixture through pinned r186 TSL on an actual WebGPU/WebGL-fallback backend with framebuffer readback, explicit color-space/tone-map settings and edge-pixel checks. Compare to the CPU linear reference before any target-device or real-photo threshold is proposed.
