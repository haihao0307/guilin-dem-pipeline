# N291 Mother 02:30 — ZX85USB v89 cabin/mirror integration gate

## Decision

`HOLD_GATE_FAIL / ROOT_CAUSE_REVIEW`. Version 89 is a fresh archive, but its relevant delta does not close the N289 cabin-parent or N290 physical-symmetry failures. Stop tuning or presenting this result as a whole-machine candidate. Preserve the last evidence-backed baseline; no production Mother, main branch, accepted baseline, or Site was changed.

## One bounded task

| Field | Evidence-bound value |
|---|---|
| taskId | `N291-ZX85USB-V89-CABIN-MIRROR-INTEGRATION-GATE` |
| targetObject | `ZX85-CAB`, concrete left/right rear-view mirrors, and the current whole builder |
| targetDefect | The cabin ownership tree is not consumed by the current whole; the mirror method is not replayable and implements zero actual mirror parts. |
| accepted baseline / baseSha | No user-accepted ZX85 replacement baseline found. Protocol base is current `main` at `8aec1b1dca9619c0b59fc8fa480f65f226be7145`. |
| user constraint | Cabin is the parent system; its door/windows/console/seat are children. Eligible left/right parts must reuse one source through controlled mirroring while real asymmetry remains explicit. |
| referenceSet / UNKNOWN | #91 N289/N290, v89 archive, `CABIN_OBJECT_TREE.json`, mirror script/receipt, Site v229. OEM mirror geometry/mount and v89-to-Site binding remain UNKNOWN. |
| forbidden routes | Generic/invented mirrors; whole-cabin or door-to-fixed-window mirroring; stored PASS as fresh run; child-to-whole bypass; old/unbound Site as v89 proof. |
| fresh head delta | v89 is new bytes (`52729e…`) and adds cabin R26 pedal/floor evidence. It does not add a concrete mirror pair or whole-tree binding. The mirror receipt is byte-identical to v81. |
| regression cases | N289 ownership and N290 dependency-closure cases rerun; both remain failing. |
| state | `HOLD_GATE_FAIL` |

`REPLICATION_LOCKED=true`; `CREATIVE_AUTHORIZATION=false`.

## Fresh probe

- Exact v89 archive: 31,252,070 bytes, SHA-256 `52729ec4b3d83dd2296450b19172ad1132818606b13e3bba25d1d74c3695fe5c`, 2,546 entries.
- Package manifest: 2,545 entries; zero missing and zero digest mismatches.
- Runtime closure: 2,333 relative imports inspected; 638 targets missing. The archive contains no `three.module.js` and no `.sites-checkout` directory.
- N290 replay: `node zx5a-cab-source-r25/cabin-complete/parameter-mirror-check.mjs` exits 1 with `ERR_MODULE_NOT_FOUND` for `front-r04-release/.sites-checkout/dist/boom-functional-r05/vendor/three.module.js`.
- `PARAMETER_MIRROR_CHECK.json` remains SHA-256 `a47eb460…`, identical to v81, and still states `realPartsMirrored: 0`.
- No filename or implementation identifier for a concrete rear-view/side-mirror pair was found. `symmetryPairId` has zero references.
- The current whole roots have zero references to `CABIN_OBJECT_TREE`, `ZX85-CAB`, `ZX85-CAB-CONSOLE`, or `ZX85-CAB-SEAT`.
- No Task Anchor, Delivery Receipt, or Publication Proof file is present.
- Site v229 is owner-custom access with zero external visitors and has no provenance binding to v89. Current-head desktop and 390×844 evidence are absent.

## Owner and minimum verification

**Responsible end:** ZX85 Cabin/System Mother, constrained to cabin ownership and concrete mirror reuse; the coordinator owns the gate definition and cross-module provenance check.

Minimum verification before another candidate review:

1. Clean extraction runs the mirror gate with exit 0 using only files in the exact checkpoint.
2. Concrete left/right mirror object IDs declare source, target, mirror plane, parity, deviation set, `ZX85-CAB` parent binding, and zero independently redrawn duplicate geometry.
3. The current whole builder consumes `CABIN_OBJECT_TREE`, exposes required-child states, and fails closed while required mounts/relations are missing.
4. A fresh receipt binds archive SHA, whole commit, Site version, desktop evidence, and 390×844 evidence. The external browser link must open and support the claimed interaction.

## Unfinished boundary and learning flywheel

This does not accept the cabin, rear-view mirrors, console, door, whole machine, or Site delivery. **交付未完成。**

Learning-flywheel question: how should the production protocol make dependency closure and archive→whole→Site provenance machine-verifiable, so a stored PASS file can never outlive its executable dependencies or be attached to a different displayed head?

Lifecycle: coordination record `POSTED / IMPLEMENTED / GATE-RUN`; Mother `ACKNOWLEDGED=false`; production `IMPLEMENTED=false`; `ADOPTED=false`; `USER-ACCEPTED=false`.
