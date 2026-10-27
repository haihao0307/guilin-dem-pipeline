# Current profile result

Read PROFILE_WHOLE_NEIGHBOR_SUMMARY.json first. The newest profile_beta011/profile_beta0126/profile_beta016 snapshots have baseline 519 / candidate 636, 135 new bodies and 269 potential pairs each. All pairs were searched. Negative counts 16 / 16 / 15 exactly replay; they consist only of intended casting/rigid connection unions and TWO inherited articulated outside-spindle/combination-lever overlaps. No new detachable-cover, fastener, gland, guide, frame or support intrusion witness was found. 253 / 253 / 254 pairs remain no-witness, NOT proven clear.

The complete cover AST and independent GLSL-style interpreter agree on 6,027 scalar comparisons (maximum 4.44e-16 m). Restricted support bounds establish a nominal 2 mm minimum X gap between 43 new static cover/hardware/packing/gland/guide bodies and the power-cylinder envelope for all beta/time. Web-to-removable-cover Z gaps are 2 mm rear and 10 mm front. All 10 stored earlier failure points are removed by the current fields. No historical, pressure, structural, serviceability or whole-train acceptance is asserted.

Replay current witnesses with `python replay_compact_witnesses.py profile_beta0126`, or either endpoint folder. All seven historical/current snapshots remain present.

## Historical evidence retained below

# R29 whole-neighbor audit checkpoint

This is a compact engineering checkpoint, not a completed model or acceptance report.

## Replay without the full model

Run `python replay_compact_witnesses.py initial_snapshot` and likewise for `final_beta011`, `final_beta0126`, and `final_beta016`. NumPy is required. The directories named final_beta are preserved failed integration attempts, not final accepted models. Every saved witness must remain strictly negative in both exact scalar fields. No optimizer is used during replay.

## Findings

- Initial candidate: 519 baseline / 585 candidate bodies. Detachable power rear cover interference and two uncut frame intrusions are real failures. Shaft/head and intended casting unions are separate categories.
- Rear chest relocation exposed a beta=0.11 detachable power front-cover failure. Its exact replay is included.
- Second integrated candidate: 519 baseline / 598 candidate bodies, including explicit cut frames and 14 fixed support fields. Full new-body versus whole-train and new/new search completed at beta=0.11, 0.126, 0.16. There were respectively 19, 18 and 16 negative pairs; many are intended connections, but detachable valve-cover versus cylinder wall and rear web overlaps remain real failures.
- Candidate-only frame cuts remove both original frame witness points. No new frame/support negative witness was found. The support field interpreter agrees with the native analytic shape exporter at 574 validation points to 1.11e-16 m.
- Both original detachable power covers are conservatively separated from the moved chest covers across beta 0.11..0.16. This does NOT prevent the newly discovered intersections with cylinder-wall material.
- Restricted all-beta/all-time lateral and bore-exclusion arguments are included. They are not whole-train acceptance.
- Two inherited outside-spindle/combination-lever overlaps are articulated interface problems, not rigid-body unions or R29-created regressions.

## Limits

AABB broadphase and local minimax search use 72 phase poses, then up to 6 selected poses per pair. A positive best value or optimizer failure proves nothing. Neither ordinary source photographs nor this model establish the numerical dimensions. No historical, pressure, strength, serviceability, steam-port/event or whole-mechanical acceptance is claimed.

Full raw source/part/frame snapshots remain in the local study. They are intentionally excluded here. The model module hashes, selected source expressions, exact inverse transforms and witness points make compact replay self-contained. Reconstructing the entire historical train requires the matching source checkpoint, not just a hash.
