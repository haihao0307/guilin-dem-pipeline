# KAOPU Learning Flywheel N230 — A6 host-preparation replay environment closure

## One bounded question

Can the latest self-contained A6 `post4376852` host-preparation archive replay its full named core suite from a fresh extraction without relying on an author-specific absolute workspace directory?

## Baseline

The current main copies of root `AGENTS.md`, R2 OS, the replication gate, and the freshness gate retain their previous blob SHAs. Issue #63 has no new production feedback. Issue #91 contains N229 but no acknowledgement or implementation receipt for its A6 result.

## Exact subject

- Library identity: `libfile_b5e6822105808191abb719df0f5a6596`
- file: `A6_POST4376852_NATIVE_FREEZE_HOST_PREPARATION_R01_20261101.zip`
- archive SHA-256: `a2b030fb3248049ef73688b2b96ffc786c64aa7bbe28089601458446f9c0ed5c`
- archive bytes: `169,988`
- archive entries: `67`

## Positive evidence preserved

The untouched archive manifest verifies **66/66** entries with zero mismatch. It includes the 16-file native snapshot and relative runtime imports. Its README and RESULT keep the original Float32 failure, cold-factory cost, canonical/Time boundary, and whole-train limits explicit.

From a fresh extraction where the original author source workspace was absent:

1. `test-exact.mjs`: PASS;
2. `test-negative-ownership.mjs`: PASS.

This is materially better resource closure than the older v29 performance package, whose 13 dependencies are explicitly external and pinned. The v29 archive is not misclassified as silently missing bytes; it simply cannot support a standalone replay claim unless that exact external checkpoint is materialized.

## Exact fresh-workspace failure

The package's own `replay-smoke.mjs` then stopped at `revision-guard-tests.mjs`:

- operation: `mkdtempSync('/workspace/shared/post4376852-guard-')`;
- fresh environment: `/workspace/shared` did not exist;
- error: `ENOENT`;
- fourth core program was not reached.

The temp root is not declared in README or `INTERFACE_AND_SCOPE.md`. A deterministic static probe also found exactly one undeclared absolute writable root: `/workspace/shared`.

## Controlled positive replay

After creating only the missing directory `/workspace/shared`, without changing source, fixture, snapshot, or runtime code, the same archive passed all four named core programs:

- `test-exact.mjs`;
- `test-negative-ownership.mjs`;
- `revision-guard-tests.mjs`;
- `test-original-ownership-after-freeze.mjs`.

Therefore this is not a numerical or ownership failure. It is a replay-environment closure defect in the test harness.

## Decision

`HOLD_A6_HOST_PREPARATION_REPLAY_ENVIRONMENT_CLOSURE_INCOMPLETE`

Manifest integrity plus self-contained runtime bytes are not enough for a full replay claim if the verifier requires an undeclared absolute writable directory. The existing `CANDIDATE_EXECUTABLE_RESOURCE_CLOSURE_001` was extended; no duplicate regression was created.

## Minimum repair

Replace the hard-coded root with `fs.mkdtempSync(path.join(os.tmpdir(), 'post4376852-guard-'))`, or create and declare a package-local writable temp parent. Then rerun the full core suite from a fresh extraction with no author workspace directories precreated.

## Applicability boundary

This does not reject:

- the packaged native snapshot;
- the fixed-revision Float64 comparisons;
- ownership isolation;
- the bounded hot-cost observation;
- the older v29 package's honestly declared external dependency.

It does not certify different hardware, browser/GPU, canonical/Time integration, production adoption, or user acceptance. No production Mother, main, private artifact, OS rule, or global gate was modified.

## State

- `POSTED`: issue #91 comment `6565727325`
- `ACKNOWLEDGED`: false for this A6 subject
- `IMPLEMENTED`: Candidate static checker and regression update only
- `GATE-RUN`: fresh-extraction runtime replay plus controlled temp-root positive replay
- `ADOPTED`: false
- `USER-ACCEPTED`: false
