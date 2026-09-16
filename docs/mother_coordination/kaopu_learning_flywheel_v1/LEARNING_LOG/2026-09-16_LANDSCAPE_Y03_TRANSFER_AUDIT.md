# KAOPU Learning Flywheel — Landscape Y03 transfer audit

Date: 2026-09-16

Status: **Candidate partial / negative control**

## Bounded question

Does the current PR #79 head close the Y01/T03 anchor, mean, derivative and periodic-seam transfer gates?

## Observation roots

1. **Old isolated R1 source replay** — pinned source commit `83d3649728e1eb2c21c995f42e9bb0026c20a464`, SHA-256 `1e7404a272b1887908030743d83eea17f63c491ce4c62211dfb1313882b24c52`. The CPU replay matches the page's Float32 typed storage and field formulas. It is source-derived executable evidence, not a browser or independent observation root.
2. **Current integrated candidate contract** — PR #79 head `21861af63591d42bb84b9a88e00ef645ffc55b76`, inspected at the integrated HTML and `runtime-qa.json`. This is the current source/QA contract, not a rerun of the 310,074-vertex browser workbench.

The two roots are related implementation evidence and are not counted as independent empirical confirmation.

## Observations

- The old R1 replay preserves all exact `M=0` anchors under every audited control case: zero protected drift.
- Its source-derived protected count is 3,138: 3,136 side vertices plus explicit TOP and BOTTOM. The old `build.json` reported 3,136, so that evidence count omitted the two cap vertices.
- Under default controls, the active-vertex mean detail is `0.014553657060054513`, and the active-vertex mean normal offset is `+0.007055281818647153 m`. Removing erosion bias, removing direction/warp, or changing scale changes the mean; the field is not demonstrated mean-neutral.
- The old replay's maximum edge displacement-slope proxy is `0.3921925495538681` at six layers and `0.39164739429810114` at nine layers, versus `0.2389902729590136` at one layer. Amplitude attenuation alone does not monotonically eliminate derivative stress.
- The current integrated source still contains `Math.sin(th*2.3+y*.07)` and does not contain the claimed integer-harmonic replacement `Math.sin(th*2+y*.07)`. Therefore the claimed periodic-seam closure is not present in the actual integrated head.
- Current QA reports 310,074 vertices, 199,324 clipped vertices (`64.28271960886755%`), 53,492 protected vertices, zero protected drift, zero triangle flips, six requested layers reduced to two effective layers, maximum displacement `0.040518965721130375 m`, and maximum normal change `11.910635606573928°`.
- Current QA records neither a mean metric nor a derivative/gradient/slope metric. It also records `geometryFieldCoupled=false`, `visualApproved=false`, and `productionReady=false`.

## Current Best View

- **Observation:** exact protected anchors and zero triangle flips pass in the recorded candidates.
- **Candidate partial:** bandwidth filtering plus a per-vertex displacement cap is a useful reversible safety control.
- **Rejected:** “T03 periodic-seam repair is present in the current integrated PR #79 head.”
- **Candidate fail:** mean-neutral transfer is not demonstrated; the old replay supplies concrete control-dependent nonzero means, while the current integrated QA has no mean measurement.
- **Unknown:** derivative acceptance. A reproducible proxy exists, but no physically justified threshold has been approved; current clipping and layer reduction are safeguards, not a derivative proof.
- **Unknown:** whether clipping 64.28% of vertices preserves the intended field distribution and morphology. The requested amplitude cannot be read as the realized response over most vertices.
- **Unknown:** browser/device visual acceptance, collision/SDF coupling, and production suitability.
- **Frozen:** production Mother branches, Canonical Truth and Frozen R1 remain unchanged.

## Rejected claims

- Exact anchors and zero triangle flips are sufficient transfer acceptance.
- Amplitude-decaying octaves imply a bounded derivative budget.
- A requested amplitude equals the realized field response when most vertices are clipped.
- A bot/task summary proves that its described periodic repair exists in the current branch head.

## Transferable method

For procedural displacement transfer, keep four gates separate: exact protected anchors, field mean/distribution, derivative budget, and topology/visual acceptance. Record clipping fraction and post-clamp distribution explicitly. Verify claimed fixes against the actual integration head, not only a task reply or an unintegrated candidate.

## Next bounded gate

Landscape Mother should carry the periodic angular repair into the actual integrated file, then add area-weighted displacement mean, clipped/unclipped distribution, seam delta, and an explicitly justified derivative proxy/budget to QA. Re-run before visual acceptance; do not promote based only on zero flips and zero anchor drift.

## Evidence and limitations

- Machine workflow: https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/35082120408
- Workflow artifact digest: `sha256:890064fa50e35cf60eefdc038fd747bef5ba3f3c204293e275f1ebeec0812cd8`
- The first two Y03 runs remain provenance; the final run supersedes them because it binds the current PR head.
- First-tier expert AI was not called. This was a bounded source and executable-evidence audit, not an expert meeting.

