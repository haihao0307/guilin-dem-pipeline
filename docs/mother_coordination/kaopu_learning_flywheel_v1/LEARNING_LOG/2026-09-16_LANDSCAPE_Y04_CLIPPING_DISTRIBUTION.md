# KAOPU Learning Flywheel — Landscape Y04 clipping-distribution audit

Date: 2026-09-16

Status: **Candidate partial / negative control**

## Bounded question

How does the current per-vertex safety clamp change displacement distribution and periodic-domain error in PR #79 head `21861af63591d42bb84b9a88e00ef645ffc55b76`?

## Evidence identity

- Integrated HTML SHA-256: `36ca41019aaa9f05b027a9129d7a531750254b29625ec2b896cd29ec2cb8f7ec`
- `runtime-qa.json` SHA-256: `b7d16e5d56913875d6cd124a3968bf6c211cdf20625823332c9fdf2cf4eced43`
- CPU replay exactly reproduces 310,074 vertices, 624,172 triangles, 53,492 protected vertices, 199,324 clipped vertices, zero protected drift, zero flips, maximum displacement and RMS displacement.
- This replay and CI are the same source lineage. CI proves reproducibility, not independent browser or hardware evidence.

## Observations

- Of 256,582 active vertices, 199,324 are clamped: `77.684327%` of active vertices and `64.282720%` of all vertices.
- One-third-triangle vertex area weighting estimates `74.344899%` of the active surface area as clipped.
- The clamp retains only `23.428613%` of total vertex displacement magnitude and `3.754075%` of squared displacement energy.
- Area-weighted mean absolute displacement falls from `0.02955794 m` to `0.00814402 m`; RMS falls from `0.04411880 m` to `0.00970748 m`.
- The area-weighted signed mean changes from `-0.00090436 m` before clamping to `+0.00228753 m` after clamping. The clamp therefore changes not only amplitude but also the sign of the aggregate displacement bias.
- Clipping is spatially nonuniform. Active-vertex clipping is about 75–85% through normalized height bands 0.2–0.8, but 50.49% in band 0.1–0.2 and 4.48% in band 0.9–1.0.

## Periodic negative control

The replay evaluates the same physical `x/y/z` with identical field inputs while shifting only the angular coordinate by exactly `2π`.

- Raw area-weighted mean absolute offset difference: `0.01355849 m`.
- Post-clamp area-weighted mean absolute difference: `0.00287792 m`.
- The non-periodic field affects 256,580 active vertices; clamping masks 162,801 of those defects to zero at Float32 storage precision.
- Post-clamp median difference is therefore zero, yet p95 remains `0.01491011 m` and maximum remains `0.06226752 m`.

The clamp can hide most sampled periodic defects in a median or visual spot check, but it does not make the field periodic.

## Current Best View

- **Observation:** current source/QA contract is exactly replayable, and topology/protected-anchor gates pass.
- **Candidate partial:** local mesh-scale clamping and bandwidth filtering are useful topology safeguards.
- **Candidate fail:** the requested amplitude and raw field distribution are not preserved; most active vertices and area are clamped, with strong magnitude/energy loss and a signed-mean reversal.
- **Rejected:** post-clamp median-zero periodic difference proves seam closure.
- **Unknown:** acceptable mean, derivative, distribution, morphology and clipping thresholds. No physical or visual acceptance limits are approved.
- **Unknown:** browser/device appearance and collision/SDF coupling.
- **Frozen:** production Mother branches, Canonical Truth and Frozen R1 remain unchanged.

## Transferable method

For bounded procedural displacement, record the pre-clamp and post-clamp distributions separately. At minimum keep area-weighted signed mean, mean absolute displacement, RMS, clipping fraction by area and region, and the preservation ratio of magnitude/energy. A topology-safe clamp is not a neutral implementation detail: it can alter bias, spatial morphology and diagnostic visibility.

## Next bounded gate

Landscape Mother should first integrate a genuinely periodic field. Then re-tune field amplitude/frequency and mesh bandwidth so clipping is an exceptional safety fallback rather than the dominant operator. Pre-register the allowed clipping fraction and distribution-preservation thresholds before visual approval.

## Receipts and limitations

- Machine workflow: https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/35092421223
- Artifact digest: `sha256:121c4d599539f0e8bdfe3e7f38649fe367b7b88f06620a929a1967fe99bfecde`
- The area weighting assigns one third of each triangle area to every incident vertex; it is reproducible but is not a volume-conservation proof.
- Near-degenerate mesh edges make maximum edge-slope values unsuitable as a physical threshold; robust distributions are retained, while derivative acceptance remains Unknown.
- Two local exploratory instrumentation errors were corrected before freezing the probe: array ownership and Float32 clip classification. The first frozen CI run passed unchanged.
- First-tier expert AI was not called; this was not an expert meeting.

