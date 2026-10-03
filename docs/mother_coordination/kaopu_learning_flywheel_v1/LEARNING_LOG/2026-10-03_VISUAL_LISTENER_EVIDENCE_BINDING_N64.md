# N64 — Visual Listener: independent roots must bind the same subject and claim

Status: Candidate update to N63 after one real-object replay. No production Mother, `main`, `gh-pages`, R2 baseline, schedule, Canonical Truth or user-frozen asset is changed.

## Bounded question

Can the current Yellowfin Tuna R011 `SideFin.L_012` / `SideFin.R_022` observations be promoted to a Grammar Anchor Candidate merely by combining exact source-topology evidence with an independent yellowfin anatomy reference?

## Existing real failure / evidence

The current R011 evidence is strong about exact artifact identity and engineering boundaries:

- `PECTORAL_QA.json` records 219 triangles per side, 134/136 vertex indices, 11 attachment edges per side, unchanged source binary, zero interface and alias gap, and no mirrored fin creation.
- `pectoral-evidence.json` preserves the author-group labels and explicitly calls both surfaces candidates rather than new biological approval.
- `SOURCE_IDENTITY_PROOF.json` binds the source SHA while explicitly setting `semanticApproval=false`, `biologicalTruth=false`, and `productionReady=false`.

The same evidence also declares `physicalLengthKnown=false`, `anatomicalPartitionApproved=false`, `stageAComplete=false`, `independentGenerator=false`, and `productionReady=false`.

Therefore the exact mesh partition is observed, but its biological meaning is not independently approved.

## External method / evidence

1. The FAO species catalogue describes yellowfin tuna pectoral fins as moderately long, usually extending beyond the second dorsal-fin origin, and gives a 22–31% fork-length range. This is a species-level anatomical constraint, not a mapping to this exact model's triangles.
   - https://www.fao.org/4/ac478e/ac478e02.pdf
2. NOAA's 1986 scientific report on a yellowfin tuna lacking one pectoral fin confirms that a pectoral fin is a real functional/anatomical structure in the species. It likewise does not identify `SideFin.L_012` or `SideFin.R_022` in the current asset.
   - https://spo.nmfs.noaa.gov/content/morphology-and-possible-swimming-mode-yellowfin-tuna-thunnus-albacares-lacking-one-pectoral

## Comparison with current KAOPU rules

N63 correctly requires at least two independent evidence roots, but it counts root names. That permits a false promotion if one root proves the exact artifact boundary while another proves only a generic species fact.

New failure mechanism:

`independent source count != independent support for the same exact claim`

The missing executable constraint is claim binding. Each qualifying root must identify:

```
rootId
subjectId
claimIds
directSupport
```

For promotion, at least two distinct roots must directly support every required claim on the same exact subject. A taxon-level reference may support `yellowfin-has-pectoral-fins`; it cannot support `these exact source triangles are the biological pectoral pair` unless an explicit subject-mapping observation is registered and verified.

## Falsifiable hypothesis

Adding subject-and-claim binding to the N63 root-count gate will block nominally independent but non-coextensive evidence without blocking a synthetic case where two roots directly support the same exact subject and claim.

The hypothesis is falsified if:

- the R011 source-topology + FAO anatomy combination is promoted;
- two directly bound roots for the same synthetic subject and claim are rejected;
- single-root evidence is misclassified as a binding problem instead of independence insufficiency.

## Minimal real-object replay

Updated existing Candidate regression rather than creating a duplicate case:

- `REGRESSION_CASES/CANDIDATE_VISUAL_LISTENER_CORRESPONDENCE_NOT_ANATOMY_001.json`
- `PROBES/visual_listener_anchor_gate_n63.mjs`
- `PROBES/visual_listener_anchor_gate_result_n64.json`

Expected R011 decision:

`OBSERVATION_EVIDENCE_NOT_BOUND_TO_SUBJECT`

This is not a rejection of the source regions. They remain valid exact-source observations. It only blocks promotion to biological/anatomical Grammar Anchor until the exact mesh partition is independently mapped and verified.

## Applicability boundary

Apply the binding requirement when an observation is promoted across semantic levels, especially source geometry -> biological identity, visual correspondence -> anatomy, or generic reference -> exact asset part. It is unnecessary for claims whose evidence roots already share an explicit exact subject and claim identifier.

This Candidate does not certify anatomy, motion, material, physical correctness, or user acceptance. It does not alter production artifacts or lower gates.

## Decision

Retain as an N63 Candidate refinement after a single real-object replay. Lifecycle: `IMPLEMENTED_CANDIDATE`, `GATE-RUN` only after the updated replay passes; not `ACKNOWLEDGED`, `ADOPTED`, or `USER-ACCEPTED` without real downstream receipt.
