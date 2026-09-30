# Binary Source Asset Gate

This handoff branch contains all text-readable project state, reconstruction tools, contracts, exact hashes, glTF JSON, skeleton hierarchy, inverse bind matrices, weight statistics and animation keyframes that the connected GitHub writer can transmit.

The following large binary assets are **not** embedded in this commit and must not be reported as present:

- `crab+3d+model.zip`
- `animated_crab_rigged_free.zip`
- `scene.bin` and original texture images
- R01/R02/R03 full ZIPs, large self-contained HTML builds, PBR atlases and binary surface score

Their exact size and SHA-256 are frozen in `source_registry/SOURCE_REGISTRY_R04.json`. Upload them later through Git LFS, a GitHub Release asset, or a repository upload mechanism that accepts local binary files. Do not substitute a different download with the same filename.

Until the hashes match, the animated teacher cannot be considered reproducibly available to a remote agent for full one-to-one surface reconstruction. The extracted skeleton and animation knowledge is sufficient for audit and planning, but not a replacement for the original geometry buffer and textures.
