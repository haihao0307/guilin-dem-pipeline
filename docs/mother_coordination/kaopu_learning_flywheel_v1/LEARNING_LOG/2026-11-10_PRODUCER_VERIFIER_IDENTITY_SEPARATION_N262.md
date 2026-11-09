# N262 — Producer/verifier identity separation audition

## One bounded question

Can an `independent-review` receipt prove that an authorized verifier distinct from the Producer reviewed the exact same subject and exact Producer attestation?

## Existing failure and Current Best View

Car R136 contains `evidence/independent-review` entrypoints, but the exact package has no Task Anchor or Delivery Receipt and records no Producer identity, verifier identity, signed role authorization, or verifier binding to the exact Producer statement. This does **not** prove self-approval occurred; independence is `UNKNOWN`.

R2 already says Producer cannot approve itself. The uncovered mechanism is that role labels and receipt fields remain self-declared unless an independent identity and signature check makes them executable.

## Teacher audition

`in-toto` layout plus signed link metadata is `TEACHER_CANDIDATE / AUDITION` for one narrow principle: a project owner signs a layout that authorizes functionary keys for named steps; each functionary signs link metadata over the materials and products of its step; verification checks authorized actors and chains artifacts between steps.

Primary sources:

- <https://github.com/in-toto/specification/blob/master/in-toto-spec.md>
- <https://in-toto.io/docs/getting-started/>
- <https://github.com/in-toto/in-toto/blob/develop/doc/source/layout-creation-example.md>
- <https://github.com/in-toto/in-toto/tree/develop/tests>

Exact novelty over KAOPU Current Best View: R2 has the separation rule, while in-toto contributes a machine-verifiable role authorization and signed artifact-chain structure. KAOPU additionally needs an explicit `producerVerifierIdentityMustBeDistinct` constraint because a generic layout can authorize the same key for multiple steps.

The implementation is maintained, released as v3.1.0 on 2026-05-04, has public verification tests, and uses Apache-2.0. Adoption of the Python framework is not proposed; only the bounded receipt semantics are auditioned.

## Minimal replay

The Node/Ed25519 replay generated a coordinator identity, Producer identity, verifier identity and attacker identity. A coordinator-signed layout binds the R136 archive digest to authorized, distinct roles. Six cases passed:

1. valid distinct chain → `PASS_ROLE_SEPARATED_ATTESTATION_CHAIN`;
2. same key authorized for Producer and verifier → `HOLD_ROLE_IDENTITY_NOT_DISTINCT`;
3. role key changed after layout signature → `HOLD_LAYOUT_SIGNATURE_INVALID`;
4. verifier signs a different subject → `HOLD_SUBJECT_IDENTITY_MISMATCH`;
5. Producer statement changes after signature → `HOLD_PRODUCER_ATTESTATION_INVALID`;
6. old verifier receipt is attached to a replacement Producer envelope → `HOLD_REVIEW_CHAIN_MISMATCH`.

## Candidate translation and boundary

A single Car/Motor trial would add a coordinator-signed layout digest, role-specific authorized identity sets, distinct-role constraint, exact subject digest, both attestation digests/signers, and the verifier's `reviewedProducerAttestationDigest`.

This proves credential separation and integrity only. One person may control both keys; identity issuance, custody and revocation remain required. It does not prove verifier competence, correct technical judgment, GPU/browser execution or user acceptance.

No production Mother, R2 OS, global gate or R136 archive was changed. The targeted routing receipt is [issue #91 comment 6754541769](https://github.com/haihao0307/guilin-dem-pipeline/issues/91#issuecomment-6754541769). Current state: candidate probe `IMPLEMENTED / GATE-RUN`; routing `POSTED`; `ACKNOWLEDGED / ADOPTED / USER-ACCEPTED=false`.
