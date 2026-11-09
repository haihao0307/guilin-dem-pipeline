# N261 — Car R136 declared-input sandbox audition

## One bounded question

How can the Car/Motor verifier prove ESM, Python, and shader tooling actually consume only one declared content-addressed input root, rather than merely recording a manifest that source resolvers bypass?

## Existing real failure

Issue #91 reports a second same-cause failure in R136: package hashes and representation checks pass, but both independent review paths fail because static imports still resolve through `/workspace/shared`. The existing regression `RUN-SUCCESS-NOT-RERUN-REPRODUCIBILITY-001` therefore receives new evidence; no duplicate case is created.

## Teacher audition

Teacher: `bazelbuild/bazel` sandboxing. Status: `TEACHER_CANDIDATE`. Lifecycle: `AUDITION`.

What it knows beyond the N256 Current Best View is narrow and explicit: an input-root digest identifies declared inputs, but does not itself restrict file access. A meaningful verifier must combine the declared closure with per-action filesystem isolation and must fail when the requested sandbox cannot run. Bazel's own boundary is important: a symlink-forest/process-wrapper sandbox does not hide host files from known absolute paths, while stronger Linux namespace isolation can be selected explicitly instead of allowing an unnoticed fallback.

Primary sources:

- <https://github.com/bazelbuild/bazel/blob/master/site/en/docs/sandboxing.md>
- <https://github.com/bazelbuild/bazel/blob/master/src/main/tools/linux-sandbox.cc>
- <https://github.com/bazelbuild/bazel/blob/master/src/test/shell/integration/sandboxing_test.sh>
- <https://github.com/bazelbuild/remote-apis/blob/main/build/bazel/remote/execution/v2/remote_execution.proto>

This is not a proposal to adopt Bazel wholesale.

## Minimal replay

The synthetic replay uses one manifest and three consumers: Node ESM, Python, and a shader-like file tool.

- Positive declared reads: pass for all three consumers.
- Missing manifest file: rejected.
- One changed declared byte: rejected.
- Undeclared absolute reads: all three consumers succeed without isolation.
- Static ESM import of an undeclared absolute module: succeeds without isolation.
- Enforcement-capability probes: bubblewrap, user/mount namespaces, ptrace/strace, chroot, and Landlock are unavailable in this runner.

Decision: `BLOCKED_VALID_NO_SANDBOX_FALLBACK`. The replay stops rather than substituting an ordinary local run and pretending that the closure was enforced.

## Candidate translation

For one Car/Motor trial only, the Task Anchor would need `inputRootDigest`, `packageRelativeEntryPoint`, `sandboxStrategy`, `sandboxFallbackPolicy=DENY`, and `declaredTaskDataRoots`. The Delivery Receipt would need the resolved digest, actual executed entrypoint, effective sandbox strategy/capability result, and the six negative-control outcomes.

The gate must reject an injected static ESM absolute import, Python or shader-tool access outside the declared data roots, missing input, changed byte, and sandbox unavailability.

## Boundary and lifecycle

No production Mother, R2 OS, global gate, or real R136 archive was changed or executed. No GPU claim was made. Current lifecycle is `NOT_POSTED`; `ACKNOWLEDGED`, `IMPLEMENTED`, `GATE-RUN`, `ADOPTED`, and `USER-ACCEPTED` are all false.
