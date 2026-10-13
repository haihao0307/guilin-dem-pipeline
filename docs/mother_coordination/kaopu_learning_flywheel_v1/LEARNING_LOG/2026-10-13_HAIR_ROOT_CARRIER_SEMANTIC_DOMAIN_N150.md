# N150 — Hair root carrier semantic domain

## Bounded question

Can F02's `activeOutside=0` plus a 211-vertex coordinate-box auricle sample prove that every enabled diagnostic root lies on authorized scalp/sideburn skin rather than the pinna?

Decision: **no**. Current legal state is `HOLD_ROOT_CARRIER_SEMANTIC_DOMAIN_UNBOUND`.

## Existing real failure

- The user visually reported roots growing onto the ear and asked that the small offending region be removed while preserving the sideburn transition.
- PR #261 fixes exact subject `50b969215df2a7fbaa545a920325073a4de9e78f`; its core report passes 20 checks and reports `activeOutside=0`.
- `activeOutside` compares enabled roots with the same `growth()` predicate that enabled them, so it is a consistency check, not an independent anatomy-domain check.
- `protruding auricle excluded` tests only vertices inside `abs(x)>.084, .241<y<.300, .002<z<.033` (211 vertices in the frozen report). It does not bind a complete semantic pinna region and cannot exclude ear vertices outside that box.
- The current native component filter is not enough: F02 treats the connected head surface as component 0, while scalp, sideburn skin and pinna require a finer semantic partition.

This does not invalidate the fixed public build, its browser execution, frontal lock, deterministic roots or disclosure that diagnostic roots are not biological follicle count. It blocks only the stronger claim that every enabled root has a valid anatomical carrier.

## External comparison / teacher decision

No external teacher was auditioned. This failure is directly falsified by the current production code and user correction. SideFX-style density masks were already considered by F01/S01 and do not by themselves provide the missing KAOPU-specific scalp/sideburn/pinna partition. Teacher status for this bounded question: `NO_NOVELTY`.

The separate question “are all visible dots all biological follicles?” is already disclosed in PR #261, `DELIVERY.json`, README and the public panel as diagnostic roots rather than biological follicle count. It is therefore `NO_NOVELTY` this round and was not added as a second regression.

## Comparison with current KAOPU controls

N143 already checks root density, direction, seed and authorized part identity. It did not distinguish which anatomical carrier surface owns each root. N150 therefore extends the existing case rather than creating a duplicate.

Candidate receipt delta:

- exact tested subject and carrier-mesh digest;
- semantic region-partition digest;
- authorized scalp region ID;
- authorized sideburn corridor ID;
- forbidden pinna region ID;
- digest of enabled root IDs;
- exact enabled-root count on forbidden pinna;
- exact sideburn/pinna mask overlap count;
- an injected known-ear-root positive control and its detection result.

## Falsifiable hypothesis

For the next Hair Foundation correction, a semantic scalp/sideburn/pinna partition plus zero forbidden-pinna roots and a detected injected ear-root control will catch the user-visible ear overgrowth while allowing an explicitly separate sideburn corridor. A coordinate-box sample or the growth function checking itself will not.

The hypothesis is falsified if the new receipt passes while an enabled root is visibly carried by the pinna, or if it rejects an authorized sideburn root whose carrier is disjoint from the pinna mask.

## Minimal replay

The N150 classifier replays six cases:

1. exact F02 receipt with coordinate-box test only;
2. self-referential `activeOutside=0`;
3. seven enabled roots on semantic pinna;
4. authorized sideburn corridor overlapping pinna;
5. complete semantic masks but no positive control;
6. disjoint scalp/sideburn carriers, zero pinna roots and detected positive control.

Result: see `PROBES/hair_root_carrier_semantic_result_n150.json`.

## Scope and adoption

- Local Candidate for Hair Foundation only; do not apply globally.
- The zero threshold is authorized by the current user's explicit no-ear-growth correction, not asserted as universal human biology.
- Does not approve the current scalp boundary, sideburn shape, density, direction, hairstyle, physics or visual fidelity.
- Does not modify PR #261, production branches, main, R2 or any gate threshold.
- Routed only to Hair PR #261: https://github.com/haihao0307/guilin-dem-pipeline/pull/261#issuecomment-6144799602
- Lifecycle after routing: `POSTED=true`; `CLASSIFICATION-GATE-RUN=true (6/6)`; `ACKNOWLEDGED / IMPLEMENTED / HAIR-PRODUCTION-GATE-RUN / ADOPTED / USER-ACCEPTED=false`.
- Effect KPIs: `unknown` until the Hair Mother implements the semantic partition and runs the production positive control.
