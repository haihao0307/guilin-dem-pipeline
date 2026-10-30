# KAOPU Learning Flywheel N219 — NVIDIA USD BRep：kernel success ≠ surface truth

## Bounded question

When a CAD/BRep kernel reports `SUCCESS`, is that enough to promote the generated Mechanical/Motor surface relation, or must the exact output also pass representation, geometric and operation-semantic postconditions?

## Current baseline re-read

- `main@3ccae4bde0c91973adbb81f99ec4d54bc9357ce0`
- root `AGENTS.md` blob `251b664646a489e9292748f1d41998ee62a338f5`
- R2 OS blob `d942d44bad0bbd206ea3768d620ad60d5ddeb2bf`
- reference gate blob `8c0a49c71865ef76cbc614f8188239bc808a8278`
- freshness gate blob `4754a90a94e4a9e7806357b6eb292e5c713e9021`
- #91: N218 remains `POSTED / candidate checker GATE-RUN`; no Mother acknowledgement or production gate run after it.
- #63: no new Coast evidence after N49.

## New source lead

Four user-supplied screenshots point to NVIDIA-Omniverse/USD BRep and ClassCAD/SMLib. The primary source selected for evaluation is the official NVIDIA repository:

- repository: https://github.com/NVIDIA-Omniverse/usd-brep
- pinned revision: `3fd5b9548d19aa8c12c29bc9637a96d42a06f8a5`
- release: 1.0.1, changelog dated 2026-10-21; release commit published 2026-10-22
- license: Apache-2.0; repository third-party notices still apply

## What this teacher knows beyond KAOPU Current Best View

N218 already requires executable equations, finite domains, patch adjacency, C0/G1/G2 joins and reference-section residuals. USD BRep adds two narrow but material lessons:

1. **Exact representation structure.** `BrepArray` binds regions, shells, faces, loops, edgeuses, edges and vertices to NURBS or analytic surfaces/curves. Its analytic surface set includes plane, cylinder, cone, sphere and torus; NURBS covers other forms.
2. **Validation layers are not interchangeable.** The Python validator checks serialized array structure, topology indices, NURBS data and selected manifold constraints, while the official documentation explicitly says it is not a substitute for kernel-backed geometric validation.

The open 1.0.1 issue set adds the decisive third lesson: even a kernel-backed operation status and generic validity can be insufficient.

- Issue #36: `SmApiShellBrepFull` returns `SM_SUCCESS`, while the result is non-manifold and fails `AssertValid` with loop-orientation and UV-gap failures.
- Issue #35: boolean difference/intersection between two individually valid ruled skins returns `SM_SUCCESS` but a semantically wrong output; the empty difference can itself pass generic validity, so only operation-specific volume/containment expectations catch it.

Therefore the transferable method is:

`bound input/output subjects -> schema validation -> kernel geometry validation -> operation-specific semantic postconditions -> independent verifier`

`kernelStatus=SUCCESS` is only an execution observation.

## Teacher screening

| Check | Finding |
|---|---|
| Source/provenance | Official NVIDIA-Omniverse repository and documentation |
| Maintenance | Public 1.0.0 on 2026-10-08/09, 1.0.1 on 2026-10-21/22; active issue/release activity |
| Runnable evidence | C++/Python APIs, examples, full build/test instructions, schema and kernel validators |
| License/rights | Apache-2.0; retain notices and inspect third-party notices before reuse |
| Direct relevance | Exact surface/topology representation and verifier design for Mechanical/Motor |
| Novelty | Adds operation-postcondition closure beyond N218's static patch relation receipt |
| Dependencies/cost | C++ kernel, OpenUSD/Python 3.12 toolchain; Linux/Windows wheels, limited macOS; not browser-native |
| Failure boundary | Current silent-success, invalid-output and semantic-wrong-output cases; malformed topology can crash import |

Decision: `TEACHER_CANDIDATE`, not `AUDITION`, `PROBATION` or `ACTIVE_TEACHER`.

## What not to adopt

- Do not import its tessellation or polygon display path into KAOPU's triangle-free production runtime.
- Do not make OpenUSD/SMLib a global runtime dependency from source review alone.
- Do not treat successful booleans, fillets, sweeps, offsets, healing or transforms as accepted geometry without exact-subject postconditions.
- Do not copy a BRep or mesh from an external reference as a substitute for KAOPU's own function construction.

## Candidate translation

The existing regression `MECHANICAL-SURFACE-RELATION-NOT-SHAPE-LABEL-001` is extended rather than duplicated.

New receipt fields:

- kernel name/version/revision and operation parameters;
- input and output subject digests;
- schema-validation subject/verdict;
- kernel-geometry-validation subject/verdict;
- operation-specific postcondition manifest and results;
- independent verifier identity.

Minimum postconditions depend on the operation. Examples:

- boolean difference: output non-empty where expected; volume within expected bounds; output does not add material; removed region is absent;
- union: output contains both operands and expected material volume;
- transform/mirror: analytic types, orientation, units and tolerances are preserved or explicitly converted;
- shell/offset: manifold/material census, loop orientation, wall-thickness bounds and no self-intersection;
- sweep/fillet: input ownership, expected face/edge relations and reference-section residual.

## Minimal replay

The source/synthetic classifier now contains the 11 N218 controls plus 6 operation controls. Result: `17/17 PASS`.

This does not run the NVIDIA kernel. It only proves that the proposed receipt distinguishes:

- `SUCCESS` without bound subjects;
- missing/failed schema validation;
- `SUCCESS` with kernel-invalid output (#36);
- `SUCCESS` with generic-valid but semantically wrong boolean output (#35);
- a complete positive receipt, which still receives only `CANDIDATE_SURFACE_RELATION_ELIGIBLE_NOT_REFERENCE_ACCEPTED`.

## Smallest falsifiable audition

On one exact Mechanical/Motor part and one operation only:

1. map the existing function patches to a BRep-like topology record without tessellation;
2. freeze input/output digests and operation parameters;
3. inject one topology-invalid negative control and one semantically wrong but generic-valid negative control;
4. require the three validation layers to reject the controls while the honest candidate passes;
5. compare the same exact output against its matched reference sections in the existing KAOPU renderer.

Mother must select the exact part and operation. Until then: `NOT_QUERIED / UNKNOWN`.

## Lifecycle

- `POSTED=true` — routed to coordinator issue #91
- `ACKNOWLEDGED=false`
- `IMPLEMENTED=true` — Candidate checker only
- `GATE-RUN=true` — source/synthetic replay only
- `ADOPTED=false`
- `USER-ACCEPTED=false`

No production Mother, main, R2 OS, root AGENTS, renderer or global gate was modified.
