# KAOPU Learning Flywheel N253 — provider dependency hermeticity audition

Date: 2026-11-08 (Asia/Shanghai)  
Status: Candidate audition; not adopted  
Bounded question: **How can KaoPu Engine discover a Mother/provider dependency omitted from an exact-reuse declaration?**

## Required baseline read

- Coordinator `main`: `6a003f0fafb9ae27d71e95963728461288c14edb`
- root `AGENTS.md`: blob `251b664646a489e9292748f1d41998ee62a338f5`
- R2 OS: blob `d942d44d4b9c104f843e624caa534e0e97ee8114`
- no-creative-substitute gate: blob `8c0a49ed09e31966a3198cda59c4a44bda115137`
- freshness gate: blob `4754a908444f4c31e55c3375cb72252fa9004577`
- #91 latest real feedback: N252 comment `6718949635`; no newer acknowledgement
- #63: no new feedback after N49

## Current Best View and de-duplication

KaoPu Engine `603682e1c1aa86323154038ccfc7215833afcda9` already assigns the roles correctly:

- `core/FunctionAssetContract.mjs` blob `119690fa4ab6ebea276e9cfed48eec5cfd4541db` requires each provider to declare the complete inputs of a rebuildable result and explicitly states that a declaration alone cannot prove completeness.
- `core/ExactReuseSlots.mjs` blob `19afc8e6285884548d39c14d88c2cfb42886986a` requires complete dependency/version keys and invalidation after resource replacement.
- `world/WorldRules.json` blob `73aeac8e6e0ce5985d3c31a08bfdc1c886680621` says definitions may be shared only with identical inputs and relevant versions, and enumerates dependency domains.

Therefore “Mother declares semantics; Engine schedules reuse” is `NO_NOVELTY`. The unresolved gap is verifying a declaration that omits an input.

Existing R72–R74 Gaussian cache studies demonstrate several known invalidation dimensions by controlled perturbation. They do not provide a general mechanism that catches an unknown omitted read before cache publication, so this is not a duplicate of those cases.

## Teacher audition: Bazel sandboxing

Teacher status: `TEACHER_CANDIDATE`; lifecycle: `AUDITION`.

### Screening

1. **Source/provenance:** official `bazelbuild/bazel` repository and `bazel.build` documentation.
2. **Maintenance:** repository pushed 2026-11-07; patch LTS release `9.3.2` published 2026-11-05.
3. **Runnable code/tests:** sandbox implementations and shell integration tests are in the source repository; release binaries and checksums are published.
4. **License/rights:** repository license is Apache-2.0; bundled installer components have separate notices, so KAOPU should learn the method rather than vendor Bazel binaries.
5. **Direct relevance:** official sandboxing rationale names the same failure mechanism: an undeclared input changes, the system believes the action is current, and incorrect cache reuse can contaminate shared caches.
6. **Novelty over Current Best View:** KAOPU already demands exact declared inputs; Bazel adds the enforcement pattern of making undeclared access unavailable/failing at execution.
7. **Dependency/hardware/cost:** installing Bazel or OS namespaces would be disproportionate for JavaScript function providers. A small provider access facade is the bounded transfer candidate.
8. **Failure boundary:** official current docs state the default sandbox does not hide the host environment and absolute-path reads can remain possible; issue `#31317` reproduces this ambiguity. Observed read sets also cover only executed paths. It is not a universal completeness proof.

Specific answer to the teacher question: **Bazel knows more than current KAOPU on one bounded point: declarations become testable when the execution environment exposes only declared inputs and treats an undeclared access as failure; its own default-sandbox boundary shows why a working-directory convention is insufficient.**

Primary sources:

- https://github.com/bazelbuild/bazel/blob/master/docs/docs/sandboxing.mdx
- https://github.com/bazelbuild/bazel/blob/master/src/main/java/com/google/devtools/build/lib/sandbox/LinuxSandboxedSpawnRunner.java
- https://github.com/bazelbuild/bazel/blob/master/src/test/shell/bazel/bazel_sandboxing_test.sh
- https://github.com/bazelbuild/bazel/releases/tag/9.3.2
- https://github.com/bazelbuild/bazel/blob/master/LICENSE
- https://github.com/bazelbuild/bazel/issues/31317

## Falsifiable hypothesis and minimum replay

Hypothesis: for a provider that receives world inputs only through a mediated accessor, `executedReadSet - declaredDependencySet` detects an executed hidden dependency; deny mode blocks result publication. If the provider can read state through an unmediated global/closure or the hidden branch is not executed, completeness remains `UNKNOWN`.

CPU replay uses two states with identical declared `width,height` and different undeclared `weather`:

1. declared-only keys collide;
2. provider outputs differ;
3. observed read set identifies `weather` on the executed path;
4. deny mode throws before publication;
5. adding `weather` produces distinct keys;
6. an unexecuted conditional branch demonstrates that one clean trace is not completeness proof.

Result: **6/6 PASS**.

## Candidate contract

Single Engine/Mother audition only:

```text
providerIdentity
providerVersion
resourceName
declaredDependencySet
executedReadSet
undeclaredReadSet
scenarioSet
auditMode = OBSERVE | DENY
resultPublicationDecision
branchCoverageStatus
numericBackendIdentity
```

Decision semantics:

- non-empty `undeclaredReadSet` → `HOLD_UNDECLARED_PROVIDER_READ`
- any unmediated state channel → `HOLD_UNMEDIATED_INPUT_CHANNEL`
- no violation in executed scenarios → `DEPENDENCY_AUDIT_PASS_EXECUTED_PATHS`, never a universal completeness claim
- unexecuted branch space → `UNKNOWN_UNEXECUTED_BRANCH_COMPLETENESS`

The candidate is a verifier/audit rule, not a new Mother production responsibility and not authorization to change caching. Mother remains owner of semantic declarations; Engine owns the mediated audit, exact keying, scheduling and invalidation.

## Boundaries and routing

- No production Mother branch, engine source, R2 OS or cache policy changed.
- No claim that Bazel participated as an external AI.
- No target GPU/browser/device evidence; this is a deterministic CPU counterexample only.
- Only KaoPu Engine/function-provider owner should evaluate relevance, existing equivalent coverage, reusable fields and the smallest one-provider trial.
- Lifecycle at save: `IMPLEMENTED(candidate)=true`, `GATE-RUN=true`; `POSTED/ACKNOWLEDGED/ADOPTED/USER-ACCEPTED=false` until routing receipt exists.
