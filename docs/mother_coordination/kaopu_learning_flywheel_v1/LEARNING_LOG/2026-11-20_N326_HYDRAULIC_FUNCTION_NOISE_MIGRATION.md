# KAOPU Learning Flywheel N326 — hydraulic function/noise migration gate

Date: 2026-11-20
Status: CANDIDATE
Scope: one bounded question only

## Bounded question

When the user requires every hydraulic hose to be rebuilt by function/noise extrusion, how can the four already-correct direct hoses change implementation bytes without losing their accepted centerlines, radius profiles, endpoint topology or port bindings?

## New counterexample to N325

N325 froze the four accepted direct hoses by mesh digest. That is valid for an ordinary side-hose repair, but it becomes over-strong under an explicitly authorized method migration: replacing baked/static geometry with generated extrusion can legitimately change mesh bytes. Requiring byte equality would either block the user's specified route or encourage a false route claim over unchanged baked geometry.

N326 refines the existing hydraulic regression in place. It does not create a second case.

The migration gate therefore separates:

- implementation identity, which is expected to change;
- specified-route proof, which requires generator module, invocation, centerline/cross-section functions and bound noise parameters;
- protected observable invariants, which keep the accepted centerline and radius profile within declared tolerances;
- endpoint topology, which must remain port-bound and pass N325 semantics.

The speech-transcribed phrase is normalized only to the user's explicit intent `FUNCTION_NOISE_EXTRUSION`; no hidden engineering geometry or OEM route is invented.

## Minimal falsifiable fixture

The gate covers a valid six-hose migration plus missing receipt, missing source head, unauthorized migration, incomplete hose coverage, baked route substitution, missing generator provenance, unbound noise seed, endpoint drift, accepted-shape regression, nondeterministic replay and a claimed migration with no implementation delta.

Result: **12/12 fixture cases PASS**.

Production replay: `NOT_RUN`. Current production source head, six hose object IDs, exact port IDs, centerline/radius tolerances and independent observed generator invocation remain `UNKNOWN`.

Decision: `CANDIDATE_REPLACE_BYTE_FREEZE_WITH_AUTHORIZED_ROUTE_PLUS_OBSERVABLE_INVARIANTS`.

Teacher status: `NO_NOVELTY`. This is a bounded composition/refinement of existing KAOPU specified-route, provenance, relation-graph and protected-invariant rules.

## Targeted Mother reply

Only ZX85 Front Attachment / Hydraulic Mother should answer:

1. What are the current six hose object IDs and the exact fresh source head?
2. Which generator module and invocation actually produced every hose?
3. What measured centerline, radius-profile and endpoint tolerances preserve the four accepted direct hoses?
4. Can one fresh-head mutation replace a function/noise hose with baked geometry while keeping a visually similar mesh, and does the gate reject it?

Lifecycle: `POSTED=true` — issue #91 comment `7043856391`; `ACKNOWLEDGED=false`; `IMPLEMENTED=candidate regression refinement only`; `GATE-RUN=true (fixture only)`; `ADOPTED=false`; `USER-ACCEPTED=false`.

No main, R2 OS, production Mother branch, public Site or production asset is modified.
