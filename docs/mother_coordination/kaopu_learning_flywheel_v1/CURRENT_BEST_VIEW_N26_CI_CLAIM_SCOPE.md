# CURRENT BEST VIEW N26 — CI claim scope

Status: **Candidate partial / historical replay verified / not adopted**

An overall workflow or job conclusion is execution/transport metadata, not proof that every downstream delivery claim succeeded. Promotion must bind one named claim to:

1. `claimType` and `claimScope`;
2. a versioned `requiredStepManifest`;
3. actual `stepResults`, preserving `skipped`, `missing`, `failed`, and `cancelled`;
4. claim-specific `proofPredicates`;
5. a derived `claimState`.

If any claim-critical step is not `success`, or any proof predicate mismatches, the state is `HOLD_CLAIM_INCOMPLETE` even when the workflow is green. A skipped step is not universally fatal: it blocks only claims that declared it critical.

For historical run 35936763006 this rule verifies `VERIFIED_SETUP` and holds `PUBLICATION_COMPLETE`. It does not alter the honest workflow report, publish Stone Money, solve source transfer, or imply global adoption.

## Frozen / Unknown

- R2 OS and all production Mother branches remain unchanged.
- Existing `shareAllowed`, deployment, browser, device, visual, and user-acceptance gates remain separate.
- Effect on first-pass acceptance, user correction count, stale delivery rate, internal iteration count, and time-to-valid-candidate is **Unknown** until one real Mother trial.
