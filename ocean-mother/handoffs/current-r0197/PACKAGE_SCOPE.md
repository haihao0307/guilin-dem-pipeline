# Package Scope

## Included

- Current handoff documents and source locks.
- Exact frozen visual restore source at `ocean-mother/restart-v0311`.
- Current public mobile runtime candidate R019.7.
- R019.7 build script and its R019.6 base HTML/build scripts, so the current candidate can be reconstructed without relying on an unspecified latest branch.
- Ocean Coast R1 learning and audit documents.
- KAOPU Ocean Coast adapter.
- Relevant R019.6/R019.7 CI workflow definitions.
- Package manifest, checksums, receipt and verification script.

## Explicitly excluded

- Textures, photos, screenshots, concept art and external models.
- `node_modules`, browser binaries, downloaded dependencies, caches and temporary files.
- Unrelated DEM, Landscape, Weather, Aircraft, House, Farmland or animal production assets.
- Duplicate historical Ocean release files that are neither the frozen visual source nor required by the R019.7 reconstruction chain.
- Claims of user visual approval, production readiness, commercial quality or hydrodynamic validation.

## Why two runtime/visual sources are present

The package intentionally contains two distinct roles rather than treating them as duplicate versions:

- `frozen_visual_source/restart-v0311`: preserves the earlier near-success visual direction and the complete R018.11 restart material.
- `current_mobile_candidate`: preserves the R019.7 mobile-open and staged-runtime work that the user confirmed can be viewed on iPhone.

The next production line must merge these roles carefully. It must not continue treating the rough R019.7 visual output as the visual mother.
