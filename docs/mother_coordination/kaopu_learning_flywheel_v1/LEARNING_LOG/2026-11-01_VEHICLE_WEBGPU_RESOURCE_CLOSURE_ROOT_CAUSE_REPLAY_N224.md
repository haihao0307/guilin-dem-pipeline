# N224 — Vehicle WebGPU resource-closure root-cause replay

## Bounded question

After N223 was explicitly acknowledged and moved to `ROOT_CAUSE_REVIEW`, does the current Vehicle private package v24 implement the five named repair items?

## Current subject

- Library identity: `libfile_76004f2c53d08191906a035a2ef295ad`
- package: `KAOPU_VEHICLE_FUNCTION_REBUILD_R01_PRIVATE.zip`
- version: 24
- modified: 2026-11-01 03:29:43 Asia/Shanghai
- archive SHA-256: `81fbd0166cb21d74deff6c86dc3079688302461c3bb90e70a58fe1b7b7cded0a`
- checkpoint created: `2026-10-31T19:29:06.831500Z`

Main remains `4f59489d3a399034e82190cae9b41d3e92a5942b`; AGENTS and the R2/reference/freshness gates are unchanged from N223.

## Real feedback state

N223 was POSTED to #91 as comment `6545548001`. The later coordinator response `6547524817` independently inspected v22, confirmed recurrence, set `HOLD_GATE_FAIL / ROOT_CAUSE_REVIEW`, and named five bounded repair items. That is a real `ACKNOWLEDGED` receipt, not adoption or implementation.

## Replay result

The v24 package is newer and larger, but the WebGPU route state did not advance:

1. `.wgsl` is still absent from the checkpoint builder allowlist.
2. `runtime/gpu-experiment/compute.wgsl` is still absent from the archive and manifest.
3. No delivered executable-resource closure checker was found.
4. Owner tests still report `gpuExecuted:false / shaderCompiled:false`; the independent suite still substitutes `fetch()` bytes.
5. The GPU README still honestly says no real adapter compiled or executed WGSL.
6. No package-level R2 Task Anchor or Delivery Receipt records the root-cause execution.

The owner CPU/fail-closed suite remains 17 checks plus 5,202 scalar comparisons; the independent CPU/mock suite remains 30 checks. Those passes preserve valid CPU/function evidence but do not satisfy the acknowledged repair contract.

N224 root-cause replay: 11/11 evidence checks.

Decision: `KEEP_ROOT_CAUSE_REVIEW_V24_RESOURCE_CLOSURE_UNRESOLVED`.

## System comparison and action

This is not a new failure class. It is a new exact-subject recurrence under `CANDIDATE_EXECUTABLE_RESOURCE_CLOSURE_001`, after a real ACK and named repair contract. Therefore:

- update the existing regression evidence;
- do not create a new case, teacher, meeting, or global rule;
- do not reject the mathematical model, CPU renderer, or unrelated v24 additions;
- do not count the newer package timestamp/file count as WebGPU progress;
- keep `ROOT_CAUSE_REVIEW` until the delivered archive contains and pins the actual shader, a non-substituting test loads those bytes, and real shader/backend evidence is separately recorded.

## State

- POSTED: N223 and this follow-up route to #91.
- ACKNOWLEDGED: yes, coordinator comment `6547524817`.
- Candidate checker: IMPLEMENTED on the learning branch only.
- GATE-RUN: package closure/root-cause replay 11/11.
- Production IMPLEMENTED / GPU runtime GATE-RUN / ADOPTED / USER-ACCEPTED: false / not established.

