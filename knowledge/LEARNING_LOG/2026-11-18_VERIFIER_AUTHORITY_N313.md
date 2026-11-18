# N313 — Verifier authority is not an identity string

## One bounded question

Can a Producer bypass N312 by choosing a different `observerIdentity` string and fabricating matching raw evidence?

## Fresh baseline

- `main@ad7b81175df8bc9c54cf40effe1029f86696ba76`
- root `AGENTS.md` blob `251b664646a489e9292748f1d41998ee62a338f5`
- R2 OS blob `d942d44bad0bbd206ea3768d620ad60d5ddeb2bf`
- no-creative-substitute gate blob `8c0a49c71865ef76cbc614f8188239bc808a8278`
- no-stale-delivery gate blob `4754a90a94e4a9e7806357b6eb292e5c713e9021`
- #91 read through N312 comment `6968372109`; #63 remains unchanged since 2026-09-30.
- applicable regressions reread: `MOTHER-NO-METHOD-INVENTION-001`, `MOTHER-NO-THINKING-STALL-R3-001`, `TERRAIN-NO-STALE-DELIVERY-001`, N307, N311, and N312.

## Real failure

N312 checks whether `observation.observerIdentity === receipt.producerIdentity`, binds an observation to `anchorId + subjectDigest`, and requires an observation method plus raw-evidence digest. It does not establish who is authorized to use the Verifier role or authenticate who produced the observation.

The replay changed only the string identity to `verifier/not-the-producer-string`, supplied a fabricated evidence digest, and copied the expected context digest. N312 returned:

`DEPENDENCY_CLOSURE_VERIFIED`

Therefore the failure is not merely a missing signature field. N312 conflates a declared label with authenticated and coordinator-authorized authority.

## External teacher audition

Candidate: in-toto Attestation Framework plus layout-authorized functionaries.

The explicit novelty over KAOPU Current Best View is bounded:

- a Statement binds claims to an exact `subject` and names the predicate schema;
- an envelope authenticates the typed payload with a signature;
- an owner-controlled layout lists the public keys authorized to act as functionaries for a step;
- verification checks the signature and authorization, rather than trusting an actor-name string.

Primary sources:

- https://github.com/in-toto/attestation/blob/main/spec/README.md
- https://github.com/in-toto/attestation/blob/main/spec/v1/README.md
- https://in-toto.io/docs/getting-started/
- https://github.com/in-toto/specification/blob/master/in-toto-spec.md
- https://github.com/in-toto/in-toto/tree/develop/tests

Teacher status: `TEACHER_CANDIDATE`; lifecycle remains `TEACHER_CANDIDATE`; registry state `NOT_ADDED`; Mother query `NOT_QUERIED/UNKNOWN`.

## Eight-part screening

1. **Source/provenance:** official in-toto project website and repositories under the in-toto GitHub organization.
2. **Maintenance:** Attestation Framework v1.2.0 was released 2026-03-18; repository activity was observed through 2026-10-21. The Python reference implementation showed activity through 2026-08-27 and a v3.1.0 release candidate dated 2026-05-04.
3. **Runnable evidence:** specifications, language bindings, Python reference code, tests, DSSE fixtures, and official demos are available.
4. **License/rights:** both audited repositories contain Apache License 2.0; this protocol probe uses no external assets.
5. **Direct relevance:** exact match for N312's unauthenticated observer-label bypass.
6. **Novelty:** KAOPU has subject binding and evidence digests, but lacks an anchored verifier-authority registry and cryptographic origin check.
7. **Integration risk:** no GPU, training data, or commercial service; low computation. Key custody, revocation, rotation, threshold, canonicalization, and library-version management are real costs.
8. **Failure risks:** not demo-only, but a valid signature proves origin/integrity only. It cannot prove evidence truth, organizational independence, or user acceptance.

## Minimal falsifiable trial

The Candidate prototype uses public test-fixture Ed25519 keys and a tiny DSSE-like typed envelope. It does not install or adopt in-toto.

Results:

- unsigned observation → `HOLD_VERIFIER_ATTESTATION_MISSING`
- signed by an unlisted key → `HOLD_UNAUTHORIZED_VERIFIER`
- fake signature relabeled with the authorized keyId → `HOLD_VERIFIER_SIGNATURE_INVALID`
- Producer-signed observation → `HOLD_PRODUCER_SELF_ATTESTATION`
- authorized signature for a different subject → `HOLD_CONTEXT_OBSERVATION_SUBJECT_MISMATCH`
- payload changed after signing → `HOLD_VERIFIER_SIGNATURE_INVALID`
- authorized exact subject/predicate → `DEPENDENCY_CLOSURE_VERIFIED`
- authority-policy digest changed → `HOLD_VERIFIER_AUTHORITY_POLICY_CHANGED`

Probe SHA-256: `29a26cae76510bbe5a5434d2136bf21a5c51f76e3b35d0476acc893e01008d93`.

## Candidate translation

Add a versioned authority-policy digest to the Task Anchor. A verifier attestation must bind:

- exact content subject digest;
- exact predicate type and observation payload;
- signer key ID and signature;
- coordinator-authorized functionary role and allowed predicate types.

Do not accept an identity label as evidence of authority. Do not promote this Candidate until one actual Mother names the independent observer, authority owner, key-custody/rotation/revocation route, and falsifying replay.

## Boundaries

- Fixture keys are deliberately public and unusable as production trust roots.
- Signatures prove origin and integrity, not that the observation is true.
- A Producer-controlled verifier process can still be organizationally non-independent even with another key.
- The full in-toto supply-chain ontology and runtime are not adopted.
- Browser evidence remains separate from device, production, and user-acceptance evidence.
- No production Mother, main, R2 OS, adapter registry, or public KaoPuGram service changes.

Learning branch status: `HOLD_GATE_FAIL`, Candidate regression `CANDIDATE_INACTIVE`, `GATE-RUN=true`.

Routing: targeted `POSTED=true` to #91 as comment `6972552281`; `ACKNOWLEDGED=false`, production `IMPLEMENTED=false`, `ADOPTED=false`, `USER-ACCEPTED=false`. KPI values remain `UNKNOWN`.
