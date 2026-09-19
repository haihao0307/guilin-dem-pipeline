# Landscape Mother — Beach Profile R01

Date: 2026-09-19

Parent Ocean contract:

- `work/ocean-mother-r0202-shoreline-swash-20260919`
- `docs/ocean/shoreline-swash-r0202/MASTER_PLAN.md`
- `docs/ocean/shoreline-swash-r0202/SHARED_CONTRACT.json`

## Exact first task

Produce an executable continuous cross-shore profile for one reef-protected Stone Money Island wake-up-bay cell. The profile must connect:

`dry upper sand -> wet swash sand -> shallow lagoon sand/rubble -> reef-flat transition`

Required authoritative query:

```text
substrateAt(x, z)
  -> elevation
  -> materialClass
  -> porosity
  -> roughness
  -> erodibility
```

Also expose `shoreAt` geometry inputs: signed shoreline distance, tangent, outward normal, exposure and beach slope.

## Constraints

- Do not change water level to hide terrain errors.
- Do not paint a dark wet-sand strip independent of inundation history.
- Do not use a generic open-ocean beach profile everywhere; this first cell is reef-protected lagoon shore.
- Preserve existing Formation Event Field work and truth masks.
- Do not add decorative coral or vegetation in this task.

## Required first delivery

1. source-code commit implementing the profile/query;
2. numerical tests for continuity, monotonic connected drainage and barrier behavior;
3. neutral geometry view plus desktop and 390x844 capture if rendering changes;
4. exact base/head SHA and command receipt;
5. `KNOWN_LIMITATIONS.md` separating reliable Stone Money relationships from candidate dimensions.

A planning note, a screenshot without code, or a long reasoning report without an executable delta does not count as started.
