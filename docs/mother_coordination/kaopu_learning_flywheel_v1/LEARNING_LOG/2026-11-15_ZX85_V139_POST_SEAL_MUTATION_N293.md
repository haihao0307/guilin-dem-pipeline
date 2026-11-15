# N293 — ZX85 v139 post-seal mutation and external restore contract

- Observed: 2026-11-15T15:44:20+08:00
- Baseline: current main R2 OS, reference-replication gate, freshness gate, #91/#63 feedback, and the existing N290/N292 Candidate
- Scope: learning branch only; no production Mother, main, Site, asset, R2 OS or global gate changed
- State at authoring: `IMPLEMENTED_CANDIDATE / GATE-RUN`; N293 routing pending; `ACKNOWLEDGED=false / ADOPTED=false / USER-ACCEPTED=false`

## One bounded question

Does v139's `RESTORE_RUNTIME_CLOSURE.json` plus `CHECKSUMS.json` form a trustworthy two-ledger dependency contract, or is the checkpoint mutating after its integrity receipt is sealed?

## Existing failure

N292 showed that v121 contained a licensed Three.js copy, but the mirror gate still imported an absent `.sites-checkout` path. A temporary import-only counterfactual passed the generic math test, while the exact delivered subject failed. v121 also had 437 unmanifested files and 11 digest mismatches.

## Fresh v139 evidence

The exact subject is Library version 139, modified 2026-11-15T15:35:05+08:00, 133,145,028 bytes, SHA-256 `896f7bc0be9b76fbedd8f4d6c952a04f9ffabe28e04847f8e458eede441e3e0f`, with 3,293 ZIP entries.

The mirror helper, check and stored receipt remain byte-identical to v81. Clean extraction still exits 1 with `ERR_MODULE_NOT_FOUND` for `front-r04-release/.sites-checkout/dist/boom-functional-r05/vendor/three.module.js`.

v139 now exposes a split closure receipt:

- `ownFiles`: 150 declared, 150 present, zero digest mismatches.
- `restoreFromExactSiteV201`: 18 declared external runtime paths, zero present in the checkpoint.
- The critical missing mirror dependency is one of those 18.

The external list provides path strings and a prose Site version label, but no per-file digest, license/provenance, stable source/project identity, materialization command or materialization receipt. It therefore describes restoration intent, not a reproducible external dependency contract.

## New failure mechanism: seal before final write

From v121 to v139:

- archive files excluding `CHECKSUMS.json`: 3,035 → 3,292, delta +257;
- manifest entries: 2,598 → 2,598, delta 0;
- unmanifested files: 437 → 694, delta +257;
- digest mismatches: 11 → 11.

The equality between archive growth and unmanifested growth is direct evidence that every newly present file landed outside the frozen integrity receipt. The subject is changing after its checksum seal. This is a build-order/TOCTOU failure, not merely one missing library.

## Falsifiable institutional trial

Hypothesis: a final-seal step plus a pinned external ledger prevents a stored PASS from surviving later subject mutation.

Pass only if:

1. all package writes finish before the manifest is generated;
2. manifest coverage equals the final archive subject;
3. each external dependency binds immutable locator, exact digest, license/provenance and owner;
4. materialization has an explicit receipt;
5. the exact post-materialization clean replay exits 0.

Historical replay result on v121→v139: refuted.

## Boundary and decision

No concrete user-named rear-view mirror pair, `symmetryPairId` or whole binding was found; the generic stored receipt still reports zero real parts mirrored.

Decision: `HOLD_POST_SEAL_MUTATION_AND_UNPINNED_EXTERNAL_RUNTIME`.

This refines the existing Candidate rather than creating a duplicate regression. KPI effects remain `unknown`; no production implementation, adoption or user acceptance is claimed.
