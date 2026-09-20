# Original Fish R07 — Tuna first branch, not the definition of Original Fish

Date: 2026-09-20  
Parent: `work/original-fish-r06-first-native-fish-20260920` at `38dda574efb7240811c96e39f4fbbe4643bf55b4`

## Architecture correction

`Original Fish` is the shared KAOPU trunk: units, coordinate frame, evidence gate, semantic parts, motion/material interfaces, QA and source-removal rules.

No single species **is** Original Fish. Every fish type is a branch that implements the shared interfaces with its own anatomy, proportions, material field, behavior and evidence.

Therefore tuna is selected only as the **first complete standardization branch** because it is convenient and information-rich. Later branches may use guppy, trout, bream, shark, ray, clownfish or other fish without inheriting tuna-specific proportions or anatomy.

## Why tuna is the first branch

The repository audit shows:

- Guppy female: 191 joints, two clips, 332/428 channels — richest raw rig/action payload.
- Redband trout: 138 joints and six named clips — richest action-state library.
- Tuna: 98 joints, one 2.1667 s Swim clip, 291 channels — third in raw complexity, but the cleanest first branch.

Tuna combines:

1. a typical marine fusiform bony-fish body suitable for testing the first shared family;
2. dense motion coverage in one bounded swim cycle;
3. separate body, eye and cornea materials, including transparent cornea semantics;
4. moderate source geometry cost: 4,637 vertices / 7,944 triangles;
5. two exports with identical nodes, meshes, skins, animations, materials and all 603 decoded accessor arrays;
6. a CC-BY-4.0 embedded declaration rather than the NC/ND restrictions on several alternatives;
7. direct relevance to later marine and game-scale transfer tests.

## Why the largest source rig is not automatically the trunk

Starting from the largest joint count would be a category error. Raw rig size measures authoring complexity, not suitability as a shared biological language.

- Guppy is useful to stress-test thin transparent fins, layered materials, jaw/gill channels and multiple clips, but its specialised proportions and material stack must remain a guppy branch.
- Redband trout is useful for idle/casual/surge and adult/Young action-state separation, but authored Young clips are not a measured growth model.
- Hammerhead, catshark and manta require different family logic rather than a tuna-shaped bony-fish branch.
- Koi validates morph-animation intake, not skeleton normalization.
- GT is valuable static shape evidence but has no source rig or animation.

## Shared trunk interfaces

Each branch must implement or explicitly mark unknown:

- unified physical scale and length definition;
- root/world frame;
- axial body chain;
- caudal peduncle and tail interface;
- dorsal, anal, pectoral and pelvic fin interfaces where anatomically applicable;
- jaw, opercular and eye interfaces where supported;
- material layers including skin, eye/cornea and thin-fin semantics;
- behavior actions expressed in physical time and motion units;
- evidence tier, uncertainty and source-removal QA.

A branch may add species-specific structures, but cannot force them into every other fish.

## Exact source gate — passed

Both exact variants were re-uploaded and independently verified:

```text
tuna_fish(1).glb
SHA256 f75f073a2999ee20c4839434d28f90565e486b50270e663f48484cca2dbae9f0
6,137,560 bytes
```

```text
tuna_fish (1)(2).glb
SHA256 5603d4aabc9a1127856841335a86ae7aa462b6b25d1a6586e93bf644f4d47abe
58,908,280 bytes
```

The runtime filenames differ from the canonical names only by upload suffix. Both hashes exactly match the registered FISH-REF-002 variants.

The variants have equal nodes, meshes, skins, animations, materials, textures, samplers and all 603 decoded accessor arrays. Their image payloads differ: the small export uses 1024-square images and the high export uses 4096-square images.

## Implemented R07 increment

`src/tuna-source-audit.mjs` now:

- reads exact GLB 2.0 bytes and calculates SHA256;
- decodes all accessor layouts used by the source;
- proves the two variants share identical geometry, rig and animation arrays;
- audits 98 source joints, 291 channels and the 2.1667-second Swim clip;
- distinguishes significant rotation, translation and scale channels;
- reads separate body, eye and transparent-cornea material semantics;
- computes bind-world positions and source-to-semantic correspondence;
- compresses the source rig to 24 native semantic controls without copying the full 98-joint author rig.

Current measured compression:

```text
98 source joints
291 raw channels
68 meaningful rotation channels
4 meaningful translation channels
0 meaningful scale channels
24 native semantic controls
```

The paired `Hips_01` and `Spine.005_076` source branches share the same bind center and are merged into one native `body_center`. The 45-node dorsal ray field becomes a membrane controlled by five native controls. Upper and lower caudal lobes remain separate.

`tests/tuna-source-audit.test.mjs` passed 32 assertions against the two actual uploaded files.

## Current boundary

The source files remain N2 transitional references. Their authored Swim clip is not natural tuna kinematic truth, and the source model is not a runtime dependency.

The source gate and semantic-rig extraction are complete; native tuna body generation, natural-motion replacement, PBR reproduction, browser workbench and visual acceptance are still pending.
