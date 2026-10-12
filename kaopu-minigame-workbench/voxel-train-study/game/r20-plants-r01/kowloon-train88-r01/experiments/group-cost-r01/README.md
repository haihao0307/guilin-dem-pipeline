# Fixed-sample GPU query attribution

Isolated QA only. No host entry, geometry, mother material, world state, march step or public page changes.

The published 32×24 input retains all 768 actual terminal ray records from 582ed637/run38301469129 (276 hits, 492 misses), with original camera matrices and state. A second set is initialized by the unchanged original ray initializer. It is not a distribution of intermediate marching points, and measurements cannot be called complete-scene cost shares.

The controller clone reverses byte-for-byte to the original 7d36 query receiver after removing an explicit begin/end observer and adjusting relative import paths. The original 12 compact shaders run in canonical order; original 4-MRT queries validate full and alternate outputs, and frozen full terminal metadata validates seed, base distance, q, extents, source seed and hit ID.

Cold first-use samples are recorded separately. Exactly three warmed rounds measure both input sets, full and roof/floor alternate queries, using GPU elapsed-time queries per original group. Timers are non-nested and collected after the experiment. Same-sized 12-pass exact copy chains provide a transfer/dispatch comparison. Copy time is not a subtractable exact geometry baseline. CPU submission and wall-through-final-readback times are retained independently.

One additional un-timed sweep reads every group's actual compact prefix. It records raw contribution counts, changed winners and overflow flags without adding readback fences inside measured warm dispatches. All warm/final outputs must match cold outputs bit-for-bit. Disjoint or missing GPU timers fail attribution.

The process is bounded to 600 seconds overall and 120 seconds without group/stage progress. It retains intermediate receipts and forcibly closes only its owned QA browser if normal cleanup stalls. It creates no screenshots or gameplay render. The full unchanged preflight runs in CI; local fixture/source-contract tests are standalone.

Only terminal/full is the first use of the compact pipeline. The other records tagged cold are first samples of their dataset/mode but reuse compiled programs; firstUseClass distinguishes them. They are excluded from the three warm repetitions and must not be interpreted as independent cold compilation costs.
