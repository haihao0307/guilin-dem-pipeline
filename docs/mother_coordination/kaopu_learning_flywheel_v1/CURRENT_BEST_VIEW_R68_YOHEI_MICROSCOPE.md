# Current Best View R68 — Yohei Macroscopic Microscope

Status: **Candidate partial**; source-state semantics advanced, original host/runtime reproduction and human acceptance remain Unknown.

## What changed

- The visible compact fragment reads `q`, `i`, `e` and `R` before defined values. Khronos defines such reads as legal but undefined, so the fragment cannot be treated as a portable deterministic standalone program without a host/initialization contract.
- Explicit seed counterexamples change iteration count and can move the first transformed point onto or away from the known radius-zero singularity. Default-zero is not a harmless undocumented assumption.
- `d/=-d` is component-wise division. Every finite nonzero component becomes `-1`; it is not `d=-d`. Zero components create a non-finite/undefined boundary.
- Faithful emulation and portable reinterpretation must be separately versioned. A single matching compiler image cannot promote undefined state to portable semantics.

## Preserved boundaries

- Author article observation, Khronos normative semantics and CPU derivation remain distinct roots/levels.
- The CPU probe demonstrates explicit-seed counterexamples; it is not original GPU, visual or physical evidence.
- The article's typographic dash repair, byte-exact source, host wrapper, license and original pixels remain Unknown/Candidate as applicable.
- Ray-marched appearance is not geometry, PBR material, physical process, Object DNA or measured truth.
- Gaussian R66 remains queued. Canonical DEM, Frozen R1 and production Mother branches remain unchanged.
- Routing is prepared only; no Mother adoption is claimed.
