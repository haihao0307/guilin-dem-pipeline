# KAOPU Learning Flywheel N325 — ZX85 hydraulic endpoint connectivity

Date: 2026-11-20
Status: CANDIDATE
Scope: one bounded question only

## Bounded question

Can the existing relation-graph regression reject two side hoses that visually reach or intersect the upper route but do not terminate on the required upper-pipe ports, while freezing the four already-correct direct boom hoses?

## Existing failure → candidate refinement

Repeated user production correction establishes three facts: four direct boom hoses are already correct; the two side hoses must connect to the upper pipe; routing those two hoses into the central area is wrong.

N318 already deduplicated this correction to `CANDIDATE_GEOMETRY_TIME_NOT_RELATION_GRAPH_001`. N325 therefore refines that case in place. It does not create another regression.

The missing failure mechanism is explicit: visual closeness, overlap or midspan intersection can be mistaken for connectivity. Hydraulic acceptance requires resolved endpoint-to-port edges, correct target assembly, explicit junction semantics and frozen protected-hose digests.

The speech-transcribed component label remains `UNKNOWN`; no component identity is invented.

## Minimal falsifiable probe

The fixture gate covers valid topology plus missing side connection, wrong central target, proximity without topology, midspan intersection, shared port without junction, protected-hose mutation, missing source head, unknown tolerance with false PASS, endpoint gap, missing replay and dangling port.

Result: **12/12 fixture cases PASS**.

Production replay: `NOT_RUN`. Production endpoint tolerance: `UNKNOWN`.

Decision: `CANDIDATE_EXISTING_RELATION_GRAPH_REFINED_WITH_HYDRAULIC_PORT_TOPOLOGY_HOLD_PRODUCTION_REPLAY_UNVERIFIED`.

Teacher status: `NO_NOVELTY`. This is a direct application of the existing KAOPU relation-layer distinction to a fresh hydraulic failure.

## Targeted Mother reply

Only the ZX85 Front Attachment / Hydraulic Mother should answer:
1. Are the two side hoses and the upper-pipe target ports identifiable on the current fresh head?
2. Are port-to-port edges already machine-readable, or is the current proof only visual geometry?
3. What measured endpoint tolerance is valid in the declared reference frame?
4. What smallest fresh-head replay preserves the four accepted hoses while mutating one side-hose target to the wrong central port?

Lifecycle: `POSTED=true` — issue #91 comment `7033574819`; `ACKNOWLEDGED=false`; `IMPLEMENTED=candidate regression refinement only`; `GATE-RUN=true (fixture only)`; `ADOPTED=false`; `USER-ACCEPTED=false`.

No main, R2 OS, production Mother branch or production asset is modified.
