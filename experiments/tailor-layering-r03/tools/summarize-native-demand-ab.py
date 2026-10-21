"""Derive transparent summaries from the native World A/B raw evidence."""
import collections
import json
import math
from pathlib import Path
import statistics
import sys

base = Path(sys.argv[1] if len(sys.argv) > 1 else "native-demand-ab-evidence")
source = json.loads((base / "summary.json").read_text())
assert source["passed"] and source["completedSteps"] == source["requestedSteps"]
assert source["sourceSHA256"]["r03-off"] == source["sourceSHA256"]["r03-on"], "R03 source changed between execution lanes"
for key, digest in source["sourceSHA256"]["r02"].items():
    if key.startswith("upstream/"):
        assert all(source["sourceSHA256"][name][key] == digest for name in ("r03-off", "r03-on"))
for row in source["states"]:
    assert all(c["exactParticleArrays"] and c["exactRenderedArrays"] for c in row["comparisons"].values())
    if row["step"]:
        a, b = (row["timings"][name]["execution"]["lastStepWork"]["layer"] for name in ("r03-off", "r03-on"))
        assert all(a[key] == b[key] for key in ("candidateVisits", "solveCalls", "measureCalls"))
result = {
    "schema": "kaopu-native-demand-ab-comparison@2",
    "passed": True,
    "inputMode": source["inputMode"],
    "inputBoundary": source["inputBoundary"],
    "inputSHA256": source["inputSHA256"],
    "physicalStatesChecked": len(source["states"]),
    "physicalSeconds": source["states"][-1]["physicalSeconds"],
    "testSHA256": source["testSHA256"],
    "statisticalScope": "Single serial same-process run with lane order rotated at every step. Timings describe this native CPU replay; they are not browser realtime or a statistical performance guarantee.",
    "lanes": {},
    "maxima": {},
}
for key in source["states"][0]["metrics"]:
    result["maxima"][key] = max(row["metrics"][key] for row in source["states"])
result["maxima"]["independentBodyHalfThicknessOverlapMM"] = max(
    row["independentBodyEnvelope"]["maxHalfThicknessOverlapMM"] for row in source["states"]
)
for name, lane in source["lanes"].items():
    steps = [row["timings"][name] for row in source["states"][1:]]
    wall = [step["wallMS"] for step in steps]
    stages = collections.defaultdict(float)
    work = {"layer": collections.defaultdict(float), "body": collections.defaultdict(float)}
    for step in steps:
        for key, value in step["stageTimingsMS"].items():
            stages[key] += value
        if step["execution"]:
            for domain, stats in step["execution"]["lastStepWork"].items():
                for key, value in stats.items():
                    work[domain][key] += value
    result["lanes"][name] = {
        "stepWallTotalMS": sum(wall),
        "stepWallMedianMS": statistics.median(wall),
        "stepWallMinMS": min(wall),
        "stepWallMaxMS": max(wall),
        "stepWallP95MS": sorted(wall)[math.ceil(len(wall) * 0.95) - 1],
        "stepCPUTotalMS": sum(step["processCPUms"]["total"] for step in steps),
        "stepCPUUserMS": sum(step["processCPUms"]["user"] for step in steps),
        "stepCPUSystemMS": sum(step["processCPUms"]["system"] for step in steps),
        "stageTotalsMS": dict(stages),
        "workTotals": {key: dict(value) for key, value in work.items()},
        "creationMS": lane["creationMS"],
        "wasmMemoryBytes": lane["wasmMemoryBytes"],
        "wasmReservedBytes": lane["wasmReservedBytes"],
        "staticBodyAccelerationArrayBytes": lane["execution"]["staticBodyAccelerationArrayBytes"] if lane["execution"] else None,
        "maximumPerStepParticleCoordinateChangeM": lane["maximumPerStepParticleCoordinateChangeM"],
    }
off, on = (result["lanes"][key] for key in ("r03-off", "r03-on"))
result["onVersusOff"] = {
    "wallTotalReductionFraction": 1 - on["stepWallTotalMS"] / off["stepWallTotalMS"],
    "CPUTotalReductionFraction": 1 - on["stepCPUTotalMS"] / off["stepCPUTotalMS"],
    "medianWallReductionFraction": 1 - on["stepWallMedianMS"] / off["stepWallMedianMS"],
    "totalWallSpeedRatio": off["stepWallTotalMS"] / on["stepWallTotalMS"],
}
for domain in ("layer", "body"):
    result["onVersusOff"][domain] = {}
    for key, old in off["workTotals"][domain].items():
        new = on["workTotals"][domain][key]
        result["onVersusOff"][domain][key] = {"off": old, "on": new, "reductionFraction": 1-new/old if old else None}
result["counterScope"] = {
    "layerCandidateVisits": "Original ordered solver candidate visits plus full residual-candidate visits from every measure call. Candidate traversal/order is unchanged.",
    "layerVertexFaceTestsAndEdgeEdgeTests": "Candidate-entry nearest-feature tests. Excludes closest-feature arithmetic inside sweeps, retargeting and samples; do not label this all exact geometry arithmetic.",
    "layerAdjacentFaceTests": "Feature-owner adjacent-face closest tests.",
    "bodyFeatureTests": "Instrumented body-envelope vertex-face and edge-edge tests.",
    "timingRelationship": "layerBroadphaseMS is nested inside layerContactMS; do not add it again as a separate total stage.",
    "memory": "Static body acceleration typed arrays only. Dynamic cloth caches, live bounds, JS objects and allocator overhead are excluded. Process RSS/heap/arrayBuffers snapshots include all three worlds and audits; they are not per-world memory measurements.",
}
(base / "comparison.json").write_text(json.dumps(result, indent=2) + "\n")

lines = [
    "# Native complete-World contact-demand A/B",
    "",
    f"**PASS**: frozen R02, R03 OFF and R03 ON matched at initialization and all {source['completedSteps']} accepted steps ({len(source['states'])} discrete states), including `outer push` before step 3 and `inner tug` before step 6. Physical progress reached {result['physicalSeconds']:.12f} seconds without a rollback.",
    "",
    "## Input and comparison boundary",
    "",
    source["inputBoundary"],
    "",
    "The same complete native body and three garments were restored separately for every world. Physical `p/v/old`, inverse masses, topology, initial/rest state, masses, constraints and saved state used typed-array byte comparisons. Rendered `positions/normals/indices` also used byte comparisons. Complete histories and all normalized snapshot/scalar values used deep strict equality, including signed zero. Excluded timing/work fields and the two R03-only explanatory strings are enumerated in `summary.json`; the strings themselves are recorded per lane.",
    "",
    "Each shared state was audited once after the three worlds proved identical. The independent audit covered complete nondegenerate cloth/body triangle pairs and full native-body half-thickness distances. No triangle intersections or degenerate triangles were reported. Every movable garment had actual particle motion. This does not establish continuous collision, self collision, arbitrary layering, dynamic-body behavior or rendered-yarn collision.",
    "",
    "## Physical gates",
    "",
    "| Metric | Observed maximum | Gate |",
    "|---|---:|---:|",
    f"| Dynamic edge stretch | {result['maxima']['maxEdgeStretch']:.12f} | 1.45 |",
    f"| Cloth contact residual | {result['maxima']['contactResidualMM']:.12f} mm | 0.5 mm |",
    f"| Seam gap | {result['maxima']['seamGapMM']:.12f} mm | 0.01 mm |",
    f"| Body particle half-thickness overlap | {result['maxima']['bodyThicknessOverlapMM']:.12f} mm | 0.001 mm |",
    f"| Independent triangle/body half-thickness overlap | {result['maxima']['independentBodyHalfThicknessOverlapMM']:.12f} mm | 0.001 mm |",
    "| Fixed-particle drift | Every state passed | 0.001 mm |",
    "",
    "## CPU replay timing",
    "",
    "| Lane | 8-step wall total | Per-step wall median | 8-step process CPU | Initialization wall |",
    "|---|---:|---:|---:|---:|",
]
for key, row in result["lanes"].items():
    lines.append(f"| {key} | {row['stepWallTotalMS']/1000:.3f} s | {row['stepWallMedianMS']/1000:.3f} s | {row['stepCPUTotalMS']/1000:.3f} s | {row['creationMS']/1000:.3f} s |")
lines += [
    "",
    f"ON reduced total wall time by {result['onVersusOff']['wallTotalReductionFraction']:.2%} and process CPU by {result['onVersusOff']['CPUTotalReductionFraction']:.2%} against R03 OFF in this run. Median per-step wall time changed by {result['onVersusOff']['medianWallReductionFraction']:.2%}. Lane execution order rotated at every step. Process CPU can exceed wall time because it includes all process threads. One eight-step run does not establish a stable performance distribution or a browser framerate.",
    "",
    "| Stage, sum over 8 steps | R03 OFF | R03 ON |",
    "|---|---:|---:|",
]
for key in off["stageTotalsMS"]:
    lines.append(f"| {key} | {off['stageTotalsMS'][key]/1000:.3f} s | {on['stageTotalsMS'][key]/1000:.3f} s |")
lines += [
    "",
    "`layerBroadphaseMS` is already included in `layerContactMS`; do not add both to a solver total.",
    "",
    "## Executed feature work",
    "",
    "| Counter, sum over 8 steps | OFF | ON | Reduction |",
    "|---|---:|---:|---:|",
]
for domain, key in [
    ("layer", "candidateVisits"), ("layer", "vertexFaceTests"), ("layer", "edgeEdgeTests"),
    ("layer", "adjacentFaceTests"), ("body", "triangleQueries"), ("body", "cacheHits"),
    ("body", "bvhNodeVisits"), ("body", "vertexFaceTests"), ("body", "edgeEdgeTests"),
]:
    item = result["onVersusOff"][domain][key]
    reduction = f"{item['reductionFraction']:.2%}" if item["reductionFraction"] is not None else "—"
    lines.append(f"| {domain}.{key} | {int(item['off']):,} | {int(item['on']):,} | {reduction} |")
lines += [
    "",
    "The cloth candidate order and traversal count remain unchanged. The VF/EE counters count nearest-feature operations at candidate entry, not every operation inside swept tests, retargeting or sample collection. Both R03 lanes used the same numbers of solve and measure calls; no contact-history reset or inactive-garment shortcut produced the savings.",
    "",
    "## Memory and evidence",
    "",
    f"Each world has {on['wasmMemoryBytes']:,} bytes of WASM memory and {on['wasmReservedBytes']:,} reserved solver-pool bytes. The R03 body acceleration arrays account for {on['staticBodyAccelerationArrayBytes']:,} extra bytes, present in both OFF and ON worlds. Dynamic cloth caches, live feature bounds, JS objects and allocator overhead are excluded from that static-array figure. Process memory snapshots in raw evidence cover all three live worlds plus snapshots/audits; they must not be represented as per-world allocation measurements.",
    "",
    "- `summary.json`: result, provenance, source and test hashes, every state, timings, counters and process memory.",
    "- `states.ndjson`: independently audited state records.",
    "- `comparison.json`: aggregates derived from those records.",
    "- `tests/native-demand-ab.mjs`: repeatable full-world harness in R03 source.",
]
(base / "REPORT.md").write_text("\n".join(lines) + "\n")
print(json.dumps({"passed": result["passed"], "steps": source["completedSteps"], "timings": {key: {k: v for k, v in row.items() if k.startswith("step") and not isinstance(v, dict)} for key, row in result["lanes"].items()}, "onVersusOff": {key: value for key, value in result["onVersusOff"].items() if not isinstance(value, dict)}, "maxima": result["maxima"]}, indent=2))
