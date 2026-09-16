# KAOPU Learning Log — Houdini HDA identity H01

## Question

Is a HIP scene plus an HDA type/version name sufficient to identify the procedural definition needed for deterministic Object DNA regeneration?

## Evidence and bounded method

Official SideFX Houdini 22.0 documentation was locked for asset installation/resolution, editing state, namespaced type resolution and `hou.HDADefinition`. A CPU-only manifest fixture then tested exact-definition, resolution, lock-state, context and external-input requirements. It does not execute Houdini.

The thirteen checks pass. Negative controls reject ambiguous type references, library paths without payload hashes, unresolved multiple-definition conflicts, selected-definition mismatch, unlocked/dirty instances, unhashed external inputs and implicit cook time. Two manifests with the same fully qualified type and user version but different definition payload hashes produce different artifact identities.

## Observation

- SideFX permits multiple definitions for one node type and exposes a configurable current/preferred definition.
- Embedded and external definitions can compete under configuration-dependent precedence.
- An unlocked instance can diverge from the saved/current definition.
- Type-name version and the user-defined Version field are separate systems; neither is a content hash.
- HOM exposes the inputs needed for a future runtime receipt: definition library path, type name, current/preferred state and uncompressed definition contents.

## Candidate

A reproducible KAOPU Houdini handoff should bind at least: Houdini build, fully qualified exact type name, exact definition payload hash, selected library source and resolution-order identity, current/preferred state, `matchesCurrentDefinition`, parameter state hash, cook frame/time/units/seed and hashes for every external input.

This is a candidate provenance gate, not a claim that the listed fields are sufficient for cross-machine bitwise geometry. Plug-in versions, compiled kernels, parallelism, floating-point backend, environment expansion, file-system case rules and nondeterministic solvers may add more dimensions.

## Current Best View

`.hip + HDA name/version` is insufficient Object DNA identity. The minimum handoff must distinguish definition identity, resolution policy and instance divergence before any cooked-output comparison is meaningful.

## Rejected

- “The highest numeric HDA version uniquely identifies the algorithm.”
- “A library path uniquely identifies immutable definition bytes.”
- “A locked-looking scene guarantees every instance matches the current definition.”
- “The Type Properties Version field is the same identity as the type-name version suffix.”

## Unknown

- Actual Houdini 22 runtime extraction and recook were not executed.
- Sufficiency for bitwise geometry across OS/CPU/GPU/builds remains unknown.
- Production Mother applicability, cost and acceptance remain unknown.

## Next gate

In one isolated Houdini Mother trial, extract a receipt with `hou.HDADefinition` and `matchesCurrentDefinition`, hash the uncompressed definition contents and external inputs, then recook twice under the same build/context and once with a deliberately competing definition. Compare semantic geometry hashes separately from bytewise files. Do not change production Object DNA or Canonical Truth.

First-tier expert AI: not called.
