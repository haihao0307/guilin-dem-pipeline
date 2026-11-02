# KAOPU Learning Flywheel N234 — A4 inner-return R02 install lock

Date: 2026-11-03 (Asia/Shanghai)  
Status: **Candidate exact-subject GATE-RUN / not adopted**

## One bounded question

Does `A4_ORIGINAL_INNER_RETURN_INSTALLED_R02.zip` bind replacement inner-return R02 into the current nine-member local assembly, remove the prior inner draw, reproduce the packaged pixels, and reject stale inner shader bytes before GLES compilation or draw?

## Required baseline and feedback

Current `main@34553e93d75a427c10dbf5b0077d42f8cdda0a63` was read before the probe:

- root `AGENTS.md`: `251b664646a489e9292748f1d41998ee62a338f5`
- R2 OS: `d942d44bad0bbd206ea3768d620ad60d5ddeb2bf`
- reference-replication gate: `8c0a49c71865ef76cbc614f8188239bc808a8278`
- freshness gate: `4754a90a94e4a9e7806357b6eb292e5c713e9021`

Latest real #91 feedback is comment `6585164812`: the two-pane package has a verifier/production-path split. That HOLD remains. #63 has no newer applicable production feedback. Existing `CANDIDATE_EXECUTABLE_RESOURCE_CLOSURE_001` is updated as a positive control; no duplicate regression is created.

## Exact subject

- Library: `libfile_cfb01ce0e0e8819198b2ab001e7889c6`
- created/modified UTC: `2026-11-02T19:36:40.781165Z`
- ZIP SHA-256: `089f6f10641e016a8cefa4ff4f6ad47fff9c8b36fc19f8f14f5f470dbcc8d08a`
- bytes: `7,818,041`
- archive entries: `283`
- manifest entries: `282`
- previous checkpoint: `libfile_720d7fb164e88191af458c0924f421d2` / `e0939f16742313c8d44e229ab9891e23a6dbd4b1e3b3a9b5ccbe8107ff79109e`

Untouched integrity: **282/282, zero mismatch**. The package says source mesh buffers and rejected baseline are absent.

## Positive control

Native R02:

- `PASS_JOINT_MAIN_AND_LEDGE_NATIVE_NOT_FULL_LOWER_CHANNEL`
- 1,860 planned: 1,776 valid / 84 finite-domain rejections
- maximum D1 error `6.88271095672377e-9`
- minimum Jacobian `0.022199488893562814`
- 201 common-port checks
- C0 max `2.220446049250313e-16`
- longitudinal derivative gap 0
- normal gap up to `19.012904250206436°`: C0/longitudinal tangent passes, full G1 does not

Install gate:

- `PASS_STATIC_INSTALL_NO_DUPLICATE_INNER_LAYER_NOT_SHAPE_ACCEPTANCE`
- prior inner removed from active draws
- earlier eight shader bytes unchanged
- 111 upper queries bit-identical
- corrected source-hole counterexample retained
- 492 canonical world points, world error 0

Container checks:

- camera: 1,625 cases, max NDC `0.8800000000000001`
- Node UI protocol: 10 modes PASS; browser used false
- pane ordering unit: 5 directions / 7 refusal gates PASS, but this does **not** close #91 comment `6585164812`

Fresh Mesa GLES 3.2 replay:

- nine members / eleven output rows
- native scene triangles: 0
- source geometry/textures: false
- rejected baseline: false
- all row hashes equal the archive
- all eleven PNGs byte-identical to the archive
- full assembly: `d7289aa512da141407c2971c7f9a287e9a2debe8fbebd11992f79ebe15e01cf7`
- inner only: `438f4c20e1be93dd0897f0a6d284e750f25caf2a224d7a759424a95f9f73b66a`
- inside assembly: `6330ee74dfa49fa2f8acbaa2f88b4848793d045f94492d3f68f578051367f2bd`

## Exact negative control

Only a verifier copy was changed:

```text
original-function-assembly-r01/inner-return-r02.frag
append one no-op comment
```

- expected SHA-256: `c259d29f1b651bbdd070dbda5a8487182d343c802e9abeb5b00683d937f747bb`
- mutated SHA-256: `e754f0bb2b60d262222abfc5d95dce8c968ea07d8f1765359ed30edef5ec632f`
- bytes: `43,908 -> 43,980`
- `python3 render-current-assembly.py`: exit 1

Rejection occurs at the member shader hash assertion, before program creation, shader compilation/link or draw.

## Decision

`ACCEPT_A4_INNER_RETURN_R02_LOCAL_INSTALL_LOCK_AS_BOUNDED_VERIFIED_NOT_SHAPE_OR_ASSEMBLY_ACCEPTANCE`

The exact local install is fresh, duplicate-free and fail-closed for stale inner runtime bytes. This is not shape acceptance, whole-assembly acceptance or production readiness.

The following remain outside the accepted scope:

- source residual is still ISSUE; no exact 1:1 claim
- no G1 claim across the return fold
- reverse lip, rear flange, full lower channel, front/rear closures, eave and roof inner lining remain incomplete/unknown
- static source `t0` only
- the pane-order real-GL production-path split remains HOLD
- browser, hardware GPU, mobile, publication, visual, production and user acceptance are untested

## Regression and lifecycle

No new regression. `CANDIDATE_EXECUTABLE_RESOURCE_CLOSURE_001` receives this exact-subject positive control.

- POSTED: true — #91 comment `6586833224`
- ACKNOWLEDGED: false
- IMPLEMENTED: existing package lock + verifier-only mutation; production false
- GATE-RUN: true
- ADOPTED: false
- USER-ACCEPTED: false

No main, production Mother, private package, current authority, R2 OS, global gate or schedule was modified.
