# Original Fish R02 — first N1 reef-fish evidence profile

Date: 2026-09-20

This increment adds the first science-backed species profile for the Original Fish ruler: Amphiprion ocellaris.

Actually established:
- 1 dph measured standard length, head length and eye diameter from Roux et al. 2019.
- Study-local SL growth-rate regimes for 1-7 dph and 8-21 dph.
- Source-reported eye-diameter and snout-length regressions against SL.
- Seven overlapping developmental-stage ranges with fin, notochord and stripe state.
- Pectoral/pelvic/anal fin timing and head/jaw development windows.
- Laboratory behavior evidence: water-column position/light response and prey-capture milestones.
- Separate TL + mouth-gape measurements at 1 and 14 dph from Jackson & Lenz 2016.
- Adult morphology/size bound from FishBase kept separate from larval age-length evidence.

Important non-completion:
- No justified continuous 1 dph -> adult age-length curve yet.
- A 2021 source reports ~3.0 cm SL at ~30 dph; this is explicitly quarantined rather than blended with Roux 2019.
- No side/top contour has been invented.
- No exact eye coordinate, skeleton geometry, natural adult swim law, or PBR has been invented.
- This is evidence/data code, not visual acceptance and not a public fish workbench.

QA:
- Node evidence regression test: 22 assertions passed locally before commit.
- The test intentionally verifies that unsafe full-lifecycle interpolation remains blocked.

Primary sources:
- Roux N, Salis P, Lambert A, et al. Developmental Dynamics 248 (2019), DOI 10.1002/dvdy.46.
- Jackson JM, Lenz PH. Scientific Reports 6, 33585 (2016), DOI 10.1038/srep33585.
- Mitchell LJ et al. PLOS ONE 16(12) (2021), DOI 10.1371/journal.pone.0261331 (conflict quarantine only).
- FishBase species 6509 for adult bound only.
