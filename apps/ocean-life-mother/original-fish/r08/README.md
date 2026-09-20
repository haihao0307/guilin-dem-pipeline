# Original Fish R08 — Tuna high-fidelity restart

R08 replaces the rejected low-dimensional Tuna R02/R10 line.

Current deliverable is a **source benchmark**, not a native fish candidate. It reads the exact FISH-REF-002 source locally, freezes calibrated side/three-quarter/front/top reference views, stores 256-point silhouettes, reconstructs the 98-joint bind-pose inventory from inverse-bind matrices, and records source skin-influence partitions.

Direct files:

```text
RESTART_ORDER.md
SOURCE_BENCHMARK_CONTRACT.md
REJECTED_LINEAGE.json
benchmark/SOURCE_BENCHMARK_R01_SUMMARY.json
tools/source_benchmark.py
tests/source-benchmark.test.mjs
QA_RECEIPT.json
```

Reproduction:

```bash
python tools/source_benchmark.py /path/to/tuna_fish.glb --out /tmp/tuna-benchmark
node tests/source-benchmark.test.mjs
```

The exact source GLB is required locally and must match an accepted SHA-256. The public repository does not contain source binaries, textures, complete source mesh arrays, inverse-bind arrays or animation tracks.

Current gate:

```text
anatomicalPartitionAccepted=false
nativeCandidateAllowed=false
visualAcceptance=false
productionReady=false
```
