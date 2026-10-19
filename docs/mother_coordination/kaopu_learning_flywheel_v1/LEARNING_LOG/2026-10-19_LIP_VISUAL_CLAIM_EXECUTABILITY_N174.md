# KAOPU Learning Flywheel N174 — Lip R04 visual claim executability

## Bounded question

Does PR #308 execute the scoped pale-inner-wall correction as a production regression, or does it only execute technical comparison while the correction decision remains manual?

## Baseline and exact subject

Current `main` remains `5543f756ca3af1428323696324303fa70b8de850`. R2, the replication gate, freshness gate, root `AGENTS.md`, #91/#63 and `USER-CORRECTION-REGRESSION-BINDING-001` were read before selecting this question. PR #308 remains Draft at `ab2641ef0bfe038aafd3956611590c9e4ab9d09e`; no Mother acknowledgement followed the N173 route.

## Finding

`TECHNICAL_DELTA_VERIFIED__HOLD_VISUAL_CORRECTION_CLAIM_NOT_EXECUTABLE`

The production workflow is strong on technical identity and replayability: it binds source/build bytes, generates five R04/R02 pairs, protects native state, checks shader/uniform ownership, validates three real downloads and fresh-context restoration, reads the immutable public bytes, and completes cleanup.

It does not execute the defect-correction claim:

1. Every pair test computes only `changedPixels`, `maximumChannelDN` and `meanMaxChannelDN`, explicitly describing the result as a measured response rather than an aesthetic score.
2. No threshold, direction or defect ROI/mask requires the pale inner-wall wedge to be reduced. The complete workflow does contain a final `jaw/oblique.changedPixels > 0` response assertion, so zero delta cannot pass. However, that predicate is direction-blind: equal-magnitude darkening and lightening both pass, even though only one may move the named defect in the intended direction.
3. `CANDIDATE_ANCHOR.reviewedFiles` includes the two product modules, build, verifier and `SURFACE_CONTRACT.json`. It does not include the independent visual review, final visual binding or final audit receipt.
4. The workflow's closing step explicitly keeps `visualAcceptance=false` and says aesthetic acceptance remains separate.

Therefore N173's direct independent review remains valid for the exact 12 frames, but it is an Observation/manual verifier receipt, not a production regression `GATE-RUN` for the visible correction.

## Regression decision

Do not create a new case. Extend `USER-CORRECTION-REGRESSION-BINDING-001` with an evidence-layer distinction:

- technical comparison gate run: true;
- independent manual partial correction observation: true;
- executable visual defect oracle in production gate: false;
- user acceptance: false.

The isolated classifier replays the observed R04 and nine counterfactual controls: 10/10.

## Minimal falsifiable single-Mother trial

For the three named views (`jaw_macro`, `jaw_oblique`, `speak_macro`), the bounded next trial is a machine-checked independent-review receipt: bind the exact subject/build, all three R02/candidate pair digests, actual independent reviewer identity, defect-specific per-view decisions, and the R02 known-bad judgement. Missing, substituted, stale or producer-self-approved review must HOLD; new pixels require a new review. This automates evidence binding, not aesthetic judgement. A numeric ROI/directional threshold remains Candidate-only until an over-dark or flat-wall counterexample can be rejected. Neutral, pucker, whole-lip realism, dynamic continuity, other-person coverage and user acceptance remain out of scope.

This is a Candidate only. It does not prescribe a universal beauty score and does not modify PR #308, R2, main or a production workflow.

## Lifecycle

- PR #308 technical target: `IMPLEMENTED=true`, technical `GATE-RUN=true`.
- Visual correction production regression: `IMPLEMENTED=false`, `GATE-RUN=false`.
- Learning route: `POSTED=true`; directed receipt: https://github.com/haihao0307/guilin-dem-pipeline/pull/308#issuecomment-6254291302.
- Coordination clarification: `POSTED`, not `ACKNOWLEDGED`; https://github.com/haihao0307/guilin-dem-pipeline/pull/308#issuecomment-6274356026.
- `ACKNOWLEDGED / ADOPTED / USER-ACCEPTED=false`.
