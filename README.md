# Ocean Life / Fish Mother — Yellowfin Biological Correction R001

Date: 2026-09-22

This branch is the current Fish Mother execution line. The old recovery stage is closed: the exact Tuna source has been ingested, Source Copy R001 is frozen, and Yellowfin biological correction is now the active stage.

## Start here

1. Read `apps/ocean-life-mother/fish-mother/FISH_MOTHER_MASTER_DIRECTION_20260922_ZH.md`.
2. Read `CURRENT_BASELINE.json`.
3. Read `apps/ocean-life-mother/fish-mother/yellowfin-biological-correction-r001/CURRENT_STATUS.json`.
4. Open the stable workbench entry: `apps/ocean-life-mother/fish-mother/index.html`.

## Current line

- active branch: `work/ocean-life-fish-mother-yellowfin-biological-correction-r001-20260921`
- frozen Source Copy commit: `9b610f4ef0134e015c2fb6b14574e7e4f48ed943`
- frozen Source Copy SHA-256: `2130a3c03fc50d22676919c3599e75707e61d9f75ddd90523a6897887715ec02`
- Candidate A: rejected after visual review because it enlarged the wrong dorsal components and created a false rectangular sail
- Candidate B: machine browser QA passed
- Candidate B SHA-256: `f36f8f034a9ea864c6050f3c0eda3629a201e0917ded9a631f2584be3cadbcbc`
- manual visual acceptance: pending
- `productionReady`: false

## Original Fish relationship

Original Fish is the shared mathematical and measurement language, not a generic mesh and not a replacement model. Yellowfin tuna remains an independent species branch derived from that common language. Do not restart this branch from a toy fish, N02, a low-dimensional Tuna, or a generic-fish mesh.

## Immediate production scope

Continue only from Candidate B. Converge:

- head and eye proportion
- first-dorsal silhouette and body transition
- pectoral and anal root attachment
- eye/cornea seating
- local deformation at five synchronized `Swim` samples

Do not repeat model-search or source-recovery work. Do not modify the frozen Source Copy in place.

## Delivery contract

The stable in-repository launcher is:

`apps/ocean-life-mother/fish-mother/index.html`

It currently routes to the Candidate B three-dimensional QA workbench. Public one-click delivery is not complete until this exact entry is deployed and browser-verified from a public URL.
