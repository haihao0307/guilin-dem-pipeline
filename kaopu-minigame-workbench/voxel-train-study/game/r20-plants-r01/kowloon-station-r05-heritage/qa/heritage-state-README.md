# Heritage state consistency probe

This is a small numeric regression, not an image, render-model change, or visual acceptance test. It extracts `evaluateStationGeometry` and `evaluateStationMatter` and their exact dependencies from the production `WGSL` using the existing `kowloon-train88-r01/shader-closure.mjs`.

Seven heritage fixtures cover brick, stone, actual sash timber, hall plaster, ID 19 concrete, the finite tower interior lining, and a finite diagonal lantern brick facet. Four controls cover bench timber, platform concrete, shed roof, and waterfront stone. Each runs at ages 0, 0.5, and 1. Most fixtures are explicit nominal material samples; they do not claim to ray-intersect the architecture. The timber sample uses the current generated member's actual source ID, seed, center, and extents.

The 11 × 4 RGBA32F target contains:

- Row 0: geometry distance, matter distance, actual matter layer, sample identity
- Row 1: actual mother-bound albedo and roughness
- Row 2: actual microheight, geometry loss, geometry thickness, nominal distance
- Row 3: actual once-resolved member age, wetness, repair, retained age

Assertions require finite outputs, distance agreement within 1e-8 m, expected layers and sample identities, correct age mapping, nonempty material outputs, and nonzero mother displacement for every fixture across the three ages. No CPU material implementation replaces the real closures. Compile/link diagnostics and all raw floats are saved.

## Commands

Run from `kowloon-station-r05-heritage` in the repository layout, with the existing pinned Naga bridge built and the existing Playwright installation available:

```sh
node qa/heritage-state-emit.mjs
timeout 240s ../kowloon-train88-r01/compiler/target/release/kaopu-station-shader-bridge \
  qa/heritage-state-generated/probe.wgsl \
  qa/heritage-state-generated/probe.frag heritageStateProbe
node qa/heritage-state-run.cjs
```

If the bridge is not built yet, build its existing pinned project without changing its source or lockfile:

```sh
(cd ../kowloon-train88-r01/compiler && cargo build --release --locked)
```

The emitter's optional `HERITAGE_CLOSURE_MODULE` points to the same existing closure module when auditing a detached directory. Default resolution uses the repository sibling. The browser runner enforces a 240-second shader compilation limit and one 120-second readback window for all 33 samples, then performs bounded cleanup of only its own Chromium process.

Outputs stay under `qa/heritage-state-generated/` and `qa/heritage-state-results/`. A failed compile, timeout, context loss, bad readback, state mismatch, or empty material response is a failing result. A pass establishes this numeric contract only; it does not establish station image, integration, or hardware performance acceptance.
