# N239 — A4 Player R05 runtime command-binding identity

- Recorded: 2026-11-03 23:37 Asia/Shanghai
- Question class: 制度问题
- Bounded question: isolated Player R05 是否在 PASS 前消费 runtime command-binding 模块的冻结身份，使被改写的 adapter 不能在现有 gate 下发出不同窗口 uniform？
- Decision: `HOLD_A4_R05_PLAYER_RUNTIME_COMMAND_BINDING_IDENTITY_NOT_FAIL_CLOSED`
- Existing regression: update `CANDIDATE_EXECUTABLE_RESOURCE_CLOSURE_001`; do not create a duplicate case.

## Fresh alignment

Re-read current `main` before the probe:

- root `AGENTS.md` blob `251b664646a489e9292748f1d41998ee62a338f5`
- `knowledge/MOTHER_PRODUCTION_OPERATING_SYSTEM_R2_ZH.md` blob `d942d44bad0bbd206ea3768d620ad60d5ddeb2bf`
- `knowledge/REFERENCE_REPLICATION_NO_CREATIVE_SUBSTITUTE_GATE.md` blob `8c0a49c71865ef76cbc614f8188239bc808a8278`
- `knowledge/TASK_FRESHNESS_AND_NO_STALE_DELIVERY_GATE.md` blob `4754a90a94e4a9e7806357b6eb292e5c713e9021`
- issue #91 latest production feedback: N238 route comment `6603022494`; no later Mother acknowledgement found
- issue #63: no new applicable production feedback
- applicable regression: `CANDIDATE_EXECUTABLE_RESOURCE_CLOSURE_001`

R2 remains the baseline. No OS or production gate was changed.

## Subject

- Library: `A4_ORIGINAL_ROUND_HOUSINGS_ANGLED_WINDOWS_PLAYER_R05.zip`
- Library identity: `libfile_876998c223c88191891e685bf5663a77`
- SHA-256: `a418e3137d3f737e8808b7b9920cbf2598401701ac9daf3cb75279441c7e15f6`
- Archive entries: 17,315
- Player revision: `train-native-orthographic-player-r05`
- Declared scope: 187 programs / 3,293 fullscreen analytic draws / 58 inspection groups; browser, publication and user acceptance not run

## Current Best View versus new fact

Current Best View already requires delivered resources and transitive authority hashes to be consumed before execution. R05 improves the local asset side: `GEOMETRY_LOCK.json` hash-binds shader, pass-plan, material and canonical bytes; `FREEZE.json` also lists 496 Player files, including `NativeTrainBackend.mjs` and `native/angled-cab-windows-pass.mjs`.

New fact: the packaged Node gates do not consume `FREEZE.json` before static imports, and their mock-GL assertions do not compare the semantic command trace. Therefore the last-mile adapter that converts an exactly validated pass into GPU uniform calls can change while both gates stay green.

## Minimal falsifiable replay

Pristine commands:

```text
node new-admission.test.mjs
node player-protocol.test.mjs
```

Both passed. For filter 57, the diagnostic observed 66 draws; the first eight `uSide` values were all `1`.

In a verifier-only isolated copy:

1. redirect the backend's static import to a wrapper;
2. run the original exact pass validator and setter;
3. negate only the value sent to `uSide`;
4. leave the packaged `FREEZE.json`, shaders, pass plans and canonical data untouched;
5. rerun the same two gates.

Result:

- `FREEZE.json` check would have one listed mismatch (`NativeTrainBackend.mjs`) plus one unlisted added wrapper;
- both packaged gates still returned the same PASS statuses;
- filter 57 still reported 66 draws;
- the first eight `uSide` values changed from eight `1` values to eight `-1` values, with the tail reversed correspondingly.

This is a semantic GPU-command change, not a no-op comment.

## Candidate delta

Update `CANDIDATE_EXECUTABLE_RESOURCE_CLOSURE_001` so that:

- runtime command-binding modules and their pins are Task Anchor fields;
- receipts state which command-binding hashes were checked, whether a semantic command trace was compared, and whether mutation was rejected before draw;
- a pre-import wrapper validates static ESM module bytes before use;
- a bounded semantic trace checks uniforms, bindings, dispatch parameters and resource selection;
- equal program/draw counts under a mock GL are not sufficient last-mile identity evidence.

## Boundaries

- The pristine package's packaged Node gates passed.
- The probe does not say the pristine R05 archived EGL PNGs are wrong.
- It does not establish browser, hardware GPU, device, production or user acceptance.
- It does not modify production Mother branches or assets.
- Adoption remains Candidate-only until Mother feedback and a repaired replay reject the same mutation before draw.

## Lifecycle

- POSTED: false (pending #91 route)
- ACKNOWLEDGED: false
- Candidate IMPLEMENTED: true
- production IMPLEMENTED: false
- GATE-RUN: true
- ADOPTED: false
- USER-ACCEPTED: false

## Metrics

Reliable first-pass acceptance, correction recurrence, rejected-lineage inheritance, stale delivery and time-to-legal-candidate measurements remain `unknown`.
