# Finite-domain timber emitter equivalence

This regression compares the production unrolled `completeTowerTimber` with the separate single-loop experiment. It does not replace the production tower module, render the station, simulate timber on the CPU, or claim equivalence outside its tested domain.

`heritage-timber-loop-candidate.mjs` is a QA snapshot of the supplied `native-clock-tower-loop-candidate.mjs`. Its only import-path adaptation points the retained R04 import to `../native-clock-tower-r04.mjs`. The emitter verifies identical construction descriptors and identical generated WGSL outside the timber function. It renames only the two function declarations and selects their shared exact production dependency closure through the existing `shader-closure.mjs`. Candidate ordering, strict comparisons, the 30.01mm prune test, material closure calls, and raw-winner reset remain unchanged.

## Samples and outputs

- All 144 timber members: six face centers, twelve edge centers, eight corners, each at -0.2mm, zero, and +0.2mm along its outward direction
- Per member: five additional probes around the 30.01mm and 45mm distance boundaries
- Six face centers of each window jamb, sill, head, and pediment-base stone box
- Window-aperture centers, sides, and corners, with ±0.2mm depth offsets
- Ages 0, 0.5, and 1, using the same original uniform parameters and actual mother functions

The input texture contains authored test coordinates only. Four RGBA32F attachments read back every field of each reference/candidate HitField, a recomputed actual physical distance, and the input point/tag. Each sample occupies two output rows, reference then candidate. IDs and sourceSeed winners must agree exactly; all floating fields and physical distances must agree within 1e-7m. Sentinel checks, finite checks, valid member IDs, positive extents, raw-distance reset, and nonzero physical displacement reject empty or raw-only output.

Full raw float buffers, first mismatch records, fieldwise maximum errors, winner IDs, timings, hashes, and shader diagnostics are saved. The maximum error report also exposes differences below the acceptance tolerance. Compilation is bounded to 240 seconds and all three age readbacks to a single 120-second window. A timeout is a failure, never equivalence evidence.

## Commands

From the station candidate directory in the repository layout:

```sh
node qa/heritage-timber-emit.mjs
timeout 240s ../kowloon-train88-r01/compiler/target/release/kaopu-station-shader-bridge \
  qa/heritage-timber-generated/probe.wgsl \
  qa/heritage-timber-generated/probe.frag heritageTimberProbe
node qa/heritage-timber-run.cjs
```

Use the existing pinned Naga bridge and Playwright installation. If needed, build the unchanged compiler with `(cd ../kowloon-train88-r01/compiler && cargo build --release --locked)`. `HERITAGE_CLOSURE_MODULE` may point to that same extraction module in a detached audit directory.

Generated inputs stay under `qa/heritage-timber-generated/`; results stay under `qa/heritage-timber-results/`. This is a finite-domain numeric regression, not an all-domain proof, visual acceptance, or performance claim.
