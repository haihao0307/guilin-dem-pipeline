# N216 — Stylized reference curvature fidelity without engineering-truth promotion

## Bounded question

Can sparse silhouette anchors prove that Mechanical Mother learned a stylized mechanical reference continuous surface one-to-one, while keeping the reference's engineering truth separate?

## Current real production pressure

The user supplied two artistic mechanical/vehicle reference variants and clarified four constraints:

1. the better exploded version may be used to recognize and relate parts;
2. third-party meshes and textures must not be reused;
3. KAOPU must independently reconstruct the form and apply its own metal material;
4. visible form should be learned one-to-one, especially continuous curved surfaces, even though the artistic source may not be engineering-accurate.

This creates two independent claims that the current gate text states conceptually but does not yet test together:

- `VISIBLE_REFERENCE_FIDELITY`: whether the reconstruction preserves the source's observed shape;
- `ENGINEERING_TRUTH`: whether that source shape is dimensionally or mechanically authoritative.

A visible reference match can pass while engineering truth remains `UNKNOWN`. Conversely, replacing an unusual artistic curve with a generic realistic curve is still an unauthorized creative substitute.

## Existing-system comparison

R2 and the reference-replication gate already prohibit simplification, generic substitutes, hidden-region invention and third-party asset copying. N212 covers occluded learned priors; N214 covers standard identity versus unverified dimensional tables. Neither case tests the Mechanical-specific failure where endpoints and one midpoint match but the continuous curve has been changed, nor the risk of mixing preferred regions from two artistic variants without per-part source mapping.

External teacher status: `NO_NOVELTY`. The current KAOPU reference gate already supplies the governing principle; the new value is an executable curvature/claim-separation regression.

## Falsifiable hypothesis and replay

Hypothesis: if the verifier checks only endpoints, a midpoint and part labels, a producer-created curve substitute can pass. Adding dense profile deviation and curvature-signature checks will reject it while an independent faithful formula passes.

Synthetic replay uses two cubic profiles:

- reference: `[[0,0],[0.25,0.8],[0.75,0.8],[1,0]]`;
- substitute: `[[0,0],[0.05,1.2],[0.95,0.4],[1,0]]`.

They share both endpoints and the exact midpoint, so the sparse anchor gate false-passes. The complete sampled profile and curvature signature differ, so the continuous-fidelity gate rejects the substitute. A separately declared procedural reconstruction with the frozen reference measurements passes.

Result: 8/8 synthetic contract checks passed.

This proves a gate gap, not that the current E50 asset has this defect.

## Candidate translation

New Candidate regression: `STYLIZED-REFERENCE-VISIBLE-SHAPE-NOT-ENGINEERING-TRUTH-001`.

Task Anchor additions include exact reference digests, primary variant, per-part variant mapping, visible coverage, section planes, curve anchors, curvature signature, engineering-authority state, hidden-region policy and KAOPU material route.

Delivery Receipt separates profile/curvature fidelity, variant-mix audit, hidden-region status, engineering claim and material routing.

Minimum production trial:

1. bind one visible E50 continuous surface patch to one exact reference variant and digest;
2. independently reconstruct it without source mesh/texture reuse;
3. freeze at least three section curves plus part-relation anchors;
4. inject the same-anchor/different-curvature substitute and an unmapped two-variant mix as negative controls;
5. keep hidden geometry and engineering authenticity `UNKNOWN` unless separately evidenced;
6. route material only through the approved KAOPU Material Mother;
7. have an independent verifier rerun numeric and fixed-view comparison before user review.

## Decision and status boundary

Decision: `SEPARATE_VISIBLE_REFERENCE_FIDELITY_FROM_ENGINEERING_TRUTH_AND_GATE_CURVATURE`.

- `POSTED=false`
- synthetic contract `GATE-RUN=true`
- `ACKNOWLEDGED=false`
- `IMPLEMENTED=false`
- Mechanical production `GATE-RUN=false`
- `ADOPTED=false`
- `USER-ACCEPTED=false`

No production Mother, `main`, R2 OS or global gate was modified. KPI values remain `unknown`.
