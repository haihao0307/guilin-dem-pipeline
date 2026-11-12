# KAOPU Learning Flywheel N277 — Hair R01 source experiment is not a public R05 performance delivery

Date: 2026-11-12 (Asia/Shanghai)  
Scope: Hair Mother / WebGPU delivery  
R2 baseline: unchanged  
Production branches/assets: untouched

## One bounded question

Does current `main@2573fb0b928feabfe528fe4901e88ef8b3a80a13` constitute delivery of the user's actual hair task: improve the existing R05 hair performance through GPU execution and provide a directly usable public page?

## Required pre-read and priority choice

Re-read current main's root `AGENTS.md`, R2 OS, reference-replication gate, freshness gate, #91/#63 latest production feedback and applicable regressions.

- `AGENTS.md`: `251b664646a489e9292748f1d41998ee62a338f5`
- R2 OS: `d942d44bad0bbd206ea3768d620ad60d5ddeb2bf`
- reference gate: `8c0a49c71865ef76cbc614f8188239bc808a8278`
- freshness gate: `4754a90a94e4a9e7806357b6eb292e5c713e9021`
- #91: no Mother acknowledgement after N276
- #63: no new applicable production feedback

Main advanced after N276 by one direct commit titled `Publish KAOPU hair GPU R01 WebGPU lookdev to public GitHub Pages`. This exact subject is higher value than another external-teacher scan because the user has already reported two concrete pains: hair FPS remains low and the delivered page cannot be opened.

## Exact source findings

Exact commit:

- SHA: `2573fb0b928feabfe528fe4901e88ef8b3a80a13`
- time: 2026-11-12 15:22:08 +08:00
- diff: one new file, `kaopu-hair-gpu-r01/index.html`
- file blob: `364b4f3366361b02181f000697977571204be559`
- workflow runs associated with exact commit: none observed

The file contains real WebGPU work:

- WGSL vertex/fragment shaders;
- storage-buffer guide points and per-strand data;
- GPU-side dual-frequency/noise displacement;
- one instanced hair draw per frame;
- default 6,000 strands × 24 segments × 6 vertices = **864,000 generated vertices per frame**;
- declared stress ceiling up to 200,000 strands, or **28.8 million generated vertices per frame**, subject to device buffer limits;
- CPU guide generation occurs at initialization and when strand count changes, not in the steady-state frame loop.

This is a valid source experiment. It is not an empty page or fake GPU label.

## Exact boundary stated by the source itself

The page explicitly says:

- it is an independent shader observation bench;
- it is **not** the online R05's actual hairstyle data;
- its displayed FPS is page frame rate, not measured GPU time;
- formal integration still requires the existing Groom data, image-equivalence checks and real-device testing;
- GPU timestamps are not enabled.

The only performance display is a 500 ms `requestAnimationFrame` count. There is no:

- R05 before/after pair;
- fixed camera / identical Groom subject;
- device, browser, GPU, driver or power-state receipt;
- warm-up policy;
- raw frame intervals or P95;
- GPU timestamp validity;
- CPU/GPU bottleneck split;
- visual-equivalence comparison.

Therefore the source supports `VERIFIED_GPU_LOOKDEV_SOURCE_DELTA`, not a production performance-improvement claim.

## Public delivery replay

Declared public URL:

`https://haihao0307.github.io/guilin-dem-pipeline/kaopu-hair-gpu-r01/`

Observed in an independent browser:

- GitHub Pages `404 / File not found`
- no WebGPU initialization
- no render
- no controls
- no FPS measurement
- no usable delivery

Repository closure:

- current `gh-pages@8255ad5c65609480612dcae21f0d12d58cb95b03`
- `kaopu-hair-gpu-r01/index.html` is absent from `gh-pages`
- that gh-pages head was written at 2026-11-12 15:27:00 +08:00, after the main commit, so this is not merely evidence taken before the source commit existed

## Decision

`HOLD_SOURCE_EXPERIMENT_NOT_PUBLIC_R05_PERFORMANCE_DELIVERY`

Layered state:

- source delta: `VERIFIED`
- WebGPU method presence: `VERIFIED_SOURCE_ONLY`
- public publication: `FAILED_404`
- actual R05 Groom integration: `NOT_IMPLEMENTED`
- R05 performance improvement: `UNKNOWN`
- visual equivalence: `UNKNOWN`
- browser/device/production/user acceptance: `false / unknown`

The commit title's word “Publish” is stronger than the retrievable evidence. It must not be interpreted as a public delivery receipt.

## Novelty and regression handling

Institutional novelty: **`NO_NOVELTY`**.

Existing R2 `expectedArtifact`, `TASK_FRESHNESS_AND_NO_STALE_DELIVERY_GATE`, public-web delivery rules, and prior claim-scope/public-runtime cases already cover:

- source saved but not publicly deployed;
- HTTP/public browser failure;
- partial experiment substituted for the requested production subject;
- frame-rate label without exact-subject performance receipt.

No new near-duplicate regression case was created. This round saves only the new exact-subject evidence.

## Minimum Hair Mother trial

Use the existing R05 Groom subject, not the procedural head:

1. Bind exact R05 baseline head, public URL, camera, resolution, strand/segment count and visual settings.
2. Implement one GPU-path candidate on a separate Mother branch with a rollback point.
3. Publish the exact candidate under a head-bound public route.
4. Run same-device R05 before/after raw frame intervals, P50/P95, valid GPU timing and CPU/GPU split.
5. Compare fixed-view images or a declared image metric before any performance claim.
6. Report public browser, device, production and user acceptance separately.

## Lifecycle

- `POSTED=true` — routed only to #91
- `ACKNOWLEDGED=false`
- source experiment `IMPLEMENTED=true`
- public delivery `IMPLEMENTED=false`
- exact-subject source/public gate `GATE-RUN=true`
- production R05 performance gate `GATE-RUN=false`
- `ADOPTED=false`
- `USER-ACCEPTED=false`

No production Mother branch, Hair asset, main, gh-pages, R2, public route, global gate or schedule was modified by this learning round.
