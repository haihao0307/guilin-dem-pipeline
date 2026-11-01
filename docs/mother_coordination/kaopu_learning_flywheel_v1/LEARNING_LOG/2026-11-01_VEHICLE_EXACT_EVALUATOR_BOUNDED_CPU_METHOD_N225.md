# KAOPU Learning Flywheel N225 — frozen R08 exact evaluator bounded CPU method

## One bounded question

Can the R08 generic exact-evaluator optimization be accepted as a bounded method Candidate without turning a local CPU equivalence result into whole-car, GPU, realtime, or total-instance-collapse proof?

## Exact subjects

- main baseline: `4f59489d3a399034e82190cae9b41d3e92a5942b`
- optimization backup: `KAOPU_VEHICLE_R08_EXACT_EVALUATOR_OPT_R01_PRIVATE.zip`
- optimization backup SHA-256: `60394ddb2518bad3f9c2978b812460c54c2eaafd0968396084bc04530721c7c4`
- prerequisite v24 checkpoint SHA-256: `81fbd0166cb21d74deff6c86dc3079688302461c3bb90e70a58fe1b7b7cded0a`
- frozen assembly SHA-256: `4fe3e7a84015e20f709d7788a01721d36ac2aa0735d5c27b30c2f1ba9195ad50`

The small optimization backup is honest about its boundary: it verifies 68 packaged files but omits the full R08 parameter bundle. A direct full replay correctly failed on the missing `runtime/assembly/parts-r08.json`; the synthetic 14-type smoke is not accepted as a vehicle substitute.

Following its restore contract, the exact v24 checkpoint was restored separately and its archive and assembly hashes matched. Only `runtime/optimized-r01/` and `tests/whole-r08-optimized-r01/` were copied into that isolated restore. Canonical runtime paths, production branches, previews, registries, and assets were not changed.

## Independent replay

Full compatibility rerun:

- 5,397 definitions, 1,462 objects, 14 ordinary geometry types;
- 217,506 full differential evaluations;
- 108,989 trim classifications;
- 3,241,815 number comparisons;
- zero point/derivative/normal/regularity/trim mismatches;
- 1,186 compiled-supported roots and 276 original guarded-core roots;
- mixed old/new evaluator brand use rejected.

One fresh 800×600 Node CPU frame per implementation:

- original: 10,697.055912 ms;
- optimized: 6,434.036247 ms;
- observed ratio: 1.662573150250392×;
- RGBA, depth, and object-ID arrays byte-identical;
- changed RGB pixels: 0.

The timing is a one-pair shared-cloud observation, not a stable performance estimate or a gate. The acceptance discriminator is exact subject binding plus exact jet/trim identity, fail-closed brand separation, and byte-identical output arrays.

## Decision

`ACCEPT_R08_EXACT_EVALUATOR_OPTIMIZATION_AS_BOUNDED_CPU_METHOD_CANDIDATE_NOT_RUNTIME_ROUTE`

What is accepted at Candidate level:

- compile identical spline recurrence structure once;
- reuse exact-number basis work without parameter rounding/interpolation;
- hoist unchanged homogeneous controls while preserving accumulation order;
- scope duplicate-DAG memoization to one public call;
- keep outputs caller-owned and reject mixed brands;
- require exact subject, full differential/trim coverage, output-array hashes, and explicit fallback policy.

What is not accepted:

- whole-car shape, completeness, source fidelity, optics, or user acceptance;
- removal of the inherited 15 grid caps or 1.8526176419705027 px tangent-probe error;
- browser, phone, GPU, WebGPU, or realtime performance;
- N221 compute-storage-canvas implementation;
- N222 total-instance evaluation collapse;
- permanent dual-kernel maintenance or production integration.

## Candidate translation

The existing N222 regression is extended instead of creating a duplicate case. A valid evaluator replacement receipt now binds baseline checkpoint/assembly/evaluator digests, candidate evaluator digest and brand, type/jet/trim coverage, mixed-brand negative control, render subject/camera, RGBA/depth/object-ID digests, timing environment and repetition count, scope exclusions, fallback policy, and independent verifier.

Strict lifecycle at this record: Candidate checker `IMPLEMENTED`; exact-v24 CPU compatibility/render `GATE-RUN`; Mother `POSTED_PENDING_ACKNOWLEDGEMENT`; production `IMPLEMENTED`, browser/GPU `GATE-RUN`, `ADOPTED`, and `USER-ACCEPTED` are not established.

