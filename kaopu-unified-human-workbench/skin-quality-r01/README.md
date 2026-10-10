# Skin sampling R01: isolated, reversible ET13 candidate

Baseline: `2702e9482cfd1655411bb0920929872669301334`, ET13-I1 on its ET12 face renderer. The existing identity preview SHA-256 remains `99942c121ec46428e980568a6b0b82c5872359bf1a7576f600ac5fa1a4a952ad`. Production R06 and its source branch are untouched. No new website or replacement model is created.

## Verified source defect and narrowly scoped change

ET12's `fPatch` samples an 8-tile atlas with implicit derivatives of `fract(mm/span)`. Across a repeated patch edge, this jumps almost a whole tile while the actual surface footprint remains small. For a 0.02 mm pixel step at the edge of a 14 mm patch, the math changes from the correct LOD -1.47 to 7.98, a spurious 9.45 mip levels. Additionally, texture reads occur in nonuniform region branches, and the original single atlas's coarse mipmaps mix unrelated region tiles.

The candidate computes derivatives from continuous native rest-space millimetres before those branches, uses explicit texture gradients, and packs the exact original atlas bytes into 8 independent array layers. Per-layer mipmaps do not cross into another facial region. It does not paint a new face or increase pore contrast to exaggerate success.

After inspecting the first real A/B close-ups, an additional sampling issue was isolated: procedural pore fading follows the 0.38 mm cell spacing, while the exponential pore core has a much smaller approximately 0.044 mm characteristic radius. The candidate now filters that analytic height kernel against a Gaussian approximation of the actual pixel footprint, including its anisotropic covariance. It preserves each Gaussian's integrated height while reducing unsupported sub-pixel peaks. `setPoreFiltering(false)` isolates the original procedural pore sampling while keeping the atlas fix on. This is an antialiasing operation, not a new pore-size, complexion or identity choice.

`SkinSampling.mjs` is opt-in and attaches to the existing material after ET13. `setEnabled(false)` restores the original shader path. Geometry, topology, native controls, all 37 identity trait controls, 4 shape additions, complexion, eye shaders, lighting, and SSS are unchanged. The module keeps the original textures for honest A/B, so the test mode adds about 5.33 MiB of GPU texture storage plus temporary CPU readback. It needs the host's WebGL2 path. No new scan or image asset is downloaded by this module.

The sample image contents are still the existing CC BY 3.0 Infinite/Lee Perry-Smith derived atlas. See `../face-transfer/THIRD_PARTY.txt`. This candidate adds original code only; it does not relicense the host or its assets.

## Run

Run `node skin-quality-r01/tests/numeric.mjs` from the workbench. The browser QA uses the unchanged `identity-lab/preview.html`, imports this module in that same page, and captures controlled A/B images on the actual native model. It checks exact geometry, index, archive, camera and light preservation, rollback pixels, original zero-master controls, four identity-trait recipes and a mobile viewport. It is not a physical phone/GPU or FPS test.

`tests/pore-filter.mjs` compares the filter to an independent 32 x 32 box-supersampled Gaussian reference at 0.019, 0.076 and 0.19 mm pixel footprints. The height-kernel RMSE decreases by 99.27%, 91.83% and 86.63% respectively. Those numbers are about this isolated mathematical kernel, not a percent improvement in facial realism. `tests/lifecycle.mjs` checks real Three texture objects with a mocked Canvas source, stable uniform bindings through five toggles, original sampler references and disposal.

`tests/browser.cjs` outputs to `qa-skin-quality-r01`. The read-only workflow has no deployment, signing, new credentials, or push step. Passing assertions is not artistic acceptance; compare the actual before/after PNGs before deciding to integrate.

## Remaining quality gaps

- This fixes sampling correctness. It does not remove the source patches' intrinsic repeat discontinuities, recognizable repetitions, or planar rest-coordinate distortion.
- Pore depth, roughness and patch span remain artistic parameters, not person-specific measurements.
- Filtering height does not reconstruct unresolved normal distributions or conserve total BRDF energy; a validated specular-antialiasing treatment remains separate work.
- ET12's RGB half-Lambert wrapping and screen-space diffusion are approximate. Neither is thickness-aware volume transport. Their coefficients are intentionally unchanged here.
- Large scars and wrinkles remain ET13 bump/geometry choices. No stress-driven wrinkle simulation is added.
- Native face shape, eye anatomy, facial likeness, all parameter extremes and film/AAA-level realism are outside this candidate's acceptance claim.

See `RESEARCH.md` for the primary-source findings and staged quality criteria.
