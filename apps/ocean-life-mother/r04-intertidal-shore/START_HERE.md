# Ocean Life Mother R04 — Intertidal Shore Coupling

Date: 2026-09-19

Parent Ocean contract:

- branch: `work/ocean-mother-r0202-shoreline-swash-20260919`
- plan: `docs/ocean/shoreline-swash-r0202/MASTER_PLAN.md`
- machine contract: `docs/ocean/shoreline-swash-r0202/SHARED_CONTRACT.json`

## Exact first task

Implement a source-independent `intertidalAt` adapter and test fixture for one reef-protected white-sand / shallow-reef cell. It must consume authoritative immersion, wave-stress and substrate values; it may not invent a second tide, shoreline or seabed.

First outputs:

```text
intertidalAt(x, z, worldTime)
  -> immersionFraction
  -> waveStress
  -> substrateClass
  -> habitatClass
  -> evidenceClass
```

The first habitat classes are deliberately generic:

- dry upper sand;
- recently inundated wet sand;
- active swash strip;
- shallow sand / rubble;
- visible coral-block exclusion / refuge;
- algae or wrack candidate.

Do not assign final species from appearance alone. Small crabs, molluscs, algae, shorebirds and stranded-fish behavior remain later consumers of the habitat field.

## Execution gate

Within the first bounded work cycle, deliver all of the following:

1. executable code, not another planning-only document;
2. unit/numerical tests proving habitat changes when immersion, wave stress and substrate change;
3. a receipt with exact base/head SHA and commands;
4. `KNOWN_LIMITATIONS.md` separating evidence, candidate expression and unknowns;
5. no claim of public or visual acceptance unless there is an actual rendered workbench.

If a required input is unavailable, commit a small adapter with synthetic fixtures and mark it synthetic. Do not remain in an unbounded thinking state and do not invent biological parameters.
