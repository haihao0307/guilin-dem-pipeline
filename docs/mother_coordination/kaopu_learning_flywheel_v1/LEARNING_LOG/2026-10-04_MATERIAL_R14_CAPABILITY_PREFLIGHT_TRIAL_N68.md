# KAOPU Learning Flywheel N68 — Material R14 capability-preflight trial

Date: 2026-10-04  
Status: CANDIDATE EVIDENCE UPDATE / MATERIAL-LOCAL  
Global R2 adoption: false

## 1. Existing real failure

Material advanced from R11 to the public R14 artifact, but the latest public-runtime evidence still mixes two different questions:

1. does the exact public artifact start and support its critical interaction;
2. can the verifier environment supply the WebGL2 context that the artifact requires.

N67 introduced a Candidate gate that keeps these questions separate. This round applies that existing gate to R14; it does not create another rule or regression case.

## 2. Bound subject and direct observation

- production source: `main@47fc6645e2742866e20cea79c3c4a65b2bda423b`
- public source: `gh-pages@0410a4eef9be00af41a84bfa91fe5b075c992338`
- exact URL: `https://haihao0307.github.io/guilin-dem-pipeline/kaopu-material-workbench/?case=iq&v=r14`
- observed title/version marker: `KAOPU 石头材质工作台 · R14` / `MATERIAL STUDIO / R14`
- observed runtime result in the current default hosted browser: `WebGL2 未启动。`; the task buttons remained disabled and `KAOPU10.ready` was not reached.

Static source ordering narrows the failure stage. `makeRenderer()` requests:

```text
webgl2
alpha=false
antialias=false
preserveDrawingBuffer=true
powerPreference=high-performance
```

It throws immediately when `getContext()` returns null. Program compilation and artifact-specific shader drawing occur later. Therefore this receipt may say `context creation failed before shader compilation`; it still may not say that an isolated matching fixture failed.

## 3. External method / evidence

No new external rule is introduced. N67 already records the relevant Khronos `getContext()` failure semantics, WPT `PRECONDITION_FAILED` distinction, and NASA test-environment reporting requirements. This round is a real-subject replay of that Candidate.

## 4. Comparison with current KAOPU evidence

The current `material-r14-motion.yml` supplies useful but differently scoped evidence:

- it launches Chromium with explicit SwiftShader arguments;
- it checks the public R14 marker, waits for `KAOPU10.ready`, exercises rotation and records structural motion fields;
- its generated proof labels the environment as SwiftShader and not a physical iPhone.

However the proof source does not bind browser version, actual graphics backend, physical-device identity, public artifact commit/hash, a matching isolated capability fixture, or `webglcontextcreationerror.statusMessage`. It therefore cannot satisfy the N67 capability receipt for the default hosted browser, and its pass must remain scoped to that CI launch configuration.

## 5. Falsifiable hypothesis

Applying N67 to a new real artifact should refuse artifact-defect attribution when environment identity and an isolated matching capability preflight are absent, even when the artifact itself visibly stops at context creation.

Falsifier: if the gate classified this receipt as `SCOPED_ARTIFACT_RUNTIME_FAILURE`, then N67 would not actually prevent the attribution error it was designed to stop.

## 6. Minimal trial result

Input facts:

- `artifactIdentityBound=true`
- `environmentIdentityBound=false` because browser version, launch arguments and graphics backend are not available in the current receipt
- `capabilityPreflightStatus=NOT_RUN`
- `artifactRuntimeStatus=FAIL`
- `requestedClaimScope=EXACT_ENVIRONMENT`

Executable N67 gate result: `1/1 passed`; output `HOLD_ENVIRONMENT_IDENTITY_UNBOUND`.

This is the correct conservative result. The public delivery remains failed in the observed browser, but the cause is not promoted to a shader, geometry or material defect. The unavailable isolated fixture is recorded as missing evidence, not silently replaced with the artifact's own `getContext()` call.

## 7. Applicability and adoption decision

Applicability: Material R14 public-runtime root-cause attribution only. The result does not evaluate visual fidelity, first-pass acceptance, physical-device behavior or user acceptance.

Decision: keep N67 as `IMPLEMENTED_CANDIDATE / GATE-RUN`; add R14 as new real evidence to the existing regression case. Do not adopt globally and do not change R2, `main`, `gh-pages`, any production Mother or delivery threshold.

Lifecycle: `POSTED` after routing to Material coordination; `ACKNOWLEDGED`, `ADOPTED` and `USER-ACCEPTED` remain false until real receipts exist.

Metrics: first-pass candidate pass rate `unknown`; user corrections `unknown`; recurrence rate `unknown`; rejected-lineage inheritance `unknown`; stale delivery `unknown`; internal iterations per accepted delta `unknown`; instruction-to-legal-candidate time `unknown`.
