# Shared DEM ecology surface skill v0.5 implementation task

## Branch

`skill/dem-ecology-surface-v050`

## Target

`integration/ecology-v040`

## Goal

Turn `skills/dem-ecology-surface/SKILL.md` into the shared, machine-testable skill used by the Guilin, Kunming, and Wenzhou-Taizhou projects.

## Required work

1. Review the full skill and preserve its terminology and rules.
2. Add machine-readable contracts for:
   - terrain and hard-exclusion fields;
   - vegetation prototypes;
   - wind profiles;
   - crop and field profiles;
   - season profiles;
   - parallax strand surface parameters;
   - project release dependencies.
3. Add a minimal shared runtime API and type definitions that city projects can import without copying project-specific species data.
4. Add validation scripts and tests for hard exclusions, deterministic global phase, wind-root locking, field-row continuity, crop palette distinction, bund cuts, season stability, and rollback references.
5. Add city profile templates for Guilin, Kunming, and Wenzhou-Taizhou. Templates contain interfaces and placeholders only. They do not invent unsupported historical data.
6. Preserve all current v0.3.1 assets and the existing v0.4 Phase A implementation.
7. Create `HANDOFF_SHARED_SKILL_V050.md` listing contracts, tests, compatibility, known gaps, and how each project locks a skill version.

## Acceptance

- The skill remains readable as a production specification.
- Contracts validate without external network access.
- Existing Guilin Phase A tests still pass.
- New shared-skill tests pass.
- No project-specific coordinates or species are silently copied into another city.
- Global projected-coordinate phase is the only source for cross-tile procedural continuity.
- The stable v0.3.1 release remains untouched.
