# N264 — Weather R42 successor delta and lineage

## One bounded question

Can the R38→R42 version sequence, and especially `main@49f5aa9028773ee142b32fdcba0ee8a78818b511`, be counted as an accepted successor merely because each commit adds a new numbered directory with many files?

## Exact observations

- Five consecutive Weather commits R38–R42 add 18, 20, 20, 21 and 20 paths: 99 added path instances.
- Direct R41→R42 blob comparison is the valid delta boundary. Of 20 corresponding paths, 14 are byte-identical and 6 differ: `README.txt`, `index.html`, and `pages/own1.html` through `pages/own4.html`.
- Therefore R42 is not a pure renamed copy: it has a real source delta. It must not be classified as `REJECTED_STALE_OR_WRONG_TARGET_DELIVERY` from file reuse alone.
- The 20 added paths are not 20 units of progress. Only the six changed corresponding paths are countable source-delta paths; visual or performance value remains unverified.
- R42 labels itself a research candidate and preserves limitations. This is honest candidate status.
- No R42 Task Anchor, Delivery Receipt, regression binding, `CHECK_R42.json`, exact-head workflow run, parent subject digest, parent verifier verdict or parent accepted scope was found.
- R42 names R41 as the prior preview, but version naming and availability do not establish parent eligibility.

## Decision

- Candidate preservation: `PASS_HONEST_CANDIDATE_LABEL`.
- Freshness: `PASS_FRESH_SOURCE_DELTA`.
- Promotion: `HOLD_LINEAGE_PROMOTION_PARENT_IDENTITY_AND_ELIGIBILITY_UNBOUND`.
- Two-failed-cycle/root-cause threshold: `UNKNOWN_ATTEMPT_LEDGER_ABSENT`; the available records do not permit fabricating a failure count.

## Novelty and routing

Institutional mechanism: `NO_NOVELTY`.

- The freshness gate already says copied files, new directories and version numbers are not production progress by themselves.
- N217 already proves parent identity is distinct from scoped parent eligibility.
- N264 only contributes a new Weather exact-subject replay and a blob-level way to count the real successor delta. No synonymous regression is created and R2 is not changed.

Minimum Weather Mother response:

1. bind one exact parent and exact R42 head in a Task Anchor;
2. state the one primary defect/hypothesis and the six real delta paths;
3. provide a Delivery Receipt with an exact-head gate run and limitations;
4. record the parent verifier verdict and accepted scope;
5. if two attempts for the same defect failed, enter `ROOT_CAUSE_REVIEW`; otherwise keep the attempt count `UNKNOWN`.

No production Weather files, main, public page, R2 gate or acceptance threshold were changed.
