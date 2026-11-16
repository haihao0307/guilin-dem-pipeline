# KAOPU Learning Flywheel N299 — ZX85 v316 frozen-manifest growth

## One bounded question

Does exact ZX85 checkpoint v316 close v296's frozen-manifest failure, or do current production additions continue accumulating outside the byte-identical seal?

## Required baseline read

Fresh-read from current main before this replay: root `AGENTS.md`, R2 OS, reference-replication gate, freshness gate, and latest real feedback in #91/#63. Existing applicable regression was refined in place; no duplicate case was created.

## Exact subject

- Library file: `zx85usb-5a-functional-whole-checkpoint-20261113-r01.zip`
- Library identity: `libfile_841f9900a5ec81918f2df377bf8e292f@316`
- modified: `2026-11-16T15:32:23.286686+08:00`
- size: `461326172` bytes
- SHA-256: `15a46cc408930f8210f76a3f26672a63c5e71bcb0d3b6cc5449d356ff9b6c11f`
- archive entries: `6287`

## Fresh exact-byte replay

The archive was materialized and extracted cleanly. Excluding root `CHECKSUMS.json`:

- actual files: `6286`
- manifest entries: `4973`
- missing manifest targets: `0`
- digest mismatches for declared files: `0`
- unmanifested files: `1313`
- key-set equality: `false`

The manifest SHA-256 remains `f28b24c7ded48a7a0520428a685dcda4cf86937e97e191ee77fe84def53fd861`, byte-identical to v282 and v296. The retained builder SHA-256 also remains `b0b69022a2579eb5cf9cfd99d0e59aa73b4918b8d49ba321e0eb5d3b3f4901fd`.

## Delta from v296

- archive files: `5678 -> 6286` (`+608`)
- manifest entries: `4973 -> 4973` (`+0`)
- unmanifested files: `705 -> 1313` (`+608`)
- archive bytes: `+22081689`

All 608 new files are outside the frozen manifest. The full growth delta is concentrated in:

- `whole-runtime-audits`: `+571`
- `mechanical-increments`: `+37`

This is a new exact-subject validation result, not a new failure class. It strengthens the existing root-cause candidate: the documented final-seal writer is not the actual last writer, or later audit/mechanical additions bypass it.

## Decision

`HOLD_V316_FROZEN_MANIFEST_1313_UNMANIFESTED_FILES`

A clean scoped script or stored receipt cannot override whole-subject integrity. Production promotion remains blocked until the exact delivered archive is rebuilt after all additions, reopened, and proves manifest/archive key-set equality plus zero digest mismatches.

## Scope and lifecycle

- Existing Candidate refined in place; no duplicate regression.
- Coordination only: `GATE-RUN=true`.
- `ACKNOWLEDGED / IMPLEMENTED_PRODUCTION / ADOPTED / USER-ACCEPTED=false`.
- No main, production Mother, Site, R2 OS, public route, or production asset changed.
- KPI effect: `UNKNOWN`.

