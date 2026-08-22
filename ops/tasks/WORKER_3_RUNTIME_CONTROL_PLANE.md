# Codex Worker 3: Web runtime, QA, deployment and control plane v0.4.0

## Branch

`codex/runtime-control-plane-v040`

Before implementation, fetch and rebase onto `origin/integration/ecology-v040` so the shared contracts are present.

## Read first

- `.github/workflows/guilin-dem-extended.yml`
- `PROJECT_MANIFEST.json`
- `DEM-Map-Pipeline/guilin-zhenbaoding-yangshuo-pingle/site/package.json`
- `DEM-Map-Pipeline/guilin-zhenbaoding-yangshuo-pingle/site/tests/rendered-html.test.mjs`
- `DEM-Map-Pipeline/guilin-zhenbaoding-yangshuo-pingle/web/index.html`
- `DEM-Map-Pipeline/guilin-zhenbaoding-yangshuo-pingle/site/public/terrain/index.html`
- `DEM-Map-Pipeline/guilin-zhenbaoding-yangshuo-pingle/metadata/ecology/v0.3.1/ecology-release-manifest.json`
- `contracts/FIELD_CONTRACTS_v0.4.0.md`
- `contracts/SHARED_HARD_RULES.md`

## Objective

Integrate the v0.4.0 terrain and ecology outputs into the existing browser runtime, preserve v0.3.1 rollback, add automated QA and deployment gates, and create a visible control page for ChatGPT-directed Codex work.

## Runtime requirements

1. Load ecology releases by manifest version. Default to v0.4.0 only after all validation gates pass.
2. Keep v0.3.1 selectable as a rollback release.
3. Add layer toggles for water, bank, erosion, rock, forest, shrubs, bamboo, paddy, vegetables, dry fields, orchards, bunds, rows and diagnostics.
4. Add camera presets for overview, water, erosion, rock, forest, bamboo, paddy, vegetable plots, orchard and top view.
5. Add stable far, medium and near detail transitions. Far uses fields and canopy color, medium uses canopy and strand parallax, near uses bounded geometry instances.
6. Prevent visible tile seams in terrain, canopy, rows and strand phase.
7. Keep the main terrain page and Gaea proof page available as fixed review targets.

## Control page

Create `/ops/` with a compact dashboard that reads static JSON generated during CI and displays:

- current stable release
- current integration branch
- worker task states
- branch and pull request references
- test summary
- workflow and deployment status
- browser preview links
- screenshot comparison links
- release package and checksum references
- rollback release
- failure and retry notes

Do not require private tokens in the browser. CI writes sanitized status JSON.

## CI and release requirements

1. Extend GitHub Actions with separate validation steps for truth immutability, water exclusions, rock exclusions, agriculture exclusions, deterministic rebuild, asset checksums, seam tests, browser smoke tests and package creation.
2. Upload validation reports, screenshots and the Windows-compatible release ZIP as artifacts.
3. Deploy Pages only after validation passes.
4. Preserve existing workflow behavior for the current DEM build.
5. Add a release candidate manifest and changelog.

## Validation gates

- Python tests pass.
- Node/site tests pass.
- Asset checksums pass.
- Browser smoke test covers all camera presets and layer toggles.
- Console error count is 0.
- `/ops/`, terrain page and Gaea proof page return HTTP 200 in the deployed artifact.
- v0.3.1 rollback still loads.

## Handoff

Create `HANDOFF_RUNTIME_V040.md` with changed files, runtime architecture, CI changes, tests, screenshots, deployment behavior, known issues and rollback procedure. Rebase on the integrated Worker 1 and Worker 2 result before final review. Open a PR to `integration/ecology-v040`. Do not merge it yourself.
