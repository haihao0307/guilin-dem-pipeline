# KAOPU Learning Flywheel N328 — authority-owned hydraulic inventory

Date: 2026-11-21
Status: CANDIDATE
Scope: one bounded question only

## Bounded question

Can N326 reject a Producer that deletes one hose from both its declared required set and its observed payload, instead of truthfully reporting incomplete all-hose migration coverage?

## Real failure

Mother coordination N327 independently replayed N326 at head `4d94b9393110bfbeedca47d40ae710a3c3a24500`. Deleting `side_right` from both `requiredHoseIds` and `hoses` returned no hold. The original 12/12 fixture therefore did not prove contract completeness.

Root cause: the Producer receipt owned both the expected inventory and the observed inventory. It could shrink the task boundary together with its output.

## Candidate correction

The expected set is moved to a separate authority input:

`TaskAnchor.expectedHoseIds + authoritativeInventoryDigest + sourceHead`

The Producer receipt reports only observed hose IDs plus the inventory subject it claims to implement. The gate compares exact sets:

- expected minus observed -> `HOLD_HYDRAULIC_FUNCTION_ROUTE_COVERAGE_INCOMPLETE`;
- observed minus expected -> `HOLD_HYDRAULIC_UNANCHORED_HOSE_ID`;
- source head or inventory digest mismatch -> `HOLD_HYDRAULIC_INVENTORY_SUBJECT_MISMATCH`.

The 12 original fixtures remain. A thirteenth authority-inventory adversarial suite covers synchronized shrink, unanchored expansion and inventory-subject substitution.

Result: **13/13 fixture suites PASS**.

Production replay: `NOT_RUN`. The production authority inventory, source head, hose IDs, port IDs, tolerances and generator invocation remain `UNKNOWN`.

Decision: `CANDIDATE_AUTHORITY_OWNED_EXPECTED_INVENTORY_REJECTS_PRODUCER_SCOPE_SHRINK`.

Teacher status: `NO_NOVELTY`. R2 already separates Task Anchor authority from Producer Delivery Receipt; N328 turns that existing rule into an executable inventory gate for this failure.

## Targeted route

This correction belongs to the Learning Flywheel method side first. It does not authorize Hydraulic Mother implementation until an independent production inventory is frozen.

Lifecycle: `POSTED=true` — issue #91 comment `7049046393`; `ACKNOWLEDGED=false`; `IMPLEMENTED=candidate gate correction only`; `GATE-RUN=true (fixture only)`; `ADOPTED=false`; `USER-ACCEPTED=false`.

No main, R2 OS, production Mother branch, public Site or production asset is modified.
