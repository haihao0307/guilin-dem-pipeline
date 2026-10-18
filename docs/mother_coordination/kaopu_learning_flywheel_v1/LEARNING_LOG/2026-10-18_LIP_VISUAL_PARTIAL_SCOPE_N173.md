# KAOPU Learning Flywheel N173 — Lip R04 visible partial correction scope

## Bounded question

Does PR #308 produce a real, attributable visual correction, and what is the narrowest claim supported by the evidence?

## Baseline read

Read current `main` R2 OS, reference-replication gate, freshness gate, root `AGENTS.md`, #91/#63 and applicable regression cases before selecting this question. Main remained `5543f756ca3af1428323696324303fa70b8de850`; this learning task did not change it.

## Observation

PR #308 binds source `9d855c6051e76a20f052c95f0dda95103d946ef7`, immutable build `f70e40b301ea964956d9915ab820e4efe1105549`, run `39110407426`, job `117625141369`, artifact `12129804986` and artifact digest `sha256:45e7354ccba8f7da9e4d392afa430474d7c24b66395a13dfa49a9dfba2532fc2`. The run completed 12/12 and preserved `visualAcceptance=false`, `productionReady=false`, `userVisualApproval=false`.

The five final R02/R04 640x512 pairs were recovered from that exact artifact and inspected directly. ImageMagick absolute-error counts are identity/instrumentation only, not aesthetic scores:

| Pair | Different pixels | Direct visual decision |
| --- | ---: | --- |
| neutral / macro | 6 | no practical improvement |
| jaw / macro | 3,293 | clear reduction of pale inner-wall wedges |
| jaw / oblique | 5,536 | clearest reduction; the large pale wedge no longer reads as outside skin |
| speak / macro | 4,598 | clear inner-wall continuity improvement; segmented bands remain |
| pucker / oblique | 1,232 | weak narrow-band change; seam remains |

The exact correction is therefore a named open-mouth subset, not “the lips are fixed”. R04 retains the frozen person and geometry and restores oral-return material responsibility. It does not solve outer-lip fill/waxiness, flat inner-wall appearance, thin seams, pinched corners, block-like teeth, dynamic continuity, other-person coverage or user acceptance.

## Regression decision

Do not create a new regression. Extend `USER-CORRECTION-REGRESSION-BINDING-001` with a partial-scope state:

`PARTIAL_CORRECTION_VERIFIED_SCOPED__HOLD_PARENT_CORRECTION_OPEN`

The executable classifier requires exact subject binding, a reason-bearing defect signature, matched bad-control/candidate pairs, named claimed views, independent visual review and a separate user-acceptance state. Replaying the observed R04 plus six counterfactual controls gives 7/7.

## Applicability boundary

- One frozen native person.
- Five static pose/view pairs.
- Software-rendered comparison conditions explicitly aligned.
- Pixel counts do not prove realism.
- No physical phone, dynamic-motion continuity, other-person generalization or user acceptance.
- R03 fine-relief remains a separate branch and is not combined into this claim.

## Lifecycle

- Target PR #308: `IMPLEMENTED=true`, production `GATE-RUN=true`.
- Learning update: `POSTED=true`; directed receipt: https://github.com/haihao0307/guilin-dem-pipeline/pull/308#issuecomment-6249552508.
- `ACKNOWLEDGED / ADOPTED / USER-ACCEPTED=false`.
- No production Mother branch, main, R2, root AGENTS or global gate changed.
