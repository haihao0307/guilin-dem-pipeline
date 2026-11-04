# N243 Candidate — source-rights metadata closure

## Bounded question

Can KAOPU detect the real N242 failure in which the current source page marks an asset `NoAI`, while the downloaded archive only declares `CC-BY-4.0`, without changing R2 globally or treating a website flag as a legal opinion?

## Current Best View gap

R2 and the current mandatory regressions bind production changes to sources and reject unauthorized substitutes. They do not currently define separate machine fields for:

- the license found inside the artifact;
- the license concluded after considering external evidence;
- source-page use restrictions that are not embedded in the archive;
- the intended use against which those restrictions must be checked.

## External method and exact novelty

SPDX 3.0.1 distinguishes `hasDeclaredLicense` (information actually found in the artifact) from `hasConcludedLicense` (the objective conclusion after considering the artifact and other information). Its package model also provides `downloadLocation`, `suppliedBy`, `originatedBy`, `creationInfo`, `externalRef`, and integrity identifiers. This gives KAOPU a standard semantic split it did not have.

SPDX does **not** by itself close N242. The SPDX specification says declared license excludes information obtained only from a website; external information can inform the concluded license. The Sketchfab listing simultaneously shows CC Attribution and `NoAI`, while Sketchfab's own primary-source explanation says NoAI on CC content may not be enforceable outside the platform. Therefore this Candidate does not encode NoAI as a custom `LicenseRef` and makes no legal conclusion. It records it separately as `sourceEvidence.useRestrictions` and fails KAOPU's AI audition closed when the intended use intersects it.

## Minimal historical replay

Run:

```bash
node source_rights_gate.mjs rights_cases.json
```

The replay uses:

1. N241 G3516H as a control: source and archive both say CC-BY-4.0, and the current listing shows no NoAI marker. Expected result: `PASS_RIGHTS_METADATA_CLOSURE`. This does not override the separate no-attribution final-asset rule or the existing teacher rejection.
2. N242 skid steer as the real counterexample: the source page says CC-BY-4.0 plus NoAI, while the archive has only CC-BY-4.0. Intended use includes generative-AI input. Expected result: `REJECTED_RIGHTS_CONFLICT` and explicit reporting of the omitted restrictions.

## Candidate verifier semantics

For external assets entering teacher audition, require a Rights Receipt containing:

- `sourceUri`, `sourceRetrievedAt`, and a digest of the normalized captured source-rights observation;
- artifact SHA-256;
- `declaredLicenseExpression` from the artifact;
- `concludedLicenseExpression` after source review;
- `sourceUseRestrictions` and `embeddedUseRestrictions` as separate sets;
- the bounded `intendedUse`;
- one of `PASS_RIGHTS_METADATA_CLOSURE`, `HOLD_RIGHTS_METADATA_INCOMPLETE`, `HOLD_LICENSE_CONCLUSION_MISMATCH`, or `REJECTED_RIGHTS_CONFLICT`.

This Candidate is local to teacher intake. It is not an R2/global-gate change and must not be promoted without Mother acknowledgement and a real audition run.

## Teacher screen

Status: `TEACHER_CANDIDATE` for the bounded problem of declared-vs-concluded license semantics and provenance/integrity fields.

- Provenance: official SPDX 3.0.1 specification and official `spdx/spdx-spec` / `spdx/spdx-3-model` repositories.
- Maintenance: official repositories are active in 2026; stable specification is 3.0.1 while `develop` remains newer work and is not used as the pinned rule source.
- Reproducibility: the specification publishes model documentation, schemas, examples, and normative license-expression grammar; this Candidate replays two pinned KAOPU cases with a deterministic verifier.
- Rights: the specification repository identifies Community Specification License 1.0 / legacy CC-BY-3.0 portions and MIT for its helper script. KAOPU copies field semantics only, not upstream code or examples.
- Direct relevance: closes N242's exact declared/external-evidence distinction.
- Novelty: R2 has source identity but no declared/concluded license split or source-use-restriction receipt.
- Cost/risk: full SPDX graphs are too heavy for this intake gate; use a small KAOPU JSON receipt mapped to the relevant semantics. Legal enforceability remains outside the verifier.
- Failure boundary: source pages can change or disappear; without a timestamped evidence capture and digest, status remains `HOLD_RIGHTS_METADATA_INCOMPLETE`.

Lifecycle: `RADAR_FOUND -> TEACHER_CANDIDATE -> AUDITION`. `PROBATION / ACTIVE_TEACHER / ADOPTED / USER-ACCEPTED = false`.

## Primary sources

- SPDX 3.0.1 Licensing profile: https://spdx.github.io/spdx-spec/v3.0.1/model/Licensing/Licensing/
- SPDX 3.0.1 Package model: https://spdx.github.io/spdx-spec/v3.0.1/model/Software/Classes/Package/
- SPDX 3.0.1 license expressions: https://spdx.github.io/spdx-spec/v3.0.1/annexes/spdx-license-expressions/
- Official stable specification repository: https://github.com/spdx/spdx-spec/tree/3.0.1
- N241 source listing: https://sketchfab.com/3d-models/cat-g3516h-natural-gas-engine-b64acd62fa2b4b19af344003c3645e41
- N242 source listing: https://sketchfab.com/3d-models/caterpillar-skid-steer-loader-859a64d242314ec3af5bfb449bdfa673
- Sketchfab primary explanation of NoAI on CC vs Standard License: https://sketchfab.com/blogs/community/restricting-generative-ai-use-of-free-models/

## State

Issue #91 comment `6625577300`: `POSTED=true / ACKNOWLEDGED=false / IMPLEMENTED=true (Candidate branch only) / GATE-RUN=true (2/2 historical replay) / ADOPTED=false / USER-ACCEPTED=false`.
