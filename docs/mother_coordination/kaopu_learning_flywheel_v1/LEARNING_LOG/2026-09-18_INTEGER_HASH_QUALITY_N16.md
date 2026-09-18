# KAOPU Learning Note — N16 2D integer-hash quality and identity boundary

Date: 2026-09-18  
Bounded question: Does the N14/N15 32-bit pair hash behave adequately on spatially adjacent 2D cells, and may its output be treated as a unique Cell identity?

Status: **Candidate partial / pinned-source CPU and CI fixture verified; production workload, device cost and Mother adoption Unknown**

## Observation roots

### Observation root A — pinned upstream function and stated criterion

The current N14 mixer is the `lowbias32` permutation published in the author's [Hash Function Prospector source at `396dbe2`](https://github.com/skeeto/hash-prospector/tree/396dbe235c94dfc2e9b559fc965bcfda8b6a122c). The source defines avalanche score around the ideal that each output bit flips with 50% probability after one input-bit flip. It reports exhaustive single-input bias `0.17353355999581582` for the current constants and `0.10760229515479501` for a newer two-round parameter set. The repository is dedicated to the public domain through its `UNLICENSE`.

Those upstream values apply to one 32-bit permutation. They do not validate KAOPU's 64-bit `(x,y)` to 32-bit pair composition, spatial neighborhoods, serialization or production use.

### Observation root B — deterministic spatial fixture

The N16 C++20 probe evaluates three pair functions:

1. the current N14 `lowbias32` pair composition;
2. the newer same-round-count parameters as a comparison candidate only;
3. a deliberately weak XOR/rotate pair as a negative control.

The fixed fixture contains:

- one centered `1024 × 1024` grid (`1,048,576` cells);
- sixteen non-overlapping translated `512 × 512` windows;
- horizontal and vertical adjacent-cell bit-flip measurements;
- `65,536` deterministic coordinate pairs with every one of 64 input bits flipped against every one of 32 output bits;
- concrete collision witnesses, low-byte histograms and birthday-collision expectations.

The successful [GitHub Actions replay 35296585484](https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/35296585484) reproduced the committed JSON byte-for-byte and passed `7/7` gates.

### Observation root C — current pair-hash results

For the centered million-cell grid, the current pair hash produced `144` colliding pairs versus a random 32-bit birthday expectation of about `128`. Sixteen translated windows averaged `10.0` colliding pairs versus an expectation of about `8.0`, with a range of `2–24`. This bounded sample does not show catastrophic clustering, but it proves the output is not unique.

Concrete counterexamples include:

- cells `(-383,-383)` and `(19,19)` both map to `0x034f3275`;
- cells `(-386,16)` and `(16,-386)` both map to `0x03f7ca9b`.

The pair hash's sampled avalanche mean was `15.997165` changed output bits out of 32; the RMS per input/output cell deviation from 50% was `0.001958`, and the worst sampled deviation was `0.008652`. Adjacent grid edges averaged `16.001890` changed bits with a maximum per-output-bit deviation of `0.000647`.

These are bounded conformance observations, not a formal randomness guarantee.

### Observation root D — comparison and negative controls

The newer two-round constants improved the sampled avalanche maximum deviation (`0.006943`) and had fewer collisions in these fixtures (`94` centered pairs; translated mean `7.5`). However, their adjacent maximum bit deviation (`0.000720`) was slightly worse than the current mixer's (`0.000647`), and one finite fixture cannot justify an ABI-breaking replacement.

The weak XOR pair produced the most instructive counterexample. Its low-byte chi-square was exactly `0.0`, superficially perfect, while the centered grid contained `524,288` duplicate items, adjacent cells changed only `2.0117` bits on average, and sampled one-bit avalanche changed exactly one output bit. A flat low-byte histogram alone can therefore certify a disastrously structured spatial hash.

The weak pair also had zero collisions inside the sixteen narrower translated windows. “No collisions in selected windows” is likewise insufficient without avalanche and spatial tests.

## Candidate

Retain the current N14/N15 mixer only as a versioned procedural seed or compact fingerprint while its actual production use remains unverified. The canonical Cell identity must retain the ordered signed coordinates, or another collision-free composite key; the 32-bit hash must never replace them in state, cache, revision or serialization identity.

Minimum evaluation for a spatial procedural hash should keep separate:

1. collision counts against an explicit key population and birthday baseline;
2. exact collision witnesses;
3. adjacent spatial bit changes;
4. sampled input/output avalanche matrix;
5. low-bit bucket distribution;
6. runtime cost and the actual hash-to-gradient/value mapping;
7. unique identity, which cannot be inferred from any 32-bit hash of unrestricted 2D coordinates.

## Current Best View

N14/N15 established cross-language bit stability for the current 32-bit output. N16 narrows its semantics: that output is a reproducible procedural seed/fingerprint, **not a Canonical Cell ID**. Stable reproduction and uniqueness are different properties.

The current mixer is not rejected by this bounded spatial fixture, but neither it nor the newer constants are promoted for production. The newer comparison is a reversible candidate only; changing constants would alter every downstream seed and require versioned migration plus visual/device acceptance.

## Frozen

- Canonical Truth, Frozen R1 and all production Mother branches remain unchanged.
- N14/N15 locked vectors remain valid for their recorded mixer version.
- No production seed, material, cache key or coordinate representation was replaced.
- Existing Mother routes were not repeated without acknowledgement.

## Rejected

- “A deterministic 32-bit pair hash is a unique 2D Cell identity.”
- “Perfect low-byte uniformity proves a good spatial hash.”
- “No collision in a selected window proves collision freedom.”
- “A lower upstream single-input bias automatically wins after 2D composition.”
- “Fewer collisions in one finite fixture authorizes an ABI-wide constant replacement.”
- “Avalanche quality proves physical realism or a correct procedural model.”

## Unknown

- Whether any current Mother actually uses this pair hash, and whether it is a seed, cache key or identity.
- Production coordinate populations, hash-to-float/gradient mapping and visual sensitivity.
- Browser/mobile execution cost and target-device behavior.
- Wider statistical suites and application-specific collision tolerance.
- Mother acknowledgement, implementation, public/device validation and user acceptance.

## Routing recommendation

Hold N16 with the N13–N15 addendum for Brick Material and Landscape. Do not repeat-comment HOUSE PR15 or Landscape PR79 before acknowledgement. If a Mother uses a 32-bit hash as a unique Cell/cache identity, the route should block that use and require the ordered integer coordinates to remain authoritative. If it uses the hash only for procedural seeding, validate the actual hash-to-value/gradient mapping and visual result separately.

The next bounded knowledge gap is the `u32`-to-float/gradient mapping contract: endpoint, precision and bias behavior can undo an otherwise sound integer mixer. First-tier expert AI was not called; routine cross-AI discussion remains owned by the separate expert task.
