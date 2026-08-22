# HANDOFF RUNTIME V0.4.0

## Scope completed

This handoff covers the Phase A runtime control plane. The stable browser release remains v0.3.1. The v0.4.0 candidate stays disabled until real 10 km² assets, full browser rendering, visual review, packaging, deployment, and rollback tests all pass.

## Added components

- `web/ops/index.html`
- `web/ops/status.json`
- `scripts/ecology_v040/build_ops_control_plane.py`
- `scripts/ecology_v040/runtime_qa.py`
- `scripts/ecology_v040/package_v040_release.py`
- `metadata/ecology/v0.4.0/ecology-release-candidate.json`
- `tests/test_ops_control_plane_v040.py`
- `.github/workflows/ecology-v040-ci.yml`
- `HANDOFF_RUNTIME_V040.md`

## Control page

The static `/ops/` page reads only a sanitized status JSON. It displays the stable and target releases, three worker branches and pull requests, focused test totals, completed gates, pending release gates, rollback release, and links to the main terrain page and live terrain validation page.

The browser receives no GitHub token, private environment variable, application secret, or workflow credential. The status builder rejects sensitive keys and suspicious credential-like values before publication.

## Release policy

- Stable runtime: `v0.3.1`
- Target candidate: `v0.4.0-rc1`
- Candidate default flag: `false`
- Rollback release: `v0.3.1`

The candidate can become the default only when every blocker in `ecology-release-candidate.json` has a passing evidence record and the v0.3.1 rollback loads successfully in a browser test.

## Automated QA

`runtime_qa.py` checks required Phase A files, public-status sanitization, prototype and crop catalog minimums, candidate promotion safety, stable rollback assets, ops-page links, local script dependencies, and SHA-256 hashes for the stable rollback manifest and instance streams.

Run from the project root:

```bash
python scripts/ecology_v040/build_ops_control_plane.py --generated-at 2026-08-22T07:20:00Z
python -m unittest tests/test_terrain_field_compiler_v040.py
python -m unittest tests/test_ecology_agriculture_compiler_v040.py
python -m unittest tests/test_ops_control_plane_v040.py
python scripts/ecology_v040/runtime_qa.py
python scripts/ecology_v040/package_v040_release.py
```

## Windows package

The package builder uses sorted ASCII paths, fixed timestamps, standard Deflate, ordinary Windows file attributes, no encryption, and no symbolic links. It writes the ZIP, SHA-256 text file, and a machine-readable package manifest. Generated archives are CI artifacts and should not be committed to Git.

## Phase B work remaining

1. Build real versioned 10 km² terrain and ecology assets from the project DEM and approved water and historical masks.
2. Publish v0.4.0 field textures and tree, shrub, bamboo, rice, crop, and orchard binary streams.
3. Add three-layer canopy, detailed species silhouettes, tree trunks, shrubs, bamboo, field rows, bund shoulders, irrigation cuts, and parallax fibre shaders to the browser runtime.
4. Run full-scale tile seam, browser console, visual reference, performance, and screenshot validation.
5. Upload the candidate Pages artifact and verify `/ops/`, the main terrain page, and the live terrain validation page return HTTP 200.
6. Verify v0.3.1 rollback in the deployed browser artifact.
7. Promote v0.4.0 only after all evidence passes.

## Rollback

The active runtime is unchanged. Delete the Phase A runtime files listed above or select v0.3.1 in the release manifest. Existing v0.3.1 assets remain in place and are included in runtime QA.
