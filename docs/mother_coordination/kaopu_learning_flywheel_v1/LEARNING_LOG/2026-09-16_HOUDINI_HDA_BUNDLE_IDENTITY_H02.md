# KAOPU Learning Log — Houdini HDA bundle identity H02

## Question

Can the definition payload hash required by H01 be the SHA-256 of the whole `.hda` file or only the node `Contents` section?

## Evidence and bounded method

SideFX Houdini 22.0 documentation was locked for the HDA archive, packed/expanded forms, definition sections and HOM extraction. A synthetic CPU fixture then separated three identities: whole-library transport, selected-definition bundle and node `Contents` only. No Houdini executable or HDA binary parser was used.

All twelve checks passed. Changing library author/timestamp/compression metadata or an unrelated sibling asset changed the whole-library hash while leaving the selected target definition bundle unchanged. Changing `PythonModule` or an embedded lookup section left `Contents` unchanged but changed the complete selected-definition bundle. Section enumeration order was normalized; type identity, options and interface remained included.

## Observation

- A single HDA archive may hold several definitions plus library metadata and arbitrary sections.
- Packed and expanded representations are transport alternatives; their raw bytes are not a stable selected-definition identity.
- `Contents` describes the child-node graph, but HDA sections also hold parameter/interface material, scripts and embedded resources that may affect evaluation.
- SideFX explicitly warns that expanded internal file formats are undocumented and changeable; KAOPU must not invent a hand-edited canonicalization of those files.

## Candidate

Use a three-layer receipt:

1. `transportSha256`: exact delivered `.hda` or expanded-package bytes/tree.
2. `definitionBundleSha256`: fully qualified selected type plus a sorted map of every section name and exact decompressed section bytes, definition options and interface contract.
3. `cookReceiptSha256`: the H01 bundle plus instance state, parameters, time/frame/units/seed, environment resolution and external inputs.

The section bundle is deliberately conservative exact-definition identity. It is not a semantic-equivalence hash: harmless help/icon changes may change it, while two different implementations can still cook equivalent geometry.

## Current Best View

Neither whole-library SHA nor `Contents`-only SHA can replace the selected-definition bundle hash. Preserve transport and definition identities separately, then bind the cook receipt above them.

## Rejected

- “One `.hda` SHA uniquely identifies the selected node definition.”
- “`binaryUncompressedContents()` alone captures every behavior-affecting part of an HDA.”
- “Packed and expanded HDA representations must have the same raw hash.”
- “A normalized expanded-directory format can be treated as a stable vendor contract.”

## Unknown

- Actual Houdini extraction has not confirmed which option/interface values duplicate section material.
- The minimal behavior-affecting section set is intentionally not guessed.
- Cross-version stable semantic equivalence and cooked-geometry determinism remain unverified.

## Next gate

In the same future isolated Houdini Mother trial planned by H01, export all section names and exact bytes using HOM, plus options/interface/type data. Compare packed and expanded copies and a deliberately modified non-`Contents` section. Keep transport, definition and cooked-geometry comparisons separate.

First-tier expert AI: not called.
