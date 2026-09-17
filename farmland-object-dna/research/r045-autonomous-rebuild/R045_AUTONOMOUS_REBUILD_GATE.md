# Farmland Mother R045 · Autonomous Rebuild Gate

Date: 2026-09-17
Status: study and rebuild phase; no active visual baseline.

## Current verdict

R044 and the preceding public workbenches are not accepted as the visual or agricultural baseline. They remain only as failure evidence. The principal gap is not missing decoration; it is that terrain formation, hydrology, terrace construction, parcel history, access, labor scale, and visual composition are not yet unified at a professional terrain-generator level.

## What remains reusable

- confirmed scene relationship: rear mountains and source forest -> one dominant agricultural slope -> foothill transition -> broad foreground paddy plain -> front receiving river;
- fixed-world coordinates and deterministic identity;
- shared bund ownership;
- per-field inlet / outlet and source-to-receiver graph requirements;
- actor grounding and task-restricted movement;
- fail-closed QA and preserved failed versions.

## What must be relearned before the next public version

1. Terrain formation and hierarchy at the level demonstrated by the MrRolord reference: drainage hierarchy, accumulated-distance fields, valley and bench formation, terrain-conforming land use, vegetation and material fields.
2. Agricultural morphology from the supplied references: paddy placement, management blocks, historical subdivision, bund cross-sections, paths, local water-control openings, terrace bench / riser relations, and foothill-to-plain transition.
3. Rice cultivation as an operational system: land preparation, water control, transplanting, field maintenance, buffalo work, access, shelters, harvesting, and failure conditions.
4. Visual composition and material coherence: distant mountains, one-sided slope, plain scale, river placement, tree groups, atmosphere, wetness, soil, crop stages, and near / mid / far consistency.

## Delivery policy

No more intermediate workbench links, package-only handoffs, or versions that have only passed numerical topology checks.

The next public workbench is delivered only after all of the following pass internally:

- long-view composition reads correctly without explanation;
- terrain, terraces, plain, and river form one continuous land body;
- no two-sided valley or mirrored agricultural slope;
- parcel shapes match the reference family rather than grid, Voronoi, or bacterial patterns;
- every field has legal irrigation, drainage, and labor access;
- bunds, channels, inlets, outlets, benches, and risers are visible geometric structures;
- people and buffalo perform task-related movement without floating, crossing risers, or wandering randomly;
- fixed-camera screenshots from overview, slope, terrace, plain, water, and labor views are reviewed side-by-side against references;
- the public GitHub fixed-commit URL is tested and opens directly;
- visualAcceptance remains false until the user approves the visible result.

truthApproved=false
visualApproved=false
visualAcceptance=false
productionReady=false
