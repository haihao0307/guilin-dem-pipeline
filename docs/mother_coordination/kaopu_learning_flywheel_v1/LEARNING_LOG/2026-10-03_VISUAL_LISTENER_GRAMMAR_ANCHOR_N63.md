# N63 — Visual Listener: correspondence is not anatomy; promote observations through Grammar Anchors

Status: cross-Mother Visual Listener Candidate only. No production Mother, `main`, `gh-pages`, R2 baseline, schedule, Canonical Truth or user-frozen asset is changed.

## Bounded question

When DINOv3 dense features, SAM2 masks, DensePose/CSE correspondences or other visual-listener outputs identify a stable-looking region, what minimum evidence is required before that observation can become a KAOPU Grammar Anchor rather than remain a correspondence Candidate?

## Existing real failure / risk

KAOPU already has user-visible failures where independent views did not preserve persistent part identity, including appendage-count/occlusion problems, and it already distinguishes Observation, Claim, Uncertainty and transfer state in the Palau R19 truth work. The missing executable boundary is specifically visual: a strong dense-feature match or tracked mask can look stable enough to be mistaken for anatomical identity.

This is dangerous because better perception can increase confidence faster than evidence quality unless promotion is typed.

## External method / evidence

1. Meta DINOv3 reports that long SSL training can degrade patch-level consistency even while global task performance improves. Gram anchoring regularizes feature correlations and restores dense-feature quality. It is a representation-stability method; it is not an anatomical identity oracle.
   - https://arxiv.org/abs/2508.10104
   - https://ai.meta.com/research/publications/dinov3/
2. Meta Continuous Surface Embeddings maps image pixels to mesh-vertex embeddings and explicitly extends dense correspondences from humans to animal classes. This supports cross-instance/category correspondence, but correspondence remains a claim about mapping, not independent proof of anatomy.
   - https://ai.meta.com/research/publications/continuous-surface-embeddings/
3. Meta SAM2 tracks prompted objects or parts through video with memory and supports occlusion handling. Mask continuity is useful temporal evidence but is not sufficient to prove semantic/anatomical part identity.
   - https://ai.meta.com/research/sam2/
4. Meta open-vocabulary part segmentation uses dense semantic correspondence to parse novel objects into parts, reinforcing that dense correspondence is useful for part hypotheses while still requiring an explicit part model/label layer.
   - https://ai.meta.com/research/publications/going-denser-with-open-vocabulary-part-segmentation/

## Comparison with current KAOPU rules

R2 already says UNKNOWN is preferable to invented completion, reference replication must preserve uncertainty, and Producer cannot self-promote. Palau R19 already separates Observation / Claim / Provenance / Uncertainty and blocks Candidate transfer edges.

New element: a Visual Listener-specific promotion gate that prevents a perception output from silently changing semantic type:

`dense similarity / mask / correspondence -> Observation Candidate -> part identity + boundary + stability + independent structural support -> Grammar Anchor Candidate`

The Meta term “Gram anchoring” and KAOPU “Grammar Anchors” are intentionally kept distinct. KAOPU Grammar Anchors are a knowledge-identity/provenance construct inspired by the general stability lesson, not an implementation claim about DINOv3 training loss.

## Falsifiable hypothesis

A gate that requires explicit object identity, uncertainty, part identity/boundary, cross-view or temporal stability, independent anatomical/geometric support, at least two evidence roots, relation invariants and no unresolved conflict will prevent visual similarity from being promoted into anatomy while still allowing strongly supported observations to become Grammar Anchor Candidates.

The hypothesis is falsified if:
- DINO/SAM/CSE-only evidence is promoted to a Grammar Anchor;
- OCCLUDED/UNKNOWN is converted to absence;
- conflicting left/right or part assignments are promoted;
- a well-supported multi-root anatomy+dense observation is permanently blocked.

## Minimal replay

Executable probe and fixtures:
- `PROBES/visual_listener_anchor_gate_n63.mjs`
- `REGRESSION_CASES/CANDIDATE_VISUAL_LISTENER_CORRESPONDENCE_NOT_ANATOMY_001.json`
- `PROBES/visual_listener_anchor_gate_result_n63.json`

Replay result: **8/8 passed**.

Cases cover DINO-only similarity, SAM2-only temporal tracking, animal CSE correspondence, occluded appendage, conflicting left/right identity, anatomy+dense multi-view support, single-root support and missing uncertainty.

## Executable observation object

Minimum fields for the Visual Listener observation ledger:

```
objectIdentity
observationId
sourceRef
viewOrFrame
regionOrPartCandidate
boundary
visualCorrespondenceMethod
crossViewStable
temporalStable
anatomicalOrGeometricSupport
independentEvidenceRoots
relationInvariants
uncertaintyState
conflicts
promotionState
```

Promotion states:
- `OBSERVATION_CORRESPONDENCE_CANDIDATE`
- `OBSERVATION_UNCERTAIN_NOT_ANCHOR`
- `HOLD_OBSERVATION_CONFLICT`
- `OBSERVATION_INDEPENDENCE_INSUFFICIENT`
- `GRAMMAR_ANCHOR_CANDIDATE`

## Applicability boundary

This Candidate governs observation-to-knowledge promotion only. It does not certify 3D geometry, anatomy, motion, material, physical correctness or user acceptance. DINOv3, SAM2, DensePose/CSE and part segmentation remain observation tools.

No external AI is claimed as an independent participant.

## Decision

Retain as a Visual Listener Candidate. Do not globally adopt yet. First use should be one bounded observation task (e.g. a bird wing joint, fish main-axis/fin identity, or animal appendage across views) with independent verifier evidence. If it adds no protection beyond existing local regression, record no-novelty rather than duplicating anchors.
