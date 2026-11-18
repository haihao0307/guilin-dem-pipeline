# N312 — Execution-context self-attestation bypass

## One bounded question

Can a Producer claim the anchored execution context while the independently observed runtime context differs?

## Fresh baseline

- `main@ad7b81175df8bc9c54cf40effe1029f86696ba76`
- root `AGENTS.md` blob `251b664646a489e9292748f1d41998ee62a338f5`
- R2 OS blob `d942d44bad0bbd206ea3768d620ad60d5ddeb2bf`
- no-creative-substitute gate blob `8c0a49c71865ef76cbc614f8188239bc808a8278`
- no-stale-delivery gate blob `4754a90a94e4a9e7806357b6eb292e5c713e9021`
- #91 read through N311; #63 remains unchanged since 2026-09-30.
- applicable regressions reread: `MOTHER-NO-METHOD-INVENTION-001`, `MOTHER-NO-THINKING-STALL-R3-001`, `TERRAIN-NO-STALE-DELIVERY-001`, N307 and N311.

## Real failure

N311 correctly makes a bounded execution-context profile part of closure identity, but its `contextDescriptor()` receives an ordinary caller-provided object. It does not know whether the values were independently observed, copied from the expected anchor, or taken from a different build.

The fresh replay used:

- anchored and Producer-claimed context: Chromium with `--use-angle=swiftshader`, observed route `webgl2-swiftshader`;
- actual independent observation: no SwiftShader argument, observed route `webgl1-hardware`.

Producer claim digest:

`sha256:a4012b1c40667b962356858b8dbcdb95635e5eb0604ce32114627b3c652d7a65`

Independent observation digest:

`sha256:6011d555ee13266576c4e05e4b0bd12daaaa4643f60e1b1a6de2bca7dfc54f04`

N311 nevertheless returned `DEPENDENCY_CLOSURE_VERIFIED` because it inspected only the Producer claim.

## Minimal correction

Bind an independent observation record to the exact `anchorId + subjectDigest`. Preserve observer identity, observation method, selected profile digest, observed context digest, missing fields, and raw-evidence digest. Compare expectation, Producer claim, and independent observation. Producer cannot serve as its own observer.

Fresh probe results:

- false Producer claim → `HOLD_CONTEXT_SELF_REPORT_CONFLICT`
- matching independent observation → `DEPENDENCY_CLOSURE_VERIFIED`
- missing observation → `HOLD_INDEPENDENT_CONTEXT_OBSERVATION_MISSING`
- Producer self-attestation → `HOLD_PRODUCER_SELF_ATTESTATION`
- observation from another subject → `HOLD_CONTEXT_OBSERVATION_SUBJECT_MISMATCH`

## Teacher decision

`NO_NOVELTY`. N307 and its W3C/WPT method teacher already established independent browser observation and conflict handling. N312 exposes a missing transfer from N307 into N311 rather than adding another teacher.

## Boundaries

- Independent identity does not prove an uncompromised observer.
- Evidence digest binds retained evidence but does not prove its truth.
- Unobservable fields remain `UNKNOWN` or `HOLD`.
- Secrets/private device identifiers stay out of receipts.
- Browser, physical-device, production, and user-acceptance layers remain separate.
- No production Mother, main, R2 OS, adapter registry, or public KaoPuGram service changes.

Learning branch status: `HOLD_GATE_FAIL`, Candidate regression `CANDIDATE_INACTIVE`, `GATE-RUN=true`.

Routing before post: `POSTED=false`, `ACKNOWLEDGED=false`, production `IMPLEMENTED=false`, `ADOPTED=false`, `USER-ACCEPTED=false`. KPI values remain `UNKNOWN`.
