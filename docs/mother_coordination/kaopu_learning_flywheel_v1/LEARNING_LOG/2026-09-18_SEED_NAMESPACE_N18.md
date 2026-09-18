# KAOPU Learning Note — N18 seed namespace and fan-out contract

Date: 2026-09-18  
Bounded question: What does the fixed V2.6 package's nine-layer seed separation actually guarantee?

Status: **Candidate partial / fixed-source CPU dependency audit verified; statistical independence, receiving-Mother implementation, target runtime and user acceptance Unknown**

## Observation roots

### Observation root A — mature seed contract

[SideFX Houdini 22.0 `rand`](https://www.sidefx.com/docs/houdini/vex/functions/rand.html) states three distinct properties: a seed determines a repeatable result, varying the seed changes the result, and the output interval is explicitly `[0,1)`. It also warns that tiny seed changes may give different values across operating systems or compilers. This is transferable evidence that a procedural seed contract should declare repeatability, interval and portability separately. It does **not** claim that differently named seeds or their downstream fields are statistically independent.

### Observation root B — fixed V2.6 transfer source

The audited source remains locked to `haihao0307/HOUSE@c6223d36ceeb827e3894fc181340c284b1cbfa73`. The package contract lists nine seed layers and prohibits a color seed from changing geometry. The two exact source blobs are `cb84cae8…` for the continuous kernel and `b28e0daf…` for event geometry.

For the locked deep-pore child preset, all nine derived integers are distinct. However, labels do not describe the actual dependency graph:

- `detail` drives `domainWarp3`; every later continuous field samples the warped coordinate. Changing only `detail` therefore changed every primary field in the bounded fixture: rugged, strata, micro-erosion, plate edge, flow, rock map, protrusion, cavity and separation, plus continuous geometry offset.
- `weather` directly changes micro-erosion and therefore changes continuous geometry offset.
- `pore`, `color` and `water` changed their intended masks/material outputs but did not change the package's continuous geometry-offset function in the fixture.
- The event kernel is separately partitioned: only damage, pore, weather and inclusion seed its event streams. Master, shape, color, water and detail produced byte-identical event descriptors.
- Master and shape have no consumer in either audited reference kernel. They are present ABI names, not demonstrated output controls in this package revision.

This is source and executable behavior of a prepared transfer package, not evidence that Landscape or another Mother implemented it. The withdrawn Landscape PR #80 remains prohibited.

### Observation root C — bounded executable probe

The N18 fixture changed one named seed at a time by `+1` across 1,536 fixed 3D samples and hashed the complete event descriptors. All `13/13` gates passed locally. A count-only check would have missed real changes: damage, weather and inclusion changed event descriptor hashes while leaving every event count unchanged.

The same probe sampled the nine raw `valueNoise3` streams at 6,144 coordinates. The largest observed absolute Pearson correlation was `0.084434` for color/detail; the same-seed control was exactly `1`. This is useful as a negative screen for an obvious linear coupling in this bounded window, but it is not a proof of independence, nonlinear decorrelation, spectral quality or downstream independence. All sample paths share the same source implementation and test design.

## Candidate

A reusable procedural seed ABI should publish a dependency matrix, not only a list of seed names. For every output, record:

1. direct seed consumers;
2. shared coordinate transforms or parent masks that create indirect fan-out;
3. whether the promised property is repeatability, output invariance, finite-sample decorrelation or physical independence;
4. seed range, integer wrapping and runtime portability;
5. an executable mutation gate that compares full descriptors, not only counts or summaries.

Use the word “independent” only with a named property and test. In the current V2.6 reference, “color seed does not alter continuous geometry offset” is verified. “All nine seed layers produce independent output fields” is not supported and is contradicted by the shared detail-domain warp.

## Current Best View

N14–N17 established integer portability, collision limits and float-mapping boundaries. N18 adds the missing graph-level contract: even distinct, decorrelated integer streams can become coupled after shared coordinate warps, masks and composites. Seed namespace separation is therefore necessary for controllability but insufficient for downstream independence.

The current V2.6 package remains a useful candidate because its direct event streams and color/geometry boundary are inspectable. Its next receiving-Mother gate is a versioned dependency receipt against the real implementation, not another claim based on the nine labels.

## Frozen

- Canonical Truth, Frozen R1 and every production Mother branch remain unchanged.
- The V2.6 transfer package remains prepared learning material, not production adoption.
- Landscape PR #80 remains withdrawn and prohibited.
- N14–N17 integer, identity and float-mapping findings remain unchanged.

## Rejected

- “Nine distinct seed values imply nine independent fields.”
- “A low Pearson correlation in one sample window proves independence.”
- “Color-seed geometry isolation proves every seed is isolated.”
- “Unchanged event counts prove unchanged events.”
- “An unused named seed already provides a working control.”
- “A transfer-package result proves receiving-Mother implementation or acceptance.”

## Unknown

- Actual dependency matrices in current Landscape, Brick R8 and Farmland implementations.
- Nonlinear, spectral and larger-domain correlations.
- Seed aliasing under all accepted inputs and cross-runtime portability outside the locked preset.
- Browser, hardware GPU, mobile performance and visual impact.
- Mother acknowledgement, implementation version, public/device checks and user acceptance.

## Routing recommendation

Landscape PR79 has no acknowledgement of the immediately preceding N17 warning, and Brick PR15 has no response to N09. N18 routing is therefore prepared but not posted: if a Mother implements this package, require the fixed source commit, a seed-to-output dependency matrix, full-descriptor mutation hashes and target-runtime evidence. Do not repeat-trigger existing threads.

First-tier expert AI was not called; routine cross-AI discussion remains owned by the separate expert task.
