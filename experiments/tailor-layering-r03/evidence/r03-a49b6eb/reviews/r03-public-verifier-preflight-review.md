# R03 public verification and evidence restore — independent preflight

## Current decision

**HOLD / STATIC_PASS_NOT_RUN.** The current prepared verification commit is `1996ff7ea75bb62cdf1a785588173c3be4a558b2`. This is preparation for final acceptance, not a public-browser pass. The corrected production source remains `a49b6eb9bdf9f3bb097a4470465bc463d97dfb7b`; the production source and visible product copy were not edited during this review. The public target is the new `layering-r03-20261021-a49b6eb/` directory. No deployment or public test has been inferred from prepared configuration.

## Verification preparation

The reviewed configuration explicitly fixes the HTTPS directory and full source SHA. The workflow checks out the exact verification PR head, uses read-only repository permissions, pins Playwright 1.64.0, and runs separate desktop and mobile matrix jobs with fresh browser contexts and independent artifact uploads. Its explicit Bash shell uses GitHub Actions pipefail behavior, so `tee` does not mask the browser process exit code. Each job has a 30-minute budget; the desktop and mobile scripts retain their original 20-minute and 10-minute watchdogs, with setup/upload time outside those test budgets. A timeout remains failure.

The desktop script drives the real UI through init → one actual step → measurement-only snapshot → contact-demand OFF/ON → camera change. It verifies actual Worker request/reply types, geometry digests, physical clocks, generation, retained bounds, original native identity, material/garment representations, complete discrete geometry audit, and actual GPU completion. A paused audit/toggle is not counted as physical advancement.

The mobile helper uses a separate Chromium context at 390 × 844 with `isMobile` and `hasTouch`. It waits for both actual Worker idle and published completed GPU/presentation state. An actual tap must change the original camera and canvas pixels and complete a new frame while preserving request/reply counts, generation and physical report. It checks the original body topology size and three garment IDs, HTTP 200/fixed final URL, critical errors, control hit testing, bounds, horizontal overflow and the scrolled contact-demand label. Original entry/canvas, side/canvas and contact-controls PNGs are retained. It certifies mobile viewport/touch emulation, not real-phone hardware or repeated long physics simulation.

Two automated desktop checks were identified and then strengthened in the verification workflow, without changing frozen production or the frozen desktop test:

1. The desktop test records every console error but directly rejects only shader/WebGL console errors. Require `consoleErrorCount === 0` as well as `pageErrorCount === 0` and `passed === true`.
2. Its navigation guard checks same origin, not the exact final path. Require both `targetURL` and `finalURL` to equal the new fixed URL.

The first strengthened prepared verification commit `f0e195209fe61ce7255122c2ce06ecc9b4c3e7f7` introduced both checks. Its configuration binds the runtime tree, entry HTML hash, provenance hash and nine actual public readbacks to the already-tested capsule. The reviewer independently matched every configured size/SHA-256 to that capsule and compiled both workflow Python blocks. Config and mobile helper Git blobs remain `8a361cb625d45dae948b4a5fa32909fe619a22fa` and `75d5a7f8ccbb58d087fdc63aab9753bb36617063`. The strict desktop gate requires exact target/final URL, zero ordinary console/page errors, exact requested/final URL and status/bytes/hash for all nine readbacks, the saved original provenance SHA-256, and its entry HTML fingerprint. It writes `fixed-source-acceptance.json` within the desktop job.

The current prepared commit `1996ff7ea75bb62cdf1a785588173c3be4a558b2` supersedes f0e1952 only to run the two independent entrances concurrently. The reviewer fetched the old workflow Git blob `5c70fd8c0b0ba0f2e7b7ed280e2b3293e4709321` and independently compared the parsed YAML semantics. The only changes are matrix/name, three mutually exclusive step conditions, viewport-specific artifact name and the 30-minute per-job timeout. The current workflow blob is `826c18464dcaf84ecf241b5b9f598d56f94ab284`, SHA-256 `4b49d917019be3a4e403984620852f590ddfb90e19b4d06552e8ed0e97e81980`.

The actual expanded desktop job includes desktop smoke and the fixed-source guard; the expanded mobile job includes the original mobile helper. Both inherit exact checkout, pinned installation and `always()` upload. `fail-fast:false` preserves the other job's evidence if one fails. There is no `continue-on-error`. Artifact names include viewport, run ID and attempt; hosted matrix jobs have isolated workspaces. Thus the shared relative `evidence/` upload path does not merge or overwrite the two runs. **Both `public / desktop` and `public / mobile` must finish successfully, and both original artifacts must be reviewed; one successful lane cannot satisfy the public gate.** No browser, deployment or production CI was executed by this static review.

**Prepared verifier static review: PASS, execution: NOT_RUN.** The unreferenced preparation commits `07194ebb...` and `f0e1952...` are superseded, not public acceptance records. Final independent review will still inspect the actual public artifacts and compare their saved provenance/readbacks to the frozen capsule; the expected truth no longer comes only from remote provenance.

The old `r03-final-verification-checklist.md` begins with the rejected `74c20ec` source; it is historical planning material. The active final receipt correctly names a49. Do not promote the old checklist text into a new receipt or final proof.

## Evidence archive restore design

Checkpoint commit `51211871fc6b43801482785cbae723dfd8b9155f` was inspected through read-only GitHub directory metadata. Its `EVIDENCE_INDEX.json`, `restore-evidence.py` and README have exactly the same Git blob identities and sizes as the reviewed local files. All **16 archive part names, sizes and Git blob identities** match the index. No large archive was copied, restored or extracted by this review.

The four indexed archives contain 58,721,088 compressed bytes and describe 202 original evidence files. All offsets are contiguous, sizes positive, part paths unique and within `archives/`, sums match complete archive sizes, and archive SHA-256 values match their packing receipts. Manifest file counts and paths are internally consistent. The rejected first CI result is explicitly bound to old source74c20; new display/demand are bound to a49; original local candidate files, typed input and metadata errata are preserved separately.

The restore script uses exclusive output creation, refuses existing target names, verifies each part's size/SHA-256/Git blob hash and the final archive size/SHA-256, rejects escaping/symlinked source paths, checks contiguous offsets and duplicate archive names, and removes a partially created output on a caught failure. It only reconstructs archive files; it never extracts tar members. Original content identity is retained in each `EVIDENCE_CONTENTS.json`, while normalized tar timestamps and modes are disclosed. No blocking restorability defect was found in the supplied index and script.

- Index SHA-256: `e5e66fc205619781fcc2efe7a3306ddff7d1be35face977c5c5de47b5b154355`.
- Restore script SHA-256: `53b608ee825cbd271779ac4b72585323d44ba9cef5069a926e74b9589cd008c4`.
- Read-only API metadata retained in `scratch-review/evidence-checkpoint-51211871-api-metadata.json`.

This establishes metadata correspondence and a sound verification procedure. It does not claim a fresh full download/reconstruction of every persisted archive; that would repeat the producer's archive upload verification and was outside this review request.

## Fields still required for final receipt/proof

- Exact-source completed six-job matrix: each job/artifact ID, conclusion, original artifact digest and independent review evidence, including the four members still running when this preflight began.
- Deployment commit, deployment workflow/run identity where applicable, runtime subtree and immutable path, plus confirmation that old versions remain available.
- Actual public HTTP status, final URL, entry/provenance/build/source readback sizes and SHA-256 values, observation time and the exact tested runtime match.
- New verification PR/head, actual checkout identity, approved helper/config/workflow hashes, public run/job/artifact IDs and original archive digest. GitHub's `GITHUB_SHA` may identify a PR merge commit; do not confuse it with the explicitly checked-out verification head or production source.
- Desktop and mobile summary/evidence hashes, real original screenshots, raw Worker records and independent audit; console/page/network failure counts must be zero for the relevant gates.
- Independent final screenshot and artifact decision, retained evidence branch/commit and the final `PUBLICATION_PROOF.json` location/hash.
- Only after every actual gate passes: scoped candidate acceptance and `shareAllowed=true`. Human `visualAcceptance` and `productionReady` remain false unless separately authorized; device-general or realtime claims remain unsupported.

The current receipt remains `HOLD_NEW_SOURCE_RELEASE_AND_PUBLIC_EVIDENCE` with `shareAllowed:false`. The remaining matrix results, deployment and public desktop/mobile artifacts are still required. The coordinator subsequently reported native-perturb passing with a separate 4,698-check review; that does not change this preflight decision. Its measured peak independent body-surface envelope overlap is 0.000853831081 mm and must not be rounded or reported as zero. Any later evidence-branch append requires the new index/commit to be bound in the final receipt; this archive review is specifically for checkpoint51211871 and its 16 parts.
