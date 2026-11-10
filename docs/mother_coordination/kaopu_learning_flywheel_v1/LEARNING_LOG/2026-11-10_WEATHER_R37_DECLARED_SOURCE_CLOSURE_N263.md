# N263 — Weather R37 declared source closure

## One bounded question

Can `main@2facea64052d4c72c3a73ab7e0978cc180b54d7a` be treated as a reproducible research candidate from its committed README instructions and source/license pointers?

## Exact-source facts

- Subject: `weather-mother/wave-cloud-r37-20261110/` at the exact main commit above.
- The README says to run `python build.py` and says inherited-scene sources and licences are in `SOURCES.txt`.
- Neither `build.py` nor `SOURCES.txt` exists at that exact commit; both exact GitHub content lookups return 404.
- The committed legacy public-preview rule says the operative rule is `MOTHER_DELIVERY_FORMAT_RULE_2026-09-25.md`; that target is also absent in the R37 directory.
- The three new runtime scene files named by `index.html` are present. This preserves the narrower fact that committed HTML exists; it does not repair the missing declared build/provenance closure.
- Commit-bound workflow runs: zero.

## Decision

`HOLD_DECLARED_SOURCE_CLOSURE_INCOMPLETE`.

This is not a visual-quality verdict, not a creative-substitute verdict, and not proof that the missing files never existed elsewhere. It only rejects the exact-head reproducibility/provenance claim until the declared local entrypoints are committed or the README is corrected to an actually committed, independently runnable route.

## Novelty and routing

Failure mechanism: `NO_NOVELTY`. N43 already established that declared build/test/source paths absent from the exact subject must fail closed and that source closure alone is not browser, publication, visual, or user acceptance. N263 adds a new exact production subject to that existing Candidate; it does not create a synonymous regression case and does not change R2.

Weather Mother minimum falsifiable repair:

1. bind the exact current head in a Task Anchor and Delivery Receipt;
2. either commit `build.py`, `SOURCES.txt`, and the operative delivery rule, or replace each pointer with an existing exact path;
3. run the declared build from a clean checkout;
4. independently verify source/licence references and the produced file set;
5. keep browser/device/visual/user-acceptance verdicts separate.

Lifecycle: Candidate checker `IMPLEMENTED=true`, synthetic/exact-manifest `GATE-RUN=true`, targeted route `POSTED` only after the issue comment exists. `ACKNOWLEDGED / production IMPLEMENTED / production GATE-RUN / ADOPTED / USER-ACCEPTED=false`.
