# Ocean Life Mother R03.A — source-field checkpoint

Date: 2026-09-18. This is an isolated, actually executed research increment inside the original Ocean Life branch. It does not replace the R02 ecosystem, Bird, Game Mother, or the existing KAOPU reader. No new universal KAOPU format is declared.

## Actual increment

The uploaded FISH-REF-001 largemouth bass is now fitted into separable continuous scalar fields, rather than a hand-authored generic fish shape. Each field evaluates as a sum of products of one-dimensional cubic curves in two parameter directions. Source UV charts are used as temporary observation/correspondence apparatus; this is NOT yet the final longitudinal/anatomical species coordinate system.

Nine unique chart fits represent the source's 16 connected surface components by sharing seven measured mirror pairs and keeping the two eyes independent. Source-side mirror equality was checked numerically, not inferred from biological symmetry. This statement means every component has a candidate representation; it does not mean every source point is reproduced or its boundary coverage is complete. Multiply-covered chart locations are flagged and excluded from the accepted sampling domain, not called bijections.

The scalar fields separately retain position, base color in linear RGB, alpha, roughness, shading normals, geometric normals, and emission. Metalness is the source's constant zero and the source specular factor is preserved. The four original texture files, original triangle indices, source vertex arrays, skin weights and full animation tracks are not included in the runtime payload.

The viewer generates disposable surface samples and renders GL_POINTS with tangent-plane depth correction. There are zero fish or coral triangle buffers in THIS isolated viewer. This is not a claim that the existing R02 ocean/bird pipeline is triangle-free. The current display uses about 80,772 generated samples for the fish, not 80,772 stored model vertices. Sampling and display caches still have memory and evaluation costs.

Source-derived motion-study harmonic amplitudes/phases are reused on a newly integrated 32-section centerline. Mapping to the new continuum is a candidate, not a faithful complete skeletal-animation transfer. Eye, gill and jaw articulation is NOT completed. Size variation is only a size experiment, not evidence of juvenile-to-adult growth.

Three color experiments (gold/blue, orange/white, cyan/purple) are implemented and exercised. They are variants of the same test fish, not three named marine species. Brain-like green/purple coral fields and a tapered 31-branch staghorn-like study are implemented and exercised. These are geometric/mathematical candidates, not identified Palau species or validated growth biology.

## Measured evidence

The source file is 18,644,040 bytes. The current packed coefficient JSON is 1,447,908 bytes; gzip is 1,017,382 bytes; the complete local study HTML is 1,467,002 bytes. This is lossy source-to-field conversion, NOT lossless compression or a final minimal species score. The original source is retained unchanged. The explicit int16 factor quantization has separate error measurements; it does not change canonical source evidence.

Off-lattice validation used 9,000 separately sampled source-surface points. In the main chart's 5,000 samples, geometry error relative to reference length was: median 0.0522624908%, RMS 0.0939420326%, 95th percentile 0.1835322262%, maximum 1.0424164562%. Its discretized parameter-domain mask retained 4,940/5,000 samples. Linear RGB RMSE was 0.0665499936. These are measured errors, NOT passing species/visual thresholds. Do not quote the median alone or equate source units with independently measured metres.

Seven mathematical/decoder tests passed, covering finite repeatable scalar evaluation, explicit quantization checks, rejection of a corrupt coefficient span, brain positional/derivative seam samples, deterministic branching, and finite generated coral samples. Brain positional seam maximum was 3.65e-16 and the finite-difference derivative seam maximum was 1.67e-11 in the tested samples. These do not prove global chart injectivity or all-scale fidelity.

Chromium/Xvfb/SwiftShader executed the HTML at 1280x900 and 390x844; 1024x768 additionally exercised all three palettes, purple-brain selection, pause and generated-spine checks. No page or WebGL errors were observed. Pause stopped study time. One sampled normalized spine-length error was 2.60e-8 after float32 transfer. Motion phase now uses elapsed study time rather than silently slowing animation through a per-frame delta clamp.

The screenshots were actually inspected internally. The black bass now resembles the provided asset rather than the old generic fish, but close-range normal/surfel aliasing, mouth/fin-edge inaccuracies, and rough coral ridges remain visible. Staghorn framing was corrected after an initial top crop. Software FPS is low and variable, including samples below five and a low startup sample. This is not an iPhone performance acceptance.

The preview retains alpha data but currently uses alpha threshold coverage, not a validated translucent-fin solution. Lighting and tone mapping are study choices; do not claim matching the author's original PBR scene or complete material fidelity.

## Persistence and reproduction

The code checkpoint is in this directory. The generated coefficient files, HTML, full reports and internal screenshots currently exist in the active runtime under `/mnt/data/ocean_r03/`; the large coefficient payload and generated HTML have NOT been uploaded to GitHub. The original GLB remains the user-provided conversation attachment. A future run must verify availability, not pretend it can read missing sandbox files.

With the exact uploaded reference available, use Python with NumPy, SciPy, Pillow and Numba. Set `KAOPU_SOURCE` to its path. Run `python tools/fit_chart_fields.py`, then `python tools/compact_fields.py`, `python tools/build.py`, `python tools/heldout_qa.py`, and `node tools/kernel_qa.cjs`. The source reader is intentionally hash-locked to this specimen; other fish require their own source identity and mapping. `xvfb-run -a python tools/browser_qa.py` executes the local study through Playwright and Chromium. The additional interaction receipt is local; do not claim it has been rerun remotely.

Final tested local HTML SHA256: 053d5f742e0dcc6171ad19630e02e3b2ef41d1bb46ce86963e33bcc8d16bbde6.

## Publication boundary

No R03 public entry has been deployed. The current runtime's outbound DNS to the public source host failed. Local set_content tests are NOT final public HTTP or browser-navigation tests. `shareAllowed=false`. Do not send a guessed R03 URL, a download in place of online preview, or the unchanged R02 URL labelled as R03. Preserve all earlier published dependencies.

## Next bounded task

First improve close-range appearance and source-domain boundaries while preserving the current specimen correspondence. Compare the normal-field fit, display sampling footprint and source high-frequency material separately, rather than blaming all errors on the shared function concept. Report local maxima and omitted domains. Then split the mouth/jaw/gill/fin semantics and establish an anatomical coordinate mapping suitable for shared species recipes; the source-chart factorization is only an intermediate.

Do not restart with a guessed fish. Do not pursue an arbitrary tiny byte target by erasing source detail. Do not claim that a pair of coordinates proves anatomical correctness, or that one adult reference supplies a verified growth history. Keep the existing scalar field core, established KAOPU semantics, source licenses and necessary-residual rule. Use existing Xiaoma records as method references; no independent Xiaoma meeting or reply occurred in this round.

Reference: DigitalLife3D, Model 67A - Largemouth Bass, https://sketchfab.com/3d-models/model-67a-largemouth-bass-e60c457636b640629747c19feac4906c ; embedded CC BY-NC 4.0. The study is source-derived and not commercially cleared. PBR channel semantics were checked against https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html . Boids local-neighbourhood research is retained as a later behavior reference, https://www.red3d.com/cwr/boids/index.html ; no new ecological/Boids integration was claimed this round.

visualAcceptance=false; anatomicalAcceptance=false; materialFidelityAcceptance=false; motionAcceptance=false; gameIntegrationAcceptance=false; productionReady=false.
