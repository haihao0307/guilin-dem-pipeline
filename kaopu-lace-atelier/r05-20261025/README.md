# KAOPU Lace Atelier R05

[Open the standalone workbench](./index.html)

This is a versioned public preview copied from the private R05 research build. It contains the procedural lace generator, standalone Three.js runtime, recipe controls, and research notes. Previous published versions remain untouched.

## Validation boundary

- Source/UI, geometry, sampling, and standalone build checks passed for the published source snapshot.
- The R05 yarn profile and backlit-thread changes were compared with fixed-camera native EGL/Mesa renders at 32 samples and 2400×1800 render resolution.
- These are offline diagnostic renders, not browser screenshots or target-GPU performance measurements. Browser/WebGL, real mobile hardware, shadow/transparency composition, and motion aliasing are not yet accepted.
- The backlit-thread term is a restrained direct-diffuse approximation, not a complete volumetric or wave-optics fiber model.

See [build manifest](./BUILD_MANIFEST.json), [R05 validation notes](./R05_STATUS_20261025.md), and [transmission experiment](./R05_TRANSMISSION_EXPERIMENT.md).
