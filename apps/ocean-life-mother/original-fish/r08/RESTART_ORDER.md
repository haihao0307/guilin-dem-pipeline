# Original Fish R08 — Tuna high-fidelity restart order

Date: 2026-09-20  
Branch: `work/original-fish-r08-tuna-hifi-restart-20260920`  
Base: `5115808bbd42b837e28a2bc4b8bed47641ce29a4`

## Decision

The low-dimensional Tuna R02 and its local R03–R10 descendants are rejected as the continuation baseline. They are preserved only as failure evidence.

The rejected line made a category error: it treated a source fish with high-information geometry, rig, animation and material separation as if it could be replaced immediately by a small number of generic longitudinal sections, uniform cross-sections, plate fins and add-on mouth/operculum parts. Software correctness and WebGL stability were then reported before the shape had passed fixed-view comparison.

## What is retained

- Original Fish trunk contracts: units, coordinate conventions, evidence gates, species branches, semantic-part interfaces, QA and provenance;
- exact FISH-REF-002 source identities and licence metadata;
- source audit and parsing utilities;
- source rig/material/animation inventory;
- rejected screenshots, receipts and commits as failure evidence;
- general code that does not contain rejected tuna shape/material parameters.

## What is forbidden in the restart

- reuse of Tuna R02 body sections or local R03–R10 body/fin parameters;
- a universal superellipse/section loft as the accepted close-view tuna body;
- plate-like fins created before fin-root and membrane continuity are measured;
- generic mouth, jaw, eye or operculum add-ons used as species anatomy;
- procedural colour bands or wet highlights used to hide shape mismatch;
- claiming progress from assertion count, triangle count or WebGL success without visual correspondence evidence;
- reducing the 98-joint source rig to a small runtime rig before source correspondence is demonstrated.

## Restart stages

### A. Source benchmark and calibration

Use the exact hash-matched FISH-REF-002 source only. Produce fixed orthographic side, three-quarter, front and top views; silhouette masks; calibrated contours; source joint bind positions; and source skin-influence partitions. Source views are labelled reference observations and never native output.

### B. Anatomical correspondence

Explicitly partition and review:

- continuous head–shoulder–trunk–peduncle body surface;
- upper jaw, lower jaw and mouth corners;
- cheek, operculum and gill opening;
- eye, iris/pupil anchor and cornea;
- first dorsal, second dorsal, anal, pectoral and pelvic fins;
- finlets;
- peduncle keels;
- upper/lower caudal lobes.

No native fish candidate is allowed before this partition and its continuity targets are recorded.

### C. High-dimensional native surface

Use adaptive multi-patch surfaces, subdivision/control cages or another sufficiently high-dimensional source-independent representation. The representation must preserve continuous tangent/curvature behaviour through head–trunk and trunk–peduncle transitions. A low-dimensional ruler may support scale and diagnostics but cannot be the accepted near-view surface.

### D. Shape gate before materials

For each fixed view provide:

1. labelled source reference;
2. native candidate;
3. 50% overlay;
4. silhouette-difference image;
5. landmark error report;
6. source-surface-to-native distance summary where correspondence is valid.

A failed side, front, top or three-quarter view blocks material, motion and mobile optimisation work.

### E. Motion compression after shape correspondence

Keep the 98-joint source correspondence during study. Compress only after the reduced rig demonstrably reproduces accepted deformation and fin-root behaviour. Source clip timing remains N2 authored evidence, not natural tuna kinematics.

### F. PBR and natural motion

Only after the grey-shape gate passes: wet skin, scales, lateral line, thin-fin transmission, eye/cornea optics, and evidence-bounded motion.

## Current gate

The source benchmark R01 has run on the exact 6,137,560-byte source and has produced calibrated fixed views, 256-point silhouettes, a 98-joint bind-pose inventory and skin-influence partitions locally; the public branch stores aggregate calibration and cryptographic hashes plus the reproduction tool.

```text
sourceReferenceRead=true
fixedViewCalibration=true
silhouetteBaseline=true
skeletonInventory=true
skinInfluenceInventory=true
anatomicalPartitionAccepted=false
nativeCandidateAllowed=false
visualAcceptance=false
productionReady=false
```
