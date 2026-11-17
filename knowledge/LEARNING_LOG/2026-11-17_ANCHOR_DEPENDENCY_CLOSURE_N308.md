# KAOPU Learning Flywheel N308 — Anchor Dependency Closure

## One bounded question

Can a component anchor remain valid when the component payload bytes are unchanged but a semantic dependency changes?

## Why this is not a duplicate

- R2 remains the Current Best View for whole-commit Golden Baselines.
- N305 tested a protected component payload while unrelated sibling components advance.
- N306 tested a universal envelope and deliberately left dependency enumeration to versioned workbench adapters.
- N290–N294 tested whether one archive contains the files needed to replay one mirror gate.
- N308 tests a different failure: the anchored component bytes stay identical while a material, solver, measurement, topology contract, or canonicalization adapter that defines its meaning changes.

No new regression case is created because this is an unresolved protocol gap, not a newly observed user correction.

## Teacher audition

Teacher: Bazel Remote Execution API, scoped only to Action identity and Merkle input trees.

What it knows beyond KAOPU Current Best View: reusable identity is not merely the output bytes. An Action binds a Command digest and an input-root digest; the input tree recursively binds referenced content. This gives KAOPU a transferable principle for hashing a bounded declared dependency set without treating unrelated workbench state as part of the component.

Teacher status: `TEACHER_CANDIDATE / AUDITION`.

The repository is official, public, unarchived, Apache-2.0, active in November 2026, and includes protobuf definitions, Bazel build files, CI generation checks, and deterministic digest test vectors. It is not being adopted as a build system dependency.

## Falsifiable replay

Subject: one Garment pattern-piece payload, one heavy-coat material profile, one seam contract, and a versioned canonicalization adapter.

1. Change only unrelated Weather workbench state: `DEPENDENCY_CLOSURE_VERIFIED`.
2. Keep the pattern payload byte-identical but change the heavy-coat material profile: `HOLD_DEPENDENCY_DIGEST_CHANGED`.
3. Observe an undeclared runtime material override: `HOLD_UNDECLARED_DEPENDENCY`.
4. Change the adapter/canonicalization contract: `HOLD_ADAPTER_VERSION_CHANGED`.

The counterexample is decisive: the component-only digest stays equal across the material change, while the dependency-closure root changes.

## Candidate method

Each component anchor may carry a versioned dependency-closure receipt:

- component descriptor;
- declared input descriptors with semantic roles;
- adapter identity/version/canonicalization-contract digest;
- relevant environment constraints;
- explicit excluded unrelated input IDs;
- closure-root digest;
- fresh observed-input receipt;
- independent verifier identity.

The workbench adapter owns semantic dependency classification. The universal core only normalizes, hashes, compares, and fails closed. A Producer can propose the manifest but cannot self-certify semantic completeness.

## Boundaries

- This is identity evidence, not proof of visual or physical correctness.
- Runtime tracing can reveal reads but cannot decide semantic relevance.
- Dynamic fetches, secrets, devices, browsers, nondeterministic solvers, system libraries, LFS payloads, and generated artifacts need explicit policy or separate receipts.
- The closure must not absorb the entire workbench. Unrelated state is named and excluded.
- No OS/global gate change is proposed. One affected Mother must first run a historical replay or single-Mother trial with rollback.

## Truth status

Learning branch: `GATE-RUN`.

Routing: pending targeted `POSTED` to #91. `ACKNOWLEDGED=false`, `IMPLEMENTED=false`, `ADOPTED=false`, `USER-ACCEPTED=false`. KPI values remain `UNKNOWN`.
