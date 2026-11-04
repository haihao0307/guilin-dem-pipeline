# N244 — in-toto declared closure / hidden runtime import audition

## One bounded question

Can official in-toto 3.1.0 close the real N239 failure by preventing a Producer from passing a signed supply-chain step after an undeclared runtime-imported command-binding module changes semantics?

## Production failure anchor

N239 showed that the A4 Player R05 packaged gates could pass after an unlisted runtime wrapper reversed the emitted `uSide` command. The Mother coordinator acknowledged the finding in issue #91 comment `6612332765` and kept production admission on HOLD.

Applicable existing Candidate: `CANDIDATE_EXECUTABLE_RESOURCE_CLOSURE_001`. This run extends its evidence and does not create another regression case.

## External teacher screen

Status: `TEACHER_CANDIDATE` for **authorized functionary identity plus independently declared artifact chaining**, not for automatic runtime dependency discovery.

1. **Source/provenance** — official `in-toto/in-toto` repository, official in-toto specification, and official v3.1.0 release.
2. **Maintenance** — v3.1.0 was published 2026-05-04; the official repository has 2026 commits and is not archived.
3. **Runnable evidence** — Python reference implementation, CLI/API, tests, specification, demo, signed layouts and link verification. This audition ran the pinned 3.1.0 package.
4. **License/rights** — Apache-2.0. No upstream code is copied into KAOPU production; the probe only invokes the installed official release.
5. **Direct relevance** — N239 is about exact runtime command-binding module identity and Producer/verifier separation.
6. **New knowledge beyond Current Best View** — R2 separates Producer and Verifier by role, but the current three baseline documents do not define owner-signed layouts, authorized functionary public keys, signature thresholds, or signed material/product links.
7. **Dependencies/cost** — Python >=3.9 plus `securesystemslib`, `cryptography`, `attrs`, `pathspec`, `iso8601`, and `python-dateutil`; no special hardware. Integration risks are key custody, layout expiry, explicit artifact enumeration, and signing/verification operations.
8. **Failure boundary** — in-toto records only artifacts explicitly supplied to the step. It does not observe filesystem reads or discover dynamic imports. A correct signature over an incomplete material list is still incomplete evidence.

## Minimal falsifiable replay

The probe creates:

- `runner.mjs`;
- declared `declared-command-binding.mjs`;
- dynamically imported but omitted `hidden-runtime-wrapper.mjs`.

The in-toto layout allows the two declared materials and then `DISALLOW *`. The Producer signs the link.

| Replay | Semantic output | Hidden wrapper recorded | Verification |
|---|---:|---:|---|
| pristine wrapper | `uSide=1` | no | PASS |
| hidden wrapper mutated | `uSide=-1` | no | PASS |
| independent layout adds `REQUIRE hidden-runtime-wrapper.mjs` | `uSide=-1` | no | `RuleVerificationError` |
| unauthorized functionary signs instead of Producer | n/a | no | `LinkNotFoundError` |

Result: the official tool correctly enforces an independently declared path and authorized signer. It does **not** make an incomplete material list complete.

## Decision

`ACCEPT_IN_TOTO_FUNCTIONARY_AND_DECLARED_ARTIFACT_CHAINING_AS_BOUNDED_TEACHER_HOLD_AS_UNDECLARED_RUNTIME_DISCOVERY_GATE`

What it adds to the existing Candidate:

- the coordinator/verifier, not the Producer, owns the signed closure layout;
- the layout authorizes exact functionary keys and an explicit threshold;
- the runtime closure manifest becomes a required material chain, not a self-reported list;
- an unauthorized signer or a missing independently required module fails closed.

What it cannot replace:

- package-local import-graph resolution before execution;
- dynamic-import resolution and exact module enumeration;
- semantic command trace for filter 57;
- mutation tests proving every resolved runtime module is consumed by the gate.

## Candidate mapping

For one A4 Player trial only:

- Task Anchor: `runtimeClosureLayoutDigest`, `layoutOwnerKeyId`, `authorizedProducerKeyIds`, `signatureThreshold`, `resolvedRuntimeModules`.
- Producer link: signed `materials`, `products`, `command`, `returnValue`.
- Independent Verifier gate: recompute import closure, require every resolved module in the owner-signed layout, verify signatures, then dynamic import.
- Negative controls: hidden/unlisted/missing/stale module, unauthorized signer, insufficient threshold, semantic `uSide` mutation.

No R2/global-gate change is proposed. Adoption requires a real Player package trial and Mother acknowledgement.

## Primary sources

- Stable in-toto specification: https://in-toto.io/docs/specs/
- Official specification definitions: https://github.com/in-toto/specification/blob/master/in-toto-spec.md
- Official reference implementation: https://github.com/in-toto/in-toto
- Official v3.1.0 release: https://github.com/in-toto/in-toto/releases/tag/v3.1.0
- Official layout creation example: https://github.com/in-toto/in-toto/blob/v3.1.0/doc/source/layout-creation-example.md
- Official Apache-2.0 license: https://github.com/in-toto/in-toto/blob/v3.1.0/LICENSE

## State

Issue #91 comment `6629852166`: `POSTED=true / ACKNOWLEDGED=false for N244 / IMPLEMENTED=true (Candidate probe only) / GATE-RUN=true / ADOPTED=false / USER-ACCEPTED=false`.

Teacher lifecycle: `RADAR_FOUND -> TEACHER_CANDIDATE -> AUDITION`; `PROBATION / ACTIVE_TEACHER / LEARNED_OUT / RETIRED=false`.
