# N215 — Mechanical material, protection and condition separation

## Bounded question

Can a fastener standard designation plus one `finish` or `old/new` label reproducibly determine material, protective system and observed service condition?

## Existing failure and N214 delta

N214 already separated standard identity, dimensions, `materialGrade` and `finish`. It did not make the boundary between protective treatment and evidence-backed service condition executable. A producer could still interpret `finish=old` as permission to add generic rust/noise, even when substrate, passivation, environment and exposure history do not support that appearance.

This round updates the existing regression rather than creating a duplicate case.

## Pinned primary source

NASA Technical Reports Server document `19900009424`, NASA-RP-1228, published 1990-03-01, with erratum dated 2008-06-17.

The manual treats fastener materials, platings/coatings, thread lubricants and corrosion as separate engineering subjects. It also states that plating can limit service temperature and that dissimilar material contact can cause galvanic corrosion. The 2008 erratum adds an explicit environmental boundary: cadmium and zinc plating guidance was written mainly for aeronautical use and omitted outgassing concerns relevant to vacuum.

## Teacher candidate screening

1. **Source/provenance:** official NASA NTRS record, document ID and report number pinned.
2. **Maintenance/activity:** historical 1990 reference; a 2008 erratum corrects scope. No claim of active software maintenance.
3. **Runnable code/tests/data:** no code or renderer. It provides engineering tables and criteria; KAOPU's contribution is a small falsifiable state-contract replay.
4. **License/rights:** NTRS marks it public and work of the US Government, public use permitted.
5. **Direct relevance:** directly addresses the current Mechanical Mother risk of collapsing standard identity, material, protection and aging appearance.
6. **Novelty over Current Best View:** N214 had `materialGrade` and `finish`; NASA evidence forces `protectiveSystem` and `serviceCondition` to be separate, with environment/exposure evidence required for an aging claim.
7. **Dependencies/cost/risk:** document-only teacher; no runtime dependency. Integration cost is schema/gate work. Risk is treating historical guidance as current universal qualification.
8. **Demo/opacity/version risk:** not demo-only or training-data-dependent, but old and aeronautics-scoped. The 2008 erratum proves the need for an environment applicability field.

## What it knows beyond the Current Best View

On one bounded question it knows that geometry standard does not choose the material, material does not fully choose the protective treatment, and neither determines the observed corrosion/aging state without service environment and exposure history. It also supplies a concrete counterexample to context-free reuse: aeronautical plating guidance can fail in space-vacuum use because of outgassing.

Teacher status: `TEACHER_CANDIDATE` for state factorization and compatibility-test design only.

Rejected scope: current coating qualification, numeric design authority, visual rust recipes, or any claim that an `old` label is evidence.

## Minimal falsifiable replay

The N215 probe treats the following as independent axes:

1. geometry standard;
2. material and heat treatment;
3. protective system and lubricant state;
4. service environment, exposure history, condition state and evidence.

It checks that two parts with identical ISO geometry but different materials/protective systems cannot share one full identity key, and rejects a generic `old` condition lacking environment, exposure and evidence.

Result: 6/6 synthetic/source-contract checks passed.

## Candidate translation

The existing `MECHANICAL-STANDARD-IDENTITY-AND-DIMENSION-PROVENANCE-001` case is extended with:

- Task Anchor: `heatTreatment`, `protectiveSystem`, `protectiveSystemSpec`, `lubricantState`, `serviceEnvironment`, `exposureHistory`, `conditionState`, `conditionEvidence`;
- Delivery Receipt: material/protection compatibility and environment/condition compatibility results;
- negative controls: standard designation silently supplying material/coating; generic rust or `old` appearance without substrate/environment/exposure evidence.

## Decision and status boundary

Decision: `SEPARATE_GEOMETRY_MATERIAL_PROTECTION_AND_CONDITION_KEYS`.

- `POSTED=false`
- source/synthetic `GATE-RUN=true`
- `ACKNOWLEDGED=false`
- `IMPLEMENTED=false`
- Mechanical production `GATE-RUN=false`
- `ADOPTED=false`
- `USER-ACCEPTED=false`

No production Mother, `main`, R2 OS or global gate was modified. KPI values remain `unknown`.
