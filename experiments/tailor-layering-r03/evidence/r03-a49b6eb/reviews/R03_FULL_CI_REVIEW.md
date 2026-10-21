# R03 corrected-source full CI — independent review

**Decision: all six required CI members PASS for source `a49b6eb9bdf9f3bb097a4470465bc463d97dfb7b`. The candidate may proceed to actual public acceptance. User sharing remains HOLD / `shareAllowed:false`.**

This is an independent evidence review by `audit_handoff`, not approval by a production author. No browser, World, or physics simulation was rerun for this review. Production files, original CI evidence, and the earlier failed-candidate record were not edited.

## Identity and complete matrix

The retained API metadata `publication-evidence/FULL_CI_RUN.json` identifies run **39539509515** as `completed/success`, with exactly the six required jobs below, all checking out the same corrected source. Its SHA-256 is `6a6b9f6b4fb55191a28e701c1ef3cce53df2b7b839d7eab71ba93a78b227dae0`.

| Required member | Job ID | Original artifact ID | Independent finding |
| --- | --- | --- | --- |
| Display | 119023772191 | 12319090927 | Original person, three garments and original material detail retained; five canvas views preserved; generated runtime capsule matches this source. |
| Render demand | 119023772264 | 12319111392 | Reset ABBA pixel/geometry equality, 26 actual hidden-state steps, and newest-state restoration pass. This is the render-demand test, distinct from contact-demand numerical A/B. |
| Continuous | 119023772238 | 12320580176 | 284 actual accepted steps; 18 retained complete discrete triangle audits; unchanged numerical gates pass. |
| Reentry | 119023772258 | 12320345688 | 211 actual accepted steps across three removal/restoration cycles; 45 retained complete discrete triangle audits; each explicit global redress restarts at clock zero. |
| Native baseline | 119023772243 | 12319164290 | 240 real steps and 241 independent audits; fresh strict three-lane contact A/B and fresh three-cycle atomic redress regression also pass. |
| Native perturb | 119023772084 | 12319027920 | 240 real steps and 241 independent audits, including the three prescribed bounded impulses, pass. |

Prior detailed reviews remain bound to their scopes:

- `scratch-review/R03_FINAL_DISPLAY_DEMAND_REVIEW.md` and the 321-check display/demand readback.
- `scratch-review/R03_FINAL_NATIVE_REVIEW.md`, the 9,986-check primary native review, and the independent 85-file native crosscheck.
- `r03-final-ci/continuous/review.json` and `r03-final-ci/reentry/review.json`, produced by the independent contact reviewer.
- `scratch-review/r03-full-ci-secondary-readback.json`, produced for this final consolidation: **6,294 read-only checks, zero failures**. This count describes data checks, not additional physical steps or runs. SHA-256: `8ad1b858db84d655d8716608f87b4daeec4a19b769afc858d516b698e4a4f59b`.

The API metadata's capture-time field `independentBrowserArtifactReviewStillRequired:true` is preserved verbatim. The subsequent reviews cited here complete that outstanding CI review; the original metadata was not rewritten to erase its earlier state.

## Original evidence integrity and source chain

The secondary review independently recomputed both final browser ZIP hashes and compared every ZIP member byte-for-byte with the extracted originals: **62 continuous members plus 121 reentry members, 183 total**. It also verified member names, order, sizes and hashes against the original member manifests. No extra extraction or new physics execution was needed.

| Artifact | Original ZIP bytes | SHA-256 |
| --- | ---: | --- |
| Continuous | 22,764,927 | `bb779c33b898dab9e181f915b9d70f27c372d266c936bc3739521d3c2cc9b1d8` |
| Reentry | 33,213,634 | `9162fe5494b62e4e388193c295832d15bc24198c5509d8f6611278c0fb17f34f` |

Both completed-job logs contain an actual checkout of a49 and the following `git log -1 --format=%H` result for that exact SHA. Both raw browser provenance objects exactly equal the provenance decoded from the new display runtime capsule. That original provenance byte hash is `eb32f4a3fcd70fb935e1511f854fefb2241b798f8b05d21e081ef077bbfcc4e3`.

The publication payload remains the tested display capsule: **308 files, 106,247,499 bytes, runtime Git tree `114feff8d1b1c79a9a164fc8a99b181507d1cc89`**. The coordinator performed recursive Git readback; this verifier independently checked capsule provenance, the authored source hashes and the fixed public configuration. A prepared or updated deployment branch alone does not satisfy the HTTP/browser gates.

## Actual physical progress and unchanged gates

All **495** accepted step records in the two browser artifacts were re-derived from original response audits and compared exactly with the contact reviewer's `step-readout.json` records. Every interval advances one completed physical step at a time. All retained replies are actual successful `step` responses, retain contact solving, report converged acceptance, and have finite measurements. The standalone push checkpoint at reply 248 advances continuous step 244.

The unchanged dynamic acceptance limits are edge stretch **1.45**, seam gap **0.01 mm**, cloth residual **0.5 mm**, and body half-thickness overlap **0.001 mm**. No tolerance was relaxed. The script's `1e-12 s` comparison is solely an accumulated-clock arithmetic check; it is not a physical acceptance tolerance.

### Continuous

- Sustained phase: **243** real steps, **2.0249999999999955 s** of physical time, exceeding the requested 2 s.
- Bounded push: one real step, followed by **40** recovery steps, advancing another **0.3333333333333499 s** after the impulse.
- Total: **284** steps, final clock **2.366666666666679 s**.
- Peak dynamic stretch: **1.449862480496904**; seam gap: **0 mm**; cloth residual: **0.4916631733980423 mm**.
- Peak **production triangle-feature/body half-thickness measurement**: **0.0008619287697408072 mm** at step 282 / reply 286. Four recorded step measurements are positive; none is rounded to zero in this review.
- Three manual audits inspect all **9,402** physical particles: zero inside particles and zero particle/body half-thickness overlaps at those sampled states.
- **18** retained snapshots have complete discrete nondegenerate input-triangle coverage, zero reported garment/body crossings or touches, and zero degenerate input triangles.

### Reentry

- Three removal/restoration cycles contain **32/38**, **32/38**, and **32/39** real steps: **211** accepted steps in total.
- Explicit add replies **36, 109 and 182** restore all three garments and reset both completed steps and simulation time to **zero**. This is the disclosed `GLOBAL_REDRESS_RESTART`, not state-preserving resume.
- Final restored phase ends at step **39**, clock **0.32500000000000007 s**.
- Peak dynamic stretch: **1.4498794120276757**; seam gap: **0 mm**; cloth residual: **0.4916631733980423 mm**; production surface/body half-thickness overlap: **0 mm** in this finite sequence.
- Four manual audits inspect all 9,402 particles with zero inside particles and zero particle/body overlaps.
- **45** retained snapshots pass complete discrete triangle checks with zero reported crossings/touches or degenerate inputs.

The selected snapshot checker checks discrete middle-surface intersections. It does **not** independently certify body thickness clearance, continuous time, self-collision or individual yarns. Browser per-step half-thickness values above come from the production envelope measurement. The separately retained native runs do perform the additional independent body-envelope audit.

## Native and performance findings retained accurately

The independent native body-envelope peak is nonzero: baseline **0.0004752060016864103 mm** and perturb **0.0008538310809352856 mm**, both below the unchanged 0.001 mm gate. The largest browser production-envelope value, **0.0008619287697408072 mm**, is a separate measurement with a different scope; it is not substituted for the native independent audit.

In the fresh eight-step complete-World A/B, all nine states agree across R02 / R03 OFF / R03 ON under strict physical/render/history comparisons. OFF→ON observed step wall time is **47,300.219576 → 38,128.689130 ms (−19.3900%)**; process CPU is **51,195.444 → 45,716.925 ms (−10.7012%)**. Candidate visits stay **221,647,151** in both R03 lanes. The reduction concerns exact feature work and reuse; it is not a claim that candidates or physical steps were skipped. Nested broadphase time is not added twice.

The fresh native redress regression includes three restarts, fourteen real steps, nineteen audited states, failure injection **after a genuine converged initialization**, exact physical/report/constraint/history restoration, redundant absent-garment cleanup as a no-op, and a successful next real step. Allocator reuse statistics are separately recorded and excluded from claims of restored physical bytes. No total-memory saving or zero-allocation claim is accepted.

Both full browser jobs run far slower than real time in their CI software-WebGL environment: elapsed **1,921,118 ms** continuous and **1,856,023 ms** reentry. These wall times do not prove a cross-run performance gain, user GPU performance, or realtime simulation.

## Original image inspection

This verifier opened the original, unmodified viewport PNGs `continuous/evidence/sustained-view.png`, `continuous/evidence/push-recovery-view.png`, and `reentry/evidence/cycle-3-restored-sustained-view.png` after the earlier display/demand image review.

The original static person, tan outer garment, blue inner garment and navy shorts are visible; the original yarn/knit detail remains visible. No blank canvas, missing garment, replacement model or error overlay is visible. The current viewport shows the contact-demand toggle, its “原约束不变” label, the feature-work counters and current-contact inspection button legibly. The right control panel is scrolled, so controls outside that viewport are not claimed to have been visually inspected in those three frames. Header clocks/residuals correspond to the retained 2.025 s, 2.367 s and 0.325 s states.

Raw browser records report no application error, page error, console error, shader error, forbidden request or failed runtime resource in either job. Screenshots support visible fidelity only; they do not replace the numerical or hidden-surface checks.

## Historical failure remains part of the record

Old source **74c20ec**, run **39535426824**, failed its real browser reentry job with a rejected/rolled-back step and about **13.249 mm** cloth residual. It was not a timeout and was rejected for publication. That source's five passing jobs do not establish the new source's release result.

The old three-lane Node diagnostic agreed between implementations but failed to reproduce the original Chromium history: zero of twenty-one complete browser checkpoints matched byte-for-byte. It therefore does **not** establish that the Chrome failure was unrelated to optimization. The corrected source now has its own six-job evidence, including actual three-cycle browser reentry; the old failure and diagnostic limits remain retained.

## Public acceptance still required

This full-CI decision allows the exact tested runtime to enter public candidate verification. It does not authorize sharing an unverified URL. Remaining gates are:

1. The immutable runtime deployment completes, preserving old entries and all other directories.
2. Fresh HTTP readback matches the exact a49 entry/provenance and critical resource sizes/hashes at the fixed URL.
3. Both prepared verification jobs, **`public / desktop` and `public / mobile`**, execute successfully against that actual URL, with separately retained artifacts.
4. Independent review checks original desktop/mobile interaction evidence, raw screenshots, console/network results and exact-source acceptance output.
5. Final `PUBLICATION_PROOF.json`, the receipt, original evidence and immutable evidence index are retained and read back before `shareAllowed:true`.

The current prepared verifier is **1996ff7ea75bb62cdf1a785588173c3be4a558b2**, parent a49; its source-independent two-viewport matrix was statically reviewed. Static review does not count as public execution. Mobile scope is a fresh 390×844 Chromium touch/WebGL emulation and reachable controls, not a physical handset or repetition of the full numerical matrix.

`PUBLIC_WEB_DELIVERY_GATE.md` v1.2.0 was re-read from the exact a49 source for the coordinator's storage question. It requires generating and saving the proof and its HTTP/browser evidence; it does **not** require publishing the proof in the runtime directory. Retaining proof/receipt/verification on the dedicated evidence branch while preserving the tested 308 runtime files is compatible with that rule. The proof must bind the deployed commit/tree, actual Pages run, exact public URL, actual public jobs and retained evidence identities. It cannot be marked passed merely because it was prepared.

### Real 3D / release checklist

- [x] No generated or edited image substitutes for the implementation.
- [x] Production source was changed and exact-source CI completed.
- [x] The candidate is a live interactive 3D runtime.
- [x] Inspected images are original captures of that runtime.
- [ ] The final public fixed URL and fresh desktop/mobile browser evidence have been independently accepted.
- [x] Screenshots alone cannot satisfy delivery.

**Final state for this review: `FULL_CI_PASS_PUBLIC_CANDIDATE_ACCEPTANCE_ALLOWED`; public sharing HOLD; `visualAcceptance:false`; `productionReady:false`.**
