# N214 — Mechanical standard identity and dimension provenance

## Bounded question

Can FreeCAD Fasteners Workbench teach KAOPU a reusable fastener identity/catalog contract without becoming unverified dimensional truth?

## Current failure pressure

The user requires Mechanical Mother to reuse recognized screw, nut and key standards across vehicles and assemblies rather than inventing local names and incompatible definitions. Current `main@3ccae4bde0c91973adbb81f99ec4d54bc9357ce0` has no search hit for fastener standard IDs, ISO 4017, DIN 933 or thread-pitch contracts. This is a schema/provenance gap, not permission to copy a third-party geometry library.

## Pinned teacher evidence

Source: `shaise/FreeCAD_FastenersWB@fddd07af422b7d3a69098b32333711c5eeae184c`.

- Activity: release 0.5.67 and exact head dated 2026-09-10; multiple 2026 releases and issue-linked fixes.
- Runnable engineering content: Python generators, CSV tables, API `createFastener(type, diam, len, threadType, shapeOnly=False)`, attachment behavior and BOM support.
- Test evidence: the pinned repository includes pytest coverage for CSV parsing. The present audit did not find evidence that this parser test rejects dimensional contradictions.
- License: GPL-2.0-or-later. Do not paste its code or standards-derived tables into KAOPU production without rights review.
- Dependencies/cost: FreeCAD Part/BRep and Python workbench dependencies do not match KAOPU's pure-function/no-triangle production route. Only the data-contract and validation ideas are in scope.

## What it knows beyond the Current Best View

In one narrow domain it provides a useful, explicit separation:

1. canonical-looking standard designation as the part type key;
2. dimension-definition table separated from allowed length/tolerance table;
3. per-diameter allowed length range;
4. stable script API and BOM identity;
5. presentation alias (`FSIconAliases`) separated from actual type alias (`FSTypeAliases`).

This is directly useful for the user's demand that all vehicles share recognizable standard-part keys. KAOPU should learn the schema and alias-scope distinction, not the BRep implementation.

## Falsifying counterexample

Pinned blob `fd371954e8ac4b03c275dccdf87c663ef38f4df1` contains in `ISO4017length`:

```text
nominal=140, min=139.2, max=130.8
```

The row violates both `min <= max` and `min <= nominal <= max`. Adjacent 130 and 150 rows pass the same checks. Therefore repository maintenance, a standard-looking identifier and successful CSV parsing do not establish normative dimensional truth.

The alias table supplies a second boundary: `DIN933 -> ISO4017` appears under icon reuse, not the type-equivalence table. A UI/icon alias must never be promoted to dimensional equivalence.

Probe result: 6/6 checks pass, including rejection of the corrupt row and rejection of alias-scope escalation.

## Decision

Teacher lifecycle: `RADAR_FOUND -> TEACHER_CANDIDATE`; `AUDITION=false`.

Teacher scope is limited to catalog schema, shared standard identity keys, diameter/length compatibility structure and alias-scope separation.

Decision: `HOLD_THIRD_PARTY_FASTENER_TABLE_NOT_CANONICAL_TRUTH`.

No upstream dimension, tolerance or equivalence may become KAOPU Canonical Truth until an authorized normative or manufacturer source is pinned by edition/revision and an independent verifier runs table invariants and cross-assembly compatibility checks.

## Candidate translation

Candidate regression: `MECHANICAL-STANDARD-IDENTITY-AND-DIMENSION-PROVENANCE-001`.

Task Anchor adds standard authority/designation/edition, family, diameter, pitch, length, tolerance class, material grade, finish, source revision/digest and geometry route.

Delivery Receipt adds canonical part ID, alias scope, dimension invariant result, diameter-length compatibility, source provenance, cross-assembly key compatibility and verifier identity.

Minimum falsifiable production trial:

1. bind one shared fastener family used by at least two assemblies to the same canonical part ID;
2. resolve dimensions from an authorized pinned source, not the teacher CSV;
3. inject the corrupt 140 mm row and an icon-only alias as negative controls;
4. require both controls to fail before any production adoption claim.

## Status boundary

- `POSTED=false`
- source/synthetic `GATE-RUN=true`
- `ACKNOWLEDGED=false`
- `IMPLEMENTED=false`
- Mechanical production `GATE-RUN=false`
- `ADOPTED=false`
- `USER-ACCEPTED=false`

No production Mother, `main`, R2 OS or global gate was modified. KPI values remain `unknown`.
