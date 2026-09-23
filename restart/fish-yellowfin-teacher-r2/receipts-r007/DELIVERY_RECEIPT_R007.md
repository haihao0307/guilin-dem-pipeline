# Fish R007 — head/eye source study, verified delivery

User instruction: 你继续往下作吧.

## Exact implementation and public delivery

- Base: `3b8bc075d3339c76a590823d78a197e7ad886691` (R006.1 repair and records).
- Tested implementation: `d1e9b56f6456673d214ed165a8801a0beca0d249`.
- Branch: `work/fish-yellowfin-head-r007-20260924`.
- Run `35891489740` / job `107286496975`: every step SUCCESS.
- Fixed direct entry: https://haihao0307.github.io/guilin-dem-pipeline/fish-mother-yellowfin/?v=r007
- Bare and versioned public URLs returned exact HTTP200 built HTML: **85,008,988 bytes** / SHA256 `8889150e1a3aaf01184257ba5ac0dc779d4ae7855db37a2a01654183b2df474f`.
- Public proof time: `2026-09-23T17:08:35.823989+00:00`.
- Proof Git blob: `884ac4fcd9040e7b8e6b92746d17ada7cb80d508`; public browser QA blob: `bdb233dcffe241890ed20bcea846c3cb27fae128`.
- Actual Chromium/WebGL2 file-protocol and final-public browser checks passed, including desktop and 390x844 viewport, source regressions and injected-fault recovery.
- Ordinary regression page/console errors: 0. User hardware and physical mobile/Safari were not tested.
- This receipt-only commit changes no HTML or production code and does not imply tests reran on its later SHA.

## Visible increment

The new `头颌与眼区` panel examines seven exact original author controls: Head_05, UpperJaw_06, LoweJaw_09, Eye.L_07, Eye.R_08, Side.L_010 and Side.R_011. All 21 source track references remain. The workbench supports original-material/weight display, head focus, live local transforms, original control axes, the source sampled axis-tip trajectory and a jump to the original sample with greatest control rotation from the clip start. No new jaw/eye motion was created.

Four source eye/cornea triangle-area centroids are defined engineering probes, not approved anatomical orbital centers. Twenty-four original head-to-mouth-interior seam edges remain visible. Side controls are not silently renamed to operculum. A displayed control-axis tip is a display probe, not an anatomical feature.

Source interpretation: each eye quaternion curve has two original sign crossings. The sign-invariant sampled angle does not support treating these as eye flips. The lower-jaw control's approximately 4.26973-degree local displacement from clip start is not a measured biological gape angle. Original signs and curves are preserved. External interpolation interpretation was checked against Khronos glTF2.0 appendix C.3/C.4; it does not supply missing biological data.

## Independent source and runtime checks

The original 129,163,961-byte ZIP was re-read, ZIP CRC verified, and all 603 glTF accessors compared byte-for-byte with canonical fields. All 21 head-track references match source JSON. Local compile_head.py matches GitHub blob `28d2fdd5985ed5f9ed28901ad7c07b6ed1cf20e2`.

The head compiler was rerun independently; head-evidence.json and HEAD_QA.json are byte-identical to the first computation. The head evidence is 928,528 bytes / SHA256 `88922e6d821180953effa34686ffce46ed48db00aac0f3c9b2aeb1efb25f396b`.

The Python source-curve decoder is checked against both the original loaded teacher and canonical runtime at rest plus **209 non-loop clamped source times**, including the real clip endpoint rather than substituting the loop start. Maximum source/candidate matrix component difference: `5.007339148876966e-8`. Local TRS maximum: `2.5911024659208692e-8`. Eye-surface probe maximum Euclidean difference: `5.007008837423145e-8`. All remain below the unchanged normalized `1e-6` threshold. The 209 whole-fish poses, 17 isolated regions, source seam/section checks and all earlier interaction gates remain in force.

## Actual pixel review exposed an inherited display defect

First implementation `2ae157f09512db7505ff64a1f78dfce4a97f039b`, run `35890512697`, passed numerical/interaction tests. Its hash-verified browser screenshot was actually opened and showed the candidate remaining translucent in original-material mode. Numerical success was not treated as visual acceptance.

Cause: ghost mode wrote opacity 0.16 into mutable original material objects, which ghost-off then reused as restore defaults. Correction `d1e9b56...` snapshots immutable original opacity, transparency and depth-write flags. It changes display-state restoration only, not teacher textures, shape, skeleton, skin data or animation.

New public regressions compare each restored candidate flag against the reference and repeat the ghost on/off cycle. Body/eyeballs restore opacity 1, opaque, depth-write true; cornea retains the teacher's opacity `0.028952469188477523`, transparent, depth-write false. No forced opaque cornea or changed source alpha.

Corrected screenshot was fetched from frozen public commit `4736fa815536b08c8cc55446542dfcedcfa00912`. Original PNG SHA256: `cf3e709b400da9834e0d4d4a9e69beeae9d5da404310e459dc4dae4b8f16c556`. Inspection copy: 5,306 bytes, Git blob `28bcb6565612f4c042414f14bcc2e71288aa575f`, SHA256 `3707579ac482e2c9f6355b967ec6b31c9b060801801493e79537145aaedb1ca7`. Its bytes were checked and pixels actually viewed: both head surfaces are visible and the candidate no longer retains ghost transparency. This limited internal view is not whole-asset artistic, biological or user-device approval. First defective image and implementation evidence remain preserved.

## Repaired opening path and source precision preserved

R006.1's independently visible first HTML, 75 bounded exact-source chunks, visible error/retry and context-loss handling remain. The original 4K textures and source GLB SHA256 `5603d4aabc9a1127856841335a86ae7aa462b6b25d1a6586e93bf644f4d47abe` remain unchanged. The standalone HTML still embeds necessary data and runtime; no unzip/path configuration or external runtime dependency was introduced.

Old repaired R006.1 is preserved under `fish-mother-yellowfin/r006-1/`; earlier rollbacks remain. Only Fish paths were changed by this execution. The source-study work does not implement Game #85 or change other Mothers' production assets.

## Persistent records and verified readback

Original ZIP SHA256 remains `af4d26c462963298dcfa4784e32e6c731e8814ad2c308887012a5a41624eb550`; original raw file `file_000000002050820c86045a49bd5a37f2` / `libfile_5e371be593688191a775cdaae625a4d4` remains separate. The record package is not presented as a replacement raw source archive.

R007 Library folder: `/KAOPU_SOURCE_VAULT/Fish/YELLOWFIN_TEACHER_001/Head_R007/`.

- Head-field file `file_00000000e50481f7af5deadec93cb211` / `libfile_721b2bab40a88191b120f24568cdfd29` independently materialized and byte-compared: 928,528 bytes and the exact head-evidence SHA above.
- Record archive `file_000000008234820a84f6884ec1aca77e` / `libfile_8fb95f47b7d08191932aaaf93eed77f9`.
- Archive bytes: 3,195,357; SHA256 `5989dade19e8ea44cc47f3aac6a469cb123b1ca5ceb4b40e599decdb35a72590`.
- Independently materialized back at `2026-09-23T17:11:33.677029+00:00`: byte-identical, ZIP CRC and all 22 manifest entries passed.
- Includes new source data/compiler/checks, both inspected images, full continuous logs, exact immutable remote code locators and complete prior R006/R006.1 records.
- The previous complete execution log's 44,999-byte prefix is preserved; user utterances remain verbatim and separate from execution analysis.
- Local publication receipt is labelled a transcription summary, not a byte-identical public proof.

## Remaining ordered work

Continue source-backed head/jaw/operculum/eye landmark interpretation and coordinator semantic review under the existing method. No measured physical fish length, age, growth series or approved operculum labels were supplied by these checks. Do not infer biology from control names or source area centroids. Do not skip to compression, variants, re-rigging or Game assembly.

`anatomicalPartitionApproved=false`; `stageAComplete=false`; `independentGenerator=false`; `productionReady=false`; `userDeviceRetested=false`; `originalClientCauseConfirmed=false`.
