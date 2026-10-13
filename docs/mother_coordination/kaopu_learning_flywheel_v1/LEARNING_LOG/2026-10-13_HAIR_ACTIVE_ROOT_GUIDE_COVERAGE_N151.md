# N151 — Hair active-root to guide coverage identity

## Bounded question

Do F03's 192 distinct guide roots plus 3067 independently checked emergence probes prove that every active root is represented by an auditable guide/follower mapping?

Decision: **no**. Current legal state for the stronger full-root/follower claim is `HOLD_ACTIVE_ROOT_TO_GUIDE_COVERAGE_UNBOUND`.

## Existing real failure / current production evidence

- The user explicitly accepted F02.1's default range and ear-front trim. F03 correctly freezes it as `F02.1@ee3c7fac9f187dd9e5dc81d1363c4814b9a015a3`; this acceptance is not reopened.
- PR #266 exact handoff `6b00c22d64f495bd515d031a80c61cd9f38ef81a` retains 3067 active diagnostic roots and adds 192 sparse guides.
- `selectGuides()` gives each of six coordinate regions one first available seed, then performs farthest-point sampling with raw three-dimensional Euclidean distance.
- The production tests prove 192 distinct guide roots, 3067 probe contacts, guide centerline contact, frozen roots, region angles and deterministic build identity.
- They do not persist an active-root-to-guide map, unassigned-root count, per-region carrier-surface coverage radius, interpolation policy, or a coverage positive control.

This is a validation gap, not a newly observed visible hair failure. F03 explicitly says it has no dense followers and that the 192-guide display is not final hair count. The sparse-guide structural candidate remains valid within that disclosed scope.

## External method / teacher decision

No new teacher entered audition. Sparse guides driving denser followers is already part of the absorbed Hair method; repeating that principle is `NO_NOVELTY`. The new information is the executable gap in the current F03 receipt: guide distinctness and per-root probes do not establish guide coverage of the active root field.

## Comparison with current KAOPU controls

- N143 binds root-field density, flow, seed and authorized-part identity.
- N150 adds semantic scalp/sideburn/pinna carrier identity.
- F03 binds sparse guide identity and per-root emergence contact.
- None binds the relation between the 3067-root field and the 192-guide field.

N151 therefore extends `CANDIDATE-HAIR-SCALP-ROOT-FIELD-IDENTITY-001` instead of creating a duplicate regression.

Candidate receipt delta:

- exact active-root and guide-root digests plus deterministic selection configuration;
- persisted active-root-to-guide mapping digest and interpolation-policy identity;
- per-region active roots, guides, unassigned roots, maximum and P95 carrier distance;
- a bound per-region maximum distance threshold;
- a thin-region guide-removal positive control;
- a cross-surface alias positive control proving that 3-D-near but carrier-surface-far roots are not assigned through the wrong fold or adjacent anatomy.

## Falsifiable hypothesis

If every active root is assigned through carrier-surface geodesic distance or an adjacency-constrained equivalent, with zero unassigned roots, bounded per-region maximum distance and both positive controls detected, then removing sparse sideburn/nape coverage or introducing a world-space cross-fold alias will be caught before dense followers inherit it.

The hypothesis is falsified if the receipt passes while a thin region has no valid guide, a root is unassigned, or a 3-D-near guide across an invalid surface fold is selected.

## Minimal historical replay

The N151 classifier replays seven cases:

1. exact F03 evidence with distinct guides but no root-to-guide mapping receipt;
2. one guide seed in every region but a sideburn coverage-radius breach;
3. world-space Euclidean assignment aliasing across a folded carrier;
4. an apparently complete mapping with unassigned nape roots;
5. complete mapping without an interpolation-policy identity;
6. complete mapping without coverage positive controls;
7. all active roots assigned with bounded carrier distance and both controls detected.

Result: see `PROBES/hair_active_root_guide_coverage_result_n151.json`.

## Scope and adoption

- Candidate for Hair Foundation only; not a global gate.
- Does not block the current 192-guide visualization, frozen F02.1 range, per-root emergence probes, static contact result or F03 structural exploration.
- Blocks only a stronger claim that the sparse guide set covers every active root or is ready to generate dense followers without an explicit mapping receipt.
- Production thresholds are `unknown`; the replay's numeric values are synthetic classifier fixtures, not adopted millimetre standards.
- Does not modify PR #266, production branches, main, R2 or any gate threshold.
- Routed only to Hair PR #266: https://github.com/haihao0307/guilin-dem-pipeline/pull/266#issuecomment-6149529001
- Lifecycle after routing: `POSTED=true`; `CLASSIFICATION-GATE-RUN=true (7/7)`; `ACKNOWLEDGED / IMPLEMENTED / HAIR-PRODUCTION-GATE-RUN / ADOPTED / USER-ACCEPTED=false`.
- Effect KPIs: `unknown` until Hair Mother implements the mapping receipt and runs the production positive controls.
