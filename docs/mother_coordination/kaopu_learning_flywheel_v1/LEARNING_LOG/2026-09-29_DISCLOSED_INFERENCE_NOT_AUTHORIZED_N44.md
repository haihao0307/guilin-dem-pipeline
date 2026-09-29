# N44 — Disclosed inference is not authorization

Status: `Candidate`; bounded institutional question only. No production branch, R2 baseline, reference gate, or global Mother policy was changed.

## Bounded question

Can a Producer turn a reference-locked task into a publicly shareable visible approximation merely by truthfully labelling hidden geometry as inferred, scale as assumed, identity as unresolved and user acceptance as pending?

## Existing real failure

The active animals R03 subject is exact head [`46946c33c89ed05170d38992d86dd0a615627bbf`](https://github.com/haihao0307/guilin-dem-pipeline/commit/46946c33c89ed05170d38992d86dd0a615627bbf). Its exact-head workflow run [`36536737364`](https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/36536737364) succeeded, and its public proof retains three valid machine facts: portable independent score replay, live browser verification and exact public-byte verification.

The same proof also records `referenceReconstruction=APPROXIMATE`, `hiddenSurfaces=INFERRED`, `scale=ASSUMED`, `tortoiseSpecies=UNRESOLVED`, `visualAcceptance=PENDING_USER`, and `productionReady=false`. The [Task Anchor](https://github.com/haihao0307/guilin-dem-pipeline/blob/46946c33c89ed05170d38992d86dd0a615627bbf/kaopu-animal-r03/TASK_ANCHOR_R03.json) does not declare `TASK_MODE=REPLICATION_LOCKED`, a Reference Coverage map, a visible-delta basis map, or scoped creative authorization. The supplied source photos were not present in the inspected delivery artifact, so exact visual fidelity remains `Unknown`; this record does not invent a pixel-level mismatch claim.

The failure is narrower and directly observable: disclosure was used as a substitute for authorization, while green structural checks were allowed to coexist with `shareAllowed=true` for visibly complete inferred forms.

## External method and evidence

- NASA Systems Engineering Handbook section 4 states that complete requirements traceability is critical to validation, that design solutions are validated against stakeholder expectations, and that assumptions and decisions should be documented and controlled: <https://www.nasa.gov/reference/4-0-system-design-processes/>.
- NASA Software Assurance states that documented requirements alone do not establish implementation or validation; objective evidence must be tied to the relevant requirement and its source: <https://sma.nasa.gov/news/articles/newsitem/2026/03/25/identifying-objective-evidence-improves-requirement-implementation>.
- NIST defines IV&V as review, analysis and testing by an objective third party to confirm both correctly defined requirements and correct implementation: <https://csrc.nist.gov/glossary/term/independent_verification_and_validation>.

Transferred KAOPU method: evidence is claim-scoped. A browser or exact-byte gate can prove replay/publication facts, but cannot prove that a visible inferred region was authorized or faithful. Disclosure records uncertainty; approval and independent reference verification are separate prerequisites.

## Comparison with current KAOPU rules

R2 and `REFERENCE_REPLICATION_NO_CREATIVE_SUBSTITUTE_GATE.md` already require `REPLICATION_LOCKED`, `CREATIVE_AUTHORIZATION=FALSE`, Reference Coverage, valid bases for visible deltas, UNKNOWN handling, and independent verification. Therefore the underlying prohibition is not new.

The new failure mechanism and executable increment are narrower: **honest uncertainty disclosure must not be interpreted as a waiver**, and valid structural evidence must be preserved rather than discarded when the reference claim is held. This is not a duplicate of the generic claim-prerequisite rule because it defines the semantic split among `DISCLOSURE`, `AUTHORIZATION`, `STRUCTURAL_REPLAY`, `AUTHORIZED_APPROXIMATION`, and `REFERENCE_RESULT`.

## Falsifiable hypothesis

If the Delivery Receipt classifies each claim and the gate treats disclosure as non-authorizing, then the historical R03 receipt will be held only at reference promotion while its valid structural evidence remains credited. Explicit, scoped creative authorization will permit an approximate Candidate without falsely promoting it to reference-verified; a complete no-inference control with an independent verifier may become reference-candidate-ready but not user-accepted.

The hypothesis is falsified if the gate either (a) erases valid structural proof, (b) allows disclosed but unauthorized visible inference, (c) allows authorization outside its stated scope, or (d) lets Producer self-approval satisfy the reference verifier.

## Minimal historical replay

`PROBES/disclosed_inference_gate_n44.mjs` was executed against ten fixtures, including the exact R03 history, disclosure-only, structural-only, scoped authorization, scope overrun, UNKNOWN-left-unrendered control, Producer self-approval, invalid visible-delta basis, failed verifier, and stale-head control.

Result: `10/10` passed.

- Historical R03 reference promotion: `HOLD_REFERENCE_CLAIM_AUTHORIZATION`.
- Preserved evidence: `PORTABLE_REPLAY_VERIFIED`, `PUBLIC_BROWSER_VERIFIED`, `EXACT_PUBLIC_BYTES_VERIFIED`.
- Scoped creative control: `AUTHORIZED_APPROXIMATE_CANDIDATE_NOT_REFERENCE_VERIFIED`.
- No-inference, complete coverage, independent-pass control: `REFERENCE_CANDIDATE_READY_NOT_USER_ACCEPTED`.
- Stale receipt: `HOLD_SUBJECT_HEAD_MISMATCH` with no inherited evidence.

## Applicability boundary

Apply only when a task is reference-guided and a visible identity, region, scale, topology or appearance depends on absent/occluded evidence. Do not use it to ban exploration, non-visual numerical inference, explicitly authorized approximation, or physics-derived changes that are validly recorded. Authorization must name the permitted inference scope; it is not global creative permission.

## Decision and routing

Decision: `Candidate`, not adopted. Route only to the score/animal Mother through issue #91 for one next-task trial. Required Task Anchor fields are `taskMode`, `creativeAuthorization`, `inferenceAuthorizationScope`, `referenceCoverage`, and `visibleDeltaClaims`. Required Delivery Receipt fields are `subjectHeadSha`, `claimType`, `machineClaimsPreserved`, `referencePromotionState`, `verifierIdentity`, and `userAcceptanceState`.

Rollback point: coordination head `b6fb1471408521c20e327bb4ff4a32de010c8609`. No production source or current gate was changed.

Lifecycle: `POSTED=true`, `GATE-RUN=true`, `ACKNOWLEDGED=false`, `IMPLEMENTED=false`, `ADOPTED=false`, `USER-ACCEPTED=false`. All requested institutional KPIs remain `unknown`; there is no real integration or comparative production sample yet.

No external AI was claimed or invoked as a participant.
