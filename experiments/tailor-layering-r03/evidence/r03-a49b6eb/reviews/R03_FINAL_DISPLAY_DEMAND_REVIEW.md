# R03 corrected source — independent display and demand review

## Decision and scope

**PASS for the display and render-demand members of run 39539509515, source a49b6eb9bdf9f3bb097a4470465bc463d97dfb7b. This is not final release or public acceptance.** No production file, CI test, tolerance or captured evidence was edited for this review. The reviewer did not rerun World or a browser.

The new source must still complete its own continuous, reentry, native-baseline and native-perturb gates, then deployment and independent public desktop/mobile verification. The old source 74c20ec failed reentry and remains rejected. Its failure, diagnostic limitations and receipt remain separate historical evidence.

## Artifact identity

| Member | Job | Artifact | Original ZIP SHA-256 |
| --- | --- | --- | --- |
| display | 119023772191 | 12319090927 | a51d0b493f4466497d85bd80124bc4fe2532846939e1b5906d0976492f77c0e9 |
| demand | 119023772264 | 12319111392 | 20ae9db5af448e5e5c8d936f6a83c74f3cddfb2d5d1f13ffd922cd7130f2e91c |

Both ZIP digests and sizes were verified against the GitHub artifact API before safe extraction. Actual checkout logs identify a49b6eb. Both browser metrics and the generated runtime capsule provenance agree exactly. All 15 authored file sizes and SHA-256 values match the frozen local source. Both numerical TAP files contain 38 passes, 0 failures and 0 skipped/cancelled tests. Both browsers recorded 89 requests, all HTTP 200, zero page/console errors and no forbidden requests. The existing three warnings are two duplicate Three.js imports and one unsupported KHR_parallel_shader_compile extension; neither browser lost its WebGL context.

Raw artifacts: `r03-final-ci/display/` and `r03-final-ci/demand/`.

- Display metrics SHA-256: `6dbcdfff1c2e9fb1927f4a374245eb2e39b018fef79eecc8e2136a8bc4d31f6e`.
- Demand metrics SHA-256: `e6356f93489a20489593f66a878d380713c0c98e6e4b13af96f8d053b7d0e367`.
- Capsule: `r03-final-ci/display/runtime-capsule.json.gz`; decoded JSON alongside it.
- Generated SOURCE_PROVENANCE.json SHA-256: `eb32f4a3fcd70fb935e1511f854fefb2241b798f8b05d21e081ef077bbfcc4e3`.
- Capsule has 308 entries. The coordinator separately reconstructed and recursively read back runtime tree `114feff8d1b1c79a9a164fc8a99b181507d1cc89`, 308 blobs and 106,247,499 bytes. This reviewer did not duplicate that tree reconstruction; no deployment is implied.

## Display findings

The reviewer inspected the original initial, isolated, recolored, detail and separated screenshots. The original bald native person, beige V-neck outer, pale-blue inner and dark denim shorts remain recognizable. The detail image retains dense individual knit strands, openings, folds and irregular hem; the separated view shows distinct garment surfaces. Isolation and recoloring visibly affect the selected outer. No blank canvas or raster substitute was observed.

The five new canvas PNGs are byte-identical to the previous R03 display artifact. The new initial canvas is also byte-identical to the original R02 handoff canvas: 882 × 716, SHA-256 `700265353e9d6a6cf3b5ac65dae1fbe23b618f062f9bbb6a12f77bc421b5460f`. An independent RGBA comparison finds zero channel difference. These are initial presentation comparisons; all display observations are at physical step zero.

At 1440 × 1000 the initial page places the new contact-demand row near the lower viewport edge. The demand scenario's original scrolled screenshots show the complete `按需接触计算` control, `原约束不变` label and work statistics clearly. Public desktop and 390 × 844 mobile scrolling/touch evidence remains required.

## Demand findings

This job tests **render demand**. It does not test R03 contact-demand ON/OFF solver equivalence, which belongs to the native replay tests.

The four ABBA trials start from identical position, normal and topology digests and physical time/step zero. Every trial performs exactly one real measurement response. ON makes zero geometry uploads and submits zero frames in each trial. OFF makes two host deformation uploads per garment and one completed frame in each trial. The original ON/OFF PNG files are byte-identical; independent pixel comparison confirms zero difference. This demonstrates avoided work on unchanged state; the deliberately paused state is not counted as successful dynamics.

The hidden-geometry scenario then performs **26 actual accepted physical steps**, advancing to 0.21666666666666692 seconds. Every retained step response was checked for a successful step, consecutive counter/time and unchanged physical gates. Maximum reported stretch is **1.449862480496904**, maximum cloth residual **0.4916631733980423 mm**, maximum seam gap **0 mm**, and body half-thickness overlap **0 mm**. Six selected states at steps 1, 6, 12, 18, 24 and 26 have retained full geometry and independent complete triangle-pair reports with zero intersections/degenerate triangles. All six raw gzip hashes and report identities were verified.

The saved final hidden pants/inner positions differ from the initial digests; their topology hashes are unchanged. Their upload counts remain 9 while hidden, with newer snapshots pending. Display restoration uploads snapshot 37 at physical step 26, advances each upload count to 10, and clears the pending rows. The complete physical report before and after restoration is identical. The final measurement audits all 9,402 physical cloth vertices, finds zero inside-body vertices and zero half-thickness overlap. Its explicit inspection is correctly marked measurement-only with no simulation advancement.

The reviewer inspected the original isolated-sustained and restored-newest-hidden-geometry screenshots. The latter shows the full original person and three materials after real deformation, with readable controls and statistics. No frozen-geometry or failed-solve recovery is counted as a successful step in these reviewed records.

## Reproducible readback and limits

`scratch-review/review-r03-display-demand.py` produces `scratch-review/r03-final-display-demand-readback.json`: **321 checks passed**. This is a read-only artifact review, not a substitute for the original tests. It checks saved arrays/digests, each dynamic report, raw audit file hashes, provenance, log checkout, errors, numerical TAP and pixels.

The CI script also asserts unchanged request count and geometry when restoring visibility; those in-process assertions passed. The artifact retains selected numeric checkpoints, not a full typed-byte native World state for every response. Six complete discrete mesh checks do not certify the times between them, self-collision, per-yarn collision or full CCD. The approximately 35.8-second OFF and 1.0–1.2-second ON paused operations occur in SwiftShader and are not realtime or device-general performance claims. None of this review establishes an actual public HTTPS deployment, real-phone performance, full-matrix completion or final share permission.
