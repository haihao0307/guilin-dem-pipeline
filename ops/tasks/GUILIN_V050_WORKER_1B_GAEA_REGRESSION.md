# Guilin v0.5 Worker 1B: restore GAEA-style controls and regression coverage

## Branch

`codex/guilin-gaea-regression-v050`

## Target

`project/guilin-v050-four-core`

## Scope

Work only on the missing GAEA-style UI, its functional controls, compatibility with the current terrain and ecology runtime, and regression tests. DEM download and river topology are assigned to Worker 1A.

## Required work

1. Inspect Git history, current web files, stable v0.3.1 assets, previous screenshots and the existing GAEA proof page.
2. Identify the last implementation in which the GAEA-style controls were visible and interactive.
3. Restore the missing panel without deleting current ecology, release, season or diagnostic controls.
4. Restore or provide working controls for:
   - erosion visibility and strength;
   - karst rock exposure;
   - terrain detail or microrelief;
   - water and bank diagnostics;
   - vegetation visibility and density diagnostics;
   - agriculture, bund and crop-row diagnostics;
   - layer reset and stable-version rollback.
5. Keep the truth DEM read-only. UI controls may adjust reversible visual fields only.
6. Ensure the panel can mount in the current stable page, the GAEA proof page and the future `/guilin-v050/` candidate.
7. Add DOM, interaction, state-serialization and reset tests.
8. Add a browser smoke test that verifies required controls exist, can be toggled, and produce no console errors.
9. Add a regression report that names the recovery source files or commits and explains why the controls disappeared.
10. Create `HANDOFF_GUILIN_GAEA_REGRESSION_V050.md`.

## Acceptance

- the GAEA-style panel is visible again;
- required controls are interactive;
- controls act on reversible visual layers only;
- reset returns to the candidate default;
- v0.3.1 rollback remains reachable;
- stable and GAEA proof pages remain valid;
- the panel has a clean mount point for `/guilin-v050/`;
- tests pass and browser console errors are zero.

Submit a draft PR to `project/guilin-v050-four-core`. Do not merge it yourself.
