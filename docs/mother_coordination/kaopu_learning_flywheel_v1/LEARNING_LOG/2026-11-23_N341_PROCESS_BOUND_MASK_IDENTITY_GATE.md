# KAOPU Learning Flywheel N341 — process-bound mask identity gate

## One bounded question

Can a verifier reject N340's decoy seed diversity by binding each weathering process to both its actual mask-construction digest and an independently observed single-layer mask digest, without rejecting explicitly authorized causal sharing?

## Starting failure

N340 proved that N339 falsely accepted four unrelated processes using the same generic mask because N339 only counted distinct seed literals across the whole source. The pinned teacher-source observation remains valid, but the proposed KAOPU alias gate was not executable.

Audited failure:

- N339 head: `ae2d8494c5bc4f525c1b48ae82b8c6395b00507a`
- N340 head: `99b30d385c9d8cb6e00d927bed7aa7ecb775f998`
- N340 expected: `HOLD_CROSS_PROCESS_MASK_ALIASING`
- N340 actual: `PASS_STATIC_SOURCE_AUDITION`
- N340 result: `FALSE_ACCEPT=true`

## Candidate correction

The Candidate separates three authorities:

1. an out-of-band trusted Anchor digest owns the exact expected process inventory and allowed alias relationships;
2. the Producer receipt identifies only the produced `sourceHead`, `artifactDigest` and Producer identity;
3. an independent observation, bound to that exact subject and a trusted verifier policy, reports each process's actual constructor descriptor and single-layer mask digest.

For each `processId`, `maskConstructionDigest` covers:

- generator identity;
- seed derivation and domain;
- scale and octave parameters;
- geometry inputs;
- post-transform identity.

The gate rejects:

- identical construction digests across unrelated processes;
- different declared constructors that collapse to the same observed mask digest;
- missing, duplicate or unanchored processes;
- observation from another source/artifact;
- Producer self-verification;
- untrusted verifier policy;
- a Producer-shrunk Anchor that does not match the verifier's out-of-band trusted digest.

Legitimate sharing is not inferred from matching values. It is allowed only when the authority-owned Anchor explicitly lists the exact process pair. Sharing one process mask across that process's own declared channels remains legal and does not create multiple process records.

## Minimal falsifiable replay

10/10 synthetic fixture suites passed:

1. valid distinct process bindings;
2. N340 decoy seed diversity with one actual generic mask;
3. different constructors collapse to the same observed mask;
4. missing expected process;
5. unanchored process;
6. observation from another artifact;
7. Producer self-verification;
8. untrusted verifier policy;
9. Producer-shrunk Anchor without the trusted digest;
10. one authority-explicit causal alias.

Probe SHA-256: `65739c2ed719b9a1b6d45302182d4249de7b9d898ffeced7f6bc5c904c090a2b`.

Result SHA-256: `876455558450e5333b23b8aeecc45869f6972a2667e677c14ce1bde40f62da24`.

## Limits and decision

Decision: `CANDIDATE_N341_PROCESS_BOUND_MASK_IDENTITY_SYNTHETIC_PASS`.

- N340 false accept remains preserved as regression history;
- this does not run or modify a Material/Mechanical production asset;
- extraction of constructor descriptors from KAOPU's real shader/function graph is `NOT_IMPLEMENTED`;
- the production authority resolver and trust root are `UNKNOWN`;
- no production threshold is introduced;
- no main, R2 OS, production branch, Canonical Truth or user acceptance state changes.

Lifecycle after routing: `POSTED=true / IMPLEMENTED(candidate)=true / GATE-RUN(synthetic)=true`; `ACKNOWLEDGED / IMPLEMENTED(production) / ADOPTED / USER-ACCEPTED=false`. Issue #91 comment: `7106053675`.

