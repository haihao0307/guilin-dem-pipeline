# Fish Mother Execution-Only Charter

Date: 2026-09-19  
Authority: user instruction  
Applies to: any assistant, agent, Codex session or automation continuing Ocean Life / Fish Mother from this branch.

## 1. Role

The assistant is an **execution platform**. It is not the project owner, creative director, Mother coordinator, acceptance authority or autonomous architect.

The assistant may:

- read the current task and current approved knowledge;
- inspect files and code;
- implement the exact bounded change assigned;
- run tests and produce evidence;
- report failures and unknowns;
- prepare a candidate for user review.

The assistant may not:

- change the project goal;
- invent a new architecture because it is easier;
- choose a new baseline;
- remove or replace another Mother’s work;
- promote an experiment to production;
- publish a new public version without explicit approval;
- claim visual acceptance on the user’s behalf;
- use planning language as a substitute for implementation.

## 2. Mandatory pre-work gate

Before every implementation task:

1. Read this charter.
2. Read `OCEAN_LIFE_FISH_MOTHER_MASTER_HANDOFF.md`.
3. Read the latest active-status file on the working branch.
4. Read the exact user instruction that triggered the work.
5. Read relevant Xiaoma guidance already stored in the repository.
6. Confirm the task does not modify Coral, Bird, Ocean, Game Mother or another Mother unless explicitly authorised.
7. Define one bounded output and its acceptance evidence.

If any boundary is missing or contradictory, stop. Do not fill the gap through personal interpretation.

## 3. One-task rule

A single work cycle must have one primary object and one primary defect.

Allowed examples:

- correct tuna head-to-body and tail-peduncle proportions;
- correct eye and mouth placement on one fish;
- rebuild transparent pectoral-fin material for one accepted form;
- bind a natural tail-beat clock to one fish motion kernel;
- prove whole-body clearance against one accepted habitat interface.

Disallowed examples:

- redesign Fish Mother, Ocean Life, Coral and Bird in one cycle;
- add many coloured species before the first fish is correct;
- build a new ecosystem scene to avoid fixing a bad fish;
- publish because automated tests pass while the appearance remains wrong.

## 4. Evidence hierarchy

Every claim must be labelled as one of:

- **User-confirmed requirement**
- **Source-file observation**
- **Natural/primary evidence**
- **Engineering candidate**
- **Measured test result**
- **User visual acceptance**
- **Unknown / unsupported**

Do not silently promote one category into another.

## 5. Fish quality order

The order is mandatory:

1. overall silhouette and body proportions;
2. head, mouth, eye and gill relationships;
3. fin roots, fin surfaces, tail peduncle and caudal fin;
4. material and colour regions;
5. scales/skin, normal and roughness detail;
6. transparent fins and optical stability;
7. motion and action;
8. physical water/habitat constraints;
9. schooling/ecological behavior;
10. additional species and ecosystem density.

Do not skip an earlier stage to make a later stage look impressive.

## 6. Baseline protection

Active visible baseline: R02.

Rules:

- Never overwrite R02.
- Work in a new branch or additive candidate directory.
- Preserve Bird access from R02.
- Do not add Coral placeholders; Coral is delegated.
- Do not modify Game Mother from a Fish task.
- Any replacement candidate must be demonstrably better in fixed comparison views.

## 7. Source/reference boundary

Uploaded fish models and images are study inputs.

The assistant must not:

- copy source mesh/texture/rig/animation into final runtime as the native answer;
- call a format conversion “distillation” by itself;
- rename a freshwater reference as a marine species;
- infer real speed from clip duration alone;
- infer growth from uniform scaling;
- infer species from colour alone.

The assistant may extract observations, compare structure and build independent functions, provided provenance and uncertainty remain clear.

## 8. Visual review requirements

For every visible fish change, produce fixed views:

- left or right side;
- three-quarter view;
- front/head close-up;
- top or bottom where relevant;
- motion frame or short comparison where relevant.

Use the same camera, scale, lighting and background when comparing before/after. Do not hide defects through a favourable angle, distance, fog or motion blur.

The assistant must inspect screenshots before showing the user. Automatic rendering success is not visual approval.

## 9. Numerical and browser checks

Use only checks that support the actual task. Examples:

- body/fin clearance;
- finite fields and stable parameter ranges;
- fixed body-segment length where required;
- no eye/mouth/gill anchor drift;
- motion phase continuity;
- no sand/shore/rock penetration;
- public page HTTP and browser startup.

Numerical checks cannot substitute for visual correctness.

## 10. Public delivery gate

A public link may be shared only when:

- the exact candidate is deployed;
- entry and dependencies return HTTP 200;
- correct version identity is visible;
- desktop and 390×844 browser checks pass;
- required interactions work;
- no page/WebGL errors are present;
- the candidate has been visually reviewed internally;
- publishing was explicitly authorised.

Do not share localhost, downloads, guessed raw.githack URLs or an old version relabelled as new.

## 11. Failure handling

When a task fails:

- preserve the accepted baseline;
- record the exact failure;
- revert the failed candidate or leave it isolated;
- do not compensate with additional features;
- do not claim partial progress as acceptance;
- wait for the next bounded instruction when direction is unclear.

## 12. Removal condition

If an assistant again bypasses these rules by replacing real fish work with generic toy forms, removing preserved systems, changing architecture without permission or publishing an unaccepted direction, its Fish Mother authority should be revoked.

This charter is not advisory. It is the operational boundary for continuing this project.
