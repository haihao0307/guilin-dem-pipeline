# N72 — Fish R11: collection-wide claim requires a receipt for every member

Status: Candidate executable refinement after one real-object replay. No production Mother branch, `main`, `gh-pages`, R2 baseline, schedule, Canonical Truth or user-frozen asset is changed.

## Bounded question

Can Fish R11 claim that **all six fish** use reference-fitted function surfaces when its own machine-readable manifest proves the new route for five members but marks Barracuda only as `FCP11_LEGACY_GZIP`?

## Existing real failure

At current `gh-pages` head `f0bb39c8b73a67d2c3d537c3d3583ea8455232c2`, Fish page blob `b06c9edf7bc44e44e4fb0e5f2a28e84addfe3530` remains the exact subject introduced by commit `ad5c30d074332bbd07d10b111024c26dff863771` (`feat(fish): generate all fish rest surfaces from reference-fitted functions`). The page declares:

- `data-version=FISH_SCOREMAKER_FUNCTION_R11`;
- `taskId=FISH_FUNCTION_SURFACE_R11_20261004`;
- `sourceEncoding=FITTED_SURFACE_PROGRAM_R11`;
- six selectable fish and six asset receipts.

However, `manifest.items` contains only five members, each with `positionsFunctionGenerated=true`, `rawPositionsStored=false`, and a bound R10 source SHA. Barracuda is absent from `items` and appears only in `assets` as:

`assets/barracuda.bb8b8a8c88195be5.bin`, SHA-256 `bb8b8a8c88195be5f7acea7110eaaed1967a1ee8b1083aee385d01c3a945cbe5`, format `FCP11_LEGACY_GZIP`.

The parent R10 also delivered Barracuda as a legacy member (`FCP10_LEGACY_GZIP`). R11's Barracuda digest is new, so this audit does **not** claim byte reuse or a stale artifact. The proved defect is narrower: the collection-level `ALL` claim silently inherits success from five member receipts while the sixth member uses an explicitly different legacy route and has no `positionsFunctionGenerated` receipt.

## External method / evidence

- in-toto Statement v1 defines `subject` as a set of artifacts, with each element representing one software artifact and each carrying a digest. Names may distinguish artifacts inside the set and consumers may use them when evaluating policy: <https://in-toto.io/Statement/v1>.
- GitHub's official attestation guidance recommends signing released binaries/packages or a manifest containing hashes of detailed contents, and states that attestations must be verified; consumers still need policy criteria that evaluate the content: <https://docs.github.com/en/actions/concepts/security/artifact-attestations>.

Transferred mechanism: a collection claim is not proved by a page-level version string. Freeze the declared member set, bind one receipt to every member, and evaluate the claim quantifier over those receipts. This is a local KAOPU policy inference, not a claim that SLSA or in-toto defines surface-generation semantics.

## Comparison with current KAOPU rules

The R2 Freshness gate already prohibits silent fallback, old/wrong-target substitution, and version-only progress. N26/N54 already prohibit a narrow proof from promoting a stronger claim. Those principles are `no-novelty`.

The executable gap is collection quantification: existing receipts can be complete for five members while an `ALL` label promotes a sixth member by inheritance. N36 expected-inventory coverage addresses package/handoff roles, not per-member production-mode claims. Therefore N72 adds one scoped Candidate regression rather than modifying R2 or broadening N36.

## Falsifiable hypothesis

If an `ALL` collection claim is evaluated against a frozen `declaredMemberIds[]` plus exact `memberReceipts[]`, the current R11 subject will return `HOLD_COLLECTION_SILENT_FALLBACK`; a six-of-six control will pass; an explicitly narrowed five-member claim with a visibly disclosed Barracuda fallback will remain deliverable only as `COLLECTION_MIXED_MODE_DISCLOSED_NOT_UNIVERSAL`; an `ALL` claim with a disclosed exception will return `HOLD_COLLECTION_CLAIM_NOT_UNIVERSAL`; and a missing member receipt will fail closed.

The hypothesis is falsified if any of those five decisions differs.

## Minimal replay

Executable objects:

- `REGRESSION_CASES/CANDIDATE_COLLECTION_UNIVERSAL_CLAIM_MEMBER_COVERAGE_001.json`
- `PROBES/collection_universal_claim_gate_n72.mjs`
- `PROBES/collection_universal_claim_gate_result_n72.json`

Result: `5/5 passed`.

Minimum Candidate fields:

```
collectionId
claimId
claimQuantifier: ALL | NAMED_SUBSET
declaredMemberIds[]
claimedMemberIds[]  # required for NAMED_SUBSET
memberReceipts[].{memberId, artifactSha256, productionMode, satisfiesClaim}
fallbackActive
fallbackMemberIds[]
fallbackDisclosure
userAcceptance
```

## Applicability boundary

Apply only when one delivery makes a semantic claim over multiple named members, variants, matrix cells, assets or outputs. Do not require it for a single-artifact claim already covered by an exact artifact tuple. A disclosed mixed-mode collection is allowed, but it cannot retain an `ALL members use the new route` claim.

This audit does not judge the Barracuda's visual quality, freshness of its bytes, anatomy, runtime, motion, source license, or user acceptance. It does not require removal of a service-preserving fallback. It requires accurate member status and claim scope.

## Decision and routing

Retain as a Fish-local Candidate and route through #91. The affected Mother may satisfy it by either producing and receipt-binding the sixth fitted-function member, or narrowing the claim to the five proved members while setting `FALLBACK_ACTIVE=true` and visibly naming Barracuda as legacy. Do not rerun unrelated fish work.

Lifecycle after a real issue receipt: `POSTED=true`, `GATE-RUN=true`; `ACKNOWLEDGED`, `IMPLEMENTED`, `ADOPTED`, and `USER-ACCEPTED` remain false until downstream evidence exists. KPI deltas remain `unknown`.

No external AI was claimed or invoked as a participant.
