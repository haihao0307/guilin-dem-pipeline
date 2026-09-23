# Fish R006.1 — white-screen delivery repair

User report: **文件是白屏**. The report is accepted as an actual user-side delivery failure. Earlier CI success does not establish that the user's device could open R006.

## Scope and exact execution

No new anatomy or fish-generation feature was added. The repair starts from R006 receipt head `2e2fe83714a38cfb4c8b4e6d49a9c8b67126854e`.

- Implementation tested and published: `9d17da85c18659d1dbbeb29d6b6289d77475b775`.
- Main workflow/job: `35850561063` / `107146975852`, all steps SUCCESS.
- Public proof time: `2026-09-23T10:58:29.760264+00:00`.
- Entry: https://haihao0307.github.io/guilin-dem-pipeline/fish-mother-yellowfin/?openfix=r006-1
- Bare fixed entry remains valid too.
- Current HTML: 84,069,327 bytes; SHA256 `329fae35408c754d9bffbe1dba7bdcf0c089d19684cb4f68073f589ae921b32f`.
- Both public URL forms returned HTTP200 and full bytes matching the build.
- Final public proof: `gh-pages/fish-mother-yellowfin/PUBLICATION_PROOF.json`, blob `eb0a75ab42ff48675f09b531885cebd5d98becc7`.
- This later receipt commit does not change or rerun the tested HTML.

## Confirmed delivery defect and actual repair

The earlier builder put the full large teacher payload before the module that created every visible UI element. Therefore the page had no independent visible startup/recovery UI while the payload or module was unavailable. This is a confirmed architectural defect, **not** a confirmed exclusive root cause on the user's machine.

R006.1 places visible static HTML, CSS, progress and recovery controls in the first 7001 bytes. The exact source GLB is decoded in 75 ordered chunks, each at most 786432 bytes, rather than one large atob binary string. Chunk round-trip hashes equal the original GLB. Native typed-array decoding and bounded legacy decoding are implemented. The source buffer references are released after ingestion/parsing; the renderer no longer requests a persistent drawing buffer.

Global startup failures, incomplete-file detection, unavailable WebGL and actual context loss are presented using independent HTML. A retry control reloads the existing page; an archived R003 entry is also available. No automatic reload loop was added. A progress screen is not counted as successful 3D rendering: it hides only after actual first frames.

## Executed acceptance evidence

The main real Chromium/WebGL2 workflow passed both file-protocol and final-public-URL original R006 regressions: 209 fish poses, 17 isolated source regions, four fixed silhouette comparisons, source interfaces/endpoints and desktop/390x844 interactions. Normal-run console/page errors are empty.

New checks actually passed:
- HTML loading card already visible while the test server intentionally sends no model bytes.
- Truncated HTML shows a visible incomplete-file message instead of pretending to be ready.
- Real cold startup reaches the rendered fish.
- Injected WEBGL_lose_context produces a visible recovery message.
- Clicking the retry button actually returns to rendered 3D.
- Deliberately unavailable WebGL produces a visible failure message.

The early-loading and real-fish screenshots were copied from frozen gh-pages commit `0bf136051dd3b8c65306cddc08d7bbd11d5c2e3d`, reduced only for inspection by run `35851357189`, and decoded locally with matching SHA256. Both inspection images were actually opened: the early card is visible and the normal scene contains both complete fish. This is technical delivery inspection, not anatomy approval.

## Preserved failures and limitations

First main hotfix run `35850031500` passed normal R006 regression but its deliberately unfinished-response screenshot waited for document.fonts.ready and timed out. Publication was blocked. Artifact `10745580546` preserves that failed attempt. Only that screenshot harness was corrected to capture the actual compositor without waiting for the intentionally unfinished document; no geometry or acceptance threshold was relaxed.

Two supplementary current-Chrome runs are NOT reported as full passes. Run `35850791375` failed while retrieving the large navigation response from the inspector cache, with a missing optional Pillow dependency. Run `35851721694` corrected the dependency and observed Chrome `153.0.8010.52` successfully using native typed-array decoding, reaching rendered-ready state, retaining six 4K textures and passing four pose comparisons. Its subsequent actual-response-body retrieval was still evicted from inspector cache; the forced-fallback case was not reached. The complete supplemental suite remains FAILED. The separate main workflow already completed public full-file hash verification and all startup/recovery/regression checks. Do not merge partial native evidence into a fictitious all-browser PASS.

The original user's machine and physical mobile hardware have **not** been retested. The source remains large and still requires network transfer and device resources. The original user-side cause remains unconfirmed. No claim that all clients are now guaranteed to work.

## Source and record preservation

Original source ZIP remains 129,163,961 bytes with SHA256 `af4d26c462963298dcfa4784e32e6c731e8814ad2c308887012a5a41624eb550`.
The embedded equivalent source GLB remains 58,908,280 bytes with SHA256 `5603d4aabc9a1127856841335a86ae7aa462b6b25d1a6586e93bf644f4d47abe`.
No original geometry, joint, animation or 4K image precision was reduced. R006 is archived under r006/; R005/R004/R003 and other Mothers are preserved. Fish favicon remains unchanged. The document remains standalone HTML with no external runtime dependencies.

Latest full R006 work log was read before appending this repair; user utterances remain verbatim and separate from execution analysis.
Persistent folder: `/KAOPU_SOURCE_VAULT/Fish/YELLOWFIN_TEACHER_001/OpenFix_R006_1/`.

Record/inspection bundle `file_00000000fdd081fd82fdbe9bceb08ec5` / `libfile_e5140b87d2488191acc6c10509524649`: 33,017 bytes, SHA256 `1563f0341e34be07f6a70c051a1ecb4f2ee347f6836da0092cc7b7491ed92eb5`. Independently read back at `2026-09-23T11:01:54.645472+00:00`; bytes, CRC and all five manifest records match. The separately persisted 44,999-byte continuous log was also read back identically. This compact bundle is explicitly records/inspection only, not a replacement for the original source or production HTML.

`userDeviceRetested=false`; `originalClientCauseConfirmed=false`; `anatomicalPartitionApproved=false`; `stageAComplete=false`; `independentGenerator=false`; `productionReady=false`.
