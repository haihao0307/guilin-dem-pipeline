# N283 — portable method anchor audition from the accepted excavator method

Date: 2026-11-13  
Status: **teacher audition / existing regression refinement / not adopted**  
Target: cross-project method transfer from ZX85USB-5A to Vehicle, Train, Mechanical Door Lock and Air Conditioner Mothers

## One bounded question

Can the new ZX85USB-5A functional-whole checkpoint itself serve as the reusable "correct method" baseline for rebuilding other projects, or must the accepted method first be extracted into a portable Method Anchor with dependencies, invariants and variation points?

## Fresh baseline and feedback

Current main remains `8aec1b1dca9619c0b59fc8fa480f65f226be7145`. Required baselines are unchanged:

- root AGENTS `251b664646a489e9292748f1d41998ee62a338f5`
- R2 `d942d44bad0bbd206ea3768d620ad60d5ddeb2bf`
- reference gate `8c0a49c71865ef76cbc614f8188239bc808a8278`
- freshness gate `4754a90a94e4a9e7806357b6eb292e5c713e9021`

#91 has no comment after N282 (`issuecomment-6847245450`); #63 remains unchanged. Hair has no Mother ACK or new public publication evidence.

New real user feedback: the excavator lane is now the accepted **correct method**, and prior Automobile, Train, Mechanical Door Lock and Air Conditioner work must be redone under that method rather than continued from their wrong systems. This is method approval, not blanket approval of every excavator artifact or automatic approval of future target outputs.

## Exact subject

Library artifact:

- filename: `zx85usb-5a-functional-whole-checkpoint-20261113-r01.zip`
- size: 217,885 bytes
- SHA-256: `b7eae72e30e6b761e41dd1f9467d7ebc5b07cc713565e58e43e9bac87103a2e5`
- created: 2026-11-13 19:23 Asia/Shanghai

The checkpoint's own README says:

- `UNPUBLISHED research source, not a finished machine`;
- accepted front v201 is external and unchanged;
- tracks remain static; high blade lift collides with the old front base;
- original pipe crossings, inner engine/cab/forces/OEM mounting details remain unresolved;
- software frames are llvmpipe, not browser/hardware acceptance;
- exact front v201, Three/registry dependencies, original scene reference bytes and full source arrays are not included.

## Independent audit

- archive entries: 82;
- manifest entries: 80;
- manifest bytes and SHA-256: **80/80 match**;
- JavaScript module files scanned: 39;
- missing relative dependencies: **15**;
- self-contained track-path + closed-chain replay: **6/6 PASS**;
- representative whole underbody test: **FAIL**, `ERR_MODULE_NOT_FOUND` for the omitted exact Three.js dependency.

Missing examples include the exact front v201 Three module, assembly/registry/geometry modules, retained-pin module, mechanical thread-mount parent, JSDOM package location and omitted scene/motion JSON.

Decision on the exact artifact:

`HOLD_ASSET_CHECKPOINT_NOT_PORTABLE_METHOD_BASELINE`

This does not reject the user's method approval and does not invalidate the checkpoint as recoverable evidence. It only blocks treating the zip itself as a complete cross-project core asset or copying excavator constants/geometry into unrelated products.

## Current Best View comparison

Canonical `MOTHER-NO-METHOD-INVENTION-001` already forbids Production Mothers from replacing the coordinator-approved method with simplification, remeshing, generic substitutes or their own pipeline. Therefore no new near-duplicate regression is created.

The uncovered gap is the opposite direction: after a method is approved, current KAOPU has no minimal transfer contract that distinguishes:

- portable invariants of the method;
- object-specific geometry/constants/assets that must not be copied;
- exact dependency bill of materials;
- allowed target variation points;
- target-specific references and acceptance gates;
- evidence required before a target output may claim the method was implemented.

## One external teacher audition

Teacher: Carnegie Mellon Software Engineering Institute software product-line production planning.

Status: `TEACHER_CANDIDATE / AUDITION`.

Exact added knowledge: SEI distinguishes a core asset from the production plan/attached process that explains how to use, tailor and evolve it. The plan names inputs/dependencies, common vs variable features, product-specific details, tools, bill of materials and metrics. A core artifact without that plan is not enough to reliably build a family of products.

Primary sources:

- https://www.sei.cmu.edu/library/guidelines-for-developing-a-product-line-production-plan/
- https://www.sei.cmu.edu/library/variability-in-software-product-lines/
- https://resources.sei.cmu.edu/asset_files/WhitePaper/2012_019_001_495381.pdf

Screening:

1. provenance: official CMU/SEI publications;
2. maintenance: canonical report is older but remains hosted by SEI; later SEI product-line course/materials still use the core-asset + production-plan model; no active code repository or issue tracker;
3. reproducibility: no executable reference implementation; this audition converts the method into a machine-checkable checkpoint audit;
4. license/rights: no code/data/asset imported; concepts are paraphrased; publication reuse rights were not needed for this local method trial;
5. direct relevance: high for transferring one approved construction method across multiple KAOPU product families;
6. novelty: explicit attached process, variation points and dependency/BOM discipline are missing from the current method freeze;
7. risk/cost: low tooling cost, but high semantic risk if dissimilar products are forced into excavator-specific structure;
8. failure boundary: methodology publication, not proof that any KAOPU target will improve or that the current checkpoint is portable.

## Falsifiable Candidate

Refine existing `MOTHER-NO-METHOD-INVENTION-001` with a local `METHOD_ANCHOR`:

```json
{
  "approvedMethodExemplar": {
    "artifactId": "zx85usb-5a-functional-whole-checkpoint-20261113-r01.zip",
    "sha256": "b7eae72e30e6b761e41dd1f9467d7ebc5b07cc713565e58e43e9bac87103a2e5",
    "status": "EVIDENCE_EXEMPLAR_NOT_PORTABLE_BASELINE"
  },
  "portableInvariants": [],
  "targetVariationPoints": [],
  "dependencyBOM": [],
  "excludedObjectSpecificData": [],
  "targetReferenceSet": [],
  "targetAcceptanceGates": [],
  "methodReplay": {}
}
```

The Candidate passes only if:

1. every dependency used by the method trial is present or immutably resolved;
2. portable invariants are separated from excavator geometry, units, identities, frames and decals;
3. each target has its own reference set and variation decisions;
4. a minimal target trial proves the method on that target;
5. method implementation does not auto-create visual, production or user acceptance.

## Minimum target trial

Choose one target Mother, not all four at once. Its Task Anchor must bind:

- `methodAnchorId`;
- exact old accepted/rejected baseline;
- one smallest wrong subsystem to rebuild;
- target-specific reference and dimensions;
- portable invariant used;
- object-specific data explicitly excluded;
- dependency BOM/digests;
- before/after gate and rollback point.

The first target trial should be selected by the coordinator from the actual queued artifacts. This learning run does not choose or implement a production target.

## Decision and lifecycle

- exact checkpoint as portable baseline: `HOLD`;
- SEI: `TEACHER_CANDIDATE / AUDITION`;
- existing regression refinement: Candidate `IMPLEMENTED=true`;
- audit: `GATE-RUN=true`;
- `POSTED=true` at [#91 issuecomment-6851876886](https://github.com/haihao0307/guilin-dem-pipeline/issues/91#issuecomment-6851876886);
- `ACKNOWLEDGED=false`;
- `ADOPTED=false`;
- `USER-ACCEPTED=false`;
- KPI effect: `UNKNOWN`.

No main, R2, production Mother, Site, public route, vehicle/train/door-lock/air-conditioner asset or global gate was modified.
