# KAOPU Learning Flywheel N339 — Weathering layer order and channel-ownership audition

## One bounded question

Can a layered weathering graph prevent one generic noise field from silently driving unrelated color, roughness and geometry changes, while still allowing one physical process mask to drive every channel that process legitimately owns?

This question narrows the user's four weathering notes and complements N336. It does not set corrosion displacement amplitudes, replace N336's geometry proof, or change the global R2 OS.

## Current Best View gap

The four notes already say to build clean materials first, separate steel / paint / corrosion product / dirt, work macro-to-micro, and avoid reusing one noise source in every channel. N336 already requires shader and geometry to bind to the same corrosion field and proves nonzero geometry delta.

The missing executable distinction was:

- **legitimate coupling** — one corrosion mask may coherently drive corrosion color, roughness, metallic loss and crust relief;
- **illegitimate coupling** — one generic noise mask may not impersonate edge wear, corrosion, dirt and runoff at once, nor write channels outside a declared process contract.

Without this distinction, “do not reuse noise” can either be ignored or over-applied until physically correlated channels drift apart.

## Teacher audition

Status: `TEACHER_CANDIDATE / AUDITION`

Teacher: `TheJanusStream/symbios-texture`

Pinned source:

- repository commit: `0a873d279c5535723d4dad9160816f0682fe6524`
- weathering blob: `4e1565e887e1133286476f425a48c16fd063a867`
- crate version: `0.8.1`
- license: MIT
- upstream GitHub Actions run: `42577470457`, conclusion `success` on 2026-11-09

### What it knows beyond KAOPU Current Best View

It supplies a concrete, testable contract rather than a shader recipe:

1. fixed causal order: edge wear → corrosion → crevice dirt → runoff streaks;
2. a separate seed domain and geometry-derived mask for each process;
3. explicit per-process write ownership;
4. zero-strength identity, so adding the system does not silently restyle existing materials;
5. single-layer activation tests, rather than only an “all layers on” beauty test;
6. resolution-relative parameters and wrapped neighbourhood tests for repeatable tiled materials.

The transferable principle is the contract shape. KAOPU should not copy this crate's visual defaults or treat its stylized wall-space gravity as physical truth.

## Eight checks

1. **Source / provenance** — public first-party repository and exact commit are available. Authorship is pseudonymous and no institutional affiliation, paper or DOI was found; provenance is therefore weaker than an official lab release.
2. **Maintenance / release / issue activity** — repository created 2026-06-25 and pushed 2026-11-09; the pinned commit is 2026-11-09. No GitHub Releases or issue history were found, so sustained maintenance remains unproven.
3. **Runnable code / tests / data** — Rust source, unit/integration tests and CI exist. The pinned Actions job passed formatting, Clippy, build, tests and wasm check. This environment lacked Cargo, so no local Rust execution is claimed; an independent pinned-source static audit passed.
4. **License / rights** — MIT source license. No external art asset is needed for the transferable contract.
5. **Direct relevance** — directly addresses the four weathering notes and N336's material/geometry binding, especially the difference between causal shared masks and arbitrary cross-channel noise reuse.
6. **Novelty** — adds a machine-checkable layer-order plus write-ownership matrix and zero-state identity test absent from the current candidate contracts.
7. **Dependencies / hardware / cost** — Rust 1.98.1; `noise`, `rand`, `rayon`, `serde`, `symbios-genetics`; CPU only for the audited path. KAOPU should port the contract and tests, not add this crate as a production dependency without a separate integration review.
8. **Demo-only / opacity / version risk** — open source and not training-data-dependent, but one-maintainer provenance, no release history and no KAOPU production replay keep it at audition only.

## Minimal falsifiable replay

The pinned-source audit extracted the actual write set from each layer function:

| Process | Legal channel writes observed |
|---|---|
| edge wear | color, roughness, metallic |
| corrosion | color, roughness, metallic, height |
| crevice dirt | color, roughness, occlusion |
| runoff streaks | color, roughness |

It also verified:

- the four functions are called in the declared order;
- the no-op predicate includes every layer amount;
- five distinct seed domains are present for unrelated process noise;
- upstream tests cover no-op identity, single-layer activation, corrosion-only relief, wrapped masks and seed determinism;
- the exact upstream CI job passed its test step.

Static audition result: `PASS_STATIC_SOURCE_AUDITION`.

Local Rust runtime: `UNKNOWN` because Cargo was unavailable. KAOPU production Mother replay: `NOT_RUN`.

## Candidate transfer

Add one Material-Mother-local verifier gate during the next relevant weathering task:

1. Task Anchor binds `layerGraphDigest`, ordered process IDs, per-process mask/seed domain and declared channel ownership;
2. Delivery Receipt reports one-layer-at-a-time channel deltas plus an all-zero baseline digest;
3. any undeclared channel write is `HOLD_UNDECLARED_LAYER_CHANNEL_WRITE`;
4. unrelated processes sharing one generic mask/seed domain is `HOLD_CROSS_PROCESS_MASK_ALIASING`;
5. a single physical process may share its own mask across its declared channels; that is not a failure;
6. N336 still separately requires real geometry displacement and material/geometry field binding for corrosion.

No global OS change is proposed. The production threshold for acceptable channel-delta magnitude remains `UNKNOWN`; the gate is about ownership and identity, not artistic strength.

## Decision and limits

Decision: `CANDIDATE_LAYER_CHANNEL_OWNERSHIP_AWAITING_MATERIAL_MOTHER_REPLAY`

- source audit: `GATE-RUN=true`
- upstream CI: `SUCCESS`
- production Material Mother replay: `NOT_RUN`
- `POSTED`: pending directed issue comment
- `ACKNOWLEDGED / IMPLEMENTED / ADOPTED / USER-ACCEPTED=false`
- no change to main, R2 OS, production Mother branches or Canonical Truth
