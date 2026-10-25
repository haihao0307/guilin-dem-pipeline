# KAOPU Lace Atelier — quality research and execution plan
Date: 2026-10-25
Status: active research plan; not a release approval

## 1. Evidence and what transfers to lace

### Physical lace structure (lace-specific evidence)
- Museo del Merletto, “Lace technique and materials”: https://museomerletto.visitmuve.it/en/il-museo/building-and-history/lace-technique-materials/
- The Met, “Gems of European Lace”: https://www.metmuseum.org/exhibitions/listings/2012/european-lace
- SFO Museum, “Lace: A Sumptuous History”: https://www.sfomuseum.org/exhibitions/lace-sumptuous-history/gallery

These sources distinguish needle lace built through loop/buttonhole stitches from bobbin lace built by crossing/braiding multiple threads. Motifs, fillings, connecting bars/ground and edging are not interchangeable decorations. Our current procedural motif generator is a useful visual study, but its crossing net is explicitly a visual interlacing model, not a machine-specific stitch notation. Do not claim craft-accurate topology until stitch paths and joins are checked against a named lace technique.

### Appearance and performance evidence (woven/knit fabric research, transferable with limits)
- NVIDIA Research, Yu et al., “Realistic Cloth Rendering with a Ray-Wave Hybrid Shading Model” (SIGGRAPH Asia 2025): https://research.nvidia.com/labs/rtr/publication/yu2025realistic/
  Models reflection and transmission through plied yarn/fiber structure, including instance variation and aperture diffraction. Transfer the separation of structure, reflection, transmission and hole diffraction; do not claim a woven-yarn model directly solves open lace.
- Cornell, “Modeling and Rendering Fabrics at Micron-Resolution”: https://research.cs.cornell.edu/ctcloth/index.htm
  Supports fiber-level microgeometry, measurement-based flyaway fibers and compact procedural representations. Transfer the multi-scale design and memory/performance discipline, not necessarily the paper's periodic-cloth assumptions.
- Huang et al., “Real-Time Knit Deformation and Rendering” (SIGGRAPH 2025): https://kuiwuchn.github.io/rtstitch.html
  Reports yarn-level geometry plus fiber-level rendering, with example performance on RTX 3090. This is knitted structure and a particular research implementation, not a direct performance promise for our lace or consumer GPUs.
- Irawan & Marschner, “Specular Reflection from Woven Cloth”: https://www.cs.cornell.edu/~srm/publications/TOG12-cloth.html
  Emphasizes view/light-dependent appearance and physically meaningful fiber/yarn parameters rather than arbitrary image tuning.

- Xia et al., “Predicting Fabric Appearance Through Thread Scattering and Inversion” (SIGGRAPH 2025): https://mandyxia.com/research/fabrix.html
  Uses measured physical threads, a multiple-fiber scattering model, and two-scale rendering to fit reflection and transmission. The linked research code includes [TraceDisks](https://github.com/mandyxmq/TraceDisks), a 2D ray tracer for disk-based scattering. It is a research instrument, not a drop-in lace shader; use it to understand scattering/validation concepts, not to claim 3D lace parity.
- Dai et al., “Shared neural representation for real-time fabric rendering” (online 12 Oct 2026): https://www.sciencedirect.com/science/article/pii/S0097849326002384
  The accessible abstract describes a multi-scale shared representation and separate reflection/transmission direction encoding. Full paper/code were not verified in this session, so this remains a research lead, not an implementation dependency.

## 2. Diagnosis of the current R04/R05 baseline

Known from the current repository's own R04 validation:
- R04 softened some fill-stitch turns but its visual review still says the overall result is too regular and hard.
- R04 primary geometry increased 27.5% and total triangles increased about 24.16% relative to R03. This cost is not yet justified by a passed visual comparison.
- Existing net, motif outline, fill and trim are separate layers; real browser WebGL, target-device GPU timing, full shadow/transparency composition and fixed HTTPS delivery are not yet accepted.
- The cloud preview has previously reported WebGL context unavailable; a native EGL/llvmpipe image is diagnostic evidence only, not browser or consumer-GPU proof.
- R05 currently explores a tiny deterministic interior relief change. It is a hypothesis, not yet evidence of a perceptual improvement.

## 3. Work order — one controlled hypothesis per iteration

### Gate A — baseline and measurement
Freeze three specimens (botanical, rosette, ribbon), recipe seeds, 38-degree perspective, actual specimen scale, and five lighting/view states: neutral studio, grazing light, backlight, front/back, and oblique macro. Record exact camera and light values. Capture reference photographs with attribution and compare the same regions without postprocessing.

### Gate B — topology and craft logic
For each specimen, choose and name a target technique (e.g. needle lace vs bobbin lace). Draw the thread continuity graph and classify motif outline, filling stitch, ground, joining bars and edge finish. Test intersections, endpoint ownership, gap preservation and front/back crossings. Keep the existing generic mode labelled “stylized procedural lace” until a specific craft structure is validated.

### Gate C — yarn cross-section and relief
Compare flat/elliptical and gently twisted multi-ply sections. Avoid identical cylindrical cords. Add controlled, correlated variation in cross-section, strand phase and small relief; avoid independent random noise that looks dirty or broken. Preserve topology and endpoint contracts. Measure added vertices/segments before adopting a candidate.

### Gate D — fiber appearance
Compare three explicitly switchable treatments: no fuzz, low fiber halo, directional short fibers. Use material-space scale and actual light/view directions; test silhouette, grazing light and backlight. Prefer instanced/analytic representation over one geometry object per flyaway. No new full-resolution fiber mesh unless a measured benefit justifies it.

### Gate E — openwork optics
Treat thread surfaces and openings separately. Test opaque yarn plus physically interpretable transmission/shadowing first, then a small diffraction/edge-softening approximation only if it survives controlled comparison. Do not fake hole realism by simply lowering the entire fabric opacity. Keep the background, cast shadow and transmitted light independently measurable.

### Gate F — scale stability and performance
Test 1:1 scale at overall, close and macro distances; rotate the specimen and lights to expose moiré, aliasing and shimmer. Record path count, segment count, triangle count, draw calls, CPU submission time, GPU frame time where available, memory, and stationary settling cost. Do not introduce fixed distance LOD; use continuous screen-space sampling/filtering only if it preserves the visible silhouette and hole structure.

### Gate G — garment integration
Only after a material candidate passes, bind to existing garment material coordinates and test curved seams, folds, body contact, stretching and backface behavior. This stage is not the same as rendering a flat swatch. Do not claim fabric physics from a visual surface adapter.

## 4. Acceptance rubric

Score each 0–4 against a real reference under the same observation setup:
1. Stitch logic / continuity
2. Thread softness and cross-section
3. Open-hole clarity and negative-space pattern
4. Directional highlights / fiber detail
5. Backlight transmission and shadow
6. Front/back consistency
7. Overall-to-macro stability
8. Performance within the agreed budget

A candidate cannot be promoted if any structural criterion is zero, if silhouette/holes change unexpectedly, or if it only looks better in one lighting setup. Report both wins and regressions. Passing CPU tests is not visual acceptance.

## 5. R05 work completed in this iteration (2026-10-25)

- Confirmed the R05 A/B control and recipe persistence exist in the branch; the earlier conversational claim was not itself evidence. The implementation was checked in the actual app, display module, UI test and CI workflow.
- Fixed a geometry/shading consistency defect: the generated positions used 0.008/0.002 three-/six-lobe amplitudes, while the normal calculation used 0.012/0.003 and still retained that lobe profile when A/B was off. Position and normal now share the exact same profile function coefficients; A/B OFF normals describe the true unlobed ellipse.
- Added numeric ply-envelope strength 0–2.5 to the geometry API and bounded UI control (UI range 0.25–2.5; zero remains available for geometry-level tests). The slider changes only the profile amplitude. It does not add vertices or indices. The net remains excluded.
- Added regression tests for the analytic ellipse normals in A/B OFF mode, a strength sweep, unchanged topology and finite normals; extended UI checks for strength persistence and validation.
- Validation must be reported from the newest Actions run, not from a previous run. Artifact-upload quota failure remains a separate delivery blocker. No visual improvement is claimed until a live browser comparison exists.

## 6. Immediate task
Finish R05 regression tests without weakening the existing R04 preservation assertions. Then compare R04 and R05 using the same native diagnostic setup and, separately, regain real browser WebGL and fixed HTTPS delivery. Because Actions artifact storage is currently quota-blocked, preserve that required failure rather than masking it; use repository-hosted diagnostic images only as clearly labelled intermediate evidence, never as a replacement for a live, interactive workbench.

## 6. Release discipline
- Keep this branch and PR Draft; do not merge, force-push, rewrite history, change site audience/authentication, or replace old versions.
- No “top-tier” or “production-ready” claim without same-camera real-reference comparison, browser/WebGL interaction checks, and target-device GPU measurements.
- If a gate cannot be run, state exactly which gate is blocked and why.
