# KAOPU Learning Cycle — Substance R32 graph replay contract

Date: 2026-09-11
Queue item: LQ-SUBSTANCE-001
Status: Candidate partial. Not Frozen. Not formal KAOPU R2.
Production Mother mutation: none.

## Bounded question

Which Substance 3D Designer graph practices transfer into KAOPU as a reversible material data-generating contract, without treating a texture export or SBSAR package as Object DNA truth?

## Logical corrections before adoption

1. “Procedural” does not mean “replayable from any published artifact.” Adobe documents SBSAR as a one-way published format which cannot be decompiled back to editable SBS.
2. “Exposed parameters” are not the entire function state. Output size, format, pixel size, tiling and random seed may arrive through inheritance; static parameters can disappear from the runtime interface after cooking.
3. “Physical size” metadata is useful scale context, not physical observation evidence.
4. A changing Substance `$time` is engine uptime. It cannot stand in for KAOPU historical/world time without an explicit mapping.
5. A generated bitmap is a derived evaluator result. Even lossless pixels do not preserve the authoring graph, hidden inheritance, engine behavior or evidence lineage.

The practical constraint is that no Adobe Substance executable was available in this environment. This cycle can authenticate documentation and test a manifest contract, but cannot claim Substance runtime determinism, visual quality or performance.

## Observation Roots kept distinct

### O-SUB-R32-ADOBEDOCS — pinned official documentation set

All pages are from one AdobeDocs repository state, commit `4524a7a6582a11f9b6d68b1878371b1672b96040`. They are multiple supporting assets from one documentation root, not six independent Observation Roots.

- [Graph parameters](https://github.com/AdobeDocs/substance-3d-designer.en/blob/4524a7a6582a11f9b6d68b1878371b1672b96040/help/compositing-graphs/graph-parameters/graph-parameters.md): output size, bit depth, pixel size, tiling and random seed are graph base parameters; graph Identifier is unique while Label is UI-facing; Physical size records world dimensions.
- [Inheritance](https://github.com/AdobeDocs/substance-3d-designer.en/blob/4524a7a6582a11f9b6d68b1878371b1672b96040/help/compositing-graphs/inheritance-compositing/inheritance-in-substance-compositing-graphs.md): Absolute, Relative to input and Relative to parent alter effective resolution, precision, tiling and seed downstream; published parenthood is preserved.
- [Exposed parameters](https://github.com/AdobeDocs/substance-3d-designer.en/blob/4524a7a6582a11f9b6d68b1878371b1672b96040/help/compositing-graphs/manage-parameters/exposing-a-parameter/exposing-a-parameter.md): exposed identifiers and labels are separate; static parameters cannot change after cooking and are hidden in published SBSAR.
- [Publishing SBSAR](https://github.com/AdobeDocs/substance-3d-designer.en/blob/4524a7a6582a11f9b6d68b1878371b1672b96040/help/compositing-graphs/publishing-asset-files/publishing-substance-3d-asset-files-sbsar.md): SBSAR is standalone and dynamic, but cannot be decompiled to editable SBS; engine feature versions affect compatibility; outputs need identifiers, labels and usage tags.
- [Incorrect image output](https://github.com/AdobeDocs/substance-3d-designer.en/blob/4524a7a6582a11f9b6d68b1878371b1672b96040/help/technical-issues/incorrect-image-output/incorrect-image-output.md): precision and resampling/filtering choices can propagate and produce banding, blur or quality loss.
- [Built-in variables](https://github.com/AdobeDocs/substance-3d-designer.en/blob/4524a7a6582a11f9b6d68b1878371b1672b96040/help/function-graphs/variables/system-variables/system-variables.md): size/tiling/physical-size are queryable context; `$time` is seconds since Substance Engine start.
- [Function graph](https://github.com/AdobeDocs/substance-3d-designer.en/blob/4524a7a6582a11f9b6d68b1878371b1672b96040/help/function-graphs/the-function-graph/the-function-graph.md): functions have a typed single output and type mismatch prevents assigning the output.

Authority boundary: official software semantics, not material physics and not current Mother acceptance.

### E-SUB-R32-PROBE — derived executable evidence

`PROBES/substance_graph_contract_probe_r32.py` is a coordinator-authored linter. It is not a physical Observation Root and it does not execute Substance Engine.

## Transferable contract

A KAOPU material generator candidate should bind:

- editable source graph identity/hash;
- optional published evaluator-package identity/hash;
- engine/tool version and compatibility target;
- stable graph/node/output identifiers separately from UI labels;
- typed exposed parameter values and whether each is static or dynamic;
- resolved effective output size, format/bit depth, pixel size, tiling, seed and physical size;
- inheritance lineage for each context value;
- explicit KAOPU world-time mapping; never implicit engine uptime;
- typed outputs with semantic, units, value range/encoding and color space;
- dependency ledger, including any bitmap/resource inputs;
- evaluation request key and derived output hashes;
- graph/source provenance distinct from visual/physical evidence.

Under current Mother rules, external bitmap/texture prohibition remains in force. Substance is studied as a method and optional authoring/evaluation reference, not adopted as the production storage format.

## Executed evidence

The nine-test probe passed:

1. a complete manifest passes;
2. SBSAR-only provenance is blocked;
3. an inherited seed without resolved value is blocked;
4. resolved value without inheritance lineage is blocked;
5. engine uptime cannot satisfy required world time;
6. a static parameter cannot be promised as a runtime control;
7. output semantics require units;
8. forbidden external bitmaps are blocked;
9. changing resolution changes derived request/cache identity while preserving editable source identity.

This is schema/contract evidence only. No SBS/SBSAR cook, render, GPU test, image comparison, mobile test or human acceptance occurred.

## Current Best View

Treat Substance practice as a four-layer adapter:

`Editable graph source → resolved evaluation context → published/runtime evaluator → typed derived outputs`.

The source graph and evidence ledger remain authoritative for reconstruction. SBSAR may be a deployable evaluator cache, and bitmaps may be output caches; neither replaces the source or becomes a new Observation Root.

Inheritance is a dependency graph, not a convenience flag. Record both the declared inheritance method and the effective resolved value used by a specific evaluation.

## Status ledger

- Observation: pinned Adobe documentation semantics.
- Candidate: MaterialGeneratorManifest and the nine-test linter.
- Current Best View: preserve editable source, resolved context, evaluator package and output cache as distinct identities.
- Frozen: KAOPU R1 and all approved Mother baselines unchanged.
- Rejected: SBSAR as reversible canonical source; UI label as stable machine ID; exposed controls as complete graph state; engine uptime as world time; output texture as Object DNA truth.
- Unknown: authoritative runtime replay, engine-version drift, actual output determinism, cross-resolution visual behavior, mobile cost and physical material validity.

## Routing

Prepared for KAOPU coordinator and material-bearing Mothers. No Mother feedback or adoption was observed. See `MOTHER_ROUTING_R32_SUBSTANCE_GRAPH_REPLAY.json`.

No independent external-AI review was performed; no unavailable access is claimed.
