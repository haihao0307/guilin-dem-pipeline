# N53 — Phase transition must fail closed without an authorized Task Anchor

Status: revision of `TRANSFER-ONLY-ZERO-SEMANTIC-DELTA-001`; targeted Candidate checker only. No production branch, `main`, `gh-pages`, R2 baseline, existing production gate, schedule or other Mother was changed.

## Bounded question

After an unchanged transfer has been corrected, can Coral move the active surface into adaptation merely because the transfer-only checker sees a value other than `TRANSFER_ONLY`, or must the new phase carry an explicit authorization anchor and independent transition receipt?

## Existing real failure

N52 correctly detected semantic expansion during the original transfer-only phase. Its executable checker nevertheless had a fail-open branch:

`taskMode !== "TRANSFER_ONLY" -> NOT_APPLICABLE_ADAPTATION_PHASE`

That branch accepted missing, empty or misspelled modes exactly like an authorized adaptation. Later subject [`0ca20b2f555f7fbf1c9b0acbddbd93465f959948`](https://github.com/haihao0307/guilin-dem-pipeline/commit/0ca20b2f555f7fbf1c9b0acbddbd93465f959948) changed the active Coral workbench to R03 and added branching/blue-coral runtime files. The frozen source tree remained present, and later user instructions recorded in `CORAL_MASTER.md` may authorize the adaptation direction. However, the Coral tree contains no explicit phase Task Anchor or independent phase-transition receipt. The defect is therefore not “adaptation is forbidden”; it is that the checker could infer phase authorization from an absent field.

## External method and evidence

- NASA NPR 7123.1D Appendix G defines life-cycle review entrance and success criteria rather than treating an unlabelled state change as phase readiness: <https://nodis3.gsfc.nasa.gov/displayDir.cfm?t=NPR&c=7123&s=1D>.
- NASA Software Engineering Handbook entrance/exit guidance requires the applicable activities and products to be completed before proceeding to the next phase: <https://swehb.nasa.gov/spaces/SWEHBVD/pages/50892066/7.8%2B-%2BEntrance%2Band%2BExit%2BCriteria>.
- NASA SWE-019 treats the gate/KDP decision authority as the mechanism that determines readiness to progress to the next life-cycle phase and requires transition criteria in the life-cycle plan: <https://swehb.nasa.gov/spaces/SWEHBVD/pages/102695669/SWE-019%2B-%2BSoftware%2BLife%2BCycle>.

Transferred method: phase progression is an affirmative, evidenced decision. Unknown or invalid phase state must hold, not silently become “out of scope.”

## Comparison with current KAOPU rules

R2 already requires Task Anchors, receipts, producer/verifier separation and explicit status semantics. N52 already says adaptation requires a new authorized Task Anchor. The novelty is not another policy paragraph: it is a concrete counterexample showing that the N52 checker implemented the written boundary incorrectly. N53 repairs that one Candidate checker and keeps the existing case identity; no duplicate regression case is created.

## Falsifiable hypothesis

If the checker fails closed for missing/invalid `taskMode`, and `ADAPTATION_AUTHORIZED` requires `adaptationAuthorized=true`, a nonempty authorization source, immutable adaptation base, and an independent passing phase verifier, then:

1. current R03 without a machine-readable phase anchor is held while its valid preserved-source evidence remains;
2. missing authorization evidence and a misspelled mode are held;
3. a fully anchored adaptation control is still classified outside the transfer-only gate;
4. all original N52 fixtures continue to pass.

The hypothesis is falsified if any undeclared/invalid mode bypasses, if a complete authorized adaptation is blocked as transfer-only, or if the legacy replay regresses.

## Minimal historical replay

Gap fixture: `PROBES/transfer_phase_anchor_gap_fixture_n53.json`.

- Before patch: `1/4 passed`; missing mode, missing authorization anchor and typo mode all falsely bypassed.
- After patch: `4/4 passed`.
- Legacy plus current-subject replay: `11/11 passed`.
- Current R03: `HOLD_PHASE_CONTRACT / PHASE_TASK_MODE_UNDECLARED`; preserved evidence: `SOURCE_SNAPSHOT_TREE_VERIFIED`.
- Fully anchored adaptation control: `NOT_APPLICABLE_ADAPTATION_PHASE`.

## Applicability boundary

Apply only at a declared transfer-to-adaptation boundary. This Candidate does not decide whether R03 is visually correct, scientifically valid or user-accepted; does not revoke later user authorization recorded elsewhere; and does not require deletion of historical artifacts. It requires the affected Mother to bind that authorization to the exact adaptation base and current subject before the next phase can claim a valid gate transition.

## Decision and routing

Decision: retain the same Candidate and update its checker; targeted Coral trial only. Suggested adaptation-phase fields: `taskMode=ADAPTATION_AUTHORIZED`, `adaptationAuthorized=true`, `adaptationAuthorizationSource`, `adaptationBaseSha`, `subjectHeadSha`, independent verifier identity and verifier result.

Lifecycle before the new routing receipt: `IMPLEMENTED=true` for the Candidate checker revision and `GATE-RUN=true`; `ACKNOWLEDGED`, `ADOPTED` and `USER-ACCEPTED` remain false. Reliable KPI deltas are unknown. Evidence count: one same-class recurrence after the original correction; a recurrence rate is not computed because the denominator is unknown.

No external AI was claimed or invoked as a participant.
