# N45 — Score–instrument separation must be observed, not self-reported

Status: Candidate; one bounded architecture question. No production branch, main, R2 rule, current public page, or Canonical Truth was modified by this study.

## Bounded question

Does the current KB2 bird instrument actually compute object morphology from the score, or does it contain a hidden Grey Heron preset that the score merely selects?

## Existing real production change

Since N44, main advanced through twelve commits and now ends at exact head [a56fd42ba8d7b155cf68fe1808e1c7fa1cf27ec9](https://github.com/haihao0307/guilin-dem-pipeline/commit/a56fd42ba8d7b155cf68fe1808e1c7fa1cf27ec9), publishing 'kaopu-score-instrument/r03-20260929/'. The initial seven-part payload was corrected by splitting 'p2.js' into 'p2a.js' and 'p2b.js', changing the loader, and deleting the superseded fragment.

The exact current payload was reconstructed in loader order and decompressed. Its identities are frozen in 'PROBES/kb2_payload_manifest_n45.json':

- decoded HTML: 111,889 bytes, SHA-256 '4d06011997eedc73f5ea5e8003dea72054b395425b47027473b9fffe3f45e503';
- instrument core: 80,630 bytes, SHA-256 'c9912cb9ea70af2be7ede11d4077c7b08c5bc4d38645910c1b697fc116ec379a';
- complete score: 19,404 bytes, SHA-256 '21f9456a081863a134c1c196c93a91941e684bb1dbf2586d5fb085018c86d70c'.

The workbench displays 'speciesSwitchPresent=false' and 'finalVerticesStored=false', but both are values returned by the same instrument being evaluated. A Producer could add an identity branch and leave those booleans unchanged. Therefore the display is a declaration, not independent evidence.

## External method and evidence

NIST describes metamorphic testing as a way to test properties through relationships between transformed inputs and outputs when an ordinary oracle is unavailable or impractical: <https://csrc.nist.gov/pubs/journal/2016/06/metamorphic-testing-for-cybersecurity/final>.

The original Chen–Cheung–Yiu method derives follow-up cases from successful cases and checks required output relationships, including in the absence of a conventional oracle: <https://www.cse.ust.hk/faculty/scc/publ/CS98-01-metamorphictesting.pdf>.

Transferred KAOPU object: do not ask the instrument whether it contains a preset. Change only identity, then only morphology, and observe the generated arrays.

## Comparison with current KAOPU rules

R2 already separates Producer and Verifier. N42 already requires a claim's prerequisite gates. Those rules are retained.

The new executable increment is score–instrument specific:

- identity-only metadata changes must leave geometry unchanged;
- morphology parameters changed only in the score must change geometry;
- identical complete scores must replay to byte-equivalent arrays;
- unknown selector slots must reject rather than silently fall back;
- the exact instrument source must not contain known object-specific species literals.

This is not a visual-fidelity gate. Passing it cannot approve the Grey Heron appearance, anatomy, natural motion, 3A quality, production readiness, or user acceptance.

## Falsifiable hypothesis

If KB2 is truly a category instrument plus object-specific score, then the five relations above will hold. A hidden identity preset will violate identity invariance; an instrument that ignores score morphology will violate morphology sensitivity; a silent preset selector will fail unknown-slot rejection.

The hypothesis is falsified if the current exact subject violates any relation, or if a counterfactual hidden preset can keep the current self-report while escaping the new gate.

## Minimal historical replay

'PROBES/architecture_invariant_gate_n45.mjs' was run against the exact decoded current subject and three counterfactual instruments.

Result: 10/10 cases passed.

Current subject:

- deterministic repeat: true;
- identity-only geometry invariance: true;
- score-only bill/body morphology changes geometry: true;
- unknown root selector rejected: true;
- known Grey Heron/Ardea literals in the instrument core: none;
- final vertices stored in the score: none observed;
- baseline geometry SHA-256: 'cf13ebe174d47e55ffa515416d8baeafd1e4d0ca2e8e3b1bc513e05a5646a8ba';
- verdict: 'OBSERVED_SCORE_DRIVEN_INSTRUMENT'.

Counterfactual controls:

- hidden identity branch kept 'speciesSwitchPresent=false' but was caught as 'IDENTITY_BRANCH_DETECTED';
- ignored morphology was caught as 'SCORE_MORPHOLOGY_NOT_EFFECTIVE';
- swallowed unknown selector was caught as 'UNKNOWN_SLOT_NOT_REJECTED';
- embedded 'Grey Heron' literal was caught as 'SPECIES_LITERAL_IN_INSTRUMENT'.

This validates the current architecture claim at this exact head. It does not validate another head or prove that future species scores are anatomically correct.

## Applicability boundary

Apply to category instruments whose contract says object-specific knowledge lives in an imported score. For another category, define its own identity-invariant and score-sensitive relations. Do not require identity invariance where identity is explicitly an authorized numerical input to the generator; in that case the identity-to-parameter mapping itself must be frozen and independently tested.

## Decision and routing

Decision: preserve the current KB2 technical result as 'OBSERVED_SCORE_DRIVEN_INSTRUMENT'; add 'ARCHITECTURE-INVARIANTS-MUST-BE-OBSERVED-001' only as a Candidate for the next Bird instrument task. Do not globally change R2 or block the current page.

Required receipt fields for a targeted trial: 'subjectHeadSha', 'instrumentSha256', 'scoreSha256', 'metamorphicRelationResults', 'geometryDigest', 'architectureVerdict', 'visualAcceptance', and 'productionReady'.

Rollback point: coordination head 'd6fed62b7620cd312ea284cc705cd9ff18f9a296'.

Lifecycle after routing and replay: 'POSTED=true', 'GATE-RUN=true', 'ACKNOWLEDGED=false', 'IMPLEMENTED=false', 'ADOPTED=false', 'USER-ACCEPTED=false'. Institutional KPI effect remains unknown; no Mother integration or comparative production sample exists.

No external AI was invoked or claimed as a participant.
