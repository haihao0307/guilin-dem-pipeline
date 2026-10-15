# HK three measured buildings, material trial R01

Open `viewer/` through a local HTTP server. The entire viewer uses bundled dependencies. No source photograph or remote texture is fetched. Building positions are arranged for comparison; each building retains its measured size and recorded geographic anchor.

Three modes share the camera: preserved source geometry, editable recipe reconstruction, and procedural material. Original geometry references load only when source comparison is requested. The default reconstructed material scene must start without those reference files. Source geometry remains unchanged.

Geometry is derived from three CSDI non-textured building models. Facade material assignments, moisture, ageing, optional window colour patterns and small display courts are experimental choices. Windows are disabled by default and do not form surveyed openings. The ground is a small authored presentation surface, not a DEM or verified original paving. No private vegetation library is redistributed.

Shared reconstruction, material functions, receivers and renderer are counted once. Per-building recipes, source-only reference files and generated buffers are reported separately. The three current recipes demonstrate editable reproduction, not a proof of universal compression savings. See `qa/byte-ledger.json` and `viewer/provenance/storage-accounting.json`.

## Local checks

- `node geometry/test_reconstruction.mjs`
- `node --test viewer/tests/*.mjs`
- `python qa/check_package.py`
- `node qa/benchmark-reconstruction.mjs`

`geometry/verify_geometry.py` gives additional finite surface/cross-section tests and requires NumPy. `qa/check_package.py` independently decodes source accessors and node transforms, verifies original hashes, and checks finite bidirectional vertex/centroid samples, patch area and coverage. These are numeric encoding checks, not claims of sub-millimetre survey accuracy.

## Real-browser gate

`qa/browser.cjs` uses actual Chromium/WebGL, with Playwright 1.57.0, to capture the source/reconstruction/material views, close/middle/whole-building views, environment toggles, an emulated phone viewport and completed draw timings. Evidence belongs in `evidence/`. A script existing or CPU tests passing does not mean this gate passed. Software SwiftShader timings are not physical-device FPS, and emulation is not physical-phone acceptance.

The final technical candidate passed focused real Chromium acceptance at commit `3988c42ac4ed8ab78e3c3d604bc6dd2791aa8146`, with 12 actual screenshots. The earlier complete 32-check run retained 26 screenshots and camera-return pixel evidence. See `RELEASE.json` and its linked GitHub Actions artifacts for the exact runs and image hashes. Shadow on/off ablation identified the diagonal bands as receiver shadow acne; the final camera-independent shadow fit removed those bands without changing the material mothers. This remains a technical material trial, not cinematic visual completion. Plaster remains low-contrast, facade openings are unknown, and physical-device performance is not measured.

Source rights and limitations: `LICENSE_SCOPE.md`. The original CSDI files and licences/notices are retained.
