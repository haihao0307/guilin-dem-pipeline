# KAOPU Learning Flywheel N233 — A4 Side A local stale-geometry lock

Date: 2026-11-02 (Asia/Shanghai)  
Status: **Candidate validation / exact-subject GATE-RUN / not adopted**

## One bounded question

Does the new Side A member in `A4_ORIGINAL_SIDE_A_AND_LOCAL_ASSEMBLY_R01.zip` fail closed on stale or mutated shader bytes before GLES compilation and rendering?

## Required baseline read

Current `main` was re-read before the probe:

- root `AGENTS.md`: `251b664646a489e9292748f1d41998ee62a338f5`
- R2 OS: `d942d44bad0bbd206ea3768d620ad60d5ddeb2bf`
- reference-replication gate: `8c0a49c71865ef76cbc614f8188239bc808a8278`
- freshness gate: `4754a90a94e4a9e7806357b6eb292e5c713e9021`

Latest #91 feedback was N232 comment `6576312725`; there was no later Mother acknowledgement. #63 had no newer applicable production feedback. Existing `CANDIDATE_EXECUTABLE_RESOURCE_CLOSURE_001` was selected for a positive control; no duplicate case was created.

## Exact subject

- Library identity: `libfile_10e7de6eba648191bd4a4b1ff3dafcf4`
- created/modified: `2026-11-02T15:26:38.589715Z`
- ZIP SHA-256: `bce05df647390edcfceb38f521b9353c5d6f10b68cd537080693610203ca1cc7`
- bytes: `942,076`
- archive entries: `167`
- manifest entries: `166`
- prior frozen Roof R02: `libfile_fa1f8dd64a8c81919ba3807c9f4ecb50`, archive SHA `d853b4c49efb19a0f148e94b3d1c4f1fb47de4d481b81fcd8078e5012e67c804`

Pristine package integrity: **166/166, 0 mismatch**.

## Why this is not a creative substitute

The package retains the original-source observation roots and does not use the rejected old function baseline. Side A is explicitly bounded to the positive-X upper two-window web:

- separate outer and inner skins;
- two real, non-identical window apertures and observed returns;
- measured profile laws and retained residuals;
- exact original source coordinate frame, component center, train-relative offset, axes, parent and Time reference;
- no source triangles or textures in native execution;
- no invented lower/front/inner-roof fill or perimeter caps.

It explicitly keeps lower wall, forward third-window turn, eave, inner lining, frames and glass incomplete. Manufactured part count and physical scale remain UNKNOWN.

## Positive control

Side native replay:

- `PASS_NATIVE_BOUNDED_A_WEB`
- 34 roles / 584 jets
- maximum D1 error `5.706861879315834e-10`
- minimum Jacobian `0.00013871823833494214`
- shared-port C0 error 0
- 4 aperture centers correctly rejected

Parameter consumption: **4/4 controlled effects**.

Local container checks:

- camera math: **750/750**
- Node UI protocol: normal, no-GPU, stale-roof-shader and stale-side-shader cases all PASS
- browser used: false

Fresh actual Mesa GLES 3.2 replay:

- native scene triangles: 0
- source geometry/textures used: false
- rejected baseline used: false
- full Roof + Side A: `73294942f28ff9e84d2a18369b43261ecd61c8a502c1babb25be897329787795`
- Roof only: `5943153eb1c6a5800bb1e2c89d1ff78a598f2c5d7d8eb3620a0458a3520a99a1`
- Side A only: `a791c2320d4fdb537fe280e6e14d097d286551aa08f9632b45edb5ac946b0f67`

All three RGBA buffers are byte-identical to the archive.

## Exact negative control

Only a verifier copy was changed. The Library archive and private package were not modified.

Mutation:

```text
original-function-assembly-r01/side-a-r01.frag
append one no-op comment
```

- expected SHA-256: `0ed0a985f2bad3842748f508431c5fdd0fc3333fc9d6c054cf8ad2b015a06168`
- mutated SHA-256: `294c220bc7f668f8c49c972e5dbe360302d7d7f771095f0b3b05589fe1351141`
- bytes: `35,701 -> 35,798`

`python3 render-current-assembly.py` exited 1 at the geometry-hash assertion, before program creation, shader compilation or draw. This is a real local renderer negative control, not only the fake-DOM test.

## Decision

`ACCEPT_A4_SIDE_A_LOCAL_GEOMETRY_LOCK_AS_BOUNDED_STALE_SHADER_FAIL_CLOSED_NOT_ASSEMBLY_ACCEPTANCE`

The local two-member container consumes exact locked Roof R02 and Side A shader bytes, and rejects a stale Side A revision before rendering. This is a bounded positive verification of freshness/resource identity.

It is not acceptance of the visible assembly, full cab side, external weld/interface, whole train or production route.

## Declared partial-recovery boundary

The archive honestly declares partial recovery. Native side functions, display shaders, local camera/UI tests and local GLES render are replayable from packaged bytes.

Full canonical historical replay and source re-observation are explicitly excluded. The separate roof archive and shared mechanical canonical/core dependencies must be mapped before that broader replay. The observed `build-canonical.mjs` failure on absent `/workspace/shared/mother-system-r01/sources.mjs` therefore does not contradict the package's bounded claim and is not promoted as a new defect.

## Regression and lifecycle

No new regression. `CANDIDATE_EXECUTABLE_RESOURCE_CLOSURE_001` receives this exact-subject positive control:

- every local geometry member is hash-bound;
- stale bytes are rejected before compile/draw;
- actual untouched output is reproduced;
- declared external prerequisites are not misclassified as hidden standalone dependencies.

- POSTED: false (pending #91 routing)
- ACKNOWLEDGED: false
- IMPLEMENTED: existing package gate + verifier-only mutation; production false
- GATE-RUN: true
- ADOPTED: false
- USER-ACCEPTED: false

No main, production Mother, private package, current authority, R2 OS, global gate, or schedule was modified.
