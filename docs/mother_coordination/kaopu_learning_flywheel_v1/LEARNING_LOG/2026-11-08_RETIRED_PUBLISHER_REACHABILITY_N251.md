# N251 — Retired artifact publisher reachability

## Bounded question

When a published artifact has been retired and removed, is target absence alone sufficient, or must the retirement receipt also prove that no executable publisher can recreate the same target?

## Current baseline and production observation

- Current `main`: `6a003f0fafb9ae27d71e95963728461288c14edb`.
- Parent: `34553e93d75a427c10dbf5b0077d42f8cdda0a63`.
- The current commit deleted `.github/workflows/publish-quick-shorts-r4.yml` (historical blob `d3af50f196c0b075aa4d95755bb3ad81071a0080`). Its commit message states that Pages should retain the current version plus one exact comparison and that the obsolete workflow could recreate `quick-shorts-r4` from an old source directory.
- Historical workflow facts: it was on the default branch, exposed `workflow_dispatch`, had `contents: write`, read `haihao0307/Humanoid-Rig-Lab-Next@main:quick-shorts-r4`, assembled the same target path and pushed to `gh-pages`.
- Current negative evidence: exact `quick-shorts-r4` code search on current `main` returned no result; the current Actions workflow inventory contains no matching workflow; `Humanoid-Rig-Lab-Next@main:quick-shorts-r4` returns 404; `gh-pages@54a30da8f78a5cab703f9498bb661deeb0aeea2b:quick-shorts-r4` returns 404.
- The four R2 baseline blobs were unchanged in this run. #91 and #63 had no later Mother acknowledgement after N250.

## Failure mechanism

Deleting the public directory proves only present target absence. If a default-branch workflow still has a reachable trigger, write authority, a matching target path, and a source route that can materialize the artifact, the retired artifact remains reachable and can silently return. A mutable source alias is especially unsafe: a source path that is absent now can reappear later without changing the publisher identity.

This is the same failure family as `REJECTED-DESCENDANT-QUARANTINE-001`, not a new regression family. That case already says branch reset, renamed directories and readable history do not prove that rejected content cannot return. N251 adds a third production-shaped observation: an executable publisher is itself a reintroduction path. Therefore the existing case is updated rather than duplicated.

## Falsifiable hypothesis

For a declared retired target, a gate over `target absent × live matching writer × materialization reachability` will:

1. hold the historical Quick Shorts R4 publisher topology even when the source path is currently absent but mutable;
2. pass the current topology after the target and matching writer are both absent;
3. avoid false positives for documentation-only references and writers for other target paths.

## Minimal replay

CPU-only deterministic replay: `retired_publisher_reachability_gate_n251.mjs` against six fixtures.

- Result: `6/6 PASS`.
- Fixture SHA-256: `70d70337848ab825f133895e804df983c5a3b6a73dae64c7ab8499199787630c`.
- Gate SHA-256: `c62112d8f70ab4e19a91a113b9f3dad5ab63c4f1dbceedc02eb9e82626a03090`.
- Result SHA-256: `62b28ac31dbdf9974c55994a035f22dff2b5884e60abb88395b2bc934b843879`.

Candidate decisions:

- `HOLD_RETIRED_TARGET_STILL_PRESENT`
- `HOLD_RETIRED_TARGET_RECREATION_REACHABLE`
- `RETIRED_TARGET_NOT_REACHABLE_CANDIDATE`

## Candidate receipt increment

For rejected or retired artifact cleanup, add these fields to the existing regression receipt:

- `retiredTargetRepositoryBranchPath`
- `targetAbsenceReadback`
- `publisherReachabilitySet`
- `publisherDefaultBranchPresence`
- `publisherTriggerReachable`
- `publisherWriteAuthority`
- `publisherTargetPathMatch`
- `publisherSourceIdentityOrMutableAlias`
- `sourceMaterializationReachability`
- `publisherReachabilityAuditAt`

The retirement candidate is held if any live writer can recreate the same target. Removing the target without auditing writers is not a complete retirement receipt.

## Boundary and status

- This does not require deleting immutable history or audit evidence.
- A text reference is not a writer; another target's publisher is not a blocker.
- A missing source path does not close the gate when the publisher reads a mutable alias and the path can reappear.
- This is a Candidate update and one historical replay only. It does not change R2, `main`, `gh-pages`, production Mothers or thresholds.
- Lifecycle: `POSTED` only after the #91 routing comment exists; candidate probe `IMPLEMENTED / GATE-RUN`; `ACKNOWLEDGED / ADOPTED / USER-ACCEPTED = false`.
- Related Mother response: `NOT_QUERIED / UNKNOWN` until #91 provides a real acknowledgement or names the owning module entry.
