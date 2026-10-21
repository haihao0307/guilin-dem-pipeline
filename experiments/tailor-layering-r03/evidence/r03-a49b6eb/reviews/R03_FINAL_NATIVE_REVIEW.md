# R03 a49 — independent native evidence review

## Decision

**PASS for the fresh native baseline, perturb, eight-step contact-demand A/B and three-cycle redress evidence. Overall release remains HOLD; `shareAllowed:false`.** Production source is `a49b6eb9bdf9f3bb097a4470465bc463d97dfb7b`, full CI run `39539509515`. The browser continuous and reentry members and subsequent actual public deployment/desktop/mobile verification remain separate gates. The old source74c20 reentry rejection is retained and is not erased by these native results.

This review read retained files only. It did not edit production, rerun physics or launch a browser. It checked the body review's 9,986-check report and compact summary, rehashed all 85 referenced evidence files, and independently recomputed the source correspondence, both 241-record replay sequences and peaks, eight-step timing/work aggregates, three-cycle equality claims and retained failed-add before/after bytes.

## Exact source and fresh capture

| Native job | Job ID | Artifact ID | Original ZIP SHA-256 |
| --- | --- | --- | --- |
| Baseline | 119023772243 | 12319164290 | ef19b5a7241461f8ef65c5df82f89bc1b96f657d5cf2aefc306aa9ea25a183a0 |
| Perturb | 119023772084 | 12319027920 | 1148ea6545d9e64d8603c9db76c1f3c767cd3a40d8633f8c0598d47c7d2cd0f0 |

Both completed job identities were independently read from the GitHub API and are success at source a49. Retained checkout logs, capture metadata and source hashes agree. Both raw `SOURCE_PROVENANCE.json` files are byte-identical to the tested display capsule's generated provenance, SHA-256 `eb32f4a3fcd70fb935e1511f854fefb2241b798f8b05d21e081ef077bbfcc4e3`. Both BUILD_MANIFEST hashes also match the display capsule. Bound R03 physical source hashes match that same runtime; the corrected world is `a4da64a62d08602a2a3cbf000b4d2fac8db1bb2bd4b8d4eb9ef1dcf5cb97255a`.

The two original capture JSON files have different hashes because they include independent run observations:

- Baseline input: `c79ac3ffa9afb527af77593db50c9ef5258e38ffd5b7af35a79c8a4217e19376`.
- Perturb input: `1ea3fbec9ffbc2367f8ab07a6f72163f2886e15bd6194ae71af5fa3bf98db537`.

Their seven typed-array records, decoded bytes, body, garment rows, options, execution settings and native identity agree exactly. The captured original body has 25,417 vertices and 50,624 triangles; the observed body hash matches the display job. These are fresh typed captures from this new-source CI, not an old numeric reconstruction. Each native job also reports 93/93 numerical tests passed, with zero failure/cancellation/skip.

## Two 240-step native replays

Each lane contains the initial state plus **240 accepted physical steps**, reaching `1.9999999999999942` seconds, with **241 independently audited discrete states** and all 9,402 physical cloth vertices measured at each state. The retained step counters and clocks are consecutive, all solver settling reports converge, and the geometry reports contain zero discrete input triangle crossings or degenerate triangles. Perturbations occur before steps 61 (outer push), 121 (inner tug) and 181 (outer push).

| Recorded peak | Baseline | Perturb | Unchanged gate |
| --- | ---: | ---: | ---: |
| Dynamic edge stretch | 1.4498629135478847 | 1.4498629135478847 | 1.45 |
| Cloth contact residual, mm | 0.46967070395377736 | 0.46967070395377736 | 0.5 |
| Seam gap, mm | 0 | 0 | 0.01 |
| Particle/body half-thickness overlap, mm | 0 | 0 | 0.001 |
| Independent triangle/body half-thickness overlap, mm | **0.0004752060016864103** | **0.0008538310809352856** | 0.001 |
| Solver triangle/body envelope overlap, mm | **0.0004752060016885787** | **0.0008538310809352856** | 0.001 |

The nonzero surface-envelope values are real reported residuals and must not be described as zero penetration. The baseline has four positive-overlap states and peaks at step212; the perturb run has one positive-overlap state and peaks at step216. The independent `hasHalfThicknessOverlap` flags are true at those states. They pass the existing 0.001 mm engineering tolerance; the zero particle/body metric is a separate measurement. The tiny difference between the two baseline surface figures is retained rather than rounded away.

These are discrete static-body tests. They do not certify time between steps, self-collision, arbitrary motion, dynamic bodies or individual yarn intersections.

## Fresh complete-World contact-demand A/B

The new baseline capture drives frozen R02, R03 OFF and R03 ON from the same original typed bytes. The test reports strict physical-array, constraint, rendered-array and full normalized scalar/history agreement at initialization and all **eight actual steps**, including an outer push before step3 and inner tug before step6. Nine shared states receive independent complete discrete geometry and body-envelope audits. A rollback is explicitly disallowed for pass. The reviewer corroborated every saved comparison/digest and bound source/test hash; the original in-process comparisons were not rerun from the evidence.

| Eight-step aggregate | R03 OFF | R03 ON | Observed change |
| --- | ---: | ---: | ---: |
| Step wall time | 47,300.219576 ms | 38,128.68913000001 ms | **−19.3900377804%** |
| Whole-process CPU time | 51,195.444 ms | 45,716.925 ms | **−10.7011846601%** |
| Cloth candidate visits | 221,647,151 | 221,647,151 | unchanged |
| Solve calls | 276 | 276 | unchanged |
| Measurement calls | 116 | 116 | unchanged |
| VF candidate-entry feature tests | 15,172,691 | 10,744,820 | fewer executed tests |
| EE candidate-entry feature tests | 44,731,153 | 33,117,645 | fewer executed tests |

The candidate traversal count is unchanged; savings come from conservative feature rejection and exact cache reuse. VF/EE counters cover nearest-feature operations at candidate entry, not all arithmetic inside swept tests, retargeting and sampling. Both lanes perform the same solve/measure calls. The body has 2,175,320 triangle queries in both modes, with 1,639,225 exact cache hits in ON.

`layerBroadphaseMS` is nested inside `layerContactMS`; it is not added a second time. The seven exclusive listed ON stages sum to 35,907.340528000066 ms, leaving 2,221.3486019999473 ms outside those named stages within the measured eight step calls. No unexplained speedup is inferred by double-counting nested time. Audits run outside the per-step wall/CPU timing. These finite Node/CI observations do not establish real-time behavior, stable hardware-wide performance or GPU speed.

The A/B physical peaks are stretch1.4499261357924653, cloth residual0.4817211992306034 mm, seam0 and particle/independent body overlap0. The latter zeros apply to this short A/B sample only, not the two 240-step runs above.

Memory remains separately scoped: 134,217,728 bytes of WASM memory per world, 6,753,168 reserved solver-pool bytes and 8,507,352 static body-acceleration-array bytes in both R03 modes. Dynamic bounds/caches, JS objects and allocator overhead are outside that static-array number. Process memory covers all three live worlds and audit data; it is not per-world allocation or a total-memory-saving proof.

## Fresh redress and failed-add regression

The new source and new baseline typed capture complete **three short removal/re-add cycles, 14 real steps and 19 full audit states**. Every successful restart matches the fresh initial physical/constraint/render state digest `d31bee1211dcb215b403f4ebe68afb8da85a2101344bb7dc019c92a2e4b3a125`. Original rest lengths, masses, inverse masses, topology, materials and thickness remain unchanged. The semantics remain explicit `GLOBAL_REDRESS_RESTART`, not state-preserving resume.

The test-only failure is injected after a real initializing settle converges in four passes. It restores the survivor physical arrays, constraint lambdas, histories, clocks and full original reports including recorded timings. The failed garment is absent, redundant UI cleanup removal is a no-op, and a subsequent actual physical step passes. The retained pre-failure and after-cleanup gzip files are byte-identical: 2,616,032 bytes, SHA-256 `cc5135b5a56e10acae48f2ae05a0ca85cc4331b5fec2c01dc38194060b26ff4c`.

Only allocator accounting is excluded from rollback snapshot comparison and is explicitly retained: reserved/free bytes stay at 6,753,168/788,480, while cumulative reused bytes increase from 2,365,440 to 3,153,920. History coverage is the actual exercised maps: history2, frameSides1, and empty edgeReferences/pending/sides; no claim covers every possible nonempty lifecycle state. Short-cycle pass does not replace the separate browser reentry gate.

## Retained review chain

- Body review: `scratch-ci-monitor/native-review-39539509515.json`, 9,986 checks / 0 failures, SHA-256 `ba3a3290c3018ce1d2fc183703ba08771a2891df3dbcd259d22722cc0d217f9d`.
- Compact body review: `scratch-ci-monitor/native-review-39539509515-compact.json`, SHA-256 `dc0c59b48243985c7fb92d522c8c95269f19ed127c48c2774ecb81b3191210aa`.
- This verifier's secondary raw readback: `scratch-review/r03-final-native-crosscheck.json`, SHA-256 `a3c5b6e77fca6208dac8c31953621e0995a8817a847c3205b1eb5526d464048c`.
- New CI redress summary: `r03-final-ci/native-baseline/native-redress-regression/summary.json`, SHA-256 `a4bd879beab009be04d0a93c60d888e3c3087f6c2a74e0e028fce39109d89eb9`.

At this review stage, **four of six matrix members are independently reviewed as pass**: display, demand, native-baseline and native-perturb. Continuous, browser reentry, deployment and actual public desktop/mobile evidence remain pending. The final candidate receipt is updated within that boundary, retaining `HOLD_NEW_SOURCE_RELEASE_AND_PUBLIC_EVIDENCE`, `visualAcceptance:false`, `productionReady:false` and `shareAllowed:false`.
