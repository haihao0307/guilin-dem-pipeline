# R03 connected-wind learning experiment

An isolated additive study in 分形造波研究. Source baseline: `95ac11fe07b7940818321fc6be8b56778c3389de`, directory `kaopu-tree-fractal-wave-lab/kuko-day123-native-3d-r03`.

The original branch/bud generator remains byte-identical. Default seed 123303 preserves every original rest coordinate, branch radius and bud. No existing published entry, R02/R03 source, Pandanus plant, coral or vegetation generator is changed. The baseline has branches and buds; it does not contain leaf clumps or a root-system model.

## Evidence and implementation boundary

Observed reference: [Variable Spirit Plant](https://variable.io/expo-2025-spirit-plant/) shows connected branches, local direction frames and spatially differentiated wind-like motion. The [official technical case](https://variable.io/notes/spirit-plant-software-and-network-architecture-a-technical-case-study/) documents parameter/seed identity and component instancing.

Our independently written `src/connected-wind.js` uses a continuous analytic wind field sampled at immutable rest midpoints, projected against branch orientation. Dimensionless hierarchy/support gains control bounded joint rotations. Child origins stay on a fixed fraction of their parent branch; branch lengths are preserved. This is a one-way kinematic experiment, not recovered Spirit Plant code, calibrated plant mechanics, collision simulation, or inertial integration. No third-party artwork is embedded or republished.

Existing Three geometry and four instance meshes are reused. View, pose time and diagnostic toggles do not regenerate topology. A default-seed special case preserves the original hash function's output exactly; other seeds generate stable alternative rule instances. The “恢复原始种子” button resets only the seed, not the growth controls.

## Run internally

1. `python acquire_vendor.py` verifies pinned Three r186 MIT bytes
2. `python patch_runtime.py && python build.py`
3. `node tests/numerical.mjs` and `node tests/runtime-smoke.mjs`
4. With Playwright 1.51.1 installed: `node tests/browser.cjs .`

Build outputs are self-contained HTML, with no core network request, CDN dependency, external asset or server requirement. Browser QA runs file:// in actual Chromium / ANGLE SwiftShader, explicitly software rendering and emulated viewport only. A Node mock-renderer test is logic evidence, not visual QA.

## Delivery gate

- No generated images replace a real implementation
- Actual production functions and runtime instance transforms are changed in this isolated experiment
- Candidate is an interactive real-time Three 3D workbench
- Screenshots are internal QA evidence only
- Public deployment and public browser validation are not yet performed
- Visual acceptance and production-ready status remain pending; do not promote from numerical passes alone
