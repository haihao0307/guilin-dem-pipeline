# N74 — Haiyu: corrected side version is not the canonical delivery

Status: new subject evidence plus a Candidate single-Mother regression. No production Mother branch, `main`, `gh-pages`, R2 baseline, schedule, Canonical Truth or user-frozen asset is changed.

## Bounded question

Does Haiyu commit `1646a284` make the user's correction the current public workbench, or does it only add a corrected R22 side path while the fixed entry continues serving R21?

## Existing real failure

The correction says original 04/05 must remain independently runnable while the skeleton interpretation is additive. Current `gh-pages@e541449ac9d332e17e6bafb49a1e4ccfa9d914ea` contains both objects:

- fixed entry `kaopu-haiyu-workbench/index.html`: blob `7fc85185daec334f6cae2ec9bb62c5ef15ce2d8d`, build `R21-thorax-20261004`; the live fixed URL identifies itself as R21 and exposes `04 多频羽化 · 三维` / `05 仿生游动 · 三维`, not the original 04/05 entries;
- side candidate `kaopu-haiyu-workbench/r22/index.html`: blob `0aade10a5adc556e4f6386da7044a04def072d9c`, build `R22-source-and-research-20261004`; the live side URL exposes `04 多频羽化 · 原式`, `05 仿生游动 · 原式`, and separate skeleton research A/B.

Commit `1646a284` added R22 and its supporting files but did not change the fixed `index.html`. Parsed fixed-entry links contain no R22 link. The repair therefore exists as candidate bytes but is not the user's canonical delivery. This is not an accusation that R22 itself is visually accepted or reference-faithful.

## External method / evidence

NIST SP 800-128 defines configuration change control as proposal, impact analysis, test/evaluation, review, implementation and disposition. Its process does not end at a tested candidate: after promotion to production it explicitly requires confirming that the change was implemented correctly, then documenting the changed baseline and retaining prior baselines for audit/rollback: <https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-128.pdf> (section 3.3.2 and Appendix G).

Transferred mechanism: separate `CORRECTION_CANDIDATE_VERIFIED` from `CORRECTION_PROMOTED`. Promotion requires a fresh readback of the one fixed public entry, bound to candidate identity and correction-critical invariants. Keep the prior entry identity as rollback evidence until that readback passes.

## Comparison with current KAOPU rules

`PUBLIC_WEB_DELIVERY_GATE.md` already requires one public URL, final-address readback, version-marker match, browser startup and rollback preservation. R2 also forbids counting files and branches as progress. Those principles are `no-novelty` and remain unchanged.

The new gap is executable regression coverage for a distinct failure shape: the corrected side artifact is valid enough to inspect, yet the canonical entry still serves the superseded behavior. Existing mutable-head, shared-publication CAS and stale-parent cases do not test canonical-entry promotion after a user correction, so this Candidate is not a duplicate.

## Falsifiable hypothesis

If a correction-promotion gate requires candidate identity, fixed-entry readback, marker/identity equality, automatic resolution and correction-invariant results, it will:

1. hold the real Haiyu R21-root/R22-side fixture as `HOLD_CANONICAL_ENTRY_STALE`;
2. accept a control where the fixed entry resolves to the exact corrected candidate as `CORRECTION_PROMOTED_NOT_USER_ACCEPTED`;
3. hold a candidate with no public readback;
4. hold a matching marker/identity whose correction invariant fails.

The hypothesis is falsified if any decision differs.

## Minimal historical replay

Executable objects:

- `REGRESSION_CASES/CANDIDATE_CORRECTION_CANONICAL_ENTRY_001.json`;
- `PROBES/correction_canonical_entry_gate_n74.mjs`;
- `PROBES/correction_canonical_entry_gate_result_n74.json`.

Result: `4/4 passed`. The real fixture is `HOLD_CANONICAL_ENTRY_STALE`.

## Applicability boundary

Apply only when a Mother has a declared fixed public entry and a user correction is implemented in a separate candidate/version path. Do not require copying every historical version into the fixed entry. A redirect or indirection is acceptable if it is the declared entry behavior and fresh readback proves automatic resolution to the exact corrected identity. This gate does not establish reference fidelity, visual quality, physical-device acceptance, production-wide adoption or user acceptance.

## Decision and routing

`CANDIDATE_SINGLE_MOTHER_TRIAL_ONLY`. Route only to Haiyu through #91: preserve R21 as rollback, promote R22 (or an exact equivalent) to the fixed `kaopu-haiyu-workbench/` entry, then read back that fixed URL and record marker, content identity, 04/05 original-entry invariants and browser evidence. Until then state is `HOLD_CANONICAL_ENTRY_STALE`; do not ask the user to choose the hidden `/r22/` URL and do not claim the correction is delivered.

Lifecycle before routing receipt: `POSTED=false`, candidate `IMPLEMENTED=true`, local replay `GATE-RUN=true`; `ACKNOWLEDGED`, `ADOPTED`, and `USER-ACCEPTED` remain false. KPI effects are `unknown` except one observed stale canonical delivery; no rate is inferred.

No external AI was claimed or invoked as a participant.
