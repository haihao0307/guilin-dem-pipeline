# R03 first-run QA failure review

Status: the first R03 browser run failed. No R03 visual, pixel-comparison, performance, fresh-reader or publication PASS is claimed by this review.

## Bound evidence

- Run: [39102640232](https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/39102640232).
- Job: `117601865721`.
- Source and verification commit: `3e5d1dfb11cb8a40982e3ff964d06d2ff13d4d0f`.
- Fixed unverified build: `be2b7b70f9a08e9f5e053c8ac9d22e8396672499`.
- Production module SHA256: `c3bc194d725628746395c9a8f68ad7ab74ba0470568ef639410d6962a3a32919`.
- Builder SHA256: `ca50a5929da3b4e0f2fb66d9b12b6bd0ecd5d5fd991491318c190d4777ef5435`.
- Failed verification script SHA256: `5115e0a1843174419dd790c3932c8a45f5a115294040db2367b43dca0d8a2e3b`.
- Public candidate HTML SHA256: `eb4855c6e34a728536821b04c419ff5427dc621dd20f33200782e7498c1cce18`.
- [Artifact 12127561625](https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/39102640232/artifacts/12127561625): 14,349 bytes; downloaded ZIP SHA256 `3ae77996afe54801c7f757141f4b90fe5aa57c598ef6f6ab47f44abdd9c68932`, matching GitHub's digest.
- Artifact records: `qa/detail-r03/39102640232-1/qa.json` and `progress.jsonl`, with the build manifest and the failed run's other raw files retained. There are five files and no PNGs.

## Observed failure

Both fixed public HTML readbacks matched their expected bytes. The fixed R01.1 and R03 pages each reached native readiness, submitted real scene draws and completed startup GPU drains without GL, runtime, console or resource errors. Source protection, original defaults and ancient host-file compatibility passed.

`same person P01-closed` began at `2026-10-18T06:07:24.449Z` and failed at `06:08:36.229Z` with `AssertionError: Blank framebuffer`. No baseline-person download stage or PNG was reached. In the script's sequential order, this identifies the first `frame(base, 'P01-closed-frozen-r01-1-beauty')` read, before the R03 comparison. Both contexts and Chromium subsequently closed successfully. The final record correctly has `completed:false`, `shareAllowed:false`, and no publication proof was produced.

The failure record did not persist that complete pixel buffer or its nonuniform-pixel count. It therefore does not establish an exact all-zero full image. The startup and final drain records sampled `[0,0,0,0]` while renderer counters remained nonzero; these drain samples are completion checks, not visual acceptance.

## Root cause and bounded correction

The failed QA optimization removed `viewer.render()` from `frame()`. It attempted to read a frame submitted by an earlier production action. However, `controlledView()`, `archive()` and several `snapshot()` evaluations occur before `frame()` runs in a later browser task.

The frozen host's embedded Three.js renderer defaults `preserveDrawingBuffer` to `false`; the actual viewer constructs that renderer with canvas, antialias and power-preference options without overriding the default. Its default framebuffer need not retain an already composited frame across those tasks. `gl.finish()` drains pending work but does not redraw a cleared default framebuffer, and old render counters do not prove retained pixel content. This identifies the QA readback lifetime defect; the failure happens on the unchanged R01.1 baseline.

This lifetime requirement is also described by the [Khronos WebGL specification's Drawing Buffer section (editor's draft)](https://registry.khronos.org/webgl/specs/latest/1.0/#THE_DRAWING_BUFFER), which recommends synchronous access in the same rendering function when the drawing buffer is not preserved.

The correction restores the already successful R01.1 capture sequence: call the complete native `viewer.render()`, then `gl.finish()`, then full CPU RGBA `readPixels()` synchronously inside one browser evaluation. The native wrappers and context attributes remain intact. Each capture records actual context attributes, before/after render counters, returned-thenable status, GL status, dimensions, pixel hash and nonuniform-pixel count before assertions. It also requires the renderer counter to advance within that same callback.

Only the QA frame helper and this review change. The production module and builder remain frozen at the hashes above. Blank-frame rejection, exact RGBA comparison, independent ROI, geometry/calibration equality, the 20% performance limit, all required tests, successful cleanup requirements, and the 24-minute QA budget remain unchanged. A second fixed public run must establish the actual result of this correction and all subsequent gates.
