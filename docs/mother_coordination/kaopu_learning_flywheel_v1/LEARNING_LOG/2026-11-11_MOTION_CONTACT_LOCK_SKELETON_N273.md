# KAOPU Learning Flywheel N273 — Motion contact lock skeleton-constraint audit

Date: 2026-11-11 (Asia/Shanghai)

## Scope and baseline

This round read the current main baseline before selection:

- main: `73452580929bc9cc37a8e57d79da69af994af808`
- root `AGENTS.md`: blob `251b664646a489e9292748f1d41998ee62a338f5`
- R2 OS: blob `d942d44bad0bbd206ea3768d620ad60d5ddeb2bf`
- no-creative-substitute gate: blob `8c0a49c71865ef76cbc614f8188239bc808a8278`
- freshness gate: blob `4754a90a94e4a9e7806357b6eb292e5c713e9021`
- #91 latest real feedback: comment `6794954785` (N272 POSTED, not ACKNOWLEDGED)
- #63 latest real feedback: comment `5910449798`
- applicable prior cases: R2 Machine/Reference gates and user-correction-to-regression; no existing Motion contact-lock case was found in the routed evidence. Hair arc-length cases N206/N207 are related invariant-custody examples but do not cover articulated skeleton contact cleanup.

The accidental main README commit `3cdf3944...` was reverted by `73452580...` after 130 seconds. That is a corrected documentation incident and adds no new mechanism by itself. It was not selected as this round's bounded question.

## One bounded question

Does PR #344's horizontal `lfoot/rfoot` anchoring remove contact drift without breaking the articulated skeleton edge lengths?

Exact subject:

- PR: https://github.com/haihao0307/guilin-dem-pipeline/pull/344
- head: `b6395634f0598aac144c4054aa5119f884f27722`
- pack path: `kaopu-unified-human-workbench/motion-atlas-r03/cmu-sample-pack.json`
- pack Git blob: `8fb1c53c733832bdbf727d82f21fe01aa8fff4e9`
- pack SHA-256: `521c5545f6c9733c248e4abb57c3245b9a5f1d6b1a32c884ab6784fc83f621b9`
- exact-head workflows: Motion Library R02 QA run `43004943002` success; Motion Atlas R03 package run `43004942967` success.

The current viewer first smooths every global joint point independently, then overwrites only the contact foot's horizontal XZ coordinates with the first contact sample. Tibia and toe points continue on their own smoothed paths. The existing tests correctly prove the overwritten foot point has zero horizontal drift, but they do not measure adjacent edge lengths.

## Exact-subject replay

Command:

`node motion_contact_lock_skeleton_gate_n273.mjs cmu-sample-pack.json`

Result:

- clips decoded: 3 exact CMU records (`16_33`, `16_57`, `16_01`)
- candidate replay assertions: 4/4 PASS
- maximum adjacent-edge change, smoothing only: `0.8041758861 mm` / `1.2235637878%`
- maximum adjacent-edge change after preview foot lock: `44.2950369775 mm` / `70.9783734111%`
- all three clips cross the single-Mother smoke sentinel
- worst case: `16_33`, left `lfoot->ltoes`, frame 163, source `62.4064 mm`, locked `106.7014 mm`

Decision:

`HOLD_ZERO_DRIFT_BREAKS_SKELETON_EDGE_LENGTH`

This does not reject the source clips, quantization, compression, CI, or the honest Draft status. It rejects only the stronger inference that zero foot drift means the cleanup is skeleton-valid.

## External teacher audition

Teacher: InterDigitalInc/UnderPressure  
Status: `TEACHER_CANDIDATE / AUDITION` for method observation only.

What it knows beyond KAOPU Current Best View on this exact problem:

> Contact targets should be solved through a fixed articulated skeleton's forward kinematics by optimizing joint rotations and root trajectory, with contact/force consistency losses, instead of overwriting one global foot point while leaving adjacent joints unconstrained.

Screen:

1. Source/provenance: official implementation of the 2022 SCA/Computer Graphics Forum paper by InterDigital R&D France.
2. Maintenance: public repository is not archived, but latest visible commit is 2023-05-14 and there are only 14 commits; current maintenance is weak.
3. Reproducibility assets: source code, pretrained model, ten-subject pressure-insole/mocap dataset links, and a demo exist. No automated test/CI suite was observed.
4. License/rights: the Limited Software Evaluation License restricts use to non-commercial fundamental research and prohibits adaptation/modification. KAOPU must not copy, modify, or integrate this code into production. Only method-level observation is in scope.
5. Direct relevance: exact foot-contact detection and footskate cleanup.
6. Novelty: adds fixed-skeleton FK + angle/root optimisation + contact-force consistency, which the current point overwrite lacks.
7. Dependencies/cost: Python 3.9.7, PyTorch 1.10.2, CUDA 11.3, Panda3D, dataset/pretrained weights; transfer and compute cost remain unknown.
8. Failure risks: learned contacts may not transfer to CMU clips or KAOPU skeletons; old dependencies and restrictive license block direct production adoption; pressure-insole truth is absent from the current three clips.

Primary sources:

- https://github.com/InterDigitalInc/UnderPressure
- https://github.com/InterDigitalInc/UnderPressure/blob/main/footskate.py
- https://github.com/InterDigitalInc/UnderPressure/blob/main/LICENCE.txt
- https://doi.org/10.1111/cgf.14635

## Candidate translation

New Candidate regression:

`MOTION-CONTACT-LOCK-NOT-SKELETON-CONSTRAINT-001`

Single-Mother minimum trial:

1. bind the exact source digest, topology, contact intervals and coordinate space;
2. compare current smooth-only and single-joint lock paths;
3. add one fixed-skeleton FK/IK candidate path without copying UnderPressure code;
4. measure contact drift, adjacent edge-length delta, contact-transition continuity and root/hip reachability;
5. include known-good and known-bad controls;
6. require independent verifier rerun before any adoption.

The `5 mm / 5%` sentinel in this replay is a Candidate smoke threshold only, not a global production tolerance. The exact production threshold remains `UNKNOWN`.

## Routing and lifecycle

Before routing:

- Candidate regression: `IMPLEMENTED=true`
- exact-subject history replay: `GATE-RUN=true`
- `POSTED=true` via #91 comment `6800436338`
- `ACKNOWLEDGED / production IMPLEMENTED / production GATE-RUN / ADOPTED / USER-ACCEPTED=false`

No main, PR #344, production Mother branch, R2, global gate, user-facing page, or automation was modified.

