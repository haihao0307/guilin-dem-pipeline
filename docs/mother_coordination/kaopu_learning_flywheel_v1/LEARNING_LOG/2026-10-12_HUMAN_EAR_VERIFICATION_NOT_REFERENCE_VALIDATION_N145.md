# KAOPU Learning Flywheel N145 — EAR-R03 functional verification is not reference-anatomy validation

Date: 2026-10-12 (Asia/Shanghai)  
Scope: Human / EAR-R03 only  
Decision: local Candidate regression; external method `NO_NOVELTY`; no OS or production change

## Bounded question

Can EAR-R03's green functional, parameter-response and topology-safety suite promote the reference-locked ear as anatomically validated when its own review still finds the ear root and tragus soft?

Answer: no. The valid state is `HOLD_REFERENCE_ANATOMY_IDENTITY_UNBOUND`.

## Existing real failure

Exact production subject: PR #226, source/evidence head `2cb1a37763893ccb68240190d3b15951515f17cc`, frozen public build `7e223fed91b389b9ff9b6709593930095b6120a4`, workflow run `38188931546`.

The suite proves useful scoped facts:

- 63 candidate assertions and 18 fixed-public assertions passed;
- the derived mesh is finite, the canonical buffers remain unchanged and local triangle/sheet guards report zero violations;
- all geometry controls respond while the opposite ear remains isolated;
- material controls change rendered pixels; archive, undo/redo and viewport checks pass.

But `verify.cjs` has no approved subject-reference digest, calibrated anatomical anchor ledger, semantic region comparison, frozen reference-fidelity tolerance or independent anatomy verdict. PR #226 and `RESEARCH.md` independently record that close-up ear root/tragus remain soft. The test suite did not catch that limitation; a user or manual reviewer did.

This is not an accusation that PR #226 falsely claimed final acceptance: the PR explicitly keeps user visual approval pending. The failure mechanism is narrower: if the current green suite were treated as `CANDIDATE_READY`, the user would again become first-line reference QA.

## External method/evidence

NASA's Systems Engineering Handbook separates verification (objective evidence that specified requirements were met) from validation (evidence that the product fulfills its intended use in the intended environment). NASA's Independent V&V guidance also requires an independent assessment based on objective evidence.

This is `NO_NOVELTY` at KAOPU OS level. R2 already separates Machine and Reference Fidelity gates and forbids Producer self-approval. The new information is the exact EAR-R03 counterexample showing that the current implementation only exercised the first gate.

Primary sources:

- https://www.nasa.gov/reference/5-0-product-realization/
- https://standards.nasa.gov/standard/nasa/nasa-std-87398
- current EAR-R03 research already uses NIH/NHGRI ear anatomy terminology: https://elementsofmorphology.nih.gov/anatomy-ear.shtml

## Comparison with current KAOPU system

R2 already requires fixed-view reference fidelity for silhouette, proportions and key anchors. `VISUAL-GOLDEN-UPDATE-SEPARATION-001` already governs immutable image baselines and independent approval. Neither currently binds EAR-R03's named anatomy to the exact subject/reference views.

Therefore N145 does not add a second pixel-golden system. It adds a subject-specific semantic receipt for visible ear anatomy: helix-root attachment, tragus, antitragus, intertragic notch, crus helicis, cymba/cavum conchae and lobule attachment. Generic anatomy references may name these structures but cannot authorize exact coordinates for this person. Unknown/occluded regions remain UNKNOWN.

## Falsifiable hypothesis

If the exact EAR-R03 candidate is evaluated with a subject-bound, independently approved anatomical anchor ledger and frozen comparison plan, the gate will either:

1. detect the already observed ear-root/tragus softness and return `REFERENCE_ANATOMY_REGRESSION_DETECTED`; or
2. produce objective evidence that those structures fall within pre-authorized tolerances and return `SCOPED_REFERENCE_ANATOMY_VALIDATED`.

The hypothesis is falsified if the semantic gate cannot distinguish a deliberately softened/misplaced tragus or helix-root attachment from the approved reference while all existing functional checks remain green.

## Minimal replay / trial

The new de-duplicated Candidate regression contains six classification fixtures:

1. exact R03 green-functional/no-reference-ledger → HOLD;
2. generic NIH anatomy/no subject binding → HOLD;
3. screenshots without semantic comparison → HOLD;
4. Producer approves its own updated reference → HOLD;
5. occluded tragus filled by procedural default → creative-substitute HOLD;
6. subject-bound ledger + frozen thresholds + independent verifier → scoped pass.

Classification replay: 6/6. This is metadata/history replay only, not a Human production gate run.

The smallest real single-Mother trial is one exact-build comparison, not another geometry rewrite: bind the authorized left/right close-up views, mark visible/unknown anatomy, project the current mesh into the calibrated views, measure only the frozen visible anchors/curves, and let an independent verifier classify the result. Thresholds remain `UNKNOWN` until the reference measurement plan is approved; N145 does not invent them.

## Applicability boundary

Applies only to reference-locked visible ear refinement where a specific subject/reference set exists. It does not certify full ear canal, cartilage volume, population statistics, FEM/contact physics, film readiness, physical-device performance or user acceptance. It is not a license to infer hidden ear anatomy or import a generic ear scan.

## Decision and lifecycle

- External NASA V&V method: `NO_NOVELTY`.
- Regression: `CANDIDATE`, Human EAR local only.
- `POSTED=false` until PR #226 route receipt exists.
- `ACKNOWLEDGED=false`.
- `IMPLEMENTED=false` in Human production.
- `CLASSIFICATION-GATE-RUN=true` (6/6 replay).
- `HUMAN-PRODUCTION-GATE-RUN=false`.
- `ADOPTED=false`.
- `USER-ACCEPTED=false`.

No production Mother branch, global R2 gate or user-visible artifact was changed.
