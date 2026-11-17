# N305 — Component-Scoped Golden Baseline

## Bounded question

How can KAOPU preserve an already accepted component exactly while unfinished sibling components continue to evolve in newer whole-repository snapshots?

## Current Best View comparison

R2 and the no-stale-delivery gate already require an exact accepted baseline and prohibit stale or wrong-parent delivery. That is necessary and remains unchanged. The gap is narrower: a whole commit cannot encode “keep this accepted component, continue changing that sibling.”

The auditioned Git object model adds one bounded mechanism: a commit names a tree snapshot, while tree entries name child blobs or subtrees. KAOPU can therefore complement the whole-commit baseline with a normalized component manifest whose SHA-256 digest covers only the accepted component’s explicit paths.

## Falsifiable replay

- Baseline: console component accepted; rear body unfinished.
- Candidate A: rear body changes, console digest unchanged.
- Candidate B: rear body and console both change.
- Whole-snapshot identity changes in both candidates.
- The component gate passes A and holds B.

The executable probe passed all three assertions. This demonstrates expressiveness only; it does not prove production benefit.

## Candidate decision

Status: `TEACHER_CANDIDATE`, lifecycle: `AUDITION`.

Retain the R2 whole-commit Golden Baseline as Current Best View. Audition a Component-Scoped Golden Baseline Manifest in one affected Mother or historical replay. Do not make it a global gate until it shows fewer protected-part regressions without blocking legitimate sibling iteration.

No duplicate stale-delivery regression was created. Existing `TERRAIN_NO_STALE_DELIVERY_001` remains the lineage case; this replay is candidate evidence for component scope.

## Limits

Content identity does not establish visual correctness. LFS payloads, submodules, generated/runtime artifacts, browser/device captures, nondeterministic builds, symlinks, path renames, case normalization, and file modes need explicit handling. A Producer cannot self-authorize reopening an accepted component.
