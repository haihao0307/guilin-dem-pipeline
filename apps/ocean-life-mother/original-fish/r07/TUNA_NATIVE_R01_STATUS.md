# Original Fish R07 — Tuna native branch R01 status

Date: 2026-09-20

## Architecture

Original Fish is the shared KAOPU trunk, not one universal fish body. Tuna is the first species branch because the exact source pair is information-rich and convenient. The trunk keeps units, coordinates, evidence gates, semantic-part interfaces, motion/material interfaces, QA and source-removal rules. Tuna-specific proportions and anatomy remain inside the tuna branch.

## Exact inputs

Both uploaded files match the registered FISH-REF-002 identities:

- high-resolution appearance variant: `5603d4aabc9a1127856841335a86ae7aa462b6b25d1a6586e93bf644f4d47abe`, 58,908,280 bytes;
- low-resolution geometry/rig/motion variant: `f75f073a2999ee20c4839434d28f90565e486b50270e663f48484cca2dbae9f0`, 6,137,560 bytes.

All 603 decoded accessor arrays are exactly equal between variants. Image payloads differ.

## Source audit and semantic compression

Actual source:

- 113 nodes;
- 3 meshes;
- 4,637 vertices / 7,944 triangles;
- 98 joints;
- one 2.166666746 s `Swim` clip;
- 291 animation channels;
- 68 significant rotation channels;
- 4 significant translation channels;
- 0 significant scale channels;
- separate body, eye and transparent-cornea material semantics.

Native semantic extraction:

- 98 source joints → 24 native semantic controls;
- twin body-center branches merged;
- source scale channels discarded;
- 45-node dorsal ray field becomes a membrane plus five native controls;
- upper and lower caudal lobes remain separate;
- source model, textures, 98-joint rig and animation tracks are not runtime dependencies.

Source and semantic-rig QA: `32 assertions passed`.

## First source-independent native preview

A first local WebGL preview has been executed with:

- 13 function-generated parts;
- 24 semantic controls;
- 6,858 triangles;
- side, three-quarter, front and top views;
- configurable tail amplitude and period;
- semantic skeleton display;
- separate eye/cornea display;
- desktop 1440×1000 and phone 390×844 browser runs;
- WebGL error 0, no page/console errors and no horizontal overflow.

The exact candidate HTML is 21,515 bytes with SHA-256 `161bc492dd0de83c2c9c65aa623af96a0352eeede23c0fd39b848160c9d94848`.

## Acceptance boundary

This is an engineering preview, not a 3A fish.

- source clip is N2 authored motion, not natural tuna kinematics;
- body and fin forms are still low-dimensional;
- eye, cornea, skin, scales, fin translucency and wet PBR are not accepted;
- natural movement, visual fidelity and user acceptance are false;
- production ready is false;
- local candidate workbench packaging into the repository is still pending.
