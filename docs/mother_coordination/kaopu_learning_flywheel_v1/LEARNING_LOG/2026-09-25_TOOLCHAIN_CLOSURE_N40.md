# N40 — Successful Run Is Not a Reproducible Rerun

## Bounded question

Does Fish R012's immutable tested source and successful run prove that the same regression gate can be reproduced later when its toolchain closure is mutable or unrecorded?

## 1. Existing real failure

- R012 has two preserved failed attempts with different signatures and a final successful run; N31 already protects that attempt lineage and does not blame the toolchain.
- The final run pins source b5f2d11cbf55e17518dda411bf034596818c46d5, workflow blob b0bc8a27e96bbcb698a88df415f8370b01e51b82, run 35974311593 and job 107551050350.
- Its actual workflow nevertheless uses actions/checkout@v4, actions/setup-node@v4, actions/upload-artifact@v4, ubuntu-latest, Node 22, ambient Python/pip/npm, npm install --no-save without a repository package-lock, and an unreceipted Chromium/system-dependency installation.
- Therefore the real evidence gap is rerun reproducibility, not historical execution validity. No toolchain-caused production failure is inferred.

## 2. External method and evidence

- GitHub states that a full-length commit SHA is the only immutable action release reference. It also documents runner-image SBOM release assets.
- GitHub defines -latest runner labels as the latest stable images it provides, which is a moving class rather than one immutable image identity.
- npm states that package-lock.json records the exact generated dependency tree so later installs can reproduce identical trees despite intermediate dependency updates.
- npm ci requires a lockfile, errors on manifest/lock mismatch, removes an existing node_modules directory, and does not rewrite the manifest or lock; its install is frozen.

Primary sources:

- https://docs.github.com/en/actions/reference/security/secure-use
- https://docs.github.com/en/actions/reference/runners/github-hosted-runners
- https://docs.npmjs.com/cli/v11/configuring-npm/package-lock-json/
- https://docs.npmjs.com/cli/v11/commands/npm-ci/

## 3. Comparison with current KAOPU rules

R2 already requires immutable task/artifact identity and claim-scoped evidence. N30 binds tests to the exact subject; N31 preserves failed attempts; N37 separates hosted/browser/device environments. None of the applicable N26–N39 Candidate cases makes the resolved toolchain closure for a later rerun machine-decidable. That closure is the N40 novelty. The general instruction to pin evidence identity is no-novelty.

## 4. Falsifiable hypothesis

If rerun reproducibility requires resolved action SHAs, runner image/SBOM identity, runtime versions, frozen dependency closure, browser build and system-package inventory, then R012 historical success remains valid while its stronger rerun claim is held. A fully sealed synthetic control must pass; mutable actions, missing dependency closure, unidentified runner image and changed manifest must produce different non-pass decisions.

## 5. Minimal replay

toolchain_closure_gate_n40.mjs replays the exact R012 workflow declaration and run identity, then evaluates five counterfactual controls.

Expected result: 12/12 assertions pass.

## 6. Applicability boundary

- Local trial for Fish long-lived browser regressions or rebuild claims.
- It does not require global offline/hermetic builds or bitwise-identical output.
- It does not retroactively invalidate R012.
- If a platform cannot expose a field, that layer remains Unknown and the rerun claim narrows.
- A future toolchain update is allowed, but it is a new environment requiring a fresh gate rather than silent equivalence.

## 7. Adoption decision

Candidate partial. Route only to Fish issue #91 for the next applicable rerun. Do not modify main R2, production branches, Canonical Truth or current release claims. Adoption requires a real Mother trial and independent verifier.

## Status and KPI

Prepared for POSTED routing only. ACKNOWLEDGED, IMPLEMENTED, GATE-RUN, ADOPTED and USER-ACCEPTED are false. First-pass acceptance, recurrence, stale delivery and time-to-legal-candidate remain Unknown.

No first-tier external expert AI was called.
