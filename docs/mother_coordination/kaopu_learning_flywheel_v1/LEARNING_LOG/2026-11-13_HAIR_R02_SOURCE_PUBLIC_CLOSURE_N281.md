# N281 — Hair GPU R02 source/public closure replay

Date: 2026-11-13  
Status: **exact-subject validation / no institutional novelty / production untouched**  
Target: Hair GPU R01 fixed public entry and current main R02 candidate

## One bounded question

Do the new Hair GPU R02 source and R01 redirect commits actually resolve the user's fixed public R01 URL loading failure?

## Current baseline and real feedback

The current main remains governed by root AGENTS, R2, the reference-replication gate and the freshness gate. Their Git blobs are unchanged:

- AGENTS: `251b664646a489e9292748f1d41998ee62a338f5`
- R2: `d942d44bad0bbd206ea3768d620ad60d5ddeb2bf`
- reference gate: `8c0a49c71865ef76cbc614f8188239bc808a8278`
- freshness gate: `4754a90a94e4a9e7806357b6eb292e5c713e9021`

At 2026-11-13 10:16 Asia/Shanghai, the user reported that the fixed R01 URL still could not open/load and explicitly asked for the page to be rebuilt. This is a real user correction, not an inferred KPI.

N277 had already classified the earlier subject as `HOLD_SOURCE_EXPERIMENT_NOT_PUBLIC_R05_PERFORMANCE_DELIVERY`. Since then, main advanced with three real source commits:

1. `be98efa90f5b965fb7c9ed0a4af329b1852a95d0` — add R02 WebGL2 candidate;
2. `09d80dbd58be1471387b697bc43565f42d7da107` — replace main R01 with redirect to R02;
3. `8aec1b1dca9619c0b59fc8fa480f65f226be7145` — clarify that the actual preview path is WebGL2.

This is a real source delta. It is not yet a public repair.

## Exact source/public identity

| Layer | Exact subject | Observed state |
|---|---|---|
| current main | `8aec1b1dca9619c0b59fc8fa480f65f226be7145` | new R02 plus R01 redirect |
| main R01 blob | `a292654c1050809f7600d24c9ba4da3053056da2` | redirects to `../kaopu-hair-gpu-r02/index.html` |
| main R02 blob | `2736fcfaa88ea957d76e3c68c0d1869f27400a2e` | single-file WebGL2 candidate |
| current gh-pages | `db2692eaa622a97678de1d9560446116e0bb719e` | older publication subject |
| gh-pages R01 blob | `364b4f3366361b02181f000697977571204be559` | old WebGPU-only R01 |
| gh-pages R02 | absent | GitHub contents API returns 404 |

All three new main commits have zero associated workflow runs. No exact publication receipt was found.

## Independent public-browser replay

Cache-busted fixed entry:

<https://haihao0307.github.io/guilin-dem-pipeline/kaopu-hair-gpu-r01/index.html?kaopu_audit=20261113T1138>

After eight seconds, the independent browser still showed the old R01 subject:

- title: `KAOPU · GPU Noise Hair Lookdev R01`;
- visible status: `初始化失败：没有可用的 WebGPU Adapter。`;
- FPS/status line: `WebGPU unavailable`;
- canvas intrinsic size: `300 × 150`;
- fatal console error: `Error: 没有可用的 WebGPU Adapter。`;
- no valid 3D critical interaction.

Direct R02 readback:

<https://haihao0307.github.io/guilin-dem-pipeline/kaopu-hair-gpu-r02/index.html?kaopu_audit=20261113T1138>

The browser reached a GitHub error page, while the GitHub contents API independently confirmed that the R02 path is absent from `gh-pages`.

Therefore the user's report was reproduced. The fixed public entry did not inherit the main repair.

## Source-level R02 release blocker

The current R02 vertex shader contains:

```glsl
vec3 eye=vec3(distance*sin(yaw)*cos(pitch),distance*sin(pitch),distance*cos(yaw)*cos(pitch));
```

Within that GLSL source:

- `yaw` is not declared;
- `pitch` is not declared;
- `distance` is a GLSL built-in function name, not a declared float variable.

The exact R02 program was not runtime-compiled in a capable verifier: R02 is not public, and a local Chromium fixture was blocked by the execution environment. The correct state is therefore:

`SOURCE_LEVEL_COMPILE_BLOCKER_OBSERVED / RUNTIME_COMPILE_NOT_RUN`

This is a release blocker, not a claim that every browser/device has executed and rejected R02.

## Applicable regression replay

Existing Candidate `TESTED-SUBJECT-NOT-MUTABLE-HEAD-001` already supplies the relevant state semantics:

- the public artifact has no receipt binding it to any of the three new source commits → `HOLD_RECEIPT_BINDING_INCOMPLETE`;
- R02 plus the R01 redirect are production-source changes, not allowlisted metadata → `HOLD_UNTESTED_NONMETADATA_DELTA`.

The current public-delivery gate independently fails because the fixed public URL does not serve the new subject and does not enter a usable runtime.

N32 shared-target CAS remains applicable to the next publish, but `NOT_RUN` in this replay because no Hair public mutation was observed.

## Decision

`HOLD_SOURCE_FIX_NOT_PUBLISHED_AND_R02_NOT_RUNTIME_VERIFIED`

Institutional result: `NO_NOVELTY`.

No new regression is created. This round adds exact subject-level evidence to the existing N277/publication history. It does not reinterpret a source commit as a deployed repair.

## Minimum falsifiable release trial

Hair Mother and the publisher need only do one bounded closure:

1. repair or explicitly bind every vertex-shader camera symbol, then compile and link the exact R02 program in WebGL2;
2. run exact R02 through first completed frame, zero fatal console errors, rotation, wave toggle and strand-count interaction;
3. publish R02 and the R01 redirect to one exact `gh-pages` subject, with a target-wide mutation precondition;
4. read back both fixed URLs and bind source commit, public blobs, content digests, browser result and known limits in one `PUBLICATION_PROOF`;
5. keep browser, device and user acceptance separate; 390×844 viewport is not a physical phone.

Do not publish the current source merely to clear the 404 before its shader compilation/runtime gate passes.

## Lifecycle

- this learning record: `IMPLEMENTED=true`
- exact source/public identity and public-browser validation: `GATE-RUN=true`
- Mother `ACKNOWLEDGED=false`
- production/public repair `IMPLEMENTED=false / GATE-RUN=false`
- `ADOPTED=false`
- `USER-ACCEPTED=false`

Frozen: main, `gh-pages`, Hair production source, R2, global gates and access policy.


Routing receipt: [#91 comment 6843161039](https://github.com/haihao0307/guilin-dem-pipeline/issues/91#issuecomment-6843161039). State at routing: `POSTED=true`; Mother `ACKNOWLEDGED=false`.
