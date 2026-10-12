# Compact trace result audit

Scope: execution/result transport only; no construction, mother, age, physical distance or canonical merge change. Production is unchanged pending GPU evidence.

- `function-receiver.mjs:45–47` writes 4 MRT query results but forwards only A to trace advancement. Alternate mode 3 uses only full A.y to select the exact existing id15 roof / id17 floor exclusion. It must remain a full original-function union query.
- `group-ray-stages.mjs:19–24` constructs a temporary HitField from A, but both original `barrelAdvance` and `floorAdvance` inspect only h.id. Advancement uses h.d and point/ray. The old A.z/baseD and A.w/seed still participate in finite/range rejection, so their validity must be encoded rather than discarded.
- `group-runtime.mjs:48–61` accumulates rawCount and sticky overflow, merging physical distance with strict `<` in canonical group order. Compact output must preserve both, as well as the current winning A validity; a later valid winner can replace an invalid seed/base winner, whereas overflow cannot clear.
- One RGBA32F result can hold physical distance, id, rawCount, flags (bit0 sticky overflow; bit1 winner A invalid). Overflow emits original d=0/id999. Neither sourceSeed nor spatial q/extent is needed to advance a ray; those remain fully computed inside each same-source physical query.
- `function-receiver.mjs:52–59` already re-queries original complete fields at the final hit, then four normal offsets. `group-ray-stages.mjs:43–48` packs q/seed/extent/source/base for material response. Leave this entire full-field path unchanged initially. It also verifies final material id equals the traced id.
- No alternate removal, changed epsilon, iteration count, shape, material sampling, tie ordering, or default fallback is proposed.

The first bounded GPU trial compares compact group0 against the frozen full original field at 940 points, one age/exclusion state. It separately measures trivial same-dimension 4-MRT versus1-MRT read/write traffic, per-attachment readback timings, and timer-query support. These controls cannot alone prove total trace acceleration or whole-scene acceptance. Full states, ordered multigroup/alternate/advance and final full-field identity remain later gates.
