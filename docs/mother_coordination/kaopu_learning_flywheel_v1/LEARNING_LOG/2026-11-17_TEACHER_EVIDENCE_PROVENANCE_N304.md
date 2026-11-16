# N304 — Teacher Evidence Provenance Receipt

## One bounded question

How can KAOPU prove that a later teacher audition still refers to the exact artifact and source revision originally evaluated when its filename, URL, Library file ID, branch, or release tag can remain the same while the bytes or lineage change?

## Current Best View and real failure link

R2 already requires source/build identity for production candidates, freshness proof, exact base/head evidence, and no silent fallback. Teacher screening already asks for source/provenance, license, activity, reproducibility, and direct relevance. Recent auditions also manually pinned exact source commits and artifact hashes.

The remaining gap is narrower: teacher evidence did not yet have one normalized receipt that separates a mutable locator from immutable subject identity, binds source/input revisions to that subject, records who claimed to produce the receipt, and states whether that claim was independently verified.

The immediate evidence is not hypothetical. StrykerJS release `v10.1.1` explicitly re-released `v10.1.0` after a release-process provenance problem. Separately, KAOPU Library artifacts can legitimately receive later edits under the same human-facing filename or file identity. Neither a project name, URL, tag, nor file ID proves audition identity.

## One external method audited

Teacher: **SLSA Build Provenance v1.2**, approved specification.

Pinned source:

- material: SLSA Build Provenance
- version: 1.2
- source: <https://slsa.dev/spec/v1.2/build-provenance>
- repository branch: `slsa-framework/slsa@releases/v1.2`
- exact commit: `ae7fc76215004e8fae250c877eff8919bf048e3b`

This attribution is retained under the repository's Community Specification License 1.0. The license file carries `SPDX-License-Identifier: CC-BY-4.0` and requires specification derivatives to include the material name, version, and source.

### Screening

1. **Source/provenance** — official approved v1.2 specification and exact release-branch commit.
2. **Maintenance** — public main remained active through 2026-11-16; v1.2 branch exists as the approved release line.
3. **Runnable evidence** — CUE/protobuf schemas, lint script, and GitHub Actions lint workflow; no dataset is needed for this method.
4. **License/rights** — Community Specification License 1.0 with attribution boundary; Candidate records full attribution.
5. **Direct relevance** — directly addresses stale or silently replaced teacher evidence.
6. **Novelty** — normalizes subject, dependency revision, builder/run, and attestation trust tier in one receipt instead of scattering a URL, hash, and commit across prose.
7. **Cost/risk** — hashing and JSON receipt are cheap; cryptographic verification adds signer/trust-policy work.
8. **Failure boundary** — the format does not prove scientific correctness, teacher quality, or builder trust by itself. No training-data claim or commercial closed dependency is involved.

### What it knows beyond KAOPU Current Best View

For this bounded question, SLSA knows a precise separation between:

- `subject`: which exact output artifact is claimed;
- `resolvedDependencies`: which exact source/input revisions were used;
- `buildDefinition`: which declared operation produced the subject;
- `builder.id` and `runDetails`: which platform/run made the claim;
- attestation verification: whether a consumer verified the statement instead of merely reading it.

KAOPU already used individual hashes and commits, but did not yet have this normalized teacher-audition binding and explicit trust tier.

## Candidate adaptation

Create a **Teacher Evidence Provenance Receipt** with four hard rules:

1. Filename, URL, file ID, branch, release tag, and marketing version are locator fields only.
2. Teacher identity requires `subject.digest.sha256` plus size/media type.
3. Source lineage requires immutable dependency digests such as Git commit or source archive SHA-256.
4. Attestation trust is explicit:
   - `SELF_ASSERTED`: KAOPU produced the receipt and hashes, but did not verify a trusted signature/signer-builder pair;
   - `VERIFIED_ATTESTATION`: signature, timestamp, subject digest, and allowlisted signer-builder pair were independently verified with evidence;
   - `UNKNOWN`: identity or verification evidence is incomplete.

Mismatch semantics:

- changed subject bytes under same locator → `REJECT_SUBJECT_MISMATCH`;
- same bytes but changed claimed source revision → `HOLD_SOURCE_LINEAGE_MISMATCH`;
- missing digest, dependency, license, builder/run, or trust evidence → `HOLD_PROVENANCE_INCOMPLETE`.

A changed subject digest starts a new radar/audition item. It cannot inherit an older item's acknowledgement, probation, active-teacher, adoption, or user-acceptance state.

## Minimal falsifiable replay

The probe created one original teacher package and a different byte payload under exactly the same name, URI, and release tag.

- The locator-only gate accepted both.
- The subject SHA-256 accepted the original and rejected the replacement.
- With original bytes but a different claimed source commit, content identity remained true while lineage entered HOLD.
- `builder.id` and `invocationId` were present but unsigned; the receipt therefore remains `SELF_ASSERTED`, not verified provenance.

Result: `SUPPORTED` for this bounded hypothesis.

## Boundary and next step

This is `TEACHER_CANDIDATE / AUDITION`, not a global gate and not a production change. The next valid step is a single receiving Mother replay on one real teacher artifact, preserving a rollback point. No receiving Mother is considered queried, acknowledging, implementing, or adopting until it returns an actual receipt.

KPI remains `UNKNOWN`.
