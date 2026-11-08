# KAOPU Learning Flywheel N254 — provider ambient-authority boundary audition

Date: 2026-11-08 (Asia/Shanghai)  
Status: Candidate audition; not adopted  
Bounded question: **Can an input read-set audit discover provider dependencies captured through a host closure or global, and where must restriction occur?**

## Required baseline read

- Coordinator `main`: `6a003f0fafb9ae27d71e95963728461288c14edb`
- root `AGENTS.md`: blob `251b664646a489e9292748f1d41998ee62a338f5`
- R2 OS: blob `d942d44bad0bbd206ea3768d620ad60d5ddeb2bf`
- no-creative-substitute gate: blob `8c0a49c71865ef76cbc614f8188239bc808a8278`
- freshness gate: blob `4754a90a94e4a9e7806357b6eb292e5c713e9021`
- #91 latest real feedback: N253 comment `6721142635`; no acknowledgement after it
- #63: no new production feedback after N49
- applicable regression: `UNDECLARED-PROVIDER-DEPENDENCY-001` from N253; this run updates it rather than creating a duplicate

## Current Best View and de-duplication

KaoPu Engine `603682e1c1aa86323154038ccfc7215833afcda9` already separates responsibilities correctly:

- `core/FunctionAssetContract.mjs` requires complete transitive dependencies and says declaration alone is not proof.
- `core/ExactReuseSlots.mjs` requires complete dependency/version keys.
- `core/FunctionProviders.mjs` registers providers as trusted Engine/workbench functions before world-data loading; `checkedProviderRecord` passes a cloned item but raw context.
- `core/AnalyticFunctionProvider.mjs` is a module-created descriptor with imports and closures.

N253 proved that a mediated input Proxy catches an undeclared read on an executed path. The unresolved boundary is an input not reached through that Proxy. This is an increment to the same regression, not a new case.

The current train candidate was also checked as recent production context. It visibly labels old versions, unfinished first frame/GPU acceptance and deferred items; it does not masquerade stale output as current. Existing freshness and rejected-lineage cases already cover the relevant risk, so no train regression was added.

## Teacher audition: Endo SES Compartments

Teacher status: `TEACHER_CANDIDATE`; lifecycle: `AUDITION`.

### Screening

1. **Source/provenance:** official `endojs/endo` repository and SES package documentation.
2. **Maintenance:** repository push 2026-10-29 and update 2026-11-04; a 2026-10-29 compatibility fix included tests.
3. **Runnable code/tests/data:** package source and extensive test suites are public; no opaque training data is involved.
4. **License/rights:** Apache-2.0.
5. **Direct relevance:** Compartments isolate globals and lexical scope and receive selective endowments, directly addressing hidden ambient authority.
6. **Novelty over Current Best View:** KAOPU has declaration and executed-read auditing; SES makes explicit that authority must be constrained when code is created/evaluated. Wrapping an already-created host function does not erase captured closure authority.
7. **Dependency/hardware/cost:** full integration would change provider loading and may conflict with module imports, GPU/device objects and performance. Cost is unknown until one provider trial.
8. **Failure boundary:** Endo says the host must maintain the boundary and harden endowments, and the project remains under security review. It is not evidence that arbitrary current KAOPU providers can be made hermetic by adding one wrapper.

Specific teacher answer: **Endo SES knows more than the current KAOPU Current Best View on one bounded point: dependency completeness is partly a code-origin/evaluation-realm property. A provider created outside the restricted realm can retain undeclared authority even when its explicit input object is fully audited.**

Primary sources:

- https://github.com/endojs/endo/tree/master/packages/ses
- https://github.com/endojs/endo/blob/master/packages/ses/README.md
- https://github.com/endojs/endo/blob/master/SECURITY.md
- https://github.com/endojs/endo/blob/master/LICENSE
- https://github.com/endojs/endo/commit/679d9af

## Falsifiable hypothesis and minimum replay

Hypothesis: an input Proxy cannot see a dependency read through a host closure. Passing that pre-created function into another realm preserves the closure. Evaluating the provider source inside a realm containing only declared endowments makes the missing ambient dependency fail before publication; explicitly endowing it makes the dependency controllable.

CPU replay:

1. dry/rain states form the same declared `width,height` key;
2. a host-created provider changes output through `ambientWeather`;
3. the input Proxy reports only `height,width`;
4. passing that function into a new context still changes with the host closure;
5. evaluating the provider source without `ambientWeather` throws `ReferenceError`;
6. explicit dry/rain endowments produce controlled distinct results.

Result: **6/6 PASS** on Node `v24.22.1`.

`node:vm` is used only as a deterministic correctness counterexample, not as a security boundary and not as a proposed production dependency.

## Candidate increment

Update the existing regression with:

```text
providerCodeOrigin
providerEvaluationRealm
ambientEndowmentSet
closureCapturePossible
unmediatedAmbientReadSetOrUnknown
auditCoverageClaim
```

Decision semantics:

- host-created provider with possible closure/global reads → `HOLD_UNMEDIATED_INPUT_CHANNEL`
- dependency inventory for existing host closures → `UNKNOWN_HOST_CLOSURE_DEPENDENCIES`
- clean input-Proxy trace → only `DEPENDENCY_AUDIT_PASS_EXECUTED_PATHS`, never completeness proof
- source-created provider missing a declared endowment → fail before result publication

This is a single Engine/function-provider candidate. It does not change Mother semantics, authorize cache publication, or add SES as a dependency.

## Boundaries and routing

- No production Mother branch, Engine source, R2 OS or gate changed.
- No GPU/browser/device/production evidence; this is CPU-only.
- Direct SES adoption remains rejected pending one-provider compatibility evidence.
- Route only to #91 for the Engine/function-provider owner to answer the four Mother questions and propose the smallest source-created-provider trial.
- Routing receipt: pending.
- Lifecycle before routing: `IMPLEMENTED(candidate)=true`, `GATE-RUN=true`; `POSTED/ACKNOWLEDGED/production IMPLEMENTED/ADOPTED/USER-ACCEPTED=false`.
