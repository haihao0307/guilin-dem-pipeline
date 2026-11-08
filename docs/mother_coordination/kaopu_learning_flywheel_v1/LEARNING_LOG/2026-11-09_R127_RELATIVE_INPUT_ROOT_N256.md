# KAOPU Learning Flywheel N256 — R127 relative input-root audition

Date: 2026-11-09 (Asia/Shanghai)  
Status: Candidate audition; not adopted  
Bounded question: **Can a content-addressed mount map alone make the R127 verifier portable when its JavaScript modules contain static host-absolute imports?**

## Required baseline read

- Coordinator `main`: `6a003f0fafb9ae27d71e95963728461288c14edb`
- root `AGENTS.md`: blob `251b664646a489e9292748f1d41998ee62a338f5`
- R2 OS: blob `d942d44bad0bbd206ea3768d620ad60d5ddeb2bf`
- no-creative-substitute gate: blob `8c0a49c71865ef76cbc614f8188239bc808a8278`
- freshness gate: blob `4754a90a94e4a9e7806357b6eb292e5c713e9021`
- #91 latest real production feedback: N255 comment `6725399330`
- #63: no production feedback after N49
- applicable regression: `RUN-SUCCESS-NOT-RERUN-REPRODUCIBILITY-001`, blob `c27b3bfd780687c2baab2e48f55394cbdefc0453`; this run extends that Candidate for one Car recurrence rather than creating a synonym

## Existing failure and Current Best View

N255 already proved that `CAR_RECOVERY_R127_SOURCE_PROFILES_PRIVATE_DELTA.zip` passes its root hashes but its supplied `verify-seal.mjs` and `run-all.sh` fail outside the old shared workspace. The archive is bound to SHA-256 `59c6dd88d0e57b2cd03a3314c93257e58cb6446ecb5c669a50deb7bee51af585`; R127 remains frozen, inactive and unaccepted.

The existing Candidate knows that a historical success does not prove rerun closure and already asks for runtime/dependency/toolchain identities. N255 adds the Car recurrence and proposes a package-relative content-addressed manifest or explicit mount map. The unresolved point is whether a map alone is sufficient.

Fresh inspection of the exact archive found:

- 29 absolute external inputs in `INPUTS_SHA256.json`;
- 55 `/workspace/shared/...` literal occurrences across 9 independent-review files;
- 6 executable `.mjs`/`.sh` files containing those literals;
- direct `node source-audit.mjs` fails during ESM resolution with `ERR_MODULE_NOT_FOUND` before a runtime map could be consulted.

Therefore “add a mountMap” is incomplete unless verifier source consumes that logical namespace through relative paths or a versioned loader.

## Teacher audition: Bazel Remote Execution API

Teacher status: `TEACHER_CANDIDATE`; lifecycle: `AUDITION`.

### Screening

1. **Source/provenance:** official `bazelbuild/remote-apis` repository and canonical `remote_execution.proto`.
2. **Maintenance:** main commit `c2c07e3d718d3d490a4958344d9c3e47de0bfaf3`, pushed 2026-10-20; repository is active and not archived.
3. **Runnable code/tests/data:** protocol schema, generated Go code, Bazel test module and content-defined-chunking/tree test vectors are present.
4. **License/rights:** Apache-2.0.
5. **Direct relevance:** an Action binds a Command and content-addressed input-root Directory; the worker makes that tree available at the correct locations before execution; the working directory is relative to the input root.
6. **Novelty over Current Best View:** current KAOPU Candidate inventories toolchains but does not bind input namespace, command and relative working directory into one action identity.
7. **Dependency/hardware/cost:** a remote execution service would be disproportionate. Only the schema is transferred to one local Car verifier trial.
8. **Failure boundary:** REAPI leaves default environment/filesystem details to implementations and can permit absolute command paths or absolute symlinks. It does not automatically rewrite JavaScript imports or prove sandbox hermeticity.

Specific teacher answer: **REAPI knows more than the current KAOPU Current Best View about one bounded question: rerun identity must include not only input digests, but the logical input tree, the command that consumes it and the working directory relative to that tree.**

Primary sources:

- https://github.com/bazelbuild/remote-apis/blob/main/build/bazel/remote/execution/v2/remote_execution.proto
- https://github.com/bazelbuild/remote-apis/blob/main/build/bazel/remote/execution/v2/platform.md
- https://github.com/bazelbuild/remote-apis/tree/main/test
- https://github.com/bazelbuild/remote-apis/blob/main/LICENSE

## Falsifiable hypothesis and replay

Hypothesis: exact caller-supplied bytes pass a content-addressed logical map; missing or changed bytes fail closed. A consumer using paths relative to the input root runs in a new directory. A static host-absolute ESM import still fails even when an exact mapping exists, because the source never consumes the map.

CPU replay on Node `v24.22.1`:

1. exact logical-path + digest mapping passes;
2. missing mapping fails closed;
3. changed bytes fail digest verification;
4. relative input-root import executes and returns the expected result;
5. an absolute import fixture fails despite the exact map;
6. the real R127 archive contains host-absolute literals;
7. the real R127 `source-audit.mjs` fails during absolute ESM resolution.

Result: **7/7 PASS**.

## Candidate increment

Update the existing rerun regression with:

```text
logicalInputRootDigest
callerSuppliedInputManifest
mountMapDigest
sourcePathBindingMode
absolutePathLiteralSet
loaderIdentityOrUnknown
workingDirectoryRelativeToInputRoot
commandDigest
platformIdentity
newRunReceiptDigest
```

Decision semantics:

- any host-absolute literal in executable verifier source → `HOLD_HOST_ABSOLUTE_PATH_LITERAL`
- exact map exists but source does not consume it → `HOLD_MOUNT_MAP_NOT_CONSUMED_BY_SOURCE`
- missing caller input → `HOLD_REQUIRED_INPUT_MISSING`
- wrong content → `HOLD_INPUT_DIGEST_MISMATCH`
- clean relative root + exact digests + bound runtime/loader → `RERUN_INPUT_NAMESPACE_CANDIDATE`, not yet full rerun closure

## Minimal single-Mother trial and boundaries

Only Car R127 packaging owner should rewrite one entrypoint to consume a package-relative logical input root, or bind an explicit versioned loader. The independent verifier then runs in an empty directory with four controls: exact inputs pass; R126 missing, one source byte changed and Naga changed each fail closed.

- Do not add a remote execution service.
- Do not modify Car geometry, source profiles, production activation or accepted baseline.
- No GPU/browser/visual/publication evidence is claimed.
- Preserve restricted-asset policy: caller supplies bytes; receipt records digest and logical identity, not redistribution permission.
- Routing receipt: pending.
- Lifecycle before routing: `IMPLEMENTED(candidate)=true`, `GATE-RUN=true`; `POSTED/ACKNOWLEDGED/production IMPLEMENTED/ADOPTED/USER-ACCEPTED=false`.
