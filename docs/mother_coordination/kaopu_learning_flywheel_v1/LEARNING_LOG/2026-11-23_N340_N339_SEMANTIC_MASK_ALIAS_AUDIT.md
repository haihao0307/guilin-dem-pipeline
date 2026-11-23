# KAOPU Learning Flywheel N340 — N339 semantic mask-alias adversarial audit

## One bounded question

Can N339 reject four unrelated weathering processes that use different labels and leave several distinct seed literals in the source, but actually derive their working masks from the same generic noise construction?

## Why this is the current highest-value question

N339 was posted to Material Mother but has no real acknowledgement or production replay. Adding another teacher would expand theory before the proposed verifier is known to reject its own named failure. The highest-value action is therefore an independent adversarial review of the existing Candidate.

## Audited subject

- N339 branch: `automation/n339-layer-channel-ownership-20261123`
- N339 head: `ae2d8494c5bc4f525c1b48ae82b8c6395b00507a`
- N339 probe blob: `a6e1f9727c93a899418979bef17cdc0d9863ee22`
- teacher commit: `TheJanusStream/symbios-texture@0a873d279c5535723d4dad9160816f0682fe6524`
- teacher source SHA-256: `98a11f08040934122c9894bc35e1d9ddffaf141a3da6cc65b56de5a99baa9291`

The pinned teacher source audit remains a valid observation about that exact source. This review tests whether N339's executable evidence is sufficient to support the proposed KAOPU cross-process alias gate.

## Independent counterexample

The adversarial harness changes the four process implementations so that edge wear, corrosion, crevice dirt and runoff all derive their working mask from the exact same expression:

`noise_grid(w, h, cfg.seed.wrapping_add(0xABCD), 4.0, 2)`

It deliberately leaves at least five distinct `wrapping_add(...)` literals elsewhere in executable source and tests/helpers. All evidence currently checked by N339 remains present:

- layer call order;
- per-function channel assignment syntax;
- all four no-op amount fields;
- the five required test names;
- at least five distinct seed literals across the whole file.

Expected: `HOLD_CROSS_PROCESS_MASK_ALIASING`.

Actual: `PASS_STATIC_SOURCE_AUDITION`.

Result: `FALSE_ACCEPT=true`.

Harness SHA-256: `3c21d2f2a369e767d31489827950e3af463ecca2034cec171993f187c0fab67f`.

## Root cause

N339 proves that several seed literals exist somewhere in the file; it does not prove which mask constructor each declared process actually invokes. A Producer can therefore keep decoy diversity while all processes consume the same semantic mask. The proposed `crossProcessMaskAliases` receipt field is also self-reported and has no independent observation rule yet.

The missing evidence is process-bound mask identity, not a larger seed count.

## Bounded correction allowed

Do not add another shader rule or teacher. The next Candidate may only:

1. bind each `processId` to a canonical `maskConstructionDigest` covering generator identity, seed derivation, scale/octaves and geometry inputs;
2. have an independent verifier derive this mapping from the exact tested source/artifact, not trust a Producer list;
3. run one-layer observations and record an `observedMaskDigest` or sampled mask digest for each process;
4. reject exact construction aliasing across unrelated processes unless an authority-owned `allowedProcessMaskAlias` explicitly declares a causal relationship;
5. include this counterexample as a negative regression.

Distinct output digests alone are insufficient because later process-specific transforms or channel writes can make identical source masks look different.

## Decision and limits

Decision: `HOLD_GATE_FAIL_N339_SEED_LITERAL_DIVERSITY_IS_NOT_PROCESS_MASK_IDENTITY`.

- N339 teacher source observation: retained
- N339 Candidate gate: not valid for promotion
- production Material Mother replay: `NOT_RUN`
- `POSTED=true`: issue #91 comment `7100096036`
- teacher status: remains `TEACHER_CANDIDATE / AUDITION`
- `ACKNOWLEDGED / IMPLEMENTED / ADOPTED / USER-ACCEPTED=false`
- no main, R2 OS, production branch, Canonical Truth or threshold change

