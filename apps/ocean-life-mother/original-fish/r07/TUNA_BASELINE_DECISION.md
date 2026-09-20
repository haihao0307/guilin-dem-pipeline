# Original Fish R07 — Tuna baseline selection

Date: 2026-09-20  
Parent: `work/original-fish-r06-first-native-fish-20260920` at `38dda574efb7240811c96e39f4fbbe4643bf55b4`

## Decision

Use `FISH-REF-002` Tuna Fish as the first complete rig/motion standardization baseline for Original Fish.

This is **not** because it has the largest skeleton. The repository audit shows:

- Guppy female: 191 joints, two clips, 332/428 channels — richest raw rig/action payload.
- Redband trout: 138 joints and six named clips — richest action-state library.
- Tuna: 98 joints, one 2.1667 s Swim clip, 291 channels — third in raw complexity, but the cleanest first shared baseline.

The tuna is selected because it combines:

1. a typical marine fusiform bony-fish body suitable for the Original Fish first family;
2. dense motion coverage in one bounded swim cycle;
3. separate body, eye and cornea materials, including transparent cornea semantics;
4. moderate source geometry cost: 4,637 vertices / 7,944 triangles;
5. two exports with identical nodes, meshes, skins, animations, materials and all 603 decoded accessor arrays;
6. a CC-BY-4.0 embedded declaration rather than the NC/ND restrictions on several alternatives;
7. direct relevance to later marine and game-scale transfer tests.

## Why not start from the raw "most complete" source

Starting from the largest joint count would be a category error. Raw rig size measures authoring complexity, not suitability as a shared biological language.

- Guppy is useful later to stress-test thin transparent fins, layered materials, jaw/gill channels and multiple clips, but its specialised material stack and body proportions would bias the first shared core.
- Redband trout is useful later for idle/casual/surge and adult/Young state separation, but those Young clips are authored variants, not a measured growth model.
- Hammerhead and manta require separate family logic rather than a typical bony-fish baseline.
- Koi validates morph-animation intake, not skeleton normalization.
- GT is valuable static shape evidence but has no source rig or animation.

## R07 implementation boundary

The R07 pipeline will extract and normalize relationships, not preserve the source rig as runtime truth.

Target semantic rig:

- root / world frame;
- axial body chain;
- caudal peduncle and caudal fin;
- dorsal and anal fin controls;
- left/right pectoral controls;
- left/right pelvic controls when supported;
- jaw and opercular controls when actually present;
- eye/cornea material anchors;
- one normalized swim phase with explicit units and source evidence.

Unknown or absent semantic parts remain unknown. A source with 98 joints does not force the native runtime to use 98 joints.

## Exact source gate

The repository contains the audit and hashes, but not the raw tuna binaries in the current branch or private reference cache. R07 accepts only one of:

```text
tuna_fish.glb
SHA256 f75f073a2999ee20c4839434d28f90565e486b50270e663f48484cca2dbae9f0
```

or

```text
tuna_fish (1)(1).glb
SHA256 5603d4aabc9a1127856841335a86ae7aa462b6b25d1a6586e93bf644f4d47abe
```

The smaller export is sufficient for geometry/rig/motion audit. The 4096 export is preferred for appearance study. A similarly named tuna cannot substitute for either exact identity.

## Current implemented increment

`src/rig-audit.mjs` now:

- parses a GLB 2.0 JSON chunk;
- calculates exact SHA256 and validates the declared GLB length;
- counts skins, unique joints, clips, channels and animated joints;
- records animation target paths and clip durations;
- detects candidate semantic node names without silently declaring them correct;
- detects separate eye/cornea material semantics;
- separates raw rig completeness from baseline suitability.

The test fixture passes 12 assertions. The current tuna result remains `SOURCE_GATE_PENDING`, not a completed conversion.
