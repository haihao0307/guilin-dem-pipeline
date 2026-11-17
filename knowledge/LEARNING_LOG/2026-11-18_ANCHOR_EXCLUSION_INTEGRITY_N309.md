# KAOPU Learning Flywheel N309 — Anchor Exclusion Integrity

## Decision

Hold the N308 dependency-closure Candidate. Its current probe is fail-open because `excludedInputIds` are outside `closureRootDigest` and `verify()` does not compare the exclusion set.

A runtime input that correctly produced `HOLD_UNDECLARED_DEPENDENCY` can be moved into `excludedInputIds` after observation. The component digest, closure root, and adapter descriptor remain unchanged, and the Candidate returns `DEPENDENCY_CLOSURE_VERIFIED`.

## Bounded method

The domain adapter and Task Anchor must preauthorize an exclusion policy. The common core records and hashes each exclusion's ID, role, reason, authorizing anchor, and policy digest. Any addition or policy change creates a new closure identity and requires independent verification. The core still does not decide semantic relevance.

## Fresh machine replay

- Original N308 control cases reproduced.
- Vulnerable mutation: baseline and bypass closure root were identical; bypass returned `DEPENDENCY_CLOSURE_VERIFIED`.
- Corrected prototype: unchanged preauthorized exclusion passed; after-run reclassification returned `HOLD_UNAUTHORIZED_EXCLUSION`; semantic dependency change returned `HOLD_EXCLUSION_OR_DEPENDENCY_SET_CHANGED`.

Probe SHA-256: `ed657bbcd86f19b219e902209bede236f26429775fdb177539ea4fe651b78f5f`.
Receipt SHA-256: `a6a550f9e72d3b97f9f49e3619aaff320962e7cbe554058da74eb6e561bdaa4a`.

## Boundary and lifecycle

This is an inactive Candidate regression and a coordination contract correction. No production Mother, main, R2 OS, adapter registry, visual artifact, or public workbench changed. No real Mother has acknowledged, implemented, adopted, or user-accepted the method.

Current state: `HOLD_GATE_FAIL`. Browser evidence is not applicable because this run changes no visual artifact.
