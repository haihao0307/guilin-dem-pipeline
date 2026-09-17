# Farmland R043 Prototype Failure Register

Date: 2026-09-17
Status: rejected visual composition; retain only research evidence and reusable field-graph ideas.

## User rejection

The R043 prototype introduced a central river valley with agricultural land on both sides. This violated the already confirmed Farmland composition:

`rear high mountains -> one dominant agricultural slope -> terrace system on that slope -> foothill transition -> broad flat paddy plain in front -> river along the front / lower receiving edge`

The river may receive the whole system at the front, but it must not split the composition into two opposed agricultural valley walls.

## Root cause

The implementation confused **method** with **layout**.

MrRolord's video demonstrates a hydrology-first procedural method. It does not authorize copying the exact two-sided valley composition into Farmland. The transferable method is:

`water hierarchy -> distance / terrain fields -> land-use masks -> terrain-conforming agricultural pattern`

The non-transferable part is the specific valley arrangement shown in the video.

## Additional failure

The prototype also subdivided the agricultural surface before the one-sided slope / plain composition and management skeleton were sufficiently constrained. This produced arbitrary cuts that were internally valid as polygons but visually and agriculturally wrong.

A topologically valid parcel graph is not automatically a correct field system.

## What is preserved

- hydrology-first field derivation;
- accumulated distance and branch-order fields;
- shared-boundary ownership;
- per-field inlet and outlet contracts;
- fixed world coordinates and deterministic scale channels;
- actor grounding and task-compatible routes.

## What is discarded

- central two-sided valley composition;
- agriculture on both river banks as the default layout;
- parcel subdivision before slope, plain, water, path, and management axes are frozen;
- any claim that polygon validity alone proves agricultural correctness.

visualAcceptance=false
productionReady=false
